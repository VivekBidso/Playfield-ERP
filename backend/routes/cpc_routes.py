"""CPC (Central Production Control) routes - Scheduling and Branch Allocation"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
import uuid
import io

from database import db, BRANCHES

router = APIRouter(tags=["CPC - Central Production Control"])

# Import openpyxl for Excel export
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
except ImportError:
    openpyxl = None

router = APIRouter(tags=["CPC - Central Production Control"])

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'plan_date' in doc and isinstance(doc['plan_date'], str):
        doc['plan_date'] = datetime.fromisoformat(doc['plan_date'])
    if doc and 'target_date' in doc and isinstance(doc['target_date'], str):
        doc['target_date'] = datetime.fromisoformat(doc['target_date'])
    return doc

# ===== Models =====
class BranchCapacityUpdate(BaseModel):
    capacity_units_per_day: int
    effective_from: Optional[datetime] = None

class ProductionScheduleCreate(BaseModel):
    dispatch_lot_id: Optional[str] = None
    sku_id: str
    target_quantity: int
    target_date: datetime
    priority: str = "MEDIUM"
    notes: str = ""

class BranchAllocationCreate(BaseModel):
    schedule_id: str
    branch: str
    allocated_quantity: int
    planned_date: datetime

class AutoAllocateRequest(BaseModel):
    schedule_id: str
    preferred_branches: Optional[List[str]] = None

# ===== Branch Capacity Management =====
@router.get("/branches/capacity")
async def get_branch_capacities():
    """Get all branch capacities"""
    branches = await db.branches.find({"is_active": True}, {"_id": 0}).to_list(100)
    result = []
    for b in branches:
        # Get current utilization for today
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        allocations = await db.branch_allocations.find({
            "branch": b["name"],
            "planned_date": {"$gte": today, "$lt": tomorrow},
            "status": {"$in": ["PENDING", "IN_PROGRESS"]}
        }).to_list(1000)
        
        allocated_today = sum(a.get("allocated_quantity", 0) for a in allocations)
        capacity = b.get("capacity_units_per_day", 0)
        
        result.append({
            "branch_id": b.get("id"),
            "branch": b["name"],
            "capacity_units_per_day": capacity,
            "allocated_today": allocated_today,
            "available_today": max(0, capacity - allocated_today),
            "utilization_percent": round((allocated_today / capacity * 100), 1) if capacity > 0 else 0
        })
    return result

@router.put("/branches/{branch_name}/capacity")
async def update_branch_capacity(branch_name: str, data: BranchCapacityUpdate):
    """Update branch production capacity"""
    result = await db.branches.update_one(
        {"name": branch_name},
        {"$set": {
            "capacity_units_per_day": data.capacity_units_per_day,
            "capacity_updated_at": datetime.now(timezone.utc)
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Log capacity change
    await db.capacity_history.insert_one({
        "id": str(uuid.uuid4()),
        "branch": branch_name,
        "capacity_units_per_day": data.capacity_units_per_day,
        "effective_from": data.effective_from or datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": f"Capacity updated to {data.capacity_units_per_day} units/day"}

@router.get("/branches/{branch_name}/capacity-forecast")
async def get_branch_capacity_forecast(branch_name: str, days: int = 7):
    """Get capacity utilization forecast for next N days"""
    branch = await db.branches.find_one({"name": branch_name}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    capacity = branch.get("capacity_units_per_day", 0)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    forecast = []
    for i in range(days):
        day_start = today + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        allocations = await db.branch_allocations.find({
            "branch": branch_name,
            "planned_date": {"$gte": day_start, "$lt": day_end},
            "status": {"$in": ["PENDING", "IN_PROGRESS"]}
        }).to_list(1000)
        
        allocated = sum(a.get("allocated_quantity", 0) for a in allocations)
        
        forecast.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "day": day_start.strftime("%A"),
            "capacity": capacity,
            "allocated": allocated,
            "available": max(0, capacity - allocated),
            "utilization_percent": round((allocated / capacity * 100), 1) if capacity > 0 else 0
        })
    
    return {
        "branch": branch_name,
        "capacity_units_per_day": capacity,
        "forecast": forecast
    }

# ===== Production Scheduling =====
@router.get("/production-schedules")
async def get_production_schedules(
    status: Optional[str] = None,
    sku_id: Optional[str] = None,
    priority: Optional[str] = None
):
    """Get all production schedules"""
    query = {}
    if status:
        query["status"] = status
    if sku_id:
        query["sku_id"] = sku_id
    if priority:
        query["priority"] = priority
    
    schedules = await db.production_schedules.find(query, {"_id": 0}).sort("target_date", 1).to_list(1000)
    
    # Enrich with allocation info
    for schedule in schedules:
        allocations = await db.branch_allocations.find(
            {"schedule_id": schedule["id"]},
            {"_id": 0}
        ).to_list(100)
        schedule["allocations"] = allocations
        schedule["total_allocated"] = sum(a.get("allocated_quantity", 0) for a in allocations)
        schedule["total_completed"] = sum(a.get("completed_quantity", 0) for a in allocations)
    
    return [serialize_doc(s) for s in schedules]

@router.post("/production-schedules")
async def create_production_schedule(data: ProductionScheduleCreate):
    """Create a new production schedule from demand"""
    count = await db.production_schedules.count_documents({})
    schedule_code = f"PS_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    # Verify SKU exists
    sku = await db.skus.find_one({"sku_id": data.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    schedule = {
        "id": str(uuid.uuid4()),
        "schedule_code": schedule_code,
        "dispatch_lot_id": data.dispatch_lot_id,
        "sku_id": data.sku_id,
        "sku_description": sku.get("description", ""),
        "target_quantity": data.target_quantity,
        "allocated_quantity": 0,
        "completed_quantity": 0,
        "target_date": data.target_date,
        "priority": data.priority,
        "status": "DRAFT",  # DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.production_schedules.insert_one(schedule)
    del schedule["_id"]
    
    # Update dispatch lot if linked
    if data.dispatch_lot_id:
        await db.dispatch_lots.update_one(
            {"id": data.dispatch_lot_id},
            {"$set": {"status": "PRODUCTION_ASSIGNED"}}
        )
    
    return serialize_doc(schedule)

@router.get("/production-schedules/{schedule_id}")
async def get_production_schedule(schedule_id: str):
    """Get schedule with all allocations and progress"""
    schedule = await db.production_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    allocations = await db.branch_allocations.find(
        {"schedule_id": schedule_id},
        {"_id": 0}
    ).to_list(100)
    
    schedule["allocations"] = [serialize_doc(a) for a in allocations]
    schedule["total_allocated"] = sum(a.get("allocated_quantity", 0) for a in allocations)
    schedule["total_completed"] = sum(a.get("completed_quantity", 0) for a in allocations)
    
    return serialize_doc(schedule)

# ===== Branch Allocation =====
@router.post("/branch-allocations")
async def create_branch_allocation(data: BranchAllocationCreate):
    """Manually allocate production to a branch"""
    # Verify schedule exists
    schedule = await db.production_schedules.find_one({"id": data.schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check branch capacity
    branch = await db.branches.find_one({"name": data.branch})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    capacity = branch.get("capacity_units_per_day", 0)
    
    # Check existing allocations for that day
    day_start = data.planned_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    existing = await db.branch_allocations.find({
        "branch": data.branch,
        "planned_date": {"$gte": day_start, "$lt": day_end},
        "status": {"$in": ["PENDING", "IN_PROGRESS"]}
    }).to_list(1000)
    
    allocated_today = sum(a.get("allocated_quantity", 0) for a in existing)
    available = capacity - allocated_today
    
    if data.allocated_quantity > available:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient capacity. Available: {available}, Requested: {data.allocated_quantity}"
        )
    
    allocation = {
        "id": str(uuid.uuid4()),
        "schedule_id": data.schedule_id,
        "sku_id": schedule["sku_id"],
        "branch": data.branch,
        "allocated_quantity": data.allocated_quantity,
        "completed_quantity": 0,
        "planned_date": data.planned_date,
        "status": "PENDING",  # PENDING, IN_PROGRESS, COMPLETED, CANCELLED
        "created_at": datetime.now(timezone.utc)
    }
    await db.branch_allocations.insert_one(allocation)
    
    # Update schedule totals
    await db.production_schedules.update_one(
        {"id": data.schedule_id},
        {
            "$inc": {"allocated_quantity": data.allocated_quantity},
            "$set": {"status": "SCHEDULED"}
        }
    )
    
    del allocation["_id"]
    return serialize_doc(allocation)

@router.post("/branch-allocations/auto-allocate")
async def auto_allocate_production(data: AutoAllocateRequest):
    """Automatically allocate production across branches based on capacity"""
    schedule = await db.production_schedules.find_one({"id": data.schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    remaining = schedule["target_quantity"] - schedule.get("allocated_quantity", 0)
    if remaining <= 0:
        return {"message": "Schedule already fully allocated", "allocations": []}
    
    # Get branches with capacity
    branches = await db.branches.find({"is_active": True}, {"_id": 0}).to_list(100)
    if data.preferred_branches:
        branches = [b for b in branches if b["name"] in data.preferred_branches]
    
    # Sort by available capacity (descending)
    target_date = schedule["target_date"]
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0) if isinstance(target_date, datetime) else datetime.fromisoformat(str(target_date))
    day_end = day_start + timedelta(days=1)
    
    branch_availability = []
    for b in branches:
        capacity = b.get("capacity_units_per_day", 0)
        if capacity == 0:
            continue
        
        existing = await db.branch_allocations.find({
            "branch": b["name"],
            "planned_date": {"$gte": day_start, "$lt": day_end},
            "status": {"$in": ["PENDING", "IN_PROGRESS"]}
        }).to_list(1000)
        
        allocated = sum(a.get("allocated_quantity", 0) for a in existing)
        available = capacity - allocated
        
        if available > 0:
            branch_availability.append({
                "branch": b["name"],
                "capacity": capacity,
                "available": available
            })
    
    # Sort by availability
    branch_availability.sort(key=lambda x: x["available"], reverse=True)
    
    allocations_created = []
    for ba in branch_availability:
        if remaining <= 0:
            break
        
        allocate_qty = min(remaining, ba["available"])
        
        allocation = {
            "id": str(uuid.uuid4()),
            "schedule_id": data.schedule_id,
            "sku_id": schedule["sku_id"],
            "branch": ba["branch"],
            "allocated_quantity": allocate_qty,
            "completed_quantity": 0,
            "planned_date": day_start,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc)
        }
        await db.branch_allocations.insert_one(allocation)
        
        remaining -= allocate_qty
        allocations_created.append({
            "branch": ba["branch"],
            "quantity": allocate_qty
        })
    
    # Update schedule
    total_allocated = schedule.get("allocated_quantity", 0) + sum(a["quantity"] for a in allocations_created)
    new_status = "SCHEDULED" if total_allocated >= schedule["target_quantity"] else "DRAFT"
    
    await db.production_schedules.update_one(
        {"id": data.schedule_id},
        {"$set": {"allocated_quantity": total_allocated, "status": new_status}}
    )
    
    return {
        "message": f"Allocated {sum(a['quantity'] for a in allocations_created)} units across {len(allocations_created)} branches",
        "remaining_unallocated": remaining,
        "allocations": allocations_created
    }

@router.put("/branch-allocations/{allocation_id}/start")
async def start_production(allocation_id: str):
    """Mark allocation as in progress"""
    result = await db.branch_allocations.update_one(
        {"id": allocation_id, "status": "PENDING"},
        {"$set": {"status": "IN_PROGRESS", "started_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Allocation not found or not in PENDING status")
    
    # Update schedule status
    allocation = await db.branch_allocations.find_one({"id": allocation_id})
    await db.production_schedules.update_one(
        {"id": allocation["schedule_id"]},
        {"$set": {"status": "IN_PROGRESS"}}
    )
    
    return {"message": "Production started"}

@router.put("/branch-allocations/{allocation_id}/complete")
async def complete_allocation(allocation_id: str, completed_quantity: int):
    """Mark allocation as completed with actual quantity"""
    allocation = await db.branch_allocations.find_one({"id": allocation_id})
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    
    await db.branch_allocations.update_one(
        {"id": allocation_id},
        {"$set": {
            "status": "COMPLETED",
            "completed_quantity": completed_quantity,
            "completed_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update schedule completed quantity
    await db.production_schedules.update_one(
        {"id": allocation["schedule_id"]},
        {"$inc": {"completed_quantity": completed_quantity}}
    )
    
    # Check if all allocations complete
    schedule = await db.production_schedules.find_one({"id": allocation["schedule_id"]})
    all_allocations = await db.branch_allocations.find({"schedule_id": allocation["schedule_id"]}).to_list(100)
    
    all_complete = all(a.get("status") == "COMPLETED" for a in all_allocations)
    if all_complete:
        await db.production_schedules.update_one(
            {"id": allocation["schedule_id"]},
            {"$set": {"status": "COMPLETED"}}
        )
    
    return {"message": f"Completed {completed_quantity} units"}

# ===== Dashboard & Reports =====
@router.get("/cpc/dashboard")
async def get_cpc_dashboard():
    """Get CPC overview dashboard"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Pending schedules
    pending_schedules = await db.production_schedules.count_documents({"status": {"$in": ["DRAFT", "SCHEDULED"]}})
    in_progress = await db.production_schedules.count_documents({"status": "IN_PROGRESS"})
    
    # Today's allocations
    todays_allocations = await db.branch_allocations.find({
        "planned_date": {"$gte": today, "$lt": tomorrow}
    }).to_list(1000)
    
    # Branch utilization
    branches = await db.branches.find({"is_active": True}, {"_id": 0}).to_list(100)
    branch_stats = []
    for b in branches:
        branch_allocs = [a for a in todays_allocations if a.get("branch") == b["name"]]
        allocated = sum(a.get("allocated_quantity", 0) for a in branch_allocs)
        completed = sum(a.get("completed_quantity", 0) for a in branch_allocs if a.get("status") == "COMPLETED")
        capacity = b.get("capacity_units_per_day", 0)
        
        branch_stats.append({
            "branch": b["name"],
            "capacity": capacity,
            "allocated": allocated,
            "completed": completed,
            "utilization": round((allocated / capacity * 100), 1) if capacity > 0 else 0
        })
    
    return {
        "pending_schedules": pending_schedules,
        "in_progress_schedules": in_progress,
        "todays_planned_quantity": sum(a.get("allocated_quantity", 0) for a in todays_allocations),
        "todays_completed_quantity": sum(a.get("completed_quantity", 0) for a in todays_allocations if a.get("status") == "COMPLETED"),
        "branch_utilization": branch_stats
    }

@router.get("/cpc/schedule-suggestions")
async def get_schedule_suggestions():
    """Get dispatch lots that need scheduling"""
    # Find dispatch lots without production schedules
    lots = await db.dispatch_lots.find({
        "status": {"$in": ["CREATED", "PRODUCTION_ASSIGNED"]},
        "required_quantity": {"$gt": 0}
    }, {"_id": 0}).sort("target_date", 1).to_list(100)
    
    suggestions = []
    for lot in lots:
        # Check if already scheduled
        existing_schedule = await db.production_schedules.find_one({"dispatch_lot_id": lot["id"]})
        if existing_schedule:
            continue
        
        # Get SKU info
        sku = await db.skus.find_one({"sku_id": lot["sku_id"]}, {"_id": 0})
        
        suggestions.append({
            "dispatch_lot_id": lot["id"],
            "lot_code": lot.get("lot_code"),
            "sku_id": lot["sku_id"],
            "sku_description": sku.get("description", "") if sku else "",
            "required_quantity": lot["required_quantity"],
            "target_date": lot.get("target_date"),
            "priority": lot.get("priority", "MEDIUM")
        })
    
    return suggestions



# ===== Demand Forecasts Visibility for CPC =====

@router.get("/cpc/demand-forecasts")
async def get_demand_forecasts_for_cpc(
    status: Optional[str] = None,
    buyer_id: Optional[str] = None,
    include_draft: bool = False
):
    """
    Get demand forecasts for CPC to view and schedule production.
    Shows forecasts with scheduled production qty (from production_schedules), dispatch lots linked.
    """
    if include_draft:
        query = {"status": {"$in": ["DRAFT", "CONFIRMED", "CONVERTED"]}}
    else:
        query = {"status": {"$in": ["CONFIRMED", "CONVERTED"]}}
    
    if status:
        query["status"] = status
    if buyer_id:
        query["buyer_id"] = buyer_id
    
    forecasts = await db.forecasts.find(query, {"_id": 0}).sort("forecast_month", 1).to_list(1000)
    
    # Get all production SCHEDULES to calculate scheduled quantities (not plans)
    # This aligns with the schedule-from-forecast validation
    all_schedules = await db.production_schedules.find(
        {"forecast_id": {"$exists": True, "$ne": None}, "status": {"$ne": "CANCELLED"}},
        {"_id": 0, "forecast_id": 1, "target_quantity": 1}
    ).to_list(10000)
    
    # Sum scheduled qty by forecast_id
    scheduled_by_forecast = {}
    for s in all_schedules:
        fid = s.get("forecast_id")
        if fid:
            scheduled_by_forecast[fid] = scheduled_by_forecast.get(fid, 0) + s.get("target_quantity", 0)
    
    # Get all dispatch lots linked to forecasts
    all_lots = await db.dispatch_lots.find(
        {"forecast_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "forecast_id": 1, "lot_code": 1, "total_quantity": 1, "required_quantity": 1, "status": 1}
    ).to_list(5000)
    
    lots_by_forecast = {}
    for lot in all_lots:
        fid = lot.get("forecast_id")
        if fid:
            if fid not in lots_by_forecast:
                lots_by_forecast[fid] = []
            lots_by_forecast[fid].append({
                "lot_code": lot.get("lot_code"),
                "quantity": lot.get("total_quantity") or lot.get("required_quantity", 0),
                "status": lot.get("status")
            })
    
    # Get buyer names
    buyer_ids = list(set(f.get("buyer_id") for f in forecasts if f.get("buyer_id")))
    buyers = await db.buyers.find({"id": {"$in": buyer_ids}}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(100)
    buyer_map = {b["id"]: b for b in buyers}
    
    # Get SKU details
    sku_ids = list(set(f.get("sku_id") for f in forecasts if f.get("sku_id")))
    skus = await db.skus.find({"sku_id": {"$in": sku_ids}}, {"_id": 0, "sku_id": 1, "description": 1, "vertical": 1, "brand": 1}).to_list(1000)
    sku_map = {s["sku_id"]: s for s in skus}
    
    # Get vertical details
    vertical_ids = list(set(f.get("vertical_id") for f in forecasts if f.get("vertical_id")))
    verticals = await db.verticals.find({"id": {"$in": vertical_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    vertical_map = {v["id"]: v["name"] for v in verticals}
    
    result = []
    for f in forecasts:
        forecast_qty = f.get("quantity", 0)
        forecast_id = f.get("id")
        
        # Get scheduled production qty (from production_schedules)
        scheduled_qty = scheduled_by_forecast.get(forecast_id, 0)
        
        remaining_qty = max(0, forecast_qty - scheduled_qty)
        
        # Get linked dispatch lots
        dispatch_lots = lots_by_forecast.get(forecast_id, [])
        dispatch_qty = sum(l.get("quantity", 0) for l in dispatch_lots)
        
        buyer = buyer_map.get(f.get("buyer_id"), {})
        sku = sku_map.get(f.get("sku_id"), {})
        
        result.append({
            "id": forecast_id,
            "forecast_code": f.get("forecast_code"),
            "buyer_id": f.get("buyer_id"),
            "buyer_name": buyer.get("name"),
            "buyer_code": buyer.get("code"),
            "vertical_id": f.get("vertical_id"),
            "vertical_name": vertical_map.get(f.get("vertical_id"), f.get("vertical_id")),
            "sku_id": f.get("sku_id"),
            "sku_description": sku.get("description", ""),
            "brand": sku.get("brand", ""),
            "forecast_month": f.get("forecast_month"),
            "forecast_qty": forecast_qty,
            "scheduled_qty": scheduled_qty,
            "remaining_qty": remaining_qty,
            "dispatch_qty": dispatch_qty,
            "dispatch_lots": dispatch_lots,
            "is_fully_scheduled": remaining_qty == 0,
            "priority": f.get("priority", "MEDIUM"),
            "status": f.get("status"),
            "notes": f.get("notes", "")
        })
    
    # Sort by remaining quantity (highest first) then by forecast month
    result.sort(key=lambda x: (-x["remaining_qty"], x.get("forecast_month", "")))
    
    return result


@router.get("/cpc/demand-forecasts/summary")
async def get_demand_forecasts_summary():
    """Get summary of demand forecasts for CPC dashboard"""
    forecasts = await db.forecasts.find(
        {"status": {"$in": ["CONFIRMED", "CONVERTED"]}},
        {"_id": 0, "quantity": 1, "status": 1, "id": 1, "sku_id": 1}
    ).to_list(5000)
    
    total_forecast_qty = sum(f.get("quantity", 0) for f in forecasts)
    
    # Get scheduled quantities
    schedules = await db.production_schedules.find(
        {"status": {"$ne": "CANCELLED"}},
        {"_id": 0, "target_quantity": 1}
    ).to_list(5000)
    
    total_scheduled_qty = sum(s.get("target_quantity", 0) for s in schedules)
    
    return {
        "total_forecasts": len(forecasts),
        "total_forecast_qty": total_forecast_qty,
        "total_scheduled_qty": total_scheduled_qty,
        "remaining_to_schedule": max(0, total_forecast_qty - total_scheduled_qty),
        "scheduling_percent": round(total_scheduled_qty / total_forecast_qty * 100, 1) if total_forecast_qty > 0 else 0
    }


@router.get("/cpc/demand-forecasts/download")
async def download_demand_forecasts():
    """Download confirmed demand forecasts as Excel file for CPC"""
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    # Get confirmed forecasts
    forecasts = await db.forecasts.find(
        {"status": {"$in": ["CONFIRMED", "CONVERTED"]}},
        {"_id": 0}
    ).sort("forecast_month", 1).to_list(5000)
    
    # Get all production schedules for remaining qty calculation
    all_schedules = await db.production_schedules.find(
        {"forecast_id": {"$exists": True, "$ne": None}, "status": {"$ne": "CANCELLED"}},
        {"_id": 0, "forecast_id": 1, "target_quantity": 1}
    ).to_list(10000)
    
    scheduled_by_forecast = {}
    for s in all_schedules:
        fid = s.get("forecast_id")
        if fid:
            scheduled_by_forecast[fid] = scheduled_by_forecast.get(fid, 0) + s.get("target_quantity", 0)
    
    # Get buyer, vertical, SKU details
    buyer_ids = list(set(f.get("buyer_id") for f in forecasts if f.get("buyer_id")))
    buyers = await db.buyers.find({"id": {"$in": buyer_ids}}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(100)
    buyer_map = {b["id"]: b for b in buyers}
    
    sku_ids = list(set(f.get("sku_id") for f in forecasts if f.get("sku_id")))
    skus = await db.skus.find({"sku_id": {"$in": sku_ids}}, {"_id": 0}).to_list(5000)
    sku_map = {s["sku_id"]: s for s in skus}
    
    vertical_ids = list(set(f.get("vertical_id") for f in forecasts if f.get("vertical_id")))
    verticals = await db.verticals.find({"id": {"$in": vertical_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    vertical_map = {v["id"]: v["name"] for v in verticals}
    
    # Create Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Demand Forecasts"
    
    # Define styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Headers
    headers = [
        "Forecast ID", "Buyer Code", "Buyer Name", "Vertical", "Brand", "Model",
        "SKU ID", "SKU Description", "Forecast Month", "Forecast Qty",
        "Scheduled Qty", "Remaining Qty", "Priority", "Status"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # Data rows
    for row_num, f in enumerate(forecasts, 2):
        buyer = buyer_map.get(f.get("buyer_id"), {})
        sku = sku_map.get(f.get("sku_id"), {})
        forecast_qty = f.get("quantity", 0)
        scheduled_qty = scheduled_by_forecast.get(f.get("id"), 0)
        remaining_qty = max(0, forecast_qty - scheduled_qty)
        
        row_data = [
            f.get("forecast_code", ""),
            buyer.get("code", ""),
            buyer.get("name", ""),
            vertical_map.get(f.get("vertical_id"), sku.get("vertical", "")),
            sku.get("brand", ""),
            sku.get("model", ""),
            f.get("sku_id", ""),
            sku.get("description", ""),
            f.get("forecast_month").strftime("%Y-%m") if isinstance(f.get("forecast_month"), datetime) else str(f.get("forecast_month", ""))[:7],
            forecast_qty,
            scheduled_qty,
            remaining_qty,
            f.get("priority", "MEDIUM"),
            f.get("status", "")
        ]
        
        for col, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=value)
            cell.border = thin_border
            if col in [10, 11, 12]:  # Numeric columns
                cell.alignment = Alignment(horizontal="right")
    
    # Auto-adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"demand_forecasts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


class ScheduleFromForecastRequest(BaseModel):
    forecast_id: str
    quantity: int
    target_date: datetime
    branch: Optional[str] = None  # NEW: Branch assignment
    priority: Optional[str] = "MEDIUM"
    notes: Optional[str] = ""


# NEW: Model capacity upload model
class BranchModelCapacityUpload(BaseModel):
    month: str  # Format: "2026-03"
    day: int    # 1-31
    model_id: str
    capacity_qty: int


class BranchModelCapacityBulkUpload(BaseModel):
    branch: str
    capacities: List[BranchModelCapacityUpload]


# ============ BRANCH MODEL CAPACITY ENDPOINTS ============

@router.post("/branches/model-capacity/upload")
async def upload_branch_model_capacity(data: BranchModelCapacityBulkUpload):
    """Upload model-specific capacity for a branch (Month, Day, Model, Qty)"""
    if not data.capacities:
        raise HTTPException(status_code=400, detail="No capacity data provided")
    
    # Validate branch exists
    branch = await db.branch_capacity.find_one({"branch": data.branch})
    if not branch:
        raise HTTPException(status_code=404, detail=f"Branch '{data.branch}' not found")
    
    # Validate models exist
    model_ids = list(set(c.model_id for c in data.capacities))
    existing_models = await db.models.find(
        {"id": {"$in": model_ids}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    existing_model_ids = {m["id"] for m in existing_models}
    
    missing_models = set(model_ids) - existing_model_ids
    if missing_models:
        raise HTTPException(status_code=400, detail=f"Models not found: {', '.join(missing_models)}")
    
    # Insert or update capacities
    inserted = 0
    updated = 0
    
    for cap in data.capacities:
        record = {
            "branch": data.branch,
            "month": cap.month,
            "day": cap.day,
            "model_id": cap.model_id,
            "capacity_qty": cap.capacity_qty,
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.branch_model_capacity.update_one(
            {
                "branch": data.branch,
                "month": cap.month,
                "day": cap.day,
                "model_id": cap.model_id
            },
            {"$set": record, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}},
            upsert=True
        )
        
        if result.upserted_id:
            inserted += 1
        else:
            updated += 1
    
    return {
        "message": f"Capacity uploaded for branch {data.branch}",
        "inserted": inserted,
        "updated": updated,
        "total": len(data.capacities)
    }


@router.get("/branches/{branch}/model-capacity")
async def get_branch_model_capacity(branch: str, month: Optional[str] = None):
    """Get model-specific capacity for a branch"""
    query = {"branch": branch}
    if month:
        query["month"] = month
    
    capacities = await db.branch_model_capacity.find(
        query,
        {"_id": 0}
    ).to_list(5000)
    
    return capacities


@router.get("/branches/{branch}/capacity-for-date")
async def get_branch_capacity_for_date(branch: str, date: str, model_id: Optional[str] = None):
    """Get available capacity for a branch on a specific date, optionally filtered by model"""
    # Parse date
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        month_str = date_obj.strftime("%Y-%m")
        day = date_obj.day
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get branch base capacity
    branch_cap = await db.branch_capacity.find_one({"branch": branch}, {"_id": 0})
    if not branch_cap:
        raise HTTPException(status_code=404, detail=f"Branch '{branch}' not found")
    
    base_capacity = branch_cap.get("capacity_units_per_day", 0)
    
    # Check if there's model-specific capacity
    model_query = {"branch": branch, "month": month_str, "day": day}
    if model_id:
        model_query["model_id"] = model_id
    
    model_capacities = await db.branch_model_capacity.find(
        model_query,
        {"_id": 0}
    ).to_list(100)
    
    # Get already allocated for this date
    allocated_query = {"branch": branch}
    schedules_on_date = await db.production_schedules.find(
        {
            "target_date": {
                "$gte": datetime(date_obj.year, date_obj.month, date_obj.day, tzinfo=timezone.utc),
                "$lt": datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59, tzinfo=timezone.utc)
            },
            "status": {"$ne": "CANCELLED"}
        },
        {"_id": 0, "target_quantity": 1, "sku_id": 1, "branch": 1}
    ).to_list(1000)
    
    # Filter schedules by branch if branch field exists
    branch_schedules = [s for s in schedules_on_date if s.get("branch") == branch]
    total_allocated = sum(s.get("target_quantity", 0) for s in branch_schedules)
    
    # Determine effective capacity
    if model_capacities:
        # Use model-specific capacity
        total_model_capacity = sum(m.get("capacity_qty", 0) for m in model_capacities)
        available = max(0, total_model_capacity - total_allocated)
        capacity_type = "model_specific"
    else:
        # Use base capacity
        available = max(0, base_capacity - total_allocated)
        capacity_type = "base"
    
    return {
        "branch": branch,
        "date": date,
        "base_capacity": base_capacity,
        "model_capacities": model_capacities,
        "allocated": total_allocated,
        "available": available,
        "capacity_type": capacity_type
    }


@router.get("/skus/{sku_id}/assigned-branches")
async def get_sku_assigned_branches(sku_id: str):
    """Get branches where a SKU is assigned/subscribed"""
    # Check if SKU exists
    sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU {sku_id} not found")
    
    # Get SKU-branch assignments
    assignments = await db.sku_branch_assignments.find(
        {"sku_id": sku_id, "is_active": True},
        {"_id": 0, "branch": 1}
    ).to_list(100)
    
    assigned_branches = [a["branch"] for a in assignments]
    
    # If no specific assignments, return all branches (for flexibility)
    if not assigned_branches:
        all_branches = await db.branch_capacity.find(
            {},
            {"_id": 0, "branch": 1, "capacity_units_per_day": 1}
        ).to_list(100)
        return {
            "sku_id": sku_id,
            "assignment_type": "all",
            "branches": [b["branch"] for b in all_branches if b.get("capacity_units_per_day", 0) > 0]
        }
    
    return {
        "sku_id": sku_id,
        "assignment_type": "specific",
        "branches": assigned_branches
    }


# ============ END BRANCH MODEL CAPACITY ============


@router.post("/cpc/schedule-from-forecast")
async def create_schedule_from_forecast(data: ScheduleFromForecastRequest):
    """Create a production schedule directly from a demand forecast"""
    # Get the forecast
    forecast = await db.forecasts.find_one({"id": data.forecast_id}, {"_id": 0})
    if not forecast:
        raise HTTPException(status_code=404, detail="Forecast not found")
    
    if forecast.get("status") not in ["CONFIRMED", "CONVERTED"]:
        raise HTTPException(status_code=400, detail="Can only schedule from confirmed forecasts")
    
    # Get SKU from forecast
    sku_id = forecast.get("sku_id")
    if not sku_id:
        raise HTTPException(status_code=400, detail="Forecast has no SKU linked")
    
    # Verify SKU exists
    sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU {sku_id} not found")
    
    # NEW: Validate branch if provided
    branch_name = None
    if data.branch:
        # Check if branch exists
        branch_cap = await db.branch_capacity.find_one({"branch": data.branch}, {"_id": 0})
        if not branch_cap:
            raise HTTPException(status_code=404, detail=f"Branch '{data.branch}' not found")
        
        # Check if SKU is assigned to this branch
        sku_assignments = await db.sku_branch_assignments.find(
            {"sku_id": sku_id, "is_active": True},
            {"_id": 0, "branch": 1}
        ).to_list(100)
        
        assigned_branches = [a["branch"] for a in sku_assignments]
        
        # If there are specific assignments, verify the branch is in the list
        if assigned_branches and data.branch not in assigned_branches:
            raise HTTPException(
                status_code=400, 
                detail=f"SKU {sku_id} is not assigned to branch '{data.branch}'. Assigned branches: {', '.join(assigned_branches)}"
            )
        
        # Check branch capacity for the target date
        target_date_obj = data.target_date
        date_str = target_date_obj.strftime("%Y-%m-%d")
        month_str = target_date_obj.strftime("%Y-%m")
        day = target_date_obj.day
        
        # Get model-specific capacity if available
        model_id = sku.get("model_id")
        model_capacity = None
        if model_id:
            model_capacity = await db.branch_model_capacity.find_one(
                {"branch": data.branch, "month": month_str, "day": day, "model_id": model_id},
                {"_id": 0}
            )
        
        # Calculate already allocated for this branch on target date
        day_start = datetime(target_date_obj.year, target_date_obj.month, target_date_obj.day, tzinfo=timezone.utc)
        day_end = datetime(target_date_obj.year, target_date_obj.month, target_date_obj.day, 23, 59, 59, tzinfo=timezone.utc)
        
        existing_on_date = await db.production_schedules.find(
            {
                "branch": data.branch,
                "target_date": {"$gte": day_start, "$lte": day_end},
                "status": {"$ne": "CANCELLED"}
            },
            {"_id": 0, "target_quantity": 1}
        ).to_list(1000)
        
        already_allocated = sum(s.get("target_quantity", 0) for s in existing_on_date)
        
        # Determine capacity limit
        if model_capacity:
            capacity_limit = model_capacity.get("capacity_qty", 0)
            capacity_type = "model-specific"
        else:
            capacity_limit = branch_cap.get("capacity_units_per_day", 0)
            capacity_type = "base"
        
        available_capacity = capacity_limit - already_allocated
        
        # Check if quantity exceeds available capacity
        if data.quantity > available_capacity:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity ({data.quantity}) exceeds available capacity for branch '{data.branch}' on {date_str}. "
                       f"Capacity ({capacity_type}): {capacity_limit}, Already allocated: {already_allocated}, Available: {available_capacity}"
            )
        
        branch_name = data.branch
    
    # Check remaining quantity
    existing_schedules = await db.production_schedules.find(
        {"forecast_id": data.forecast_id, "status": {"$ne": "CANCELLED"}},
        {"_id": 0, "target_quantity": 1}
    ).to_list(100)
    
    already_scheduled = sum(s.get("target_quantity", 0) for s in existing_schedules)
    forecast_qty = forecast.get("quantity", 0)
    remaining = forecast_qty - already_scheduled
    
    if data.quantity > remaining:
        raise HTTPException(
            status_code=400, 
            detail=f"Quantity exceeds remaining. Forecast: {forecast_qty}, Already scheduled: {already_scheduled}, Remaining: {remaining}"
        )
    
    # Create production schedule
    count = await db.production_schedules.count_documents({})
    schedule_code = f"PS_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    schedule = {
        "id": str(uuid.uuid4()),
        "schedule_code": schedule_code,
        "forecast_id": data.forecast_id,
        "dispatch_lot_id": None,
        "branch": branch_name,  # NEW: Include branch in schedule
        "sku_id": sku_id,
        "sku_description": sku.get("description", ""),
        "target_quantity": data.quantity,
        "allocated_quantity": 0,
        "completed_quantity": 0,
        "target_date": data.target_date,
        "priority": data.priority or forecast.get("priority", "MEDIUM"),
        "status": "DRAFT",
        "notes": data.notes or f"Scheduled from forecast {forecast.get('forecast_code', '')}",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.production_schedules.insert_one(schedule)
    
    # Update forecast status if fully scheduled
    new_scheduled_total = already_scheduled + data.quantity
    if new_scheduled_total >= forecast_qty:
        await db.forecasts.update_one(
            {"id": data.forecast_id},
            {"$set": {"status": "CONVERTED"}}
        )
    
    del schedule["_id"]
    return {
        "message": "Production schedule created from forecast",
        "schedule": serialize_doc(schedule),
        "remaining_forecast_qty": remaining - data.quantity
    }
