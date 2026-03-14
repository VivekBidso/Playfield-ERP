"""CPC (Central Production Control) routes - Scheduling and Branch Allocation"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
import uuid

from database import db, BRANCHES

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
