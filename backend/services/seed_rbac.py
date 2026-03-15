"""
RBAC Seed Script - Populate roles, permissions, and constraints
Run this during application startup or via CLI
"""
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# ============ ROLE DEFINITIONS ============
ROLES = [
    {
        "code": "MASTER_ADMIN",
        "name": "Master Administrator",
        "description": "Full system access - can perform all operations",
        "is_system_role": True
    },
    {
        "code": "DEMAND_PLANNER",
        "name": "Demand Planner",
        "description": "Manages forecasts, dispatch lots, and early SKU lifecycle"
    },
    {
        "code": "TECH_OPS_ENGINEER",
        "name": "Tech Ops Engineer",
        "description": "Manages master data, BOMs, and technical configurations"
    },
    {
        "code": "CPC_PLANNER",
        "name": "CPC Planner",
        "description": "Central Production Control planning and scheduling"
    },
    {
        "code": "PROCUREMENT_OFFICER",
        "name": "Procurement Officer",
        "description": "Vendor management and purchase orders"
    },
    {
        "code": "BRANCH_OPS_USER",
        "name": "Branch Operations User",
        "description": "Branch-level production and stock operations"
    },
    {
        "code": "QUALITY_INSPECTOR",
        "name": "Quality Inspector",
        "description": "QC checklists, inspections, and approvals"
    },
    {
        "code": "LOGISTICS_COORDINATOR",
        "name": "Logistics Coordinator",
        "description": "Dispatch, IBT, and invoice management"
    },
    {
        "code": "FINANCE_VIEWER",
        "name": "Finance Viewer",
        "description": "Read-only access to financial data"
    },
    {
        "code": "AUDITOR_READONLY",
        "name": "Auditor (Read-Only)",
        "description": "Global read-only access for audit purposes"
    }
]

# ============ PERMISSION DEFINITIONS ============
# Format: entity, action, roles (list of role codes or "*" for all)
PERMISSIONS = [
    # ============ MASTER DATA ENTITIES ============
    # RawMaterial
    {"entity": "RawMaterial", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "RawMaterial", "action": "READ", "roles": ["*"]},
    {"entity": "RawMaterial", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "RawMaterial", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # BuyerSKU
    {"entity": "BuyerSKU", "action": "CREATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "BuyerSKU", "action": "READ", "roles": ["*"]},
    {"entity": "BuyerSKU", "action": "UPDATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER", "TECH_OPS_ENGINEER"]},
    {"entity": "BuyerSKU", "action": "DELETE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    
    # Vendor
    {"entity": "Vendor", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "Vendor", "action": "READ", "roles": ["*"]},
    {"entity": "Vendor", "action": "UPDATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "Vendor", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Vertical
    {"entity": "Vertical", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Vertical", "action": "READ", "roles": ["*"]},
    {"entity": "Vertical", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Vertical", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Model
    {"entity": "Model", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Model", "action": "READ", "roles": ["*"]},
    {"entity": "Model", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Model", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Brand
    {"entity": "Brand", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Brand", "action": "READ", "roles": ["*"]},
    {"entity": "Brand", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Brand", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Buyer
    {"entity": "Buyer", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Buyer", "action": "READ", "roles": ["*"]},
    {"entity": "Buyer", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "Buyer", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Branch
    {"entity": "Branch", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Branch", "action": "READ", "roles": ["*"]},
    {"entity": "Branch", "action": "UPDATE", "roles": ["MASTER_ADMIN", "CPC_PLANNER"]},
    {"entity": "Branch", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # BOM (Bill of Materials)
    {"entity": "BOM", "action": "CREATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "BOM", "action": "READ", "roles": ["*"]},
    {"entity": "BOM", "action": "UPDATE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    {"entity": "BOM", "action": "DELETE", "roles": ["MASTER_ADMIN", "TECH_OPS_ENGINEER"]},
    
    # QCChecklist
    {"entity": "QCChecklist", "action": "CREATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCChecklist", "action": "READ", "roles": ["*"]},
    {"entity": "QCChecklist", "action": "UPDATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCChecklist", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # ============ PLANNING ENTITIES ============
    # Forecast
    {"entity": "Forecast", "action": "CREATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "Forecast", "action": "READ", "roles": ["*"]},
    {"entity": "Forecast", "action": "UPDATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "Forecast", "action": "DELETE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    
    # DispatchLot
    {"entity": "DispatchLot", "action": "CREATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "DispatchLot", "action": "READ", "roles": ["*"]},
    {"entity": "DispatchLot", "action": "UPDATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "DispatchLot", "action": "DELETE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    
    # ProductionPlan
    {"entity": "ProductionPlan", "action": "CREATE", "roles": ["MASTER_ADMIN", "CPC_PLANNER"]},
    {"entity": "ProductionPlan", "action": "READ", "roles": ["*"]},
    {"entity": "ProductionPlan", "action": "UPDATE", "roles": ["MASTER_ADMIN", "CPC_PLANNER"]},
    {"entity": "ProductionPlan", "action": "DELETE", "roles": ["MASTER_ADMIN", "CPC_PLANNER"]},
    
    # ============ EXECUTION ENTITIES ============
    # ProductionBatch
    {"entity": "ProductionBatch", "action": "CREATE", "roles": ["MASTER_ADMIN", "BRANCH_OPS_USER"]},
    {"entity": "ProductionBatch", "action": "READ", "roles": ["*"]},
    {"entity": "ProductionBatch", "action": "UPDATE", "roles": ["MASTER_ADMIN", "BRANCH_OPS_USER", "QUALITY_INSPECTOR"]},
    {"entity": "ProductionBatch", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # RMStockMovement (append-only for most)
    {"entity": "RMStockMovement", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER", "BRANCH_OPS_USER"]},
    {"entity": "RMStockMovement", "action": "READ", "roles": ["*"]},
    {"entity": "RMStockMovement", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "RMStockMovement", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # FGInventory
    {"entity": "FGInventory", "action": "CREATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "FGInventory", "action": "READ", "roles": ["*"]},
    {"entity": "FGInventory", "action": "UPDATE", "roles": ["MASTER_ADMIN", "BRANCH_OPS_USER", "QUALITY_INSPECTOR", "LOGISTICS_COORDINATOR"]},
    {"entity": "FGInventory", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # IBTTransfer
    {"entity": "IBTTransfer", "action": "CREATE", "roles": ["MASTER_ADMIN", "BRANCH_OPS_USER"]},
    {"entity": "IBTTransfer", "action": "READ", "roles": ["*"]},
    {"entity": "IBTTransfer", "action": "UPDATE", "roles": ["MASTER_ADMIN", "BRANCH_OPS_USER", "LOGISTICS_COORDINATOR"]},
    {"entity": "IBTTransfer", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # ============ PROCUREMENT ENTITIES ============
    # PurchaseOrder
    {"entity": "PurchaseOrder", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrder", "action": "READ", "roles": ["*"]},
    {"entity": "PurchaseOrder", "action": "UPDATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrder", "action": "DELETE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    
    # PurchaseOrderLine
    {"entity": "PurchaseOrderLine", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrderLine", "action": "READ", "roles": ["*"]},
    {"entity": "PurchaseOrderLine", "action": "UPDATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrderLine", "action": "DELETE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    
    # VendorRMPrice
    {"entity": "VendorRMPrice", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "VendorRMPrice", "action": "READ", "roles": ["*"]},
    {"entity": "VendorRMPrice", "action": "UPDATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "VendorRMPrice", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # PriceHistory
    {"entity": "PriceHistory", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PriceHistory", "action": "READ", "roles": ["*"]},
    {"entity": "PriceHistory", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "PriceHistory", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Invoice
    {"entity": "Invoice", "action": "CREATE", "roles": ["MASTER_ADMIN", "LOGISTICS_COORDINATOR"]},
    {"entity": "Invoice", "action": "READ", "roles": ["*"]},
    {"entity": "Invoice", "action": "UPDATE", "roles": ["MASTER_ADMIN", "LOGISTICS_COORDINATOR"]},
    {"entity": "Invoice", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # ============ QUALITY ENTITIES ============
    # QCResult
    {"entity": "QCResult", "action": "CREATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCResult", "action": "READ", "roles": ["*"]},
    {"entity": "QCResult", "action": "UPDATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCResult", "action": "DELETE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    
    # QCApproval
    {"entity": "QCApproval", "action": "CREATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCApproval", "action": "READ", "roles": ["*"]},
    {"entity": "QCApproval", "action": "UPDATE", "roles": ["MASTER_ADMIN", "QUALITY_INSPECTOR"]},
    {"entity": "QCApproval", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # ============ LOGISTICS ENTITIES ============
    # Dispatch
    {"entity": "Dispatch", "action": "CREATE", "roles": ["MASTER_ADMIN", "LOGISTICS_COORDINATOR"]},
    {"entity": "Dispatch", "action": "READ", "roles": ["*"]},
    {"entity": "Dispatch", "action": "UPDATE", "roles": ["MASTER_ADMIN", "LOGISTICS_COORDINATOR"]},
    {"entity": "Dispatch", "action": "DELETE", "roles": ["MASTER_ADMIN", "LOGISTICS_COORDINATOR"]},
    
    # ============ SYSTEM ENTITIES ============
    # User
    {"entity": "User", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "User", "action": "READ", "roles": ["MASTER_ADMIN", "FINANCE_VIEWER", "AUDITOR_READONLY"]},
    {"entity": "User", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "User", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Role
    {"entity": "Role", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Role", "action": "READ", "roles": ["MASTER_ADMIN", "FINANCE_VIEWER", "AUDITOR_READONLY"]},
    {"entity": "Role", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Role", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # SystemConfig
    {"entity": "SystemConfig", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "SystemConfig", "action": "READ", "roles": ["MASTER_ADMIN", "AUDITOR_READONLY"]},
    {"entity": "SystemConfig", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "SystemConfig", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # AuditLog
    {"entity": "AuditLog", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "AuditLog", "action": "READ", "roles": ["MASTER_ADMIN", "AUDITOR_READONLY"]},
    {"entity": "AuditLog", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "AuditLog", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Events
    {"entity": "Event", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Event", "action": "READ", "roles": ["*"]},
    {"entity": "Event", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Event", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
    
    # Alerts
    {"entity": "Alert", "action": "CREATE", "roles": ["MASTER_ADMIN"]},
    {"entity": "Alert", "action": "READ", "roles": ["*"]},
    {"entity": "Alert", "action": "UPDATE", "roles": ["*"]},
    {"entity": "Alert", "action": "DELETE", "roles": ["MASTER_ADMIN"]},
]

# ============ CONSTRAINT DEFINITIONS ============
CONSTRAINTS = [
    # BuyerSKU constraints
    {
        "entity": "BuyerSKU",
        "action": "DELETE",
        "roles": ["DEMAND_PLANNER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["DRAFT", "BOM_PENDING"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Can only delete SKUs in DRAFT or BOM_PENDING status"
    },
    {
        "entity": "BuyerSKU",
        "action": "DELETE",
        "roles": ["DEMAND_PLANNER"],
        "constraint_type": "REFERENCE_CHECK",
        "config": {
            "type": "REFERENCE_CHECK",
            "blocked_if_referenced_by": ["BOM", "ProductionBatch"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Cannot delete SKU that is referenced by BOM or Production"
    },
    {
        "entity": "BuyerSKU",
        "action": "UPDATE",
        "roles": ["DEMAND_PLANNER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["DRAFT", "BOM_PENDING"],
            "actions_affected": ["UPDATE"]
        },
        "error_message": "DemandPlanner can only update SKUs in DRAFT or BOM_PENDING status"
    },
    
    # PurchaseOrder constraints
    {
        "entity": "PurchaseOrder",
        "action": "DELETE",
        "roles": ["PROCUREMENT_OFFICER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["DRAFT"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Can only delete POs in DRAFT status"
    },
    {
        "entity": "PurchaseOrder",
        "action": "DELETE",
        "roles": ["PROCUREMENT_OFFICER"],
        "constraint_type": "REFERENCE_CHECK",
        "config": {
            "type": "REFERENCE_CHECK",
            "blocked_if_referenced_by": ["RMStockMovement"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Cannot delete PO that has stock movements"
    },
    {
        "entity": "PurchaseOrder",
        "action": "UPDATE",
        "roles": ["PROCUREMENT_OFFICER"],
        "constraint_type": "FIELD_RESTRICTION",
        "config": {
            "type": "FIELD_RESTRICTION",
            "status_trigger": "SENT",
            "editable_fields": ["notes", "expected_delivery_date"]
        },
        "error_message": "After SENT status, only notes and expected_delivery_date can be updated"
    },
    
    # Forecast constraints
    {
        "entity": "Forecast",
        "action": "DELETE",
        "roles": ["DEMAND_PLANNER"],
        "constraint_type": "REFERENCE_CHECK",
        "config": {
            "type": "REFERENCE_CHECK",
            "blocked_if_referenced_by": ["DispatchLot", "ProductionPlan"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Cannot delete forecast that has dispatch lots or production plans"
    },
    
    # DispatchLot constraints
    {
        "entity": "DispatchLot",
        "action": "UPDATE",
        "roles": ["DEMAND_PLANNER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["CREATED"],
            "actions_affected": ["UPDATE", "DELETE"]
        },
        "error_message": "Can only modify dispatch lots in CREATED status"
    },
    
    # ProductionPlan constraints
    {
        "entity": "ProductionPlan",
        "action": "DELETE",
        "roles": ["CPC_PLANNER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["PLANNED"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Can only delete production plans in PLANNED status"
    },
    {
        "entity": "ProductionPlan",
        "action": "DELETE",
        "roles": ["CPC_PLANNER"],
        "constraint_type": "REFERENCE_CHECK",
        "config": {
            "type": "REFERENCE_CHECK",
            "blocked_if_referenced_by": ["ProductionBatch"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Cannot delete production plan with associated batches"
    },
    
    # ProductionBatch constraints
    {
        "entity": "ProductionBatch",
        "action": "UPDATE",
        "roles": ["BRANCH_OPS_USER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["PLANNED", "IN_PROGRESS", "QC_HOLD"],
            "actions_affected": ["UPDATE"]
        },
        "error_message": "BranchOps can only update batches up to QC_HOLD status"
    },
    {
        "entity": "ProductionBatch",
        "action": "UPDATE",
        "roles": ["QUALITY_INSPECTOR"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["QC_HOLD"],
            "actions_affected": ["UPDATE"]
        },
        "error_message": "QualityInspector can only update batches in QC_HOLD status"
    },
    
    # RMStockMovement constraints
    {
        "entity": "RMStockMovement",
        "action": "CREATE",
        "roles": ["PROCUREMENT_OFFICER"],
        "constraint_type": "MOVEMENT_TYPE_CHECK",
        "config": {
            "type": "MOVEMENT_TYPE_CHECK",
            "allowed_types": ["INWARD"],
            "actions_affected": ["CREATE"]
        },
        "error_message": "Procurement can only create INWARD movements"
    },
    {
        "entity": "RMStockMovement",
        "action": "CREATE",
        "roles": ["BRANCH_OPS_USER"],
        "constraint_type": "MOVEMENT_TYPE_CHECK",
        "config": {
            "type": "MOVEMENT_TYPE_CHECK",
            "allowed_types": ["INWARD", "CONSUMPTION", "PRODUCTION", "TRANSFER_OUT"],
            "actions_affected": ["CREATE"]
        },
        "error_message": "BranchOps can only create INWARD, CONSUMPTION, PRODUCTION, or TRANSFER_OUT movements"
    },
    
    # IBTTransfer constraints
    {
        "entity": "IBTTransfer",
        "action": "UPDATE",
        "roles": ["BRANCH_OPS_USER"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["INITIATED"],
            "actions_affected": ["UPDATE"]
        },
        "error_message": "BranchOps can only update IBT in INITIATED status"
    },
    {
        "entity": "IBTTransfer",
        "action": "UPDATE",
        "roles": ["LOGISTICS_COORDINATOR"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["INITIATED", "APPROVED", "IN_TRANSIT"],
            "actions_affected": ["UPDATE"]
        },
        "error_message": "Logistics can update IBT in INITIATED, APPROVED, or IN_TRANSIT status"
    },
    
    # Dispatch constraints
    {
        "entity": "Dispatch",
        "action": "DELETE",
        "roles": ["LOGISTICS_COORDINATOR"],
        "constraint_type": "STATUS_CHECK",
        "config": {
            "type": "STATUS_CHECK",
            "allowed_statuses": ["PENDING"],
            "actions_affected": ["DELETE"]
        },
        "error_message": "Can only delete dispatches in PENDING status"
    },
    
    # QCResult constraints
    {
        "entity": "QCResult",
        "action": "UPDATE",
        "roles": ["QUALITY_INSPECTOR"],
        "constraint_type": "TIME_WINDOW",
        "config": {
            "type": "TIME_WINDOW",
            "hours": 24,
            "actions_affected": ["UPDATE", "DELETE"]
        },
        "error_message": "QC results can only be edited within 24 hours of creation"
    },
    
    # Vendor constraints (soft delete only)
    {
        "entity": "Vendor",
        "action": "DELETE",
        "roles": ["PROCUREMENT_OFFICER"],
        "constraint_type": "SOFT_DELETE_ONLY",
        "config": {
            "type": "SOFT_DELETE_ONLY",
            "actions_affected": ["DELETE"]
        },
        "error_message": "Procurement can only soft-delete (deactivate) vendors"
    },
    
    # RawMaterial constraints (soft delete only for tech ops)
    {
        "entity": "RawMaterial",
        "action": "DELETE",
        "roles": ["TECH_OPS_ENGINEER"],
        "constraint_type": "SOFT_DELETE_ONLY",
        "config": {
            "type": "SOFT_DELETE_ONLY",
            "actions_affected": ["DELETE"]
        },
        "error_message": "TechOps can only soft-delete (deactivate) raw materials"
    },
]


async def seed_rbac(db):
    """
    Seed RBAC data into database
    Call this during application startup
    """
    logger.info("Starting RBAC seeding...")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # ============ SEED ROLES ============
    role_id_map = {}  # code -> id
    
    for role_data in ROLES:
        existing = await db.roles.find_one({"code": role_data["code"]}, {"_id": 0})
        if existing:
            role_id_map[role_data["code"]] = existing["id"]
            logger.debug(f"Role exists: {role_data['code']}")
        else:
            role_id = str(uuid.uuid4())
            role_id_map[role_data["code"]] = role_id
            await db.roles.insert_one({
                "id": role_id,
                **role_data,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            })
            logger.info(f"Created role: {role_data['code']}")
    
    # ============ SEED PERMISSIONS AND ROLE_PERMISSIONS ============
    perm_id_map = {}  # (entity, action) -> id
    
    for perm_data in PERMISSIONS:
        entity = perm_data["entity"]
        action = perm_data["action"]
        key = (entity, action)
        
        existing_perm = await db.permissions.find_one(
            {"entity": entity, "action": action},
            {"_id": 0}
        )
        
        if existing_perm:
            perm_id = existing_perm["id"]
        else:
            perm_id = str(uuid.uuid4())
            await db.permissions.insert_one({
                "id": perm_id,
                "entity": entity,
                "action": action,
                "scope": "ALL",
                "created_at": now
            })
            logger.debug(f"Created permission: {entity}.{action}")
        
        perm_id_map[key] = perm_id
        
        # Link to roles
        roles = perm_data["roles"]
        if "*" in roles:
            roles = [r["code"] for r in ROLES]
        
        for role_code in roles:
            role_id = role_id_map.get(role_code)
            if not role_id:
                continue
            
            # Check if link already exists
            existing_link = await db.role_permissions.find_one({
                "role_id": role_id,
                "permission_id": perm_id
            })
            
            if not existing_link:
                await db.role_permissions.insert_one({
                    "id": str(uuid.uuid4()),
                    "role_id": role_id,
                    "permission_id": perm_id,
                    "is_active": True,
                    "granted_at": now
                })
    
    # ============ SEED CONSTRAINTS ============
    for constraint_data in CONSTRAINTS:
        entity = constraint_data["entity"]
        action = constraint_data["action"]
        perm_key = (entity, action)
        perm_id = perm_id_map.get(perm_key)
        
        if not perm_id:
            continue
        
        # Check if constraint exists
        existing = await db.permission_constraints.find_one({
            "permission_id": perm_id,
            "constraint_type": constraint_data["constraint_type"]
        })
        
        if not existing:
            await db.permission_constraints.insert_one({
                "id": str(uuid.uuid4()),
                "permission_id": perm_id,
                "constraint_type": constraint_data["constraint_type"],
                "constraint_config": constraint_data["config"],
                "error_message": constraint_data.get("error_message"),
                "created_at": now
            })
            logger.debug(f"Created constraint: {entity}.{action}.{constraint_data['constraint_type']}")
    
    # ============ MIGRATE EXISTING USERS ============
    # Only migrate users who don't have ANY RBAC roles yet
    # Map legacy roles to new roles
    legacy_mapping = {
        "master_admin": "MASTER_ADMIN",
        "branch_user": "BRANCH_OPS_USER"
    }
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for user in users:
        user_id = user.get("id")
        legacy_role = user.get("role", "")
        
        if not legacy_role or not user_id:
            continue
        
        # Check if user already has ANY RBAC roles assigned
        existing_roles = await db.user_roles.find({"user_id": user_id}).to_list(10)
        if existing_roles:
            # User already has RBAC roles, skip migration
            continue
        
        new_role_code = legacy_mapping.get(legacy_role)
        if not new_role_code:
            continue
        
        role_id = role_id_map.get(new_role_code)
        if not role_id:
            continue
        
        await db.user_roles.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "role_id": role_id,
            "is_primary": True,
            "granted_at": now
        })
        logger.info(f"Migrated user {user.get('email')} to role {new_role_code}")
    
    logger.info("RBAC seeding complete!")
    
    # Return role map for reference
    return role_id_map


async def get_role_id_by_code(db, code: str) -> str:
    """Get role ID by code"""
    role = await db.roles.find_one({"code": code}, {"_id": 0})
    return role["id"] if role else None


async def assign_role_to_user(db, user_id: str, role_code: str, granted_by: str = None):
    """Assign a role to a user"""
    role = await db.roles.find_one({"code": role_code}, {"_id": 0})
    if not role:
        raise ValueError(f"Role not found: {role_code}")
    
    existing = await db.user_roles.find_one({
        "user_id": user_id,
        "role_id": role["id"]
    })
    
    if existing:
        return existing
    
    user_role = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role_id": role["id"],
        "is_primary": False,
        "granted_by": granted_by,
        "granted_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_roles.insert_one(user_role)
    return user_role
