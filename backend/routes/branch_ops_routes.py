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



@router.get("/rm-shortage-report")
async def get_rm_shortage_report(
    branch: Optional[str] = Query(None, description="Branch name (required for branch ops, optional for procurement)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD), defaults to today"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD), defaults to today + 7 days"),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate RM shortage report based on production schedules and BOM.
    
    Logic:
    1. Get current RM stock for the branch
    2. Calculate RM consumption for INTERIM period (today → start_date - 1) 
    3. Calculate RM requirement for SELECTED period (start_date → end_date)
    4. Shortage = Current Stock - Interim Consumption - Period Requirement
    
    BOM = common_bom (via bidso_sku_id) + brand_bom (via buyer_sku_id) merged
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Parse dates with defaults (next 7 days)
    if not start_date:
        start_dt = today
    else:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    
    if not end_date:
        end_dt = today + timedelta(days=7)
    else:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    
    # Determine branches to query
    is_admin = current_user.role in ["master_admin", "MASTER_ADMIN"]
    is_procurement = "PROCUREMENT" in current_user.role.upper() if current_user.role else False
    
    if branch:
        branches_to_query = [branch]
    elif is_admin or is_procurement:
        # Get all active branches
        all_branches = await db.branches.find({"is_active": True}, {"_id": 0, "name": 1}).to_list(100)
        branches_to_query = [b["name"] for b in all_branches]
    else:
        # Branch ops user - use assigned branches
        branches_to_query = current_user.assigned_branches or []
    
    if not branches_to_query:
        return {"error": "No branches available", "data": []}
    
    # Build BOM lookup: buyer_sku_id -> list of {rm_id, quantity}
    # Step 1: Get all buyer SKUs with their bidso_sku_id mapping
    buyer_skus = await db.buyer_skus.find(
        {"status": "ACTIVE"},
        {"_id": 0, "buyer_sku_id": 1, "bidso_sku_id": 1}
    ).to_list(10000)
    buyer_to_bidso = {s["buyer_sku_id"]: s.get("bidso_sku_id") for s in buyer_skus}
    
    # Step 2: Get all common BOMs
    common_boms = await db.common_bom.find({}, {"_id": 0, "bidso_sku_id": 1, "items": 1}).to_list(10000)
    bidso_to_bom = {b["bidso_sku_id"]: b.get("items", []) for b in common_boms}
    
    # Step 3: Get all brand BOMs
    brand_boms = await db.brand_bom.find({}, {"_id": 0, "buyer_sku_id": 1, "items": 1}).to_list(10000)
    buyer_to_brand_bom = {b["buyer_sku_id"]: b.get("items", []) for b in brand_boms}
    
    def get_merged_bom(buyer_sku_id):
        """Get merged BOM: common + brand-specific"""
        bidso_sku_id = buyer_to_bidso.get(buyer_sku_id)
        common_items = bidso_to_bom.get(bidso_sku_id, []) if bidso_sku_id else []
        brand_items = buyer_to_brand_bom.get(buyer_sku_id, [])
        
        # Merge: brand items override common items with same rm_id
        merged = {}
        for item in common_items:
            rm_id = item.get("rm_id")
            if rm_id:
                merged[rm_id] = item.get("quantity", 0)
        for item in brand_items:
            rm_id = item.get("rm_id")
            if rm_id:
                merged[rm_id] = merged.get(rm_id, 0) + item.get("quantity", 0)
        
        return merged  # {rm_id: quantity}
    
    # Calculate RM requirements for each branch
    result_by_branch = {}
    
    for branch_name in branches_to_query:
        # Get current RM stock for this branch
        branch_inventory = await db.branch_rm_inventory.find(
            {"branch": branch_name},
            {"_id": 0, "rm_id": 1, "current_stock": 1}
        ).to_list(15000)
        stock_map = {inv["rm_id"]: inv.get("current_stock", 0) for inv in branch_inventory}
        
        # Get production schedules for INTERIM period (today to start_date - 1)
        interim_end = start_dt - timedelta(days=1)
        interim_schedules = []
        if interim_end >= today:
            interim_schedules = await db.production_schedules.find(
                {
                    "branch": branch_name,
                    "target_date": {"$gte": today, "$lte": interim_end + timedelta(days=1)},
                    "status": {"$nin": ["CANCELLED", "COMPLETED"]}
                },
                {"_id": 0, "sku_id": 1, "target_quantity": 1}
            ).to_list(5000)
        
        # Get production schedules for SELECTED period (start_date to end_date)
        period_schedules = await db.production_schedules.find(
            {
                "branch": branch_name,
                "target_date": {"$gte": start_dt, "$lte": end_dt + timedelta(days=1)},
                "status": {"$nin": ["CANCELLED", "COMPLETED"]}
            },
            {"_id": 0, "sku_id": 1, "target_quantity": 1}
        ).to_list(5000)
        
        # Calculate RM consumption for interim period
        interim_consumption = {}
        for sched in interim_schedules:
            sku_id = sched.get("sku_id")
            qty = sched.get("target_quantity", 0)
            bom = get_merged_bom(sku_id)
            for rm_id, rm_qty in bom.items():
                interim_consumption[rm_id] = interim_consumption.get(rm_id, 0) + (rm_qty * qty)
        
        # Calculate RM requirement for selected period
        period_requirement = {}
        for sched in period_schedules:
            sku_id = sched.get("sku_id")
            qty = sched.get("target_quantity", 0)
            bom = get_merged_bom(sku_id)
            for rm_id, rm_qty in bom.items():
                period_requirement[rm_id] = period_requirement.get(rm_id, 0) + (rm_qty * qty)
        
        # Get all unique RM IDs
        all_rm_ids = set(interim_consumption.keys()) | set(period_requirement.keys())
        
        # Get RM details
        rm_details = {}
        if all_rm_ids:
            rms = await db.raw_materials.find(
                {"rm_id": {"$in": list(all_rm_ids)}},
                {"_id": 0, "rm_id": 1, "description": 1, "unit": 1, "category": 1}
            ).to_list(5000)
            rm_details = {rm["rm_id"]: rm for rm in rms}
        
        # Build result for this branch
        branch_data = []
        for rm_id in sorted(all_rm_ids):
            current = stock_map.get(rm_id, 0)
            interim = interim_consumption.get(rm_id, 0)
            required = period_requirement.get(rm_id, 0)
            projected = current - interim
            shortage = projected - required
            
            rm_info = rm_details.get(rm_id, {})
            branch_data.append({
                "rm_id": rm_id,
                "description": rm_info.get("description", ""),
                "unit": rm_info.get("unit", ""),
                "category": rm_info.get("category", ""),
                "current_stock": round(current, 2),
                "interim_consumption": round(interim, 2),
                "projected_stock": round(projected, 2),
                "period_requirement": round(required, 2),
                "shortage": round(shortage, 2),
                "is_shortage": shortage < 0
            })
        
        result_by_branch[branch_name] = {
            "branch": branch_name,
            "data": branch_data,
            "summary": {
                "total_rms": len(branch_data),
                "rms_in_shortage": len([d for d in branch_data if d["is_shortage"]]),
                "total_shortage_value": sum(abs(d["shortage"]) for d in branch_data if d["is_shortage"])
            }
        }
    
    # If single branch requested, return flat structure
    if branch and branch in result_by_branch:
        return {
            "branch": branch,
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "interim_period": f"{today.strftime('%Y-%m-%d')} to {(start_dt - timedelta(days=1)).strftime('%Y-%m-%d')}" if start_dt > today else "N/A",
            **result_by_branch[branch]
        }
    
    # Multi-branch: return all branches
    return {
        "start_date": start_dt.strftime("%Y-%m-%d"),
        "end_date": end_dt.strftime("%Y-%m-%d"),
        "interim_period": f"{today.strftime('%Y-%m-%d')} to {(start_dt - timedelta(days=1)).strftime('%Y-%m-%d')}" if start_dt > today else "N/A",
        "branches": list(result_by_branch.values()),
        "overall_summary": {
            "total_branches": len(result_by_branch),
            "branches_with_shortage": len([b for b in result_by_branch.values() if b["summary"]["rms_in_shortage"] > 0])
        }
    }


@router.get("/rm-shortage-report/export")
async def export_rm_shortage_report(
    branch: Optional[str] = Query(None, description="Branch name"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user)
):
    """Export RM shortage report as Excel"""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from fastapi.responses import StreamingResponse
    import io
    
    # Get the report data
    report = await get_rm_shortage_report(branch, start_date, end_date, current_user)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RM Shortage Report"
    
    # Header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
    shortage_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    
    # Headers
    headers = ["Branch", "RM ID", "Description", "Unit", "Category", "Current Stock", 
               "Interim Consumption", "Projected Stock", "Period Requirement", "Shortage"]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    
    # Data rows
    row_num = 2
    branches_data = report.get("branches", [])
    if not branches_data and "data" in report:
        # Single branch result
        branches_data = [{"branch": report.get("branch", ""), "data": report.get("data", [])}]
    
    for branch_info in branches_data:
        branch_name = branch_info.get("branch", "")
        for item in branch_info.get("data", []):
            ws.cell(row=row_num, column=1, value=branch_name)
            ws.cell(row=row_num, column=2, value=item.get("rm_id", ""))
            ws.cell(row=row_num, column=3, value=item.get("description", ""))
            ws.cell(row=row_num, column=4, value=item.get("unit", ""))
            ws.cell(row=row_num, column=5, value=item.get("category", ""))
            ws.cell(row=row_num, column=6, value=item.get("current_stock", 0))
            ws.cell(row=row_num, column=7, value=item.get("interim_consumption", 0))
            ws.cell(row=row_num, column=8, value=item.get("projected_stock", 0))
            ws.cell(row=row_num, column=9, value=item.get("period_requirement", 0))
            ws.cell(row=row_num, column=10, value=item.get("shortage", 0))
            
            # Highlight shortage rows
            if item.get("is_shortage"):
                for c in range(1, 11):
                    ws.cell(row=row_num, column=c).fill = shortage_fill
            
            row_num += 1
    
    # Auto-width columns
    col_widths = [20, 15, 35, 8, 15, 15, 18, 15, 18, 12]
    for idx, width in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(idx)].width = width
    
    # Save
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"rm_shortage_report_{report.get('start_date', 'export')}_{report.get('end_date', '')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
