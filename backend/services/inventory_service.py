"""Inventory service - stock management functions"""
from datetime import datetime, timezone
import random
import uuid

from database import db


async def generate_movement_code() -> str:
    """Generate unique movement code"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_suffix = random.randint(1000, 9999)
    return f"MV_{timestamp}_{random_suffix}"


async def get_branch_rm_stock(branch: str, rm_id: str) -> float:
    """Get current stock of an RM in a branch"""
    inv = await db.branch_rm_inventory.find_one({"branch": branch, "rm_id": rm_id})
    if inv:
        return inv.get("current_stock", 0)
    return 0


async def get_current_rm_price(rm_id: str, branch: str = None) -> float:
    """Get current price of an RM (from vendor pricing or default)"""
    # Get lowest vendor price
    prices = await db.vendor_rm_prices.find({"rm_id": rm_id}).to_list(100)
    if prices:
        return min(p.get("price", 0) for p in prices)
    return 0


async def update_branch_rm_inventory(branch: str, rm_id: str, quantity_change: float):
    """Update branch RM inventory by adding/subtracting quantity"""
    inv = await db.branch_rm_inventory.find_one({"branch": branch, "rm_id": rm_id})
    if inv:
        new_stock = inv.get("current_stock", 0) + quantity_change
        await db.branch_rm_inventory.update_one(
            {"branch": branch, "rm_id": rm_id},
            {"$set": {"current_stock": new_stock}}
        )
    else:
        # Create new inventory record
        await db.branch_rm_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "rm_id": rm_id,
            "branch": branch,
            "current_stock": quantity_change,
            "is_active": True,
            "activated_at": datetime.now(timezone.utc)
        })
