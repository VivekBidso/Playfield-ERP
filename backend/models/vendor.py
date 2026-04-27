"""Vendor and pricing models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


# Allowed vendor-level payment terms (kept in sync with frontend RMInward PAYMENT_TERMS).
# `CUSTOM` is intentionally excluded — vendors must commit to a fixed term.
ALLOWED_PAYMENT_TERMS = {"DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_45", "NET_60"}
DEFAULT_PAYMENT_TERMS = "DUE_ON_RECEIPT"


class Vendor(BaseModel):
    """Vendor definition with extended fields"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str = ""  # Auto-generated unique ID like VND_001
    name: str
    gst: str = ""
    address: str = ""
    poc: str = ""  # Point of Contact
    email: str = ""
    phone: str = ""
    # Payment terms (vendor-level; auto-populated into RM Inward when this vendor is selected)
    payment_terms: str = DEFAULT_PAYMENT_TERMS
    # Extended fields
    legal_name: str = ""  # GST-validated legal name
    gst_validated: bool = False
    gst_validated_at: Optional[datetime] = None
    payment_terms_days: int = 30
    rating: Optional[float] = None  # 1-5
    is_active: bool = True
    status: str = "ACTIVE"  # ACTIVE, INACTIVE, BLACKLISTED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class VendorCreate(BaseModel):
    name: str
    gst: str = ""
    address: str = ""
    poc: str = ""
    email: str = ""
    phone: str = ""
    payment_terms: str = DEFAULT_PAYMENT_TERMS


class VendorRMPrice(BaseModel):
    """Vendor RM pricing"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    rm_id: str
    price: float
    currency: str = "INR"
    notes: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VendorRMPriceCreate(BaseModel):
    vendor_id: str
    rm_id: str
    price: float
    currency: str = "INR"
    notes: str = ""
