"""L1/L2 Raw Material Consumption Engine for INP and INM categories"""
from datetime import datetime, timezone
from fastapi import HTTPException
import uuid

from database import db
from .inventory_service import (
    generate_movement_code,
    get_branch_rm_stock,
    get_current_rm_price,
    update_branch_rm_inventory,
)


async def consume_inp_l2_material(
    branch: str,
    rm_id: str,
    quantity: int,
    production_batch_id: str,
    user_id: str
) -> dict:
    """
    INP L2 consumption: Weight-based L1 deduction
    
    For INP (In-House Plastic), consuming an L2 part deducts a calculated weight 
    from its L1 parent material (polymer).
    """
    l2_rm = await db.raw_materials.find_one({"rm_id": rm_id})
    
    if not l2_rm or l2_rm.get("category") != "INP" or l2_rm.get("rm_level") != "L2":
        raise HTTPException(status_code=400, detail="This function is only for INP L2 materials")
    
    l1_rm_id = l2_rm.get("parent_rm_id")
    if not l1_rm_id:
        raise HTTPException(status_code=400, detail=f"INP L2 {rm_id} missing polymer L1 reference")
    
    # Calculate L1 consumption (weight-based)
    unit_weight_kg = (l2_rm.get("unit_weight_grams") or 0) / 1000
    scrap_factor = l2_rm.get("scrap_factor") or 0.02
    l1_consumption = quantity * unit_weight_kg * (1 + scrap_factor)
    
    # Check stock
    l1_stock = await get_branch_rm_stock(branch, l1_rm_id)
    if l1_stock < l1_consumption:
        raise HTTPException(
            status_code=400,
            detail=f"Need {l1_consumption:.3f} KG of {l1_rm_id}, only {l1_stock:.3f} available"
        )
    
    # Get price and calculate cost
    l1_price = await get_current_rm_price(l1_rm_id, branch)
    processing_cost = l2_rm.get("processing_cost") or 0
    l2_unit_cost = (unit_weight_kg * l1_price * (1 + scrap_factor)) + processing_cost
    
    # Create L1 consumption movement
    movement_code = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code,
        "rm_id": l1_rm_id,
        "branch_id": "",
        "branch": branch,
        "movement_type": "CONSUMPTION",
        "quantity": -l1_consumption,
        "unit_of_measure": "KG",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "unit_cost": l1_price,
        "total_cost": l1_consumption * l1_price,
        "balance_after": l1_stock - l1_consumption,
        "notes": f"Polymer for {rm_id} x {quantity}",
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id
    })
    
    # Create L2 production movement
    l2_stock = await get_branch_rm_stock(branch, rm_id)
    movement_code2 = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code2,
        "rm_id": rm_id,
        "branch_id": "",
        "branch": branch,
        "movement_type": "PRODUCTION",
        "quantity": quantity,
        "unit_of_measure": "PCS",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "l1_rm_id": l1_rm_id,
        "l1_quantity_consumed": l1_consumption,
        "unit_cost": l2_unit_cost,
        "total_cost": quantity * l2_unit_cost,
        "balance_after": l2_stock + quantity,
        "notes": f"L1: {l1_consumption:.4f} KG",
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id
    })
    
    # Update inventory balances
    await update_branch_rm_inventory(branch, l1_rm_id, -l1_consumption)
    await update_branch_rm_inventory(branch, rm_id, quantity)
    
    return {
        "l2_rm_id": rm_id,
        "quantity_produced": quantity,
        "polymer_consumed": {
            "rm_id": l1_rm_id,
            "quantity_kg": round(l1_consumption, 4),
            "total_cost": round(l1_consumption * l1_price, 2)
        },
        "l2_unit_cost": round(l2_unit_cost, 2),
        "total_batch_cost": round(quantity * l2_unit_cost, 2)
    }


async def consume_inm_l2_material(
    branch: str,
    rm_id: str,
    quantity: int,
    production_batch_id: str,
    user_id: str
) -> dict:
    """
    INM L2 consumption: Dual L1 deduction
    
    For INM (In-House Metal), consuming an L2 part triggers:
    1. A 1:1 unit consumption of its L1 base metal part
    2. A calculated weight consumption of a secondary L1 powder coating material
    """
    l2_rm = await db.raw_materials.find_one({"rm_id": rm_id})
    
    if not l2_rm or l2_rm.get("category") != "INM" or l2_rm.get("rm_level") != "L2":
        raise HTTPException(status_code=400, detail="This function is only for INM L2 materials")
    
    # Get L1 references
    base_metal_rm_id = l2_rm.get("parent_rm_id")
    powder_coating_rm_id = l2_rm.get("secondary_l1_rm_id")
    
    if not base_metal_rm_id:
        raise HTTPException(status_code=400, detail=f"INM L2 {rm_id} missing base metal L1 reference")
    if not powder_coating_rm_id:
        raise HTTPException(status_code=400, detail=f"INM L2 {rm_id} missing powder coating L1 reference")
    
    # Calculate Base Metal consumption (1:1 ratio)
    metal_consumption = quantity
    
    # Calculate Powder Coating consumption
    powder_qty_grams = l2_rm.get("powder_qty_grams") or 0
    if powder_qty_grams <= 0:
        raise HTTPException(status_code=400, detail=f"INM L2 {rm_id} missing predefined powder_qty_grams")
    
    coating_scrap_factor = l2_rm.get("coating_scrap_factor") or 0.10
    coating_consumption_kg = (quantity * powder_qty_grams / 1000) * (1 + coating_scrap_factor)
    
    # Check stock availability
    metal_stock = await get_branch_rm_stock(branch, base_metal_rm_id)
    coating_stock = await get_branch_rm_stock(branch, powder_coating_rm_id)
    
    if metal_stock < metal_consumption:
        raise HTTPException(
            status_code=400,
            detail=f"Need {metal_consumption} units of {base_metal_rm_id}, only {metal_stock} available"
        )
    if coating_stock < coating_consumption_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Need {coating_consumption_kg:.4f} KG of {powder_coating_rm_id}, only {coating_stock:.4f} available"
        )
    
    # Get costs
    l1_unit_cost = await get_current_rm_price(base_metal_rm_id, branch)
    coating_price_per_kg = await get_current_rm_price(powder_coating_rm_id, branch)
    
    # Calculate L2 Unit Cost
    coating_cost_per_unit = (powder_qty_grams / 1000) * coating_price_per_kg * (1 + coating_scrap_factor)
    processing_cost = l2_rm.get("processing_cost") or 0
    
    l2_unit_cost = l1_unit_cost + coating_cost_per_unit + processing_cost
    
    # Create stock movements (Base Metal)
    movement_code1 = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code1,
        "rm_id": base_metal_rm_id,
        "branch_id": "",
        "branch": branch,
        "movement_type": "CONSUMPTION",
        "quantity": -metal_consumption,
        "unit_of_measure": "PCS",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "unit_cost": l1_unit_cost,
        "total_cost": metal_consumption * l1_unit_cost,
        "balance_after": metal_stock - metal_consumption,
        "notes": f"Base metal for {rm_id} x {quantity} (1:1)",
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id
    })
    
    # Create stock movements (Powder Coating)
    movement_code2 = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code2,
        "rm_id": powder_coating_rm_id,
        "branch_id": "",
        "branch": branch,
        "movement_type": "CONSUMPTION",
        "quantity": -coating_consumption_kg,
        "unit_of_measure": "KG",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "unit_cost": coating_price_per_kg,
        "total_cost": coating_consumption_kg * coating_price_per_kg,
        "balance_after": coating_stock - coating_consumption_kg,
        "notes": f"Powder coating for {rm_id} x {quantity} @ {powder_qty_grams}g each",
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id
    })
    
    # Create L2 production movement
    l2_stock = await get_branch_rm_stock(branch, rm_id)
    movement_code3 = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code3,
        "rm_id": rm_id,
        "branch_id": "",
        "branch": branch,
        "movement_type": "PRODUCTION",
        "quantity": quantity,
        "unit_of_measure": "PCS",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "l1_rm_id": base_metal_rm_id,
        "l1_quantity_consumed": metal_consumption,
        "unit_cost": l2_unit_cost,
        "total_cost": quantity * l2_unit_cost,
        "balance_after": l2_stock + quantity,
        "notes": f"L1: {metal_consumption} pcs, Coating: {coating_consumption_kg:.4f} KG",
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id
    })
    
    # Update inventory balances
    await update_branch_rm_inventory(branch, base_metal_rm_id, -metal_consumption)
    await update_branch_rm_inventory(branch, powder_coating_rm_id, -coating_consumption_kg)
    await update_branch_rm_inventory(branch, rm_id, quantity)
    
    return {
        "l2_rm_id": rm_id,
        "quantity_produced": quantity,
        "base_metal_consumed": {
            "rm_id": base_metal_rm_id,
            "quantity": metal_consumption,
            "unit": "PCS",
            "unit_cost": round(l1_unit_cost, 2),
            "total_cost": round(metal_consumption * l1_unit_cost, 2)
        },
        "powder_coating_consumed": {
            "rm_id": powder_coating_rm_id,
            "quantity_kg": round(coating_consumption_kg, 4),
            "grams_per_unit": powder_qty_grams,
            "unit_cost_per_kg": round(coating_price_per_kg, 2),
            "total_cost": round(coating_consumption_kg * coating_price_per_kg, 2)
        },
        "l2_unit_cost_breakdown": {
            "l1_unit_cost": round(l1_unit_cost, 2),
            "coating_cost_per_unit": round(coating_cost_per_unit, 2),
            "processing_cost": round(processing_cost, 2),
            "total_l2_unit_cost": round(l2_unit_cost, 2)
        },
        "total_batch_cost": round(quantity * l2_unit_cost, 2)
    }
