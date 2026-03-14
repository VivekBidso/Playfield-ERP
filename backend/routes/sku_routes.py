"""SKU routes - SKU CRUD, mappings, subscriptions"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import openpyxl
import io

from database import db
from models import User, SKU, SKUCreate, SKUMapping, SKUMappingCreate, ActivateItemRequest
from services.utils import get_current_user, serialize_doc
from services.rbac_service import require_permission, check_user_permission

router = APIRouter(tags=["SKUs"])


@router.post("/skus", response_model=SKU)
@require_permission("BuyerSKU", "CREATE")
async def create_sku(input: SKUCreate, current_user: User = Depends(get_current_user)):
    """Create a new SKU (MASTER_ADMIN, DEMAND_PLANNER)"""
    # Check if SKU already exists
    existing = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU {input.sku_id} already exists")
    
    sku = SKU(**input.model_dump())
    doc = sku.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['created_by'] = current_user.id
    await db.skus.insert_one(doc)
    
    return sku


@router.get("/skus")
async def get_skus(
    branch: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: bool = False
):
    """Get all SKUs with optional filters"""
    query = {}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    skus = await db.skus.find(query, {"_id": 0}).to_list(10000)
    
    # Filter by search
    if search:
        search_lower = search.lower()
        skus = [s for s in skus if 
                search_lower in s.get("sku_id", "").lower() or
                search_lower in s.get("description", "").lower() or
                search_lower in s.get("vertical", "").lower() or
                search_lower in s.get("model", "").lower() or
                search_lower in s.get("brand", "").lower()]
    
    # Add branch-specific data
    if branch:
        for sku in skus:
            inv = await db.branch_sku_inventory.find_one(
                {"sku_id": sku["sku_id"], "branch": branch},
                {"_id": 0}
            )
            sku["branch_stock"] = inv.get("current_stock", 0) if inv else 0
            sku["is_active_in_branch"] = inv.get("is_active", False) if inv else False
            
            # Get FG inventory
            fg = await db.fg_inventory.find_one(
                {"sku_id": sku["sku_id"], "branch": branch},
                {"_id": 0}
            )
            sku["fg_stock"] = fg.get("quantity", 0) if fg else 0
    
    return skus


@router.get("/skus/unmapped")
async def get_skus_without_rm_mapping():
    """Get SKUs that don't have RM mappings"""
    all_skus = await db.skus.find({"status": {"$ne": "INACTIVE"}}, {"sku_id": 1, "_id": 0}).to_list(10000)
    
    # Get all mapped SKUs
    mappings = await db.sku_mappings.find({}, {"sku_id": 1, "_id": 0}).to_list(10000)
    bom_mappings = await db.bill_of_materials.find({}, {"sku_id": 1, "_id": 0}).to_list(10000)
    
    mapped_ids = set(m["sku_id"] for m in mappings) | set(m["sku_id"] for m in bom_mappings)
    
    unmapped = [s["sku_id"] for s in all_skus if s["sku_id"] not in mapped_ids]
    
    return {
        "total": len(unmapped),
        "unmapped_skus": unmapped
    }


@router.post("/skus/activate")
async def activate_sku_in_branch(request: ActivateItemRequest):
    """Activate an SKU in a specific branch - also activates all mapped RMs"""
    sku = await db.skus.find_one({"sku_id": request.item_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    # Activate SKU
    existing = await db.branch_sku_inventory.find_one(
        {"sku_id": request.item_id, "branch": request.branch}
    )
    
    if existing:
        await db.branch_sku_inventory.update_one(
            {"sku_id": request.item_id, "branch": request.branch},
            {"$set": {"is_active": True}}
        )
    else:
        await db.branch_sku_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "sku_id": request.item_id,
            "branch": request.branch,
            "current_stock": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Get RM mappings and activate them too
    mappings = await db.sku_mappings.find_one({"sku_id": request.item_id}, {"_id": 0})
    bom = await db.bill_of_materials.find_one({"sku_id": request.item_id}, {"_id": 0})
    
    activated_rms = []
    rm_list = []
    
    if mappings and mappings.get("rm_mappings"):
        rm_list = [m["rm_id"] for m in mappings["rm_mappings"]]
    elif bom and bom.get("rm_mappings"):
        rm_list = [m["rm_id"] for m in bom["rm_mappings"]]
    
    for rm_id in rm_list:
        rm_existing = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_id, "branch": request.branch}
        )
        
        if rm_existing:
            await db.branch_rm_inventory.update_one(
                {"rm_id": rm_id, "branch": request.branch},
                {"$set": {"is_active": True}}
            )
        else:
            await db.branch_rm_inventory.insert_one({
                "id": str(uuid.uuid4()),
                "rm_id": rm_id,
                "branch": request.branch,
                "current_stock": 0.0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        activated_rms.append(rm_id)
    
    return {
        "message": f"SKU {request.item_id} and {len(activated_rms)} RMs activated in {request.branch}",
        "activated_rms": activated_rms
    }


@router.put("/skus/{sku_id}", response_model=SKU)
@require_permission("BuyerSKU", "UPDATE")
async def update_sku(sku_id: str, input: SKUCreate, current_user: User = Depends(get_current_user)):
    """Update an existing SKU (MASTER_ADMIN, DEMAND_PLANNER, TECH_OPS_ENGINEER)"""
    existing = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    update_data = input.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.id
    
    await db.skus.update_one({"sku_id": sku_id}, {"$set": update_data})
    
    updated = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0})
    return SKU(**updated)


@router.delete("/skus/{sku_id}")
@require_permission("BuyerSKU", "DELETE")
async def delete_sku(sku_id: str, current_user: User = Depends(get_current_user)):
    """Delete an SKU (MASTER_ADMIN, DEMAND_PLANNER with constraints)"""
    result = await db.skus.delete_one({"sku_id": sku_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="SKU not found")
    return {"message": f"SKU {sku_id} deleted"}


# ============ SKU Mappings ============

@router.post("/sku-mappings", response_model=SKUMapping)
async def create_sku_mapping(input: SKUMappingCreate):
    """Create SKU to RM mapping"""
    # Verify SKU exists
    sku = await db.skus.find_one({"sku_id": input.sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU {input.sku_id} not found")
    
    # Create or update mapping
    existing = await db.sku_mappings.find_one({"sku_id": input.sku_id})
    
    if existing:
        await db.sku_mappings.update_one(
            {"sku_id": input.sku_id},
            {"$set": {"rm_mappings": [m.model_dump() for m in input.rm_mappings]}}
        )
    else:
        mapping = SKUMapping(
            sku_id=input.sku_id,
            rm_mappings=[m.model_dump() for m in input.rm_mappings]
        )
        await db.sku_mappings.insert_one(mapping.model_dump())
    
    result = await db.sku_mappings.find_one({"sku_id": input.sku_id}, {"_id": 0})
    return SKUMapping(**result)


@router.post("/sku-mappings/bulk-upload")
async def bulk_upload_sku_mappings(file: UploadFile = File(...)):
    """Bulk upload SKU mappings from Excel"""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    
    headers = [cell.value for cell in ws[1]]
    
    created = 0
    updated = 0
    errors = []
    
    # Group by SKU
    sku_mappings = {}
    
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        try:
            row_data = dict(zip(headers, row))
            
            sku_id = str(row_data.get('sku_id', '')).strip()
            rm_id = str(row_data.get('rm_id', '')).strip()
            qty = float(row_data.get('quantity', 1))
            
            if not sku_id or not rm_id:
                errors.append(f"Row {idx}: Missing sku_id or rm_id")
                continue
            
            if sku_id not in sku_mappings:
                sku_mappings[sku_id] = []
            
            sku_mappings[sku_id].append({
                "rm_id": rm_id,
                "quantity": qty
            })
            
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    
    # Save mappings
    for sku_id, mappings in sku_mappings.items():
        existing = await db.sku_mappings.find_one({"sku_id": sku_id})
        
        if existing:
            await db.sku_mappings.update_one(
                {"sku_id": sku_id},
                {"$set": {"rm_mappings": mappings}}
            )
            updated += 1
        else:
            await db.sku_mappings.insert_one({
                "id": str(uuid.uuid4()),
                "sku_id": sku_id,
                "rm_mappings": mappings
            })
            created += 1
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "message": f"Created {created}, updated {updated} SKU mappings"
    }


@router.get("/sku-mappings/{sku_id}", response_model=SKUMapping)
async def get_sku_mapping(sku_id: str):
    """Get SKU mapping by SKU ID"""
    # Try sku_mappings first
    mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
    if mapping:
        return SKUMapping(**mapping)
    
    # Try bill_of_materials
    bom = await db.bill_of_materials.find_one({"sku_id": sku_id}, {"_id": 0})
    if bom:
        return SKUMapping(
            id=bom.get("id", str(uuid.uuid4())),
            sku_id=bom["sku_id"],
            rm_mappings=bom.get("rm_mappings", [])
        )
    
    raise HTTPException(status_code=404, detail=f"Mapping not found for SKU {sku_id}")


@router.get("/sku-mappings", response_model=List[SKUMapping])
async def get_all_sku_mappings():
    """Get all SKU mappings"""
    # Combine both sources
    mappings = await db.sku_mappings.find({}, {"_id": 0}).to_list(10000)
    boms = await db.bill_of_materials.find({}, {"_id": 0}).to_list(10000)
    
    # Dedupe by sku_id
    seen = set()
    result = []
    
    for m in mappings:
        if m["sku_id"] not in seen:
            seen.add(m["sku_id"])
            result.append(SKUMapping(**m))
    
    for b in boms:
        if b["sku_id"] not in seen:
            seen.add(b["sku_id"])
            result.append(SKUMapping(
                id=b.get("id", str(uuid.uuid4())),
                sku_id=b["sku_id"],
                rm_mappings=b.get("rm_mappings", [])
            ))
    
    return result


@router.get("/skus/filtered")
async def get_filtered_skus(
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    buyer_id: Optional[str] = None,
    search: Optional[str] = None,
    branch: Optional[str] = None,
    include_inactive: bool = False
):
    """Get SKUs with relational filters"""
    query = {}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    if vertical_id:
        query["vertical_id"] = vertical_id
    if model_id:
        query["model_id"] = model_id
    if brand_id:
        query["brand_id"] = brand_id
    if buyer_id:
        query["buyer_id"] = buyer_id
    
    skus = await db.skus.find(query, {"_id": 0}).to_list(10000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        skus = [s for s in skus if 
                search_lower in s.get("sku_id", "").lower() or
                search_lower in s.get("description", "").lower()]
    
    # Enrich with related data
    for sku in skus:
        # Get vertical name
        if sku.get("vertical_id"):
            v = await db.verticals.find_one({"id": sku["vertical_id"]}, {"_id": 0, "name": 1})
            sku["vertical_name"] = v["name"] if v else None
        
        # Get model name
        if sku.get("model_id"):
            m = await db.models.find_one({"id": sku["model_id"]}, {"_id": 0, "name": 1})
            sku["model_name"] = m["name"] if m else None
        
        # Get brand name
        if sku.get("brand_id"):
            b = await db.brands.find_one({"id": sku["brand_id"]}, {"_id": 0, "name": 1})
            sku["brand_name"] = b["name"] if b else None
        
        # Get buyer name
        if sku.get("buyer_id"):
            bu = await db.buyers.find_one({"id": sku["buyer_id"]}, {"_id": 0, "name": 1})
            sku["buyer_name"] = bu["name"] if bu else None
        
        # Branch inventory
        if branch:
            inv = await db.branch_sku_inventory.find_one(
                {"sku_id": sku["sku_id"], "branch": branch},
                {"_id": 0}
            )
            sku["branch_stock"] = inv.get("current_stock", 0) if inv else 0
            sku["is_active_in_branch"] = inv.get("is_active", False) if inv else False
            
            fg = await db.fg_inventory.find_one(
                {"sku_id": sku["sku_id"], "branch": branch},
                {"_id": 0}
            )
            sku["fg_stock"] = fg.get("quantity", 0) if fg else 0
    
    return skus
