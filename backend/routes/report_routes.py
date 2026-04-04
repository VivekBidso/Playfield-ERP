"""Report routes - FG Inventory, Stock Movements, Audit Logs"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from database import db
from models import User
from services.utils import get_current_user, check_branch_access, serialize_doc

router = APIRouter(tags=["Reports"])


# ============ FG Inventory ============

@router.get("/fg-inventory")
async def get_fg_inventory(
    branch: Optional[str] = None,
    sku_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get finished goods inventory"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    if sku_id:
        query["sku_id"] = sku_id
    
    inventory = await db.fg_inventory.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with SKU info
    for item in inventory:
        sku = await db.skus.find_one({"sku_id": item["sku_id"]}, {"_id": 0, "description": 1})
        item["sku_description"] = sku.get("description") if sku else None
    
    return inventory


@router.get("/fg-inventory/summary")
async def get_fg_inventory_summary(
    branch: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get FG inventory summary by SKU"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$sku_id",
            "total_quantity": {"$sum": "$quantity"},
            "branches": {"$push": {"branch": "$branch", "quantity": "$quantity"}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.fg_inventory.aggregate(pipeline).to_list(10000)
    
    # Enrich with SKU descriptions
    for item in result:
        sku = await db.skus.find_one({"sku_id": item["_id"]}, {"_id": 0, "description": 1})
        item["sku_id"] = item["_id"]
        item["sku_description"] = sku.get("description") if sku else None
        del item["_id"]
    
    return result


# ============ RM Stock Movements ============

@router.get("/rm-stock-movements")
async def get_rm_stock_movements(
    branch: Optional[str] = None,
    rm_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get raw material stock movements"""
    query = {}
    
    if branch:
        check_branch_access(current_user, branch)
        query["branch"] = branch
    elif current_user.role != "master_admin":
        query["branch"] = {"$in": current_user.assigned_branches}
    
    if rm_id:
        query["rm_id"] = rm_id
    
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await db.rm_stock_movements.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return movements


# ============ Price History ============

@router.get("/price-history")
async def get_price_history(
    rm_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get price history for raw materials"""
    query = {}
    
    if rm_id:
        query["rm_id"] = rm_id
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    history = await db.price_history.find(
        query, {"_id": 0}
    ).sort("effective_date", -1).to_list(limit)
    
    return history


# ============ Audit Logs ============

@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get audit logs"""
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if user_id:
        query["user_id"] = user_id
    
    logs = await db.audit_logs.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return logs


# ============ IBT Transfers ============
# NOTE: IBT endpoints have been moved to procurement_routes.py for enhanced functionality
# including: inventory validation, variance tracking, shortage records, and transit details.
# The legacy endpoints below have been deprecated.

# DEPRECATED - Legacy IBT endpoints removed in favor of procurement_routes.py implementation
# See /api/ibt-transfers endpoints in procurement_routes.py for:
# - Inventory validation on create/approve/dispatch
# - IN_TRANSIT status with transit details (vehicle, driver, ETA)
# - Receiver inputs actual quantity received
# - Automatic shortage record creation when received < dispatched
# - Partial rejection handling


# Placeholder to maintain line numbers for git history - this section is now handled by procurement_routes.py
async def _deprecated_ibt_note():
    """
    IBT Transfer endpoints have been consolidated into procurement_routes.py.
    The new implementation provides:
    1. Strict inventory checks before creating/dispatching transfers
    2. Transit tracking (vehicle number, driver, expected arrival)
    3. Variance handling (shortage records when received qty < dispatched qty)
    4. INITIATED -> APPROVED -> IN_TRANSIT -> COMPLETED status flow
    """
    pass


# Keep the IBT_COMPLETED event publishing for reference - now handled in procurement_routes.py
# The event_bus.publish(EventType.IBT_COMPLETED, {...}) is called in the receive endpoint


# ============ NEW REPORTS ============

@router.get("/dispatch-by-origin")
async def get_dispatch_by_manufacturing_origin(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    manufacturing_unit: Optional[str] = None,
    dispatch_branch: Optional[str] = None
):
    """
    Report: Dispatch by Manufacturing Origin
    Shows where dispatched goods were originally manufactured.
    """
    # Build query for dispatch lots
    query = {"status": {"$in": ["DISPATCHED", "DELIVERED"]}}
    
    if dispatch_branch:
        query["$or"] = [{"branch": dispatch_branch}, {"dispatch_from": dispatch_branch}]
    
    if start_date:
        query["dispatched_at"] = {"$gte": start_date}
    if end_date:
        if "dispatched_at" in query:
            query["dispatched_at"]["$lte"] = end_date
        else:
            query["dispatched_at"] = {"$lte": end_date}
    
    dispatch_lots = await db.dispatch_lots.find(query, {"_id": 0}).to_list(5000)
    
    # Aggregate origin data
    origin_summary = {}  # {manufacturing_unit: {sku_id: total_qty}}
    detailed_records = []
    
    for lot in dispatch_lots:
        dispatch_from = lot.get("branch") or lot.get("dispatch_from") or "-"
        lot_id = lot.get("lot_number") or lot.get("id")
        dispatched_at = lot.get("dispatched_at") or lot.get("updated_at")
        buyer = lot.get("buyer_name") or lot.get("customer_name") or "-"
        
        for line in lot.get("line_items", []):
            sku_id = line.get("sku_id") or line.get("bidso_sku_id") or line.get("buyer_sku_id")
            qty = line.get("quantity", 0)
            origin_breakdown = line.get("origin_breakdown", [])
            
            if origin_breakdown:
                for origin in origin_breakdown:
                    mfg_unit = origin.get("manufacturing_unit", "Unknown")
                    origin_qty = origin.get("quantity", 0)
                    
                    # Add to summary
                    if mfg_unit not in origin_summary:
                        origin_summary[mfg_unit] = {}
                    if sku_id not in origin_summary[mfg_unit]:
                        origin_summary[mfg_unit][sku_id] = 0
                    origin_summary[mfg_unit][sku_id] += origin_qty
                    
                    detailed_records.append({
                        "lot_id": lot_id,
                        "dispatched_at": dispatched_at,
                        "dispatch_from": dispatch_from,
                        "buyer": buyer,
                        "sku_id": sku_id,
                        "quantity": origin_qty,
                        "manufacturing_unit": mfg_unit,
                        "production_date": origin.get("production_date")
                    })
            else:
                # No origin data - show as "Pre-Tracking"
                detailed_records.append({
                    "lot_id": lot_id,
                    "dispatched_at": dispatched_at,
                    "dispatch_from": dispatch_from,
                    "buyer": buyer,
                    "sku_id": sku_id,
                    "quantity": qty,
                    "manufacturing_unit": "Pre-Tracking",
                    "production_date": None
                })
    
    # Filter by manufacturing unit if specified
    if manufacturing_unit:
        detailed_records = [r for r in detailed_records if r["manufacturing_unit"] == manufacturing_unit]
    
    # Format summary for display
    summary_list = []
    for mfg_unit, skus in origin_summary.items():
        total_qty = sum(skus.values())
        summary_list.append({
            "manufacturing_unit": mfg_unit,
            "total_quantity": total_qty,
            "sku_count": len(skus),
            "top_skus": sorted(skus.items(), key=lambda x: -x[1])[:5]
        })
    
    summary_list.sort(key=lambda x: -x["total_quantity"])
    
    return {
        "summary": summary_list,
        "detailed_records": detailed_records[:500],  # Limit for performance
        "total_records": len(detailed_records)
    }


@router.get("/production-by-unit")
async def get_production_output_by_unit(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branch: Optional[str] = None
):
    """
    Report: Production Output by Unit
    Shows what each branch/unit manufactured over time.
    """
    # Query completed production schedules
    query = {"status": "COMPLETED"}
    
    if branch:
        query["branch"] = branch
    
    if start_date or end_date:
        query["completed_at"] = {}
        if start_date:
            query["completed_at"]["$gte"] = start_date
        if end_date:
            query["completed_at"]["$lte"] = end_date
    
    schedules = await db.production_schedules.find(query, {"_id": 0}).to_list(10000)
    
    # Also query stock_origin_ledger for more accurate data
    origin_query = {"status": "AVAILABLE"}
    if branch:
        origin_query["manufacturing_unit"] = branch
    
    origin_entries = await db.stock_origin_ledger.find(origin_query, {"_id": 0}).to_list(10000)
    
    # Aggregate by branch
    by_branch = {}  # {branch: {sku_id: {total_produced, schedules}}}
    
    for schedule in schedules:
        br = schedule.get("branch", "Unknown")
        sku = schedule.get("sku_id") or schedule.get("bidso_sku_id")
        qty = schedule.get("completed_quantity", 0)
        
        if br not in by_branch:
            by_branch[br] = {"total_produced": 0, "skus": {}, "schedule_count": 0}
        
        by_branch[br]["total_produced"] += qty
        by_branch[br]["schedule_count"] += 1
        
        if sku:
            if sku not in by_branch[br]["skus"]:
                by_branch[br]["skus"][sku] = 0
            by_branch[br]["skus"][sku] += qty
    
    # Format output
    result = []
    for br, data in by_branch.items():
        top_skus = sorted(data["skus"].items(), key=lambda x: -x[1])[:10]
        result.append({
            "branch": br,
            "total_produced": data["total_produced"],
            "schedule_count": data["schedule_count"],
            "unique_skus": len(data["skus"]),
            "top_skus": [{"sku_id": s[0], "quantity": s[1]} for s in top_skus]
        })
    
    result.sort(key=lambda x: -x["total_produced"])
    
    # Detailed records
    detailed = []
    for schedule in schedules[:500]:
        detailed.append({
            "schedule_code": schedule.get("schedule_code"),
            "branch": schedule.get("branch"),
            "sku_id": schedule.get("sku_id") or schedule.get("bidso_sku_id"),
            "planned_quantity": schedule.get("quantity", 0),
            "completed_quantity": schedule.get("completed_quantity", 0),
            "scheduled_date": schedule.get("scheduled_date"),
            "completed_at": schedule.get("completed_at")
        })
    
    return {
        "summary": result,
        "detailed_records": detailed,
        "total_schedules": len(schedules)
    }


@router.get("/forecast-vs-actual")
async def get_forecast_vs_actual(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    buyer_id: Optional[str] = None
):
    """
    Report: Forecast vs Actual
    Compares demand forecasts against actual dispatches.
    """
    # Get forecasts
    forecast_query = {}
    if buyer_id:
        forecast_query["buyer_id"] = buyer_id
    
    forecasts = await db.demand_forecasts.find(forecast_query, {"_id": 0}).to_list(5000)
    
    # Get dispatches
    dispatch_query = {"status": {"$in": ["DISPATCHED", "DELIVERED"]}}
    dispatches = await db.dispatch_lots.find(dispatch_query, {"_id": 0}).to_list(5000)
    
    # Aggregate forecasts by SKU and buyer
    forecast_by_key = {}  # {sku_id_buyer_id: {forecast_qty, months}}
    
    for fc in forecasts:
        sku = fc.get("sku_id") or fc.get("bidso_sku_id") or fc.get("buyer_sku_id")
        buyer = fc.get("buyer_id") or fc.get("buyer_code") or "Unknown"
        
        # Sum up all month forecasts
        total_forecast = 0
        for key, val in fc.items():
            if key.startswith("month_") and isinstance(val, (int, float)):
                total_forecast += val
        
        # Also check weeks
        for key, val in fc.items():
            if key.startswith("week_") and isinstance(val, (int, float)):
                total_forecast += val
        
        if sku:
            key = f"{sku}_{buyer}"
            if key not in forecast_by_key:
                forecast_by_key[key] = {"sku_id": sku, "buyer": buyer, "forecast_qty": 0}
            forecast_by_key[key]["forecast_qty"] += total_forecast
    
    # Aggregate actuals by SKU and buyer
    actual_by_key = {}
    
    for dispatch in dispatches:
        buyer = dispatch.get("buyer_id") or dispatch.get("buyer_code") or dispatch.get("buyer_name") or "Unknown"
        
        for line in dispatch.get("line_items", []):
            sku = line.get("sku_id") or line.get("bidso_sku_id") or line.get("buyer_sku_id")
            qty = line.get("quantity", 0)
            
            if sku:
                key = f"{sku}_{buyer}"
                if key not in actual_by_key:
                    actual_by_key[key] = {"sku_id": sku, "buyer": buyer, "actual_qty": 0}
                actual_by_key[key]["actual_qty"] += qty
    
    # Combine forecast and actual
    all_keys = set(forecast_by_key.keys()) | set(actual_by_key.keys())
    
    comparison = []
    for key in all_keys:
        fc = forecast_by_key.get(key, {})
        ac = actual_by_key.get(key, {})
        
        forecast_qty = fc.get("forecast_qty", 0)
        actual_qty = ac.get("actual_qty", 0)
        variance = actual_qty - forecast_qty
        variance_pct = (variance / forecast_qty * 100) if forecast_qty > 0 else 0
        
        comparison.append({
            "sku_id": fc.get("sku_id") or ac.get("sku_id"),
            "buyer": fc.get("buyer") or ac.get("buyer"),
            "forecast_qty": forecast_qty,
            "actual_qty": actual_qty,
            "variance": variance,
            "variance_pct": round(variance_pct, 1),
            "status": "On Track" if abs(variance_pct) <= 10 else ("Over" if variance > 0 else "Under")
        })
    
    # Sort by absolute variance
    comparison.sort(key=lambda x: -abs(x["variance"]))
    
    # Summary stats
    total_forecast = sum(c["forecast_qty"] for c in comparison)
    total_actual = sum(c["actual_qty"] for c in comparison)
    overall_accuracy = (1 - abs(total_actual - total_forecast) / total_forecast * 100) if total_forecast > 0 else 0
    
    return {
        "summary": {
            "total_forecast": total_forecast,
            "total_actual": total_actual,
            "overall_variance": total_actual - total_forecast,
            "overall_accuracy_pct": round(max(0, overall_accuracy), 1),
            "items_on_track": len([c for c in comparison if c["status"] == "On Track"]),
            "items_over": len([c for c in comparison if c["status"] == "Over"]),
            "items_under": len([c for c in comparison if c["status"] == "Under"])
        },
        "detailed_records": comparison[:200],
        "total_records": len(comparison)
    }


@router.get("/buyer-dispatch-history")
async def get_buyer_dispatch_history(
    buyer_id: Optional[str] = None,
    buyer_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Report: Buyer/Customer Dispatch History
    Shows dispatch history grouped by buyer/customer.
    """
    # Get all dispatch lots
    query = {"status": {"$in": ["DISPATCHED", "DELIVERED"]}}
    
    if start_date or end_date:
        query["dispatched_at"] = {}
        if start_date:
            query["dispatched_at"]["$gte"] = start_date
        if end_date:
            query["dispatched_at"]["$lte"] = end_date
    
    dispatches = await db.dispatch_lots.find(query, {"_id": 0}).to_list(5000)
    
    # Aggregate by buyer
    by_buyer = {}  # {buyer_key: {name, dispatches, total_qty, total_lots, skus}}
    
    for dispatch in dispatches:
        buyer_key = dispatch.get("buyer_id") or dispatch.get("buyer_code") or dispatch.get("buyer_name") or "Unknown"
        buyer_display = dispatch.get("buyer_name") or dispatch.get("buyer_code") or buyer_key
        
        # Filter by buyer if specified
        if buyer_id and buyer_key != buyer_id:
            continue
        if buyer_name and buyer_name.lower() not in buyer_display.lower():
            continue
        
        if buyer_key not in by_buyer:
            by_buyer[buyer_key] = {
                "buyer_id": buyer_key,
                "buyer_name": buyer_display,
                "total_lots": 0,
                "total_quantity": 0,
                "skus": {},
                "recent_dispatches": []
            }
        
        by_buyer[buyer_key]["total_lots"] += 1
        
        # Process line items
        lot_qty = 0
        for line in dispatch.get("line_items", []):
            sku = line.get("sku_id") or line.get("bidso_sku_id") or line.get("buyer_sku_id")
            qty = line.get("quantity", 0)
            lot_qty += qty
            
            if sku:
                if sku not in by_buyer[buyer_key]["skus"]:
                    by_buyer[buyer_key]["skus"][sku] = 0
                by_buyer[buyer_key]["skus"][sku] += qty
        
        by_buyer[buyer_key]["total_quantity"] += lot_qty
        
        # Add to recent dispatches (keep last 10)
        by_buyer[buyer_key]["recent_dispatches"].append({
            "lot_id": dispatch.get("lot_number") or dispatch.get("id"),
            "dispatched_at": dispatch.get("dispatched_at"),
            "quantity": lot_qty,
            "dispatch_from": dispatch.get("branch") or dispatch.get("dispatch_from"),
            "status": dispatch.get("status")
        })
        by_buyer[buyer_key]["recent_dispatches"] = by_buyer[buyer_key]["recent_dispatches"][-10:]
    
    # Format summary
    summary = []
    for buyer_key, data in by_buyer.items():
        top_skus = sorted(data["skus"].items(), key=lambda x: -x[1])[:5]
        summary.append({
            "buyer_id": data["buyer_id"],
            "buyer_name": data["buyer_name"],
            "total_lots": data["total_lots"],
            "total_quantity": data["total_quantity"],
            "unique_skus": len(data["skus"]),
            "top_skus": [{"sku_id": s[0], "quantity": s[1]} for s in top_skus],
            "recent_dispatches": data["recent_dispatches"]
        })
    
    summary.sort(key=lambda x: -x["total_quantity"])
    
    return {
        "summary": summary,
        "total_buyers": len(summary),
        "grand_total_quantity": sum(s["total_quantity"] for s in summary),
        "grand_total_lots": sum(s["total_lots"] for s in summary)
    }
