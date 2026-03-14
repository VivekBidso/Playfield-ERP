"""Pydantic models for the application"""
from .core import (
    RawMaterial, RawMaterialCreate,
    BranchRMInventory,
    SKU, SKUCreate,
    BranchSKUInventory,
    RMMapping, SKUMapping, SKUMappingCreate,
    PurchaseEntry, PurchaseEntryCreate,
    ProductionEntry, ProductionEntryCreate,
    DispatchEntry, DispatchEntryCreate,
    ProductionPlanEntry, ProductionPlanCreate,
    ActivateItemRequest,
    SKUBranchAssignment,
)

from .auth import (
    User, UserCreate, UserResponse,
    LoginRequest, LoginResponse,
    ChangePasswordRequest,
)

from .vendor import (
    Vendor, VendorCreate,
    VendorRMPrice, VendorRMPriceCreate,
)

from .master_data import (
    Vertical, VerticalCreate,
    Model, ModelCreate,
    Brand, BrandCreate,
    Buyer, BuyerCreate,
    Branch,
)

from .transactional import (
    Forecast, ForecastCreate,
    DispatchLot, DispatchLotCreate,
    ProductionBatch, ProductionBatchCreate,
    RMStockMovement,
    QCChecklist, QCChecklistCreate,
    QCResult, QCResultCreate,
    QCApproval,
    FGInventory,
    PurchaseOrder, PurchaseOrderCreate,
    PurchaseOrderLine, PurchaseOrderLineCreate,
    Dispatch,
    Invoice,
    IBTTransfer,
    PriceHistory,
    AuditLog,
)

from .rbac import (
    Role, Permission, RolePermission, UserRole, PermissionConstraint,
    RoleResponse, PermissionResult,
    RoleCode, Action, Scope,
    RoleCreateRequest, AssignRoleRequest,
)
