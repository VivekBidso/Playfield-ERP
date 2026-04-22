"""
Event System - Message Queue for Module Notifications
Implements publish/subscribe pattern for inter-module communication
"""
from enum import Enum
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime, timezone
from dataclasses import dataclass
import uuid
import asyncio
import logging

from database import db

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """All event types in the system"""
    # SKU Events
    SKU_CREATED = "SKU_CREATED"
    SKU_UPDATED = "SKU_UPDATED"
    SKU_ACTIVATED = "SKU_ACTIVATED"
    
    # BOM Events
    BOM_CREATED = "BOM_CREATED"
    BOM_UPDATED = "BOM_UPDATED"
    BOM_FINALIZED = "BOM_FINALIZED"
    
    # Production Events
    BATCH_CREATED = "BATCH_CREATED"
    BATCH_STARTED = "BATCH_STARTED"
    BATCH_COMPLETED = "BATCH_COMPLETED"
    PRODUCTION_ENTRY_CREATED = "PRODUCTION_ENTRY_CREATED"
    
    # Inventory Events
    RM_STOCK_LOW = "RM_STOCK_LOW"
    RM_STOCK_UPDATED = "RM_STOCK_UPDATED"
    FG_INVENTORY_UPDATED = "FG_INVENTORY_UPDATED"
    
    # Procurement Events
    PO_CREATED = "PO_CREATED"
    PO_SENT = "PO_SENT"
    PO_RECEIVED = "PO_RECEIVED"
    PO_COMPLETED = "PO_COMPLETED"
    
    # Quality Events
    QC_STARTED = "QC_STARTED"
    QC_PASSED = "QC_PASSED"
    QC_FAILED = "QC_FAILED"
    QC_APPROVED = "QC_APPROVED"
    
    # Logistics Events
    DISPATCH_CREATED = "DISPATCH_CREATED"
    DISPATCH_SHIPPED = "DISPATCH_SHIPPED"
    DISPATCH_DELIVERED = "DISPATCH_DELIVERED"
    
    # IBT Events
    IBT_REQUESTED = "IBT_REQUESTED"
    IBT_APPROVED = "IBT_APPROVED"
    IBT_SHIPPED = "IBT_SHIPPED"
    IBT_COMPLETED = "IBT_COMPLETED"
    
    # Invoice Events
    INVOICE_CREATED = "INVOICE_CREATED"
    INVOICE_SENT = "INVOICE_SENT"
    INVOICE_PAID = "INVOICE_PAID"
    
    # CPC Events
    SCHEDULE_CREATED = "SCHEDULE_CREATED"
    SCHEDULE_ALLOCATED = "SCHEDULE_ALLOCATED"
    SCHEDULE_COMPLETED = "SCHEDULE_COMPLETED"
    SCHEDULE_UPLOAD = "SCHEDULE_UPLOAD"
    ALLOCATION_STARTED = "ALLOCATION_STARTED"
    ALLOCATION_COMPLETED = "ALLOCATION_COMPLETED"

    # RM Inward Events
    RM_INWARD_RECEIVED = "RM_INWARD_RECEIVED"


@dataclass
class Event:
    """Event data structure"""
    id: str
    event_type: EventType
    payload: Dict[str, Any]
    source_module: str
    timestamp: datetime
    processed: bool = False
    processed_at: Optional[datetime] = None
    handlers_triggered: List[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "payload": self.payload,
            "source_module": self.source_module,
            "timestamp": self.timestamp.isoformat(),
            "processed": self.processed,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "handlers_triggered": self.handlers_triggered or []
        }


class EventBus:
    """
    Central Event Bus for the application
    Handles event publishing, subscription, and processing
    """
    _instance = None
    _handlers: Dict[EventType, List[Callable]] = {}
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self._handlers = {event_type: [] for event_type in EventType}
            self._initialized = True
            logger.info("EventBus initialized")
    
    def subscribe(self, event_type: EventType, handler: Callable):
        """Subscribe a handler to an event type"""
        if handler not in self._handlers[event_type]:
            self._handlers[event_type].append(handler)
            logger.info(f"Handler {handler.__name__} subscribed to {event_type.value}")
    
    def unsubscribe(self, event_type: EventType, handler: Callable):
        """Unsubscribe a handler from an event type"""
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)
    
    async def publish(
        self, 
        event_type: EventType, 
        payload: Dict[str, Any],
        source_module: str = "system"
    ) -> Event:
        """
        Publish an event to the event bus
        - Stores event in database
        - Triggers all subscribed handlers
        """
        event = Event(
            id=str(uuid.uuid4()),
            event_type=event_type,
            payload=payload,
            source_module=source_module,
            timestamp=datetime.now(timezone.utc),
            handlers_triggered=[]
        )
        
        # Store event in database
        await db.events.insert_one(event.to_dict())
        
        # Trigger handlers
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                handler_name = handler.__name__
                await handler(event)
                event.handlers_triggered.append(handler_name)
                logger.info(f"Event {event_type.value} processed by {handler_name}")
            except Exception as e:
                logger.error(f"Handler {handler.__name__} failed for {event_type.value}: {e}")
        
        # Mark as processed
        event.processed = True
        event.processed_at = datetime.now(timezone.utc)
        
        # Update event in database
        await db.events.update_one(
            {"id": event.id},
            {"$set": {
                "processed": True,
                "processed_at": event.processed_at.isoformat(),
                "handlers_triggered": event.handlers_triggered
            }}
        )
        
        return event
    
    async def get_events(
        self,
        event_type: Optional[EventType] = None,
        source_module: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get events from the event log"""
        query = {}
        if event_type:
            query["event_type"] = event_type.value
        if source_module:
            query["source_module"] = source_module
        
        events = await db.events.find(
            query, {"_id": 0}
        ).sort("timestamp", -1).to_list(limit)
        
        return events


# Global event bus instance
event_bus = EventBus()


# ============ Event Handlers ============

async def handle_sku_created(event: Event):
    """When SKU is created, log to audit"""
    sku_id = event.payload.get("sku_id")
    logger.info(f"SKU Created: {sku_id}")
    
    # Create audit log entry
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "SKU",
        "entity_id": sku_id,
        "action": "CREATED",
        "changes": event.payload,
        "user_id": event.payload.get("created_by", "system"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_bom_finalized(event: Event):
    """When BOM is finalized, calculate material requirements"""
    sku_id = event.payload.get("sku_id")
    logger.info(f"BOM Finalized for SKU: {sku_id}")
    
    # Get BOM details
    bom = await db.bill_of_materials.find_one({"sku_id": sku_id}, {"_id": 0})
    if bom:
        # Calculate total unique RMs needed
        rm_count = len(bom.get("rm_mappings", []))
        
        # Update Buyer SKU with BOM status (new model)
        await db.buyer_skus.update_one(
            {"buyer_sku_id": sku_id},
            {"$set": {
                "bom_finalized": True,
                "bom_rm_count": rm_count,
                "bom_finalized_at": datetime.now(timezone.utc).isoformat()
            }}
        )


async def handle_batch_completed(event: Event):
    """When batch is completed, update inventory and trigger QC"""
    batch_id = event.payload.get("batch_id")
    produced_quantity = event.payload.get("produced_quantity", 0)
    sku_id = event.payload.get("sku_id")
    branch = event.payload.get("branch")
    
    logger.info(f"Batch Completed: {batch_id}, {produced_quantity} units of {sku_id}")
    
    # Check if QC is required for this SKU (check buyer_skus first, then bidso_skus)
    sku = await db.buyer_skus.find_one({"buyer_sku_id": sku_id}, {"_id": 0})
    if not sku:
        sku = await db.bidso_skus.find_one({"bidso_sku_id": sku_id}, {"_id": 0})
    
    if sku and sku.get("qc_required", True):
        # Create QC result entry (pending)
        await db.qc_results.insert_one({
            "id": str(uuid.uuid4()),
            "sku_id": sku_id,
            "production_batch_id": batch_id,
            "branch": branch,
            "quantity_inspected": 0,
            "quantity_passed": 0,
            "quantity_failed": 0,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"QC Result created for batch {batch_id}")


async def handle_rm_stock_low(event: Event):
    """When RM stock is low, create alert"""
    rm_id = event.payload.get("rm_id")
    branch = event.payload.get("branch")
    current_stock = event.payload.get("current_stock")
    threshold = event.payload.get("threshold")
    
    logger.warning(f"LOW STOCK ALERT: {rm_id} at {branch} - {current_stock} (threshold: {threshold})")
    
    # Create alert in database
    await db.alerts.insert_one({
        "id": str(uuid.uuid4()),
        "alert_type": "LOW_STOCK",
        "severity": "HIGH",
        "entity_type": "RM",
        "entity_id": rm_id,
        "branch": branch,
        "message": f"Stock for {rm_id} at {branch} is below threshold ({current_stock} < {threshold})",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_po_received(event: Event):
    """When PO is fully received, update vendor stats"""
    po_id = event.payload.get("po_id")
    vendor_id = event.payload.get("vendor_id")
    total_amount = event.payload.get("total_amount", 0)
    
    logger.info(f"PO Received: {po_id} from vendor {vendor_id}")
    
    # Update vendor statistics
    await db.vendors.update_one(
        {"vendor_id": vendor_id},
        {
            "$inc": {
                "total_orders": 1,
                "total_order_value": total_amount
            },
            "$set": {
                "last_order_date": datetime.now(timezone.utc).isoformat()
            }
        }
    )


async def handle_qc_passed(event: Event):
    """When QC passes, update batch status and FG inventory"""
    batch_id = event.payload.get("batch_id")
    quantity_passed = event.payload.get("quantity_passed", 0)
    sku_id = event.payload.get("sku_id")
    branch = event.payload.get("branch")
    
    logger.info(f"QC Passed: {quantity_passed} units of {sku_id} from batch {batch_id}")
    
    # Update production batch
    await db.production_batches.update_one(
        {"id": batch_id},
        {"$set": {"qc_status": "PASSED", "qc_passed_quantity": quantity_passed}}
    )


async def handle_qc_failed(event: Event):
    """When QC fails, log and alert"""
    batch_id = event.payload.get("batch_id")
    quantity_failed = event.payload.get("quantity_failed", 0)
    defect_codes = event.payload.get("defect_codes", [])
    
    logger.warning(f"QC Failed: {quantity_failed} units from batch {batch_id}")
    
    # Create alert
    await db.alerts.insert_one({
        "id": str(uuid.uuid4()),
        "alert_type": "QC_FAILURE",
        "severity": "MEDIUM",
        "entity_type": "BATCH",
        "entity_id": batch_id,
        "message": f"QC failed for {quantity_failed} units. Defects: {', '.join(defect_codes)}",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_dispatch_shipped(event: Event):
    """When dispatch is shipped, deduct FG inventory"""
    dispatch_id = event.payload.get("dispatch_id")
    sku_id = event.payload.get("sku_id")
    quantity = event.payload.get("quantity", 0)
    branch = event.payload.get("branch")
    
    logger.info(f"Dispatch Shipped: {quantity} units of {sku_id} from {branch}")
    
    # Deduct from FG inventory
    await db.fg_inventory.update_one(
        {"sku_id": sku_id, "branch": branch},
        {"$inc": {"quantity": -quantity}}
    )
    
    # Record FG movement
    await db.fg_movements.insert_one({
        "id": str(uuid.uuid4()),
        "sku_id": sku_id,
        "branch": branch,
        "movement_type": "DISPATCH",
        "quantity": -quantity,
        "reference_type": "DISPATCH",
        "reference_id": dispatch_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_ibt_completed(event: Event):
    """When IBT is completed, log the transfer"""
    transfer_id = event.payload.get("transfer_id")
    from_branch = event.payload.get("from_branch")
    to_branch = event.payload.get("to_branch")
    rm_id = event.payload.get("rm_id")
    quantity = event.payload.get("quantity")
    
    logger.info(f"IBT Completed: {quantity} units of {rm_id} from {from_branch} to {to_branch}")
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "IBT",
        "entity_id": transfer_id,
        "action": "COMPLETED",
        "changes": {
            "from_branch": from_branch,
            "to_branch": to_branch,
            "rm_id": rm_id,
            "quantity": quantity
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def handle_schedule_allocated(event: Event):
    """When production is allocated to branches, update schedule"""
    schedule_id = event.payload.get("schedule_id")
    total_allocated = event.payload.get("total_allocated", 0)
    allocations = event.payload.get("allocations", [])
    
    logger.info(f"Schedule Allocated: {schedule_id} - {total_allocated} units across {len(allocations)} branches")


async def handle_invoice_paid(event: Event):
    """When invoice is paid, update revenue tracking"""
    invoice_id = event.payload.get("invoice_id")
    amount = event.payload.get("amount", 0)
    buyer_id = event.payload.get("buyer_id")
    
    logger.info(f"Invoice Paid: {invoice_id} - ₹{amount}")
    
    # Update buyer stats
    await db.buyers.update_one(
        {"id": buyer_id},
        {
            "$inc": {
                "total_paid": amount,
                "total_orders": 1
            },
            "$set": {
                "last_order_date": datetime.now(timezone.utc).isoformat()
            }
        }
    )


# ============ Register Default Handlers ============

def register_default_handlers():
    """Register all default event handlers"""
    event_bus.subscribe(EventType.SKU_CREATED, handle_sku_created)
    event_bus.subscribe(EventType.BOM_FINALIZED, handle_bom_finalized)
    event_bus.subscribe(EventType.BATCH_COMPLETED, handle_batch_completed)
    event_bus.subscribe(EventType.RM_STOCK_LOW, handle_rm_stock_low)
    event_bus.subscribe(EventType.PO_COMPLETED, handle_po_received)
    event_bus.subscribe(EventType.QC_PASSED, handle_qc_passed)
    event_bus.subscribe(EventType.QC_FAILED, handle_qc_failed)
    event_bus.subscribe(EventType.DISPATCH_SHIPPED, handle_dispatch_shipped)
    event_bus.subscribe(EventType.IBT_COMPLETED, handle_ibt_completed)
    event_bus.subscribe(EventType.SCHEDULE_ALLOCATED, handle_schedule_allocated)
    event_bus.subscribe(EventType.INVOICE_PAID, handle_invoice_paid)
    
    logger.info("Default event handlers registered")


# Initialize handlers on module load
register_default_handlers()
