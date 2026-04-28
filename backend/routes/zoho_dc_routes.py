"""Routes for Zoho Books Delivery Challan integration with IBT transfers.

Flow:
    1. User creates an IBT and approves it (status >= APPROVED).
    2. User clicks "Create DC" on an IBT row.
       Frontend opens a dialog and calls:
         GET  /api/zoho/dc/required-fields              -> field schema for the form
         GET  /api/zoho/customers/search?q=...          -> debounced customer search (>=2 chars)
         POST /api/ibt-transfers/{id}/delivery-challan  -> creates DC in Zoho (draft)
    3. User goes to Zoho Books and marks the DC as "Open" (issued/dispatched).
    4. Zoho fires our webhook:
         POST /api/zoho/webhook/delivery-challan?secret=...
       which:
         - validates the shared secret in the query string,
         - looks up the linked IBT by zoho_dc_id,
         - on Zoho status="open"  -> sets IBT status to DISPATCHED,
         - on Zoho status="delivered" -> sets IBT status to COMPLETED (if not RECEIVED),
         - on Zoho status="returned"/"void" -> logs and unlinks the DC.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from database import db
from models import User
from services.utils import get_current_user
from services.zoho_service import zoho_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------
class DCLineItemOverride(BaseModel):
    """Optional per-line overrides supplied by the user from the dialog."""
    rate: Optional[float] = None
    description: Optional[str] = None


class CreateDCRequest(BaseModel):
    """Body for POST /api/ibt-transfers/{id}/delivery-challan.

    The IBT itself supplies item_id + quantity + reference_number; the user only
    picks the customer + (optionally) overrides date/notes/challan_type.
    """
    customer_id: str = Field(..., min_length=1, description="Zoho contact_id of the customer")
    challan_type: str = Field(default="others")
    date: Optional[str] = Field(default=None, description="YYYY-MM-DD; defaults to today")
    reference_number: Optional[str] = Field(default=None, description="Defaults to IBT transfer_code")
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None


# Static field schema (Zoho doesn't expose a "describe" endpoint for DCs).
DC_REQUIRED_FIELDS = {
    "fields": [
        {"key": "customer_id", "label": "Customer", "type": "customer_search", "required": True,
         "help": "Type at least 2 characters to search Zoho customers"},
        {"key": "challan_type", "label": "Challan Type", "type": "select", "required": True,
         "default": "others",
         "options": [
             {"value": "others", "label": "Others (recommended default)"},
             {"value": "job_work", "label": "Job Work"},
             {"value": "goods_sent_on_approval", "label": "Goods Sent on Approval"},
             {"value": "skip_outward_registration", "label": "Skip Outward Registration"},
             {"value": "supply_of_liquid_gas", "label": "Supply of Liquid Gas"},
         ]},
        {"key": "date", "label": "Challan Date", "type": "date", "required": True,
         "default_to_today": True},
        {"key": "reference_number", "label": "Reference Number", "type": "text",
         "required": False, "default_from": "transfer_code",
         "help": "Defaults to the IBT transfer code"},
        {"key": "notes", "label": "Notes", "type": "textarea", "required": False,
         "default_from": "ibt_notes"},
        {"key": "terms_and_conditions", "label": "Terms & Conditions", "type": "textarea",
         "required": False},
    ],
    # Auto-populated from the IBT (read-only in dialog)
    "auto_populated": [
        {"key": "transfer_code", "label": "Transfer Code"},
        {"key": "from_to", "label": "Source → Destination"},
        {"key": "items", "label": "Items (item_id, quantity)"},
        {"key": "vehicle_number", "label": "Vehicle Number"},
        {"key": "driver_name", "label": "Driver"},
    ],
}


# ---------------------------------------------------------------------------
# Read-only helpers
# ---------------------------------------------------------------------------
@router.get("/zoho/dc/required-fields")
async def get_dc_required_fields(current_user: User = Depends(get_current_user)):
    """Return the field schema for the Create-DC dialog.

    Frontend uses this to render the form so any future field changes are
    driven from one place.
    """
    return DC_REQUIRED_FIELDS


@router.get("/zoho/customers/search")
async def search_zoho_customers(
    q: str = Query(..., min_length=2, max_length=100,
                   description="Customer name fragment (>=2 chars)"),
    current_user: User = Depends(get_current_user),
):
    """Live-search Zoho customers by name-contains."""
    if not zoho_client.is_configured():
        raise HTTPException(status_code=503, detail="Zoho integration not configured")
    try:
        return await zoho_client.search_customers(q.strip())
    except Exception as e:
        logger.error(f"Zoho customer search failed: {e}")
        raise HTTPException(status_code=502, detail=f"Zoho search failed: {e}")


@router.get("/zoho/items/search")
async def search_zoho_items(
    q: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
):
    """Lookup Zoho items by SKU/name (used to resolve our internal item_id)."""
    if not zoho_client.is_configured():
        raise HTTPException(status_code=503, detail="Zoho integration not configured")
    try:
        return await zoho_client.search_items_by_sku(q.strip())
    except Exception as e:
        logger.error(f"Zoho item search failed: {e}")
        raise HTTPException(status_code=502, detail=f"Zoho item search failed: {e}")


# ---------------------------------------------------------------------------
# Create DC for an IBT
# ---------------------------------------------------------------------------
def _build_line_items_from_ibt(transfer: dict) -> list:
    """Convert IBT items (single-item or multi-item) into DC line_items.

    Single-item legacy IBTs have item_id+quantity at top level.
    Multi-item IBTs have transfer.items = [{item_id, quantity, ...}, ...].

    The user confirmed our internal item_id == Zoho item_id, so we pass it
    through directly.
    """
    if transfer.get("items"):
        return [
            {
                "item_id": i["item_id"],
                "quantity": float(i.get("quantity", 0)),
                **({"description": i["description"]} if i.get("description") else {}),
            }
            for i in transfer["items"]
            if i.get("item_id")
        ]
    return [
        {
            "item_id": transfer["item_id"],
            "quantity": float(transfer.get("quantity", 0)),
        }
    ]


@router.post("/ibt-transfers/{transfer_id}/delivery-challan")
async def create_delivery_challan_for_ibt(
    transfer_id: str,
    body: CreateDCRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a draft Delivery Challan in Zoho for an IBT.

    Gating (per requirement 1b):
        - IBT must exist and be in status APPROVED, READY_FOR_DISPATCH, or
          IN_TRANSIT (anything that has been approved but not yet completed).
        - IBT must NOT already have a zoho_dc_id (one DC per IBT).
    """
    if not zoho_client.is_configured():
        raise HTTPException(status_code=503, detail="Zoho integration not configured")

    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="IBT transfer not found")

    if transfer.get("zoho_dc_id"):
        raise HTTPException(
            status_code=400,
            detail=f"DC already exists for this IBT: {transfer.get('zoho_dc_number') or transfer['zoho_dc_id']}",
        )

    allowed_statuses = {"APPROVED", "READY_FOR_DISPATCH", "IN_TRANSIT"}
    if transfer.get("status") not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"DC can only be created when IBT is approved. Current status: {transfer.get('status')}",
        )

    # Build line items from the IBT
    line_items = _build_line_items_from_ibt(transfer)
    if not line_items:
        raise HTTPException(status_code=400, detail="IBT has no items to put on DC")

    # Zoho requires `rate` on every line item — fetch it from the Zoho catalog if not provided.
    # We deduplicate item_ids to minimize API calls.
    unique_item_ids = list({li["item_id"] for li in line_items if li.get("item_id")})
    rate_cache: dict = {}
    for iid in unique_item_ids:
        try:
            zoho_item = await zoho_client._make_request("GET", f"items/{iid}")
            rate_cache[iid] = (zoho_item.get("item") or {}).get("rate")
        except Exception as e:
            logger.error(f"Failed to fetch rate for Zoho item {iid}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Item {iid} not found in Zoho catalog. Please ensure item exists in Zoho Books.",
            )
    for li in line_items:
        if li.get("rate") is None and li.get("item_id") in rate_cache:
            li["rate"] = rate_cache[li["item_id"]]

    reference_number = body.reference_number or transfer.get("transfer_code")
    notes = body.notes
    if not notes:
        ibt_notes = transfer.get("notes", "").strip()
        vehicle = transfer.get("vehicle_number", "").strip()
        driver = transfer.get("driver_name", "").strip()
        bits = []
        if ibt_notes:
            bits.append(ibt_notes)
        if vehicle:
            bits.append(f"Vehicle: {vehicle}")
        if driver:
            bits.append(f"Driver: {driver}")
        bits.append(f"From: {transfer.get('source_branch')} to {transfer.get('destination_branch')}")
        notes = " | ".join(bits)

    try:
        dc = await zoho_client.create_delivery_challan(
            customer_id=body.customer_id,
            line_items=line_items,
            challan_type=body.challan_type or "others",
            date=body.date,
            reference_number=reference_number,
            notes=notes,
            terms_and_conditions=body.terms_and_conditions,
        )
    except Exception as e:
        logger.error(f"DC creation in Zoho failed for IBT {transfer_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Zoho DC creation failed: {e}")

    dc_id = dc.get("deliverychallan_id")
    dc_number = dc.get("deliverychallan_number")
    dc_status = dc.get("status", "draft")

    # Persist linkage on the IBT
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.ibt_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "zoho_dc_id": dc_id,
            "zoho_dc_number": dc_number,
            "zoho_dc_status": dc_status,
            "zoho_dc_customer_id": body.customer_id,
            "zoho_dc_created_at": now_iso,
            "zoho_dc_status_updated_at": now_iso,
            "zoho_dc_created_by": current_user.id,
        }},
    )

    return {
        "deliverychallan_id": dc_id,
        "deliverychallan_number": dc_number,
        "status": dc_status,
        "message": "Draft delivery challan created in Zoho Books",
    }


@router.get("/ibt-transfers/{transfer_id}/delivery-challan")
async def get_dc_status(
    transfer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return the current DC summary for an IBT (used by status badge popover)."""
    transfer = await db.ibt_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if transfer is None:
        raise HTTPException(status_code=404, detail="IBT transfer not found")
    return {
        "zoho_dc_id": transfer.get("zoho_dc_id"),
        "zoho_dc_number": transfer.get("zoho_dc_number"),
        "zoho_dc_status": transfer.get("zoho_dc_status"),
        "zoho_dc_created_at": transfer.get("zoho_dc_created_at"),
        "zoho_dc_status_updated_at": transfer.get("zoho_dc_status_updated_at"),
        "zoho_dc_customer_id": transfer.get("zoho_dc_customer_id"),
    }


# ---------------------------------------------------------------------------
# Webhook: Zoho -> us (status sync)
# ---------------------------------------------------------------------------
# Status mapping: Zoho DC status -> our IBT status
# (per user requirement 6: Zoho "open" = approved/dispatched -> IBT DISPATCHED)
ZOHO_TO_IBT_STATUS = {
    "open": "DISPATCHED",
    "delivered": "COMPLETED",
    "returned": "CANCELLED",
}


@router.post("/zoho/webhook/delivery-challan")
async def zoho_dc_webhook(
    request: Request,
    secret: Optional[str] = Query(default=None),
):
    """Receive Zoho Books DC status-change events.

    Auth model (per requirement 4b — shared secret):
        Zoho should be configured to call this URL with `?secret=<value>`. The
        secret is stored in env var ZOHO_WEBHOOK_SECRET. We use a constant-time
        compare to avoid timing leaks. NO Authorization header is required (Zoho
        cannot reliably set custom auth headers from its no-code workflow rules).

    Body: Zoho posts the DC fields as JSON. We accept a flexible shape and look
    for the deliverychallan_id + status; this matches both the documented
    workflow-rule webhook payload and the standard webhook payload variants.
    """
    expected = os.environ.get("ZOHO_WEBHOOK_SECRET")
    if not expected:
        logger.error("ZOHO_WEBHOOK_SECRET not set — refusing webhook")
        raise HTTPException(status_code=503, detail="Webhook not configured")
    import hmac as _hmac
    if not secret or not _hmac.compare_digest(secret, expected):
        logger.warning("Zoho DC webhook: invalid secret (rejected)")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        payload = await request.json()
    except Exception:
        # Some Zoho webhook flavors send form-encoded body
        form = await request.form()
        payload = dict(form)

    # The DC fields can be at the top level OR nested under "deliverychallan"
    dc = payload.get("deliverychallan") if isinstance(payload, dict) else None
    if not isinstance(dc, dict):
        dc = payload if isinstance(payload, dict) else {}

    dc_id = dc.get("deliverychallan_id") or payload.get("deliverychallan_id")
    new_status = (dc.get("status") or payload.get("status") or "").lower().strip()
    last_modified = dc.get("last_modified_time") or payload.get("last_modified_time")

    if not dc_id or not new_status:
        logger.warning(f"Zoho DC webhook: missing dc_id or status in payload: {payload}")
        return {"ok": True, "ignored": "missing dc_id or status"}

    # Find the linked IBT
    transfer = await db.ibt_transfers.find_one({"zoho_dc_id": dc_id}, {"_id": 0})
    if not transfer:
        logger.info(f"Zoho DC webhook: DC {dc_id} not linked to any IBT — ignoring")
        return {"ok": True, "ignored": "no linked IBT"}

    # Idempotency: if last_modified_time is older than our stored one, skip
    prev_updated = transfer.get("zoho_dc_status_updated_at")
    if prev_updated and last_modified and last_modified <= prev_updated:
        logger.info(f"Zoho DC webhook: stale event for DC {dc_id} — skipping")
        return {"ok": True, "skipped": "stale event"}

    update_set = {
        "zoho_dc_status": new_status,
        "zoho_dc_status_updated_at": last_modified or datetime.now(timezone.utc).isoformat(),
    }

    new_ibt_status = ZOHO_TO_IBT_STATUS.get(new_status)
    if new_ibt_status:
        # Don't downgrade if IBT already moved past via Receive flow
        current_ibt_status = transfer.get("status")
        progress_order = {
            "INITIATED": 0, "APPROVED": 1, "READY_FOR_DISPATCH": 1,
            "DISPATCHED": 2, "IN_TRANSIT": 2,
            "RECEIVED": 3, "COMPLETED": 4,
            "CANCELLED": -1, "REJECTED": -1,
        }
        cur_rank = progress_order.get(current_ibt_status, 0)
        new_rank = progress_order.get(new_ibt_status, 0)
        if new_status == "returned":
            # Returned/void from Zoho -> cancel even if mid-flow
            update_set["status"] = new_ibt_status
            update_set["dispatched_at"] = None
        elif new_rank > cur_rank:
            update_set["status"] = new_ibt_status
            if new_ibt_status == "DISPATCHED":
                update_set["dispatched_at"] = datetime.now(timezone.utc).isoformat()
        # else: don't downgrade — keep current

    await db.ibt_transfers.update_one({"id": transfer["id"]}, {"$set": update_set})
    logger.info(
        f"Zoho DC webhook: IBT {transfer['id']} ({transfer.get('transfer_code')}) "
        f"DC {dc_id} status={new_status} -> IBT status={update_set.get('status', '<unchanged>')}"
    )

    return {"ok": True, "ibt_id": transfer["id"], "ibt_status": update_set.get("status")}
