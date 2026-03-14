"""RBAC Models - Role-Based Access Control"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


class Action(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class Scope(str, Enum):
    ALL = "ALL"
    OWN_BRANCH = "OWN_BRANCH"
    OWN_RECORDS = "OWN_RECORDS"


class RoleCode(str, Enum):
    MASTER_ADMIN = "MASTER_ADMIN"
    DEMAND_PLANNER = "DEMAND_PLANNER"
    TECH_OPS_ENGINEER = "TECH_OPS_ENGINEER"
    CPC_PLANNER = "CPC_PLANNER"
    PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER"
    BRANCH_OPS_USER = "BRANCH_OPS_USER"
    QUALITY_INSPECTOR = "QUALITY_INSPECTOR"
    LOGISTICS_COORDINATOR = "LOGISTICS_COORDINATOR"
    FINANCE_VIEWER = "FINANCE_VIEWER"
    AUDITOR_READONLY = "AUDITOR_READONLY"


class Role(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # RoleCode value
    name: str
    description: Optional[str] = None
    is_system_role: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Permission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity: str  # e.g., 'BuyerSKU', 'PurchaseOrder'
    action: str  # Action value
    scope: str = "ALL"  # Scope value
    conditions: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RolePermission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role_id: str
    permission_id: str
    is_active: bool = True
    granted_by: Optional[str] = None
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserRole(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    role_id: str
    branch_id: Optional[str] = None  # For branch-scoped roles
    is_primary: bool = False
    granted_by: Optional[str] = None
    granted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


class PermissionConstraint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    permission_id: str
    constraint_type: str  # 'STATUS', 'REFERENCE', 'TIME_WINDOW', 'THRESHOLD', 'FIELD_RESTRICTION', 'MOVEMENT_TYPE'
    constraint_config: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Response Models
class RoleResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    is_system_role: bool
    is_active: bool


class PermissionResult(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    restricted_fields: Optional[List[str]] = None


# Request Models
class RoleCreateRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_system_role: bool = False


class AssignRoleRequest(BaseModel):
    user_id: str
    role_code: str
    branch_id: Optional[str] = None
    is_primary: bool = False
