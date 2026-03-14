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

@router.get("/ibt-transfers")
async def get_ibt_transfers(
    from_branch: Optional[str] = None,
    to_branch: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get inter-branch transfers"""
    query = {}
    
    if from_branch:
        query["from_branch"] = from_branch
    if to_branch:
        query["to_branch"] = to_branch
    if status:
        query["status"] = status
    
    # Filter by user's branches if not master admin
    if current_user.role != "master_admin":
        query["$or"] = [
            {"from_branch": {"$in": current_user.assigned_branches}},
            {"to_branch": {"$in": current_user.assigned_branches}}
        ]
    
    transfers = await db.ibt_transfers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    return transfers


@router.post("/ibt-transfers")
async def create_ibt_transfer(
    from_branch: str,
    to_branch: str,
    rm_id: str,
    quantity: float,
    notes: str = "",
    current_user: User = Depends(get_current_user)
):
    """Create an inter-branch transfer request"""
    check_branch_access(current_user, from_branch)
    
    # Generate transfer code
    now = datetime.now(timezone.utc)
    prefix = f"IBT_{now.strftime('%Y%m%d')}"
    count = await db.ibt_transfers.count_documents({"transfer_code": {"$regex": f"^{prefix}"}})
    transfer_code = f"{prefix}_{count + 1:04d}"
    
    transfer = {
        "id": str(__import__('uuid').uuid4()),
        "transfer_code": transfer_code,
        "from_branch": from_branch,
        "to_branch": to_branch,
        "rm_id": rm_id,
        "quantity": quantity,
        "status": "PENDING",
        "notes": notes,
        "requested_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ibt_transfers.insert_one(transfer)
    
    return {"message": "IBT transfer created", "transfer": {k: v for k, v in transfer.items() if k != '_id'}}


@router.put("/ibt-transfers/{transfer_id}/approve")
async def approve_ibt_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    """Approve an IBT transfer"""
    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "APPROVED", "approved_by": current_user.id, "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Transfer approved"}


@router.put("/ibt-transfers/{transfer_id}/ship")
async def ship_ibt_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    """Ship an IBT transfer - deducts from source branch"""
    from services.utils import update_branch_rm_inventory, generate_movement_code, get_branch_rm_stock
    
    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    check_branch_access(current_user, transfer["from_branch"])
    
    # Deduct from source branch
    current_stock = await get_branch_rm_stock(transfer["from_branch"], transfer["rm_id"])
    await update_branch_rm_inventory(transfer["from_branch"], transfer["rm_id"], -transfer["quantity"])
    
    # Record movement
    movement_code = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(__import__('uuid').uuid4()),
        "movement_code": movement_code,
        "rm_id": transfer["rm_id"],
        "branch": transfer["from_branch"],
        "movement_type": "IBT_OUT",
        "quantity": -transfer["quantity"],
        "reference_type": "IBT_TRANSFER",
        "reference_id": transfer_id,
        "balance_after": current_stock - transfer["quantity"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "IN_TRANSIT", "shipped_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Transfer shipped"}


@router.put("/ibt-transfers/{transfer_id}/receive")
async def receive_ibt_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    """Receive an IBT transfer - adds to destination branch"""
    from services.utils import update_branch_rm_inventory, generate_movement_code, get_branch_rm_stock
    
    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    check_branch_access(current_user, transfer["to_branch"])
    
    # Add to destination branch
    current_stock = await get_branch_rm_stock(transfer["to_branch"], transfer["rm_id"])
    await update_branch_rm_inventory(transfer["to_branch"], transfer["rm_id"], transfer["quantity"])
    
    # Record movement
    movement_code = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(__import__('uuid').uuid4()),
        "movement_code": movement_code,
        "rm_id": transfer["rm_id"],
        "branch": transfer["to_branch"],
        "movement_type": "IBT_IN",
        "quantity": transfer["quantity"],
        "reference_type": "IBT_TRANSFER",
        "reference_id": transfer_id,
        "balance_after": current_stock + transfer["quantity"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "COMPLETED", "received_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Publish IBT_COMPLETED event
    from services.event_system import event_bus, EventType
    await event_bus.publish(
        EventType.IBT_COMPLETED,
        {
            "transfer_id": transfer_id,
            "transfer_code": transfer.get("transfer_code"),
            "from_branch": transfer["from_branch"],
            "to_branch": transfer["to_branch"],
            "rm_id": transfer["rm_id"],
            "quantity": transfer["quantity"],
            "received_by": current_user.id
        },
        source_module="logistics"
    )
    
    return {"message": "Transfer received"}
