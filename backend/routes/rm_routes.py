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
    get_next_rm_sequence, serialize_doc, RM_CATEGORIES, BRANCHES,
    generate_rm_name
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
            
            # Generate RM name from category_data based on nomenclature
            rm_name = generate_rm_name(category, category_data)
            if rm_name:
                category_data["name"] = rm_name
            
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
            
            # Generate RM name from category_data based on nomenclature
            rm_name = generate_rm_name(cat, category_data)
            if rm_name:
                category_data["name"] = rm_name
            
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


# ============ RM Tagging Endpoints ============

@router.put("/raw-materials/{rm_id}")
async def update_raw_material(rm_id: str, data: dict):
    """Update a raw material - especially for brand/model/vertical tagging"""
    from models import RawMaterialUpdate
    
    existing = await db.raw_materials.find_one({"rm_id": rm_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    update_fields = {}
    
    # Handle optional fields
    if "category_data" in data and data["category_data"] is not None:
        update_fields["category_data"] = data["category_data"]
    if "low_stock_threshold" in data and data["low_stock_threshold"] is not None:
        update_fields["low_stock_threshold"] = data["low_stock_threshold"]
    if "brand_ids" in data:
        update_fields["brand_ids"] = data["brand_ids"] or []
    if "vertical_ids" in data:
        update_fields["vertical_ids"] = data["vertical_ids"] or []
    if "model_ids" in data:
        update_fields["model_ids"] = data["model_ids"] or []
    if "is_brand_specific" in data:
        update_fields["is_brand_specific"] = data["is_brand_specific"]
    if "status" in data and data["status"]:
        update_fields["status"] = data["status"]
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.raw_materials.update_one(
            {"rm_id": rm_id},
            {"$set": update_fields}
        )
    
    return {"message": f"Raw material {rm_id} updated"}


@router.get("/raw-materials/by-tags")
async def get_raw_materials_by_tags(
    brand_id: Optional[str] = None,
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    is_brand_specific: Optional[bool] = None,
    category: Optional[str] = None
):
    """Get RMs filtered by brand/vertical/model tags"""
    query = {"status": {"$ne": "INACTIVE"}}
    
    if brand_id:
        query["brand_ids"] = brand_id
    if vertical_id:
        query["vertical_ids"] = vertical_id
    if model_id:
        query["model_ids"] = model_id
    if is_brand_specific is not None:
        query["is_brand_specific"] = is_brand_specific
    if category:
        query["category"] = category
    
    rms = await db.raw_materials.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with names
    for rm in rms:
        # Get brand names
        if rm.get("brand_ids"):
            brands = await db.brands.find({"id": {"$in": rm["brand_ids"]}}, {"_id": 0, "code": 1, "name": 1}).to_list(100)
            rm["brands"] = brands
        else:
            rm["brands"] = []
        
        # Get vertical names
        if rm.get("vertical_ids"):
            verticals = await db.verticals.find({"id": {"$in": rm["vertical_ids"]}}, {"_id": 0, "code": 1, "name": 1}).to_list(100)
            rm["verticals"] = verticals
        else:
            rm["verticals"] = []
        
        # Get model names
        if rm.get("model_ids"):
            models = await db.models.find({"id": {"$in": rm["model_ids"]}}, {"_id": 0, "code": 1, "name": 1}).to_list(100)
            rm["models"] = models
        else:
            rm["models"] = []
    
    return rms


@router.post("/raw-materials/{rm_id}/tag")
async def tag_raw_material(rm_id: str, data: dict):
    """Add tags to a raw material (brands, verticals, models)"""
    existing = await db.raw_materials.find_one({"rm_id": rm_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    update_ops = {}
    
    # Add to arrays (avoid duplicates)
    if "brand_ids" in data and data["brand_ids"]:
        update_ops["$addToSet"] = update_ops.get("$addToSet", {})
        update_ops["$addToSet"]["brand_ids"] = {"$each": data["brand_ids"]}
    
    if "vertical_ids" in data and data["vertical_ids"]:
        update_ops["$addToSet"] = update_ops.get("$addToSet", {})
        update_ops["$addToSet"]["vertical_ids"] = {"$each": data["vertical_ids"]}
    
    if "model_ids" in data and data["model_ids"]:
        update_ops["$addToSet"] = update_ops.get("$addToSet", {})
        update_ops["$addToSet"]["model_ids"] = {"$each": data["model_ids"]}
    
    if "is_brand_specific" in data:
        update_ops["$set"] = update_ops.get("$set", {})
        update_ops["$set"]["is_brand_specific"] = data["is_brand_specific"]
    
    if update_ops:
        update_ops["$set"] = update_ops.get("$set", {})
        update_ops["$set"]["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.raw_materials.update_one({"rm_id": rm_id}, update_ops)
    
    return {"message": f"Tags added to {rm_id}"}


@router.post("/raw-materials/{rm_id}/untag")
async def untag_raw_material(rm_id: str, data: dict):
    """Remove tags from a raw material"""
    existing = await db.raw_materials.find_one({"rm_id": rm_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    update_ops = {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    
    if "brand_ids" in data and data["brand_ids"]:
        update_ops["$pull"] = update_ops.get("$pull", {})
        update_ops["$pullAll"] = {"brand_ids": data["brand_ids"]}
    
    if "vertical_ids" in data and data["vertical_ids"]:
        update_ops["$pullAll"] = update_ops.get("$pullAll", {})
        update_ops["$pullAll"]["vertical_ids"] = data["vertical_ids"]
    
    if "model_ids" in data and data["model_ids"]:
        update_ops["$pullAll"] = update_ops.get("$pullAll", {})
        update_ops["$pullAll"]["model_ids"] = data["model_ids"]
    
    await db.raw_materials.update_one({"rm_id": rm_id}, update_ops)
    
    return {"message": f"Tags removed from {rm_id}"}


# ============ RM Request Workflow ============

@router.get("/rm-requests")
async def get_rm_requests(
    status: Optional[str] = None,
    requested_by: Optional[str] = None
):
    """Get all RM requests"""
    query = {}
    if status:
        query["status"] = status
    if requested_by:
        query["requested_by"] = requested_by
    
    requests = await db.rm_requests.find(query, {"_id": 0}).sort("requested_at", -1).to_list(1000)
    
    # Enrich with user names and tag names
    for req in requests:
        # Requester name
        if req.get("requested_by"):
            user = await db.users.find_one({"id": req["requested_by"]}, {"_id": 0, "name": 1})
            req["requester_name"] = user["name"] if user else None
        
        # Reviewer name
        if req.get("reviewed_by"):
            user = await db.users.find_one({"id": req["reviewed_by"]}, {"_id": 0, "name": 1})
            req["reviewer_name"] = user["name"] if user else None
        
        # Brand names
        if req.get("brand_ids"):
            brands = await db.brands.find({"id": {"$in": req["brand_ids"]}}, {"_id": 0, "code": 1, "name": 1}).to_list(100)
            req["brands"] = brands
        
        # Buyer SKU info
        if req.get("buyer_sku_id"):
            buyer_sku = await db.buyer_skus.find_one({"buyer_sku_id": req["buyer_sku_id"]}, {"_id": 0, "name": 1})
            req["buyer_sku_name"] = buyer_sku["name"] if buyer_sku else None
    
    return requests


@router.post("/rm-requests")
async def create_rm_request(data: dict, current_user: User = Depends(get_current_user)):
    """Create a new RM request (Demand team)"""
    from models import RMRequest
    
    request = RMRequest(
        category=data.get("category", "LB"),
        requested_name=data.get("requested_name", ""),
        description=data.get("description", ""),
        category_data=data.get("category_data", {}),
        artwork_files=data.get("artwork_files", []),
        brand_ids=data.get("brand_ids", []),
        vertical_ids=data.get("vertical_ids", []),
        model_ids=data.get("model_ids", []),
        buyer_sku_id=data.get("buyer_sku_id"),
        requested_by=current_user.id,
        requester_name=current_user.name
    )
    
    doc = request.model_dump()
    doc["requested_at"] = doc["requested_at"].isoformat()
    await db.rm_requests.insert_one(doc)
    
    return {"message": "RM request created", "id": request.id}


@router.post("/rm-requests/{request_id}/review")
async def review_rm_request(request_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Review (approve/reject) an RM request (Tech Ops)"""
    request = await db.rm_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="RM request not found")
    
    if request.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Request already reviewed")
    
    action = data.get("action", "").upper()
    review_notes = data.get("review_notes", "")
    
    if action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use APPROVE or REJECT")
    
    update_data = {
        "reviewed_by": current_user.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "review_notes": review_notes
    }
    
    if action == "REJECT":
        update_data["status"] = "REJECTED"
    else:
        # Approve and create RM
        category = request.get("category", "LB")
        seq = await get_next_rm_sequence(category)
        rm_id = f"{category}_{seq:05d}"
        
        # Use category_data from the request (or override from review data)
        request_category_data = request.get("category_data", {})
        review_category_data = data.get("category_data")
        final_category_data = review_category_data if review_category_data else request_category_data
        
        # Generate or use the requested name based on nomenclature
        rm_name = generate_rm_name(category, final_category_data)
        if not rm_name:
            # Fallback to requested_name if nomenclature-based name couldn't be generated
            rm_name = request.get("requested_name", "")
        final_category_data["name"] = rm_name
        
        # Create the RM
        rm = RawMaterial(
            rm_id=rm_id,
            category=category,
            category_data=final_category_data,
            brand_ids=request.get("brand_ids", []),
            vertical_ids=request.get("vertical_ids", []),
            model_ids=request.get("model_ids", []),
            is_brand_specific=True
        )
        
        rm_doc = rm.model_dump()
        rm_doc["created_at"] = rm_doc["created_at"].isoformat()
        await db.raw_materials.insert_one(rm_doc)
        
        update_data["status"] = "APPROVED"
        update_data["created_rm_id"] = rm_id
    
    await db.rm_requests.update_one(
        {"id": request_id},
        {"$set": update_data}
    )
    
    return {
        "message": f"Request {'approved' if action == 'APPROVE' else 'rejected'}",
        "created_rm_id": update_data.get("created_rm_id")
    }


@router.get("/rm-requests/pending-count")
async def get_pending_rm_requests_count():
    """Get count of pending RM requests (for notifications)"""
    count = await db.rm_requests.count_documents({"status": "PENDING"})
    return {"pending_count": count}
