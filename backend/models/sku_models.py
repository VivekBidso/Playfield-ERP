"""
SKU Data Models - Bidso SKU and Buyer SKU Architecture

Hierarchy:
- Vertical (e.g., Kids Scooter)
  └── Model (e.g., Pulse)
      └── Bidso SKU (base product: KS_PE_001)
          └── Buyer SKU (branded variant: BE_KS_PE_001)

ID Generation:
- Bidso SKU: {VerticalCode}_{ModelCode}_{NumericCode}
- Buyer SKU: {BrandCode}_{BidsoSKU}

BOM Structure:
- Common BOM: Locked at Bidso SKU level (core components)
- Brand-specific BOM: Additional RM per brand (labels, packaging)
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ============ Bidso SKU (Base Product) ============

class BidsoSKU(BaseModel):
    """
    Bidso SKU - Internal/Base product definition.
    Multiple Buyer SKUs can map to one Bidso SKU.
    BOM is locked at this level (common to all variants).
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bidso_sku_id: str  # Format: {VerticalCode}_{ModelCode}_{NumericCode}
    
    # Relationships
    vertical_id: str
    vertical_code: str
    model_id: str
    model_code: str
    numeric_code: str  # Auto-suggested but editable (001, 002, etc.)
    
    # Descriptive fields
    name: str = ""
    description: str = ""
    
    # Status
    status: str = "ACTIVE"  # ACTIVE, INACTIVE
    
    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class BidsoSKUCreate(BaseModel):
    """Create Bidso SKU request"""
    vertical_id: str
    model_id: str
    numeric_code: Optional[str] = None  # Auto-generated if not provided
    name: str = ""
    description: str = ""


class BidsoSKUUpdate(BaseModel):
    """Update Bidso SKU request"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ============ Buyer SKU (Branded Variant) ============

class BuyerSKU(BaseModel):
    """
    Buyer SKU - Customer-facing variant of Bidso SKU.
    Extends Bidso SKU with brand-specific attributes.
    ID Format: {BrandCode}_{BidsoSKU}
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    buyer_sku_id: str  # Format: {BrandCode}_{BidsoSKU}
    
    # Parent relationship
    bidso_sku_id: str  # Reference to parent Bidso SKU
    
    # Brand relationship
    brand_id: str
    brand_code: str
    
    # Optional buyer association
    buyer_id: Optional[str] = None
    
    # Descriptive fields (can override parent)
    name: str = ""
    description: str = ""
    
    # Pricing (optional)
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    
    # Status
    status: str = "ACTIVE"  # ACTIVE, INACTIVE
    
    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class BuyerSKUCreate(BaseModel):
    """Create Buyer SKU request"""
    bidso_sku_id: str  # Parent Bidso SKU
    brand_id: str
    buyer_id: Optional[str] = None
    name: str = ""
    description: str = ""
    mrp: Optional[float] = None
    selling_price: Optional[float] = None


class BuyerSKUUpdate(BaseModel):
    """Update Buyer SKU request"""
    buyer_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    status: Optional[str] = None


# ============ BOM Models ============

class BOMItem(BaseModel):
    """Single item in a BOM"""
    rm_id: str
    rm_name: Optional[str] = None
    quantity: float = 1.0
    unit: str = "nos"


class CommonBOM(BaseModel):
    """
    Common BOM - Locked at Bidso SKU level.
    Contains core components shared by all Buyer SKU variants.
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bidso_sku_id: str
    
    # BOM items (core components)
    items: List[BOMItem] = []
    
    # Lock status - once locked, cannot be modified without unlocking
    is_locked: bool = False
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class BrandSpecificBOM(BaseModel):
    """
    Brand-specific BOM - Additional RM per brand.
    Added on top of Common BOM for Buyer SKUs.
    Examples: Labels, packaging, brand inserts
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bidso_sku_id: str
    brand_id: str
    brand_code: str
    
    # Additional brand-specific items
    items: List[BOMItem] = []
    
    # Audit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class CommonBOMCreate(BaseModel):
    """Create/Update Common BOM"""
    bidso_sku_id: str
    items: List[BOMItem]


class BrandSpecificBOMCreate(BaseModel):
    """Create/Update Brand-specific BOM"""
    bidso_sku_id: str
    brand_id: str
    items: List[BOMItem]


# ============ Combined BOM View ============

class FullBOM(BaseModel):
    """
    Full BOM for a Buyer SKU.
    Combines Common BOM + Brand-specific BOM.
    """
    buyer_sku_id: str
    bidso_sku_id: str
    brand_code: str
    
    common_items: List[BOMItem] = []
    brand_specific_items: List[BOMItem] = []
    
    # Total items = common + brand-specific
    total_items: List[BOMItem] = []
    
    is_common_bom_locked: bool = False


# ============ Migration Support ============

class SKUMigrationResult(BaseModel):
    """Result of SKU migration from old to new structure"""
    total_processed: int = 0
    bidso_skus_created: int = 0
    buyer_skus_created: int = 0
    bom_migrated: int = 0
    errors: List[str] = []
