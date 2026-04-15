"""Vendor routes - Vendor management, pricing, purchase entries"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from models import User, Vendor, VendorCreate, VendorRMPrice, VendorRMPriceCreate, PurchaseEntry, PurchaseEntryCreate
from services.utils import get_current_user, get_next_vendor_id, serialize_doc, update_branch_rm_inventory, generate_movement_code, get_branch_rm_stock
from services.rbac_service import require_permission

router = APIRouter(tags=["Vendors"])


# ============ Vendor Management ============

@router.get("/vendors")
async def get_vendors():
    """Get all vendors"""
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    return vendors


@router.post("/vendors", response_model=Vendor)
@require_permission("Vendor", "CREATE")
async def create_vendor(input: VendorCreate, current_user: User = Depends(get_current_user)):
    """Create a new vendor (MASTER_ADMIN, PROCUREMENT_OFFICER)"""
    vendor_id = await get_next_vendor_id()
    
    vendor = Vendor(
        vendor_id=vendor_id,
        name=input.name,
        poc=input.poc,
        phone=input.phone,
        email=input.email,
        address=input.address,
        gst=input.gst
    )
    
    doc = vendor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['created_by'] = current_user.id
    await db.vendors.insert_one(doc)
    
    return vendor


@router.put("/vendors/{vendor_id}", response_model=Vendor)
@require_permission("Vendor", "UPDATE")
async def update_vendor(vendor_id: str, input: VendorCreate, current_user: User = Depends(get_current_user)):
    """Update a vendor (MASTER_ADMIN, PROCUREMENT_OFFICER)"""
    existing = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    update_data = input.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.id
    
    await db.vendors.update_one({"vendor_id": vendor_id}, {"$set": update_data})
    
    updated = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    return Vendor(**updated)


@router.delete("/vendors/{vendor_id}")
@require_permission("Vendor", "DELETE")
async def delete_vendor(vendor_id: str, current_user: User = Depends(get_current_user)):
    """Delete a vendor (MASTER_ADMIN only)"""
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
@require_permission("VendorRMPrice", "CREATE")
async def create_vendor_rm_price(input: VendorRMPriceCreate, current_user: User = Depends(get_current_user)):
    """Create a vendor RM price entry (MASTER_ADMIN, PROCUREMENT_OFFICER)"""
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
    doc['created_by'] = current_user.id
    await db.vendor_rm_prices.insert_one(doc)
    
    # Record price history
    await db.price_history.insert_one({
        "id": str(uuid.uuid4()),
        "rm_id": input.rm_id,
        "vendor_id": input.vendor_id,
        "price": input.price,
        "effective_date": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
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
@require_permission("RMStockMovement", "CREATE")
async def create_purchase_entry(
    input: PurchaseEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a purchase entry (RM Inward) - MASTER_ADMIN, PROCUREMENT_OFFICER, BRANCH_OPS_USER"""
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
    doc['created_by'] = current_user.id
    
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
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Purchase entry created", "entry": doc}


# ============ RM Inward Bills ============

class BillLineItem(BaseModel):
    rm_id: str
    quantity: float
    rate: float = 0
    tax: str = "NONE"
    tax_amount: float = 0
    amount: float = 0

class BillTotals(BaseModel):
    sub_total: float = 0
    discount_type: str = "percentage"
    discount_value: float = 0
    discount_amount: float = 0
    tds_tcs: str = "NONE"
    tds_tcs_amount: float = 0
    tax_total: float = 0
    grand_total: float = 0

class RMInwardBillCreate(BaseModel):
    vendor_id: str
    vendor_name: str
    branch: str
    branch_id: Optional[str] = None
    bill_number: str
    order_number: Optional[str] = None
    bill_date: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: str = "NET_30"
    accounts_payable: str = "Trade Payables"
    reverse_charge: bool = False
    notes: Optional[str] = None
    line_items: List[dict]
    totals: dict
    date: Optional[str] = None


@router.post("/rm-inward/bills")
@require_permission("RMStockMovement", "CREATE")
async def create_rm_inward_bill(
    input: RMInwardBillCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a full RM Inward bill with multiple line items.
    Also creates a corresponding bill in Zoho Books.
    If Zoho bill creation fails, the entire operation is rolled back.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Import Zoho service
    from services.zoho_service import zoho_client
    
    # Generate bill ID
    bill_count = await db.rm_inward_bills.count_documents({})
    bill_id = f"BILL_{datetime.now(timezone.utc).strftime('%Y%m')}_{bill_count + 1:05d}"
    
    # Validate all RMs exist
    for item in input.line_items:
        rm = await db.raw_materials.find_one({"rm_id": item["rm_id"]}, {"_id": 0, "rm_id": 1})
        if not rm:
            raise HTTPException(status_code=404, detail=f"RM {item['rm_id']} not found")
    
    # ========== ZOHO BOOKS INTEGRATION ==========
    zoho_result = None
    zoho_error = None
    
    if zoho_client.is_configured():
        try:
            logger.info(f"Creating Zoho bill for {input.bill_number}...")
            
            # Get or create vendor in Zoho
            zoho_vendor_id = await zoho_client.get_or_create_vendor(input.vendor_name)
            
            # Create bill in Zoho Books
            zoho_result = await zoho_client.create_bill(
                vendor_id=zoho_vendor_id,
                vendor_name=input.vendor_name,
                bill_number=input.bill_number,
                bill_date=input.bill_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                line_items=input.line_items,
                reference_number=input.order_number,
                notes=input.notes,
                due_date=input.due_date
            )
            
            logger.info(f"Zoho bill created: {zoho_result.get('zoho_bill_id')}")
            
        except Exception as e:
            zoho_error = str(e)
            logger.error(f"Zoho bill creation failed: {zoho_error}")
            # Fail the entire operation if Zoho fails
            raise HTTPException(
                status_code=502, 
                detail=f"Failed to create bill in Zoho Books: {zoho_error}. RM Inward not recorded."
            )
    else:
        logger.warning("Zoho Books integration not configured - skipping")
    
    # ========== CREATE LOCAL BILL ==========
    # Create bill document
    bill = {
        "id": str(uuid.uuid4()),
        "bill_id": bill_id,
        "vendor_id": input.vendor_id,
        "vendor_name": input.vendor_name,
        "branch": input.branch,
        "branch_id": input.branch_id,
        "bill_number": input.bill_number,
        "order_number": input.order_number,
        "bill_date": input.bill_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": input.due_date,
        "payment_terms": input.payment_terms,
        "accounts_payable": input.accounts_payable,
        "reverse_charge": input.reverse_charge,
        "notes": input.notes,
        "line_items": input.line_items,
        "totals": input.totals,
        "status": "POSTED",
        "created_by": current_user.id,
        "created_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        # Zoho integration fields
        "zoho_bill_id": zoho_result.get("zoho_bill_id") if zoho_result else None,
        "zoho_bill_number": zoho_result.get("zoho_bill_number") if zoho_result else None,
        "zoho_synced": zoho_result is not None
    }
    
    await db.rm_inward_bills.insert_one(bill)
    
    # Create individual purchase entries and update inventory for each line item
    entries_created = []
    for item in input.line_items:
        entry_id = str(uuid.uuid4())
        entry = {
            "id": entry_id,
            "bill_id": bill_id,
            "bill_number": input.bill_number,
            "vendor_id": input.vendor_id,
            "vendor_name": input.vendor_name,
            "branch": input.branch,
            "rm_id": item["rm_id"],
            "description": item.get("description", ""),
            "hsn": item.get("hsn", ""),
            "quantity": item["quantity"],
            "rate": item.get("rate", 0),
            "tax": item.get("tax", "NONE"),
            "tax_amount": item.get("tax_amount", 0),
            "amount": item.get("amount", 0),
            "date": input.date or datetime.now(timezone.utc).isoformat(),
            "notes": input.notes,
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.purchase_entries.insert_one(entry)
        entries_created.append(entry)
        
        # Update branch inventory
        current_stock = await get_branch_rm_stock(input.branch, item["rm_id"])
        await update_branch_rm_inventory(input.branch, item["rm_id"], item["quantity"])
        
        # Record stock movement
        movement_code = await generate_movement_code()
        await db.rm_stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "movement_code": movement_code,
            "rm_id": item["rm_id"],
            "branch": input.branch,
            "movement_type": "PURCHASE",
            "quantity": item["quantity"],
            "reference_type": "RM_INWARD_BILL",
            "reference_id": bill_id,
            "balance_after": current_stock + item["quantity"],
            "notes": f"Bill: {input.bill_number}, Vendor: {input.vendor_name}",
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    response = {
        "message": f"Bill {input.bill_number} recorded successfully",
        "bill_id": bill_id,
        "entries_count": len(entries_created),
        "grand_total": input.totals.get("grand_total", 0)
    }
    
    # Add Zoho info to response
    if zoho_result:
        response["zoho_synced"] = True
        response["zoho_bill_id"] = zoho_result.get("zoho_bill_id")
        response["zoho_message"] = "Bill also created in Zoho Books"
    
    return response


@router.get("/rm-inward/bills")
async def get_rm_inward_bills(
    branch: Optional[str] = None,
    vendor_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get RM Inward bills"""
    query = {}
    if branch:
        query["branch"] = branch
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    bills = await db.rm_inward_bills.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"bills": bills, "total": len(bills)}
