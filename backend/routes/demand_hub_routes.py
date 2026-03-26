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
        raise HTTPException(status_code=404, detail=f"Brand not found")
    
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

@router.get("/my-requests")
async def get_my_requests(current_user: User = Depends(get_current_user)):
    """Get all requests created by the current user (both RM and Buyer SKU)"""
    
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
    
    # Combine and sort by requested_at
    all_requests = rm_requests + buyer_sku_requests
    all_requests.sort(key=lambda x: x.get("requested_at", ""), reverse=True)
    
    return all_requests


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
    
    return {
        "rm_requests": {"total": rm_total, "pending": rm_pending, "approved": rm_approved},
        "buyer_sku_requests": {"total": sku_total, "pending": sku_pending, "approved": sku_approved},
        "total_pending": rm_pending + sku_pending,
        "total_approved": rm_approved + sku_approved
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
