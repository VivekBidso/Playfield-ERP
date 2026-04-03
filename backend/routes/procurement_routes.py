"""Procurement routes - Purchase Orders, Dispatches, Invoices, IBT"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from database import db
from services.stock_origin_service import transfer_stock_with_origin

router = APIRouter(tags=["Procurement"])

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'order_date' in doc and isinstance(doc['order_date'], str):
        doc['order_date'] = datetime.fromisoformat(doc['order_date'])
    if doc and 'dispatch_date' in doc and isinstance(doc['dispatch_date'], str):
        doc['dispatch_date'] = datetime.fromisoformat(doc['dispatch_date'])
    if doc and 'invoice_date' in doc and isinstance(doc['invoice_date'], str):
        doc['invoice_date'] = datetime.fromisoformat(doc['invoice_date'])
    return doc

class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    branch: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    notes: str = ""

class POLineCreate(BaseModel):
    rm_id: str
    quantity_ordered: float
    unit_price: float
    unit_of_measure: str = "PCS"

class DispatchRecordCreate(BaseModel):
    dispatch_lot_id: str
    branch: str
    buyer_id: str
    sku_id: str
    quantity: int
    dispatch_date: datetime
    shipping_method: str = ""
    tracking_number: str = ""

class InvoiceCreate(BaseModel):
    dispatch_id: Optional[str] = None
    buyer_id: str
    invoice_date: datetime
    subtotal: float
    tax_amount: float = 0
    notes: str = ""

class IBTCreate(BaseModel):
    transfer_type: str  # RM or FG
    source_branch: str
    destination_branch: str
    item_id: str  # rm_id or sku_id
    quantity: float
    notes: str = ""

# --- Purchase Orders ---
@router.get("/purchase-orders")
async def get_purchase_orders(
    vendor_id: Optional[str] = None,
    branch: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if branch:
        query["branch"] = branch
    if status:
        query["status"] = status
    pos = await db.purchase_orders.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(po) for po in pos]

@router.post("/purchase-orders")
async def create_purchase_order(data: PurchaseOrderCreate):
    count = await db.purchase_orders.count_documents({})
    po_number = f"PO_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    po = {
        "id": str(uuid.uuid4()),
        "po_number": po_number,
        "vendor_id": data.vendor_id,
        "branch": data.branch,
        "order_date": data.order_date,
        "expected_delivery_date": data.expected_delivery_date,
        "total_amount": 0,
        "currency": "INR",
        "status": "DRAFT",
        "payment_status": "PENDING",
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.purchase_orders.insert_one(po)
    del po["_id"]
    return serialize_doc(po)

@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(po_id: str):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    lines = await db.purchase_order_lines.find({"po_id": po_id}, {"_id": 0}).to_list(1000)
    po["lines"] = [serialize_doc(l) for l in lines]
    return serialize_doc(po)

@router.post("/purchase-orders/{po_id}/lines")
async def add_po_line(po_id: str, data: POLineCreate):
    po = await db.purchase_orders.find_one({"id": po_id})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    line_total = data.quantity_ordered * data.unit_price
    line = {
        "id": str(uuid.uuid4()),
        "po_id": po_id,
        "rm_id": data.rm_id,
        "quantity_ordered": data.quantity_ordered,
        "quantity_received": 0,
        "unit_price": data.unit_price,
        "unit_of_measure": data.unit_of_measure,
        "line_total": line_total,
        "status": "PENDING"
    }
    await db.purchase_order_lines.insert_one(line)
    await db.purchase_orders.update_one({"id": po_id}, {"$inc": {"total_amount": line_total}})
    del line["_id"]
    return line

@router.put("/purchase-orders/{po_id}/send")
async def send_purchase_order(po_id: str):
    result = await db.purchase_orders.update_one(
        {"id": po_id, "status": "DRAFT"},
        {"$set": {"status": "SENT"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="PO not found or not in DRAFT status")
    return {"message": "PO sent to vendor"}

@router.put("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(po_id: str, line_id: str, quantity_received: float):
    line = await db.purchase_order_lines.find_one({"id": line_id, "po_id": po_id})
    if not line:
        raise HTTPException(status_code=404, detail="PO line not found")
    
    new_received = line.get("quantity_received", 0) + quantity_received
    line_status = "RECEIVED" if new_received >= line["quantity_ordered"] else "PARTIAL"
    
    await db.purchase_order_lines.update_one(
        {"id": line_id},
        {"$set": {"quantity_received": new_received, "status": line_status}}
    )
    
    all_lines = await db.purchase_order_lines.find({"po_id": po_id}, {"_id": 0}).to_list(1000)
    all_received = all(l.get("quantity_received", 0) >= l["quantity_ordered"] for l in all_lines)
    any_received = any(l.get("quantity_received", 0) > 0 for l in all_lines)
    
    po_status = "RECEIVED" if all_received else ("PARTIAL" if any_received else "SENT")
    await db.purchase_orders.update_one({"id": po_id}, {"$set": {"status": po_status}})
    
    return {"message": f"Received {quantity_received} units", "line_status": line_status, "po_status": po_status}

# --- Dispatches ---
@router.get("/dispatches")
async def get_dispatches(
    branch: Optional[str] = None,
    buyer_id: Optional[str] = None,
    status: Optional[str] = None
):
    query = {}
    if branch:
        query["branch"] = branch
    if buyer_id:
        query["buyer_id"] = buyer_id
    if status:
        query["status"] = status
    dispatches = await db.dispatches.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(d) for d in dispatches]

@router.post("/dispatches")
async def create_dispatch(data: DispatchRecordCreate):
    count = await db.dispatches.count_documents({})
    dispatch_code = f"DSP_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{count + 1:04d}"
    
    dispatch = {
        "id": str(uuid.uuid4()),
        "dispatch_code": dispatch_code,
        "dispatch_lot_id": data.dispatch_lot_id,
        "branch": data.branch,
        "buyer_id": data.buyer_id,
        "sku_id": data.sku_id,
        "quantity": data.quantity,
        "dispatch_date": data.dispatch_date,
        "shipping_method": data.shipping_method,
        "tracking_number": data.tracking_number,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc)
    }
    await db.dispatches.insert_one(dispatch)
    del dispatch["_id"]
    return serialize_doc(dispatch)

@router.put("/dispatches/{dispatch_id}/ship")
async def ship_dispatch(dispatch_id: str, tracking_number: str = ""):
    update = {"status": "SHIPPED", "shipped_at": datetime.now(timezone.utc)}
    if tracking_number:
        update["tracking_number"] = tracking_number
    
    result = await db.dispatches.update_one({"id": dispatch_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return {"message": "Dispatch shipped"}

@router.put("/dispatches/{dispatch_id}/deliver")
async def deliver_dispatch(dispatch_id: str):
    result = await db.dispatches.update_one(
        {"id": dispatch_id},
        {"$set": {"status": "DELIVERED", "delivered_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return {"message": "Dispatch delivered"}

# --- Invoices ---
@router.get("/invoices")
async def get_invoices(buyer_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if buyer_id:
        query["buyer_id"] = buyer_id
    if status:
        query["status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(i) for i in invoices]

@router.post("/invoices")
async def create_invoice(data: InvoiceCreate):
    count = await db.invoices.count_documents({})
    invoice_number = f"INV_{datetime.now(timezone.utc).strftime('%Y%m')}_{count + 1:04d}"
    
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "dispatch_id": data.dispatch_id,
        "buyer_id": data.buyer_id,
        "invoice_date": data.invoice_date,
        "due_date": data.invoice_date + timedelta(days=30),
        "subtotal": data.subtotal,
        "tax_amount": data.tax_amount,
        "total_amount": data.subtotal + data.tax_amount,
        "currency": "INR",
        "status": "DRAFT",
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc)
    }
    await db.invoices.insert_one(invoice)
    del invoice["_id"]
    return serialize_doc(invoice)

@router.put("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: str):
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "SENT"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice sent"}

@router.put("/invoices/{invoice_id}/pay")
async def mark_invoice_paid(invoice_id: str):
    result = await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "PAID", "payment_received_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice marked as paid"}

# --- Inter-Branch Transfers ---
@router.get("/ibt-transfers")
async def get_ibt_transfers(
    source_branch: Optional[str] = None,
    destination_branch: Optional[str] = None,
    status: Optional[str] = None,
    transfer_type: Optional[str] = None
):
    query = {}
    if source_branch:
        query["source_branch"] = source_branch
    if destination_branch:
        query["destination_branch"] = destination_branch
    if status:
        query["status"] = status
    if transfer_type:
        query["transfer_type"] = transfer_type
    transfers = await db.ibt_transfers.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(t) for t in transfers]

@router.post("/ibt-transfers")
async def create_ibt_transfer(data: IBTCreate):
    count = await db.ibt_transfers.count_documents({})
    transfer_code = f"IBT_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{count + 1:04d}"
    
    transfer = {
        "id": str(uuid.uuid4()),
        "transfer_code": transfer_code,
        "transfer_type": data.transfer_type,
        "source_branch": data.source_branch,
        "destination_branch": data.destination_branch,
        "item_id": data.item_id,
        "quantity": data.quantity,
        "status": "INITIATED",
        "initiated_at": datetime.now(timezone.utc),
        "notes": data.notes
    }
    await db.ibt_transfers.insert_one(transfer)
    del transfer["_id"]
    return serialize_doc(transfer)

@router.put("/ibt-transfers/{transfer_id}/approve")
async def approve_ibt_transfer(transfer_id: str):
    result = await db.ibt_transfers.update_one(
        {"id": transfer_id, "status": "INITIATED"},
        {"$set": {"status": "APPROVED", "approved_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Transfer not found or not in INITIATED status")
    return {"message": "Transfer approved"}

@router.put("/ibt-transfers/{transfer_id}/ship")
async def ship_ibt_transfer(transfer_id: str):
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Deduct from source
    if transfer["transfer_type"] == "RM":
        await db.branch_rm_inventory.update_one(
            {"rm_id": transfer["item_id"], "branch": transfer["source_branch"]},
            {"$inc": {"current_stock": -transfer["quantity"]}}
        )
    else:  # FG
        await db.branch_sku_inventory.update_one(
            {"sku_id": transfer["item_id"], "branch": transfer["source_branch"]},
            {"$inc": {"current_stock": -transfer["quantity"]}}
        )
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "IN_TRANSIT", "shipped_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Transfer shipped"}

@router.put("/ibt-transfers/{transfer_id}/receive")
async def receive_ibt_transfer(transfer_id: str):
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    origin_breakdown = []
    
    # Add to destination
    if transfer["transfer_type"] == "RM":
        existing = await db.branch_rm_inventory.find_one({
            "rm_id": transfer["item_id"], 
            "branch": transfer["destination_branch"]
        })
        if existing:
            await db.branch_rm_inventory.update_one(
                {"rm_id": transfer["item_id"], "branch": transfer["destination_branch"]},
                {"$inc": {"current_stock": transfer["quantity"]}}
            )
        else:
            await db.branch_rm_inventory.insert_one({
                "id": str(uuid.uuid4()),
                "rm_id": transfer["item_id"],
                "branch": transfer["destination_branch"],
                "current_stock": transfer["quantity"],
                "is_active": True,
                "activated_at": datetime.now(timezone.utc)
            })
    else:  # FG (Finished Goods / SKU)
        existing = await db.branch_sku_inventory.find_one({
            "sku_id": transfer["item_id"], 
            "branch": transfer["destination_branch"]
        })
        if existing:
            await db.branch_sku_inventory.update_one(
                {"sku_id": transfer["item_id"], "branch": transfer["destination_branch"]},
                {"$inc": {"current_stock": transfer["quantity"]}}
            )
        else:
            await db.branch_sku_inventory.insert_one({
                "id": str(uuid.uuid4()),
                "sku_id": transfer["item_id"],
                "branch": transfer["destination_branch"],
                "current_stock": transfer["quantity"],
                "is_active": True,
                "activated_at": datetime.now(timezone.utc)
            })
        
        # Transfer stock origin ledger entries (preserves manufacturing origin)
        origin_breakdown = await transfer_stock_with_origin(
            sku_id=transfer["item_id"],
            source_branch=transfer["source_branch"],
            destination_branch=transfer["destination_branch"],
            quantity=transfer["quantity"],
            ibt_id=transfer_id
        )
    
    # Update transfer status with origin info
    update_data = {
        "status": "COMPLETED", 
        "received_at": datetime.now(timezone.utc)
    }
    if origin_breakdown:
        update_data["origin_breakdown"] = origin_breakdown
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Transfer received and completed",
        "origin_breakdown": origin_breakdown
    }
