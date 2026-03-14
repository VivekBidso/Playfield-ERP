# RBAC Specification - Integrated Manufacturing & Operations Suite

## 1. NORMALIZED RBAC MODEL

### 1.1 Role Hierarchy Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLE HIERARCHY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌──────────────┐                                    │
│                          │ MasterAdmin  │ (Super User)                       │
│                          └──────┬───────┘                                    │
│                                 │                                            │
│         ┌───────────────────────┼───────────────────────┐                   │
│         │                       │                       │                   │
│         ▼                       ▼                       ▼                   │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐             │
│  │   Domain    │        │   Domain    │        │   Domain    │             │
│  │   Admins    │        │  Operators  │        │   Viewers   │             │
│  └─────────────┘        └─────────────┘        └─────────────┘             │
│         │                       │                       │                   │
│    ┌────┴────┐            ┌────┴────┐            ┌────┴────┐              │
│    │         │            │         │            │         │              │
│    ▼         ▼            ▼         ▼            ▼         ▼              │
│ TechOps  CPCPlanner  BranchOps  Quality   FinanceViewer  Auditor          │
│ Engineer             User      Inspector                                   │
│                                                                              │
│ DemandPlanner  ProcurementOfficer  LogisticsCoordinator                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Entity Groups & Codes

| Group | Code | Entities |
|-------|------|----------|
| **Master Data** | MD | RawMaterial, BuyerSKU, Vendor, Vertical, Model, Brand, Buyer, Branch, BOM, QCChecklist |
| **Planning** | PL | Forecast, DispatchLot, ProductionPlan |
| **Execution** | EX | ProductionBatch, RMStockMovement, FGInventory, IBTTransfer |
| **Procurement** | PR | PurchaseOrder, PurchaseOrderLine, VendorRMPrice, PriceHistory, Invoice |
| **Quality** | QC | QCResult, QCApproval |
| **Logistics** | LG | Dispatch |
| **System** | SY | User, Role, SystemConfig, AuditLog |

---

## 2. DETAILED PERMISSION MATRIX

### 2.1 Master Data Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **RawMaterial** | CRUD | R | CRU* | R | R | R | R | R | R | R |
| **BuyerSKU** | CRUD | CRU*¹ | RU*² | R | R | R | R | R | R | R |
| **Vendor** | CRUD | R | R | R | CRU* | R | R | R | R | R |
| **Vertical** | CRUD | R | CRU* | R | R | R | R | R | R | R |
| **Model** | CRUD | R | CRU* | R | R | R | R | R | R | R |
| **Brand** | CRUD | R | CRU* | R | R | R | R | R | R | R |
| **Buyer** | CRUD | R | CRU* | R | R | R | R | R | R | R |
| **Branch** | CRUD | R | R | R | R | R | R | R | R | R |
| **BOM** | CRUD | R | CRU*³ | R | R | R | R | R | R | R |
| **QCChecklist** | CRUD | R | R | R | R | R | CRU* | R | R | R |

**Constraints:**
- `*` = Soft-delete only (set status INACTIVE), no hard delete
- `*¹` = DemandPlanner: Only while SKU status is DRAFT/BOM_PENDING and not referenced in BOM/Production
- `*²` = TechOpsEngineer: Update technical attributes only, can set status to BOM_COMPLETE
- `*³` = TechOpsEngineer: Delete only erroneous lines on non-finalized BOM versions

### 2.2 Planning & Demand Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **Forecast** | CRUD | CRU*⁴ | R | R | R | R | R | R | R | R |
| **DispatchLot** | CRUD | CRU*⁵ | R | R | R | R | R | R | R | R |
| **ProductionPlan** | CRUD | R | R | CRU*⁶ | R | R | R | R | R | R |

**Constraints:**
- `*⁴` = Delete only if not converted to DispatchLots/ProductionPlans
- `*⁵` = Full CRUD while status=CREATED and no production assigned; Read-only after
- `*⁶` = Delete only while status=PLANNED and no ProductionBatch created

### 2.3 Execution Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **ProductionBatch** | CRUD | R | R | R | R | CRU*⁷ | R | R | R | R |
| **RMStockMovement** | CRU*⁸ | R | R | R | CR*⁹ | CR*¹⁰ | R | R | R | R |
| **FGInventory** | CRUD | R | R | R | R | R*¹¹ | CRU*¹² | RU*¹³ | R | R |
| **IBTTransfer** | CRUD | R | R | R | R | CRU*¹⁴ | R | RU*¹⁵ | R | R |

**Constraints:**
- `*⁷` = BranchOps: Create batches from ProductionPlans, update status (PLANNED→IN_PROGRESS→COMPLETED), cannot change QC statuses
- `*⁸` = MasterAdmin: Override for exceptional corrections (normally append-only)
- `*⁹` = Procurement: Create INWARD movements for goods receipts only
- `*¹⁰` = BranchOps: Create INWARD, CONSUMPTION, PRODUCTION, TRANSFER_OUT movements via controlled screens only
- `*¹¹` = BranchOps: Read own branch FG; optional limited Update for operational blocking
- `*¹²` = QualityInspector: Create FG when moving QC_HOLD→AVAILABLE, update status for defects
- `*¹³` = Logistics: Update status for RESERVED/DISPATCHED
- `*¹⁴` = BranchOps (Source): Create IBT (INITIATED), update to SHIPPED; cannot mark RECEIVED
- `*¹⁵` = Logistics: Approve/Reject IBT, update to IN_TRANSIT/RECEIVED for destination

### 2.4 Procurement & Finance Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **PurchaseOrder** | CRUD | R | R | R | CRU*¹⁶ | R | R | R | R | R |
| **PurchaseOrderLine** | CRUD | R | R | R | CRU*¹⁷ | R | R | R | R | R |
| **VendorRMPrice** | CRUD | R | R | R | CRU* | R | R | R | R | R |
| **PriceHistory** | CR | R | R | R | CR | R | R | R | R | R |
| **Invoice** | CRUD | R | R | R | R | R | R | CRU*¹⁸ | R | R |

**Constraints:**
- `*¹⁶` = Delete only while status=DRAFT and no receipts; immutable after SENT/RECEIVED except controlled fields
- `*¹⁷` = Full CRUD while PO is editable; no changes after final receipt/closure
- `*¹⁸` = Logistics: Create/Update invoices (DRAFT→SENT→PAID transitions)

### 2.5 Quality & Logistics Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **QCResult** | CRUD | R | R | R | R | R | CRU*¹⁹ | R | R | R |
| **QCApproval** | CRUD | R | R | R | R | R | CRU | R | R | R |
| **Dispatch** | CRUD | R | R | R | R | R | R | CRU*²⁰ | R | R |

**Constraints:**
- `*¹⁹` = Delete only obvious duplicates/erroneous entries under controlled rules
- `*²⁰` = Delete only while status=PENDING and not linked to Invoice

### 2.6 System Permissions

| Entity | MasterAdmin | DemandPlanner | TechOpsEngineer | CPCPlanner | ProcurementOfficer | BranchOpsUser | QualityInspector | LogisticsCoordinator | FinanceViewer | AuditorReadOnly |
|--------|:-----------:|:-------------:|:---------------:|:----------:|:------------------:|:-------------:|:----------------:|:--------------------:|:-------------:|:---------------:|
| **User** | CRUD | - | - | - | - | - | - | - | R* | R |
| **Role** | CRUD | - | - | - | - | - | - | - | R* | R |
| **SystemConfig** | CRUD | - | - | - | - | - | - | - | - | R |
| **AuditLog** | R | - | - | - | - | - | - | - | - | R |

---

## 3. LIFECYCLE-BASED CONSTRAINTS

### 3.1 Entity State Machines

#### BuyerSKU Lifecycle
```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  DRAFT   │───▶│ BOM_PENDING  │───▶│ BOM_COMPLETE │───▶│  ACTIVE  │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
     │                                                        │
     │              ┌──────────────┐                          │
     └─────────────▶│   INACTIVE   │◀─────────────────────────┘
                    └──────────────┘

DemandPlanner: CRUD while DRAFT or BOM_PENDING (and not referenced)
TechOpsEngineer: Update technical attrs, transition to BOM_COMPLETE
```

#### PurchaseOrder Lifecycle
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───▶│   SENT   │───▶│ PARTIAL  │───▶│ RECEIVED │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                                                │
     ▼                                                ▼
┌──────────┐                                   ┌──────────┐
│ CANCELLED│                                   │  CLOSED  │
└──────────┘                                   └──────────┘

ProcurementOfficer: Full CRUD while DRAFT; limited updates after SENT
```

#### ProductionBatch Lifecycle
```
┌──────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐
│ PLANNED  │───▶│IN_PROGRESS │───▶│ QC_HOLD  │───▶│ QC_PASSED│
└──────────┘    └────────────┘    └──────────┘    └──────────┘
                                       │               │
                                       ▼               ▼
                                  ┌──────────┐   ┌──────────┐
                                  │QC_FAILED │   │ COMPLETED│
                                  └──────────┘   └──────────┘

BranchOpsUser: PLANNED → IN_PROGRESS → (stops at QC_HOLD)
QualityInspector: QC_HOLD → QC_PASSED/QC_FAILED
```

#### IBTTransfer Lifecycle
```
┌───────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ INITIATED │───▶│ APPROVED │───▶│ IN_TRANSIT│───▶│ COMPLETED │
└───────────┘    └──────────┘    └───────────┘    └───────────┘
      │               │
      ▼               ▼
 ┌──────────┐   ┌──────────┐
 │ CANCELLED│   │ REJECTED │
 └──────────┘   └──────────┘

BranchOpsUser (Source): INITIATED → SHIPPED (becomes IN_TRANSIT)
LogisticsCoordinator: INITIATED → APPROVED/REJECTED, IN_TRANSIT → COMPLETED
```

### 3.2 Constraint Rules Table

| Entity | Constraint | Rule | Enforced By |
|--------|------------|------|-------------|
| BuyerSKU | DRAFT_ONLY_DELETE | Delete only if status IN (DRAFT, BOM_PENDING) AND NOT referenced in BOM | Policy |
| Forecast | NO_DELETE_IF_CONVERTED | Delete only if no DispatchLots or ProductionPlans reference it | Policy |
| DispatchLot | READONLY_AFTER_PRODUCTION | Read-only after ProductionBatch is linked | Policy |
| ProductionPlan | NO_DELETE_IF_BATCHED | Delete only if no ProductionBatch references it | Policy |
| PurchaseOrder | DRAFT_ONLY_DELETE | Delete only if status = DRAFT AND no receipts exist | Policy |
| PurchaseOrderLine | PO_EDITABLE_ONLY | CRUD only while parent PO status = DRAFT | Policy |
| RMStockMovement | APPEND_ONLY | No Update/Delete except MasterAdmin override | Middleware |
| Dispatch | PENDING_ONLY_DELETE | Delete only if status = PENDING AND NOT linked to Invoice | Policy |
| QCResult | CONTROLLED_DELETE | Delete only duplicates/errors within 24h of creation | Policy |

---

## 4. RISK ANALYSIS & RECOMMENDATIONS

### 4.1 Over-Permissive Areas (HIGH RISK)

| Area | Risk | Current State | Recommendation |
|------|------|---------------|----------------|
| **MasterAdmin Stock Override** | Data integrity | Can modify append-only RMStockMovement | Add audit requirement, dual approval for overrides |
| **BranchOpsUser Ad-hoc Production** | Inventory accuracy | Can create batches without ProductionPlan | Require plan reference or supervisor approval flag |
| **QualityInspector FG Create** | Ghost inventory | Can create FGInventory records | Restrict to batch-linked FG only, validate batch exists |
| **DemandPlanner SKU Delete** | Data loss | Can delete SKUs in early lifecycle | Add soft-delete only, require MasterAdmin for hard delete |
| **ProcurementOfficer Vendor CRU** | Vendor fraud | Can create/modify vendors freely | Add vendor approval workflow or MasterAdmin sign-off for new vendors |

### 4.2 Under-Permissive Areas (OPERATIONAL RISK)

| Area | Risk | Current State | Recommendation |
|------|------|---------------|----------------|
| **BranchOpsUser IBT Receive** | Blocked operations | Cannot mark IBT as RECEIVED even for own branch | Allow RECEIVED for destination branch users |
| **CPCPlanner Branch Capacity** | Planning limitation | Read-only on Branch | Allow Update on capacity_units_per_day field only |
| **LogisticsCoordinator PO Access** | Visibility gap | Read-only on PO | Consider allowing Update for shipping-related fields (tracking, delivery notes) |

### 4.3 Missing Roles

| Suggested Role | Justification |
|----------------|---------------|
| **BranchSupervisor** | Elevated BranchOpsUser with ability to approve ad-hoc operations, override minor blocks |
| **InventoryController** | Cross-branch inventory visibility, IBT management, cycle count authority |
| **FinanceAdmin** | Full CRUD on Invoice, PriceHistory; needed if finance operations are centralized |
| **SystemAdmin** | User/Role management only (without business data access) for IT support |

### 4.4 Suggested Additional Constraints

```python
# 1. Time-based edit windows
EDIT_WINDOW_HOURS = {
    'QCResult': 24,        # Can only edit within 24h of creation
    'RMStockMovement': 0,  # Never editable (except MasterAdmin)
    'ProductionBatch': 72, # Can update within 72h of completion
}

# 2. Value-based thresholds
APPROVAL_THRESHOLDS = {
    'PurchaseOrder': 100000,      # Orders > ₹1L need approval
    'VendorRMPrice': 0.15,        # Price changes > 15% need approval
    'IBTTransfer': 1000,          # Transfers > 1000 units need approval
}

# 3. Reference integrity checks
DELETION_BLOCKS = {
    'BuyerSKU': ['BOM', 'ProductionBatch', 'FGInventory', 'Dispatch'],
    'RawMaterial': ['BOM', 'RMStockMovement', 'PurchaseOrderLine'],
    'Vendor': ['PurchaseOrder', 'VendorRMPrice'],
    'ProductionPlan': ['ProductionBatch'],
    'Forecast': ['DispatchLot', 'ProductionPlan'],
}
```

---

## 5. IMPLEMENTATION PATTERN

### 5.1 Database Schema

```sql
-- Core RBAC Tables
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'MASTER_ADMIN', 'DEMAND_PLANNER'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,  -- Cannot be deleted
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    entity VARCHAR(50) NOT NULL,       -- e.g., 'BuyerSKU', 'PurchaseOrder'
    action VARCHAR(20) NOT NULL,       -- 'CREATE', 'READ', 'UPDATE', 'DELETE'
    scope VARCHAR(50) DEFAULT 'ALL',   -- 'ALL', 'OWN_BRANCH', 'OWN_RECORDS'
    conditions JSONB,                  -- Lifecycle/state constraints
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY,
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    is_active BOOLEAN DEFAULT TRUE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    branch_id UUID REFERENCES branches(id),  -- For branch-scoped roles
    is_primary BOOLEAN DEFAULT FALSE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,  -- Optional role expiry
    UNIQUE(user_id, role_id, branch_id)
);

-- Constraint definitions (for policy engine)
CREATE TABLE permission_constraints (
    id UUID PRIMARY KEY,
    permission_id UUID REFERENCES permissions(id),
    constraint_type VARCHAR(50) NOT NULL,  -- 'STATUS', 'REFERENCE', 'TIME_WINDOW', 'THRESHOLD'
    constraint_config JSONB NOT NULL,
    error_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Permission Configuration (JSON)

```json
{
  "permissions": [
    {
      "entity": "BuyerSKU",
      "role": "DEMAND_PLANNER",
      "actions": ["CREATE", "READ", "UPDATE", "DELETE"],
      "constraints": [
        {
          "type": "STATUS_CHECK",
          "config": {
            "allowed_statuses": ["DRAFT", "BOM_PENDING"],
            "actions_affected": ["UPDATE", "DELETE"]
          }
        },
        {
          "type": "REFERENCE_CHECK",
          "config": {
            "blocked_if_referenced_by": ["BOM", "ProductionBatch"],
            "actions_affected": ["DELETE"]
          }
        }
      ]
    },
    {
      "entity": "PurchaseOrder",
      "role": "PROCUREMENT_OFFICER",
      "actions": ["CREATE", "READ", "UPDATE", "DELETE"],
      "constraints": [
        {
          "type": "STATUS_CHECK",
          "config": {
            "allowed_statuses": ["DRAFT"],
            "actions_affected": ["DELETE"]
          }
        },
        {
          "type": "REFERENCE_CHECK",
          "config": {
            "blocked_if_referenced_by": ["RMStockMovement"],
            "actions_affected": ["DELETE"]
          }
        },
        {
          "type": "FIELD_RESTRICTION",
          "config": {
            "editable_after_sent": ["notes", "expected_delivery_date"],
            "status_trigger": "SENT"
          }
        }
      ]
    },
    {
      "entity": "RMStockMovement",
      "role": "BRANCH_OPS_USER",
      "actions": ["CREATE", "READ"],
      "constraints": [
        {
          "type": "MOVEMENT_TYPE_CHECK",
          "config": {
            "allowed_types": ["INWARD", "CONSUMPTION", "PRODUCTION", "TRANSFER_OUT"],
            "actions_affected": ["CREATE"]
          }
        },
        {
          "type": "BRANCH_SCOPE",
          "config": {
            "scope": "OWN_BRANCH",
            "branch_field": "branch"
          }
        }
      ]
    }
  ]
}
```

### 5.3 Backend Implementation (Python/FastAPI)

```python
# /app/backend/services/rbac_service.py

from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from functools import wraps
from fastapi import HTTPException, Depends
import json

class Action(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class Scope(str, Enum):
    ALL = "ALL"
    OWN_BRANCH = "OWN_BRANCH"
    OWN_RECORDS = "OWN_RECORDS"

@dataclass
class Permission:
    entity: str
    action: Action
    scope: Scope
    constraints: List[Dict[str, Any]]

@dataclass
class PermissionResult:
    allowed: bool
    reason: Optional[str] = None
    restricted_fields: Optional[List[str]] = None

class RBACService:
    """Role-Based Access Control Service"""
    
    def __init__(self, db):
        self.db = db
        self._permission_cache = {}
    
    async def load_role_permissions(self, role_code: str) -> List[Permission]:
        """Load permissions for a role from database"""
        if role_code in self._permission_cache:
            return self._permission_cache[role_code]
        
        # Query role and permissions
        role = await self.db.roles.find_one({"code": role_code}, {"_id": 0})
        if not role:
            return []
        
        role_perms = await self.db.role_permissions.find(
            {"role_id": role["id"], "is_active": True}
        ).to_list(1000)
        
        perm_ids = [rp["permission_id"] for rp in role_perms]
        permissions = await self.db.permissions.find(
            {"id": {"$in": perm_ids}}
        ).to_list(1000)
        
        # Load constraints
        result = []
        for perm in permissions:
            constraints = await self.db.permission_constraints.find(
                {"permission_id": perm["id"]}
            ).to_list(100)
            
            result.append(Permission(
                entity=perm["entity"],
                action=Action(perm["action"]),
                scope=Scope(perm.get("scope", "ALL")),
                constraints=[c["constraint_config"] for c in constraints]
            ))
        
        self._permission_cache[role_code] = result
        return result
    
    async def check_permission(
        self,
        user: dict,
        entity: str,
        action: Action,
        resource: Optional[dict] = None,
        context: Optional[dict] = None
    ) -> PermissionResult:
        """
        Check if user has permission for action on entity
        
        Args:
            user: Current user object with roles
            entity: Entity name (e.g., 'BuyerSKU')
            action: Action to perform
            resource: The actual resource being accessed (for constraint checks)
            context: Additional context (branch, etc.)
        """
        user_roles = user.get("roles", [])
        
        # MasterAdmin bypass
        if "MASTER_ADMIN" in user_roles:
            return PermissionResult(allowed=True)
        
        # Check each role
        for role_code in user_roles:
            permissions = await self.load_role_permissions(role_code)
            
            for perm in permissions:
                if perm.entity != entity or perm.action != action:
                    continue
                
                # Check scope
                if not self._check_scope(perm.scope, user, resource, context):
                    continue
                
                # Check constraints
                constraint_result = await self._check_constraints(
                    perm.constraints, action, resource, context
                )
                
                if constraint_result.allowed:
                    return constraint_result
        
        return PermissionResult(
            allowed=False,
            reason=f"No permission for {action.value} on {entity}"
        )
    
    def _check_scope(
        self,
        scope: Scope,
        user: dict,
        resource: Optional[dict],
        context: Optional[dict]
    ) -> bool:
        """Check if user's scope allows access"""
        if scope == Scope.ALL:
            return True
        
        if scope == Scope.OWN_BRANCH:
            user_branches = user.get("assigned_branches", [])
            resource_branch = (resource or {}).get("branch") or (context or {}).get("branch")
            return resource_branch in user_branches
        
        if scope == Scope.OWN_RECORDS:
            return (resource or {}).get("created_by") == user.get("id")
        
        return False
    
    async def _check_constraints(
        self,
        constraints: List[Dict],
        action: Action,
        resource: Optional[dict],
        context: Optional[dict]
    ) -> PermissionResult:
        """Check all constraints for a permission"""
        restricted_fields = []
        
        for constraint in constraints:
            constraint_type = constraint.get("type")
            config = constraint.get("config", {})
            
            # Skip if action not affected by this constraint
            actions_affected = config.get("actions_affected", [])
            if actions_affected and action.value not in actions_affected:
                continue
            
            if constraint_type == "STATUS_CHECK":
                if resource:
                    current_status = resource.get("status")
                    allowed_statuses = config.get("allowed_statuses", [])
                    if current_status and current_status not in allowed_statuses:
                        return PermissionResult(
                            allowed=False,
                            reason=f"Action not allowed for status: {current_status}"
                        )
            
            elif constraint_type == "REFERENCE_CHECK":
                if resource and action == Action.DELETE:
                    blocked_by = config.get("blocked_if_referenced_by", [])
                    for ref_entity in blocked_by:
                        # Check if referenced
                        ref_count = await self._count_references(
                            ref_entity, resource
                        )
                        if ref_count > 0:
                            return PermissionResult(
                                allowed=False,
                                reason=f"Cannot delete: referenced by {ref_entity}"
                            )
            
            elif constraint_type == "MOVEMENT_TYPE_CHECK":
                movement_type = (context or {}).get("movement_type")
                allowed_types = config.get("allowed_types", [])
                if movement_type and movement_type not in allowed_types:
                    return PermissionResult(
                        allowed=False,
                        reason=f"Movement type {movement_type} not allowed"
                    )
            
            elif constraint_type == "FIELD_RESTRICTION":
                if resource:
                    status_trigger = config.get("status_trigger")
                    if resource.get("status") == status_trigger:
                        editable_fields = config.get("editable_after_sent", [])
                        restricted_fields = editable_fields
            
            elif constraint_type == "TIME_WINDOW":
                if resource:
                    created_at = resource.get("created_at")
                    window_hours = config.get("hours", 0)
                    if created_at and window_hours > 0:
                        from datetime import datetime, timezone, timedelta
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at)
                        deadline = created_at + timedelta(hours=window_hours)
                        if datetime.now(timezone.utc) > deadline:
                            return PermissionResult(
                                allowed=False,
                                reason=f"Edit window expired ({window_hours}h)"
                            )
        
        return PermissionResult(
            allowed=True,
            restricted_fields=restricted_fields if restricted_fields else None
        )
    
    async def _count_references(self, ref_entity: str, resource: dict) -> int:
        """Count references to a resource in another entity"""
        entity_field_map = {
            "BOM": ("sku_id", "sku_id"),
            "ProductionBatch": ("sku_id", "sku_id"),
            "FGInventory": ("sku_id", "sku_id"),
            "Dispatch": ("sku_id", "sku_id"),
            "RMStockMovement": ("rm_id", "rm_id"),
            "PurchaseOrderLine": ("rm_id", "rm_id"),
            "DispatchLot": ("forecast_id", "id"),
            "ProductionPlan": ("forecast_id", "id"),
        }
        
        if ref_entity not in entity_field_map:
            return 0
        
        ref_field, resource_field = entity_field_map[ref_entity]
        resource_value = resource.get(resource_field)
        
        if not resource_value:
            return 0
        
        collection = self.db[ref_entity.lower() + "s"]  # Simplified
        count = await collection.count_documents({ref_field: resource_value})
        return count


# Decorator for route protection
def require_permission(entity: str, action: Action):
    """Decorator to enforce RBAC on routes"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user and resource from request context
            request = kwargs.get("request")
            current_user = kwargs.get("current_user")
            resource_id = kwargs.get("id") or kwargs.get(f"{entity.lower()}_id")
            
            rbac = RBACService(db)
            
            # Load resource if needed
            resource = None
            if resource_id and action in [Action.UPDATE, Action.DELETE]:
                collection = db[entity.lower() + "s"]
                resource = await collection.find_one({"id": resource_id}, {"_id": 0})
            
            # Check permission
            result = await rbac.check_permission(
                user=current_user.dict(),
                entity=entity,
                action=action,
                resource=resource,
                context=kwargs
            )
            
            if not result.allowed:
                raise HTTPException(status_code=403, detail=result.reason)
            
            # Store restricted fields in request state if applicable
            if result.restricted_fields:
                request.state.restricted_fields = result.restricted_fields
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# Usage example in routes
@router.post("/buyer-skus")
@require_permission("BuyerSKU", Action.CREATE)
async def create_buyer_sku(
    data: BuyerSKUCreate,
    current_user: User = Depends(get_current_user)
):
    # Implementation
    pass

@router.delete("/buyer-skus/{sku_id}")
@require_permission("BuyerSKU", Action.DELETE)
async def delete_buyer_sku(
    sku_id: str,
    current_user: User = Depends(get_current_user)
):
    # RBAC check already done by decorator
    # Additional constraint checks handled automatically
    pass
```

### 5.4 Middleware Implementation

```python
# /app/backend/middleware/rbac_middleware.py

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import re

class RBACMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic RBAC enforcement on API routes
    """
    
    # Route patterns to entity/action mapping
    ROUTE_PATTERNS = [
        (r"^/api/buyer-skus$", "POST", "BuyerSKU", "CREATE"),
        (r"^/api/buyer-skus$", "GET", "BuyerSKU", "READ"),
        (r"^/api/buyer-skus/[\w-]+$", "GET", "BuyerSKU", "READ"),
        (r"^/api/buyer-skus/[\w-]+$", "PUT", "BuyerSKU", "UPDATE"),
        (r"^/api/buyer-skus/[\w-]+$", "DELETE", "BuyerSKU", "DELETE"),
        (r"^/api/purchase-orders$", "POST", "PurchaseOrder", "CREATE"),
        (r"^/api/purchase-orders/[\w-]+/send$", "PUT", "PurchaseOrder", "UPDATE"),
        # ... more patterns
    ]
    
    # Routes that bypass RBAC (public endpoints)
    BYPASS_ROUTES = [
        r"^/api/auth/login$",
        r"^/api/health$",
        r"^/docs",
        r"^/openapi.json$",
    ]
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method
        
        # Check bypass routes
        for pattern in self.BYPASS_ROUTES:
            if re.match(pattern, path):
                return await call_next(request)
        
        # Find matching route pattern
        for pattern, http_method, entity, action in self.ROUTE_PATTERNS:
            if re.match(pattern, path) and method == http_method:
                # Get user from request state (set by auth middleware)
                user = getattr(request.state, "user", None)
                if not user:
                    raise HTTPException(status_code=401, detail="Not authenticated")
                
                # Perform RBAC check
                rbac = RBACService(request.app.state.db)
                result = await rbac.check_permission(
                    user=user,
                    entity=entity,
                    action=action,
                    context={"method": method, "path": path}
                )
                
                if not result.allowed:
                    raise HTTPException(status_code=403, detail=result.reason)
                
                # Store result for downstream use
                request.state.rbac_result = result
                break
        
        return await call_next(request)
```

### 5.5 Role Seeding Script

```python
# /app/backend/scripts/seed_rbac.py

ROLES = [
    {
        "code": "MASTER_ADMIN",
        "name": "Master Administrator",
        "description": "Full system access",
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

PERMISSIONS = [
    # BuyerSKU permissions
    {"entity": "BuyerSKU", "action": "CREATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    {"entity": "BuyerSKU", "action": "READ", "roles": ["*"]},  # All roles
    {"entity": "BuyerSKU", "action": "UPDATE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER", "TECH_OPS_ENGINEER"]},
    {"entity": "BuyerSKU", "action": "DELETE", "roles": ["MASTER_ADMIN", "DEMAND_PLANNER"]},
    
    # PurchaseOrder permissions
    {"entity": "PurchaseOrder", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrder", "action": "READ", "roles": ["*"]},
    {"entity": "PurchaseOrder", "action": "UPDATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    {"entity": "PurchaseOrder", "action": "DELETE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER"]},
    
    # RMStockMovement permissions (append-only)
    {"entity": "RMStockMovement", "action": "CREATE", "roles": ["MASTER_ADMIN", "PROCUREMENT_OFFICER", "BRANCH_OPS_USER"]},
    {"entity": "RMStockMovement", "action": "READ", "roles": ["*"]},
    {"entity": "RMStockMovement", "action": "UPDATE", "roles": ["MASTER_ADMIN"]},  # Override only
    {"entity": "RMStockMovement", "action": "DELETE", "roles": ["MASTER_ADMIN"]},  # Override only
    
    # ... continue for all entities
]

CONSTRAINTS = [
    {
        "entity": "BuyerSKU",
        "action": "DELETE",
        "role": "DEMAND_PLANNER",
        "constraint_type": "STATUS_CHECK",
        "config": {"allowed_statuses": ["DRAFT", "BOM_PENDING"]}
    },
    {
        "entity": "BuyerSKU",
        "action": "DELETE",
        "role": "DEMAND_PLANNER",
        "constraint_type": "REFERENCE_CHECK",
        "config": {"blocked_if_referenced_by": ["BOM", "ProductionBatch"]}
    },
    {
        "entity": "PurchaseOrder",
        "action": "DELETE",
        "role": "PROCUREMENT_OFFICER",
        "constraint_type": "STATUS_CHECK",
        "config": {"allowed_statuses": ["DRAFT"]}
    },
    {
        "entity": "PurchaseOrder",
        "action": "DELETE",
        "role": "PROCUREMENT_OFFICER",
        "constraint_type": "REFERENCE_CHECK",
        "config": {"blocked_if_referenced_by": ["RMStockMovement"]}
    },
    # ... continue for all constraints
]

async def seed_rbac(db):
    """Seed RBAC data into database"""
    import uuid
    from datetime import datetime, timezone
    
    # Seed roles
    for role_data in ROLES:
        existing = await db.roles.find_one({"code": role_data["code"]})
        if not existing:
            await db.roles.insert_one({
                "id": str(uuid.uuid4()),
                **role_data,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            print(f"Created role: {role_data['code']}")
    
    # Seed permissions and role_permissions
    for perm_data in PERMISSIONS:
        perm_id = str(uuid.uuid4())
        await db.permissions.update_one(
            {"entity": perm_data["entity"], "action": perm_data["action"]},
            {"$setOnInsert": {
                "id": perm_id,
                "entity": perm_data["entity"],
                "action": perm_data["action"],
                "scope": perm_data.get("scope", "ALL"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Get permission ID
        perm = await db.permissions.find_one(
            {"entity": perm_data["entity"], "action": perm_data["action"]}
        )
        
        # Link to roles
        roles = perm_data["roles"]
        if "*" in roles:
            roles = [r["code"] for r in ROLES]
        
        for role_code in roles:
            role = await db.roles.find_one({"code": role_code})
            if role:
                await db.role_permissions.update_one(
                    {"role_id": role["id"], "permission_id": perm["id"]},
                    {"$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "role_id": role["id"],
                        "permission_id": perm["id"],
                        "is_active": True,
                        "granted_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
    
    # Seed constraints
    for constraint_data in CONSTRAINTS:
        perm = await db.permissions.find_one({
            "entity": constraint_data["entity"],
            "action": constraint_data["action"]
        })
        
        if perm:
            await db.permission_constraints.update_one(
                {
                    "permission_id": perm["id"],
                    "constraint_type": constraint_data["constraint_type"]
                },
                {"$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "permission_id": perm["id"],
                    "constraint_type": constraint_data["constraint_type"],
                    "constraint_config": constraint_data["config"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
    
    print("RBAC seeding complete!")
```

---

## 6. IMPLEMENTATION CHECKLIST

### Phase 1: Core RBAC Tables
- [ ] Create `roles` collection/table
- [ ] Create `permissions` collection/table
- [ ] Create `role_permissions` junction
- [ ] Create `user_roles` junction
- [ ] Create `permission_constraints` table

### Phase 2: Permission Seeding
- [ ] Seed 10 roles
- [ ] Seed permissions for all entities (~70+ permissions)
- [ ] Seed constraints (~25+ constraint rules)
- [ ] Migrate existing users to new role system

### Phase 3: Service Layer
- [ ] Implement `RBACService` class
- [ ] Implement constraint checkers
- [ ] Implement scope validators
- [ ] Add permission caching

### Phase 4: Route Protection
- [ ] Create `@require_permission` decorator
- [ ] Apply to all existing routes
- [ ] Add middleware for automatic enforcement

### Phase 5: Testing & Validation
- [ ] Unit tests for each role
- [ ] Integration tests for constraint scenarios
- [ ] Penetration testing for privilege escalation
- [ ] Documentation for each role's capabilities

---

*Document Version: 1.0*
*Created: March 14, 2026*
