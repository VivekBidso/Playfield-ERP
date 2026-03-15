"""Raw Materials routes - RM CRUD, inventory, bulk upload"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import openpyxl
import io

from database import db
from models import User, RawMaterial, RawMaterialCreate, ActivateItemRequest
from services.utils import (
    get_current_user, check_master_admin, check_branch_access,
    get_next_rm_sequence, serialize_doc, RM_CATEGORIES, BRANCHES
)
from services.rbac_service import require_permission

router = APIRouter(tags=["Raw Materials"])


@router.get("/rm-categories")
async def get_rm_categories():
    """Get all RM categories with their field definitions"""
    return RM_CATEGORIES


@router.post("/raw-materials", response_model=RawMaterial)
@require_permission("RawMaterial", "CREATE")
async def create_raw_material(input: RawMaterialCreate, current_user: User = Depends(get_current_user)):
    """Create a new raw material (MASTER_ADMIN, TECH_OPS_ENGINEER)"""
    if input.category not in RM_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {input.category}")
    
    # Generate RM ID
    seq = await get_next_rm_sequence(input.category)
    rm_id = f"{input.category}_{seq:05d}"
    
    rm = RawMaterial(
        rm_id=rm_id,
        category=input.category,
        category_data=input.category_data,
        low_stock_threshold=input.low_stock_threshold,
        rm_level=input.rm_level,
        parent_rm_id=input.parent_rm_id,
        unit_weight_grams=input.unit_weight_grams,
        scrap_factor=input.scrap_factor,
        processing_cost=input.processing_cost,
        secondary_l1_rm_id=input.secondary_l1_rm_id,
        powder_qty_grams=input.powder_qty_grams,
        coating_scrap_factor=input.coating_scrap_factor
    )
    
    doc = rm.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['created_by'] = current_user.id
    await db.raw_materials.insert_one(doc)
    
    return rm
    
    return rm


@router.post("/raw-materials/bulk-upload")
async def bulk_upload_raw_materials(file: UploadFile = File(...)):
    """Bulk upload raw materials from Excel file"""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    
    headers = [cell.value for cell in ws[1]]
    
    created = 0
    errors = []
    
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        try:
            row_data = dict(zip(headers, row))
            
            category = row_data.get('category', '').upper()
            if category not in RM_CATEGORIES:
                errors.append(f"Row {idx}: Invalid category '{category}'")
                continue
            
            # Build category data from row
            category_fields = RM_CATEGORIES[category]["fields"]
            category_data = {}
            for field in category_fields:
                if field in row_data:
                    category_data[field] = row_data[field]
            
            # Create RM
            seq = await get_next_rm_sequence(category)
            rm_id = f"{category}_{seq:05d}"
            
            rm = RawMaterial(
                rm_id=rm_id,
                category=category,
                category_data=category_data,
                low_stock_threshold=row_data.get('low_stock_threshold', 10.0) or 10.0
            )
            
            doc = rm.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.raw_materials.insert_one(doc)
            created += 1
            
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    
    return {
        "created": created,
        "errors": errors,
        "message": f"Successfully created {created} raw materials"
    }


@router.post("/raw-materials/import-with-ids")
async def import_raw_materials_with_ids(file: UploadFile = File(...), category: str = ""):
    """Import raw materials with specific RM IDs from Excel"""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    
    headers = [cell.value for cell in ws[1]]
    
    created = 0
    updated = 0
    errors = []
    
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        try:
            row_data = dict(zip(headers, row))
            
            # Get RM ID from file or generate
            rm_id = row_data.get('rm_id', '').strip() if row_data.get('rm_id') else None
            cat = category or row_data.get('category', '').upper()
            
            if not cat or cat not in RM_CATEGORIES:
                errors.append(f"Row {idx}: Invalid or missing category '{cat}'")
                continue
            
            if not rm_id:
                seq = await get_next_rm_sequence(cat)
                rm_id = f"{cat}_{seq:05d}"
            
            # Build category data
            category_fields = RM_CATEGORIES[cat]["fields"]
            category_data = {}
            for field in category_fields:
                if field in row_data and row_data[field]:
                    category_data[field] = row_data[field]
            
            # Check for existing
            existing = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
            
            if existing:
                # Update existing
                await db.raw_materials.update_one(
                    {"rm_id": rm_id},
                    {"$set": {
                        "category_data": category_data,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                updated += 1
            else:
                # Create new
                rm = RawMaterial(
                    rm_id=rm_id,
                    category=cat,
                    category_data=category_data,
                    low_stock_threshold=row_data.get('low_stock_threshold', 10.0) or 10.0,
                    rm_level=row_data.get('rm_level', 'DIRECT') or 'DIRECT',
                    parent_rm_id=row_data.get('parent_rm_id'),
                    unit_weight_grams=row_data.get('unit_weight_grams'),
                    scrap_factor=row_data.get('scrap_factor', 0.02) or 0.02,
                    secondary_l1_rm_id=row_data.get('secondary_l1_rm_id'),
                    powder_qty_grams=row_data.get('powder_qty_grams')
                )
                
                doc = rm.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.raw_materials.insert_one(doc)
                created += 1
                
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "message": f"Created {created}, updated {updated} raw materials"
    }


@router.get("/raw-materials")
async def get_raw_materials(
    branch: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: bool = False
):
    """Get all raw materials with optional filters"""
    query = {}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    rms = await db.raw_materials.find(query, {"_id": 0}).to_list(10000)
    
    # Filter by search
    if search:
        search_lower = search.lower()
        filtered = []
        for rm in rms:
            if search_lower in rm.get("rm_id", "").lower():
                filtered.append(rm)
                continue
            # Search in category_data
            for val in rm.get("category_data", {}).values():
                if val and search_lower in str(val).lower():
                    filtered.append(rm)
                    break
        rms = filtered
    
    # Add branch inventory data if branch specified
    if branch:
        for rm in rms:
            inv = await db.branch_rm_inventory.find_one(
                {"rm_id": rm["rm_id"], "branch": branch},
                {"_id": 0}
            )
            rm["branch_stock"] = inv.get("current_stock", 0.0) if inv else 0.0
            rm["is_active_in_branch"] = inv.get("is_active", False) if inv else False
    
    return rms


@router.get("/raw-materials/filtered")
async def get_raw_materials_filtered(
    page: int = 1,
    page_size: int = 100,
    branch: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    type_filter: Optional[str] = None,
    model_filter: Optional[str] = None,
    colour_filter: Optional[str] = None,
    brand_filter: Optional[str] = None
):
    """Get raw materials with pagination and filters"""
    query = {"status": {"$ne": "INACTIVE"}}
    
    # Apply category filter
    if category:
        query["category"] = category
    
    # Get all matching RMs first
    rms = await db.raw_materials.find(query, {"_id": 0}).to_list(15000)
    
    # Apply text search
    if search:
        search_lower = search.lower()
        filtered = []
        for rm in rms:
            if search_lower in rm.get("rm_id", "").lower():
                filtered.append(rm)
                continue
            if search_lower in rm.get("description", "").lower():
                filtered.append(rm)
                continue
            # Search in category_data
            for val in rm.get("category_data", {}).values():
                if val and search_lower in str(val).lower():
                    filtered.append(rm)
                    break
        rms = filtered
    
    # Apply category_data filters
    if type_filter:
        rms = [rm for rm in rms if rm.get("category_data", {}).get("type") == type_filter]
    if model_filter:
        rms = [rm for rm in rms if rm.get("category_data", {}).get("model_name") == model_filter or rm.get("category_data", {}).get("model") == model_filter]
    if colour_filter:
        rms = [rm for rm in rms if rm.get("category_data", {}).get("colour") == colour_filter]
    if brand_filter:
        rms = [rm for rm in rms if rm.get("category_data", {}).get("brand") == brand_filter]
    
    # Add branch inventory data if branch specified
    if branch:
        branch_inv = await db.branch_rm_inventory.find(
            {"branch": branch},
            {"_id": 0, "rm_id": 1, "current_stock": 1, "is_active": 1}
        ).to_list(15000)
        inv_map = {inv["rm_id"]: inv for inv in branch_inv}
        
        for rm in rms:
            inv = inv_map.get(rm["rm_id"])
            rm["branch_stock"] = inv.get("current_stock", 0.0) if inv else 0.0
            rm["is_active_in_branch"] = inv.get("is_active", False) if inv else False
    
    # Calculate pagination
    total = len(rms)
    total_pages = (total + page_size - 1) // page_size
    start = (page - 1) * page_size
    end = start + page_size
    
    return {
        "items": rms[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("/raw-materials/activate")
async def activate_rm_in_branch(request: ActivateItemRequest):
    """Activate a raw material in a specific branch"""
    rm = await db.raw_materials.find_one({"rm_id": request.item_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    existing = await db.branch_rm_inventory.find_one(
        {"rm_id": request.item_id, "branch": request.branch}
    )
    
    if existing:
        await db.branch_rm_inventory.update_one(
            {"rm_id": request.item_id, "branch": request.branch},
            {"$set": {"is_active": True}}
        )
    else:
        await db.branch_rm_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "rm_id": request.item_id,
            "branch": request.branch,
            "current_stock": 0.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": f"Raw material {request.item_id} activated in {request.branch}"}


@router.delete("/raw-materials/{rm_id}")
@require_permission("RawMaterial", "DELETE")
async def delete_raw_material(rm_id: str, current_user: User = Depends(get_current_user)):
    """Delete a raw material (MASTER_ADMIN only, TECH_OPS can soft-delete)"""
    result = await db.raw_materials.delete_one({"rm_id": rm_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    # Also delete branch inventory records
    await db.branch_rm_inventory.delete_many({"rm_id": rm_id})
    
    return {"message": f"Raw material {rm_id} deleted"}
