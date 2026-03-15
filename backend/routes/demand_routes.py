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
    buyer_id: Optional[str] = None
    vertical_id: Optional[str] = None
    sku_id: Optional[str] = None
    forecast_month: datetime
    quantity: int
    priority: str = "MEDIUM"
    notes: str = ""

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
