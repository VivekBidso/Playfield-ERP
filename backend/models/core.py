"""Core models for Raw Materials, SKUs, Production, and Inventory"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class RawMaterial(BaseModel):
    """Global RM definition with L1/L2 support and brand/model tagging"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    category: str
    category_data: Dict[str, Any] = {}
    low_stock_threshold: float = 10.0
    # L1/L2 Fields
    rm_level: str = "DIRECT"  # L1, L2, DIRECT
    parent_rm_id: Optional[str] = None  # L1 parent for L2 items
    unit_weight_grams: Optional[float] = None  # Weight per unit (for INP L2)
    scrap_factor: float = 0.02  # Waste factor (2% default)
    processing_cost: float = 0.0  # Per-unit processing cost
    # INM-specific fields
    secondary_l1_rm_id: Optional[str] = None  # Powder coating RM (INM only)
    powder_qty_grams: Optional[float] = None  # Predefined powder coating qty in grams
    coating_scrap_factor: float = 0.10  # Coating waste factor (INM only)
    
    # === NEW: Brand/Model/Vertical Tagging (Optional, Multiple) ===
    brand_ids: List[str] = []  # Optional: Tag to multiple brands
    vertical_ids: List[str] = []  # Optional: Tag to multiple verticals
    model_ids: List[str] = []  # Optional: Tag to multiple models
    is_brand_specific: bool = False  # Flag for brand-specific RMs (labels, assets, etc.)
    
    # Per-RM overrides (take priority over category defaults)
    uom: Optional[str] = None  # PCS, KG, MTR, etc. Falls back to category default_uom
    source_type: Optional[str] = None  # PURCHASED, MANUFACTURED, BOTH. Falls back to category default
    bom_level: Optional[Any] = None  # L1, L2, L3 or int
    has_bom: bool = False
    
    status: str = "ACTIVE"  # ACTIVE, INACTIVE, DISCONTINUED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class RawMaterialCreate(BaseModel):
    category: str
    category_data: Dict[str, Any]
    low_stock_threshold: float = 10.0
    # L1/L2 Fields
    rm_level: str = "DIRECT"
    parent_rm_id: Optional[str] = None
    unit_weight_grams: Optional[float] = None
    scrap_factor: float = 0.02
    processing_cost: float = 0.0
    secondary_l1_rm_id: Optional[str] = None
    powder_qty_grams: Optional[float] = None
    coating_scrap_factor: float = 0.10
    # NEW: Optional tagging
    brand_ids: List[str] = []
    vertical_ids: List[str] = []
    model_ids: List[str] = []
    is_brand_specific: bool = False
    # Per-RM overrides
    uom: Optional[str] = None
    source_type: Optional[str] = None


class RawMaterialUpdate(BaseModel):
    """Update RM - especially for tagging"""
    category_data: Optional[Dict[str, Any]] = None
    low_stock_threshold: Optional[float] = None
    brand_ids: Optional[List[str]] = None
    vertical_ids: Optional[List[str]] = None
    model_ids: Optional[List[str]] = None
    is_brand_specific: Optional[bool] = None
    status: Optional[str] = None
    uom: Optional[str] = None
    source_type: Optional[str] = None


class RMRequest(BaseModel):
    """RM Request - Demand team requests, Tech Ops approves"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Request details
    category: str  # LB, PM, BA (Brand Asset), etc.
    requested_name: str  # e.g., "Baybee Kids Scooter Label"
    description: str = ""
    category_data: Dict[str, Any] = {}  # Category-specific fields (type, specs, etc.)
    artwork_files: List[Dict[str, Any]] = []  # Uploaded artwork file references
    
    # Tagging (what this RM is for)
    brand_ids: List[str] = []
    vertical_ids: List[str] = []
    model_ids: List[str] = []
    buyer_sku_id: Optional[str] = None  # If specific to a Buyer SKU
    
    # Workflow
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED, CREATED
    requested_by: Optional[str] = None
    requester_name: str = ""
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Approval
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: str = ""
    
    # Created RM (after approval)
    created_rm_id: Optional[str] = None


class RMRequestCreate(BaseModel):
    """Create RM Request"""
    category: str
    requested_name: str
    description: str = ""
    category_data: Dict[str, Any] = {}  # Category-specific fields
    brand_ids: List[str] = []
    vertical_ids: List[str] = []
    model_ids: List[str] = []
    buyer_sku_id: Optional[str] = None


class RMRequestReview(BaseModel):
    """Review (Approve/Reject) RM Request"""
    action: str  # APPROVE, REJECT
    review_notes: str = ""
    # If approving, these override the request
    category_data: Optional[Dict[str, Any]] = None


class BranchRMInventory(BaseModel):
    """Branch-specific RM inventory"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    branch: str
    current_stock: float = 0.0
    is_active: bool = True
    activated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SKU(BaseModel):
    """Global SKU definition with extended fields"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    bidso_sku: str
    buyer_sku_id: str
    description: str
    brand: str
    vertical: str
    model: str
    low_stock_threshold: float = 5.0
    # New normalized references
    vertical_id: Optional[str] = None
    model_id: Optional[str] = None
    brand_id: Optional[str] = None
    buyer_id: Optional[str] = None
    status: str = "DRAFT"  # DRAFT, BOM_PENDING, BOM_COMPLETE, ACTIVE, DISCONTINUED
    bom_finalized_at: Optional[datetime] = None
    bom_finalized_by: Optional[str] = None
    base_price: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class SKUCreate(BaseModel):
    sku_id: str
    bidso_sku: str
    buyer_sku_id: str
    description: str
    brand: str
    vertical: str
    model: str
    low_stock_threshold: float = 5.0


class BranchSKUInventory(BaseModel):
    """Branch-specific SKU inventory"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    buyer_sku_id: str
    branch: str
    current_stock: float = 0.0
    is_active: bool = True
    activated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RMMapping(BaseModel):
    rm_id: str
    quantity_required: float


class SKUMapping(BaseModel):
    """Global SKU to RM mapping (BOM)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    rm_mappings: List[RMMapping]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SKUMappingCreate(BaseModel):
    sku_id: str
    rm_mappings: List[RMMapping]


class PurchaseEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rm_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PurchaseEntryCreate(BaseModel):
    rm_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None


class ProductionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductionEntryCreate(BaseModel):
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None


class DispatchEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DispatchEntryCreate(BaseModel):
    sku_id: str
    branch: str
    quantity: float
    date: datetime
    notes: Optional[str] = None


class ProductionPlanEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    branch: str
    plan_month: str  # YYYY-MM format
    date: datetime
    sku_id: str
    planned_quantity: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductionPlanCreate(BaseModel):
    branch: str
    plan_month: str
    date: datetime
    sku_id: str
    planned_quantity: float


class ActivateItemRequest(BaseModel):
    item_id: str
    branch: str


class SKUBranchAssignment(BaseModel):
    """Track which SKUs are assigned to which branches"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku_id: str
    branch: str
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
