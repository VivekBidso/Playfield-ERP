"""Tech Ops routes - Verticals, Models, Brands, Buyers, BOM"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import io

from database import db
from models.master_data import (
    Vertical, VerticalCreate,
    Model, ModelCreate,
    Brand, BrandCreate,
    Buyer, BuyerCreate, BuyerUpdate, BuyerBulkImport
)

router = APIRouter(tags=["Tech Ops"])

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return doc

# --- Verticals CRUD ---
@router.get("/verticals")
async def get_verticals():
    verticals = await db.verticals.find({}, {"_id": 0}).to_list(1000)
    return [serialize_doc(v) for v in verticals]

@router.post("/verticals")
async def create_vertical(data: VerticalCreate):
    existing = await db.verticals.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Vertical with code {data.code} already exists")
    
    vertical = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "name": data.name,
        "description": data.description,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    await db.verticals.insert_one(vertical)
    del vertical["_id"]
    return serialize_doc(vertical)

@router.put("/verticals/{vertical_id}")
async def update_vertical(vertical_id: str, data: VerticalCreate):
    result = await db.verticals.update_one(
        {"id": vertical_id},
        {"$set": {"code": data.code.upper(), "name": data.name, "description": data.description}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vertical not found")
    return {"message": "Vertical updated"}

@router.delete("/verticals/{vertical_id}")
async def delete_vertical(vertical_id: str):
    models_count = await db.models.count_documents({"vertical_id": vertical_id, "status": "ACTIVE"})
    if models_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {models_count} active models use this vertical")
    
    skus_count = await db.skus.count_documents({"vertical_id": vertical_id})
    if skus_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {skus_count} SKUs use this vertical")
    
    result = await db.verticals.update_one({"id": vertical_id}, {"$set": {"status": "INACTIVE"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vertical not found")
    return {"message": "Vertical deleted"}

# --- Models CRUD ---
@router.get("/models")
async def get_models(vertical_id: Optional[str] = None):
    query = {}
    if vertical_id:
        query["vertical_id"] = vertical_id
    models = await db.models.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(m) for m in models]

@router.post("/models")
async def create_model(data: ModelCreate):
    existing = await db.models.find_one({"vertical_id": data.vertical_id, "code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Model with code {data.code} already exists for this vertical")
    
    model = {
        "id": str(uuid.uuid4()),
        "vertical_id": data.vertical_id,
        "code": data.code.upper(),
        "name": data.name,
        "description": data.description,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    await db.models.insert_one(model)
    del model["_id"]
    return serialize_doc(model)

@router.put("/models/{model_id}")
async def update_model(model_id: str, data: ModelCreate):
    result = await db.models.update_one(
        {"id": model_id},
        {"$set": {"vertical_id": data.vertical_id, "code": data.code.upper(), "name": data.name, "description": data.description}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model updated"}

@router.delete("/models/{model_id}")
async def delete_model(model_id: str):
    skus_count = await db.skus.count_documents({"model_id": model_id})
    if skus_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {skus_count} SKUs use this model")
    
    result = await db.models.update_one({"id": model_id}, {"$set": {"status": "INACTIVE"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model deleted"}

# --- Brands CRUD ---
@router.get("/brands")
async def get_brands():
    brands = await db.brands.find({}, {"_id": 0}).to_list(1000)
    return [serialize_doc(b) for b in brands]

@router.post("/brands")
async def create_brand(data: BrandCreate):
    existing = await db.brands.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Brand with code {data.code} already exists")
    
    brand = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "name": data.name,
        "buyer_id": data.buyer_id,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    await db.brands.insert_one(brand)
    del brand["_id"]
    return serialize_doc(brand)

@router.put("/brands/{brand_id}")
async def update_brand(brand_id: str, data: BrandCreate):
    result = await db.brands.update_one(
        {"id": brand_id},
        {"$set": {"code": data.code.upper(), "name": data.name, "buyer_id": data.buyer_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"message": "Brand updated"}

@router.delete("/brands/{brand_id}")
async def delete_brand(brand_id: str):
    skus_count = await db.skus.count_documents({"brand_id": brand_id})
    if skus_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {skus_count} SKUs use this brand")
    
    result = await db.brands.update_one({"id": brand_id}, {"$set": {"status": "INACTIVE"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"message": "Brand deleted"}

# --- Buyers CRUD ---
@router.get("/buyers")
async def get_buyers():
    buyers = await db.buyers.find({}, {"_id": 0}).to_list(1000)
    return [serialize_doc(b) for b in buyers]

@router.post("/buyers")
async def create_buyer(data: BuyerCreate):
    existing = await db.buyers.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Buyer with code {data.code} already exists")
    
    buyer = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "name": data.name,
        "country": data.country,
        "contact_email": data.contact_email,
        "payment_terms_days": data.payment_terms_days,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    await db.buyers.insert_one(buyer)
    del buyer["_id"]
    return serialize_doc(buyer)

@router.get("/buyers/{buyer_id}")
async def get_buyer(buyer_id: str):
    buyer = await db.buyers.find_one({"id": buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return serialize_doc(buyer)

@router.put("/buyers/{buyer_id}")
async def update_buyer(buyer_id: str, data: BuyerCreate):
    result = await db.buyers.update_one(
        {"id": buyer_id},
        {"$set": {"code": data.code.upper(), "name": data.name, "country": data.country, 
                  "contact_email": data.contact_email, "payment_terms_days": data.payment_terms_days}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return {"message": "Buyer updated"}

@router.delete("/buyers/{buyer_id}")
async def delete_buyer(buyer_id: str):
    brands_count = await db.brands.count_documents({"buyer_id": buyer_id, "status": "ACTIVE"})
    if brands_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {brands_count} active brands use this buyer")
    
    result = await db.buyers.update_one({"id": buyer_id}, {"$set": {"status": "INACTIVE"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return {"message": "Buyer deleted"}



# --- Branches ---
BRANCHES = [
    "Unit 1 Vedica",
    "Unit 2 Trikes",
    "Unit 3 TM",
    "Unit 4 Goa",
    "Unit 5 Baabus",
    "Unit 6 Emox",
    "BHDG WH"
]

RM_CATEGORIES = {
    "INP": {"name": "In-house Plastic", "fields": ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"]},
    "INM": {"name": "In-house Metal", "fields": ["process", "model_name", "part_name", "specs", "per_unit_weight", "unit"]},
    "ACC": {"name": "Accessories", "fields": ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"]},
    "ELC": {"name": "Electric Components", "fields": ["model", "type", "specs", "per_unit_weight", "unit"]},
    "SP": {"name": "Spares", "fields": ["type", "specs", "per_unit_weight", "unit"]},
    "BS": {"name": "Brand Assets", "fields": ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"]},
    "PM": {"name": "Packaging", "fields": ["model", "type", "specs", "brand", "per_unit_weight", "unit"]},
    "LB": {"name": "Labels", "fields": ["type", "buyer_sku", "per_unit_weight", "unit"]}
}

@router.get("/branches")
async def get_branches():
    """Get all branches from database"""
    branches = await db.branches.find({}, {"_id": 0}).to_list(1000)
    return branches

@router.get("/branches/names")
async def get_branch_names():
    """Get branch names only"""
    return {"branches": BRANCHES}

@router.get("/rm-categories")
async def get_rm_categories():
    """Get all RM categories"""
    return RM_CATEGORIES
