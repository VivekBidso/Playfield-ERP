"""
Demand Hub Routes - For Demand Planners/KAM users to:
1. Request new Buyer SKUs
2. Request new Raw Materials (labels, packaging)
3. View their request history and status
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from database import db
from services.auth_service import get_current_user
from models.auth import User

router = APIRouter(prefix="/demand-hub", tags=["Demand Hub"])


# ============== BUYER SKU REQUEST ENDPOINTS ==============

@router.post("/buyer-sku-requests")
async def create_buyer_sku_request(data: dict, current_user: User = Depends(get_current_user)):
    """Create a new Buyer SKU request (Demand Planner)"""
    
    bidso_sku_id = data.get("bidso_sku_id")
    brand_id = data.get("brand_id")
    
    if not bidso_sku_id or not brand_id:
        raise HTTPException(status_code=400, detail="bidso_sku_id and brand_id are required")
    
    # Verify Bidso SKU exists
    bidso_sku = await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})
    if not bidso_sku:
        raise HTTPException(status_code=404, detail=f"Bidso SKU {bidso_sku_id} not found")
    
    # Verify Brand exists
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    # Check if Buyer SKU already exists
    buyer_sku_id = f"{brand['code']}_{bidso_sku_id}"
    existing = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Buyer SKU {buyer_sku_id} already exists")
    
    # Check if there's already a pending request
    pending = await db.buyer_sku_requests.find_one({
        "bidso_sku_id": bidso_sku_id,
        "brand_id": brand_id,
        "status": "PENDING"
    })
    if pending:
        raise HTTPException(status_code=400, detail=f"A pending request for {buyer_sku_id} already exists")
    
    # Create request
    request_id = str(uuid.uuid4())
    request = {
        "id": request_id,
        "bidso_sku_id": bidso_sku_id,
        "brand_id": brand_id,
        "brand_code": brand["code"],
        "brand_name": brand["name"],
        "bidso_sku_name": bidso_sku.get("name", ""),
        "buyer_sku_id": buyer_sku_id,  # Proposed ID
        "notes": data.get("notes", ""),
        "status": "PENDING",
        "requested_by": current_user.id,
        "requester_name": current_user.name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": ""
    }
    
    await db.buyer_sku_requests.insert_one(request)
    
    return {"message": "Buyer SKU request created", "id": request_id, "buyer_sku_id": buyer_sku_id}


@router.get("/buyer-sku-requests")
async def get_buyer_sku_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get Buyer SKU requests"""
    query = {}
    if status:
        query["status"] = status.upper()
    
    requests = await db.buyer_sku_requests.find(query, {"_id": 0}).sort("requested_at", -1).to_list(500)
    return requests


@router.get("/buyer-sku-requests/pending-count")
async def get_pending_buyer_sku_count():
    """Get count of pending Buyer SKU requests"""
    count = await db.buyer_sku_requests.count_documents({"status": "PENDING"})
    return {"pending_count": count}


@router.post("/buyer-sku-requests/{request_id}/review")
async def review_buyer_sku_request(request_id: str, data: dict, current_user: User = Depends(get_current_user)):
    """Review (approve/reject) a Buyer SKU request (Tech Ops)"""
    
    request = await db.buyer_sku_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
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
        # Approve - Create the Buyer SKU
        bidso_sku = await db.bidso_skus.find_one({"bidso_sku_id": request["bidso_sku_id"]}, {"_id": 0})
        brand = await db.brands.find_one({"id": request["brand_id"]}, {"_id": 0})
        
        if not bidso_sku or not brand:
            raise HTTPException(status_code=400, detail="Bidso SKU or Brand no longer exists")
        
        buyer_sku_id = request["buyer_sku_id"]
        
        # Check again if Buyer SKU was created meanwhile
        existing = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id})
        if existing:
            update_data["status"] = "APPROVED"
            update_data["review_notes"] = f"Buyer SKU already exists. {review_notes}"
        else:
            # Create Buyer SKU
            new_buyer_sku = {
                "id": str(uuid.uuid4()),
                "buyer_sku_id": buyer_sku_id,
                "bidso_sku_id": request["bidso_sku_id"],
                "brand_id": request["brand_id"],
                "brand_code": brand["code"],
                "name": f"{brand['name']} - {bidso_sku.get('name', request['bidso_sku_id'])}",
                "status": "ACTIVE",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user.id
            }
            await db.buyer_skus.insert_one(new_buyer_sku)
            update_data["status"] = "APPROVED"
    
    await db.buyer_sku_requests.update_one({"id": request_id}, {"$set": update_data})
    
    return {"message": f"Request {action.lower()}d", "buyer_sku_id": request.get("buyer_sku_id")}


# ============== MY REQUESTS (Combined View) ==============


@router.get("/my-requests/summary")
async def get_my_requests_summary(current_user: User = Depends(get_current_user)):
    """Get summary counts for the current user's requests"""
    
    # RM requests
    rm_total = await db.rm_requests.count_documents({"requested_by": current_user.id})
    rm_pending = await db.rm_requests.count_documents({"requested_by": current_user.id, "status": "PENDING"})
    rm_approved = await db.rm_requests.count_documents({"requested_by": current_user.id, "status": "APPROVED"})
    
    # Buyer SKU requests
    sku_total = await db.buyer_sku_requests.count_documents({"requested_by": current_user.id})
    sku_pending = await db.buyer_sku_requests.count_documents({"requested_by": current_user.id, "status": "PENDING"})
    sku_approved = await db.buyer_sku_requests.count_documents({"requested_by": current_user.id, "status": "APPROVED"})
    
    # Bidso Clone requests
    clone_total = await db.bidso_clone_requests.count_documents({"requested_by": current_user.id})
    clone_pending = await db.bidso_clone_requests.count_documents({"requested_by": current_user.id, "status": "PENDING"})
    clone_approved = await db.bidso_clone_requests.count_documents({"requested_by": current_user.id, "status": "APPROVED"})
    
    return {
        "rm_requests": {"total": rm_total, "pending": rm_pending, "approved": rm_approved},
        "buyer_sku_requests": {"total": sku_total, "pending": sku_pending, "approved": sku_approved},
        "bidso_clone_requests": {"total": clone_total, "pending": clone_pending, "approved": clone_approved},
        "total_pending": rm_pending + sku_pending + clone_pending,
        "total_approved": rm_approved + sku_approved + clone_approved
    }


# ============== LOOKUP ENDPOINTS (For Forms) ==============

@router.get("/bidso-skus")
async def get_bidso_skus_for_demand(
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    search: Optional[str] = None
):
    """Get Bidso SKUs for dropdown (with optional filters)"""
    query = {"status": "ACTIVE"}
    
    if vertical_id:
        query["vertical_id"] = vertical_id
    if model_id:
        query["model_id"] = model_id
    
    skus = await db.bidso_skus.find(query, {"_id": 0}).to_list(500)
    
    # Apply search filter client-side for flexibility
    if search:
        search_lower = search.lower()
        skus = [s for s in skus if search_lower in s.get("bidso_sku_id", "").lower() or search_lower in s.get("name", "").lower()]
    
    # Enrich with vertical and model names
    vertical_ids = list(set(s.get("vertical_id") for s in skus if s.get("vertical_id")))
    model_ids = list(set(s.get("model_id") for s in skus if s.get("model_id")))
    
    verticals = {}
    models = {}
    
    if vertical_ids:
        v_docs = await db.verticals.find({"id": {"$in": vertical_ids}}, {"_id": 0, "id": 1, "code": 1, "name": 1}).to_list(50)
        verticals = {v["id"]: v for v in v_docs}
    
    if model_ids:
        m_docs = await db.models.find({"id": {"$in": model_ids}}, {"_id": 0, "id": 1, "code": 1, "name": 1}).to_list(100)
        models = {m["id"]: m for m in m_docs}
    
    for sku in skus:
        sku["vertical"] = verticals.get(sku.get("vertical_id"), {})
        sku["model"] = models.get(sku.get("model_id"), {})
    
    return skus


@router.get("/existing-buyer-skus/{bidso_sku_id}")
async def get_existing_buyer_skus(bidso_sku_id: str):
    """Get existing Buyer SKUs for a Bidso SKU (to show which brands already have variants)"""
    buyer_skus = await db.buyer_skus.find(
        {"bidso_sku_id": bidso_sku_id, "status": "ACTIVE"},
        {"_id": 0, "buyer_sku_id": 1, "brand_id": 1, "brand_code": 1, "name": 1}
    ).to_list(50)
    
    # Also get pending requests
    pending = await db.buyer_sku_requests.find(
        {"bidso_sku_id": bidso_sku_id, "status": "PENDING"},
        {"_id": 0, "buyer_sku_id": 1, "brand_id": 1, "brand_code": 1, "status": 1}
    ).to_list(50)
    
    return {
        "existing": buyer_skus,
        "pending_requests": pending
    }


# ============== RM CATEGORIES FOR DROPDOWN ==============

@router.get("/rm-categories")
async def get_rm_categories():
    """Get RM categories relevant for Demand requests (labels, packaging, brand assets)"""
    return [
        {"code": "LB", "name": "Labels", "description": "Product labels and stickers"},
        {"code": "PM", "name": "Packaging", "description": "Boxes, cartons, packaging materials"},
        {"code": "BS", "name": "Brand Assets", "description": "Brand-specific inserts, manuals, etc."},
    ]


# ============== BIDSO SKU CLONE REQUEST ENDPOINTS ==============

@router.get("/bidso-skus-for-clone")
async def get_bidso_skus_for_clone(
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    search: Optional[str] = None
):
    """Get Bidso SKUs available for cloning (must have a BOM)"""
    query = {"status": "ACTIVE"}
    
    if vertical_id:
        query["vertical_id"] = vertical_id
    if model_id:
        query["model_id"] = model_id
    
    skus = await db.bidso_skus.find(query, {"_id": 0}).to_list(500)
    
    # Filter to only those with a BOM
    result = []
    for sku in skus:
        bom = await db.common_bom.find_one({"bidso_sku_id": sku["bidso_sku_id"]}, {"_id": 0, "items": 1})
        if bom and bom.get("items"):
            sku["bom_item_count"] = len(bom.get("items", []))
            result.append(sku)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        result = [s for s in result if 
                  search_lower in s.get("bidso_sku_id", "").lower() or 
                  search_lower in s.get("name", "").lower()]
    
    # Enrich with vertical and model names
    vertical_ids = list(set(s.get("vertical_id") for s in result if s.get("vertical_id")))
    model_ids = list(set(s.get("model_id") for s in result if s.get("model_id")))
    
    verticals = {}
    models = {}
    
    if vertical_ids:
        v_docs = await db.verticals.find({"id": {"$in": vertical_ids}}, {"_id": 0}).to_list(50)
        verticals = {v["id"]: v for v in v_docs}
    
    if model_ids:
        m_docs = await db.models.find({"id": {"$in": model_ids}}, {"_id": 0}).to_list(100)
        models = {m["id"]: m for m in m_docs}
    
    for sku in result:
        sku["vertical"] = verticals.get(sku.get("vertical_id"), {})
        sku["model"] = models.get(sku.get("model_id"), {})
    
    return result


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
                "mould_code": category_data.get("mould_code", ""),
                "type": category_data.get("type", ""),
                "specs": category_data.get("specs", ""),
            })
    
    return {
        "source_sku": bidso_sku,
        "bom_items": enriched_items,
        "total_items": len(enriched_items),
        "editable_count": len([i for i in enriched_items if i["edit_type"] != "LOCKED"]),
        "locked_count": len([i for i in enriched_items if i["edit_type"] == "LOCKED"])
    }


@router.get("/colour-variants/{rm_id}")
async def get_colour_variants(rm_id: str):
    """
    Find colour variants of an RM (same base part, different colours).
    For INP: Same mould_code + model_name + part_name, different colour
    For INM: Same model_name + part_name, different colour
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
        if category_data.get("mould_code"):
            query["category_data.mould_code"] = category_data.get("mould_code")
        if category_data.get("model_name"):
            query["category_data.model_name"] = category_data.get("model_name")
        if category_data.get("part_name"):
            query["category_data.part_name"] = category_data.get("part_name")
    elif category == "INM":
        # Match by model_name, part_name
        if category_data.get("model_name"):
            query["category_data.model_name"] = category_data.get("model_name")
        if category_data.get("part_name"):
            query["category_data.part_name"] = category_data.get("part_name")
    elif category == "ACC":
        # Match by type, model_name, specs
        if category_data.get("type"):
            query["category_data.type"] = category_data.get("type")
        if category_data.get("model_name"):
            query["category_data.model_name"] = category_data.get("model_name")
        if category_data.get("specs"):
            query["category_data.specs"] = category_data.get("specs")
    else:
        return {"source_rm": source_rm, "variants": [], "message": "Category does not support colour variants"}
    
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
            "category": category,
            "colour": category_data.get("colour", "N/A"),
            "name": category_data.get("name", ""),
            "category_data": category_data
        },
        "variants": result,
        "total_variants": len(result)
    }


@router.get("/search-rm-for-swap")
async def search_rm_for_swap(
    category: str,
    model_name: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
):
    """
    Search RMs for swapping (ACC category).
    Returns RMs in same category that can replace current RM.
    Supports toggle between filtered (same model_name) and all view.
    """
    query = {"category": category}
    
    # If model_name provided, filter by it (filtered view)
    if model_name:
        query["category_data.model_name"] = model_name
    
    rms = await db.raw_materials.find(query, {"_id": 0}).to_list(1000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        rms = [rm for rm in rms if 
               search_lower in rm.get("rm_id", "").lower() or
               search_lower in rm.get("category_data", {}).get("name", "").lower() or
               search_lower in rm.get("category_data", {}).get("type", "").lower() or
               search_lower in rm.get("category_data", {}).get("model_name", "").lower() or
               search_lower in rm.get("category_data", {}).get("specs", "").lower()]
    
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


@router.post("/bidso-clone-requests")
async def create_bidso_clone_request(data: dict, current_user: User = Depends(get_current_user)):
    """
    Submit a Bidso SKU clone request.
    The request will be reviewed by Tech Ops before creation.
    """
    source_bidso_sku_id = data.get("source_bidso_sku_id")
    proposed_name = data.get("proposed_name")
    
    if not source_bidso_sku_id:
        raise HTTPException(status_code=400, detail="source_bidso_sku_id is required")
    if not proposed_name:
        raise HTTPException(status_code=400, detail="proposed_name is required")
    
    # Verify source SKU exists
    source_sku = await db.bidso_skus.find_one({"bidso_sku_id": source_bidso_sku_id}, {"_id": 0})
    if not source_sku:
        raise HTTPException(status_code=404, detail="Source Bidso SKU not found")
    
    # Verify source has BOM
    source_bom = await db.common_bom.find_one({"bidso_sku_id": source_bidso_sku_id}, {"_id": 0})
    if not source_bom:
        raise HTTPException(status_code=400, detail="Source Bidso SKU has no BOM")
    
    # Count locked items
    bom_modifications = data.get("bom_modifications", [])
    modified_rm_ids = set(m.get("original_rm_id") for m in bom_modifications)
    locked_items_count = len([i for i in source_bom.get("items", []) if i.get("rm_id") not in modified_rm_ids])
    
    # Create request
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "status": "PENDING",
        
        # Source
        "source_bidso_sku_id": source_bidso_sku_id,
        "source_bidso_sku_name": source_sku.get("name", ""),
        "source_vertical_id": source_sku.get("vertical_id"),
        "source_vertical_code": source_sku.get("vertical_code"),
        "source_model_id": source_sku.get("model_id"),
        "source_model_code": source_sku.get("model_code"),
        
        # Proposed
        "proposed_name": proposed_name,
        "proposed_description": data.get("proposed_description", ""),
        
        # BOM
        "bom_modifications": bom_modifications,
        "locked_items_count": locked_items_count,
        "total_bom_items": len(source_bom.get("items", [])),
        
        # Request metadata
        "requested_by": current_user.id,
        "requester_name": current_user.name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        
        # Approval (to be filled)
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": "",
        
        # Result (to be filled on approval)
        "created_bidso_sku_id": None,
        "created_rm_ids": []
    }
    
    await db.bidso_clone_requests.insert_one(request_doc)
    
    return {
        "message": "Bidso SKU clone request submitted",
        "id": request_id,
        "source_sku": source_bidso_sku_id,
        "modifications_count": len(bom_modifications)
    }


@router.get("/bidso-clone-requests")
async def get_bidso_clone_requests(
    status: Optional[str] = None,
    my_requests: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get Bidso SKU clone requests"""
    query = {}
    
    if status:
        query["status"] = status.upper()
    
    if my_requests:
        query["requested_by"] = current_user.id
    
    requests = await db.bidso_clone_requests.find(query, {"_id": 0}).sort("requested_at", -1).to_list(500)
    return requests


@router.get("/bidso-clone-requests/pending-count")
async def get_pending_bidso_clone_count():
    """Get count of pending Bidso SKU clone requests"""
    count = await db.bidso_clone_requests.count_documents({"status": "PENDING"})
    return {"pending_count": count}


@router.get("/bidso-clone-requests/{request_id}")
async def get_bidso_clone_request_detail(request_id: str):
    """Get detailed info about a Bidso SKU clone request"""
    request = await db.bidso_clone_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get source BOM for full context
    source_bom = await db.common_bom.find_one(
        {"bidso_sku_id": request.get("source_bidso_sku_id")}, 
        {"_id": 0}
    )
    
    # Enrich BOM items with RM details
    if source_bom:
        enriched_items = []
        for item in source_bom.get("items", []):
            rm = await db.raw_materials.find_one({"rm_id": item.get("rm_id")}, {"_id": 0})
            if rm:
                enriched_items.append({
                    "rm_id": item.get("rm_id"),
                    "rm_name": rm.get("category_data", {}).get("name", ""),
                    "category": rm.get("category"),
                    "category_data": rm.get("category_data", {}),
                    "quantity": item.get("quantity", 1),
                    "unit": item.get("unit", "nos")
                })
        request["source_bom_items"] = enriched_items
    
    return request


@router.post("/bidso-clone-requests/{request_id}/review")
async def review_bidso_clone_request(
    request_id: str, 
    data: dict, 
    current_user: User = Depends(get_current_user)
):
    """
    Review (approve/reject) a Bidso SKU clone request.
    On approval, creates new RMs, Bidso SKU, and Common BOM.
    """
    from services.utils import get_next_rm_sequence, generate_rm_name
    
    request = await db.bidso_clone_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
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
        await db.bidso_clone_requests.update_one({"id": request_id}, {"$set": update_data})
        return {"message": "Request rejected"}
    
    # APPROVE - Create everything
    source_sku_id = request.get("source_bidso_sku_id")
    source_sku = await db.bidso_skus.find_one({"bidso_sku_id": source_sku_id}, {"_id": 0})
    source_bom = await db.common_bom.find_one({"bidso_sku_id": source_sku_id}, {"_id": 0})
    
    if not source_sku or not source_bom:
        raise HTTPException(status_code=400, detail="Source SKU or BOM no longer exists")
    
    # Generate new Bidso SKU ID
    vertical_code = source_sku.get("vertical_code")
    model_code = source_sku.get("model_code")
    
    # Find next available numeric code
    prefix = f"{vertical_code}_{model_code}_"
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
    
    numeric_code = str(max_num + 1).zfill(3)
    new_bidso_sku_id = f"{vertical_code}_{model_code}_{numeric_code}"
    
    # Create new RMs and build modification mapping
    created_rm_ids = []
    rm_mapping = {}  # original_rm_id -> new_rm_id
    
    for mod in request.get("bom_modifications", []):
        original_rm_id = mod.get("original_rm_id")
        action_type = mod.get("action")
        
        if action_type == "CREATE_NEW":
            # Create new RM
            new_rm_def = mod.get("new_rm_definition", {})
            category = new_rm_def.get("category")
            category_data = new_rm_def.get("category_data", {})
            
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
            
            created_rm_ids.append(new_rm_id)
            rm_mapping[original_rm_id] = new_rm_id
            
        elif action_type in ["SWAP_COLOUR", "SWAP_RM"]:
            # Use existing RM
            new_rm_id = mod.get("new_rm_id")
            if new_rm_id:
                rm_mapping[original_rm_id] = new_rm_id
    
    # Create new BOM by copying source and applying modifications
    new_bom_items = []
    for item in source_bom.get("items", []):
        rm_id = item.get("rm_id")
        
        if rm_id in rm_mapping:
            # Swap to new RM
            new_rm_id = rm_mapping[rm_id]
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
        "name": request.get("proposed_name"),
        "description": request.get("proposed_description", f"Cloned from {source_sku_id}"),
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
    
    # Update request with results
    update_data["status"] = "APPROVED"
    update_data["created_bidso_sku_id"] = new_bidso_sku_id
    update_data["created_rm_ids"] = created_rm_ids
    
    await db.bidso_clone_requests.update_one({"id": request_id}, {"$set": update_data})
    
    return {
        "message": "Request approved",
        "created_bidso_sku_id": new_bidso_sku_id,
        "created_rm_ids": created_rm_ids,
        "bom_items_count": len(new_bom_items)
    }


@router.get("/my-requests")
async def get_my_requests(current_user: User = Depends(get_current_user)):
    """Get all requests created by the current user (RM, Buyer SKU, and Bidso Clone)"""
    
    # Get RM requests
    rm_requests = await db.rm_requests.find(
        {"requested_by": current_user.id},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    # Enrich with brand names
    brand_ids = set()
    for req in rm_requests:
        brand_ids.update(req.get("brand_ids", []))
    
    brands = {}
    if brand_ids:
        brand_docs = await db.brands.find({"id": {"$in": list(brand_ids)}}, {"_id": 0, "id": 1, "code": 1, "name": 1}).to_list(50)
        brands = {b["id"]: b for b in brand_docs}
    
    for req in rm_requests:
        req["type"] = "RM"
        req["brands"] = [brands.get(bid, {"code": bid}) for bid in req.get("brand_ids", [])]
    
    # Get Buyer SKU requests
    buyer_sku_requests = await db.buyer_sku_requests.find(
        {"requested_by": current_user.id},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    for req in buyer_sku_requests:
        req["type"] = "BUYER_SKU"
    
    # Get Bidso Clone requests
    bidso_clone_requests = await db.bidso_clone_requests.find(
        {"requested_by": current_user.id},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    for req in bidso_clone_requests:
        req["type"] = "BIDSO_CLONE"
    
    # Combine and sort by requested_at
    all_requests = rm_requests + buyer_sku_requests + bidso_clone_requests
    all_requests.sort(key=lambda x: x.get("requested_at", ""), reverse=True)
    
    return all_requests

