"""Transactional models: Forecasts, Production Batches, QC, Logistics"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class Forecast(BaseModel):
    """Demand Forecast"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    forecast_code: str
    buyer_id: Optional[str] = None
    vertical_id: Optional[str] = None
    sku_id: Optional[str] = None
    forecast_month: datetime
    quantity: int
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: str = "DRAFT"  # DRAFT, CONFIRMED, CONVERTED
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None


class ForecastCreate(BaseModel):
    buyer_id: Optional[str] = None
    vertical_id: Optional[str] = None
    sku_id: Optional[str] = None
    forecast_month: datetime
    quantity: int
    priority: str = "MEDIUM"
    notes: str = ""


class DispatchLot(BaseModel):
    """Dispatch Lot for fulfillment"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lot_code: str
    forecast_id: Optional[str] = None
    sku_id: str
    buyer_id: str
    required_quantity: int
    produced_quantity: int = 0
    qc_passed_quantity: int = 0
    dispatched_quantity: int = 0
    target_date: datetime
    status: str = "CREATED"  # CREATED, PRODUCTION_ASSIGNED, PARTIALLY_PRODUCED, FULLY_PRODUCED, QC_CLEARED, DISPATCH_READY, DISPATCHED, DELIVERED
    priority: str = "MEDIUM"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class DispatchLotCreate(BaseModel):
    forecast_id: Optional[str] = None
    sku_id: str
    buyer_id: str
    required_quantity: int
    target_date: datetime
    priority: str = "MEDIUM"


class ProductionBatch(BaseModel):
    """Production Batch for tracking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_code: str
    production_plan_id: Optional[str] = None
    dispatch_lot_id: Optional[str] = None
    branch_id: str
    branch: str  # Denormalized for easy access
    sku_id: str
    planned_quantity: int
    produced_quantity: int = 0
    good_quantity: int = 0
    rejected_quantity: int = 0
    batch_date: datetime
    shift: str = "DAY"  # DAY, NIGHT
    status: str = "PLANNED"  # PLANNED, IN_PROGRESS, COMPLETED, QC_HOLD, QC_PASSED, QC_FAILED, FG_READY
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ProductionBatchCreate(BaseModel):
    production_plan_id: Optional[str] = None
    dispatch_lot_id: Optional[str] = None
    branch: str
    sku_id: str
    planned_quantity: int
    batch_date: datetime
    shift: str = "DAY"


class RMStockMovement(BaseModel):
    """Append-only RM stock movement log"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    movement_code: str
    rm_id: str
    branch_id: str
    branch: str  # Denormalized
    movement_type: str  # INWARD, CONSUMPTION, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, SCRAP, PRODUCTION
    quantity: float  # Positive for in, negative for out
    unit_of_measure: str  # KG, PCS, etc.
    reference_type: Optional[str] = None  # PRODUCTION_BATCH, PURCHASE_ORDER, IBT, ADJUSTMENT
    reference_id: Optional[str] = None
    l1_rm_id: Optional[str] = None  # For L2, the L1 source
    l1_quantity_consumed: Optional[float] = None
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    balance_after: float
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class QCChecklist(BaseModel):
    """Quality Control Checklist"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    checklist_code: str
    name: str
    description: str = ""
    check_type: str  # VISUAL, MEASUREMENT, FUNCTIONAL, SAFETY
    vertical_id: Optional[str] = None  # NULL = all verticals
    model_id: Optional[str] = None
    brand_id: Optional[str] = None
    expected_value: str = ""
    tolerance: str = ""
    is_mandatory: bool = True
    check_priority: int = 100
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class QCChecklistCreate(BaseModel):
    name: str
    description: str = ""
    check_type: str
    vertical_id: Optional[str] = None
    model_id: Optional[str] = None
    brand_id: Optional[str] = None
    expected_value: str = ""
    tolerance: str = ""
    is_mandatory: bool = True
    check_priority: int = 100


class QCResult(BaseModel):
    """QC Inspection Result"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    result_code: str
    production_batch_id: str
    checklist_id: str
    sample_size: int
    passed_count: int
    failed_count: int
    actual_value: str = ""
    result_status: str  # PASSED, FAILED, CONDITIONAL
    defect_type: str = ""
    defect_description: str = ""
    inspector_notes: str = ""
    inspected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    inspected_by: str


class QCResultCreate(BaseModel):
    production_batch_id: str
    checklist_id: str
    sample_size: int
    passed_count: int
    failed_count: int
    actual_value: str = ""
    defect_type: str = ""
    defect_description: str = ""
    inspector_notes: str = ""


class QCApproval(BaseModel):
    """Batch-level QC Approval"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    production_batch_id: str
    total_inspected: int
    total_passed: int
    total_failed: int
    overall_status: str  # APPROVED, REJECTED, CONDITIONAL, REWORK
    approved_quantity: int = 0
    rejection_reason: str = ""
    rework_instructions: str = ""
    approved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_by: str


class FGInventory(BaseModel):
    """Finished Goods Inventory"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    branch_id: str
    branch: str  # Denormalized
    sku_id: str
    dispatch_lot_id: Optional[str] = None
    production_batch_id: Optional[str] = None
    quantity: int
    unit_cost: Optional[float] = None
    status: str = "AVAILABLE"  # AVAILABLE, RESERVED, DISPATCHED, DAMAGED
    qc_approval_id: Optional[str] = None
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class PurchaseOrder(BaseModel):
    """Purchase Order"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    po_number: str
    vendor_id: str
    branch_id: str
    branch: str  # Denormalized
    production_plan_id: Optional[str] = None
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    total_amount: float = 0
    currency: str = "INR"
    status: str = "DRAFT"  # DRAFT, SENT, ACKNOWLEDGED, PARTIAL, RECEIVED, CANCELLED
    payment_status: str = "PENDING"  # PENDING, PARTIAL, PAID
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    branch: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    notes: str = ""


class PurchaseOrderLine(BaseModel):
    """PO Line Item"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    po_id: str
    rm_id: str
    quantity_ordered: float
    quantity_received: float = 0
    unit_price: float
    unit_of_measure: str
    line_total: float = 0
    status: str = "PENDING"  # PENDING, PARTIAL, RECEIVED, CANCELLED


class PurchaseOrderLineCreate(BaseModel):
    rm_id: str
    quantity_ordered: float
    unit_price: float
    unit_of_measure: str


class Dispatch(BaseModel):
    """Dispatch Record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dispatch_code: str
    dispatch_lot_id: str
    branch_id: str
    branch: str  # Denormalized
    buyer_id: str
    sku_id: str
    quantity: int
    dispatch_date: datetime
    shipping_method: str = ""
    tracking_number: str = ""
    status: str = "PENDING"  # PENDING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class Invoice(BaseModel):
    """Invoice"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    dispatch_id: Optional[str] = None
    buyer_id: str
    invoice_date: datetime
    due_date: Optional[datetime] = None
    subtotal: float
    tax_amount: float = 0
    total_amount: float
    currency: str = "INR"
    status: str = "DRAFT"  # DRAFT, SENT, PAID, OVERDUE, CANCELLED
    payment_received_at: Optional[datetime] = None
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class IBTTransfer(BaseModel):
    """Inter-Branch Transfer"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transfer_code: str
    transfer_type: str  # RM, FG
    source_branch_id: str
    source_branch: str  # Denormalized
    destination_branch_id: str
    destination_branch: str  # Denormalized
    item_id: str  # rm_id or sku_id
    quantity: float
    unit_of_measure: str = ""
    status: str = "INITIATED"  # INITIATED, APPROVED, IN_TRANSIT, RECEIVED, COMPLETED, REJECTED, CANCELLED
    initiated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    initiated_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    shipped_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    received_by: Optional[str] = None
    rejection_reason: str = ""
    notes: str = ""


class PriceHistory(BaseModel):
    """Price change audit trail"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str  # VENDOR_RM, SKU_BUYER, RM_COST
    entity_id: str
    old_price: Optional[float] = None
    new_price: float
    currency: str = "INR"
    change_reason: str = ""
    effective_date: datetime
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class AuditLog(BaseModel):
    """System-wide audit log"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str  # Table name
    entity_id: str
    action: str  # CREATE, UPDATE, DELETE, STATUS_CHANGE
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    user_email: str = ""
    ip_address: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
