"""Production routes - Production entries, batches, planning"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date
import uuid
import io

from database import db
from models import User
from models.core import ProductionEntryCreate, ProductionPlanCreate
from models.transactional import ProductionBatchCreate
from services.utils import (
    get_current_user, check_branch_access, serialize_doc,
    update_branch_rm_inventory, generate_movement_code, 
    get_branch_rm_stock, get_current_rm_price
)
from services import sku_service

router = APIRouter(tags=["Production"])

# Import openpyxl for Excel handling
try:
    import openpyxl
except ImportError:
    openpyxl = None

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
    sku = await sku_service.get_sku_by_sku_id(input.sku_id)
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
    
    # Update FG inventory (branch_sku_inventory is the single source of truth)
    fg_existing = await db.branch_sku_inventory.find_one(
        {"buyer_sku_id": input.sku_id, "branch": input.branch}
    )
    
    if fg_existing:
        await db.branch_sku_inventory.update_one(
            {"buyer_sku_id": input.sku_id, "branch": input.branch},
            {"$inc": {"current_stock": input.quantity}}
        )
    else:
        await db.branch_sku_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "buyer_sku_id": input.sku_id,
            "branch": input.branch,
            "current_stock": input.quantity,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Publish event
    from services.event_system import event_bus, EventType
    await event_bus.publish(
        EventType.PRODUCTION_ENTRY_CREATED,
        {
            "entry_id": entry.id,
            "sku_id": input.sku_id,
            "quantity": input.quantity,
            "branch": input.branch,
            "created_by": current_user.id
        },
        source_module="production"
    )
    
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
        sku = await sku_service.get_sku_by_sku_id(entry["sku_id"])
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
        sku = await sku_service.get_sku_by_sku_id(batch.get("sku_id"))
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
    
    # Get branch_id for FG inventory (matches inventory_routes query structure)
    branch_doc = await db.branches.find_one({"name": batch["branch"]}, {"_id": 0, "branch_id": 1})
    branch_id = branch_doc.get("branch_id") if branch_doc else None
    
    # Update FG inventory (branch_sku_inventory is the single source of truth)
    fg_existing = await db.branch_sku_inventory.find_one(
        {"buyer_sku_id": batch["sku_id"], "branch": batch["branch"]}
    )
    
    if fg_existing:
        await db.branch_sku_inventory.update_one(
            {"buyer_sku_id": batch["sku_id"], "branch": batch["branch"]},
            {"$inc": {"current_stock": produced_quantity}}
        )
    else:
        await db.branch_sku_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "buyer_sku_id": batch["sku_id"],
            "branch": batch["branch"],
            "current_stock": produced_quantity,
            "is_active": True,
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
    
    # Publish BATCH_COMPLETED event
    from services.event_system import event_bus, EventType
    await event_bus.publish(
        EventType.BATCH_COMPLETED,
        {
            "batch_id": batch_id,
            "batch_code": batch.get("batch_code"),
            "sku_id": batch["sku_id"],
            "produced_quantity": produced_quantity,
            "branch": batch["branch"],
            "completed_by": current_user.id
        },
        source_module="production"
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



# ============ Production Planning (Forward Plans) ============

from pydantic import BaseModel

class SingleProductionPlanCreate(BaseModel):
    sku_id: str
    branch: str
    date: datetime
    planned_quantity: float


@router.get("/production-plans/months")
async def get_available_plan_months(branch: str):
    """Get list of months with production plans"""
    plans = await db.production_plans.find({"branch": branch}, {"_id": 0, "plan_month": 1}).to_list(1000)
    months = list(set(p.get('plan_month') for p in plans if p.get('plan_month')))
    months.sort(reverse=True)
    return {"months": months}


@router.get("/production-plans")
async def get_production_plans_filtered(
    branch: Optional[str] = None,
    plan_month: Optional[str] = None
):
    """Get production plans for a branch"""
    query = {}
    if branch:
        query["branch"] = branch
    if plan_month:
        query["plan_month"] = plan_month
    
    plans = await db.production_plans.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    return [serialize_doc(p) for p in plans]


@router.post("/production-plans")
async def create_single_production_plan(plan: SingleProductionPlanCreate):
    """Create a single production plan entry"""
    # Validate SKU exists
    sku = await sku_service.get_sku_by_sku_id(plan.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU {plan.sku_id} not found")
    
    # Derive plan_month from date
    plan_month = plan.date.strftime("%Y-%m")
    
    # Check if entry exists
    existing = await db.production_plans.find_one({
        "sku_id": plan.sku_id,
        "branch": plan.branch,
        "date": plan.date.isoformat()
    })
    
    if existing:
        await db.production_plans.update_one(
            {"_id": existing["_id"]},
            {"$set": {"planned_quantity": plan.planned_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Production plan updated", "sku_id": plan.sku_id}
    
    plan_doc = {
        "id": str(uuid.uuid4()),
        "branch": plan.branch,
        "plan_month": plan_month,
        "date": plan.date.isoformat(),
        "sku_id": plan.sku_id,
        "planned_quantity": plan.planned_quantity,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.production_plans.insert_one(plan_doc)
    return {"message": "Production plan created", "sku_id": plan.sku_id}


@router.delete("/production-plans/{plan_month}")
async def delete_production_plan_month(plan_month: str, branch: str):
    """Delete production plan for a specific month"""
    result = await db.production_plans.delete_many({"branch": branch, "plan_month": plan_month})
    return {"message": f"Deleted {result.deleted_count} plan entries"}


@router.delete("/production-plans/entry/{plan_id}")
async def delete_single_plan_entry(plan_id: str):
    """Delete a single production plan entry"""
    result = await db.production_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan entry not found")
    return {"message": "Plan entry deleted"}


@router.post("/production-plans/bulk-upload")
async def bulk_upload_production_plan(
    file: UploadFile = File(...),
    branch: Optional[str] = None
):
    """
    Upload production plan from Excel.
    Format: Date, SKU_ID, Planned_Quantity, Branch, Forecast_ID (optional)
    Validates that total planned qty per forecast doesn't exceed forecast qty.
    """
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        # Get headers
        headers = [str(cell.value).strip().lower() if cell.value else "" for cell in sheet[1]]
        has_branch_col = 'branch' in headers
        has_forecast_col = 'forecast_id' in headers or 'forecast id' in headers
        
        branch_col_idx = headers.index('branch') if has_branch_col else -1
        forecast_col_idx = -1
        if 'forecast_id' in headers:
            forecast_col_idx = headers.index('forecast_id')
        elif 'forecast id' in headers:
            forecast_col_idx = headers.index('forecast id')
        
        # Track planned quantities by forecast_id for validation
        forecast_planned_qty = {}
        
        created_count = 0
        updated_count = 0
        errors = []
        rows_to_process = []
        
        # First pass: collect and validate all rows
        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0] or not row[1]:
                continue
            
            try:
                # Parse date
                date_val = row[0]
                if isinstance(date_val, str):
                    date_obj = datetime.strptime(date_val, "%Y-%m-%d")
                else:
                    date_obj = datetime.combine(date_val, datetime.min.time())
                
                sku_id = str(row[1]).strip()
                planned_qty = float(row[2]) if row[2] else 0
                
                # Get branch
                row_branch = None
                if has_branch_col and branch_col_idx < len(row) and row[branch_col_idx]:
                    row_branch = str(row[branch_col_idx]).strip()
                else:
                    row_branch = branch
                
                # Get forecast_id
                forecast_id = None
                if has_forecast_col and forecast_col_idx >= 0 and forecast_col_idx < len(row) and row[forecast_col_idx]:
                    forecast_id = str(row[forecast_col_idx]).strip()
                
                if not row_branch:
                    errors.append(f"Row {idx}: No branch specified")
                    continue
                
                if planned_qty <= 0:
                    errors.append(f"Row {idx}: Invalid quantity")
                    continue
                
                # Track for forecast validation
                if forecast_id:
                    if forecast_id not in forecast_planned_qty:
                        forecast_planned_qty[forecast_id] = 0
                    forecast_planned_qty[forecast_id] += planned_qty
                
                rows_to_process.append({
                    "row_idx": idx,
                    "date_obj": date_obj,
                    "sku_id": sku_id,
                    "planned_qty": planned_qty,
                    "branch": row_branch,
                    "forecast_id": forecast_id
                })
                
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
        
        # Validate forecast quantities
        for forecast_id, total_planned in forecast_planned_qty.items():
            # Get existing planned qty for this forecast
            existing_plans = await db.production_plans.find(
                {"forecast_id": forecast_id},
                {"_id": 0, "planned_quantity": 1}
            ).to_list(1000)
            existing_total = sum(p.get("planned_quantity", 0) for p in existing_plans)
            
            # Get forecast qty
            forecast = await db.forecasts.find_one({"id": forecast_id}, {"_id": 0})
            if not forecast:
                # Try by forecast_code
                forecast = await db.forecasts.find_one({"forecast_code": forecast_id}, {"_id": 0})
            
            if forecast:
                forecast_qty = forecast.get("quantity", 0)
                if existing_total + total_planned > forecast_qty:
                    errors.append(f"Forecast {forecast_id}: Total planned ({existing_total + total_planned}) exceeds forecast qty ({forecast_qty})")
        
        if errors:
            return {
                "created": 0,
                "updated": 0,
                "errors": errors,
                "message": "Validation failed. No records created."
            }
        
        # Process valid rows
        for row_data in rows_to_process:
            try:
                sku = await sku_service.get_sku_by_sku_id(row_data["sku_id"])
                if not sku:
                    errors.append(f"Row {row_data['row_idx']}: SKU {row_data['sku_id']} not found")
                    continue
                
                plan_month = row_data["date_obj"].strftime("%Y-%m")
                
                # Check if entry exists
                existing = await db.production_plans.find_one({
                    "branch": row_data["branch"],
                    "date": row_data["date_obj"].isoformat(),
                    "sku_id": row_data["sku_id"]
                })
                
                if existing:
                    await db.production_plans.update_one(
                        {"branch": row_data["branch"], "date": row_data["date_obj"].isoformat(), "sku_id": row_data["sku_id"]},
                        {"$set": {
                            "planned_quantity": row_data["planned_qty"],
                            "plan_month": plan_month,
                            "forecast_id": row_data["forecast_id"]
                        }}
                    )
                    updated_count += 1
                else:
                    plan_doc = {
                        "id": str(uuid.uuid4()),
                        "branch": row_data["branch"],
                        "plan_month": plan_month,
                        "date": row_data["date_obj"].isoformat(),
                        "sku_id": row_data["sku_id"],
                        "planned_quantity": row_data["planned_qty"],
                        "forecast_id": row_data["forecast_id"],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.production_plans.insert_one(plan_doc)
                    created_count += 1
                
                # Update forecast planned_quantity
                if row_data["forecast_id"]:
                    await db.forecasts.update_one(
                        {"$or": [{"id": row_data["forecast_id"]}, {"forecast_code": row_data["forecast_id"]}]},
                        {"$inc": {"planned_quantity": row_data["planned_qty"]}}
                    )
                    
            except Exception as e:
                errors.append(f"Row {row_data['row_idx']}: {str(e)}")
        
        return {
            "created": created_count,
            "updated": updated_count,
            "errors": errors,
            "message": f"Processed {created_count + updated_count} entries"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/production-plans/shortage-analysis")
async def get_shortage_analysis(branch: str, plan_month: str):
    """Calculate RM shortages based on production plan"""
    plans = await db.production_plans.find(
        {"branch": branch, "plan_month": plan_month},
        {"_id": 0}
    ).to_list(1000)
    
    if not plans:
        raise HTTPException(status_code=404, detail="No production plan found for this month")
    
    rm_requirements = {}
    sku_details = {}
    
    for plan in plans:
        sku_id = plan['sku_id']
        planned_qty = plan['planned_quantity']
        
        if sku_id not in sku_details:
            sku = await sku_service.get_sku_by_sku_id(sku_id)
            if sku:
                sku_details[sku_id] = {"name": sku.get('description', sku_id), "total_planned": 0}
        
        if sku_id in sku_details:
            sku_details[sku_id]["total_planned"] += planned_qty
        
        # Get BOM mapping
        rm_mappings = await db.sku_rm_mapping.find({"sku_id": sku_id}, {"_id": 0}).to_list(1000)
        if rm_mappings:
            for rm_mapping in rm_mappings:
                rm_id = rm_mapping['rm_id']
                qty_per_unit = rm_mapping.get('quantity', 0)
                total_required = qty_per_unit * planned_qty
                rm_requirements[rm_id] = rm_requirements.get(rm_id, 0) + total_required
        else:
            mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
            if mapping and mapping.get('rm_mappings'):
                for rm_mapping in mapping['rm_mappings']:
                    rm_id = rm_mapping['rm_id']
                    qty_per_unit = rm_mapping.get('quantity_required', rm_mapping.get('quantity', 0))
                    total_required = qty_per_unit * planned_qty
                    rm_requirements[rm_id] = rm_requirements.get(rm_id, 0) + total_required
    
    shortage_report = []
    sufficient_stock = []
    
    for rm_id, total_required in rm_requirements.items():
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        if not rm:
            continue
        
        rm_inv = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_id, "branch": branch, "is_active": True},
            {"_id": 0}
        )
        
        current_stock = rm_inv['current_stock'] if rm_inv else 0
        shortage = total_required - current_stock
        
        rm_info = {
            "rm_id": rm_id,
            "category": rm.get('category', ''),
            "total_required": round(total_required, 2),
            "current_stock": round(current_stock, 2),
            "shortage": round(shortage, 2) if shortage > 0 else 0
        }
        
        if shortage > 0:
            shortage_report.append(rm_info)
        else:
            sufficient_stock.append(rm_info)
    
    return {
        "plan_summary": {
            "branch": branch,
            "plan_month": plan_month,
            "total_skus": len(sku_details),
            "total_units_planned": int(sum(s['total_planned'] for s in sku_details.values())),
            "total_rm_types": len(rm_requirements),
            "rm_with_shortage": len(shortage_report),
            "plan_entries": len(plans)
        },
        "sku_details": sku_details,
        "shortage_report": sorted(shortage_report, key=lambda x: x['shortage'], reverse=True),
        "sufficient_stock": sufficient_stock
    }
