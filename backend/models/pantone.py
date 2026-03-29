"""
Pantone Shade Management Models
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class ColorFamily(str, Enum):
    RED = "RED"
    BLUE = "BLUE"
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    PURPLE = "PURPLE"
    PINK = "PINK"
    BROWN = "BROWN"
    BLACK = "BLACK"
    WHITE = "WHITE"
    GREY = "GREY"
    METALLIC = "METALLIC"
    OTHER = "OTHER"


class PantoneStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DEPRECATED = "DEPRECATED"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DEPRECATED = "DEPRECATED"


class PantoneShadeCreate(BaseModel):
    pantone_code: str = Field(..., description="Official Pantone reference (e.g., '485 C')")
    pantone_name: str = Field(..., description="Descriptive name (e.g., 'Bright Red')")
    color_hex: str = Field(..., description="Hex color code for UI preview (e.g., '#DA291C')")
    color_family: ColorFamily = Field(default=ColorFamily.OTHER)
    applicable_categories: List[str] = Field(default=["INP", "INM", "ACC"])
    notes: Optional[str] = None


class PantoneShadeUpdate(BaseModel):
    pantone_name: Optional[str] = None
    color_hex: Optional[str] = None
    color_family: Optional[ColorFamily] = None
    applicable_categories: Optional[List[str]] = None
    status: Optional[PantoneStatus] = None
    notes: Optional[str] = None


class PantoneShade(BaseModel):
    id: str
    pantone_code: str
    pantone_name: str
    color_hex: str
    color_family: ColorFamily
    applicable_categories: List[str]
    status: PantoneStatus = PantoneStatus.ACTIVE
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None


class VendorMasterbatchCreate(BaseModel):
    pantone_id: str
    vendor_id: str
    master_batch_code: str = Field(..., description="Vendor's internal master batch code")
    delta_e_value: Optional[float] = Field(None, description="Color difference measurement")
    lab_report_url: Optional[str] = None
    sample_batch_number: Optional[str] = None
    lead_time_days: Optional[int] = 14
    moq: Optional[int] = 100
    batch_size: Optional[int] = 25
    notes: Optional[str] = None


class VendorMasterbatchUpdate(BaseModel):
    master_batch_code: Optional[str] = None
    delta_e_value: Optional[float] = None
    lab_report_url: Optional[str] = None
    sample_batch_number: Optional[str] = None
    lead_time_days: Optional[int] = None
    moq: Optional[int] = None
    batch_size: Optional[int] = None
    is_preferred: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class VendorMasterbatch(BaseModel):
    id: str
    pantone_id: str
    pantone_code: str
    vendor_id: str
    vendor_name: str
    master_batch_code: str
    
    # Approval
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Quality
    delta_e_value: Optional[float] = None
    lab_report_url: Optional[str] = None
    sample_batch_number: Optional[str] = None
    
    # Operational
    is_preferred: bool = False
    is_active: bool = True
    lead_time_days: int = 14
    moq: int = 100
    batch_size: int = 25
    
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ColorDevelopmentRequestCreate(BaseModel):
    pantone_code: str
    pantone_name: str
    color_hex: Optional[str] = None
    color_family: Optional[ColorFamily] = None
    applicable_categories: List[str] = Field(default=["INP", "INM", "ACC"])
    target_models: Optional[List[str]] = None
    priority: str = "NORMAL"  # LOW, NORMAL, HIGH, URGENT
    notes: Optional[str] = None


class ColorDevelopmentRequest(BaseModel):
    id: str
    pantone_code: str
    pantone_name: str
    color_hex: Optional[str] = None
    color_family: Optional[ColorFamily] = None
    applicable_categories: List[str]
    target_models: Optional[List[str]] = None
    priority: str = "NORMAL"
    status: str = "REQUESTED"  # REQUESTED, VENDOR_DEVELOPMENT, QC_PENDING, APPROVED, REJECTED
    notes: Optional[str] = None
    
    requested_by: Optional[str] = None
    requested_at: Optional[datetime] = None
    pantone_id: Optional[str] = None  # Set when approved and pantone created
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
