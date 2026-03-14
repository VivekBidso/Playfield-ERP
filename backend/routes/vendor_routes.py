"""Vendor routes - Vendor management, pricing, purchase entries"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import User, Vendor, VendorCreate, VendorRMPrice, VendorRMPriceCreate, PurchaseEntry, PurchaseEntryCreate
from services.utils import get_current_user, get_next_vendor_id, serialize_doc, update_branch_rm_inventory, generate_movement_code, get_branch_rm_stock

router = APIRouter(tags=["Vendors"])


# ============ Vendor Management ============

@router.get("/vendors")
async def get_vendors():
    """Get all vendors"""
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    return vendors


@router.post("/vendors", response_model=Vendor)
async def create_vendor(input: VendorCreate):
    """Create a new vendor"""
    vendor_id = await get_next_vendor_id()
    
    vendor = Vendor(
        vendor_id=vendor_id,
        name=input.name,
        contact_person=input.contact_person,
        phone=input.phone,
        email=input.email,
        address=input.address,
        gst_number=input.gst_number if hasattr(input, 'gst_number') else None,
        payment_terms=input.payment_terms if hasattr(input, 'payment_terms') else "Net 30"
    )
    
    doc = vendor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vendors.insert_one(doc)
    
    return vendor


@router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor(vendor_id: str, input: VendorCreate):
    """Update a vendor"""
    existing = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    update_data = input.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.vendors.update_one({"vendor_id": vendor_id}, {"$set": update_data})
    
    updated = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    return Vendor(**updated)


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str):
    """Delete a vendor"""
    result = await db.vendors.delete_one({"vendor_id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": f"Vendor {vendor_id} deleted"}


# ============ Vendor RM Prices ============

@router.get("/vendor-rm-prices")
async def get_vendor_rm_prices(
    vendor_id: Optional[str] = None,
    rm_id: Optional[str] = None
):
    """Get vendor RM prices"""
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if rm_id:
        query["rm_id"] = rm_id
    
    prices = await db.vendor_rm_prices.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with vendor and RM names
    for price in prices:
        vendor = await db.vendors.find_one({"vendor_id": price["vendor_id"]}, {"_id": 0, "name": 1})
        price["vendor_name"] = vendor.get("name") if vendor else None
        
        rm = await db.raw_materials.find_one({"rm_id": price["rm_id"]}, {"_id": 0, "category_data": 1})
        price["rm_description"] = rm.get("category_data", {}).get("part_name") or rm.get("category_data", {}).get("type") if rm else None
    
    return prices


@router.post("/vendor-rm-prices", response_model=VendorRMPrice)
async def create_vendor_rm_price(input: VendorRMPriceCreate):
    """Create a vendor RM price entry"""
    # Verify vendor exists
    vendor = await db.vendors.find_one({"vendor_id": input.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor {input.vendor_id} not found")
    
    # Verify RM exists
    rm = await db.raw_materials.find_one({"rm_id": input.rm_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail=f"RM {input.rm_id} not found")
    
    # Deactivate existing prices for this vendor-RM combo
    await db.vendor_rm_prices.update_many(
        {"vendor_id": input.vendor_id, "rm_id": input.rm_id},
        {"$set": {"is_active": False}}
    )
    
    price = VendorRMPrice(
        vendor_id=input.vendor_id,
        rm_id=input.rm_id,
        price=input.price,
        min_order_qty=input.min_order_qty if hasattr(input, 'min_order_qty') else 1,
        lead_time_days=input.lead_time_days if hasattr(input, 'lead_time_days') else 7,
        is_active=True
    )
    
    doc = price.model_dump()
    doc['effective_date'] = doc['effective_date'].isoformat()
    await db.vendor_rm_prices.insert_one(doc)
    
    # Record price history
    await db.price_history.insert_one({
        "id": str(uuid.uuid4()),
        "rm_id": input.rm_id,
        "vendor_id": input.vendor_id,
        "price": input.price,
        "effective_date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return price


@router.delete("/vendor-rm-prices/{price_id}")
async def delete_vendor_rm_price(price_id: str):
    """Delete a vendor RM price"""
    result = await db.vendor_rm_prices.delete_one({"id": price_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Price not found")
    return {"message": "Price deleted"}


# ============ Purchase Entries (RM Inward) ============

@router.get("/purchase-entries")
async def get_purchase_entries(
    branch: Optional[str] = None,
    rm_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get purchase entries"""
    query = {}
    if branch:
        query["branch"] = branch
    if rm_id:
        query["rm_id"] = rm_id
    
    entries = await db.purchase_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    return entries


@router.post("/purchase-entries")
async def create_purchase_entry(
    input: PurchaseEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a purchase entry (RM Inward)"""
    # Verify RM exists
    rm = await db.raw_materials.find_one({"rm_id": input.rm_id}, {"_id": 0})
    if not rm:
        raise HTTPException(status_code=404, detail=f"RM {input.rm_id} not found")
    
    entry = PurchaseEntry(
        branch=input.branch,
        rm_id=input.rm_id,
        quantity=input.quantity,
        vendor_id=input.vendor_id if hasattr(input, 'vendor_id') else None,
        unit_price=input.unit_price if hasattr(input, 'unit_price') else 0,
        invoice_number=input.invoice_number if hasattr(input, 'invoice_number') else None
    )
    
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['purchase_date'] = doc['purchase_date'].isoformat() if doc.get('purchase_date') else None
    
    await db.purchase_entries.insert_one(doc)
    
    # Update branch inventory
    current_stock = await get_branch_rm_stock(input.branch, input.rm_id)
    await update_branch_rm_inventory(input.branch, input.rm_id, input.quantity)
    
    # Record stock movement
    movement_code = await generate_movement_code()
    await db.rm_stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "movement_code": movement_code,
        "rm_id": input.rm_id,
        "branch": input.branch,
        "movement_type": "PURCHASE",
        "quantity": input.quantity,
        "reference_type": "PURCHASE_ENTRY",
        "reference_id": entry.id,
        "balance_after": current_stock + input.quantity,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Purchase entry created", "entry": doc}
