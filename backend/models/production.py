"""
In-House Production Models
- RM Categories
- RM BOM (Bill of Materials)
- Production Log
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class SourceType(str, Enum):
    PURCHASED = "PURCHASED"
    MANUFACTURED = "MANUFACTURED"
    BOTH = "BOTH"


class BOMLevel(int, Enum):
    L1 = 1
    L2 = 2
    L3 = 3
    L4 = 4


# ============ RM Categories ============

class RMCategoryBase(BaseModel):
    code: str = Field(..., description="Category code e.g. INP, POLY, MB")
    name: str = Field(..., description="Category name e.g. In-house Plastic Parts")
    description: Optional[str] = None
    default_source_type: SourceType = SourceType.PURCHASED
    default_bom_level: int = Field(1, ge=1, le=4)
    is_active: bool = True


class RMCategoryCreate(RMCategoryBase):
    pass


class RMCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_source_type: Optional[SourceType] = None
    default_bom_level: Optional[int] = Field(None, ge=1, le=4)
    is_active: Optional[bool] = None


class RMCategory(RMCategoryBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


# ============ RM BOM ============

class BOMComponent(BaseModel):
    component_rm_id: str = Field(..., description="RM ID of the component")
    component_name: Optional[str] = None
    quantity: float = Field(..., gt=0, description="Quantity per unit of output")
    uom: str = Field(..., description="Unit of measure")
    percentage: Optional[float] = Field(None, ge=0, le=100, description="Percentage composition")
    wastage_factor: float = Field(1.0, ge=1.0, description="Wastage multiplier e.g. 1.02 for 2% wastage")


class RMBOMBase(BaseModel):
    rm_id: str = Field(..., description="RM ID of the manufactured item")
    rm_name: Optional[str] = None
    category: str
    bom_level: int = Field(2, ge=2, le=4)
    output_qty: float = Field(1.0, gt=0)
    output_uom: str = "PCS"
    components: List[BOMComponent] = Field(..., min_length=1)
    total_weight_per_unit: Optional[float] = None
    yield_factor: float = Field(1.0, gt=0, le=1.0, description="Yield factor e.g. 0.97 for 3% loss")
    is_active: bool = True


class RMBOMCreate(RMBOMBase):
    pass


class RMBOMUpdate(BaseModel):
    rm_name: Optional[str] = None
    output_qty: Optional[float] = Field(None, gt=0)
    output_uom: Optional[str] = None
    components: Optional[List[BOMComponent]] = None
    total_weight_per_unit: Optional[float] = None
    yield_factor: Optional[float] = Field(None, gt=0, le=1.0)
    is_active: Optional[bool] = None


class RMBOM(RMBOMBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


# ============ Production Log ============

class ConsumedComponent(BaseModel):
    rm_id: str
    name: str
    quantity_consumed: float
    uom: str
    stock_before: Optional[float] = None
    stock_after: Optional[float] = None


class ProductionLogBase(BaseModel):
    branch: str
    rm_id: str = Field(..., description="RM ID of the produced item")
    rm_name: Optional[str] = None
    category: str
    bom_level: int
    quantity_produced: float = Field(..., gt=0)
    uom: str = "PCS"
    components_consumed: List[ConsumedComponent] = []
    notes: Optional[str] = None
    production_date: str = Field(..., description="Date of production YYYY-MM-DD")


class ProductionLogCreate(BaseModel):
    branch: str
    rm_id: str
    quantity_produced: float = Field(..., gt=0)
    notes: Optional[str] = None
    production_date: Optional[str] = None  # Defaults to today


class ProductionLog(ProductionLogBase):
    id: str
    production_code: str
    produced_by: str
    produced_by_name: str
    created_at: datetime


# ============ Production Inward Request/Response ============

class ComponentConsumptionPreview(BaseModel):
    rm_id: str
    name: str
    required_qty: float
    uom: str
    available_stock: float
    is_sufficient: bool
    shortage: float = 0


class ProductionPreviewRequest(BaseModel):
    branch: str
    rm_id: str
    quantity_to_produce: float = Field(..., gt=0)


class ProductionPreviewResponse(BaseModel):
    rm_id: str
    rm_name: str
    category: str
    bom_level: int
    quantity_to_produce: float
    output_uom: str
    components: List[ComponentConsumptionPreview]
    can_produce: bool
    blocking_components: List[str] = []


class ProductionConfirmRequest(BaseModel):
    branch: str
    rm_id: str
    quantity_produced: float = Field(..., gt=0)
    notes: Optional[str] = None
    production_date: Optional[str] = None


class ProductionConfirmResponse(BaseModel):
    success: bool
    production_code: str
    rm_id: str
    quantity_produced: float
    components_consumed: List[ConsumedComponent]
    message: str
