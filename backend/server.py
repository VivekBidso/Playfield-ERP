from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import openpyxl
import io
import jwt
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

security = HTTPBearer()

BRANCHES = [
    "Unit 1 Vedica",
    "Unit 2 Trikes",
    "Unit 3 TM",
    "Unit 4 Goa",
    "Unit 5 Emox",
    "Unit 6 Baabus",
    "BHDG WH"
]

RM_CATEGORIES = {
    "INP": {"name": "In-house Plastic", "fields": ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"]},
    "ACC": {"name": "Accessories", "fields": ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"]},
    "ELC": {"name": "Electric Components", "fields": ["model", "type", "specs", "per_unit_weight", "unit"]},
    "SP": {"name": "Spares", "fields": ["type", "specs", "per_unit_weight", "unit"]},
    "BS": {"name": "Brand Assets", "fields": ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"]},
    "PM": {"name": "Packaging", "fields": ["model", "type", "specs", "brand", "per_unit_weight", "unit"]},
    "LB": {"name": "Labels", "fields": ["type", "buyer_sku", "per_unit_weight", "unit"]}
}

# ============ Models ============

class RawMaterial(BaseModel):
    """Global RM definition"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    category: str
    category_data: Dict[str, Any] = {}
    low_stock_threshold: float = 10.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RawMaterialCreate(BaseModel):
    category: str
    category_data: Dict[str, Any]
    low_stock_threshold: float = 10.0

class BranchRMInventory(BaseModel):
    """Branch-specific RM inventory"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    branch: str
    current_stock: float = 0.0
    is_active: bool = True
    activated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SKU(BaseModel):
    """Global SKU definition"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    bidso_sku: str
    buyer_sku_id: str
    description: str
    brand: str
    vertical: str
    model: str
    low_stock_threshold: float = 5.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SKUCreate(BaseModel):
    sku_id: str
    bidso_sku: str
    buyer_sku_id: str
    description: str
    brand: str
    vertical: str
    model: str
    low_stock_threshold: float = 5.0

class BranchSKUInventory(BaseModel):
    """Branch-specific SKU inventory"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    current_stock: float = 0.0
    is_active: bool = True
    activated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RMMapping(BaseModel):
    rm_id: str
    quantity_required: float

class SKUMapping(BaseModel):
    """Global SKU to RM mapping (BOM)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    rm_mappings: List[RMMapping]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SKUMappingCreate(BaseModel):
    sku_id: str
    rm_mappings: List[RMMapping]

class PurchaseEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PurchaseEntryCreate(BaseModel):
    rm_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class ProductionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductionEntryCreate(BaseModel):
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class DispatchEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DispatchEntryCreate(BaseModel):
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None

class ProductionPlanEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    branch: str
    plan_month: str  # YYYY-MM format
    date: datetime
    sku_id: str
    planned_quantity: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductionPlanCreate(BaseModel):
    branch: str
    plan_month: str
    date: datetime
    sku_id: str
    planned_quantity: float

class ActivateItemRequest(BaseModel):
    item_id: str
    branch: str

# ============ Helper Functions ============

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'date' in doc and isinstance(doc['date'], str):
        doc['date'] = datetime.fromisoformat(doc['date'])
    if doc and 'activated_at' in doc and isinstance(doc['activated_at'], str):
        doc['activated_at'] = datetime.fromisoformat(doc['activated_at'])
    return doc

async def get_next_rm_sequence(category: str) -> int:
    """Get next global sequence number for RM category"""
    last_rm = await db.raw_materials.find_one(
        {"category": category},
        {"_id": 0},
        sort=[("rm_id", -1)]
    )
    if last_rm:
        try:
            seq = int(last_rm['rm_id'].split('_')[1])
            return seq + 1
        except:
            return 1
    return 1

# ============ Branch Routes ============

@api_router.get("/branches")
async def get_branches():
    return {"branches": BRANCHES}

@api_router.get("/rm-categories")
async def get_rm_categories():
    return {"categories": RM_CATEGORIES}

# ============ Global Raw Material Routes ============

@api_router.post("/raw-materials", response_model=RawMaterial)
async def create_raw_material(input: RawMaterialCreate):
    """Create global RM with auto-generated ID"""
    # Auto-generate RM ID based on category
    seq = await get_next_rm_sequence(input.category)
    rm_id = f"{input.category}_{seq:03d}"
    
    # Check if somehow this ID exists (shouldn't happen)
    existing = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
    if existing:
        # Get next available
        seq = await get_next_rm_sequence(input.category)
        rm_id = f"{input.category}_{seq:03d}"
    
    rm_obj = RawMaterial(
        rm_id=rm_id,
        category=input.category,
        category_data=input.category_data,
        low_stock_threshold=input.low_stock_threshold
    )
    doc = rm_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.raw_materials.insert_one(doc)
    return rm_obj

@api_router.post("/raw-materials/bulk-upload")
async def bulk_upload_raw_materials(file: UploadFile = File(...)):
    """Bulk upload global RMs"""
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
            if not row[0]:
                continue
            
            try:
                category = str(row[0]).strip().upper()
                if category not in RM_CATEGORIES:
                    errors.append(f"Row {idx}: Invalid category {category}")
                    continue
                
                seq = await get_next_rm_sequence(category)
                rm_id = f"{category}_{seq:03d}"
                
                existing = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
                if existing:
                    skipped_count += 1
                    continue
                
                category_fields = RM_CATEGORIES[category]["fields"]
                category_data = {}
                for i, field in enumerate(category_fields):
                    value = row[i + 1] if len(row) > i + 1 else ""
                    category_data[field] = str(value) if value else ""
                
                threshold = float(row[len(category_fields) + 1]) if len(row) > len(category_fields) + 1 and row[len(category_fields) + 1] else 10.0
                
                rm_obj = RawMaterial(
                    rm_id=rm_id,
                    category=category,
                    category_data=category_data,
                    low_stock_threshold=threshold
                )
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

@api_router.get("/raw-materials")
async def get_raw_materials(branch: Optional[str] = None, search: Optional[str] = None, include_inactive: bool = False):
    """Get RMs - if branch specified, return only active RMs in that branch"""
    if branch:
        # Get active RMs in branch
        inventory_query = {"branch": branch}
        if not include_inactive:
            inventory_query["is_active"] = True
        
        branch_inventories = await db.branch_rm_inventory.find(inventory_query, {"_id": 0}).to_list(1000)
        active_rm_ids = [inv['rm_id'] for inv in branch_inventories]
        
        query = {"rm_id": {"$in": active_rm_ids}}
        if search:
            query["$and"] = [{"rm_id": {"$in": active_rm_ids}}, {"rm_id": {"$regex": search, "$options": "i"}}]
        
        materials = await db.raw_materials.find(query, {"_id": 0}).to_list(1000)
        
        # Merge with inventory data
        result = []
        for mat in materials:
            inv = next((i for i in branch_inventories if i['rm_id'] == mat['rm_id']), None)
            mat['current_stock'] = inv['current_stock'] if inv else 0
            mat['branch'] = branch
            result.append(serialize_doc(mat))
        return result
    else:
        # Get all global RMs
        query = {}
        if search:
            query["rm_id"] = {"$regex": search, "$options": "i"}
        materials = await db.raw_materials.find(query, {"_id": 0}).to_list(1000)
        return [serialize_doc(m) for m in materials]

@api_router.post("/raw-materials/activate")
async def activate_rm_in_branch(request: ActivateItemRequest):
    """Activate an RM in a specific branch"""
    rm = await db.raw_materials.find_one({"rm_id": request.item_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail="RM not found globally")
    
    existing_inv = await db.branch_rm_inventory.find_one(
        {"rm_id": request.item_id, "branch": request.branch},
        {"_id": 0}
    )
    
    if existing_inv:
        if existing_inv['is_active']:
            return {"message": "RM already active in this branch"}
        # Reactivate
        await db.branch_rm_inventory.update_one(
            {"rm_id": request.item_id, "branch": request.branch},
            {"$set": {"is_active": True, "activated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new inventory entry
        inv_obj = BranchRMInventory(rm_id=request.item_id, branch=request.branch)
        doc = inv_obj.model_dump()
        doc['activated_at'] = doc['activated_at'].isoformat()
        await db.branch_rm_inventory.insert_one(doc)
    
    return {"message": f"RM {request.item_id} activated in {request.branch}"}

@api_router.delete("/raw-materials/{rm_id}")
async def delete_raw_material(rm_id: str):
    """Delete global RM"""
    result = await db.raw_materials.delete_one({"rm_id": rm_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Raw material not found")
    # Also delete from all branch inventories
    await db.branch_rm_inventory.delete_many({"rm_id": rm_id})
    return {"message": "Raw material deleted globally"}

# ============ Purchase Entry Routes ============

@api_router.post("/purchase-entries")
async def create_purchase_entry(input: PurchaseEntryCreate):
    rm = await db.raw_materials.find_one({"rm_id": input.rm_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    inventory = await db.branch_rm_inventory.find_one(
        {"rm_id": input.rm_id, "branch": input.branch, "is_active": True},
        {"_id": 0}
    )
    if not inventory:
        raise HTTPException(status_code=400, detail=f"RM not active in {input.branch}. Please activate it first.")
    
    entry_obj = PurchaseEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.purchase_entries.insert_one(doc)
    
    await db.branch_rm_inventory.update_one(
        {"rm_id": input.rm_id, "branch": input.branch},
        {"$inc": {"current_stock": input.quantity}}
    )
    
    return entry_obj

@api_router.get("/purchase-entries")
async def get_purchase_entries(branch: Optional[str] = None, rm_id: Optional[str] = None):
    query = {}
    if branch:
        query["branch"] = branch
    if rm_id:
        query["rm_id"] = rm_id
    
    entries = await db.purchase_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ Global SKU Routes ============

@api_router.post("/skus", response_model=SKU)
async def create_sku(input: SKUCreate):
    """Create global SKU"""
    existing = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="SKU ID already exists globally")
    
    sku_obj = SKU(**input.model_dump())
    doc = sku_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.skus.insert_one(doc)
    return sku_obj

@api_router.get("/skus")
async def get_skus(branch: Optional[str] = None, search: Optional[str] = None, include_inactive: bool = False):
    """Get SKUs - if branch specified, return only active SKUs in that branch"""
    if branch:
        inventory_query = {"branch": branch}
        if not include_inactive:
            inventory_query["is_active"] = True
        
        branch_inventories = await db.branch_sku_inventory.find(inventory_query, {"_id": 0}).to_list(1000)
        active_sku_ids = [inv['sku_id'] for inv in branch_inventories]
        
        query = {"sku_id": {"$in": active_sku_ids}}
        if search:
            query["$and"] = [
                {"sku_id": {"$in": active_sku_ids}},
                {"$or": [
                    {"sku_id": {"$regex": search, "$options": "i"}},
                    {"bidso_sku": {"$regex": search, "$options": "i"}},
                    {"buyer_sku_id": {"$regex": search, "$options": "i"}}
                ]}
            ]
        
        skus = await db.skus.find(query, {"_id": 0}).to_list(1000)
        
        result = []
        for sku in skus:
            inv = next((i for i in branch_inventories if i['sku_id'] == sku['sku_id']), None)
            sku['current_stock'] = inv['current_stock'] if inv else 0
            sku['branch'] = branch
            result.append(serialize_doc(sku))
        return result
    else:
        query = {}
        if search:
            query["$or"] = [
                {"sku_id": {"$regex": search, "$options": "i"}},
                {"bidso_sku": {"$regex": search, "$options": "i"}},
                {"buyer_sku_id": {"$regex": search, "$options": "i"}}
            ]
        skus = await db.skus.find(query, {"_id": 0}).to_list(1000)
        return [serialize_doc(s) for s in skus]

@api_router.post("/skus/activate")
async def activate_sku_in_branch(request: ActivateItemRequest):
    """Activate SKU in branch and auto-activate its BOM RMs"""
    sku = await db.skus.find_one({"sku_id": request.item_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found globally")
    
    # Check if already active
    existing_inv = await db.branch_sku_inventory.find_one(
        {"sku_id": request.item_id, "branch": request.branch},
        {"_id": 0}
    )
    
    if existing_inv:
        if existing_inv['is_active']:
            return {"message": "SKU already active in this branch"}
        await db.branch_sku_inventory.update_one(
            {"sku_id": request.item_id, "branch": request.branch},
            {"$set": {"is_active": True, "activated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        inv_obj = BranchSKUInventory(sku_id=request.item_id, branch=request.branch)
        doc = inv_obj.model_dump()
        doc['activated_at'] = doc['activated_at'].isoformat()
        await db.branch_sku_inventory.insert_one(doc)
    
    # Auto-activate BOM RMs
    mapping = await db.sku_mappings.find_one({"sku_id": request.item_id}, {"_id": 0})
    activated_rms = []
    if mapping:
        for rm_mapping in mapping['rm_mappings']:
            rm_id = rm_mapping['rm_id']
            # Check if RM exists globally
            rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
            if rm:
                # Activate in branch if not already
                existing_rm_inv = await db.branch_rm_inventory.find_one(
                    {"rm_id": rm_id, "branch": request.branch},
                    {"_id": 0}
                )
                if not existing_rm_inv:
                    rm_inv_obj = BranchRMInventory(rm_id=rm_id, branch=request.branch)
                    doc = rm_inv_obj.model_dump()
                    doc['activated_at'] = doc['activated_at'].isoformat()
                    await db.branch_rm_inventory.insert_one(doc)
                    activated_rms.append(rm_id)
                elif not existing_rm_inv['is_active']:
                    await db.branch_rm_inventory.update_one(
                        {"rm_id": rm_id, "branch": request.branch},
                        {"$set": {"is_active": True, "activated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    activated_rms.append(rm_id)
    
    return {
        "message": f"SKU {request.item_id} activated in {request.branch}",
        "auto_activated_rms": activated_rms
    }

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
    await db.branch_sku_inventory.delete_many({"sku_id": sku_id})
    return {"message": "SKU deleted globally"}

# ============ SKU Mapping Routes (Global BOM) ============

@api_router.post("/sku-mappings", response_model=SKUMapping)
async def create_sku_mapping(input: SKUMappingCreate):
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    for mapping in input.rm_mappings:
        rm = await db.raw_materials.find_one({"rm_id": mapping.rm_id}, {"_id": 0})
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw material {mapping.rm_id} not found globally")
    
    existing = await db.sku_mappings.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if existing:
        await db.sku_mappings.delete_one({"sku_id": input.sku_id})
    
    mapping_obj = SKUMapping(**input.model_dump())
    doc = mapping_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sku_mappings.insert_one(doc)
    return mapping_obj

@api_router.post("/sku-mappings/bulk-upload")
async def bulk_upload_sku_mappings(file: UploadFile = File(...)):
    """Bulk upload SKU to RM mappings via Excel"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        # Group mappings by SKU
        sku_mappings_dict = {}  # {sku_id: [{"rm_id": "...", "quantity_required": ...}]}
        
        created_count = 0
        updated_count = 0
        errors = []
        
        # Expected format: SKU_ID, RM_ID, Qty
        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0] or not row[1]:
                continue
            
            try:
                sku_id = str(row[0]).strip()
                rm_id = str(row[1]).strip()
                qty = float(row[2]) if row[2] else 0
                
                if qty <= 0:
                    errors.append(f"Row {idx}: Invalid quantity for {sku_id} - {rm_id}")
                    continue
                
                # Verify SKU exists
                sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
                if not sku:
                    errors.append(f"Row {idx}: SKU {sku_id} not found")
                    continue
                
                # Verify RM exists
                rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
                if not rm:
                    errors.append(f"Row {idx}: RM {rm_id} not found")
                    continue
                
                # Add to mapping dictionary
                if sku_id not in sku_mappings_dict:
                    sku_mappings_dict[sku_id] = []
                
                sku_mappings_dict[sku_id].append({
                    "rm_id": rm_id,
                    "quantity_required": qty
                })
                
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
        
        # Create/update mappings for each SKU
        for sku_id, rm_mappings in sku_mappings_dict.items():
            try:
                existing = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
                
                mapping_obj = SKUMapping(
                    sku_id=sku_id,
                    rm_mappings=[RMMapping(**rm) for rm in rm_mappings]
                )
                doc = mapping_obj.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                
                if existing:
                    # Replace existing mapping
                    await db.sku_mappings.delete_one({"sku_id": sku_id})
                    await db.sku_mappings.insert_one(doc)
                    updated_count += 1
                else:
                    await db.sku_mappings.insert_one(doc)
                    created_count += 1
                    
            except Exception as e:
                errors.append(f"SKU {sku_id}: {str(e)}")
        
        return {
            "created": created_count,
            "updated": updated_count,
            "total_skus": len(sku_mappings_dict),
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

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

@api_router.post("/production-entries")
async def create_production_entry(input: ProductionEntryCreate):
    # Check SKU is active in branch
    sku_inv = await db.branch_sku_inventory.find_one(
        {"sku_id": input.sku_id, "branch": input.branch, "is_active": True},
        {"_id": 0}
    )
    if not sku_inv:
        raise HTTPException(status_code=400, detail=f"SKU not active in {input.branch}")
    
    mapping = await db.sku_mappings.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not mapping:
        raise HTTPException(status_code=400, detail="SKU mapping not found. Please map raw materials first.")
    
    # Check RM stock
    for rm_mapping in mapping['rm_mappings']:
        required_qty = rm_mapping['quantity_required'] * input.quantity
        rm_inv = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_mapping['rm_id'], "branch": input.branch, "is_active": True},
            {"_id": 0}
        )
        if not rm_inv:
            raise HTTPException(status_code=400, detail=f"RM {rm_mapping['rm_id']} not active in {input.branch}")
        if rm_inv['current_stock'] < required_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {rm_mapping['rm_id']}. Required: {required_qty}, Available: {rm_inv['current_stock']}"
            )
    
    entry_obj = ProductionEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.production_entries.insert_one(doc)
    
    # Deduct RM stock
    for rm_mapping in mapping['rm_mappings']:
        required_qty = rm_mapping['quantity_required'] * input.quantity
        await db.branch_rm_inventory.update_one(
            {"rm_id": rm_mapping['rm_id'], "branch": input.branch},
            {"$inc": {"current_stock": -required_qty}}
        )
    
    # Add SKU stock
    await db.branch_sku_inventory.update_one(
        {"sku_id": input.sku_id, "branch": input.branch},
        {"$inc": {"current_stock": input.quantity}}
    )
    
    return entry_obj

@api_router.get("/production-entries")
async def get_production_entries(branch: Optional[str] = None, sku_id: Optional[str] = None):
    query = {}
    if branch:
        query["branch"] = branch
    if sku_id:
        query["sku_id"] = sku_id
    
    entries = await db.production_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ Dispatch Entry Routes ============

@api_router.post("/dispatch-entries")
async def create_dispatch_entry(input: DispatchEntryCreate):
    sku_inv = await db.branch_sku_inventory.find_one(
        {"sku_id": input.sku_id, "branch": input.branch, "is_active": True},
        {"_id": 0}
    )
    if not sku_inv:
        raise HTTPException(status_code=400, detail=f"SKU not active in {input.branch}")
    
    if sku_inv['current_stock'] < input.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient SKU stock. Required: {input.quantity}, Available: {sku_inv['current_stock']}"
        )
    
    entry_obj = DispatchEntry(**input.model_dump())
    doc = entry_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['date'] = doc['date'].isoformat()
    await db.dispatch_entries.insert_one(doc)
    
    await db.branch_sku_inventory.update_one(
        {"sku_id": input.sku_id, "branch": input.branch},
        {"$inc": {"current_stock": -input.quantity}}
    )
    
    return entry_obj

@api_router.get("/dispatch-entries")
async def get_dispatch_entries(branch: Optional[str] = None, sku_id: Optional[str] = None):
    query = {}
    if branch:
        query["branch"] = branch
    if sku_id:
        query["sku_id"] = sku_id
    
    entries = await db.dispatch_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [serialize_doc(e) for e in entries]

# ============ Dashboard & Reports Routes ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(branch: Optional[str] = None):
    if not branch:
        raise HTTPException(status_code=400, detail="Branch parameter required")
    
    rm_count = await db.branch_rm_inventory.count_documents({"branch": branch, "is_active": True})
    sku_count = await db.branch_sku_inventory.count_documents({"branch": branch, "is_active": True})
    
    # Low stock
    rm_invs = await db.branch_rm_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    low_stock_rm = 0
    for rm_inv in rm_invs:
        rm = await db.raw_materials.find_one({"rm_id": rm_inv['rm_id']}, {"_id": 0})
        if rm and rm_inv['current_stock'] < rm.get('low_stock_threshold', 10):
            low_stock_rm += 1
    
    sku_invs = await db.branch_sku_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    low_stock_sku = 0
    for sku_inv in sku_invs:
        sku = await db.skus.find_one({"sku_id": sku_inv['sku_id']}, {"_id": 0})
        if sku and sku_inv['current_stock'] < sku.get('low_stock_threshold', 5):
            low_stock_sku += 1
    
    # Today's production
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_entries = await db.production_entries.find(
        {"branch": branch, "date": {"$gte": today_start.isoformat()}},
        {"_id": 0}
    ).to_list(1000)
    today_production = sum(e.get('quantity', 0) for e in today_entries)
    
    return {
        "total_rm_value": rm_count,
        "total_sku_value": sku_count,
        "low_stock_items": low_stock_rm + low_stock_sku,
        "today_production": int(today_production)
    }

@api_router.get("/reports/master-dashboard")
async def get_master_dashboard():
    stats_by_branch = {}
    for branch in BRANCHES:
        stats = await get_dashboard_stats(branch)
        stats_by_branch[branch] = stats
    
    total_rm = sum(s['total_rm_value'] for s in stats_by_branch.values())
    total_sku = sum(s['total_sku_value'] for s in stats_by_branch.values())
    total_low_stock = sum(s['low_stock_items'] for s in stats_by_branch.values())
    total_production = sum(s['today_production'] for s in stats_by_branch.values())
    
    return {
        "overall": {
            "total_rm_value": total_rm,
            "total_sku_value": total_sku,
            "low_stock_items": total_low_stock,
            "today_production": total_production
        },
        "by_branch": stats_by_branch
    }

@api_router.get("/reports/low-stock")
async def get_low_stock_report(branch: Optional[str] = None):
    if not branch:
        raise HTTPException(status_code=400, detail="Branch parameter required")
    
    low_stock_rm = []
    rm_invs = await db.branch_rm_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    for rm_inv in rm_invs:
        rm = await db.raw_materials.find_one({"rm_id": rm_inv['rm_id']}, {"_id": 0})
        if rm and rm_inv['current_stock'] < rm.get('low_stock_threshold', 10):
            rm_data = rm.copy()
            rm_data['current_stock'] = rm_inv['current_stock']
            low_stock_rm.append(serialize_doc(rm_data))
    
    low_stock_sku = []
    sku_invs = await db.branch_sku_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    for sku_inv in sku_invs:
        sku = await db.skus.find_one({"sku_id": sku_inv['sku_id']}, {"_id": 0})
        if sku and sku_inv['current_stock'] < sku.get('low_stock_threshold', 5):
            sku_data = sku.copy()
            sku_data['current_stock'] = sku_inv['current_stock']
            low_stock_sku.append(serialize_doc(sku_data))
    
    return {
        "raw_materials": low_stock_rm,
        "skus": low_stock_sku
    }

@api_router.get("/reports/production-summary")
async def get_production_summary(days: int = 7, branch: Optional[str] = None):
    if not branch:
        raise HTTPException(status_code=400, detail="Branch parameter required")
    
    from datetime import timedelta
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    entries = await db.production_entries.find(
        {"branch": branch, "date": {"$gte": start_date.isoformat()}},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    daily_summary = {}
    for entry in entries:
        date_str = entry['date'][:10]
        if date_str not in daily_summary:
            daily_summary[date_str] = {"total_quantity": 0, "items": []}
        daily_summary[date_str]["total_quantity"] += entry['quantity']
        daily_summary[date_str]["items"].append(entry)
    
    return {
        "entries": [serialize_doc(e) for e in entries],
        "daily_summary": daily_summary
    }

@api_router.get("/reports/inventory")
async def get_inventory_report(branch: Optional[str] = None):
    if not branch:
        raise HTTPException(status_code=400, detail="Branch parameter required")
    
    rm_invs = await db.branch_rm_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    raw_materials = []
    for rm_inv in rm_invs:
        rm = await db.raw_materials.find_one({"rm_id": rm_inv['rm_id']}, {"_id": 0})
        if rm:
            rm_data = rm.copy()
            rm_data['current_stock'] = rm_inv['current_stock']
            raw_materials.append(serialize_doc(rm_data))
    
    sku_invs = await db.branch_sku_inventory.find({"branch": branch, "is_active": True}, {"_id": 0}).to_list(1000)
    skus = []
    for sku_inv in sku_invs:
        sku = await db.skus.find_one({"sku_id": sku_inv['sku_id']}, {"_id": 0})
        if sku:
            sku_data = sku.copy()
            sku_data['current_stock'] = sku_inv['current_stock']
            skus.append(serialize_doc(sku_data))
    
    return {
        "raw_materials": raw_materials,
        "skus": skus
    }

# ============ Production Planning Routes ============

@api_router.post("/production-plans/bulk-upload")
async def bulk_upload_production_plan(file: UploadFile = File(...), branch: str = "Unit 1 Vedica"):
    """Upload production plan for the month"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        created_count = 0
        skipped_count = 0
        errors = []
        
        # Expected format: Date, SKU_ID, Planned_Quantity
        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0] or not row[1]:
                continue
            
            try:
                date_val = row[0]
                if isinstance(date_val, str):
                    date_obj = datetime.strptime(date_val, "%Y-%m-%d")
                else:
                    date_obj = datetime.combine(date_val, datetime.min.time())
                
                sku_id = str(row[1]).strip()
                planned_qty = float(row[2]) if row[2] else 0
                
                if planned_qty <= 0:
                    errors.append(f"Row {idx}: Invalid quantity")
                    continue
                
                # Check if SKU exists globally
                sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
                if not sku:
                    errors.append(f"Row {idx}: SKU {sku_id} not found")
                    continue
                
                plan_month = date_obj.strftime("%Y-%m")
                
                # Check if entry already exists
                existing = await db.production_plans.find_one({
                    "branch": branch,
                    "date": date_obj.isoformat(),
                    "sku_id": sku_id
                }, {"_id": 0})
                
                if existing:
                    # Update existing
                    await db.production_plans.update_one(
                        {"branch": branch, "date": date_obj.isoformat(), "sku_id": sku_id},
                        {"$set": {"planned_quantity": planned_qty, "plan_month": plan_month}}
                    )
                    skipped_count += 1
                else:
                    plan_obj = ProductionPlanEntry(
                        branch=branch,
                        plan_month=plan_month,
                        date=date_obj,
                        sku_id=sku_id,
                        planned_quantity=planned_qty
                    )
                    doc = plan_obj.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    doc['date'] = doc['date'].isoformat()
                    await db.production_plans.insert_one(doc)
                    created_count += 1
                    
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
        
        return {
            "created": created_count,
            "updated": skipped_count,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.get("/production-plans")
async def get_production_plans(branch: str, plan_month: Optional[str] = None):
    """Get production plans for a branch"""
    query = {"branch": branch}
    if plan_month:
        query["plan_month"] = plan_month
    
    plans = await db.production_plans.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    return [serialize_doc(p) for p in plans]

@api_router.delete("/production-plans/{plan_month}")
async def delete_production_plan(plan_month: str, branch: str):
    """Delete production plan for a specific month"""
    result = await db.production_plans.delete_many({"branch": branch, "plan_month": plan_month})
    return {"message": f"Deleted {result.deleted_count} plan entries"}

@api_router.get("/production-plans/shortage-analysis")
async def get_shortage_analysis(branch: str, plan_month: str):
    """Calculate RM shortages based on production plan"""
    # Get all plans for the month
    plans = await db.production_plans.find(
        {"branch": branch, "plan_month": plan_month},
        {"_id": 0}
    ).to_list(1000)
    
    if not plans:
        raise HTTPException(status_code=404, detail="No production plan found for this month")
    
    # Calculate total RM requirements
    rm_requirements = {}  # {rm_id: total_required}
    sku_details = {}  # {sku_id: {name, total_planned}}
    
    for plan in plans:
        sku_id = plan['sku_id']
        planned_qty = plan['planned_quantity']
        
        # Get SKU details
        if sku_id not in sku_details:
            sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
            if sku:
                sku_details[sku_id] = {
                    "name": sku.get('description', sku_id),
                    "total_planned": 0
                }
        
        if sku_id in sku_details:
            sku_details[sku_id]["total_planned"] += planned_qty
        
        # Get BOM mapping
        mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
        if mapping:
            for rm_mapping in mapping['rm_mappings']:
                rm_id = rm_mapping['rm_id']
                qty_per_unit = rm_mapping['quantity_required']
                total_required = qty_per_unit * planned_qty
                
                if rm_id in rm_requirements:
                    rm_requirements[rm_id] += total_required
                else:
                    rm_requirements[rm_id] = total_required
    
    # Get current inventory levels
    shortage_report = []
    sufficient_stock = []
    
    for rm_id, total_required in rm_requirements.items():
        # Get RM details
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        if not rm:
            continue
        
        # Get current stock in branch
        rm_inv = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_id, "branch": branch, "is_active": True},
            {"_id": 0}
        )
        
        current_stock = rm_inv['current_stock'] if rm_inv else 0
        shortage = total_required - current_stock
        
        rm_info = {
            "rm_id": rm_id,
            "category": rm.get('category', ''),
            "category_data": rm.get('category_data', {}),
            "total_required": round(total_required, 2),
            "current_stock": round(current_stock, 2),
            "shortage": round(shortage, 2) if shortage > 0 else 0,
            "status": "shortage" if shortage > 0 else "sufficient"
        }
        
        if shortage > 0:
            shortage_report.append(rm_info)
        else:
            sufficient_stock.append(rm_info)
    
    # Calculate plan summary
    total_skus = len(sku_details)
    total_units = sum(s['total_planned'] for s in sku_details.values())
    total_rm_types = len(rm_requirements)
    rm_with_shortage = len(shortage_report)
    
    return {
        "plan_summary": {
            "branch": branch,
            "plan_month": plan_month,
            "total_skus": total_skus,
            "total_units_planned": int(total_units),
            "total_rm_types": total_rm_types,
            "rm_with_shortage": rm_with_shortage,
            "plan_entries": len(plans)
        },
        "sku_details": sku_details,
        "shortage_report": sorted(shortage_report, key=lambda x: x['shortage'], reverse=True),
        "sufficient_stock": sufficient_stock
    }

@api_router.get("/production-plans/months")
async def get_available_plan_months(branch: str):
    """Get list of months with production plans"""
    plans = await db.production_plans.find({"branch": branch}, {"_id": 0, "plan_month": 1}).to_list(1000)
    months = list(set(p['plan_month'] for p in plans))
    months.sort(reverse=True)
    return {"months": months}

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