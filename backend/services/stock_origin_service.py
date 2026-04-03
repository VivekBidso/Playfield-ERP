"""
Stock Origin Tracking Service

Handles manufacturing origin tracking for finished goods (FG/SKU) inventory.
Uses FIFO allocation to track where goods were manufactured as they move
through IBT and dispatch operations.

Collections:
- stock_origin_ledger: Tracks stock with manufacturing origin
"""
from datetime import datetime, timezone
from typing import List, Dict, Optional
import uuid

from database import db


async def create_origin_entry(
    sku_id: str,
    branch: str,
    quantity: int,
    manufacturing_unit: str,
    production_date: datetime,
    production_schedule_id: Optional[str] = None
) -> dict:
    """
    Create a stock origin entry when production is completed.
    Called when a production schedule is marked as complete.
    """
    entry = {
        "id": str(uuid.uuid4()),
        "sku_id": sku_id,
        "branch": branch,
        "manufacturing_unit": manufacturing_unit,
        "production_date": production_date.isoformat() if isinstance(production_date, datetime) else production_date,
        "arrival_date": datetime.now(timezone.utc).isoformat(),
        "quantity": quantity,
        "available_qty": quantity,
        "production_schedule_id": production_schedule_id,
        "status": "AVAILABLE",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.stock_origin_ledger.insert_one(entry)
    return entry


async def get_available_stock_by_origin(sku_id: str, branch: str) -> List[dict]:
    """
    Get available stock for a SKU at a branch, grouped by manufacturing origin.
    Returns list sorted by arrival_date (FIFO order).
    """
    entries = await db.stock_origin_ledger.find(
        {
            "sku_id": sku_id,
            "branch": branch,
            "available_qty": {"$gt": 0},
            "status": "AVAILABLE"
        },
        {"_id": 0}
    ).sort("arrival_date", 1).to_list(1000)
    
    return entries


async def get_total_available_qty(sku_id: str, branch: str) -> int:
    """Get total available quantity for a SKU at a branch."""
    pipeline = [
        {
            "$match": {
                "sku_id": sku_id,
                "branch": branch,
                "available_qty": {"$gt": 0},
                "status": "AVAILABLE"
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$available_qty"}
            }
        }
    ]
    result = await db.stock_origin_ledger.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def allocate_stock_fifo(
    sku_id: str,
    branch: str,
    quantity: int,
    purpose: str = "DISPATCH"
) -> List[Dict]:
    """
    Allocate stock using FIFO method and return origin breakdown.
    
    Args:
        sku_id: SKU to allocate
        branch: Branch to allocate from
        quantity: Quantity to allocate
        purpose: DISPATCH or IBT_OUT
    
    Returns:
        List of allocations with origin info:
        [
            {"manufacturing_unit": "Unit 6", "quantity": 30, "production_date": "2026-03-28"},
            {"manufacturing_unit": "Unit 2", "quantity": 20, "production_date": "2026-03-29"}
        ]
    """
    entries = await get_available_stock_by_origin(sku_id, branch)
    
    if not entries:
        return []
    
    allocations = []
    remaining = quantity
    
    for entry in entries:
        if remaining <= 0:
            break
        
        available = entry["available_qty"]
        to_allocate = min(available, remaining)
        
        # Deduct from this entry
        new_available = available - to_allocate
        await db.stock_origin_ledger.update_one(
            {"id": entry["id"]},
            {"$set": {"available_qty": new_available}}
        )
        
        allocations.append({
            "origin_entry_id": entry["id"],
            "manufacturing_unit": entry["manufacturing_unit"],
            "production_date": entry["production_date"],
            "quantity": to_allocate
        })
        
        remaining -= to_allocate
    
    return allocations


async def transfer_stock_with_origin(
    sku_id: str,
    source_branch: str,
    destination_branch: str,
    quantity: int,
    ibt_id: Optional[str] = None
) -> List[Dict]:
    """
    Transfer stock between branches while preserving manufacturing origin.
    Uses FIFO to select which stock to transfer.
    
    Returns origin breakdown of transferred stock.
    """
    entries = await get_available_stock_by_origin(sku_id, source_branch)
    
    if not entries:
        return []
    
    transferred = []
    remaining = quantity
    
    for entry in entries:
        if remaining <= 0:
            break
        
        available = entry["available_qty"]
        to_transfer = min(available, remaining)
        
        # Deduct from source
        new_available = available - to_transfer
        await db.stock_origin_ledger.update_one(
            {"id": entry["id"]},
            {"$set": {"available_qty": new_available}}
        )
        
        # Create new entry at destination with same origin
        new_entry = {
            "id": str(uuid.uuid4()),
            "sku_id": sku_id,
            "branch": destination_branch,
            "manufacturing_unit": entry["manufacturing_unit"],  # Preserved!
            "production_date": entry["production_date"],  # Preserved!
            "arrival_date": datetime.now(timezone.utc).isoformat(),
            "quantity": to_transfer,
            "available_qty": to_transfer,
            "production_schedule_id": entry.get("production_schedule_id"),
            "source_entry_id": entry["id"],
            "ibt_id": ibt_id,
            "status": "AVAILABLE",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.stock_origin_ledger.insert_one(new_entry)
        
        transferred.append({
            "manufacturing_unit": entry["manufacturing_unit"],
            "production_date": entry["production_date"],
            "quantity": to_transfer
        })
        
        remaining -= to_transfer
    
    return transferred


async def get_origin_summary_for_branch(branch: str) -> List[Dict]:
    """
    Get stock summary grouped by SKU and manufacturing origin for a branch.
    Useful for reports.
    """
    pipeline = [
        {
            "$match": {
                "branch": branch,
                "available_qty": {"$gt": 0},
                "status": "AVAILABLE"
            }
        },
        {
            "$group": {
                "_id": {
                    "sku_id": "$sku_id",
                    "manufacturing_unit": "$manufacturing_unit"
                },
                "total_qty": {"$sum": "$available_qty"},
                "earliest_production": {"$min": "$production_date"}
            }
        },
        {
            "$sort": {"_id.sku_id": 1, "earliest_production": 1}
        }
    ]
    
    results = await db.stock_origin_ledger.aggregate(pipeline).to_list(1000)
    
    return [
        {
            "sku_id": r["_id"]["sku_id"],
            "manufacturing_unit": r["_id"]["manufacturing_unit"],
            "available_qty": r["total_qty"],
            "earliest_production": r["earliest_production"]
        }
        for r in results
    ]


async def format_origin_breakdown(allocations: List[Dict]) -> str:
    """
    Format origin breakdown for display.
    Example: "Unit 6 (30), Unit 2 (20)"
    """
    if not allocations:
        return "-"
    
    # Group by manufacturing unit
    by_unit = {}
    for alloc in allocations:
        unit = alloc["manufacturing_unit"]
        qty = alloc["quantity"]
        by_unit[unit] = by_unit.get(unit, 0) + qty
    
    return ", ".join([f"{unit} ({qty})" for unit, qty in by_unit.items()])
