from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import openpyxl
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ Models ============

class RawMaterial(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    name: str
    unit: str
    current_stock: float = 0.0
    low_stock_threshold: float = 10.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RawMaterialCreate(BaseModel):
    rm_id: str
    name: str
    unit: str
    low_stock_threshold: float = 10.0

class PurchaseEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PurchaseEntryCreate(BaseModel):
    rm_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class SKU(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    name: str
    description: Optional[str] = None
    current_stock: float = 0.0
    low_stock_threshold: float = 5.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SKUCreate(BaseModel):
    sku_id: str
    name: str
    description: Optional[str] = None
    low_stock_threshold: float = 5.0

class RMMapping(BaseModel):
    rm_id: str
    quantity_required: float

class SKUMapping(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    rm_mappings: List[RMMapping]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SKUMappingCreate(BaseModel):
    sku_id: str
    rm_mappings: List[RMMapping]

class ProductionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductionEntryCreate(BaseModel):
    sku_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class DispatchEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DispatchEntryCreate(BaseModel):
    sku_id: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class DashboardStats(BaseModel):
    total_rm_value: int
    total_sku_value: int
    low_stock_items: int
    today_production: int

# ============ Helper Functions ============

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'date' in doc and isinstance(doc['date'], str):
        doc['date'] = datetime.fromisoformat(doc['date'])
    return doc

# ============ Raw Material Routes ============

@api_router.post("/raw-materials", response_model=RawMaterial)
async def create_raw_material(input: RawMaterialCreate):
    existing = await db.raw_materials.find_one({"rm_id": input.rm_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="RM ID already exists")
    
    rm_obj = RawMaterial(**input.model_dump())
    doc = rm_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.raw_materials.insert_one(doc)
    return rm_obj

@api_router.post("/raw-materials/bulk-upload")
async def bulk_upload_raw_materials(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        created_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:  # Skip empty rows
                continue
            
            try:
                rm_id = str(row[0]).strip()
                name = str(row[1]).strip() if row[1] else rm_id
                unit = str(row[2]).strip() if row[2] else "units"
                threshold = float(row[3]) if len(row) > 3 and row[3] else 10.0
                
                existing = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
                if existing:
                    skipped_count += 1
                    continue
                
                rm_obj = RawMaterial(rm_id=rm_id, name=name, unit=unit, low_stock_threshold=threshold)
                doc = rm_obj.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.raw_materials.insert_one(doc)
                created_count += 1
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
        
        return {
            "created": created_count,
            "skipped": skipped_count,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.get("/raw-materials", response_model=List[RawMaterial])
async def get_raw_materials(search: Optional[str] = None):
    query = {}
    if search:
        query = {"$or": [{"rm_id": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]}
    
    materials = await db.raw_materials.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(m) for m in materials]

@api_router.get("/raw-materials/{rm_id}", response_model=RawMaterial)
async def get_raw_material(rm_id: str):
    material = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
    if not material:
        raise HTTPException(status_code=404, detail="Raw material not found")
    return serialize_doc(material)

@api_router.delete("/raw-materials/{rm_id}")
async def delete_raw_material(rm_id: str):
    result = await db.raw_materials.delete_one({"rm_id": rm_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Raw material not found")
    return {"message": "Raw material deleted"}

# ============ Purchase Entry Routes ============

@api_router.post("/purchase-entries", response_model=PurchaseEntry)
async def create_purchase_entry(input: PurchaseEntryCreate):
    material = await db.raw_materials.find_one({"rm_id": input.rm_id}, {"_id": 0})
    if not material:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    entry_obj = PurchaseEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.purchase_entries.insert_one(doc)
    
    # Update stock
    await db.raw_materials.update_one(
        {"rm_id": input.rm_id},
        {"$inc": {"current_stock": input.quantity}}
    )
    
    return entry_obj

@api_router.get("/purchase-entries", response_model=List[PurchaseEntry])
async def get_purchase_entries(rm_id: Optional[str] = None):
    query = {}
    if rm_id:
        query = {"rm_id": rm_id}
    
    entries = await db.purchase_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ SKU Routes ============

@api_router.post("/skus", response_model=SKU)
async def create_sku(input: SKUCreate):
    existing = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="SKU ID already exists")
    
    sku_obj = SKU(**input.model_dump())
    doc = sku_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.skus.insert_one(doc)
    return sku_obj

@api_router.get("/skus", response_model=List[SKU])
async def get_skus(search: Optional[str] = None):
    query = {}
    if search:
        query = {"$or": [{"sku_id": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]}
    
    skus = await db.skus.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(s) for s in skus]

@api_router.get("/skus/{sku_id}", response_model=SKU)
async def get_sku(sku_id: str):
    sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    return serialize_doc(sku)

@api_router.put("/skus/{sku_id}", response_model=SKU)
async def update_sku(sku_id: str, input: SKUCreate):
    existing = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    update_data = input.model_dump()
    await db.skus.update_one({"sku_id": sku_id}, {"$set": update_data})
    
    updated = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    return serialize_doc(updated)

@api_router.delete("/skus/{sku_id}")
async def delete_sku(sku_id: str):
    result = await db.skus.delete_one({"sku_id": sku_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="SKU not found")
    return {"message": "SKU deleted"}

# ============ SKU Mapping Routes ============

@api_router.post("/sku-mappings", response_model=SKUMapping)
async def create_sku_mapping(input: SKUMappingCreate):
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    for mapping in input.rm_mappings:
        rm = await db.raw_materials.find_one({"rm_id": mapping.rm_id}, {"_id": 0})
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw material {mapping.rm_id} not found")
    
    existing = await db.sku_mappings.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if existing:
        await db.sku_mappings.delete_one({"sku_id": input.sku_id})
    
    mapping_obj = SKUMapping(**input.model_dump())
    doc = mapping_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sku_mappings.insert_one(doc)
    return mapping_obj

@api_router.get("/sku-mappings/{sku_id}", response_model=SKUMapping)
async def get_sku_mapping(sku_id: str):
    mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return serialize_doc(mapping)

@api_router.get("/sku-mappings", response_model=List[SKUMapping])
async def get_all_sku_mappings():
    mappings = await db.sku_mappings.find({}, {"_id": 0}).to_list(1000)
    return [serialize_doc(m) for m in mappings]

# ============ Production Entry Routes ============

@api_router.post("/production-entries", response_model=ProductionEntry)
async def create_production_entry(input: ProductionEntryCreate):
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    mapping = await db.sku_mappings.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not mapping:
        raise HTTPException(status_code=400, detail="SKU mapping not found. Please map raw materials first.")
    
    # Check if sufficient raw materials are available
    for rm_mapping in mapping['rm_mappings']:
        required_qty = rm_mapping['quantity_required'] * input.quantity
        rm = await db.raw_materials.find_one({"rm_id": rm_mapping['rm_id']}, {"_id": 0})
        if rm['current_stock'] < required_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {rm_mapping['rm_id']}. Required: {required_qty}, Available: {rm['current_stock']}"
            )
    
    entry_obj = ProductionEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.production_entries.insert_one(doc)
    
    # Deduct raw materials and add to SKU stock
    for rm_mapping in mapping['rm_mappings']:
        required_qty = rm_mapping['quantity_required'] * input.quantity
        await db.raw_materials.update_one(
            {"rm_id": rm_mapping['rm_id']},
            {"$inc": {"current_stock": -required_qty}}
        )
    
    await db.skus.update_one(
        {"sku_id": input.sku_id},
        {"$inc": {"current_stock": input.quantity}}
    )
    
    return entry_obj

@api_router.get("/production-entries", response_model=List[ProductionEntry])
async def get_production_entries(sku_id: Optional[str] = None):
    query = {}
    if sku_id:
        query = {"sku_id": sku_id}
    
    entries = await db.production_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ Dispatch Entry Routes ============

@api_router.post("/dispatch-entries", response_model=DispatchEntry)
async def create_dispatch_entry(input: DispatchEntryCreate):
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    if sku['current_stock'] < input.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient SKU stock. Required: {input.quantity}, Available: {sku['current_stock']}"
        )
    
    entry_obj = DispatchEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.dispatch_entries.insert_one(doc)
    
    # Deduct from SKU stock
    await db.skus.update_one(
        {"sku_id": input.sku_id},
        {"$inc": {"current_stock": -input.quantity}}
    )
    
    return entry_obj

@api_router.get("/dispatch-entries", response_model=List[DispatchEntry])
async def get_dispatch_entries(sku_id: Optional[str] = None):
    query = {}
    if sku_id:
        query = {"sku_id": sku_id}
    
    entries = await db.dispatch_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ Dashboard & Reports Routes ============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    rm_count = await db.raw_materials.count_documents({})
    sku_count = await db.skus.count_documents({})
    
    low_stock_rm = await db.raw_materials.count_documents({
        "$expr": {"$lt": ["$current_stock", "$low_stock_threshold"]}
    })
    low_stock_sku = await db.skus.count_documents({
        "$expr": {"$lt": ["$current_stock", "$low_stock_threshold"]}
    })
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_entries = await db.production_entries.find({
        "date": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    today_production = sum(e.get('quantity', 0) for e in today_entries)
    
    return DashboardStats(
        total_rm_value=rm_count,
        total_sku_value=sku_count,
        low_stock_items=low_stock_rm + low_stock_sku,
        today_production=int(today_production)
    )

@api_router.get("/reports/low-stock")
async def get_low_stock_report():
    low_stock_rm = await db.raw_materials.find(
        {"$expr": {"$lt": ["$current_stock", "$low_stock_threshold"]}},
        {"_id": 0}
    ).to_list(1000)
    
    low_stock_sku = await db.skus.find(
        {"$expr": {"$lt": ["$current_stock", "$low_stock_threshold"]}},
        {"_id": 0}
    ).to_list(1000)
    
    return {
        "raw_materials": [serialize_doc(rm) for rm in low_stock_rm],
        "skus": [serialize_doc(sku) for sku in low_stock_sku]
    }

@api_router.get("/reports/production-summary")
async def get_production_summary(days: int = 7):
    from datetime import timedelta
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    entries = await db.production_entries.find(
        {"date": {"$gte": start_date.isoformat()}},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    # Group by date
    daily_summary = {}
    for entry in entries:
        date_str = entry['date'][:10]  # Get date part
        if date_str not in daily_summary:
            daily_summary[date_str] = {"total_quantity": 0, "items": []}
        daily_summary[date_str]["total_quantity"] += entry['quantity']
        daily_summary[date_str]["items"].append(entry)
    
    return {
        "entries": [serialize_doc(e) for e in entries],
        "daily_summary": daily_summary
    }

@api_router.get("/reports/inventory")
async def get_inventory_report():
    raw_materials = await db.raw_materials.find({}, {"_id": 0}).to_list(1000)
    skus = await db.skus.find({}, {"_id": 0}).to_list(1000)
    
    return {
        "raw_materials": [serialize_doc(rm) for rm in raw_materials],
        "skus": [serialize_doc(sku) for sku in skus]
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()