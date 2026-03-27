"""
MRP (Material Requisition Planning) Routes

API endpoints for:
- Model-level forecasts management
- RM procurement parameters
- MRP run calculation and management
- Draft PO generation and approval
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
import uuid
import logging

from database import db
from services.auth_service import get_current_user
from models.auth import User
from models.mrp_models import (
    ModelLevelForecastCreate,
    ModelLevelForecastUpdate,
    RMProcurementParametersCreate,
    RMProcurementParametersUpdate,
)
from services.mrp_service import mrp_service

router = APIRouter(prefix="/mrp", tags=["MRP"])
logger = logging.getLogger(__name__)


def serialize_doc(doc):
    """Remove MongoDB _id and convert dates"""
    if doc and "_id" in doc:
        del doc["_id"]
    return doc


# ============ Dashboard ============

@router.get("/dashboard")
async def get_mrp_dashboard(current_user: User = Depends(get_current_user)):
    """Get MRP dashboard statistics"""
    # Count MRP runs
    total_runs = await db.mrp_runs.count_documents({})
    pending_approval = await db.mrp_runs.count_documents({"status": "CALCULATED"})
    
    # Count Draft POs
    total_draft_pos = await db.mrp_draft_pos.count_documents({})
    pending_po_approval = await db.mrp_draft_pos.count_documents({"status": "DRAFT"})
    
    # Get last run
    last_run = await db.mrp_runs.find_one(
        {}, {"_id": 0, "run_date": 1},
        sort=[("created_at", -1)]
    )
    
    # Count RMs with shortage (net_requirement > 0)
    total_rm_shortage = 0
    total_order_value_pending = 0
    
    latest_run = await db.mrp_runs.find_one(
        {"status": {"$in": ["CALCULATED", "APPROVED"]}},
        {"_id": 0, "rm_requirements": 1, "total_order_value": 1},
        sort=[("created_at", -1)]
    )
    
    if latest_run:
        rm_reqs = latest_run.get("rm_requirements", [])
        total_rm_shortage = sum(1 for r in rm_reqs if r.get("net_requirement", 0) > 0)
        total_order_value_pending = latest_run.get("total_order_value", 0)
    
    # Get model forecast counts
    total_model_forecasts = await db.model_level_forecasts.count_documents({})
    
    # Get RM params count
    total_rm_params = await db.rm_procurement_parameters.count_documents({})
    
    return {
        "total_runs": total_runs,
        "pending_approval": pending_approval,
        "total_draft_pos": total_draft_pos,
        "pending_po_approval": pending_po_approval,
        "last_run_date": last_run.get("run_date") if last_run else None,
        "total_rm_shortage": total_rm_shortage,
        "total_order_value_pending": total_order_value_pending,
        "total_model_forecasts": total_model_forecasts,
        "total_rm_params": total_rm_params
    }


# ============ Model Level Forecasts ============

@router.get("/model-forecasts")
async def get_model_forecasts(
    model_id: Optional[str] = None,
    vertical_id: Optional[str] = None,
    month_year: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get model-level forecasts with optional filters"""
    query = {}
    if model_id:
        query["model_id"] = model_id
    if vertical_id:
        query["vertical_id"] = vertical_id
    if month_year:
        query["month_year"] = month_year
    
    forecasts = await db.model_level_forecasts.find(
        query, {"_id": 0}
    ).sort("month_year", 1).to_list(10000)
    
    return forecasts


@router.post("/model-forecasts")
async def create_model_forecast(
    data: ModelLevelForecastCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or update a model-level forecast"""
    # Get model info
    model = await db.models.find_one({"id": data.model_id}, {"_id": 0})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Get vertical info
    vertical = await db.verticals.find_one({"id": model.get("vertical_id")}, {"_id": 0})
    
    # Check for existing forecast
    existing = await db.model_level_forecasts.find_one({
        "model_id": data.model_id,
        "month_year": data.month_year
    })
    
    if existing:
        # Update existing
        await db.model_level_forecasts.update_one(
            {"id": existing["id"]},
            {"$set": {
                "forecast_qty": data.forecast_qty,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.id
            }}
        )
        return {"message": "Forecast updated", "id": existing["id"]}
    
    # Create new
    forecast = {
        "id": str(uuid.uuid4()),
        "model_id": data.model_id,
        "model_code": model.get("code", ""),
        "model_name": model.get("name", ""),
        "vertical_id": model.get("vertical_id", ""),
        "vertical_code": vertical.get("code", "") if vertical else "",
        "month_year": data.month_year,
        "forecast_qty": data.forecast_qty,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    await db.model_level_forecasts.insert_one(forecast)
    return {"message": "Forecast created", "id": forecast["id"]}


@router.post("/model-forecasts/bulk")
async def bulk_create_model_forecasts(
    forecasts: List[dict] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Bulk create/update model-level forecasts"""
    created = 0
    updated = 0
    errors = []
    
    for f in forecasts:
        try:
            model_id = f.get("model_id")
            month_year = f.get("month_year")
            forecast_qty = f.get("forecast_qty", 0)
            
            if not model_id or not month_year:
                errors.append({"data": f, "error": "Missing model_id or month_year"})
                continue
            
            # Get model info
            model = await db.models.find_one({"id": model_id}, {"_id": 0})
            if not model:
                # Try by code
                model = await db.models.find_one({"code": model_id}, {"_id": 0})
            
            if not model:
                errors.append({"data": f, "error": f"Model not found: {model_id}"})
                continue
            
            actual_model_id = model.get("id")
            
            # Check existing
            existing = await db.model_level_forecasts.find_one({
                "model_id": actual_model_id,
                "month_year": month_year
            })
            
            if existing:
                await db.model_level_forecasts.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "forecast_qty": forecast_qty,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": current_user.id
                    }}
                )
                updated += 1
            else:
                vertical = await db.verticals.find_one(
                    {"id": model.get("vertical_id")}, {"_id": 0}
                )
                
                forecast = {
                    "id": str(uuid.uuid4()),
                    "model_id": actual_model_id,
                    "model_code": model.get("code", ""),
                    "model_name": model.get("name", ""),
                    "vertical_id": model.get("vertical_id", ""),
                    "vertical_code": vertical.get("code", "") if vertical else "",
                    "month_year": month_year,
                    "forecast_qty": forecast_qty,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user.id
                }
                await db.model_level_forecasts.insert_one(forecast)
                created += 1
                
        except Exception as e:
            errors.append({"data": f, "error": str(e)})
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors
    }


@router.delete("/model-forecasts/{forecast_id}")
async def delete_model_forecast(
    forecast_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a model-level forecast"""
    result = await db.model_level_forecasts.delete_one({"id": forecast_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Forecast not found")
    return {"message": "Forecast deleted"}


# ============ RM Procurement Parameters ============

@router.get("/rm-params")
async def get_rm_procurement_params(
    rm_id: Optional[str] = None,
    category: Optional[str] = None,
    has_vendor: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Get RM procurement parameters"""
    query = {}
    if rm_id:
        query["rm_id"] = rm_id
    if category:
        query["category"] = category
    if has_vendor is not None:
        if has_vendor:
            query["preferred_vendor_id"] = {"$ne": None}
        else:
            query["preferred_vendor_id"] = None
    
    params = await db.rm_procurement_parameters.find(
        query, {"_id": 0}
    ).to_list(10000)
    
    return params


@router.post("/rm-params")
async def create_rm_procurement_params(
    data: RMProcurementParametersCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or update RM procurement parameters"""
    # Get RM info
    rm = await db.raw_materials.find_one({"rm_id": data.rm_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail="RM not found")
    
    # Get vendor info if provided
    vendor_name = None
    if data.preferred_vendor_id:
        vendor = await db.vendors.find_one(
            {"$or": [{"id": data.preferred_vendor_id}, {"vendor_id": data.preferred_vendor_id}]},
            {"_id": 0, "name": 1}
        )
        vendor_name = vendor.get("name") if vendor else None
    
    # Check existing
    existing = await db.rm_procurement_parameters.find_one({"rm_id": data.rm_id})
    
    if existing:
        # Update
        update_data = {
            "safety_stock": data.safety_stock,
            "reorder_point": data.reorder_point,
            "moq": data.moq,
            "batch_size": data.batch_size,
            "lead_time_days": data.lead_time_days,
            "preferred_vendor_id": data.preferred_vendor_id,
            "preferred_vendor_name": vendor_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.rm_procurement_parameters.update_one(
            {"rm_id": data.rm_id},
            {"$set": update_data}
        )
        return {"message": "Parameters updated", "rm_id": data.rm_id}
    
    # Create new
    params = {
        "id": str(uuid.uuid4()),
        "rm_id": data.rm_id,
        "rm_name": rm.get("name", data.rm_id),
        "category": rm.get("category", ""),
        "safety_stock": data.safety_stock,
        "reorder_point": data.reorder_point,
        "moq": data.moq,
        "batch_size": data.batch_size,
        "lead_time_days": data.lead_time_days,
        "preferred_vendor_id": data.preferred_vendor_id,
        "preferred_vendor_name": vendor_name,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rm_procurement_parameters.insert_one(params)
    return {"message": "Parameters created", "rm_id": data.rm_id}


@router.put("/rm-params/{rm_id}")
async def update_rm_procurement_params(
    rm_id: str,
    data: RMProcurementParametersUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update RM procurement parameters"""
    existing = await db.rm_procurement_parameters.find_one({"rm_id": rm_id})
    if not existing:
        raise HTTPException(status_code=404, detail="RM parameters not found")
    
    update_data = {}
    if data.safety_stock is not None:
        update_data["safety_stock"] = data.safety_stock
    if data.reorder_point is not None:
        update_data["reorder_point"] = data.reorder_point
    if data.moq is not None:
        update_data["moq"] = data.moq
    if data.batch_size is not None:
        update_data["batch_size"] = data.batch_size
    if data.lead_time_days is not None:
        update_data["lead_time_days"] = data.lead_time_days
    if data.preferred_vendor_id is not None:
        update_data["preferred_vendor_id"] = data.preferred_vendor_id
        # Get vendor name
        vendor = await db.vendors.find_one(
            {"$or": [{"id": data.preferred_vendor_id}, {"vendor_id": data.preferred_vendor_id}]},
            {"_id": 0, "name": 1}
        )
        update_data["preferred_vendor_name"] = vendor.get("name") if vendor else None
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.rm_procurement_parameters.update_one(
            {"rm_id": rm_id},
            {"$set": update_data}
        )
    
    return {"message": "Parameters updated", "rm_id": rm_id}


@router.post("/rm-params/bulk")
async def bulk_create_rm_params(
    params_list: List[dict] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Bulk create/update RM procurement parameters"""
    created = 0
    updated = 0
    errors = []
    
    for p in params_list:
        try:
            rm_id = p.get("rm_id")
            if not rm_id:
                errors.append({"data": p, "error": "Missing rm_id"})
                continue
            
            # Check RM exists
            rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
            if not rm:
                errors.append({"data": p, "error": f"RM not found: {rm_id}"})
                continue
            
            existing = await db.rm_procurement_parameters.find_one({"rm_id": rm_id})
            
            vendor_name = None
            if p.get("preferred_vendor_id"):
                vendor = await db.vendors.find_one(
                    {"$or": [{"id": p["preferred_vendor_id"]}, {"vendor_id": p["preferred_vendor_id"]}]},
                    {"_id": 0, "name": 1}
                )
                vendor_name = vendor.get("name") if vendor else None
            
            if existing:
                update_data = {
                    "safety_stock": p.get("safety_stock", existing.get("safety_stock", 0)),
                    "moq": p.get("moq", existing.get("moq", 1)),
                    "batch_size": p.get("batch_size", existing.get("batch_size", 1)),
                    "lead_time_days": p.get("lead_time_days", existing.get("lead_time_days", 7)),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                if p.get("preferred_vendor_id"):
                    update_data["preferred_vendor_id"] = p["preferred_vendor_id"]
                    update_data["preferred_vendor_name"] = vendor_name
                
                await db.rm_procurement_parameters.update_one(
                    {"rm_id": rm_id},
                    {"$set": update_data}
                )
                updated += 1
            else:
                params = {
                    "id": str(uuid.uuid4()),
                    "rm_id": rm_id,
                    "rm_name": rm.get("name", rm_id),
                    "category": rm.get("category", ""),
                    "safety_stock": p.get("safety_stock", 0),
                    "reorder_point": p.get("reorder_point", 0),
                    "moq": p.get("moq", 1),
                    "batch_size": p.get("batch_size", 1),
                    "lead_time_days": p.get("lead_time_days", 7),
                    "preferred_vendor_id": p.get("preferred_vendor_id"),
                    "preferred_vendor_name": vendor_name,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.rm_procurement_parameters.insert_one(params)
                created += 1
                
        except Exception as e:
            errors.append({"data": p, "error": str(e)})
    
    return {"created": created, "updated": updated, "errors": errors}


# ============ MRP Runs ============

@router.get("/runs")
async def get_mrp_runs(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get MRP runs list"""
    query = {}
    if status:
        query["status"] = status
    
    runs = await db.mrp_runs.find(
        query,
        {
            "_id": 0,
            "id": 1,
            "run_code": 1,
            "run_date": 1,
            "status": 1,
            "planning_horizon_months": 1,
            "total_skus": 1,
            "total_rms": 1,
            "total_order_value": 1,
            "created_at": 1,
            "created_by": 1
        }
    ).sort("created_at", -1).to_list(limit)
    
    return runs


@router.get("/runs/{run_id}")
async def get_mrp_run_detail(
    run_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed MRP run data"""
    run = await db.mrp_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="MRP run not found")
    return run


@router.post("/runs/calculate")
async def calculate_mrp(
    planning_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Run MRP calculation.
    
    This calculates:
    - Month 1: From production_plans
    - Months 2-12: From model_level_forecasts split by rolling ratios
    - BOM Explosion: SKU -> RM requirements
    - Net requirements with safety stock
    - Order quantities with MOQ/batch size
    - Vendor assignment
    """
    try:
        if planning_date:
            plan_dt = datetime.fromisoformat(planning_date.replace("Z", "+00:00"))
        else:
            plan_dt = None
        
        result = await mrp_service.calculate_mrp(current_user.id, plan_dt)
        
        return {
            "message": "MRP calculation completed",
            "run_id": result["id"],
            "run_code": result["run_code"],
            "total_skus": result["total_skus"],
            "total_rms": result["total_rms"],
            "total_order_value": result["total_order_value"]
        }
        
    except Exception as e:
        logger.error(f"MRP calculation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/approve")
async def approve_mrp_run(
    run_id: str,
    current_user: User = Depends(get_current_user)
):
    """Approve an MRP run"""
    result = await db.mrp_runs.update_one(
        {"id": run_id, "status": "CALCULATED"},
        {"$set": {
            "status": "APPROVED",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.id
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=400, 
            detail="Run not found or not in CALCULATED status"
        )
    
    return {"message": "MRP run approved", "run_id": run_id}


@router.post("/runs/{run_id}/generate-pos")
async def generate_draft_pos(
    run_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate Draft POs from an MRP run"""
    try:
        draft_pos = await mrp_service.generate_draft_pos(run_id, current_user.id)
        
        return {
            "message": f"Generated {len(draft_pos)} draft POs",
            "draft_pos": [
                {
                    "id": po["id"],
                    "draft_po_code": po["draft_po_code"],
                    "vendor_name": po["vendor_name"],
                    "total_items": po["total_items"],
                    "total_amount": po["total_amount"]
                }
                for po in draft_pos
            ]
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Draft PO generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Draft POs ============

@router.get("/draft-pos")
async def get_draft_pos(
    mrp_run_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get Draft POs"""
    query = {}
    if mrp_run_id:
        query["mrp_run_id"] = mrp_run_id
    if vendor_id:
        query["vendor_id"] = vendor_id
    if status:
        query["status"] = status
    
    draft_pos = await db.mrp_draft_pos.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return draft_pos


@router.get("/draft-pos/{draft_po_id}")
async def get_draft_po_detail(
    draft_po_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get Draft PO details"""
    draft_po = await db.mrp_draft_pos.find_one({"id": draft_po_id}, {"_id": 0})
    if not draft_po:
        raise HTTPException(status_code=404, detail="Draft PO not found")
    return draft_po


@router.put("/draft-pos/{draft_po_id}/vendor")
async def update_draft_po_vendor(
    draft_po_id: str,
    vendor_id: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user)
):
    """Update vendor assignment for a draft PO"""
    # Get vendor info
    vendor = await db.vendors.find_one(
        {"$or": [{"id": vendor_id}, {"vendor_id": vendor_id}]},
        {"_id": 0, "name": 1}
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    result = await db.mrp_draft_pos.update_one(
        {"id": draft_po_id, "status": "DRAFT"},
        {"$set": {
            "vendor_id": vendor_id,
            "vendor_name": vendor.get("name", "")
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Draft PO not found or not in DRAFT status"
        )
    
    return {"message": "Vendor updated"}


@router.post("/draft-pos/{draft_po_id}/approve")
async def approve_draft_po(
    draft_po_id: str,
    current_user: User = Depends(get_current_user)
):
    """Approve a draft PO"""
    result = await db.mrp_draft_pos.update_one(
        {"id": draft_po_id, "status": "DRAFT"},
        {"$set": {
            "status": "APPROVED",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.id
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Draft PO not found or not in DRAFT status"
        )
    
    return {"message": "Draft PO approved"}


@router.post("/draft-pos/{draft_po_id}/convert-to-po")
async def convert_draft_to_po(
    draft_po_id: str,
    current_user: User = Depends(get_current_user)
):
    """Convert an approved draft PO to an actual PO"""
    draft_po = await db.mrp_draft_pos.find_one({"id": draft_po_id}, {"_id": 0})
    if not draft_po:
        raise HTTPException(status_code=404, detail="Draft PO not found")
    
    if draft_po.get("status") != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="Draft PO must be APPROVED before conversion"
        )
    
    if not draft_po.get("vendor_id"):
        raise HTTPException(
            status_code=400,
            detail="Cannot convert: No vendor assigned"
        )
    
    # Generate PO number
    po_count = await db.purchase_orders.count_documents({})
    po_number = f"PO-{datetime.now(timezone.utc).strftime('%Y%m')}-{po_count + 1:04d}"
    
    # Create PO
    po = {
        "id": str(uuid.uuid4()),
        "po_number": po_number,
        "vendor_id": draft_po["vendor_id"],
        "branch_id": "",  # Can be set later
        "branch": "",
        "production_plan_id": None,
        "order_date": datetime.now(timezone.utc).isoformat(),
        "expected_delivery_date": draft_po.get("expected_delivery_date"),
        "total_amount": draft_po["total_amount"],
        "currency": draft_po["currency"],
        "status": "DRAFT",
        "payment_status": "PENDING",
        "notes": f"Generated from MRP - {draft_po['mrp_run_code']}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
        "source_draft_po_id": draft_po_id
    }
    
    await db.purchase_orders.insert_one(po)
    
    # Create PO lines
    for line in draft_po.get("lines", []):
        po_line = {
            "id": str(uuid.uuid4()),
            "po_id": po["id"],
            "rm_id": line["rm_id"],
            "quantity_ordered": line["quantity"],
            "quantity_received": 0,
            "unit_price": line["unit_price"],
            "unit_of_measure": "nos",
            "line_total": line["line_total"],
            "status": "PENDING"
        }
        await db.purchase_order_lines.insert_one(po_line)
    
    # Update draft PO
    await db.mrp_draft_pos.update_one(
        {"id": draft_po_id},
        {"$set": {
            "status": "SENT",
            "converted_po_id": po["id"],
            "converted_po_number": po_number
        }}
    )
    
    return {
        "message": "PO created successfully",
        "po_id": po["id"],
        "po_number": po_number
    }


# ============ Seed Data ============

@router.post("/seed-data")
async def seed_mrp_test_data(
    current_user: User = Depends(get_current_user)
):
    """
    Seed test data for MRP module:
    - Model-level forecasts for next 11 months
    - RM procurement parameters with default values
    """
    if current_user.role != "master_admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    created_forecasts = 0
    created_params = 0
    
    # Get all active models
    models = await db.models.find(
        {"status": "ACTIVE"},
        {"_id": 0, "id": 1, "code": 1, "name": 1, "vertical_id": 1}
    ).to_list(1000)
    
    # Generate forecasts for months 2-12 (starting from next month)
    base_date = datetime.now(timezone.utc).replace(day=1) + relativedelta(months=1)
    
    for model in models:
        vertical = await db.verticals.find_one(
            {"id": model.get("vertical_id")},
            {"_id": 0, "code": 1}
        )
        vertical_code = vertical.get("code", "") if vertical else ""
        
        for month_offset in range(11):  # 11 months
            month_date = base_date + relativedelta(months=month_offset)
            month_year = month_date.strftime("%Y-%m")
            
            # Check if exists
            existing = await db.model_level_forecasts.find_one({
                "model_id": model["id"],
                "month_year": month_year
            })
            
            if not existing:
                # Generate random forecast qty (100-1000)
                import random
                forecast_qty = random.randint(100, 1000)
                
                forecast = {
                    "id": str(uuid.uuid4()),
                    "model_id": model["id"],
                    "model_code": model.get("code", ""),
                    "model_name": model.get("name", ""),
                    "vertical_id": model.get("vertical_id", ""),
                    "vertical_code": vertical_code,
                    "month_year": month_year,
                    "forecast_qty": forecast_qty,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user.id
                }
                await db.model_level_forecasts.insert_one(forecast)
                created_forecasts += 1
    
    # Create RM procurement parameters for RMs without params
    # Get RMs that are in BOMs
    boms = await db.common_bom.find({}, {"_id": 0, "items": 1}).to_list(10000)
    rm_ids_in_bom = set()
    for bom in boms:
        for item in bom.get("items", []):
            if item.get("rm_id"):
                rm_ids_in_bom.add(item["rm_id"])
    
    for rm_id in rm_ids_in_bom:
        existing = await db.rm_procurement_parameters.find_one({"rm_id": rm_id})
        if not existing:
            rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
            if rm:
                # Find lowest price vendor
                price_doc = await db.vendor_rm_prices.find_one(
                    {"rm_id": rm_id},
                    {"_id": 0, "vendor_id": 1, "price": 1},
                    sort=[("price", 1)]
                )
                
                vendor_id = None
                vendor_name = None
                if price_doc:
                    vendor_id = price_doc["vendor_id"]
                    vendor = await db.vendors.find_one(
                        {"$or": [{"id": vendor_id}, {"vendor_id": vendor_id}]},
                        {"_id": 0, "name": 1}
                    )
                    vendor_name = vendor.get("name") if vendor else None
                
                params = {
                    "id": str(uuid.uuid4()),
                    "rm_id": rm_id,
                    "rm_name": rm.get("name", rm_id),
                    "category": rm.get("category", ""),
                    "safety_stock": 10,
                    "reorder_point": 20,
                    "moq": 50,
                    "batch_size": 10,
                    "lead_time_days": 7,
                    "preferred_vendor_id": vendor_id,
                    "preferred_vendor_name": vendor_name,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.rm_procurement_parameters.insert_one(params)
                created_params += 1
    
    return {
        "message": "Seed data created",
        "model_forecasts_created": created_forecasts,
        "rm_params_created": created_params
    }
