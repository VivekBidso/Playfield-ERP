"""Procurement routes - Purchase Orders, Dispatches, Invoices, IBT"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List
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
    items: List[dict]  # List of {item_id: str, quantity: float, item_name: str (optional)}
    notes: str = ""
    # Transit details
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    expected_arrival: Optional[str] = None  # YYYY-MM-DD


class IBTReceiveRequest(BaseModel):
    items: Optional[List[dict]] = None  # List of {item_id: str, received_quantity: float}
    received_quantity: Optional[float] = None  # Legacy single-item support
    received_notes: Optional[str] = None
    damage_notes: Optional[str] = None

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

# --- Inter-Branch Transfers (Enhanced) ---

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
    transfers = await db.ibt_transfers.find(query, {"_id": 0}).sort("initiated_at", -1).to_list(1000)
    return [serialize_doc(t) for t in transfers]


@router.get("/ibt-transfers/{transfer_id}")
async def get_ibt_transfer(transfer_id: str):
    """Get single IBT transfer with full details"""
    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Get item details
    if transfer.get("transfer_type") == "RM":
        item = await db.raw_materials.find_one({"rm_id": transfer["item_id"]}, {"_id": 0, "rm_id": 1, "description": 1, "category": 1})
        transfer["item_name"] = item.get("description") if item else transfer["item_id"]
    else:
        item = await db.buyer_skus.find_one({"buyer_sku_id": transfer["item_id"]}, {"_id": 0, "buyer_sku_id": 1, "name": 1})
        transfer["item_name"] = item.get("name") if item else transfer["item_id"]
    
    return serialize_doc(transfer)


@router.get("/ibt-transfers/check-inventory/{item_type}/{item_id}/{branch}")
async def check_ibt_inventory(item_type: str, item_id: str, branch: str):
    """Check available inventory before creating IBT"""
    if item_type == "RM":
        inv = await db.branch_rm_inventory.find_one(
            {"rm_id": item_id, "branch": branch},
            {"_id": 0, "current_stock": 1}
        )
    else:
        inv = await db.branch_sku_inventory.find_one(
            {"buyer_sku_id": item_id, "branch": branch},
            {"_id": 0, "current_stock": 1}
        )
    
    available = inv.get("current_stock", 0) if inv else 0
    return {"item_id": item_id, "branch": branch, "available_stock": available}


@router.post("/ibt-transfers")
async def create_ibt_transfer(data: IBTCreate):
    """
    Create IBT transfer with multiple items and inventory validation.
    Checks source branch has sufficient stock for all items before allowing transfer.
    """
    
    # Validate source ≠ destination
    if data.source_branch == data.destination_branch:
        raise HTTPException(status_code=400, detail="Source and destination branch cannot be the same")
    
    # Validate items
    if not data.items or len(data.items) == 0:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    # Validate each item has required fields and check inventory
    validated_items = []
    insufficient_items = []
    total_quantity = 0
    
    for item in data.items:
        item_id = item.get("item_id")
        quantity = item.get("quantity", 0)
        
        if not item_id or quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid item: {item}. Each item needs item_id and positive quantity")
        
        # Check source inventory
        if data.transfer_type == "RM":
            source_inv = await db.branch_rm_inventory.find_one(
                {"rm_id": item_id, "branch": data.source_branch},
                {"_id": 0, "current_stock": 1}
            )
            # Get item details
            item_doc = await db.raw_materials.find_one({"rm_id": item_id}, {"_id": 0, "rm_id": 1, "description": 1})
            item_name = item_doc.get("description") if item_doc else item_id
        else:
            source_inv = await db.branch_sku_inventory.find_one(
                {"buyer_sku_id": item_id, "branch": data.source_branch},
                {"_id": 0, "current_stock": 1}
            )
            item_doc = await db.buyer_skus.find_one({"buyer_sku_id": item_id}, {"_id": 0, "buyer_sku_id": 1, "name": 1})
            item_name = item_doc.get("name") if item_doc else item_id
        
        available_stock = source_inv.get("current_stock", 0) if source_inv else 0
        
        if available_stock < quantity:
            insufficient_items.append({
                "item_id": item_id,
                "item_name": item_name,
                "requested": quantity,
                "available": available_stock,
                "shortage": quantity - available_stock
            })
        else:
            validated_items.append({
                "item_id": item_id,
                "item_name": item_name,
                "quantity": quantity,
                "dispatched_quantity": 0,
                "received_quantity": 0
            })
            total_quantity += quantity
    
    if insufficient_items:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INSUFFICIENT_INVENTORY",
                "message": f"Insufficient stock at {data.source_branch} for {len(insufficient_items)} item(s)",
                "insufficient_items": insufficient_items
            }
        )
    
    # Generate transfer code
    count = await db.ibt_transfers.count_documents({})
    transfer_code = f"IBT_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{count + 1:04d}"
    
    transfer = {
        "id": str(uuid.uuid4()),
        "transfer_code": transfer_code,
        "transfer_type": data.transfer_type,
        "source_branch": data.source_branch,
        "destination_branch": data.destination_branch,
        "items": validated_items,  # Array of items
        "total_quantity": total_quantity,
        "total_dispatched": 0,
        "total_received": 0,
        "status": "READY_FOR_DISPATCH",
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "notes": data.notes,
        # Transit details
        "vehicle_number": data.vehicle_number,
        "driver_name": data.driver_name,
        "driver_contact": data.driver_contact,
        "expected_arrival": data.expected_arrival
    }
    
    await db.ibt_transfers.insert_one(transfer)
    del transfer["_id"]
    
    return {
        "message": f"IBT {transfer_code} created with {len(validated_items)} item(s)",
        "transfer": serialize_doc(transfer)
    }


@router.put("/ibt-transfers/{transfer_id}/approve")
async def approve_ibt_transfer(transfer_id: str):
    """
    DEPRECATED: Approval step is no longer required.
    IBT transfers go directly from INITIATED/READY_FOR_DISPATCH to dispatch.
    This endpoint is kept for backward compatibility but just returns success.
    """
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # If already ready for dispatch or beyond, just return success
    if transfer.get("status") in ["READY_FOR_DISPATCH", "APPROVED", "IN_TRANSIT", "RECEIVED", "COMPLETED"]:
        return {"message": "Transfer is already ready for dispatch", "transfer_code": transfer.get("transfer_code")}
    
    # For legacy INITIATED status, update to READY_FOR_DISPATCH
    if transfer.get("status") == "INITIATED":
        await db.ibt_transfers.update_one(
            {"id": transfer_id},
            {"$set": {"status": "READY_FOR_DISPATCH"}}
        )
    
    return {"message": "Transfer ready for dispatch", "transfer_code": transfer.get("transfer_code")}


@router.put("/ibt-transfers/{transfer_id}/dispatch")
async def dispatch_ibt_transfer(
    transfer_id: str,
    vehicle_number: Optional[str] = None,
    driver_name: Optional[str] = None,
    driver_contact: Optional[str] = None,
    expected_arrival: Optional[str] = None
):
    """
    Dispatch IBT - deducts from source inventory for all items, sets status to IN_TRANSIT.
    Supports both legacy single-item and new multi-item transfers.
    """
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Allow dispatch from INITIATED, READY_FOR_DISPATCH, or APPROVED (legacy) status
    allowed_statuses = ["INITIATED", "READY_FOR_DISPATCH", "APPROVED"]
    if transfer.get("status") not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Cannot dispatch transfer in {transfer.get('status')} status.")
    
    # Handle both multi-item and legacy single-item transfers
    items = transfer.get("items", [])
    is_legacy = len(items) == 0 and transfer.get("item_id")
    
    if is_legacy:
        # Legacy single-item format
        items = [{"item_id": transfer["item_id"], "quantity": transfer["quantity"]}]
    
    # Final inventory check and deduction for all items
    insufficient_items = []
    
    for item in items:
        item_id = item["item_id"]
        quantity = item["quantity"]
        
        if transfer["transfer_type"] == "RM":
            source_inv = await db.branch_rm_inventory.find_one(
                {"rm_id": item_id, "branch": transfer["source_branch"]},
                {"_id": 0, "current_stock": 1}
            )
        else:
            source_inv = await db.branch_sku_inventory.find_one(
                {"buyer_sku_id": item_id, "branch": transfer["source_branch"]},
                {"_id": 0, "current_stock": 1}
            )
        
        available_stock = source_inv.get("current_stock", 0) if source_inv else 0
        
        if available_stock < quantity:
            insufficient_items.append({
                "item_id": item_id,
                "available": available_stock,
                "requested": quantity
            })
    
    if insufficient_items:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INSUFFICIENT_INVENTORY",
                "message": f"Cannot dispatch. Insufficient stock for {len(insufficient_items)} item(s).",
                "insufficient_items": insufficient_items
            }
        )
    
    # Deduct all items from source
    total_dispatched = 0
    updated_items = []
    
    for item in items:
        item_id = item["item_id"]
        quantity = item["quantity"]
        
        if transfer["transfer_type"] == "RM":
            await db.branch_rm_inventory.update_one(
                {"rm_id": item_id, "branch": transfer["source_branch"]},
                {"$inc": {"current_stock": -quantity}}
            )
        else:
            await db.branch_sku_inventory.update_one(
                {"buyer_sku_id": item_id, "branch": transfer["source_branch"]},
                {"$inc": {"current_stock": -quantity}}
            )
        
        total_dispatched += quantity
        updated_items.append({
            **item,
            "dispatched_quantity": quantity
        })
    
    # Update transfer status
    update_data = {
        "status": "IN_TRANSIT",
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if is_legacy:
        update_data["dispatched_quantity"] = total_dispatched
    else:
        update_data["items"] = updated_items
        update_data["total_dispatched"] = total_dispatched
    
    # Update transit details if provided
    if vehicle_number:
        update_data["vehicle_number"] = vehicle_number
    if driver_name:
        update_data["driver_name"] = driver_name
    if driver_contact:
        update_data["driver_contact"] = driver_contact
    if expected_arrival:
        update_data["expected_arrival"] = expected_arrival
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": update_data}
    )
    
    return {
        "message": f"Transfer {transfer.get('transfer_code')} dispatched with {len(items)} item(s)",
        "dispatched_quantity": total_dispatched,
        "items_count": len(items),
        "status": "IN_TRANSIT"
    }


@router.put("/ibt-transfers/{transfer_id}/receive")
async def receive_ibt_transfer(transfer_id: str, data: IBTReceiveRequest):
    """
    Receive IBT - receiver enters actual received quantities for all items.
    Creates shortage records for items where received < dispatched.
    Adds received quantities to destination inventory.
    Supports both multi-item and legacy single-item formats.
    """
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer.get("status") != "IN_TRANSIT":
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer in {transfer.get('status')} status. Must be IN_TRANSIT.")
    
    # Handle both multi-item and legacy single-item transfers
    transfer_items = transfer.get("items", [])
    is_legacy = len(transfer_items) == 0 and transfer.get("item_id")
    
    if is_legacy:
        # Legacy single-item format
        transfer_items = [{
            "item_id": transfer["item_id"],
            "item_name": transfer.get("item_name", ""),
            "quantity": transfer["quantity"],
            "dispatched_quantity": transfer.get("dispatched_quantity", transfer["quantity"])
        }]
    
    # Build received items map from request
    received_items_map = {}
    if data.items:
        for ri in data.items:
            received_items_map[ri["item_id"]] = ri.get("received_quantity", 0)
    elif data.received_quantity is not None and is_legacy:
        # Legacy single-item receive
        received_items_map[transfer["item_id"]] = data.received_quantity
    
    # Process each item
    total_dispatched = 0
    total_received = 0
    total_variance = 0
    shortage_records = []
    updated_items = []
    all_origin_breakdowns = []
    
    for item in transfer_items:
        item_id = item["item_id"]
        item_name = item.get("item_name", "")
        dispatched_qty = item.get("dispatched_quantity", item["quantity"])
        received_qty = received_items_map.get(item_id, dispatched_qty)  # Default to full receipt if not specified
        
        if received_qty < 0:
            raise HTTPException(status_code=400, detail=f"Received quantity for {item_id} cannot be negative")
        
        if received_qty > dispatched_qty:
            raise HTTPException(status_code=400, detail=f"Received qty ({received_qty}) cannot exceed dispatched qty ({dispatched_qty}) for {item_id}")
        
        # Add received quantity to destination
        if received_qty > 0:
            if transfer["transfer_type"] == "RM":
                existing = await db.branch_rm_inventory.find_one({
                    "rm_id": item_id, 
                    "branch": transfer["destination_branch"]
                })
                if existing:
                    await db.branch_rm_inventory.update_one(
                        {"rm_id": item_id, "branch": transfer["destination_branch"]},
                        {"$inc": {"current_stock": received_qty}}
                    )
                else:
                    await db.branch_rm_inventory.insert_one({
                        "id": str(uuid.uuid4()),
                        "rm_id": item_id,
                        "branch": transfer["destination_branch"],
                        "current_stock": received_qty,
                        "is_active": True,
                        "activated_at": datetime.now(timezone.utc).isoformat()
                    })
            else:  # FG
                existing = await db.branch_sku_inventory.find_one({
                    "buyer_sku_id": item_id, 
                    "branch": transfer["destination_branch"]
                })
                if existing:
                    await db.branch_sku_inventory.update_one(
                        {"buyer_sku_id": item_id, "branch": transfer["destination_branch"]},
                        {"$inc": {"current_stock": received_qty}}
                    )
                else:
                    await db.branch_sku_inventory.insert_one({
                        "id": str(uuid.uuid4()),
                        "buyer_sku_id": item_id,
                        "branch": transfer["destination_branch"],
                        "current_stock": received_qty,
                        "is_active": True,
                        "activated_at": datetime.now(timezone.utc).isoformat()
                    })
                
                # Transfer stock origin ledger entries
                origin_breakdown = await transfer_stock_with_origin(
                    sku_id=item_id,
                    source_branch=transfer["source_branch"],
                    destination_branch=transfer["destination_branch"],
                    quantity=received_qty,
                    ibt_id=transfer_id
                )
                if origin_breakdown:
                    all_origin_breakdowns.extend(origin_breakdown)
        
        # Calculate variance for this item
        variance = dispatched_qty - received_qty
        
        # Create shortage record if variance > 0
        if variance > 0:
            shortage_record = {
                "id": str(uuid.uuid4()),
                "ibt_transfer_id": transfer_id,
                "transfer_code": transfer.get("transfer_code"),
                "transfer_type": transfer["transfer_type"],
                "item_id": item_id,
                "item_name": item_name,
                "source_branch": transfer["source_branch"],
                "destination_branch": transfer["destination_branch"],
                "dispatched_quantity": dispatched_qty,
                "received_quantity": received_qty,
                "shortage_quantity": variance,
                "shortage_percentage": round((variance / dispatched_qty) * 100, 2),
                "status": "PENDING_INVESTIGATION",
                "damage_notes": data.damage_notes,
                "received_notes": data.received_notes,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.ibt_shortages.insert_one(shortage_record)
            shortage_records.append(shortage_record["id"])
        
        # Update item totals
        total_dispatched += dispatched_qty
        total_received += received_qty
        total_variance += variance
        
        updated_items.append({
            **item,
            "received_quantity": received_qty,
            "variance": variance
        })
    
    # Update transfer status
    update_data = {
        "status": "COMPLETED",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "received_notes": data.received_notes,
        "damage_notes": data.damage_notes
    }
    
    if is_legacy:
        update_data["received_quantity"] = total_received
        update_data["variance"] = total_variance
        if shortage_records:
            update_data["shortage_record_id"] = shortage_records[0]
    else:
        update_data["items"] = updated_items
        update_data["total_received"] = total_received
        update_data["total_variance"] = total_variance
        if shortage_records:
            update_data["shortage_record_ids"] = shortage_records
    
    if all_origin_breakdowns:
        update_data["origin_breakdown"] = all_origin_breakdowns
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": update_data}
    )
    
    result = {
        "message": f"Transfer {transfer.get('transfer_code')} received - {len(updated_items)} item(s)",
        "total_received": total_received,
        "total_dispatched": total_dispatched,
        "total_variance": total_variance,
        "items_count": len(updated_items),
        "status": "COMPLETED"
    }
    
    if shortage_records:
        result["shortage_records"] = len(shortage_records)
        result["shortage_status"] = "PENDING_INVESTIGATION"
    
    return result


@router.put("/ibt-transfers/{transfer_id}/cancel")
async def cancel_ibt_transfer(transfer_id: str, reason: str = ""):
    """Cancel IBT transfer - only allowed before dispatch"""
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer.get("status") in ["IN_TRANSIT", "COMPLETED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer in {transfer.get('status')} status")
    
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "CANCELLED",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancel_reason": reason
        }}
    )
    
    return {"message": "Transfer cancelled"}


# --- IBT Shortage Records ---

@router.get("/ibt-shortages")
async def get_ibt_shortages(status: Optional[str] = None):
    """Get all IBT shortage records"""
    query = {}
    if status:
        query["status"] = status
    shortages = await db.ibt_shortages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return shortages


@router.put("/ibt-shortages/{shortage_id}/resolve")
async def resolve_ibt_shortage(
    shortage_id: str,
    resolution: str,  # WRITE_OFF, RECOVERED, INSURANCE_CLAIM, etc.
    resolution_notes: str = "",
    recovered_quantity: float = 0
):
    """Resolve an IBT shortage record"""
    shortage = await db.ibt_shortages.find_one({"id": shortage_id})
    if not shortage:
        raise HTTPException(status_code=404, detail="Shortage record not found")
    
    update_data = {
        "status": "RESOLVED",
        "resolution": resolution,
        "resolution_notes": resolution_notes,
        "recovered_quantity": recovered_quantity,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If recovered, add back to destination inventory
    if recovered_quantity > 0:
        if shortage["transfer_type"] == "RM":
            await db.branch_rm_inventory.update_one(
                {"rm_id": shortage["item_id"], "branch": shortage["destination_branch"]},
                {"$inc": {"current_stock": recovered_quantity}}
            )
        else:
            await db.branch_sku_inventory.update_one(
                {"buyer_sku_id": shortage["item_id"], "branch": shortage["destination_branch"]},
                {"$inc": {"current_stock": recovered_quantity}}
            )
        update_data["inventory_adjusted"] = True
    
    await db.ibt_shortages.update_one(
        {"id": shortage_id},
        {"$set": update_data}
    )
    
    return {"message": "Shortage resolved", "resolution": resolution}


# Legacy ship endpoint - redirects to dispatch
@router.put("/ibt-transfers/{transfer_id}/ship")
async def ship_ibt_transfer_legacy(transfer_id: str):
    """Legacy endpoint - use /dispatch instead"""
    # For backwards compatibility, call dispatch
    transfer = await db.ibt_transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # If not approved yet, approve first
    if transfer.get("status") == "INITIATED":
        await db.ibt_transfers.update_one(
            {"id": transfer_id},
            {"$set": {"status": "APPROVED", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Now dispatch
    return await dispatch_ibt_transfer(transfer_id)
