"""
Inventory Management Routes
- View and bulk import RM and Finished Goods inventory
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from database import db
from datetime import datetime, timezone
from typing import Optional
import io
import uuid
import re

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
except ImportError:
    openpyxl = None

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ============ RM INVENTORY ============

@router.get("/rm")
async def get_rm_inventory(
    branch_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get RM inventory with filters"""
    query = {}
    
    if branch_id:
        query["branch_id"] = branch_id
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"rm_id": {"$regex": search, "$options": "i"}},
            {"rm_name": {"$regex": search, "$options": "i"}}
        ]
    
    # Get inventory records
    cursor = db.rm_inventory.find(query, {"_id": 0}).skip(skip).limit(limit).sort("rm_id", 1)
    items = await cursor.to_list(limit)
    
    # Get total count
    total = await db.rm_inventory.count_documents(query)
    
    # Enrich with RM details if not present
    for item in items:
        if not item.get("rm_name"):
            rm = await db.raw_materials.find_one({"rm_id": item["rm_id"]}, {"_id": 0, "name": 1, "category": 1})
            if rm:
                item["rm_name"] = rm.get("name", "")
                item["category"] = rm.get("category", "")
    
    return {"items": items, "total": total}


@router.get("/rm/template")
async def download_rm_inventory_template():
    """Download Excel template for RM inventory import"""
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RM Inventory"
    
    # Headers
    headers = ["RM_ID", "BRANCH_ID", "QUANTITY", "UNIT"]
    header_fill = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 15
    
    # Get sample data
    branches = await db.branches.find({"is_active": True}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    rms = await db.raw_materials.find({}, {"_id": 0, "rm_id": 1, "default_unit": 1}).to_list(10)
    
    # Generate branch_id if missing
    for idx, b in enumerate(branches, 1):
        if not b.get("branch_id"):
            b["branch_id"] = f"BR_{idx:03d}"
    
    # Add sample rows
    sample_branch = branches[0].get("branch_id", "BR_001") if branches else "BR_001"
    for i, rm in enumerate(rms[:5], 2):
        ws.cell(row=i, column=1, value=rm.get("rm_id", ""))
        ws.cell(row=i, column=2, value=sample_branch)
        ws.cell(row=i, column=3, value=100)
        ws.cell(row=i, column=4, value=rm.get("default_unit", "PCS"))
    
    # Branches Reference sheet
    ws_branches = wb.create_sheet("Branches Reference")
    ws_branches.cell(row=1, column=1, value="Branch ID")
    ws_branches.cell(row=1, column=2, value="Branch Name")
    ws_branches["A1"].font = Font(bold=True)
    ws_branches["B1"].font = Font(bold=True)
    for i, b in enumerate(branches, 2):
        ws_branches.cell(row=i, column=1, value=b.get("branch_id", ""))
        ws_branches.cell(row=i, column=2, value=b.get("name", ""))
    ws_branches.column_dimensions["A"].width = 12
    ws_branches.column_dimensions["B"].width = 25
    
    # RM Reference sheet
    ws_rm = wb.create_sheet("RM Reference")
    ws_rm.cell(row=1, column=1, value="RM ID")
    ws_rm.cell(row=1, column=2, value="RM Name")
    ws_rm.cell(row=1, column=3, value="Category")
    ws_rm.cell(row=1, column=4, value="Default Unit")
    ws_rm["A1"].font = Font(bold=True)
    ws_rm["B1"].font = Font(bold=True)
    ws_rm["C1"].font = Font(bold=True)
    ws_rm["D1"].font = Font(bold=True)
    
    all_rms = await db.raw_materials.find({}, {"_id": 0, "rm_id": 1, "name": 1, "category": 1, "default_unit": 1}).to_list(1000)
    for i, rm in enumerate(all_rms, 2):
        ws_rm.cell(row=i, column=1, value=rm.get("rm_id", ""))
        ws_rm.cell(row=i, column=2, value=rm.get("name", ""))
        ws_rm.cell(row=i, column=3, value=rm.get("category", ""))
        ws_rm.cell(row=i, column=4, value=rm.get("default_unit", "PCS"))
    ws_rm.column_dimensions["A"].width = 15
    ws_rm.column_dimensions["B"].width = 30
    ws_rm.column_dimensions["C"].width = 15
    ws_rm.column_dimensions["D"].width = 12
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=rm_inventory_template.xlsx"}
    )


@router.post("/rm/bulk-import")
async def bulk_import_rm_inventory(
    file: UploadFile = File(...),
    mode: str = Query("add", description="Import mode: 'add' to add to existing, 'replace' to replace stock")
):
    """
    Bulk import RM inventory from Excel.
    
    Mode:
    - 'add': Add uploaded quantities to existing stock
    - 'replace': Replace existing stock with uploaded quantities
    """
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
    
    ws = wb.active
    
    results = {
        "processed": 0,
        "added": 0,
        "updated": 0,
        "errors": [],
        "mode": mode,
        "success": True
    }
    
    # Build branch lookup (branch_id -> branch_id, also support name -> branch_id)
    branches = await db.branches.find({"is_active": True}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    branch_lookup = {}
    for idx, b in enumerate(branches, 1):
        bid = b.get("branch_id") or f"BR_{idx:03d}"
        branch_lookup[bid] = bid
        branch_lookup[bid.lower()] = bid
        branch_lookup[b["name"]] = bid
        branch_lookup[b["name"].lower()] = bid
    
    # Process rows
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0]:
            continue
        
        try:
            rm_id = str(row[0]).strip()
            branch_value = str(row[1]).strip() if row[1] else None
            quantity = float(row[2]) if row[2] else 0
            unit = str(row[3]).strip() if row[3] else "PCS"
            
            if not branch_value:
                results["errors"].append(f"Row {row_idx}: BRANCH_ID is required")
                continue
            
            # Resolve branch
            branch_id = branch_lookup.get(branch_value) or branch_lookup.get(branch_value.lower())
            if not branch_id:
                results["errors"].append(f"Row {row_idx}: Invalid branch '{branch_value}'")
                continue
            
            # Verify RM exists
            rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0, "rm_id": 1, "name": 1, "category": 1})
            if not rm:
                # Case-insensitive search
                rm = await db.raw_materials.find_one(
                    {"rm_id": {"$regex": f"^{re.escape(rm_id)}$", "$options": "i"}},
                    {"_id": 0, "rm_id": 1, "name": 1, "category": 1}
                )
            if not rm:
                results["errors"].append(f"Row {row_idx}: RM '{rm_id}' not found")
                continue
            
            actual_rm_id = rm.get("rm_id", rm_id)
            
            # Check existing inventory
            existing = await db.rm_inventory.find_one({
                "rm_id": actual_rm_id,
                "branch_id": branch_id
            })
            
            if mode == "replace":
                new_quantity = quantity
            else:  # add
                new_quantity = (existing.get("quantity", 0) if existing else 0) + quantity
            
            if existing:
                await db.rm_inventory.update_one(
                    {"rm_id": actual_rm_id, "branch_id": branch_id},
                    {"$set": {
                        "quantity": new_quantity,
                        "unit": unit,
                        "rm_name": rm.get("name", ""),
                        "category": rm.get("category", ""),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                results["updated"] += 1
            else:
                await db.rm_inventory.insert_one({
                    "id": str(uuid.uuid4()),
                    "rm_id": actual_rm_id,
                    "rm_name": rm.get("name", ""),
                    "category": rm.get("category", ""),
                    "branch_id": branch_id,
                    "quantity": new_quantity,
                    "unit": unit,
                    "created_at": datetime.now(timezone.utc)
                })
                results["added"] += 1
            
            results["processed"] += 1
            
        except Exception as e:
            results["errors"].append(f"Row {row_idx}: {str(e)}")
    
    if results["errors"] and results["processed"] == 0:
        results["success"] = False
    
    return results


# ============ FINISHED GOODS INVENTORY ============

@router.get("/fg")
async def get_fg_inventory(
    branch_id: Optional[str] = None,
    model_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get Finished Goods inventory with filters"""
    query = {}
    
    if branch_id:
        query["branch_id"] = branch_id
    if model_id:
        query["model_id"] = model_id
    if search:
        query["$or"] = [
            {"buyer_sku_id": {"$regex": search, "$options": "i"}},
            {"sku_name": {"$regex": search, "$options": "i"}}
        ]
    
    # Get inventory records
    cursor = db.fg_inventory.find(query, {"_id": 0}).skip(skip).limit(limit).sort("buyer_sku_id", 1)
    items = await cursor.to_list(limit)
    
    # Get total count
    total = await db.fg_inventory.count_documents(query)
    
    # Enrich with SKU details if not present
    for item in items:
        if not item.get("sku_name"):
            sku = await db.buyer_skus.find_one({"buyer_sku_id": item["buyer_sku_id"]}, {"_id": 0, "name": 1, "model_id": 1})
            if sku:
                item["sku_name"] = sku.get("name", "")
                item["model_id"] = sku.get("model_id", "")
    
    return {"items": items, "total": total}


@router.get("/fg/template")
async def download_fg_inventory_template():
    """Download Excel template for FG inventory import"""
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "FG Inventory"
    
    # Headers
    headers = ["BUYER_SKU_ID", "BRANCH_ID", "QUANTITY"]
    header_fill = PatternFill(start_color="2196F3", end_color="2196F3", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 20
    
    # Get sample data
    branches = await db.branches.find({"is_active": True}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    skus = await db.buyer_skus.find({"status": "ACTIVE"}, {"_id": 0, "buyer_sku_id": 1}).to_list(10)
    
    # Generate branch_id if missing
    for idx, b in enumerate(branches, 1):
        if not b.get("branch_id"):
            b["branch_id"] = f"BR_{idx:03d}"
    
    # Add sample rows
    sample_branch = branches[0].get("branch_id", "BR_001") if branches else "BR_001"
    for i, sku in enumerate(skus[:5], 2):
        ws.cell(row=i, column=1, value=sku.get("buyer_sku_id", ""))
        ws.cell(row=i, column=2, value=sample_branch)
        ws.cell(row=i, column=3, value=50)
    
    # Branches Reference sheet
    ws_branches = wb.create_sheet("Branches Reference")
    ws_branches.cell(row=1, column=1, value="Branch ID")
    ws_branches.cell(row=1, column=2, value="Branch Name")
    ws_branches["A1"].font = Font(bold=True)
    ws_branches["B1"].font = Font(bold=True)
    for i, b in enumerate(branches, 2):
        ws_branches.cell(row=i, column=1, value=b.get("branch_id", ""))
        ws_branches.cell(row=i, column=2, value=b.get("name", ""))
    ws_branches.column_dimensions["A"].width = 12
    ws_branches.column_dimensions["B"].width = 25
    
    # SKU Reference sheet
    ws_sku = wb.create_sheet("Buyer SKU Reference")
    ws_sku.cell(row=1, column=1, value="Buyer SKU ID")
    ws_sku.cell(row=1, column=2, value="SKU Name")
    ws_sku.cell(row=1, column=3, value="Brand")
    ws_sku["A1"].font = Font(bold=True)
    ws_sku["B1"].font = Font(bold=True)
    ws_sku["C1"].font = Font(bold=True)
    
    all_skus = await db.buyer_skus.find(
        {"status": "ACTIVE"}, 
        {"_id": 0, "buyer_sku_id": 1, "name": 1, "brand_code": 1}
    ).to_list(2000)
    for i, sku in enumerate(all_skus, 2):
        ws_sku.cell(row=i, column=1, value=sku.get("buyer_sku_id", ""))
        ws_sku.cell(row=i, column=2, value=sku.get("name", ""))
        ws_sku.cell(row=i, column=3, value=sku.get("brand_code", ""))
    ws_sku.column_dimensions["A"].width = 20
    ws_sku.column_dimensions["B"].width = 40
    ws_sku.column_dimensions["C"].width = 15
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=fg_inventory_template.xlsx"}
    )


@router.post("/fg/bulk-import")
async def bulk_import_fg_inventory(
    file: UploadFile = File(...),
    mode: str = Query("add", description="Import mode: 'add' to add to existing, 'replace' to replace stock")
):
    """
    Bulk import Finished Goods inventory from Excel.
    
    Mode:
    - 'add': Add uploaded quantities to existing stock
    - 'replace': Replace existing stock with uploaded quantities
    """
    if not openpyxl:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
    
    ws = wb.active
    
    results = {
        "processed": 0,
        "added": 0,
        "updated": 0,
        "errors": [],
        "mode": mode,
        "success": True
    }
    
    # Build branch lookup
    branches = await db.branches.find({"is_active": True}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    branch_lookup = {}
    for idx, b in enumerate(branches, 1):
        bid = b.get("branch_id") or f"BR_{idx:03d}"
        branch_lookup[bid] = bid
        branch_lookup[bid.lower()] = bid
        branch_lookup[b["name"]] = bid
        branch_lookup[b["name"].lower()] = bid
    
    # Process rows
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row[0]:
            continue
        
        try:
            buyer_sku_id = str(row[0]).strip()
            branch_value = str(row[1]).strip() if row[1] else None
            quantity = float(row[2]) if row[2] else 0
            
            if not branch_value:
                results["errors"].append(f"Row {row_idx}: BRANCH_ID is required")
                continue
            
            # Resolve branch
            branch_id = branch_lookup.get(branch_value) or branch_lookup.get(branch_value.lower())
            if not branch_id:
                results["errors"].append(f"Row {row_idx}: Invalid branch '{branch_value}'")
                continue
            
            # Verify SKU exists
            sku = await db.buyer_skus.find_one({"buyer_sku_id": buyer_sku_id}, {"_id": 0, "buyer_sku_id": 1, "name": 1, "model_id": 1})
            if not sku:
                # Case-insensitive search
                sku = await db.buyer_skus.find_one(
                    {"buyer_sku_id": {"$regex": f"^{re.escape(buyer_sku_id)}$", "$options": "i"}},
                    {"_id": 0, "buyer_sku_id": 1, "name": 1, "model_id": 1}
                )
            if not sku:
                results["errors"].append(f"Row {row_idx}: Buyer SKU '{buyer_sku_id}' not found")
                continue
            
            actual_sku_id = sku.get("buyer_sku_id", buyer_sku_id)
            
            # Check existing inventory
            existing = await db.fg_inventory.find_one({
                "buyer_sku_id": actual_sku_id,
                "branch_id": branch_id
            })
            
            if mode == "replace":
                new_quantity = quantity
            else:  # add
                new_quantity = (existing.get("quantity", 0) if existing else 0) + quantity
            
            if existing:
                await db.fg_inventory.update_one(
                    {"buyer_sku_id": actual_sku_id, "branch_id": branch_id},
                    {"$set": {
                        "quantity": new_quantity,
                        "sku_name": sku.get("name", ""),
                        "model_id": sku.get("model_id", ""),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                results["updated"] += 1
            else:
                await db.fg_inventory.insert_one({
                    "id": str(uuid.uuid4()),
                    "buyer_sku_id": actual_sku_id,
                    "sku_name": sku.get("name", ""),
                    "model_id": sku.get("model_id", ""),
                    "branch_id": branch_id,
                    "quantity": new_quantity,
                    "created_at": datetime.now(timezone.utc)
                })
                results["added"] += 1
            
            results["processed"] += 1
            
        except Exception as e:
            results["errors"].append(f"Row {row_idx}: {str(e)}")
    
    if results["errors"] and results["processed"] == 0:
        results["success"] = False
    
    return results


# ============ SUMMARY STATS ============

@router.get("/summary")
async def get_inventory_summary():
    """Get inventory summary stats"""
    rm_total = await db.rm_inventory.count_documents({})
    fg_total = await db.fg_inventory.count_documents({})
    
    # Get unique RMs and SKUs in inventory
    rm_unique = len(await db.rm_inventory.distinct("rm_id"))
    fg_unique = len(await db.fg_inventory.distinct("buyer_sku_id"))
    
    # Get branch count
    branches_with_rm = len(await db.rm_inventory.distinct("branch_id"))
    branches_with_fg = len(await db.fg_inventory.distinct("branch_id"))
    
    return {
        "rm": {
            "total_records": rm_total,
            "unique_items": rm_unique,
            "branches": branches_with_rm
        },
        "fg": {
            "total_records": fg_total,
            "unique_items": fg_unique,
            "branches": branches_with_fg
        }
    }


# ============ FILTERS DATA ============

@router.get("/filters")
async def get_inventory_filters():
    """Get filter options for inventory pages"""
    # Branches
    branches = await db.branches.find({"is_active": True}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    for idx, b in enumerate(branches, 1):
        if not b.get("branch_id"):
            b["branch_id"] = f"BR_{idx:03d}"
    
    # RM Categories
    categories = await db.raw_materials.distinct("category")
    
    # Models
    models = await db.models.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    
    return {
        "branches": branches,
        "categories": [c for c in categories if c],
        "models": models
    }
