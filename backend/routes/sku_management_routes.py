"""
Bidso SKU and Buyer SKU Routes

Endpoints for managing the two-level SKU architecture:
- Bidso SKU: Base product with common BOM
- Buyer SKU: Branded variants with brand-specific additions

BOM Management:
- Common BOM: Locked at Bidso SKU level
- Brand-specific BOM: Per-brand additions (labels, packaging)
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import io

from database import db
from models.sku_models import (
    BidsoSKU, BidsoSKUCreate, BidsoSKUUpdate,
    BuyerSKU, BuyerSKUCreate, BuyerSKUUpdate,
    CommonBOM, CommonBOMCreate, BOMItem,
    BrandSpecificBOM, BrandSpecificBOMCreate,
    FullBOM, SKUMigrationResult
)
from services.utils import get_current_user, serialize_doc, get_next_rm_sequence, generate_rm_name

router = APIRouter(prefix="/sku-management", tags=["SKU Management"])


# ============ Helper Functions ============

async def get_next_numeric_code(vertical_code: str, model_code: str) -> str:
    """Generate next available numeric code for a Bidso SKU"""
    prefix = f"{vertical_code}_{model_code}_"
    
    # Find all existing Bidso SKUs with this prefix
    existing = await db.bidso_skus.find(
        {"bidso_sku_id": {"$regex": f"^{prefix}"}},
        {"bidso_sku_id": 1, "_id": 0}
    ).to_list(10000)
    
    max_num = 0
    for item in existing:
        sku_id = item.get("bidso_sku_id", "")
        parts = sku_id.split("_")
        if len(parts) >= 3:
            try:
                num = int(parts[-1])
                if num > max_num:
                    max_num = num
            except ValueError:
                continue
    
    return str(max_num + 1).zfill(3)


async def generate_bidso_sku_id(vertical_code: str, model_code: str, numeric_code: str) -> str:
    """Generate Bidso SKU ID: {VerticalCode}_{ModelCode}_{NumericCode}"""
    return f"{vertical_code}_{model_code}_{numeric_code}"


async def generate_buyer_sku_id(brand_code: str, bidso_sku_id: str) -> str:
    """Generate Buyer SKU ID: {BrandCode}_{BidsoSKU}"""
    return f"{brand_code}_{bidso_sku_id}"


# ============ Bidso SKU CRUD ============

@router.get("/bidso-skus")
async def get_bidso_skus(
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: bool = False
):
    """Get all Bidso SKUs with optional filters"""
    query = {}
    if not include_inactive:
        query["status"] = "ACTIVE"
    if vertical_id:
        query["vertical_id"] = vertical_id
    if model_id:
        query["model_id"] = model_id
    
    bidso_skus = await db.bidso_skus.find(query, {"_id": 0}).to_list(10000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        bidso_skus = [s for s in bidso_skus if
                      search_lower in s.get("bidso_sku_id", "").lower() or
                      search_lower in s.get("name", "").lower() or
                      search_lower in s.get("description", "").lower()]
    
    # Enrich with related data
    for sku in bidso_skus:
        # Get vertical name
        if sku.get("vertical_id"):
            v = await db.verticals.find_one({"id": sku["vertical_id"]}, {"_id": 0, "name": 1, "code": 1})
            sku["vertical_name"] = v["name"] if v else None
        
        # Get model name
        if sku.get("model_id"):
            m = await db.models.find_one({"id": sku["model_id"]}, {"_id": 0, "name": 1, "code": 1})
            sku["model_name"] = m["name"] if m else None
        
        # Get count of buyer SKUs
        buyer_count = await db.buyer_skus.count_documents({"bidso_sku_id": sku["bidso_sku_id"]})
        sku["buyer_sku_count"] = buyer_count
        
        # Check if BOM is locked
        common_bom = await db.common_bom.find_one({"bidso_sku_id": sku["bidso_sku_id"]}, {"_id": 0, "is_locked": 1})
        sku["has_bom"] = common_bom is not None
        sku["bom_locked"] = common_bom.get("is_locked", False) if common_bom else False
    
    return bidso_skus


@router.get("/bidso-skus/{bidso_sku_id}")
async def get_bidso_sku(bidso_sku_id: str):
    """Get a single Bidso SKU by ID"""
    sku = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    # Enrich with related data
    if sku.get("vertical_id"):
        v = await db.verticals.find_one({"id": sku["vertical_id"]}, {"_id": 0, "name": 1})
        sku["vertical_name"] = v["name"] if v else None
    
    if sku.get("model_id"):
        m = await db.models.find_one({"id": sku["model_id"]}, {"_id": 0, "name": 1})
        sku["model_name"] = m["name"] if m else None
    
    # Get buyer SKUs
    buyer_skus = await db.buyer_skus.find(
        {"bidso_sku_id": bidso_sku_id},
        {"_id": 0}
    ).to_list(1000)
    sku["buyer_skus"] = buyer_skus
    
    # Get common BOM
    common_bom = await db.common_bom.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    sku["common_bom"] = common_bom
    
    return sku


@router.post("/bidso-skus")
async def create_bidso_sku(data: BidsoSKUCreate):
    """Create a new Bidso SKU"""
    # Get vertical info
    vertical = await db.verticals.find_one({"id": data.vertical_id}, {"_id": 0})
    if not vertical:
        raise HTTPException(status_code=404, detail="Vertical not found")
    
    # Get model info
    model = await db.models.find_one({"id": data.model_id}, {"_id": 0})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    vertical_code = vertical["code"]
    model_code = model["code"]
    
    # Generate or validate numeric code
    if data.numeric_code:
        numeric_code = data.numeric_code.zfill(3)
    else:
        numeric_code = await get_next_numeric_code(vertical_code, model_code)
    
    # Generate Bidso SKU ID
    bidso_sku_id = await generate_bidso_sku_id(vertical_code, model_code, numeric_code)
    
    # Check if already exists
    existing = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Bidso SKU {bidso_sku_id} already exists")
    
    # Create Bidso SKU
    bidso_sku = {
        "id": str(uuid.uuid4()),
        "bidso_sku_id": bidso_sku_id,
        "vertical_id": data.vertical_id,
        "vertical_code": vertical_code,
        "model_id": data.model_id,
        "model_code": model_code,
        "numeric_code": numeric_code,
        "name": data.name or f"{vertical['name']} - {model['name']}",
        "description": data.description,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.bidso_skus.insert_one(bidso_sku)
    del bidso_sku["_id"]
    
    return bidso_sku


@router.put("/bidso-skus/{bidso_sku_id}")
async def update_bidso_sku(bidso_sku_id: str, data: BidsoSKUUpdate):
    """Update a Bidso SKU"""
    existing = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.status is not None:
        update_data["status"] = data.status
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.bidso_skus.update_one(
            {"bidso_sku_id": bidso_sku_id},
            {"$set": update_data}
        )
    
    return {"message": "Bidso SKU updated"}


@router.delete("/bidso-skus/{bidso_sku_id}")
async def delete_bidso_sku(bidso_sku_id: str):
    """Soft delete a Bidso SKU (sets status to INACTIVE)"""
    # Check for active buyer SKUs
    buyer_count = await db.buyer_skus.count_documents({
        "bidso_sku_id": bidso_sku_id,
        "status": "ACTIVE"
    })
    if buyer_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {buyer_count} active Buyer SKUs reference this Bidso SKU"
        )
    
    result = await db.bidso_skus.update_one(
        {"bidso_sku_id": bidso_sku_id},
        {"$set": {"status": "INACTIVE", "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    return {"message": "Bidso SKU deleted"}


@router.get("/bidso-skus/next-code")
async def suggest_numeric_code(vertical_id: str, model_id: str):
    """Get next available numeric code for a vertical/model combination"""
    vertical = await db.verticals.find_one({"id": vertical_id}, {"_id": 0, "code": 1})
    model = await db.models.find_one({"id": model_id}, {"_id": 0, "code": 1})
    
    if not vertical or not model:
        raise HTTPException(status_code=404, detail="Vertical or Model not found")
    
    next_code = await get_next_numeric_code(vertical["code"], model["code"])
    
    return {
        "suggested_code": next_code,
        "preview_sku_id": f"{vertical['code']}_{model['code']}_{next_code}"
    }


# ============ Buyer SKU CRUD ============

@router.get("/buyer-skus")
async def get_buyer_skus(
    bidso_sku_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    buyer_id: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: bool = False
):
    """Get all Buyer SKUs with optional filters"""
    query = {}
    if not include_inactive:
        query["status"] = "ACTIVE"
    if bidso_sku_id:
        query["bidso_sku_id"] = bidso_sku_id
    if brand_id:
        query["brand_id"] = brand_id
    if buyer_id:
        query["buyer_id"] = buyer_id
    
    buyer_skus = await db.buyer_skus.find(query, {"_id": 0}).to_list(10000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        buyer_skus = [s for s in buyer_skus if
                      search_lower in s.get("buyer_sku_id", "").lower() or
                      search_lower in s.get("bidso_sku_id", "").lower() or
                      search_lower in s.get("name", "").lower()]
    
    # Enrich with related data
    for sku in buyer_skus:
        # Get brand name
        if sku.get("brand_id"):
            b = await db.brands.find_one({"id": sku["brand_id"]}, {"_id": 0, "name": 1})
            sku["brand_name"] = b["name"] if b else None
        
        # Get buyer name
        if sku.get("buyer_id"):
            bu = await db.buyers.find_one({"id": sku["buyer_id"]}, {"_id": 0, "name": 1})
            sku["buyer_name"] = bu["name"] if bu else None
        
        # Get parent Bidso SKU info
        if sku.get("bidso_sku_id"):
            bidso = await db.bidso_skus.find_one(
                {"bidso_sku_id": sku["bidso_sku_id"]},
                {"_id": 0, "name": 1, "vertical_code": 1, "model_code": 1}
            )
            if bidso:
                sku["bidso_name"] = bidso.get("name")
                sku["vertical_code"] = bidso.get("vertical_code")
                sku["model_code"] = bidso.get("model_code")
    
    return buyer_skus


@router.get("/buyer-skus/{buyer_sku_id}")
async def get_buyer_sku(buyer_sku_id: str):
    """Get a single Buyer SKU by ID"""
    sku = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="Buyer SKU not found")
    
    # Enrich with related data
    if sku.get("brand_id"):
        b = await db.brands.find_one({"id": sku["brand_id"]}, {"_id": 0, "name": 1})
        sku["brand_name"] = b["name"] if b else None
    
    if sku.get("buyer_id"):
        bu = await db.buyers.find_one({"id": sku["buyer_id"]}, {"_id": 0, "name": 1})
        sku["buyer_name"] = bu["name"] if bu else None
    
    # Get parent Bidso SKU
    if sku.get("bidso_sku_id"):
        bidso = await db.bidso_skus.find_one({"bidso_sku_id": sku["bidso_sku_id"]}, {"_id": 0})
        sku["bidso_sku"] = bidso
    
    # Get full BOM
    full_bom = await get_full_bom_for_buyer_sku(buyer_sku_id)
    sku["full_bom"] = full_bom
    
    return sku


@router.post("/buyer-skus")
async def create_buyer_sku(data: BuyerSKUCreate):
    """Create a new Buyer SKU"""
    # Validate Bidso SKU exists
    bidso = await db.bidso_skus.find_one({"bidso_sku_id": data.bidso_sku_id}, {"_id": 0})
    if not bidso:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    # Get brand info
    brand = await db.brands.find_one({"id": data.brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    brand_code = brand["code"]
    
    # Generate Buyer SKU ID: {BrandCode}_{BidsoSKU}
    buyer_sku_id = await generate_buyer_sku_id(brand_code, data.bidso_sku_id)
    
    # Check if already exists
    existing = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Buyer SKU {buyer_sku_id} already exists")
    
    # Create Buyer SKU
    buyer_sku = {
        "id": str(uuid.uuid4()),
        "buyer_sku_id": buyer_sku_id,
        "bidso_sku_id": data.bidso_sku_id,
        "brand_id": data.brand_id,
        "brand_code": brand_code,
        "buyer_id": data.buyer_id,
        "name": data.name or f"{brand['name']} - {bidso.get('name', data.bidso_sku_id)}",
        "description": data.description,
        "mrp": data.mrp,
        "selling_price": data.selling_price,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.buyer_skus.insert_one(buyer_sku)
    del buyer_sku["_id"]
    
    return buyer_sku


@router.post("/buyer-skus/bulk-create")
async def bulk_create_buyer_skus(bidso_sku_id: str, brand_ids: List[str]):
    """Create Buyer SKUs for multiple brands from a single Bidso SKU"""
    # Validate Bidso SKU
    bidso = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not bidso:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    created = []
    skipped = []
    
    for brand_id in brand_ids:
        brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
        if not brand:
            skipped.append({"brand_id": brand_id, "reason": "Brand not found"})
            continue
        
        brand_code = brand["code"]
        buyer_sku_id = await generate_buyer_sku_id(brand_code, bidso_sku_id)
        
        # Check if already exists
        existing = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
        if existing:
            skipped.append({"brand_id": brand_id, "reason": "Already exists"})
            continue
        
        # Create
        buyer_sku = {
            "id": str(uuid.uuid4()),
            "buyer_sku_id": buyer_sku_id,
            "bidso_sku_id": bidso_sku_id,
            "brand_id": brand_id,
            "brand_code": brand_code,
            "name": f"{brand['name']} - {bidso.get('name', bidso_sku_id)}",
            "description": "",
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.buyer_skus.insert_one(buyer_sku)
        created.append(buyer_sku_id)
    
    return {
        "created": len(created),
        "skipped": len(skipped),
        "created_ids": created,
        "skipped_details": skipped
    }


@router.put("/buyer-skus/{buyer_sku_id}")
async def update_buyer_sku(buyer_sku_id: str, data: BuyerSKUUpdate):
    """Update a Buyer SKU"""
    existing = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Buyer SKU not found")
    
    update_data = {}
    if data.buyer_id is not None:
        update_data["buyer_id"] = data.buyer_id
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.mrp is not None:
        update_data["mrp"] = data.mrp
    if data.selling_price is not None:
        update_data["selling_price"] = data.selling_price
    if data.status is not None:
        update_data["status"] = data.status
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.buyer_skus.update_one(
            {"buyer_sku_id": buyer_sku_id},
            {"$set": update_data}
        )
    
    return {"message": "Buyer SKU updated"}


@router.delete("/buyer-skus/{buyer_sku_id}")
async def delete_buyer_sku(buyer_sku_id: str):
    """Soft delete a Buyer SKU"""
    result = await db.buyer_skus.update_one(
        {"buyer_sku_id": buyer_sku_id},
        {"$set": {"status": "INACTIVE", "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Buyer SKU not found")
    
    return {"message": "Buyer SKU deleted"}


# ============ Common BOM Management ============

@router.get("/bom/common/{bidso_sku_id}")
async def get_common_bom(bidso_sku_id: str):
    """Get common BOM for a Bidso SKU"""
    bom = await db.common_bom.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not bom:
        return {
            "bidso_sku_id": bidso_sku_id,
            "items": [],
            "is_locked": False
        }
    
    # Enrich with RM names
    for item in bom.get("items", []):
        rm = await db.raw_materials.find_one({"rm_id": item["rm_id"]}, {"_id": 0, "name": 1})
        item["rm_name"] = rm["name"] if rm else None
    
    return bom


@router.post("/bom/common")
async def create_or_update_common_bom(data: CommonBOMCreate):
    """Create or update common BOM for a Bidso SKU"""
    # Check if Bidso SKU exists
    bidso = await db.bidso_skus.find_one({"bidso_sku_id": data.bidso_sku_id})
    if not bidso:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    # Check if BOM is locked
    existing = await db.common_bom.find_one({"bidso_sku_id": data.bidso_sku_id})
    if existing and existing.get("is_locked"):
        raise HTTPException(status_code=400, detail="BOM is locked and cannot be modified")
    
    # Validate all RM IDs
    items_data = []
    for item in data.items:
        rm = await db.raw_materials.find_one({"rm_id": item.rm_id}, {"_id": 0, "name": 1})
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw Material {item.rm_id} not found")
        items_data.append({
            "rm_id": item.rm_id,
            "rm_name": rm["name"],
            "quantity": item.quantity,
            "unit": item.unit
        })
    
    if existing:
        # Update existing
        await db.common_bom.update_one(
            {"bidso_sku_id": data.bidso_sku_id},
            {"$set": {
                "items": items_data,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    else:
        # Create new
        bom = {
            "id": str(uuid.uuid4()),
            "bidso_sku_id": data.bidso_sku_id,
            "items": items_data,
            "is_locked": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.common_bom.insert_one(bom)
    
    return {"message": "Common BOM saved"}


@router.post("/bom/common/{bidso_sku_id}/lock")
async def lock_common_bom(bidso_sku_id: str):
    """Lock the common BOM for a Bidso SKU"""
    result = await db.common_bom.update_one(
        {"bidso_sku_id": bidso_sku_id},
        {"$set": {
            "is_locked": True,
            "locked_at": datetime.now(timezone.utc)
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Common BOM not found")
    
    return {"message": "BOM locked successfully"}


@router.post("/bom/common/{bidso_sku_id}/unlock")
async def unlock_common_bom(bidso_sku_id: str):
    """Unlock the common BOM for a Bidso SKU (requires admin)"""
    result = await db.common_bom.update_one(
        {"bidso_sku_id": bidso_sku_id},
        {"$set": {
            "is_locked": False,
            "locked_at": None
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Common BOM not found")
    
    return {"message": "BOM unlocked successfully"}


# ============ Brand-specific BOM Management ============

@router.get("/bom/brand-specific/{bidso_sku_id}/{brand_id}")
async def get_brand_specific_bom(bidso_sku_id: str, brand_id: str):
    """Get brand-specific BOM additions"""
    bom = await db.brand_specific_bom.find_one(
        {"bidso_sku_id": bidso_sku_id, "brand_id": brand_id},
        {"_id": 0}
    )
    
    if not bom:
        brand = await db.brands.find_one({"id": brand_id}, {"_id": 0, "code": 1})
        return {
            "bidso_sku_id": bidso_sku_id,
            "brand_id": brand_id,
            "brand_code": brand["code"] if brand else None,
            "items": []
        }
    
    # Enrich with RM names
    for item in bom.get("items", []):
        rm = await db.raw_materials.find_one({"rm_id": item["rm_id"]}, {"_id": 0, "name": 1})
        item["rm_name"] = rm["name"] if rm else None
    
    return bom


@router.post("/bom/brand-specific")
async def create_or_update_brand_specific_bom(data: BrandSpecificBOMCreate):
    """Create or update brand-specific BOM additions"""
    # Validate Bidso SKU
    bidso = await db.bidso_skus.find_one({"bidso_sku_id": data.bidso_sku_id})
    if not bidso:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    # Validate Brand
    brand = await db.brands.find_one({"id": data.brand_id}, {"_id": 0, "code": 1})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    # Validate all RM IDs
    items_data = []
    for item in data.items:
        rm = await db.raw_materials.find_one({"rm_id": item.rm_id}, {"_id": 0, "name": 1})
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw Material {item.rm_id} not found")
        items_data.append({
            "rm_id": item.rm_id,
            "rm_name": rm["name"],
            "quantity": item.quantity,
            "unit": item.unit
        })
    
    existing = await db.brand_specific_bom.find_one({
        "bidso_sku_id": data.bidso_sku_id,
        "brand_id": data.brand_id
    })
    
    if existing:
        await db.brand_specific_bom.update_one(
            {"bidso_sku_id": data.bidso_sku_id, "brand_id": data.brand_id},
            {"$set": {
                "items": items_data,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    else:
        bom = {
            "id": str(uuid.uuid4()),
            "bidso_sku_id": data.bidso_sku_id,
            "brand_id": data.brand_id,
            "brand_code": brand["code"],
            "items": items_data,
            "created_at": datetime.now(timezone.utc)
        }
        await db.brand_specific_bom.insert_one(bom)
    
    return {"message": "Brand-specific BOM saved"}


@router.delete("/bom/brand-specific/{bidso_sku_id}/{brand_id}")
async def delete_brand_specific_bom(bidso_sku_id: str, brand_id: str):
    """Delete brand-specific BOM additions"""
    result = await db.brand_specific_bom.delete_one({
        "bidso_sku_id": bidso_sku_id,
        "brand_id": brand_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Brand-specific BOM not found")
    
    return {"message": "Brand-specific BOM deleted"}


# ============ Full BOM View ============

async def get_full_bom_for_buyer_sku(buyer_sku_id: str) -> dict:
    """Get combined BOM (common + brand-specific) for a Buyer SKU"""
    buyer_sku = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id}, {"_id": 0})
    if not buyer_sku:
        return None
    
    bidso_sku_id = buyer_sku["bidso_sku_id"]
    brand_id = buyer_sku["brand_id"]
    brand_code = buyer_sku["brand_code"]
    
    # Get common BOM
    common_bom = await db.common_bom.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    common_items = common_bom.get("items", []) if common_bom else []
    
    # Get brand-specific BOM
    brand_bom = await db.brand_specific_bom.find_one(
        {"bidso_sku_id": bidso_sku_id, "brand_id": brand_id},
        {"_id": 0}
    )
    brand_items = brand_bom.get("items", []) if brand_bom else []
    
    # Combine
    total_items = common_items + brand_items
    
    return {
        "buyer_sku_id": buyer_sku_id,
        "bidso_sku_id": bidso_sku_id,
        "brand_code": brand_code,
        "common_items": common_items,
        "brand_specific_items": brand_items,
        "total_items": total_items,
        "is_common_bom_locked": common_bom.get("is_locked", False) if common_bom else False
    }


@router.get("/bom/full/{buyer_sku_id}")
async def get_full_bom(buyer_sku_id: str):
    """Get full BOM for a Buyer SKU (common + brand-specific)"""
    full_bom = await get_full_bom_for_buyer_sku(buyer_sku_id)
    if not full_bom:
        raise HTTPException(status_code=404, detail="Buyer SKU not found")
    
    return full_bom


# ============ Migration from Old SKU Structure ============

@router.post("/migrate-skus")
async def migrate_skus_from_excel(file: UploadFile = File(...)):
    """
    Migrate SKUs from Excel file (SKU_RM_Mapping.xlsx format).
    Creates Bidso SKUs and Buyer SKUs from existing data.
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    
    # Parse SKUs
    sku_data = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        sku_id = str(row[0]).strip()
        rm_id = str(row[1]).strip() if row[1] else None
        qty = float(row[2]) if row[2] else 1.0
        
        if sku_id not in sku_data:
            sku_data[sku_id] = {"bom": []}
        
        if rm_id:
            sku_data[sku_id]["bom"].append({"rm_id": rm_id, "quantity": qty})
    
    result = SKUMigrationResult()
    result.total_processed = len(sku_data)
    
    # Get all brands
    brands = await db.brands.find({}, {"_id": 0}).to_list(100)
    brand_map = {b["code"]: b for b in brands}
    
    # Get all verticals and models
    verticals = await db.verticals.find({}, {"_id": 0}).to_list(100)
    vertical_code_map = {v["code"]: v for v in verticals}
    
    models = await db.models.find({}, {"_id": 0}).to_list(500)
    model_code_map = {m["code"]: m for m in models}
    
    for sku_id, data in sku_data.items():
        try:
            parts = sku_id.split("_")
            if len(parts) < 4:
                result.errors.append(f"{sku_id}: Invalid format (less than 4 parts)")
                continue
            
            brand_code = parts[0]
            vertical_code = parts[1]
            model_code = parts[2]
            numeric_code = parts[-1]
            
            # Handle compound model codes (e.g., BE_P becomes BE_P)
            if len(parts) > 4:
                model_code = "_".join(parts[2:-1])
            
            # Generate Bidso SKU ID
            bidso_sku_id = f"{vertical_code}_{model_code}_{numeric_code}"
            
            # Check/create Bidso SKU
            existing_bidso = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id})
            
            if not existing_bidso:
                # Find vertical and model
                vertical = vertical_code_map.get(vertical_code)
                model = model_code_map.get(model_code)
                
                if not vertical or not model:
                    result.errors.append(f"{sku_id}: Vertical {vertical_code} or Model {model_code} not found")
                    continue
                
                bidso_sku = {
                    "id": str(uuid.uuid4()),
                    "bidso_sku_id": bidso_sku_id,
                    "vertical_id": vertical["id"],
                    "vertical_code": vertical_code,
                    "model_id": model["id"],
                    "model_code": model_code,
                    "numeric_code": numeric_code,
                    "name": f"{vertical['name']} - {model['name']}",
                    "description": "",
                    "status": "ACTIVE",
                    "created_at": datetime.now(timezone.utc)
                }
                await db.bidso_skus.insert_one(bidso_sku)
                result.bidso_skus_created += 1
                
                # Create common BOM
                if data["bom"]:
                    bom = {
                        "id": str(uuid.uuid4()),
                        "bidso_sku_id": bidso_sku_id,
                        "items": data["bom"],
                        "is_locked": False,
                        "created_at": datetime.now(timezone.utc)
                    }
                    await db.common_bom.insert_one(bom)
                    result.bom_migrated += 1
            
            # Check/create Buyer SKU
            brand = brand_map.get(brand_code)
            if brand:
                buyer_sku_id = f"{brand_code}_{bidso_sku_id}"
                existing_buyer = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
                
                if not existing_buyer:
                    buyer_sku = {
                        "id": str(uuid.uuid4()),
                        "buyer_sku_id": buyer_sku_id,
                        "bidso_sku_id": bidso_sku_id,
                        "brand_id": brand["id"],
                        "brand_code": brand_code,
                        "name": f"{brand['name']} - {bidso_sku_id}",
                        "description": "",
                        "status": "ACTIVE",
                        "created_at": datetime.now(timezone.utc)
                    }
                    await db.buyer_skus.insert_one(buyer_sku)
                    result.buyer_skus_created += 1
            else:
                result.errors.append(f"{sku_id}: Brand {brand_code} not found")
        
        except Exception as e:
            result.errors.append(f"{sku_id}: {str(e)}")
    
    return result


@router.get("/migration-stats")
async def get_migration_stats():
    """Get current state of SKU migration"""
    bidso_count = await db.bidso_skus.count_documents({})
    buyer_count = await db.buyer_skus.count_documents({})
    common_bom_count = await db.common_bom.count_documents({})
    brand_bom_count = await db.brand_specific_bom.count_documents({})
    
    old_sku_count = await db.skus.count_documents({})
    
    return {
        "bidso_skus": bidso_count,
        "buyer_skus": buyer_count,
        "common_boms": common_bom_count,
        "brand_specific_boms": brand_bom_count,
        "old_skus": old_sku_count,
        "collections_created": ["bidso_skus", "buyer_skus", "common_bom", "brand_specific_bom"]
    }


# ============ Clone & Customize Bidso SKU ============

@router.get("/bidso-skus/{bidso_sku_id}/bom-for-clone")
async def get_bom_for_clone(bidso_sku_id: str):
    """
    Get Common BOM of a Bidso SKU formatted for cloning.
    Returns BOM items with edit permissions based on category:
    - INP, INM: Editable (colour change only)
    - ACC: Editable (colour change or complete swap)
    - Others (ELC, SP, etc.): Locked
    """
    # Get the Bidso SKU
    bidso_sku = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not bidso_sku:
        raise HTTPException(status_code=404, detail="Bidso SKU not found")
    
    # Get the Common BOM
    common_bom = await db.common_bom.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not common_bom or not common_bom.get("items"):
        raise HTTPException(status_code=404, detail="No BOM found for this Bidso SKU")
    
    # Enrich BOM items with RM details and edit permissions
    enriched_items = []
    for item in common_bom.get("items", []):
        rm_id = item.get("rm_id")
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        
        if rm:
            category = rm.get("category", "")
            category_data = rm.get("category_data", {})
            
            # Determine edit type based on category
            if category in ["INP", "INM"]:
                edit_type = "COLOUR_ONLY"  # Can only change colour variant
            elif category == "ACC":
                edit_type = "COLOUR_OR_SWAP"  # Can change colour or swap entirely
            else:
                edit_type = "LOCKED"  # Cannot edit
            
            enriched_items.append({
                "rm_id": rm_id,
                "rm_name": category_data.get("name", ""),
                "category": category,
                "category_data": category_data,
                "quantity": item.get("quantity", 1),
                "unit": item.get("unit", "nos"),
                "edit_type": edit_type,
                "colour": category_data.get("colour", ""),
                "model_name": category_data.get("model_name", ""),
                "part_name": category_data.get("part_name", ""),
            })
    
    return {
        "source_sku": bidso_sku,
        "bom_items": enriched_items,
        "total_items": len(enriched_items),
        "editable_count": len([i for i in enriched_items if i["edit_type"] != "LOCKED"]),
        "locked_count": len([i for i in enriched_items if i["edit_type"] == "LOCKED"])
    }


@router.get("/raw-materials/colour-variants/{rm_id}")
async def get_colour_variants(rm_id: str):
    """
    Find colour variants of an RM (same base part, different colours).
    For INP/INM: Same mould_code/model_name + part_name, different colour
    For ACC: Same type + model_name + specs, different colour
    """
    # Get the source RM
    source_rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
    if not source_rm:
        raise HTTPException(status_code=404, detail="RM not found")
    
    category = source_rm.get("category", "")
    category_data = source_rm.get("category_data", {})
    
    query = {"category": category, "rm_id": {"$ne": rm_id}}
    
    if category == "INP":
        # Match by mould_code, model_name, part_name
        query["category_data.mould_code"] = category_data.get("mould_code")
        query["category_data.model_name"] = category_data.get("model_name")
        query["category_data.part_name"] = category_data.get("part_name")
    elif category == "INM":
        # Match by model_name, part_name
        query["category_data.model_name"] = category_data.get("model_name")
        query["category_data.part_name"] = category_data.get("part_name")
    elif category == "ACC":
        # Match by type, model_name, specs
        query["category_data.type"] = category_data.get("type")
        query["category_data.model_name"] = category_data.get("model_name")
        query["category_data.specs"] = category_data.get("specs")
    else:
        return {"variants": [], "message": "Category does not support colour variants"}
    
    # Find variants
    variants = await db.raw_materials.find(query, {"_id": 0}).to_list(100)
    
    # Format response
    result = []
    for v in variants:
        v_data = v.get("category_data", {})
        result.append({
            "rm_id": v.get("rm_id"),
            "category": v.get("category"),
            "colour": v_data.get("colour", "N/A"),
            "name": v_data.get("name", ""),
            "category_data": v_data
        })
    
    return {
        "source_rm": {
            "rm_id": rm_id,
            "colour": category_data.get("colour", "N/A"),
            "name": category_data.get("name", "")
        },
        "variants": result,
        "total_variants": len(result)
    }


@router.get("/raw-materials/search-for-swap")
async def search_rm_for_swap(
    category: str,
    search: Optional[str] = None,
    limit: int = 50
):
    """
    Search RMs for swapping (ACC category).
    Returns RMs in same category that can replace current RM.
    """
    query = {"category": category}
    
    rms = await db.raw_materials.find(query, {"_id": 0}).to_list(1000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        rms = [rm for rm in rms if 
               search_lower in rm.get("rm_id", "").lower() or
               search_lower in rm.get("category_data", {}).get("name", "").lower() or
               search_lower in rm.get("category_data", {}).get("type", "").lower() or
               search_lower in rm.get("category_data", {}).get("model_name", "").lower()]
    
    # Format response
    result = []
    for rm in rms[:limit]:
        cd = rm.get("category_data", {})
        result.append({
            "rm_id": rm.get("rm_id"),
            "category": rm.get("category"),
            "name": cd.get("name", ""),
            "type": cd.get("type", ""),
            "model_name": cd.get("model_name", ""),
            "specs": cd.get("specs", ""),
            "colour": cd.get("colour", ""),
            "category_data": cd
        })
    
    return {"results": result, "total": len(result)}


@router.post("/bidso-skus/clone")
async def clone_bidso_sku(data: dict, current_user = Depends(get_current_user)):
    """
    Create a new Bidso SKU by cloning an existing one with modifications.
    
    Request body:
    {
        "source_bidso_sku_id": "KS_PE_001",
        "name": "Kids Scooter - Red",
        "description": "Red colour variant",
        "bom_modifications": [
            {"original_rm_id": "INP_001", "new_rm_id": "INP_003"},  // Colour swap
            {"original_rm_id": "ACC_010", "new_rm_id": "ACC_015"}   // ACC replacement
        ],
        "new_rms_to_create": [  // Optional: Create new RMs on-the-fly
            {
                "category": "INP",
                "category_data": {"mould_code": "M001", "model_name": "Body", "part_name": "Shell", "colour": "Red", "mb": "Red MB"},
                "replaces_rm_id": "INP_001"
            }
        ]
    }
    """
    source_sku_id = data.get("source_bidso_sku_id")
    if not source_sku_id:
        raise HTTPException(status_code=400, detail="source_bidso_sku_id is required")
    
    # Get source Bidso SKU
    source_sku = await db.bidso_skus.find_one({"bidso_sku_id": source_sku_id}, {"_id": 0})
    if not source_sku:
        raise HTTPException(status_code=404, detail="Source Bidso SKU not found")
    
    # Get source BOM
    source_bom = await db.common_bom.find_one({"bidso_sku_id": source_sku_id}, {"_id": 0})
    if not source_bom:
        raise HTTPException(status_code=404, detail="Source BOM not found")
    
    # Generate new Bidso SKU ID
    vertical_code = source_sku.get("vertical_code")
    model_code = source_sku.get("model_code")
    numeric_code = await get_next_numeric_code(vertical_code, model_code)
    new_bidso_sku_id = f"{vertical_code}_{model_code}_{numeric_code}"
    
    # Check if already exists
    existing = await db.bidso_skus.find_one({"bidso_sku_id": new_bidso_sku_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Bidso SKU {new_bidso_sku_id} already exists")
    
    # Create new RMs on-the-fly if specified
    new_rm_mapping = {}  # original_rm_id -> new_rm_id
    new_rms_to_create = data.get("new_rms_to_create", [])
    
    from services.utils import get_next_rm_sequence, generate_rm_name
    
    for new_rm_data in new_rms_to_create:
        category = new_rm_data.get("category")
        category_data = new_rm_data.get("category_data", {})
        replaces_rm_id = new_rm_data.get("replaces_rm_id")
        
        # Generate RM ID
        seq = await get_next_rm_sequence(category)
        new_rm_id = f"{category}_{seq:05d}"
        
        # Generate name from nomenclature
        rm_name = generate_rm_name(category, category_data)
        if rm_name:
            category_data["name"] = rm_name
        
        # Create the RM
        new_rm = {
            "id": str(uuid.uuid4()),
            "rm_id": new_rm_id,
            "category": category,
            "category_data": category_data,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.id
        }
        await db.raw_materials.insert_one(new_rm)
        
        if replaces_rm_id:
            new_rm_mapping[replaces_rm_id] = new_rm_id
    
    # Process BOM modifications
    bom_modifications = data.get("bom_modifications", [])
    for mod in bom_modifications:
        original_rm_id = mod.get("original_rm_id")
        new_rm_id = mod.get("new_rm_id")
        if original_rm_id and new_rm_id:
            new_rm_mapping[original_rm_id] = new_rm_id
    
    # Create new BOM by copying source and applying modifications
    new_bom_items = []
    for item in source_bom.get("items", []):
        rm_id = item.get("rm_id")
        
        # Check if this RM should be swapped
        if rm_id in new_rm_mapping:
            new_rm_id = new_rm_mapping[rm_id]
            # Get new RM name
            new_rm = await db.raw_materials.find_one({"rm_id": new_rm_id}, {"_id": 0})
            rm_name = new_rm.get("category_data", {}).get("name", "") if new_rm else ""
            new_bom_items.append({
                "rm_id": new_rm_id,
                "rm_name": rm_name,
                "quantity": item.get("quantity", 1),
                "unit": item.get("unit", "nos")
            })
        else:
            # Keep original
            new_bom_items.append(item)
    
    # Create new Bidso SKU
    new_bidso_sku = {
        "id": str(uuid.uuid4()),
        "bidso_sku_id": new_bidso_sku_id,
        "vertical_id": source_sku.get("vertical_id"),
        "vertical_code": vertical_code,
        "model_id": source_sku.get("model_id"),
        "model_code": model_code,
        "numeric_code": numeric_code,
        "name": data.get("name", f"{source_sku.get('name', '')} - Variant"),
        "description": data.get("description", f"Cloned from {source_sku_id}"),
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    await db.bidso_skus.insert_one(new_bidso_sku)
    
    # Create new Common BOM
    new_common_bom = {
        "id": str(uuid.uuid4()),
        "bidso_sku_id": new_bidso_sku_id,
        "items": new_bom_items,
        "is_locked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    await db.common_bom.insert_one(new_common_bom)
    
    return {
        "message": "Bidso SKU cloned successfully",
        "new_bidso_sku_id": new_bidso_sku_id,
        "source_bidso_sku_id": source_sku_id,
        "bom_items_count": len(new_bom_items),
        "modifications_applied": len(new_rm_mapping),
        "new_rms_created": len(new_rms_to_create)
    }

