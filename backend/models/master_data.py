"""Master data models: Verticals, Models, Brands, Buyers, Branches"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class Vertical(BaseModel):
    """Product Vertical (e.g., SCOOTER, TRIKE)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    description: str = ""
    status: str = "ACTIVE"  # ACTIVE, INACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class VerticalCreate(BaseModel):
    code: str
    name: str
    description: str = ""


class Model(BaseModel):
    """Product Model under a Vertical"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vertical_id: str
    code: str
    name: str
    description: str = ""
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ModelCreate(BaseModel):
    vertical_id: str
    code: str
    name: str
    description: str = ""


class Brand(BaseModel):
    """Brand (tied to Buyer)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    buyer_id: Optional[str] = None
    logo_url: str = ""
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class BrandCreate(BaseModel):
    code: str
    name: str
    buyer_id: Optional[str] = None


class Buyer(BaseModel):
    """Buyer/Customer - Represents a customer who places orders"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_code: str  # Auto-generated unique code like CUST001
    name: str
    gst: str = ""
    email: str = ""
    phone_no: str = ""
    poc_name: str = ""  # Point of Contact Name
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BuyerCreate(BaseModel):
    name: str
    gst: str = ""
    email: str = ""
    phone_no: str = ""
    poc_name: str = ""


class BuyerUpdate(BaseModel):
    name: Optional[str] = None
    gst: Optional[str] = None
    email: Optional[str] = None
    phone_no: Optional[str] = None
    poc_name: Optional[str] = None


class BuyerBulkImport(BaseModel):
    name: str
    gst: str = ""
    email: str = ""
    phone_no: str = ""
    poc_name: str = ""


class Branch(BaseModel):
    """Branch/Unit definition"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    location: str = ""
    branch_type: str = "PRODUCTION"  # PRODUCTION, WAREHOUSE, HYBRID
    capacity_units_per_day: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
