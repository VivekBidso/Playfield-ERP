"""Quality Control routes - QC Checklists, Results, Approvals"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db

router = APIRouter(tags=["Quality Control"])

def serialize_doc(doc):
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'inspected_at' in doc and isinstance(doc['inspected_at'], str):
        doc['inspected_at'] = datetime.fromisoformat(doc['inspected_at'])
    return doc

class QCChecklistCreate(BaseModel):
    name: str
    description: str = ""
    check_type: str  # VISUAL, MEASUREMENT, FUNCTIONAL, SAFETY
    vertical_id: Optional[str] = None
    model_id: Optional[str] = None
    brand_id: Optional[str] = None
    expected_value: str = ""
    tolerance: str = ""
    is_mandatory: bool = True
    check_priority: int = 100

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

class QCApprovalCreate(BaseModel):
    production_batch_id: str
    total_inspected: int
    total_passed: int
    total_failed: int
    overall_status: str  # APPROVED, REJECTED, CONDITIONAL, REWORK
    approved_quantity: int = 0
    rejection_reason: str = ""
    rework_instructions: str = ""

# --- QC Checklists ---
@router.get("/qc-checklists")
async def get_qc_checklists(
    vertical_id: Optional[str] = None,
    model_id: Optional[str] = None,
    check_type: Optional[str] = None
):
    query = {"status": "ACTIVE"}
    if vertical_id:
        query["$or"] = [{"vertical_id": vertical_id}, {"vertical_id": None}]
    if model_id:
        query["model_id"] = model_id
    if check_type:
        query["check_type"] = check_type
    
    checklists = await db.qc_checklists.find(query, {"_id": 0}).sort("check_priority", 1).to_list(1000)
    return [serialize_doc(c) for c in checklists]

@router.post("/qc-checklists")
async def create_qc_checklist(data: QCChecklistCreate):
    count = await db.qc_checklists.count_documents({})
    checklist_code = f"QC_{count + 1:04d}"
    
    checklist = {
        "id": str(uuid.uuid4()),
        "checklist_code": checklist_code,
        "name": data.name,
        "description": data.description,
        "check_type": data.check_type,
        "vertical_id": data.vertical_id,
        "model_id": data.model_id,
        "brand_id": data.brand_id,
        "expected_value": data.expected_value,
        "tolerance": data.tolerance,
        "is_mandatory": data.is_mandatory,
        "check_priority": data.check_priority,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc)
    }
    await db.qc_checklists.insert_one(checklist)
    del checklist["_id"]
    return serialize_doc(checklist)

# --- QC Results ---
@router.get("/qc-results")
async def get_qc_results(production_batch_id: Optional[str] = None):
    query = {}
    if production_batch_id:
        query["production_batch_id"] = production_batch_id
    results = await db.qc_results.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(r) for r in results]

@router.post("/qc-results")
async def create_qc_result(data: QCResultCreate):
    count = await db.qc_results.count_documents({})
    result_code = f"QCR_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{count + 1:04d}"
    
    result_status = "PASSED" if data.passed_count == data.sample_size else (
        "FAILED" if data.failed_count == data.sample_size else "CONDITIONAL"
    )
    
    result = {
        "id": str(uuid.uuid4()),
        "result_code": result_code,
        "production_batch_id": data.production_batch_id,
        "checklist_id": data.checklist_id,
        "sample_size": data.sample_size,
        "passed_count": data.passed_count,
        "failed_count": data.failed_count,
        "actual_value": data.actual_value,
        "result_status": result_status,
        "defect_type": data.defect_type,
        "defect_description": data.defect_description,
        "inspector_notes": data.inspector_notes,
        "inspected_at": datetime.now(timezone.utc),
        "inspected_by": "system"
    }
    await db.qc_results.insert_one(result)
    del result["_id"]
    
    # Update batch status to QC_HOLD
    await db.production_batches.update_one(
        {"id": data.production_batch_id, "status": "COMPLETED"},
        {"$set": {"status": "QC_HOLD"}}
    )
    
    return serialize_doc(result)

# --- QC Approvals ---
@router.post("/qc-approvals")
async def create_qc_approval(data: QCApprovalCreate):
    # Check batch exists
    batch = await db.production_batches.find_one({"id": data.production_batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Production batch not found")
    
    approval = {
        "id": str(uuid.uuid4()),
        "production_batch_id": data.production_batch_id,
        "total_inspected": data.total_inspected,
        "total_passed": data.total_passed,
        "total_failed": data.total_failed,
        "overall_status": data.overall_status,
        "approved_quantity": data.approved_quantity,
        "rejection_reason": data.rejection_reason,
        "rework_instructions": data.rework_instructions,
        "approved_at": datetime.now(timezone.utc),
        "approved_by": "system"
    }
    await db.qc_approvals.insert_one(approval)
    del approval["_id"]
    
    # Update batch status
    new_status = "QC_PASSED" if data.overall_status == "APPROVED" else "QC_FAILED"
    await db.production_batches.update_one(
        {"id": data.production_batch_id},
        {"$set": {"status": new_status, "good_quantity": data.approved_quantity, "rejected_quantity": data.total_failed}}
    )
    
    # If approved, add to FG inventory
    if data.overall_status == "APPROVED" and data.approved_quantity > 0:
        # Atomic upsert into branch_sku_inventory (prevents duplicates)
        await db.branch_sku_inventory.update_one(
            {"buyer_sku_id": batch.get("sku_id", ""), "branch": batch.get("branch", "")},
            {
                "$inc": {"current_stock": data.approved_quantity},
                "$set": {"is_active": True},
                "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    return serialize_doc(approval)
