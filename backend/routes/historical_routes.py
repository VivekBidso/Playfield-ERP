"""Historical Data Upload Routes - Sales and Production history for reporting"""
from fastapi import APIRouter, HTTPException, File, UploadFile, Query, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid
import openpyxl
from io import BytesIO

from database import db

router = APIRouter(tags=["Historical Data"])

# Month parsing helper
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
}

def parse_month(month_str: str) -> dict:
    """Parse month string like 'Jun 2025', '2025-06', 'June 2025' into {month, year, month_key}"""
    month_str = str(month_str).strip()
    
    # Try "Jun 2025" or "June 2025"
    parts = month_str.split()
    if len(parts) == 2:
        month_name = parts[0].lower().rstrip(".")
        if month_name in MONTH_MAP:
            return {"month": MONTH_MAP[month_name], "year": int(parts[1]), "month_key": f"{parts[1]}-{MONTH_MAP[month_name]:02d}"}
        # Try "2025 Jun"
        month_name = parts[1].lower().rstrip(".")
        if month_name in MONTH_MAP:
            return {"month": MONTH_MAP[month_name], "year": int(parts[0]), "month_key": f"{parts[0]}-{MONTH_MAP[month_name]:02d}"}
    
    # Try "2025-06"
    if "-" in month_str and len(month_str) <= 7:
        p = month_str.split("-")
        return {"month": int(p[1]), "year": int(p[0]), "month_key": month_str}
    
    raise ValueError(f"Cannot parse month: '{month_str}'. Expected format: 'Jun 2025' or '2025-06'")


async def enrich_buyer_sku(buyer_sku_id: str) -> dict:
    """Look up buyer SKU and return enriched data (bidso, model, vertical)"""
    buyer_sku = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id}, {"_id": 0})
    if not buyer_sku:
        return None
    
    bidso_sku_id = buyer_sku.get("bidso_sku_id", "")
    bidso = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0}) if bidso_sku_id else None
    
    return {
        "buyer_sku_name": buyer_sku.get("name", ""),
        "bidso_sku_id": bidso_sku_id,
        "brand_code": buyer_sku.get("brand_code", ""),
        "vertical_code": bidso.get("vertical_code", "") if bidso else "",
        "vertical_id": bidso.get("vertical_id", "") if bidso else "",
        "model_code": bidso.get("model_code", "") if bidso else "",
        "model_id": bidso.get("model_id", "") if bidso else "",
    }


# ==================== SALES UPLOAD ====================

@router.post("/historical-sales/upload")
async def upload_historical_sales(
    file: UploadFile = File(...),
    mode: str = Query("append", description="'append' new data or 'overwrite' existing for same months")
):
    """
    Upload historical sales data from Excel.
    Columns: Buyer SKU | Customer ID | Qty | Month | ASP
    
    Auto-enriches with: customer name, bidso SKU, model, vertical, revenue.
    """
    content = await file.read()
    wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
    ws = wb.active
    
    # Parse headers
    headers_raw = [str(cell.value or "").strip().lower() for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    
    header_map = {}
    for idx, h in enumerate(headers_raw):
        if h in ("buyer sku", "buyer_sku", "buyer sku id", "buyer_sku_id", "sku"):
            header_map["buyer_sku_id"] = idx
        elif h in ("customer id", "customer_id", "customer", "customer name"):
            header_map["customer_id"] = idx
        elif h in ("qty", "quantity", "units", "sales qty"):
            header_map["qty"] = idx
        elif h in ("month", "period", "month year"):
            header_map["month"] = idx
        elif h in ("asp", "average selling price", "price", "selling price", "unit price"):
            header_map["asp"] = idx
    
    required = ["buyer_sku_id", "customer_id", "qty", "month", "asp"]
    missing = [k for k in required if k not in header_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}. Found: {headers_raw}")
    
    # Pre-load lookups
    buyers_list = await db.buyers.find({}, {"_id": 0, "id": 1, "code": 1, "name": 1}).to_list(1000)
    buyer_lookup = {}
    for b in buyers_list:
        buyer_lookup[b.get("id", "")] = b["name"]
        buyer_lookup[b.get("code", "")] = b["name"]
        buyer_lookup[b["name"]] = b["name"]
        buyer_lookup[b["name"].lower()] = b["name"]
    
    # Parse rows
    rows = []
    errors = []
    months_in_file = set()
    
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        
        buyer_sku_id = str(row[header_map["buyer_sku_id"]] or "").strip()
        customer_raw = str(row[header_map["customer_id"]] or "").strip()
        qty_raw = row[header_map["qty"]]
        month_raw = str(row[header_map["month"]] or "").strip()
        asp_raw = row[header_map["asp"]]
        
        if not buyer_sku_id or not month_raw:
            errors.append(f"Row {idx}: Missing Buyer SKU or Month")
            continue
        
        try:
            qty = float(qty_raw) if qty_raw else 0
        except (ValueError, TypeError):
            errors.append(f"Row {idx}: Invalid qty '{qty_raw}'")
            continue
        
        try:
            asp = float(asp_raw) if asp_raw else 0
        except (ValueError, TypeError):
            errors.append(f"Row {idx}: Invalid ASP '{asp_raw}'")
            continue
        
        try:
            month_info = parse_month(month_raw)
        except ValueError as e:
            errors.append(f"Row {idx}: {str(e)}")
            continue
        
        # Resolve customer name
        customer_name = buyer_lookup.get(customer_raw) or buyer_lookup.get(customer_raw.lower()) or customer_raw
        
        # Enrich buyer SKU
        enrichment = await enrich_buyer_sku(buyer_sku_id)
        if not enrichment:
            errors.append(f"Row {idx}: Buyer SKU '{buyer_sku_id}' not found")
            continue
        
        months_in_file.add(month_info["month_key"])
        
        rows.append({
            "id": str(uuid.uuid4()),
            "buyer_sku_id": buyer_sku_id,
            "buyer_sku_name": enrichment["buyer_sku_name"],
            "customer_id": customer_raw,
            "customer_name": customer_name,
            "qty": qty,
            "asp": asp,
            "revenue": round(qty * asp, 2),
            "month": month_info["month"],
            "year": month_info["year"],
            "month_key": month_info["month_key"],
            "bidso_sku_id": enrichment["bidso_sku_id"],
            "brand_code": enrichment["brand_code"],
            "vertical_code": enrichment["vertical_code"],
            "vertical_id": enrichment["vertical_id"],
            "model_code": enrichment["model_code"],
            "model_id": enrichment["model_id"],
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        })
    
    if not rows:
        return {"message": "No valid rows to upload", "errors": errors[:50]}
    
    # Handle overwrite mode
    deleted = 0
    if mode == "overwrite" and months_in_file:
        result = await db.historical_sales.delete_many({"month_key": {"$in": list(months_in_file)}})
        deleted = result.deleted_count
    
    # Insert rows
    await db.historical_sales.insert_many(rows)
    
    return {
        "message": f"Uploaded {len(rows)} sales records for {len(months_in_file)} month(s)",
        "inserted": len(rows),
        "deleted_previous": deleted,
        "months": sorted(list(months_in_file)),
        "errors": errors[:50]
    }


# ==================== PRODUCTION UPLOAD ====================

@router.post("/historical-production/upload")
async def upload_historical_production(
    file: UploadFile = File(...),
    mode: str = Query("append", description="'append' new data or 'overwrite' existing for same months")
):
    """
    Upload historical production data from Excel.
    Columns: Buyer SKU | Branch ID | Qty | Month
    
    Auto-enriches with: branch name, model, vertical, production value (from avg ASP).
    """
    content = await file.read()
    wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
    ws = wb.active
    
    headers_raw = [str(cell.value or "").strip().lower() for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    
    header_map = {}
    for idx, h in enumerate(headers_raw):
        if h in ("buyer sku", "buyer_sku", "buyer sku id", "buyer_sku_id", "sku"):
            header_map["buyer_sku_id"] = idx
        elif h in ("branch id", "branch_id", "branch", "branch name"):
            header_map["branch_id"] = idx
        elif h in ("qty", "quantity", "production qty", "units"):
            header_map["qty"] = idx
        elif h in ("month", "period", "month year"):
            header_map["month"] = idx
    
    required = ["buyer_sku_id", "branch_id", "qty", "month"]
    missing = [k for k in required if k not in header_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}. Found: {headers_raw}")
    
    # Pre-load branch lookup
    branches = await db.branches.find({}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    branch_lookup = {}
    for b in branches:
        branch_lookup[b.get("branch_id", "")] = b["name"]
        branch_lookup[b.get("branch_id", "").lower()] = b["name"]
        branch_lookup[b["name"]] = b["name"]
        branch_lookup[b["name"].lower()] = b["name"]
    
    rows = []
    errors = []
    months_in_file = set()
    sku_months_for_asp = set()
    
    # First pass: parse rows and collect SKU+month pairs for ASP lookup
    parsed_rows = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(row):
            continue
        
        buyer_sku_id = str(row[header_map["buyer_sku_id"]] or "").strip()
        branch_raw = str(row[header_map["branch_id"]] or "").strip()
        qty_raw = row[header_map["qty"]]
        month_raw = str(row[header_map["month"]] or "").strip()
        
        if not buyer_sku_id or not month_raw:
            errors.append(f"Row {idx}: Missing Buyer SKU or Month")
            continue
        
        try:
            qty = float(qty_raw) if qty_raw else 0
        except (ValueError, TypeError):
            errors.append(f"Row {idx}: Invalid qty '{qty_raw}'")
            continue
        
        try:
            month_info = parse_month(month_raw)
        except ValueError as e:
            errors.append(f"Row {idx}: {str(e)}")
            continue
        
        branch_name = branch_lookup.get(branch_raw) or branch_lookup.get(branch_raw.lower())
        if not branch_name:
            errors.append(f"Row {idx}: Branch '{branch_raw}' not found")
            continue
        
        enrichment = await enrich_buyer_sku(buyer_sku_id)
        if not enrichment:
            errors.append(f"Row {idx}: Buyer SKU '{buyer_sku_id}' not found")
            continue
        
        months_in_file.add(month_info["month_key"])
        sku_months_for_asp.add((buyer_sku_id, month_info["month_key"]))
        
        parsed_rows.append({
            "buyer_sku_id": buyer_sku_id,
            "branch_name": branch_name,
            "branch_raw": branch_raw,
            "qty": qty,
            "month_info": month_info,
            "enrichment": enrichment
        })
    
    # Fetch average ASP from historical_sales for each SKU+month
    asp_map = {}
    for sku_id, month_key in sku_months_for_asp:
        pipeline = [
            {"$match": {"buyer_sku_id": sku_id, "month_key": month_key, "asp": {"$gt": 0}}},
            {"$group": {"_id": None, "avg_asp": {"$avg": "$asp"}}}
        ]
        result = await db.historical_sales.aggregate(pipeline).to_list(1)
        if result:
            asp_map[(sku_id, month_key)] = round(result[0]["avg_asp"], 2)
    
    # If no month-specific ASP, try overall average for that SKU
    for sku_id, month_key in sku_months_for_asp:
        if (sku_id, month_key) not in asp_map:
            pipeline = [
                {"$match": {"buyer_sku_id": sku_id, "asp": {"$gt": 0}}},
                {"$group": {"_id": None, "avg_asp": {"$avg": "$asp"}}}
            ]
            result = await db.historical_sales.aggregate(pipeline).to_list(1)
            if result:
                asp_map[(sku_id, month_key)] = round(result[0]["avg_asp"], 2)
    
    # Build final rows with production value
    for p in parsed_rows:
        avg_asp = asp_map.get((p["buyer_sku_id"], p["month_info"]["month_key"]), 0)
        
        rows.append({
            "id": str(uuid.uuid4()),
            "buyer_sku_id": p["buyer_sku_id"],
            "buyer_sku_name": p["enrichment"]["buyer_sku_name"],
            "branch_id": p["branch_raw"],
            "branch_name": p["branch_name"],
            "qty": p["qty"],
            "avg_asp": avg_asp,
            "production_value": round(p["qty"] * avg_asp, 2),
            "month": p["month_info"]["month"],
            "year": p["month_info"]["year"],
            "month_key": p["month_info"]["month_key"],
            "bidso_sku_id": p["enrichment"]["bidso_sku_id"],
            "brand_code": p["enrichment"]["brand_code"],
            "vertical_code": p["enrichment"]["vertical_code"],
            "vertical_id": p["enrichment"]["vertical_id"],
            "model_code": p["enrichment"]["model_code"],
            "model_id": p["enrichment"]["model_id"],
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Handle overwrite
    deleted = 0
    if mode == "overwrite" and months_in_file:
        result = await db.historical_production.delete_many({"month_key": {"$in": list(months_in_file)}})
        deleted = result.deleted_count
    
    if rows:
        await db.historical_production.insert_many(rows)
    
    skus_without_asp = [s for s, m in sku_months_for_asp if (s, m) not in asp_map]
    
    return {
        "message": f"Uploaded {len(rows)} production records for {len(months_in_file)} month(s)",
        "inserted": len(rows),
        "deleted_previous": deleted,
        "months": sorted(list(months_in_file)),
        "skus_without_asp": skus_without_asp[:20],
        "errors": errors[:50]
    }


# ==================== SUMMARY/REPORT ENDPOINTS ====================

@router.get("/historical-sales/summary")
async def get_historical_sales_summary(
    group_by: str = Query("customer", description="customer, model, vertical, bidso_sku, month"),
    from_month: Optional[str] = None,
    to_month: Optional[str] = None
):
    """Get aggregated historical sales data"""
    match = {}
    if from_month:
        match["month_key"] = {"$gte": from_month}
    if to_month:
        match.setdefault("month_key", {})["$lte"] = to_month
    
    group_field_map = {
        "customer": {"customer_name": "$customer_name"},
        "model": {"model_code": "$model_code"},
        "vertical": {"vertical_code": "$vertical_code"},
        "bidso_sku": {"bidso_sku_id": "$bidso_sku_id"},
        "month": {"month_key": "$month_key"}
    }
    
    group_id = group_field_map.get(group_by, {"customer_name": "$customer_name"})
    
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {
            "_id": group_id,
            "total_qty": {"$sum": "$qty"},
            "total_revenue": {"$sum": "$revenue"},
            "avg_asp": {"$avg": "$asp"},
            "records": {"$sum": 1}
        }},
        {"$sort": {"total_revenue": -1}}
    ]
    
    results = await db.historical_sales.aggregate(pipeline).to_list(1000)
    
    summary = []
    for r in results:
        item = {**r["_id"], "total_qty": r["total_qty"], "total_revenue": round(r["total_revenue"], 2), "avg_asp": round(r["avg_asp"], 2), "records": r["records"]}
        summary.append(item)
    
    # Totals
    total_qty = sum(r["total_qty"] for r in summary)
    total_revenue = sum(r["total_revenue"] for r in summary)
    
    return {
        "group_by": group_by,
        "data": summary,
        "totals": {"total_qty": total_qty, "total_revenue": round(total_revenue, 2)},
        "count": len(summary)
    }


@router.get("/historical-production/summary")
async def get_historical_production_summary(
    group_by: str = Query("branch", description="branch, model, vertical, month"),
    from_month: Optional[str] = None,
    to_month: Optional[str] = None
):
    """Get aggregated historical production data"""
    match = {}
    if from_month:
        match["month_key"] = {"$gte": from_month}
    if to_month:
        match.setdefault("month_key", {})["$lte"] = to_month
    
    group_field_map = {
        "branch": {"branch_name": "$branch_name"},
        "model": {"model_code": "$model_code"},
        "vertical": {"vertical_code": "$vertical_code"},
        "month": {"month_key": "$month_key"}
    }
    
    group_id = group_field_map.get(group_by, {"branch_name": "$branch_name"})
    
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {
            "_id": group_id,
            "total_qty": {"$sum": "$qty"},
            "total_value": {"$sum": "$production_value"},
            "avg_asp": {"$avg": "$avg_asp"},
            "records": {"$sum": 1}
        }},
        {"$sort": {"total_value": -1}}
    ]
    
    results = await db.historical_production.aggregate(pipeline).to_list(1000)
    
    summary = []
    for r in results:
        item = {**r["_id"], "total_qty": r["total_qty"], "total_value": round(r["total_value"], 2), "avg_asp": round(r.get("avg_asp", 0), 2), "records": r["records"]}
        summary.append(item)
    
    total_qty = sum(r["total_qty"] for r in summary)
    total_value = sum(r["total_value"] for r in summary)
    
    return {
        "group_by": group_by,
        "data": summary,
        "totals": {"total_qty": total_qty, "total_value": round(total_value, 2)},
        "count": len(summary)
    }


@router.get("/historical-sales/stats")
async def get_historical_sales_stats():
    """Get quick stats about uploaded historical sales data"""
    total = await db.historical_sales.count_documents({})
    if total == 0:
        return {"total_records": 0, "months": [], "total_revenue": 0, "total_qty": 0}
    
    months = await db.historical_sales.distinct("month_key")
    pipeline = [{"$group": {"_id": None, "revenue": {"$sum": "$revenue"}, "qty": {"$sum": "$qty"}}}]
    agg = await db.historical_sales.aggregate(pipeline).to_list(1)
    
    return {
        "total_records": total,
        "months": sorted(months),
        "total_revenue": round(agg[0]["revenue"], 2) if agg else 0,
        "total_qty": agg[0]["qty"] if agg else 0
    }


@router.get("/historical-production/stats")
async def get_historical_production_stats():
    """Get quick stats about uploaded historical production data"""
    total = await db.historical_production.count_documents({})
    if total == 0:
        return {"total_records": 0, "months": [], "total_value": 0, "total_qty": 0}
    
    months = await db.historical_production.distinct("month_key")
    pipeline = [{"$group": {"_id": None, "value": {"$sum": "$production_value"}, "qty": {"$sum": "$qty"}}}]
    agg = await db.historical_production.aggregate(pipeline).to_list(1)
    
    return {
        "total_records": total,
        "months": sorted(months),
        "total_value": round(agg[0]["value"], 2) if agg else 0,
        "total_qty": agg[0]["qty"] if agg else 0
    }
