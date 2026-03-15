"""Demand routes - Forecasts, Dispatch Lots"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import io

from database import db

router = APIRouter(tags=["Demand"])

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'forecast_month' in doc and isinstance(doc['forecast_month'], str):
        doc['forecast_month'] = datetime.fromisoformat(doc['forecast_month'])
    if doc and 'target_date' in doc and isinstance(doc['target_date'], str):
        doc['target_date'] = datetime.fromisoformat(doc['target_date'])
    return doc

class ForecastCreate(BaseModel):
    buyer_id: str  # REQUIRED - no "All Buyers" option
    vertical_id: Optional[str] = None
    sku_id: Optional[str] = None
    forecast_month: datetime
    quantity: int
    priority: str = "MEDIUM"
    notes: str = ""


class BulkConfirmRequest(BaseModel):
    forecast_ids: List[str]

class DispatchLotCreate(BaseModel):
    forecast_id: Optional[str] = None
    sku_id: str
    buyer_id: Optional[str] = None
    required_quantity: int
    target_date: datetime
    priority: str = "MEDIUM"
    notes: Optional[str] = ""

# New model for multi-line dispatch lots
class DispatchLotLineInput(BaseModel):
    sku_id: str
    brand_id: Optional[str] = None
    vertical_id: Optional[str] = None
    quantity: int

class DispatchLotMultiCreate(BaseModel):
    buyer_id: str
    target_date: datetime
    priority: str = "MEDIUM"
    notes: Optional[str] = ""
    lines: List[DispatchLotLineInput]

# --- Forecasts ---
@router.get("/forecasts")
async def get_forecasts(
    buyer_id: Optional[str] = None,
    vertical_id: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if buyer_id:
        query["buyer_id"] = buyer_id
    if vertical_id:
        query["vertical_id"] = vertical_id
    if status:
        query["status"] = status
    forecasts = await db.forecasts.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(f) for f in forecasts]

@router.post("/forecasts")
async def create_forecast(data: ForecastCreate):
    count = await db.forecasts.count_documents({})
    forecast_code = f"FC_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    forecast = {
        "id": str(uuid.uuid4()),
        "forecast_code": forecast_code,
        "buyer_id": data.buyer_id,
        "vertical_id": data.vertical_id,
        "sku_id": data.sku_id,
        "forecast_month": data.forecast_month,
        "quantity": data.quantity,
        "priority": data.priority,
        "status": "DRAFT",
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.forecasts.insert_one(forecast)
    del forecast["_id"]
    return serialize_doc(forecast)

@router.put("/forecasts/{forecast_id}/confirm")
async def confirm_forecast(forecast_id: str):
    result = await db.forecasts.update_one(
        {"id": forecast_id, "status": "DRAFT"},
        {"$set": {"status": "CONFIRMED", "confirmed_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Forecast not found or not in DRAFT status")
    return {"message": "Forecast confirmed"}

# --- Dispatch Lots ---
@router.get("/dispatch-lots")
async def get_dispatch_lots(
    buyer_id: Optional[str] = None,
    sku_id: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if buyer_id:
        query["buyer_id"] = buyer_id
    if sku_id:
        query["sku_id"] = sku_id
    if status:
        query["status"] = status
    lots = await db.dispatch_lots.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(l) for l in lots]

@router.post("/dispatch-lots")
async def create_dispatch_lot(data: DispatchLotCreate):
    count = await db.dispatch_lots.count_documents({})
    lot_code = f"DL_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    lot = {
        "id": str(uuid.uuid4()),
        "lot_code": lot_code,
        "forecast_id": data.forecast_id,
        "sku_id": data.sku_id,
        "buyer_id": data.buyer_id,
        "required_quantity": data.required_quantity,
        "produced_quantity": 0,
        "qc_passed_quantity": 0,
        "dispatched_quantity": 0,
        "target_date": data.target_date,
        "status": "CREATED",
        "priority": data.priority,
        "created_at": datetime.now(timezone.utc)
    }
    await db.dispatch_lots.insert_one(lot)
    del lot["_id"]
    return serialize_doc(lot)

@router.put("/dispatch-lots/{lot_id}/status")
async def update_dispatch_lot_status(lot_id: str, status: str):
    valid_statuses = ["CREATED", "PRODUCTION_ASSIGNED", "PARTIALLY_PRODUCED", "FULLY_PRODUCED", 
                     "QC_CLEARED", "DISPATCH_READY", "DISPATCHED", "DELIVERED"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")
    
    result = await db.dispatch_lots.update_one(
        {"id": lot_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dispatch lot not found")
    return {"message": f"Status updated to {status}"}


# --- Dispatch Lot Cascade Filter Endpoints ---

@router.get("/dispatch-lots/buyers-with-forecasts")
async def get_buyers_with_forecasts():
    """Get only buyers who have confirmed forecasts"""
    # Get unique buyer_ids from confirmed forecasts
    forecasts = await db.forecasts.find(
        {"status": {"$in": ["CONFIRMED", "CONVERTED"]}, "buyer_id": {"$ne": None}},
        {"buyer_id": 1, "_id": 0}
    ).to_list(1000)
    
    buyer_ids = list(set(f["buyer_id"] for f in forecasts if f.get("buyer_id")))
    
    if not buyer_ids:
        return []
    
    # Get buyer details
    buyers = await db.buyers.find(
        {"id": {"$in": buyer_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return buyers


@router.get("/dispatch-lots/brands-by-buyer")
async def get_brands_by_buyer(buyer_id: str):
    """Get brands linked to the buyer"""
    # First get brands directly linked to buyer
    brands = await db.brands.find(
        {"buyer_id": buyer_id, "status": "ACTIVE"},
        {"_id": 0}
    ).to_list(100)
    
    # Also get brands from SKUs that have forecasts for this buyer
    forecasts = await db.forecasts.find(
        {"buyer_id": buyer_id, "status": {"$in": ["CONFIRMED", "CONVERTED"]}},
        {"sku_id": 1, "_id": 0}
    ).to_list(1000)
    
    sku_ids = [f["sku_id"] for f in forecasts if f.get("sku_id")]
    if sku_ids:
        skus = await db.skus.find(
            {"sku_id": {"$in": sku_ids}},
            {"brand_id": 1, "brand": 1, "_id": 0}
        ).to_list(1000)
        
        # Get unique brand_ids from forecasted SKUs
        brand_ids_from_skus = list(set(s.get("brand_id") for s in skus if s.get("brand_id")))
        if brand_ids_from_skus:
            additional_brands = await db.brands.find(
                {"id": {"$in": brand_ids_from_skus}, "status": "ACTIVE"},
                {"_id": 0}
            ).to_list(100)
            
            # Merge without duplicates
            existing_ids = {b["id"] for b in brands}
            for ab in additional_brands:
                if ab["id"] not in existing_ids:
                    brands.append(ab)
    
    return brands


@router.get("/dispatch-lots/verticals-by-buyer")
async def get_verticals_by_buyer(buyer_id: str, brand_id: Optional[str] = None):
    """Get verticals that have forecasted SKUs for this buyer (optionally filtered by brand)"""
    # Get forecasts for this buyer
    forecast_query = {"buyer_id": buyer_id, "status": {"$in": ["CONFIRMED", "CONVERTED"]}}
    forecasts = await db.forecasts.find(forecast_query, {"sku_id": 1, "vertical_id": 1, "_id": 0}).to_list(1000)
    
    vertical_ids = set()
    
    # Collect vertical IDs from forecasts
    for f in forecasts:
        if f.get("vertical_id"):
            vertical_ids.add(f["vertical_id"])
    
    # Also get verticals from forecasted SKUs
    sku_ids = [f["sku_id"] for f in forecasts if f.get("sku_id")]
    if sku_ids:
        sku_query = {"sku_id": {"$in": sku_ids}}
        if brand_id:
            sku_query["brand_id"] = brand_id
        
        skus = await db.skus.find(sku_query, {"vertical_id": 1, "_id": 0}).to_list(1000)
        for s in skus:
            if s.get("vertical_id"):
                vertical_ids.add(s["vertical_id"])
    
    if not vertical_ids:
        return []
    
    # Get vertical details
    verticals = await db.verticals.find(
        {"id": {"$in": list(vertical_ids)}, "status": "ACTIVE"},
        {"_id": 0}
    ).to_list(100)
    
    return verticals


@router.get("/dispatch-lots/forecasted-skus")
async def get_forecasted_skus(buyer_id: str, vertical_id: Optional[str] = None, brand_id: Optional[str] = None):
    """Get SKUs with confirmed forecasts for buyer, with available quantity"""
    # Get confirmed forecasts for this buyer
    forecast_query = {"buyer_id": buyer_id, "status": {"$in": ["CONFIRMED", "CONVERTED"]}}
    if vertical_id:
        forecast_query["vertical_id"] = vertical_id
    
    forecasts = await db.forecasts.find(forecast_query, {"_id": 0}).to_list(1000)
    
    # Get SKU-level forecasts
    sku_forecasts = {}
    vertical_forecasts = {}
    
    for f in forecasts:
        if f.get("sku_id"):
            if f["sku_id"] not in sku_forecasts:
                sku_forecasts[f["sku_id"]] = {"forecast_qty": 0, "forecast_ids": []}
            sku_forecasts[f["sku_id"]]["forecast_qty"] += f.get("quantity", 0)
            sku_forecasts[f["sku_id"]]["forecast_ids"].append(f.get("id"))
        elif f.get("vertical_id"):
            # Vertical-level forecast - will be distributed to SKUs
            if f["vertical_id"] not in vertical_forecasts:
                vertical_forecasts[f["vertical_id"]] = {"forecast_qty": 0, "forecast_ids": []}
            vertical_forecasts[f["vertical_id"]]["forecast_qty"] += f.get("quantity", 0)
            vertical_forecasts[f["vertical_id"]]["forecast_ids"].append(f.get("id"))
    
    # Get SKUs that match the criteria
    sku_query = {}
    if vertical_id:
        sku_query["vertical_id"] = vertical_id
    if brand_id:
        sku_query["brand_id"] = brand_id
    
    # Get SKUs either directly forecasted or in forecasted verticals
    forecasted_sku_ids = list(sku_forecasts.keys())
    forecasted_vertical_ids = list(vertical_forecasts.keys())
    
    if forecasted_sku_ids or forecasted_vertical_ids:
        or_conditions = []
        if forecasted_sku_ids:
            or_conditions.append({"sku_id": {"$in": forecasted_sku_ids}})
        if forecasted_vertical_ids:
            or_conditions.append({"vertical_id": {"$in": forecasted_vertical_ids}})
        
        if sku_query:
            sku_query["$and"] = [{"$or": or_conditions}]
        else:
            sku_query = {"$or": or_conditions}
    
    skus = await db.skus.find(sku_query, {"_id": 0}).to_list(1000)
    
    # Apply brand filter if specified
    if brand_id:
        skus = [s for s in skus if s.get("brand_id") == brand_id]
    
    # Get existing dispatch lot quantities
    dispatch_lots = await db.dispatch_lots.find(
        {"buyer_id": buyer_id, "status": {"$ne": "CANCELLED"}},
        {"sku_id": 1, "required_quantity": 1, "_id": 0}
    ).to_list(1000)
    
    # Also get from dispatch_lot_lines
    lot_lines = await db.dispatch_lot_lines.find(
        {},
        {"sku_id": 1, "quantity": 1, "_id": 0}
    ).to_list(5000)
    
    dispatched_by_sku = {}
    for lot in dispatch_lots:
        sku = lot.get("sku_id")
        if sku:
            dispatched_by_sku[sku] = dispatched_by_sku.get(sku, 0) + lot.get("required_quantity", 0)
    
    for line in lot_lines:
        sku = line.get("sku_id")
        if sku:
            dispatched_by_sku[sku] = dispatched_by_sku.get(sku, 0) + line.get("quantity", 0)
    
    # Build result with available quantities
    result = []
    for sku in skus:
        sku_id = sku.get("sku_id")
        
        # Calculate forecast qty (direct SKU forecast + vertical forecast share)
        forecast_qty = 0
        if sku_id in sku_forecasts:
            forecast_qty = sku_forecasts[sku_id]["forecast_qty"]
        elif sku.get("vertical_id") in vertical_forecasts:
            # For vertical-level forecasts, show the vertical total
            forecast_qty = vertical_forecasts[sku["vertical_id"]]["forecast_qty"]
        
        if forecast_qty == 0:
            continue
        
        dispatched_qty = dispatched_by_sku.get(sku_id, 0)
        available_qty = max(0, forecast_qty - dispatched_qty)
        
        result.append({
            "sku_id": sku_id,
            "description": sku.get("description", ""),
            "brand": sku.get("brand", ""),
            "brand_id": sku.get("brand_id"),
            "vertical": sku.get("vertical", ""),
            "vertical_id": sku.get("vertical_id"),
            "model": sku.get("model", ""),
            "forecast_qty": forecast_qty,
            "dispatched_qty": dispatched_qty,
            "available_qty": available_qty
        })
    
    return result


@router.post("/dispatch-lots/multi")
async def create_dispatch_lot_multi(data: DispatchLotMultiCreate):
    """Create a dispatch lot with multiple SKU lines"""
    if not data.lines:
        raise HTTPException(status_code=400, detail="At least one line item is required")
    
    if not data.buyer_id:
        raise HTTPException(status_code=400, detail="Buyer is required")
    
    # Verify buyer exists
    buyer = await db.buyers.find_one({"id": data.buyer_id})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    # Generate lot code
    count = await db.dispatch_lots.count_documents({})
    lot_code = f"DL_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    # Calculate total quantity
    total_quantity = sum(line.quantity for line in data.lines)
    
    # Create main dispatch lot record
    lot_id = str(uuid.uuid4())
    lot = {
        "id": lot_id,
        "lot_code": lot_code,
        "buyer_id": data.buyer_id,
        "target_date": data.target_date,
        "priority": data.priority,
        "notes": data.notes or "",
        "status": "CREATED",
        "total_quantity": total_quantity,
        "total_produced": 0,
        "total_dispatched": 0,
        "line_count": len(data.lines),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.dispatch_lots.insert_one(lot)
    
    # Create line items
    lines_created = []
    for idx, line in enumerate(data.lines):
        line_record = {
            "id": str(uuid.uuid4()),
            "lot_id": lot_id,
            "lot_code": lot_code,
            "line_number": idx + 1,
            "sku_id": line.sku_id,
            "brand_id": line.brand_id,
            "vertical_id": line.vertical_id,
            "quantity": line.quantity,
            "produced_qty": 0,
            "dispatched_qty": 0,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc)
        }
        await db.dispatch_lot_lines.insert_one(line_record)
        del line_record["_id"]
        lines_created.append(line_record)
    
    del lot["_id"]
    lot["lines"] = lines_created
    
    return serialize_doc(lot)


@router.get("/dispatch-lots/{lot_id}/lines")
async def get_dispatch_lot_lines(lot_id: str):
    """Get line items for a dispatch lot"""
    lines = await db.dispatch_lot_lines.find(
        {"lot_id": lot_id},
        {"_id": 0}
    ).to_list(1000)
    return [serialize_doc(l) for l in lines]


@router.get("/dispatch-lots/{lot_id}/details")
async def get_dispatch_lot_details(lot_id: str):
    """Get dispatch lot with full details including readiness status"""
    # Get the lot
    lot = await db.dispatch_lots.find_one({"id": lot_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Dispatch lot not found")
    
    # Get buyer info
    buyer = None
    if lot.get("buyer_id"):
        buyer = await db.buyers.find_one({"id": lot["buyer_id"]}, {"_id": 0, "name": 1, "code": 1})
    
    # Get lines for this lot
    lines = await db.dispatch_lot_lines.find(
        {"lot_id": lot_id},
        {"_id": 0}
    ).to_list(1000)
    
    # If no lines collection, check if it's old format (single SKU per lot)
    if not lines and lot.get("sku_id"):
        lines = [{
            "id": str(uuid.uuid4()),
            "lot_id": lot_id,
            "line_number": 1,
            "sku_id": lot["sku_id"],
            "quantity": lot.get("required_quantity", 0),
            "produced_qty": lot.get("produced_quantity", 0),
            "dispatched_qty": lot.get("dispatched_quantity", 0),
            "status": "PENDING"
        }]
    
    # Get SKU details and inventory for readiness calculation
    sku_ids = [line.get("sku_id") for line in lines if line.get("sku_id")]
    skus = await db.skus.find({"sku_id": {"$in": sku_ids}}, {"_id": 0}).to_list(1000)
    sku_map = {s["sku_id"]: s for s in skus}
    
    # Get FG inventory for these SKUs (sum across all branches)
    fg_inventory = await db.fg_inventory.find(
        {"sku_id": {"$in": sku_ids}, "status": "AVAILABLE"},
        {"sku_id": 1, "quantity": 1, "_id": 0}
    ).to_list(5000)
    
    # Also check production batches for produced quantity
    production_batches = await db.production_batches.find(
        {"sku_id": {"$in": sku_ids}, "status": {"$in": ["COMPLETED", "QC_PASSED", "FG_READY"]}},
        {"sku_id": 1, "good_quantity": 1, "_id": 0}
    ).to_list(5000)
    
    # Sum inventory by SKU
    inventory_by_sku = {}
    for inv in fg_inventory:
        sku = inv.get("sku_id")
        inventory_by_sku[sku] = inventory_by_sku.get(sku, 0) + inv.get("quantity", 0)
    
    # Add produced quantity from batches
    for batch in production_batches:
        sku = batch.get("sku_id")
        inventory_by_sku[sku] = inventory_by_sku.get(sku, 0) + batch.get("good_quantity", 0)
    
    # Also check SKU current_stock if no FG inventory
    for sku_id in sku_ids:
        if sku_id not in inventory_by_sku or inventory_by_sku[sku_id] == 0:
            sku_data = sku_map.get(sku_id, {})
            inventory_by_sku[sku_id] = sku_data.get("current_stock", 0)
    
    # Calculate readiness for each line
    lines_with_readiness = []
    total_ready = 0
    total_pending = 0
    
    for line in lines:
        sku_id = line.get("sku_id")
        sku_data = sku_map.get(sku_id, {})
        required_qty = line.get("quantity", 0)
        available_qty = inventory_by_sku.get(sku_id, 0)
        
        # Calculate readiness
        ready_qty = min(required_qty, available_qty)
        pending_qty = max(0, required_qty - available_qty)
        
        readiness_pct = (ready_qty / required_qty * 100) if required_qty > 0 else 0
        
        if readiness_pct >= 100:
            readiness_status = "READY"
            total_ready += 1
        elif readiness_pct > 0:
            readiness_status = "PARTIAL"
        else:
            readiness_status = "PENDING"
            total_pending += 1
        
        lines_with_readiness.append({
            **line,
            "sku_description": sku_data.get("description", ""),
            "brand": sku_data.get("brand", ""),
            "vertical": sku_data.get("vertical", ""),
            "model": sku_data.get("model", ""),
            "available_qty": available_qty,
            "ready_qty": ready_qty,
            "pending_qty": pending_qty,
            "readiness_pct": round(readiness_pct, 1),
            "readiness_status": readiness_status
        })
    
    # Calculate overall lot readiness
    total_lines = len(lines_with_readiness)
    if total_lines == 0:
        lot_readiness = "EMPTY"
        lot_readiness_pct = 0
    elif total_ready == total_lines:
        lot_readiness = "READY"
        lot_readiness_pct = 100
    elif total_ready > 0:
        lot_readiness = "PARTIAL"
        lot_readiness_pct = round(total_ready / total_lines * 100, 1)
    else:
        lot_readiness = "PENDING"
        lot_readiness_pct = 0
    
    return {
        **serialize_doc(lot),
        "buyer_name": buyer.get("name") if buyer else None,
        "buyer_code": buyer.get("code") if buyer else None,
        "lines": lines_with_readiness,
        "readiness_status": lot_readiness,
        "readiness_pct": lot_readiness_pct,
        "ready_lines": total_ready,
        "pending_lines": total_pending,
        "total_lines": total_lines
    }


@router.get("/dispatch-lots/with-readiness")
async def get_dispatch_lots_with_readiness(
    buyer_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all dispatch lots with readiness status"""
    query = {}
    if buyer_id:
        query["buyer_id"] = buyer_id
    if status:
        query["status"] = status
    
    lots = await db.dispatch_lots.find(query, {"_id": 0}).to_list(1000)
    
    # Get all lot IDs
    lot_ids = [lot.get("id") for lot in lots]
    
    # Get all lines for these lots
    all_lines = await db.dispatch_lot_lines.find(
        {"lot_id": {"$in": lot_ids}},
        {"_id": 0}
    ).to_list(10000)
    
    # Group lines by lot_id
    lines_by_lot = {}
    for line in all_lines:
        lot_id = line.get("lot_id")
        if lot_id not in lines_by_lot:
            lines_by_lot[lot_id] = []
        lines_by_lot[lot_id].append(line)
    
    # Get all unique SKU IDs
    sku_ids = set()
    for lot in lots:
        if lot.get("sku_id"):
            sku_ids.add(lot["sku_id"])
    for line in all_lines:
        if line.get("sku_id"):
            sku_ids.add(line["sku_id"])
    
    sku_ids = list(sku_ids)
    
    # Get SKU current stock
    skus = await db.skus.find({"sku_id": {"$in": sku_ids}}, {"_id": 0, "sku_id": 1, "current_stock": 1}).to_list(5000)
    stock_by_sku = {s["sku_id"]: s.get("current_stock", 0) for s in skus}
    
    # Get FG inventory
    fg_inventory = await db.fg_inventory.find(
        {"sku_id": {"$in": sku_ids}, "status": "AVAILABLE"},
        {"sku_id": 1, "quantity": 1, "_id": 0}
    ).to_list(10000)
    
    for inv in fg_inventory:
        sku = inv.get("sku_id")
        stock_by_sku[sku] = stock_by_sku.get(sku, 0) + inv.get("quantity", 0)
    
    # Get buyer names
    buyer_ids = list(set(lot.get("buyer_id") for lot in lots if lot.get("buyer_id")))
    buyers = await db.buyers.find({"id": {"$in": buyer_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    buyer_map = {b["id"]: b["name"] for b in buyers}
    
    # Calculate readiness for each lot
    result = []
    for lot in lots:
        lot_id = lot.get("id")
        lines = lines_by_lot.get(lot_id, [])
        
        # For old format lots
        if not lines and lot.get("sku_id"):
            lines = [{
                "sku_id": lot["sku_id"],
                "quantity": lot.get("required_quantity", 0)
            }]
        
        ready_count = 0
        total_count = len(lines)
        
        for line in lines:
            sku_id = line.get("sku_id")
            required = line.get("quantity", 0)
            available = stock_by_sku.get(sku_id, 0)
            
            if available >= required and required > 0:
                ready_count += 1
        
        if total_count == 0:
            readiness = "EMPTY"
            readiness_pct = 0
        elif ready_count == total_count:
            readiness = "READY"
            readiness_pct = 100
        elif ready_count > 0:
            readiness = "PARTIAL"
            readiness_pct = round(ready_count / total_count * 100, 1)
        else:
            readiness = "PENDING"
            readiness_pct = 0
        
        result.append({
            **serialize_doc(lot),
            "buyer_name": buyer_map.get(lot.get("buyer_id")),
            "readiness_status": readiness,
            "readiness_pct": readiness_pct,
            "ready_lines": ready_count,
            "total_lines": total_count
        })
    
    return result


# --- Bulk Upload ---
@router.post("/forecasts/parse-excel")
async def parse_forecast_excel(file: UploadFile = File(...)):
    """Parse Excel/CSV file for bulk forecast upload"""
    import openpyxl
    import csv
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    contents = await file.read()
    forecasts = []
    
    try:
        if file.filename.endswith('.csv'):
            # Parse CSV
            text = contents.decode('utf-8')
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                forecasts.append({
                    "month": row.get('Month', row.get('month', '')),
                    "vertical": row.get('Vertical', row.get('vertical', '')),
                    "model": row.get('Model', row.get('model', '')),
                    "brand": row.get('Brand', row.get('brand', '')),
                    "sku_id": row.get('SKU', row.get('sku', row.get('sku_id', ''))),
                    "quantity": int(row.get('Qty', row.get('qty', row.get('quantity', 0))) or 0)
                })
        else:
            # Parse Excel
            wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True)
            ws = wb.active
            
            headers = []
            for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if row_idx == 0:
                    # Header row
                    headers = [str(h).lower() if h else '' for h in row]
                    continue
                
                if not any(row):
                    continue
                
                row_data = dict(zip(headers, row))
                forecasts.append({
                    "month": str(row_data.get('month', '')),
                    "vertical": str(row_data.get('vertical', '')),
                    "model": str(row_data.get('model', '')),
                    "brand": str(row_data.get('brand', '')),
                    "sku_id": str(row_data.get('sku', row_data.get('sku_id', ''))),
                    "quantity": int(row_data.get('qty', row_data.get('quantity', 0)) or 0)
                })
            wb.close()
        
        # Validate and enrich data
        verticals_list = await db.verticals.find({}, {"_id": 0}).to_list(100)
        vertical_map = {v['name'].lower(): v['id'] for v in verticals_list}
        
        for f in forecasts:
            v_name = f.get('vertical', '').lower()
            f['vertical_id'] = vertical_map.get(v_name)
        
        return {"forecasts": forecasts, "count": len(forecasts)}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
