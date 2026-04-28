"""TDS Taxes — local CRUD with mandatory Zoho tax_id mapping.

Zoho Books does NOT allow creating TDS taxes via REST API; admin must create
them manually in Zoho UI (Settings → Taxes → TDS) and paste the resulting
tax_id into our local row. This route exposes:

    GET    /api/tds-taxes                  -> list (filterable by ?status=ACTIVE)
    POST   /api/tds-taxes                  -> create (Zoho tax_id REQUIRED)
    PUT    /api/tds-taxes/{id}             -> update
    DELETE /api/tds-taxes/{id}             -> delete
    GET    /api/zoho/tds-taxes-available   -> list Zoho's TDS taxes (for the
                                              dialog's "pick a Zoho mapping" UX)
"""
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from models import User
from services.utils import get_current_user
from services.zoho_service import zoho_client

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_STATUSES = {"ACTIVE", "INACTIVE"}


class TDSTaxCreate(BaseModel):
    tax_name: str = Field(..., min_length=1, max_length=120)
    rate: float = Field(..., ge=0, le=100, description="TDS percentage (0-100)")
    section: str = Field(..., min_length=1, max_length=120,
                         description="TDS section, e.g. 'Section 194C — Contractor'")
    status: str = Field(default="ACTIVE")
    zoho_tax_id: str = Field(..., min_length=1,
                             description="Zoho tax_id from Settings → Taxes → TDS (required)")


class TDSTaxUpdate(BaseModel):
    tax_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    rate: Optional[float] = Field(default=None, ge=0, le=100)
    section: Optional[str] = Field(default=None, min_length=1, max_length=120)
    status: Optional[str] = None
    zoho_tax_id: Optional[str] = Field(default=None, min_length=1)


def _format_label(tax_name: str, rate: float) -> str:
    """Render the option label as '<Tax Name> <rate>%'."""
    rate_str = (f"{rate:.0f}" if float(rate).is_integer() else f"{rate:g}")
    return f"{tax_name} {rate_str}%"


@router.get("/tds-taxes")
async def list_tds_taxes(
    status: Optional[str] = Query(default=None, regex="^(ACTIVE|INACTIVE)$"),
    current_user: User = Depends(get_current_user),
):
    """List all TDS taxes. Pass ?status=ACTIVE to get only the dropdown-eligible rows."""
    query = {}
    if status:
        query["status"] = status
    rows = await db.tds_taxes.find(query, {"_id": 0}).sort("tax_name", 1).to_list(500)
    for r in rows:
        r["label"] = _format_label(r.get("tax_name", ""), r.get("rate", 0))
    return rows


@router.post("/tds-taxes")
async def create_tds_tax(
    body: TDSTaxCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new TDS tax. zoho_tax_id is mandatory — admin must create the
    matching TDS in Zoho UI first and paste the id here.
    """
    status = body.status.strip().upper()
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(ALLOWED_STATUSES)}")

    # Reject duplicates by (tax_name, rate) case-insensitive
    existing = await db.tds_taxes.find_one({
        "tax_name": {"$regex": f"^{re.escape(body.tax_name.strip())}$", "$options": "i"},
        "rate": body.rate,
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A TDS with name '{body.tax_name}' and rate {body.rate}% already exists",
        )

    # Validate the zoho_tax_id actually points to a real TDS tax in Zoho
    if zoho_client.is_configured():
        try:
            await zoho_client._make_request("GET", f"settings/taxes/{body.zoho_tax_id}")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Zoho tax_id '{body.zoho_tax_id}' was not found in Zoho Books. {e}",
            )

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "tax_name": body.tax_name.strip(),
        "rate": body.rate,
        "section": body.section.strip(),
        "status": status,
        "zoho_tax_id": body.zoho_tax_id.strip(),
        "created_at": now,
        "created_by": current_user.id,
    }
    await db.tds_taxes.insert_one(doc)
    doc.pop("_id", None)
    doc["label"] = _format_label(doc["tax_name"], doc["rate"])
    return doc


@router.put("/tds-taxes/{tds_id}")
async def update_tds_tax(
    tds_id: str,
    body: TDSTaxUpdate,
    current_user: User = Depends(get_current_user),
):
    existing = await db.tds_taxes.find_one({"id": tds_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="TDS tax not found")

    update: dict = {}
    if body.tax_name is not None:
        update["tax_name"] = body.tax_name.strip()
    if body.rate is not None:
        update["rate"] = body.rate
    if body.section is not None:
        update["section"] = body.section.strip()
    if body.status is not None:
        s = body.status.strip().upper()
        if s not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {sorted(ALLOWED_STATUSES)}")
        update["status"] = s
    if body.zoho_tax_id is not None:
        new_zid = body.zoho_tax_id.strip()
        if new_zid != existing.get("zoho_tax_id") and zoho_client.is_configured():
            try:
                await zoho_client._make_request("GET", f"settings/taxes/{new_zid}")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Zoho tax_id '{new_zid}' not found in Zoho Books. {e}",
                )
        update["zoho_tax_id"] = new_zid

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = current_user.id
    await db.tds_taxes.update_one({"id": tds_id}, {"$set": update})

    updated = await db.tds_taxes.find_one({"id": tds_id}, {"_id": 0})
    updated["label"] = _format_label(updated.get("tax_name", ""), updated.get("rate", 0))
    return updated


@router.delete("/tds-taxes/{tds_id}")
async def delete_tds_tax(
    tds_id: str,
    current_user: User = Depends(get_current_user),
):
    res = await db.tds_taxes.delete_one({"id": tds_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="TDS tax not found")
    return {"ok": True, "deleted": tds_id}


@router.get("/zoho/tds-taxes-available")
async def list_zoho_tds_taxes(current_user: User = Depends(get_current_user)):
    """Return Zoho's full tax list so the admin can pick the right tax_id for
    a new local TDS row. Filters to TDS-type entries when possible.
    """
    if not zoho_client.is_configured():
        raise HTTPException(status_code=503, detail="Zoho integration not configured")
    try:
        result = await zoho_client._make_request("GET", "settings/taxes")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Zoho taxes: {e}")

    taxes = result.get("taxes", []) or []
    return [
        {
            "tax_id": t.get("tax_id"),
            "tax_name": t.get("tax_name"),
            "tax_percentage": t.get("tax_percentage"),
            "tax_type": t.get("tax_type"),
            "tax_specific_type": t.get("tax_specific_type"),
            "tax_authority_name": t.get("tax_authority_name"),
            "is_inactive": t.get("is_inactive", False),
        }
        for t in taxes
    ]
