"""
Admin Routes - System administration endpoints
Requires master_admin role for all operations
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from datetime import datetime, timezone
from typing import Optional
import logging

from models.auth import User
from services.auth_service import get_current_user
from database import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_master_admin(current_user: User = Depends(get_current_user)):
    """Dependency to ensure only master_admin can access"""
    if current_user.role != "master_admin":
        raise HTTPException(
            status_code=403, 
            detail="This operation requires master_admin privileges"
        )
    return current_user


@router.post("/cleanup-transactional-data")
async def cleanup_transactional_data(
    confirm: str = Body(..., embed=True),
    current_user: User = Depends(require_master_admin)
):
    """
    Clean up all transactional/test data from the system.
    Preserves master data (SKUs, Models, Brands, Buyers, RMs, Vendors, BOMs, etc.)
    
    Requires: confirm = "CONFIRM_CLEANUP"
    """
    
    if confirm != "CONFIRM_CLEANUP":
        raise HTTPException(
            status_code=400,
            detail="Invalid confirmation. Send confirm='CONFIRM_CLEANUP' to proceed."
        )
    
    logger.warning(f"DATA CLEANUP initiated by {current_user.email} at {datetime.now(timezone.utc)}")
    
    results = {
        "initiated_by": current_user.email,
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "collections_cleaned": {},
        "total_deleted": 0
    }
    
    # Collections to clean (transactional data only)
    collections_to_clean = [
        "forecasts",
        "forecast_lines",
        "dispatch_lots",
        "dispatch_lot_lines",
        "production_schedules",
        "production_schedule_lines",
        "mrp_runs",
        "mrp_results",
        "mrp_weekly_plans",
        "mrp_draft_pos",
        "purchase_orders",
        "purchase_order_lines",
        "invoices",
        "goods_received_notes",
        "stock_movements",
    ]
    
    for collection_name in collections_to_clean:
        try:
            collection = db[collection_name]
            count_before = await collection.count_documents({})
            result = await collection.delete_many({})
            deleted = result.deleted_count
            
            results["collections_cleaned"][collection_name] = {
                "before": count_before,
                "deleted": deleted
            }
            results["total_deleted"] += deleted
            
            logger.info(f"Cleaned {collection_name}: {deleted} records deleted")
            
        except Exception as e:
            logger.error(f"Error cleaning {collection_name}: {str(e)}")
            results["collections_cleaned"][collection_name] = {
                "error": str(e)
            }
    
    # Log the cleanup action
    await db.audit_logs.insert_one({
        "action": "TRANSACTIONAL_DATA_CLEANUP",
        "performed_by": current_user.email,
        "performed_at": datetime.now(timezone.utc),
        "details": results
    })
    
    logger.warning(f"DATA CLEANUP completed. Total deleted: {results['total_deleted']}")
    
    return {
        "status": "success",
        "message": f"Cleanup complete. {results['total_deleted']} records deleted.",
        "details": results
    }


@router.get("/data-audit")
async def get_data_audit(
    current_user: User = Depends(require_master_admin)
):
    """
    Get a count of all records in transactional vs master data collections.
    Useful before running cleanup to see what will be deleted.
    """
    
    # Transactional collections (will be cleaned)
    transactional = {}
    transactional_collections = [
        "forecasts", "forecast_lines", "dispatch_lots", "dispatch_lot_lines",
        "production_schedules", "production_schedule_lines", "mrp_runs",
        "mrp_results", "mrp_weekly_plans", "mrp_draft_pos", "purchase_orders",
        "purchase_order_lines", "invoices", "goods_received_notes", "stock_movements"
    ]
    
    transactional_total = 0
    for coll in transactional_collections:
        count = await db[coll].count_documents({})
        transactional[coll] = count
        transactional_total += count
    
    # Master data collections (will be preserved)
    master = {}
    master_collections = [
        "buyer_skus", "models", "brands", "buyers", "verticals",
        "raw_materials", "vendors", "common_bom", "brand_specific_bom",
        "rm_procurement_parameters", "vendor_rm_prices", "users", "branches"
    ]
    
    master_total = 0
    for coll in master_collections:
        count = await db[coll].count_documents({})
        master[coll] = count
        master_total += count
    
    return {
        "transactional_data": {
            "collections": transactional,
            "total_records": transactional_total,
            "will_be_deleted": True
        },
        "master_data": {
            "collections": master,
            "total_records": master_total,
            "will_be_preserved": True
        }
    }
