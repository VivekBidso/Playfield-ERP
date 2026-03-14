"""Production routes - Production entries, batches, planning"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date
import uuid

from database import db
from models import User
from services.utils import (
    get_current_user, check_branch_access, serialize_doc,
    update_branch_rm_inventory, generate_movement_code, 
    get_branch_rm_stock, get_current_rm_price
)

router = APIRouter(tags=["Production"])


async def consume_rm_for_production(
    branch: str,
    sku_id: str,
    quantity: int,
    batch_id: str = None,
    entry_id: str = None,
    user_id: str = None
) -> Dict[str, Any]:
    """Consume raw materials for production using L1/L2 engine"""
    from services.l1_l2_engine import consume_inp_l2_material, consume_inm_l2_material
    
    # Get BOM for SKU
    bom = await db.bill_of_materials.find_one({"sku_id": sku_id}, {"_id": 0})
    if not bom:
        bom = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
    
    if not bom or not bom.get("rm_mappings"):
        raise HTTPException(status_code=400, detail=f"No BOM found for SKU {sku_id}")
    
    consumption_details = []
    
    for mapping in bom["rm_mappings"]:
        rm_id = mapping["rm_id"]
        qty_per_unit = mapping.get("quantity", 1)
        total_qty = qty_per_unit * quantity
        
        # Get RM details
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        if not rm:
            continue
        
        rm_level = rm.get("rm_level", "DIRECT")
        rm_category = rm.get("category", "")
        
        # Use L1/L2 engine for INP/INM L2 items
        if rm_level == "L2" and rm_category == "INP":
            try:
                result = await consume_inp_l2_material(
                    branch=branch,
                    rm_id=rm_id,
                    quantity=int(total_qty),
                    production_batch_id=batch_id or entry_id,
                    user_id=user_id or "system"
                )
                consumption_details.append({
                    "rm_id": rm_id,
                    "quantity_consumed": total_qty,
                    "rm_level": "L2",
                    "l1_consumption": result
                })
            except Exception as e:
                consumption_details.append({
                    "rm_id": rm_id,
                    "quantity_consumed": total_qty,
                    "rm_level": "L2",
                    "error": str(e)
                })
        elif rm_level == "L2" and rm_category == "INM":
            try:
                result = await consume_inm_l2_material(
                    branch=branch,
                    rm_id=rm_id,
                    quantity=int(total_qty),
                    production_batch_id=batch_id or entry_id,
                    user_id=user_id or "system"
                )
                consumption_details.append({
                    "rm_id": rm_id,
                    "quantity_consumed": total_qty,
                    "rm_level": "L2",
                    "l1_consumption": result
                })
            except Exception as e:
                consumption_details.append({
                    "rm_id": rm_id,
                    "quantity_consumed": total_qty,
                    "rm_level": "L2",
                    "error": str(e)
                })
        else:
            # Direct consumption
            current_stock = await get_branch_rm_stock(branch, rm_id)
            
            if current_stock < total_qty:
                consumption_details.append({
                    "rm_id": rm_id,
                    "quantity_consumed": total_qty,
                    "warning": f"Insufficient stock. Available: {current_stock}"
                })
            
            # Deduct stock
            await update_branch_rm_inventory(branch, rm_id, -total_qty)
            
            # Record movement
            movement_code = await generate_movement_code()
            movement = {
                "id": str(uuid.uuid4()),
                "movement_code": movement_code,
                "rm_id": rm_id,
                "branch": branch,
                "movement_type": "PRODUCTION_CONSUMPTION",
                "quantity": -total_qty,
                "reference_type": "PRODUCTION_ENTRY" if entry_id else "PRODUCTION_BATCH",
                "reference_id": entry_id or batch_id,
                "balance_after": current_stock - total_qty,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.rm_stock_movements.insert_one(movement)
            
            consumption_details.append({
                "rm_id": rm_id,
                "quantity_consumed": total_qty,
                "rm_level": "DIRECT"
            })
    
    return {
        "sku_id": sku_id,
        "quantity_produced": quantity,
        "consumption_details": consumption_details
    }


# ============ Production Entries ============

@router.post("/production-entries")
async def create_production_entry(
    input: ProductionEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a production entry with L1/L2 material consumption"""
    check_branch_access(current_user, input.branch)
    
    # Verify SKU exists
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU {input.sku_id} not found")
    
    # Create production entry
    entry = ProductionEntry(
        branch=input.branch,
        sku_id=input.sku_id,
        quantity=input.quantity,
        shift=input.shift if hasattr(input, 'shift') else "Day",
        operator=current_user.name
    )
    
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['production_date'] = doc['production_date'].isoformat() if doc.get('production_date') else None
    
    await db.production_entries.insert_one(doc)
    
    # Consume raw materials
    consumption_result = await consume_rm_for_production(
        branch=input.branch,
        sku_id=input.sku_id,
        quantity=input.quantity,
        entry_id=entry.id
    )
    
    # Update FG inventory
    fg_existing = await db.fg_inventory.find_one(
        {"sku_id": input.sku_id, "branch": input.branch}
    )
    
    if fg_existing:
        await db.fg_inventory.update_one(
            {"sku_id": input.sku_id, "branch": input.branch},
            {"$inc": {"quantity": input.quantity}}
        )
    else:
        await db.fg_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "sku_id": input.sku_id,
            "branch": input.branch,
            "quantity": input.quantity,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "message": "Production entry created",
        "entry": doc,
        "consumption": consumption_result
    }


@router.get("/production-entries")
async def get_production_entries(
    branch: Optional[str] = None,
    sku_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get production entries with filters"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    if sku_id:
        query["sku_id"] = sku_id
    
    if date_from:
        query["production_date"] = {"$gte": date_from}
    if date_to:
        if "production_date" in query:
            query["production_date"]["$lte"] = date_to
        else:
            query["production_date"] = {"$lte": date_to}
    
    entries = await db.production_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with SKU info
    for entry in entries:
        sku = await db.skus.find_one({"sku_id": entry["sku_id"]}, {"_id": 0, "description": 1})
        entry["sku_description"] = sku.get("description") if sku else None
    
    return entries


# ============ Production Planning ============

@router.get("/production-plans")
async def get_production_plans(
    branch: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get production plans"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    if status:
        query["status"] = status
    
    plans = await db.production_plans.find(query, {"_id": 0}).sort("planned_date", 1).to_list(1000)
    return plans


@router.post("/production-plans")
async def create_production_plan(
    input: ProductionPlanCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a production plan"""
    check_branch_access(current_user, input.branch)
    
    plan = ProductionPlanEntry(
        branch=input.branch,
        sku_id=input.sku_id,
        planned_quantity=input.planned_quantity,
        planned_date=input.planned_date
    )
    
    doc = plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['planned_date'] = doc['planned_date'].isoformat()
    
    await db.production_plans.insert_one(doc)
    
    return {"message": "Production plan created", "plan": doc}


# ============ Production Batches ============

@router.get("/production-batches")
async def get_production_batches(
    branch: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get production batches"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    if status:
        query["status"] = status
    
    batches = await db.production_batches.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with SKU info
    for batch in batches:
        sku = await db.skus.find_one({"sku_id": batch.get("sku_id")}, {"_id": 0, "description": 1})
        batch["sku_description"] = sku.get("description") if sku else None
    
    return batches


@router.post("/production-batches")
async def create_production_batch(
    data: ProductionBatchCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new production batch"""
    check_branch_access(current_user, data.branch)
    
    # Generate batch code
    now = datetime.now(timezone.utc)
    prefix = f"PB_{now.strftime('%Y%m%d')}"
    count = await db.production_batches.count_documents({"batch_code": {"$regex": f"^{prefix}"}})
    batch_code = f"{prefix}_{count + 1:04d}"
    
    batch = ProductionBatch(
        batch_code=batch_code,
        branch=data.branch,
        sku_id=data.sku_id,
        planned_quantity=data.planned_quantity,
        dispatch_lot_id=data.dispatch_lot_id if hasattr(data, 'dispatch_lot_id') else None
    )
    
    doc = batch.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.production_batches.insert_one(doc)
    
    return {"message": "Production batch created", "batch": doc}


@router.put("/production-batches/{batch_id}/start")
async def start_production_batch(batch_id: str, current_user: User = Depends(get_current_user)):
    """Start a production batch"""
    batch = await db.production_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    check_branch_access(current_user, batch["branch"])
    
    await db.production_batches.update_one(
        {"id": batch_id},
        {"$set": {"status": "IN_PROGRESS", "started_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Production batch started"}


@router.put("/production-batches/{batch_id}/complete")
async def complete_production_batch(
    batch_id: str,
    produced_quantity: int,
    current_user: User = Depends(get_current_user)
):
    """Complete a production batch"""
    batch = await db.production_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    check_branch_access(current_user, batch["branch"])
    
    # Consume raw materials
    consumption_result = await consume_rm_for_production(
        branch=batch["branch"],
        sku_id=batch["sku_id"],
        quantity=produced_quantity,
        batch_id=batch_id
    )
    
    # Update FG inventory
    fg_existing = await db.fg_inventory.find_one(
        {"sku_id": batch["sku_id"], "branch": batch["branch"]}
    )
    
    if fg_existing:
        await db.fg_inventory.update_one(
            {"sku_id": batch["sku_id"], "branch": batch["branch"]},
            {"$inc": {"quantity": produced_quantity}}
        )
    else:
        await db.fg_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "sku_id": batch["sku_id"],
            "branch": batch["branch"],
            "quantity": produced_quantity,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.production_batches.update_one(
        {"id": batch_id},
        {"$set": {
            "status": "COMPLETED",
            "produced_quantity": produced_quantity,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Production batch completed",
        "consumption": consumption_result
    }


@router.post("/production-batches/{batch_id}/produce-l2")
async def produce_l2_in_batch(
    batch_id: str,
    rm_id: str,
    quantity: int,
    current_user: User = Depends(get_current_user)
):
    """Produce L2 items within a batch (INP molding, INM fabrication)"""
    from services.l1_l2_engine import consume_inp_l2_material, consume_inm_l2_material
    
    batch = await db.production_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    check_branch_access(current_user, batch["branch"])
    
    # Get RM details
    rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail=f"RM {rm_id} not found")
    
    if rm.get("rm_level") != "L2":
        raise HTTPException(status_code=400, detail="This RM is not an L2 item")
    
    # Use L1/L2 engine to produce based on category
    try:
        rm_category = rm.get("category", "")
        if rm_category == "INP":
            result = await consume_inp_l2_material(
                branch=batch["branch"],
                rm_id=rm_id,
                quantity=quantity,
                production_batch_id=batch_id,
                user_id=current_user.id
            )
        elif rm_category == "INM":
            result = await consume_inm_l2_material(
                branch=batch["branch"],
                rm_id=rm_id,
                quantity=quantity,
                production_batch_id=batch_id,
                user_id=current_user.id
            )
        else:
            raise HTTPException(status_code=400, detail=f"L2 production not supported for category {rm_category}")
        
        return {
            "message": f"Produced {quantity} units of {rm_id}",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
