"""Training PDF download endpoints."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
import json
from pathlib import Path

from services.training_pdf import build_branch_ops_pdf

router = APIRouter(prefix="/training", tags=["Training"])


@router.get("/branch-ops/download")
async def download_branch_ops_training():
    """Download the Branch Operations training PDF."""
    meta_path = Path("/app/backend/static/training/branch_ops/flow_metadata.json")
    metadata = None
    if meta_path.exists():
        try:
            metadata = json.loads(meta_path.read_text())
        except Exception:
            metadata = None

    try:
        pdf_bytes = build_branch_ops_pdf(metadata)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="branch_ops_training_guide.pdf"'
        },
    )


@router.get("/modules")
async def list_training_modules():
    """List available training modules and their download URLs."""
    return {
        "modules": [
            {
                "slug": "branch-ops",
                "name": "Branch Operations",
                "description": "Daily cockpit for viewing, pre-checking and completing production schedules at a branch.",
                "download_url": "/api/training/branch-ops/download",
                "status": "available",
            },
        ]
    }
