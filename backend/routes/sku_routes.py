"""SKU routes - SKU CRUD, mappings, subscriptions"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import openpyxl
import io

from database import db
from models import User, SKU, SKUCreate, SKUMapping, SKUMappingCreate, ActivateItemRequest
from models.core import SKUBranchAssignment, BranchSKUInventory, BranchRMInventory
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


@router.get("/skus/filter-options")
async def get_sku_filter_options():
    """Get all distinct verticals, models, and brands for filter dropdowns"""
    all_skus = await db.skus.find({}, {"_id": 0, "vertical": 1, "model": 1, "brand": 1}).to_list(10000)
    
    verticals = sorted(list(set(s.get('vertical', '') for s in all_skus if s.get('vertical'))))
    models = sorted(list(set(s.get('model', '') for s in all_skus if s.get('model'))))
    brands = sorted(list(set(s.get('brand', '') for s in all_skus if s.get('brand'))))
    
    return {
        "verticals": verticals,
        "models": models,
        "brands": brands
    }


@router.get("/skus/models-by-vertical")
async def get_models_by_vertical(vertical: str):
    """Get distinct models for a specific vertical"""
    skus = await db.skus.find({"vertical": vertical}, {"_id": 0, "model": 1}).to_list(10000)
    models = sorted(list(set(s.get('model', '') for s in skus if s.get('model'))))
    return {"models": models}


@router.get("/skus/brands-by-vertical-model")
async def get_brands_by_vertical_model(vertical: str, model: Optional[str] = None):
    """Get distinct brands for a specific vertical and optionally model"""
    query = {"vertical": vertical}
    if model:
        query["model"] = model
    skus = await db.skus.find(query, {"_id": 0, "brand": 1}).to_list(10000)
    brands = sorted(list(set(s.get('brand', '') for s in skus if s.get('brand'))))
    return {"brands": brands}


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
    """Bulk upload SKU mappings from Excel - NO OVERWRITES ALLOWED"""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    
    headers = [cell.value for cell in ws[1]]
    
    created = 0
    skipped_duplicates = []
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
                sku_mappings[sku_id] = {"rows": [], "mappings": []}
            
            sku_mappings[sku_id]["rows"].append(idx)
            sku_mappings[sku_id]["mappings"].append({
                "rm_id": rm_id,
                "quantity": qty
            })
            
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    
    # Check for existing and save only new mappings
    for sku_id, data in sku_mappings.items():
        existing = await db.sku_mappings.find_one({"sku_id": sku_id})
        
        if existing:
            # PREVENT OVERWRITE
            skipped_duplicates.append({
                "rows": data["rows"],
                "sku_id": sku_id,
                "reason": "SKU mapping already exists"
            })
        else:
            await db.sku_mappings.insert_one({
                "id": str(uuid.uuid4()),
                "sku_id": sku_id,
                "rm_mappings": data["mappings"]
            })
            created += 1
    
    if skipped_duplicates:
        return {
            "success": False if created == 0 else True,
            "created": created,
            "duplicates": skipped_duplicates,
            "errors": errors,
            "message": f"Upload complete: {created} created, {len(skipped_duplicates)} skipped (duplicates - no overwrites allowed)"
        }
    
    return {
        "success": True,
        "created": created,
        "duplicates": [],
        "errors": errors,
        "message": f"Successfully created {created} SKU mappings"
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
    """
    Get SKUs with relational filters.
    Now queries consolidated db.buyer_skus collection (single source of truth).
    Enriches with vertical/model from parent Bidso SKU.
    """
    query = {}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    if brand_id:
        query["brand_id"] = brand_id
    if buyer_id:
        query["buyer_id"] = buyer_id
    
    # If filtering by vertical or model, we need to find matching bidso_skus first
    bidso_filter = None
    if vertical_id or model_id:
        bidso_query = {}
        if vertical_id:
            bidso_query["vertical_id"] = vertical_id
        if model_id:
            bidso_query["model_id"] = model_id
        
        matching_bidso = await db.bidso_skus.find(bidso_query, {"_id": 0, "bidso_sku_id": 1}).to_list(5000)
        bidso_filter = [b["bidso_sku_id"] for b in matching_bidso]
        
        if not bidso_filter:
            return []  # No matching Bidso SKUs, so no Buyer SKUs will match
        
        query["bidso_sku_id"] = {"$in": bidso_filter}
    
    # Query from consolidated buyer_skus collection
    skus = await db.buyer_skus.find(query, {"_id": 0}).to_list(10000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        skus = [s for s in skus if 
                search_lower in s.get("buyer_sku_id", "").lower() or
                search_lower in s.get("name", "").lower() or
                search_lower in s.get("description", "").lower()]
    
    # Cache for bidso_sku lookups to avoid repeated queries
    bidso_cache = {}
    
    # Enrich with related data and add compatibility fields
    for sku in skus:
        # Add sku_id alias for backward compatibility
        sku["sku_id"] = sku.get("buyer_sku_id", "")
        
        # Get vertical and model from parent Bidso SKU
        bidso_sku_id = sku.get("bidso_sku_id")
        if bidso_sku_id:
            if bidso_sku_id not in bidso_cache:
                bidso = await db.bidso_skus.find_one(
                    {"bidso_sku_id": bidso_sku_id},
                    {"_id": 0, "vertical_id": 1, "model_id": 1}
                )
                bidso_cache[bidso_sku_id] = bidso or {}
            
            bidso_data = bidso_cache[bidso_sku_id]
            sku["vertical_id"] = bidso_data.get("vertical_id")
            sku["model_id"] = bidso_data.get("model_id")
        
        # Get vertical name
        if sku.get("vertical_id"):
            v = await db.verticals.find_one({"id": sku["vertical_id"]}, {"_id": 0, "name": 1, "code": 1})
            if v:
                sku["vertical_name"] = v["name"]
                sku["vertical_code"] = v.get("code")
                sku["vertical"] = {"id": sku["vertical_id"], "name": v["name"], "code": v.get("code")}
        
        # Get model name
        if sku.get("model_id"):
            m = await db.models.find_one({"id": sku["model_id"]}, {"_id": 0, "name": 1, "code": 1})
            if m:
                sku["model_name"] = m["name"]
                sku["model_code"] = m.get("code")
                sku["model"] = {"id": sku["model_id"], "name": m["name"], "code": m.get("code")}
        
        # Get brand name if not already present
        if sku.get("brand_id") and not sku.get("brand_name"):
            b = await db.brands.find_one({"id": sku["brand_id"]}, {"_id": 0, "name": 1})
            sku["brand_name"] = b["name"] if b else None
        
        # Get buyer name
        if sku.get("buyer_id"):
            bu = await db.buyers.find_one({"id": sku["buyer_id"]}, {"_id": 0, "name": 1})
            sku["buyer_name"] = bu["name"] if bu else None
        
        # Branch inventory
        if branch:
            inv = await db.branch_sku_inventory.find_one(
                {"sku_id": sku.get("buyer_sku_id"), "branch": branch},
                {"_id": 0}
            )
            sku["branch_stock"] = inv.get("current_stock", 0) if inv else 0
            sku["is_active_in_branch"] = inv.get("is_active", False) if inv else False
            
            fg = await db.fg_inventory.find_one(
                {"sku_id": sku.get("buyer_sku_id"), "branch": branch},
                {"_id": 0}
            )
            sku["fg_stock"] = fg.get("quantity", 0) if fg else 0
    
    return skus



@router.get("/sku-branch-assignments/all")
async def get_all_sku_branch_assignments():
    """Get all SKU branch assignments for demand planning"""
    assignments = await db.branch_sku_inventory.find(
        {"is_active": True},
        {"_id": 0, "sku_id": 1, "branch": 1}
    ).to_list(50000)
    
    return assignments


# ============ SKU Branch Assignment Routes ============

async def activate_rms_for_sku(sku_id: str, branch: str) -> int:
    """
    Activate all RMs in the BOM for a given SKU in a branch.
    Returns the number of RMs activated.
    """
    activated_count = 0
    
    # Get RM mappings from sku_rm_mapping collection (bulk uploaded)
    rm_mappings = await db.sku_rm_mapping.find({"sku_id": sku_id}, {"_id": 0, "rm_id": 1}).to_list(1000)
    
    # Also check legacy sku_mappings collection
    legacy_mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
    if legacy_mapping and legacy_mapping.get('rm_mappings'):
        for rm in legacy_mapping['rm_mappings']:
            rm_mappings.append({"rm_id": rm['rm_id']})
    
    # Also check bill_of_materials collection
    bom_mappings = await db.bill_of_materials.find({"sku_id": sku_id}, {"_id": 0, "rm_id": 1}).to_list(1000)
    for bom in bom_mappings:
        if bom.get("rm_id"):
            rm_mappings.append({"rm_id": bom['rm_id']})
    
    # Activate each RM in the branch
    for mapping in rm_mappings:
        rm_id = mapping.get('rm_id')
        if not rm_id:
            continue
        
        # Check if RM exists in the system
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        if not rm:
            continue
        
        # Check if already activated in branch
        existing_inv = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_id, "branch": branch},
            {"_id": 0}
        )
        
        if not existing_inv:
            # Activate RM in branch inventory
            inv_obj = BranchRMInventory(rm_id=rm_id, branch=branch)
            inv_doc = inv_obj.model_dump()
            inv_doc['activated_at'] = inv_doc['activated_at'].isoformat()
            await db.branch_rm_inventory.insert_one(inv_doc)
            activated_count += 1
        elif not existing_inv.get('is_active', False):
            # Re-activate if inactive
            await db.branch_rm_inventory.update_one(
                {"rm_id": rm_id, "branch": branch},
                {"$set": {"is_active": True}}
            )
            activated_count += 1
    
    return activated_count


@router.post("/sku-branch-assignments/upload")
async def upload_sku_branch_assignments(file: UploadFile = File(...), branch: str = ""):
    """Upload SKU IDs to assign to a branch. Also activates corresponding RMs."""
    if not branch:
        raise HTTPException(status_code=400, detail="Branch is required")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        contents = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = workbook.active
        
        assigned_count = 0
        skipped_count = 0
        not_found = []
        total_rms_activated = 0
        
        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            
            sku_id = str(row[0]).strip()
            
            # Check if SKU exists (by buyer_sku_id or sku_id)
            sku = await db.skus.find_one(
                {"$or": [{"buyer_sku_id": sku_id}, {"sku_id": sku_id}]},
                {"_id": 0}
            )
            
            if not sku:
                not_found.append(sku_id)
                continue
            
            actual_sku_id = sku['sku_id']
            
            # Check if already assigned
            existing = await db.sku_branch_assignments.find_one(
                {"sku_id": actual_sku_id, "branch": branch},
                {"_id": 0}
            )
            
            if existing:
                skipped_count += 1
                continue
            
            # Create assignment
            assignment = SKUBranchAssignment(sku_id=actual_sku_id, branch=branch)
            doc = assignment.model_dump()
            doc['assigned_at'] = doc['assigned_at'].isoformat()
            await db.sku_branch_assignments.insert_one(doc)
            
            # Also activate SKU in branch inventory
            existing_inv = await db.branch_sku_inventory.find_one(
                {"sku_id": actual_sku_id, "branch": branch},
                {"_id": 0}
            )
            if not existing_inv:
                inv_obj = BranchSKUInventory(sku_id=actual_sku_id, branch=branch)
                inv_doc = inv_obj.model_dump()
                inv_doc['activated_at'] = inv_doc['activated_at'].isoformat()
                await db.branch_sku_inventory.insert_one(inv_doc)
            
            # Activate corresponding RMs for this SKU
            rms_activated = await activate_rms_for_sku(actual_sku_id, branch)
            total_rms_activated += rms_activated
            
            assigned_count += 1
        
        return {
            "assigned": assigned_count,
            "skipped": skipped_count,
            "not_found": not_found[:20],
            "total_not_found": len(not_found),
            "rms_activated": total_rms_activated
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/sku-branch-assignments")
async def get_sku_branch_assignments(branch: Optional[str] = None):
    """Get SKU assignments, optionally filtered by branch"""
    query = {}
    if branch:
        query["branch"] = branch
    
    assignments = await db.sku_branch_assignments.find(query, {"_id": 0}).to_list(5000)
    
    # Enrich with SKU details
    result = []
    for a in assignments:
        sku = await db.skus.find_one({"sku_id": a['sku_id']}, {"_id": 0})
        if sku:
            result.append({
                **serialize_doc(a),
                "buyer_sku_id": sku.get('buyer_sku_id', ''),
                "bidso_sku": sku.get('bidso_sku', ''),
                "description": sku.get('description', ''),
                "brand": sku.get('brand', ''),
                "vertical": sku.get('vertical', ''),
                "model": sku.get('model', '')
            })
    
    return result


@router.delete("/sku-branch-assignments/{sku_id}/{branch}")
async def delete_sku_branch_assignment(sku_id: str, branch: str):
    """Remove SKU assignment from a branch"""
    await db.sku_branch_assignments.delete_one({"sku_id": sku_id, "branch": branch})
    return {"message": "Assignment removed"}


@router.post("/sku-branch-assignments/bulk-subscribe")
async def bulk_subscribe_skus(
    branch: str,
    vertical: Optional[str] = None,
    model: Optional[str] = None
):
    """Bulk subscribe all SKUs matching vertical and/or model to a branch. Also activates corresponding RMs."""
    if not branch:
        raise HTTPException(status_code=400, detail="Branch is required")
    
    if not vertical and not model:
        raise HTTPException(status_code=400, detail="At least vertical or model must be specified")
    
    # Build query for matching SKUs
    query = {}
    if vertical:
        query["vertical"] = vertical
    if model:
        query["model"] = model
    
    # Find all matching SKUs
    matching_skus = await db.skus.find(query, {"_id": 0, "sku_id": 1}).to_list(10000)
    
    if not matching_skus:
        return {
            "assigned": 0,
            "skipped": 0,
            "total_matching": 0,
            "rms_activated": 0,
            "message": "No SKUs found matching the criteria"
        }
    
    assigned_count = 0
    skipped_count = 0
    total_rms_activated = 0
    
    for sku in matching_skus:
        sku_id = sku['sku_id']
        
        # Check if already assigned
        existing = await db.sku_branch_assignments.find_one(
            {"sku_id": sku_id, "branch": branch},
            {"_id": 0}
        )
        
        if existing:
            skipped_count += 1
            continue
        
        # Create assignment
        assignment = SKUBranchAssignment(sku_id=sku_id, branch=branch)
        doc = assignment.model_dump()
        doc['assigned_at'] = doc['assigned_at'].isoformat()
        await db.sku_branch_assignments.insert_one(doc)
        
        # Also activate SKU in branch inventory
        existing_inv = await db.branch_sku_inventory.find_one(
            {"sku_id": sku_id, "branch": branch},
            {"_id": 0}
        )
        if not existing_inv:
            inv_obj = BranchSKUInventory(sku_id=sku_id, branch=branch)
            inv_doc = inv_obj.model_dump()
            inv_doc['activated_at'] = inv_doc['activated_at'].isoformat()
            await db.branch_sku_inventory.insert_one(inv_doc)
        
        # Activate corresponding RMs for this SKU
        rms_activated = await activate_rms_for_sku(sku_id, branch)
        total_rms_activated += rms_activated
        
        assigned_count += 1
    
    return {
        "assigned": assigned_count,
        "skipped": skipped_count,
        "total_matching": len(matching_skus),
        "rms_activated": total_rms_activated,
        "message": f"Subscribed {assigned_count} SKUs to {branch}, activated {total_rms_activated} RMs"
    }


@router.delete("/sku-branch-assignments/bulk-unsubscribe")
async def bulk_unsubscribe_skus(
    branch: str,
    vertical: Optional[str] = None,
    model: Optional[str] = None
):
    """Bulk unsubscribe all SKUs matching vertical and/or model from a branch"""
    if not branch:
        raise HTTPException(status_code=400, detail="Branch is required")
    
    if not vertical and not model:
        raise HTTPException(status_code=400, detail="At least vertical or model must be specified")
    
    # Build query for matching SKUs
    query = {}
    if vertical:
        query["vertical"] = vertical
    if model:
        query["model"] = model
    
    # Find all matching SKUs
    matching_skus = await db.skus.find(query, {"_id": 0, "sku_id": 1}).to_list(10000)
    sku_ids = [s['sku_id'] for s in matching_skus]
    
    if not sku_ids:
        return {"removed": 0, "message": "No matching SKUs found"}
    
    # Remove assignments
    result = await db.sku_branch_assignments.delete_many({
        "sku_id": {"$in": sku_ids},
        "branch": branch
    })
    
    return {
        "removed": result.deleted_count,
        "message": f"Removed {result.deleted_count} SKU assignments from {branch}"
    }
