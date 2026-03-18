"""Branch Operations routes - Production schedules view for branch users"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import db
from services.auth_service import get_current_user
from models.auth import User

router = APIRouter(tags=["Branch Operations"])


def serialize_doc(doc):
    """Serialize MongoDB document for JSON response"""
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'target_date' in doc and isinstance(doc['target_date'], str):
        doc['target_date'] = datetime.fromisoformat(doc['target_date'])
    if doc and 'completed_at' in doc and isinstance(doc['completed_at'], str):
        doc['completed_at'] = datetime.fromisoformat(doc['completed_at'])
    return doc


@router.get("/branch-ops/my-branches")
async def get_my_branches(current_user: User = Depends(get_current_user)):
    """Get branches assigned to the logged-in user"""
    # Master admin can see all branches
    if current_user.role == "master_admin" or current_user.role == "MASTER_ADMIN":
        branches = await db.branches.find({"is_active": True}, {"_id": 0}).to_list(100)
        return {
            "user": current_user.name,
            "role": current_user.role,
            "branches": [b["name"] for b in branches],
            "is_all_access": True
        }
    
    # Branch ops user sees only assigned branches
    return {
        "user": current_user.name,
        "role": current_user.role,
        "branches": current_user.assigned_branches,
        "is_all_access": False
    }


@router.get("/branch-ops/schedules")
async def get_branch_schedules(
    date_filter: str = Query("today", description="Filter: today, week, month, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom filter (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Specific branch filter (optional)"),
    status: Optional[str] = Query(None, description="Status filter: SCHEDULED, COMPLETED, CANCELLED"),
    current_user: User = Depends(get_current_user)
):
    """
    Get production schedules for branch ops user.
    - Master admin sees all branches (or can filter by specific branch)
    - Branch ops user sees ONLY their assigned branches
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Determine date range based on filter
    if date_filter == "today":
        start = today
        end = today + timedelta(days=1)
    elif date_filter == "week":
        # Start from Monday of current week
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=7)
    elif date_filter == "month":
        start = today.replace(day=1)
        # End of month
        if today.month == 12:
            end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end = today.replace(month=today.month + 1, day=1)
    elif date_filter == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date required for custom filter")
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        raise HTTPException(status_code=400, detail="Invalid date_filter. Use: today, week, month, custom")
    
    # Determine which branches user can access
    is_master = current_user.role in ["master_admin", "MASTER_ADMIN"]
    
    if is_master:
        # Master admin can see all or filter by specific branch
        if branch:
            user_branches = [branch]
        else:
            branches = await db.branches.find({"is_active": True}, {"_id": 0, "name": 1}).to_list(100)
            user_branches = [b["name"] for b in branches]
    else:
        # Branch ops user - only their assigned branches
        user_branches = current_user.assigned_branches
        if not user_branches:
            return {
                "message": "No branches assigned to your account. Contact admin.",
                "schedules": [],
                "summary": {"total": 0, "scheduled": 0, "completed": 0}
            }
        # If specific branch requested, verify user has access
        if branch:
            if branch not in user_branches:
                raise HTTPException(status_code=403, detail=f"Access denied to branch: {branch}")
            user_branches = [branch]
    
    # Build query
    query = {
        "branch": {"$in": user_branches},
        "target_date": {"$gte": start, "$lt": end}
    }
    
    if status:
        query["status"] = status
    
    # Fetch schedules
    schedules = await db.production_schedules.find(query, {"_id": 0}).sort("target_date", 1).to_list(1000)
    
    # Enrich with SKU details
    sku_ids = list(set(s.get("sku_id") for s in schedules if s.get("sku_id")))
    skus = await db.skus.find({"sku_id": {"$in": sku_ids}}, {"_id": 0}).to_list(1000)
    sku_map = {s["sku_id"]: s for s in skus}
    
    enriched_schedules = []
    for schedule in schedules:
        sku = sku_map.get(schedule.get("sku_id"), {})
        schedule["sku_details"] = {
            "description": sku.get("description", ""),
            "model": sku.get("model", ""),
            "brand": sku.get("brand", ""),
            "vertical": sku.get("vertical", "")
        }
        enriched_schedules.append(serialize_doc(schedule))
    
    # Calculate summary
    summary = {
        "total": len(schedules),
        "scheduled": len([s for s in schedules if s.get("status") == "SCHEDULED"]),
        "completed": len([s for s in schedules if s.get("status") == "COMPLETED"]),
        "cancelled": len([s for s in schedules if s.get("status") == "CANCELLED"]),
        "total_target_qty": sum(s.get("target_quantity", 0) for s in schedules),
        "total_completed_qty": sum(s.get("completed_quantity", 0) for s in schedules)
    }
    
    return {
        "user": current_user.name,
        "branches": user_branches,
        "date_filter": date_filter,
        "date_range": {
            "start": start.strftime("%Y-%m-%d"),
            "end": (end - timedelta(days=1)).strftime("%Y-%m-%d")
        },
        "schedules": enriched_schedules,
        "summary": summary
    }


@router.put("/branch-ops/schedules/{schedule_id}/complete")
async def complete_schedule(
    schedule_id: str,
    completed_quantity: int = Query(..., description="Actual quantity produced"),
    notes: Optional[str] = Query(None, description="Completion notes"),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a production schedule as completed.
    Branch ops user can only complete schedules for their assigned branches.
    """
    schedule = await db.production_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check branch access
    is_master = current_user.role in ["master_admin", "MASTER_ADMIN"]
    if not is_master:
        if schedule.get("branch") not in current_user.assigned_branches:
            raise HTTPException(status_code=403, detail="Access denied. Schedule belongs to different branch.")
    
    if schedule.get("status") == "COMPLETED":
        raise HTTPException(status_code=400, detail="Schedule already completed")
    
    if schedule.get("status") == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot complete a cancelled schedule")
    
    # Update schedule
    update_data = {
        "status": "COMPLETED",
        "completed_quantity": completed_quantity,
        "completed_at": datetime.now(timezone.utc),
        "completed_by": current_user.id,
        "completed_by_name": current_user.name
    }
    
    if notes:
        update_data["completion_notes"] = notes
    
    await db.production_schedules.update_one(
        {"id": schedule_id},
        {"$set": update_data}
    )
    
    # Update dispatch lot if linked
    if schedule.get("dispatch_lot_id"):
        await db.dispatch_lots.update_one(
            {"id": schedule["dispatch_lot_id"]},
            {"$set": {"status": "FULLY_PRODUCED"}}
        )
    
    return {
        "message": f"Schedule {schedule.get('schedule_code')} marked as completed",
        "schedule_id": schedule_id,
        "completed_quantity": completed_quantity,
        "completed_by": current_user.name
    }


@router.get("/branch-ops/dashboard")
async def get_branch_ops_dashboard(
    current_user: User = Depends(get_current_user)
):
    """
    Dashboard summary for branch ops user.
    Shows today's work, pending schedules, and completion stats.
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    
    # Determine user's branches
    is_master = current_user.role in ["master_admin", "MASTER_ADMIN"]
    if is_master:
        branches = await db.branches.find({"is_active": True}, {"_id": 0, "name": 1}).to_list(100)
        user_branches = [b["name"] for b in branches]
    else:
        user_branches = current_user.assigned_branches
    
    if not user_branches:
        return {
            "message": "No branches assigned",
            "today": {"scheduled": 0, "completed": 0, "target_qty": 0, "completed_qty": 0},
            "week": {"scheduled": 0, "completed": 0},
            "branches": []
        }
    
    # Today's stats
    today_schedules = await db.production_schedules.find({
        "branch": {"$in": user_branches},
        "target_date": {"$gte": today, "$lt": tomorrow},
        "status": {"$ne": "CANCELLED"}
    }, {"_id": 0}).to_list(1000)
    
    today_stats = {
        "total": len(today_schedules),
        "scheduled": len([s for s in today_schedules if s.get("status") == "SCHEDULED"]),
        "completed": len([s for s in today_schedules if s.get("status") == "COMPLETED"]),
        "target_qty": sum(s.get("target_quantity", 0) for s in today_schedules),
        "completed_qty": sum(s.get("completed_quantity", 0) for s in today_schedules if s.get("status") == "COMPLETED")
    }
    
    # Week stats
    week_schedules = await db.production_schedules.find({
        "branch": {"$in": user_branches},
        "target_date": {"$gte": week_start, "$lt": week_end},
        "status": {"$ne": "CANCELLED"}
    }, {"_id": 0, "status": 1, "target_quantity": 1, "completed_quantity": 1}).to_list(1000)
    
    week_stats = {
        "total": len(week_schedules),
        "scheduled": len([s for s in week_schedules if s.get("status") == "SCHEDULED"]),
        "completed": len([s for s in week_schedules if s.get("status") == "COMPLETED"]),
        "target_qty": sum(s.get("target_quantity", 0) for s in week_schedules),
        "completed_qty": sum(s.get("completed_quantity", 0) for s in week_schedules if s.get("status") == "COMPLETED")
    }
    
    # Per-branch breakdown for today
    branch_breakdown = []
    for branch in user_branches:
        branch_today = [s for s in today_schedules if s.get("branch") == branch]
        branch_breakdown.append({
            "branch": branch,
            "total": len(branch_today),
            "pending": len([s for s in branch_today if s.get("status") == "SCHEDULED"]),
            "completed": len([s for s in branch_today if s.get("status") == "COMPLETED"]),
            "target_qty": sum(s.get("target_quantity", 0) for s in branch_today),
            "completed_qty": sum(s.get("completed_quantity", 0) for s in branch_today if s.get("status") == "COMPLETED")
        })
    
    return {
        "user": current_user.name,
        "branches": user_branches,
        "today": today_stats,
        "week": week_stats,
        "branch_breakdown": branch_breakdown,
        "date": today.strftime("%Y-%m-%d")
    }
