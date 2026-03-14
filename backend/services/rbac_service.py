"""
RBAC Service - Role-Based Access Control
Implements permission checking with constraints
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from functools import wraps
from fastapi import HTTPException, Request
import logging

from database import db
from models.rbac import Action, Scope, PermissionResult, RoleCode

logger = logging.getLogger(__name__)


class RBACService:
    """Role-Based Access Control Service"""
    
    def __init__(self):
        self._permission_cache: Dict[str, List[dict]] = {}
        self._cache_ttl = 300  # 5 minutes cache
        self._cache_timestamps: Dict[str, datetime] = {}
    
    def _is_cache_valid(self, role_code: str) -> bool:
        """Check if cached permissions are still valid"""
        if role_code not in self._cache_timestamps:
            return False
        elapsed = (datetime.now(timezone.utc) - self._cache_timestamps[role_code]).total_seconds()
        return elapsed < self._cache_ttl
    
    async def load_role_permissions(self, role_code: str) -> List[dict]:
        """Load permissions for a role from database"""
        if role_code in self._permission_cache and self._is_cache_valid(role_code):
            return self._permission_cache[role_code]
        
        # Query role
        role = await db.roles.find_one({"code": role_code, "is_active": True}, {"_id": 0})
        if not role:
            return []
        
        # Query role permissions
        role_perms = await db.role_permissions.find(
            {"role_id": role["id"], "is_active": True}
        ).to_list(1000)
        
        perm_ids = [rp["permission_id"] for rp in role_perms]
        if not perm_ids:
            return []
        
        # Query permissions
        permissions = await db.permissions.find(
            {"id": {"$in": perm_ids}}
        ).to_list(1000)
        
        # Load constraints for each permission
        result = []
        for perm in permissions:
            constraints = await db.permission_constraints.find(
                {"permission_id": perm["id"]}
            ).to_list(100)
            
            result.append({
                "entity": perm["entity"],
                "action": perm["action"],
                "scope": perm.get("scope", "ALL"),
                "constraints": [c.get("constraint_config", {}) for c in constraints]
            })
        
        # Update cache
        self._permission_cache[role_code] = result
        self._cache_timestamps[role_code] = datetime.now(timezone.utc)
        
        return result
    
    async def get_user_roles(self, user_id: str) -> List[str]:
        """Get all role codes for a user"""
        user_roles = await db.user_roles.find({"user_id": user_id}).to_list(100)
        
        if not user_roles:
            # Check legacy role field on user
            user = await db.users.find_one({"id": user_id}, {"_id": 0})
            if user:
                legacy_role = user.get("role", "")
                # Map legacy roles to new role codes
                legacy_mapping = {
                    "master_admin": "MASTER_ADMIN",
                    "branch_user": "BRANCH_OPS_USER"
                }
                return [legacy_mapping.get(legacy_role, "BRANCH_OPS_USER")]
            return []
        
        role_ids = [ur["role_id"] for ur in user_roles]
        roles = await db.roles.find({"id": {"$in": role_ids}, "is_active": True}).to_list(100)
        return [r["code"] for r in roles]
    
    async def check_permission(
        self,
        user: dict,
        entity: str,
        action: str,
        resource: Optional[dict] = None,
        context: Optional[dict] = None
    ) -> PermissionResult:
        """
        Check if user has permission for action on entity
        
        Args:
            user: Current user object with roles
            entity: Entity name (e.g., 'BuyerSKU')
            action: Action to perform (CREATE, READ, UPDATE, DELETE)
            resource: The actual resource being accessed (for constraint checks)
            context: Additional context (branch, movement_type, etc.)
        """
        user_id = user.get("id")
        
        # Get user roles
        user_roles = await self.get_user_roles(user_id)
        
        # Also check legacy role field
        legacy_role = user.get("role", "")
        if legacy_role == "master_admin" and "MASTER_ADMIN" not in user_roles:
            user_roles.append("MASTER_ADMIN")
        
        # MasterAdmin bypass - full access
        if "MASTER_ADMIN" in user_roles:
            return PermissionResult(allowed=True)
        
        # Check each role for permission
        for role_code in user_roles:
            permissions = await self.load_role_permissions(role_code)
            
            for perm in permissions:
                if perm["entity"] != entity or perm["action"] != action:
                    continue
                
                # Check scope
                scope_check = self._check_scope(perm["scope"], user, resource, context)
                if not scope_check:
                    continue
                
                # Check constraints
                constraint_result = await self._check_constraints(
                    perm["constraints"], action, resource, context
                )
                
                if constraint_result.allowed:
                    return constraint_result
        
        return PermissionResult(
            allowed=False,
            reason=f"No permission for {action} on {entity}"
        )
    
    def _check_scope(
        self,
        scope: str,
        user: dict,
        resource: Optional[dict],
        context: Optional[dict]
    ) -> bool:
        """Check if user's scope allows access"""
        if scope == "ALL":
            return True
        
        if scope == "OWN_BRANCH":
            user_branches = user.get("assigned_branches", [])
            # Check resource branch
            resource_branch = None
            if resource:
                resource_branch = resource.get("branch") or resource.get("source_branch")
            if context:
                resource_branch = resource_branch or context.get("branch")
            
            # If no branch specified, allow (will be filtered in query)
            if not resource_branch:
                return True
            return resource_branch in user_branches
        
        if scope == "OWN_RECORDS":
            if not resource:
                return True
            return resource.get("created_by") == user.get("id")
        
        return False
    
    async def _check_constraints(
        self,
        constraints: List[Dict],
        action: str,
        resource: Optional[dict],
        context: Optional[dict]
    ) -> PermissionResult:
        """Check all constraints for a permission"""
        restricted_fields = []
        
        for constraint in constraints:
            constraint_type = constraint.get("type")
            config = constraint.get("config", constraint)  # Support both formats
            
            # Skip if action not affected by this constraint
            actions_affected = config.get("actions_affected", [])
            if actions_affected and action not in actions_affected:
                continue
            
            if constraint_type == "STATUS_CHECK":
                if resource:
                    current_status = resource.get("status")
                    allowed_statuses = config.get("allowed_statuses", [])
                    if current_status and allowed_statuses and current_status not in allowed_statuses:
                        return PermissionResult(
                            allowed=False,
                            reason=f"Action not allowed for status: {current_status}. Allowed: {allowed_statuses}"
                        )
            
            elif constraint_type == "REFERENCE_CHECK":
                if resource and action == "DELETE":
                    blocked_by = config.get("blocked_if_referenced_by", [])
                    resource_id = resource.get("id") or resource.get("sku_id") or resource.get("rm_id")
                    
                    for ref_entity in blocked_by:
                        ref_count = await self._count_references(ref_entity, resource)
                        if ref_count > 0:
                            return PermissionResult(
                                allowed=False,
                                reason=f"Cannot delete: referenced by {ref_count} {ref_entity} record(s)"
                            )
            
            elif constraint_type == "MOVEMENT_TYPE_CHECK":
                movement_type = (context or {}).get("movement_type")
                allowed_types = config.get("allowed_types", [])
                if movement_type and allowed_types and movement_type not in allowed_types:
                    return PermissionResult(
                        allowed=False,
                        reason=f"Movement type '{movement_type}' not allowed for this role"
                    )
            
            elif constraint_type == "FIELD_RESTRICTION":
                if resource:
                    status_trigger = config.get("status_trigger")
                    if resource.get("status") == status_trigger:
                        editable_fields = config.get("editable_fields", [])
                        restricted_fields = editable_fields
            
            elif constraint_type == "TIME_WINDOW":
                if resource:
                    created_at = resource.get("created_at")
                    window_hours = config.get("hours", 0)
                    if created_at and window_hours > 0:
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        deadline = created_at + timedelta(hours=window_hours)
                        if datetime.now(timezone.utc) > deadline:
                            return PermissionResult(
                                allowed=False,
                                reason=f"Edit window expired ({window_hours} hours)"
                            )
            
            elif constraint_type == "SOFT_DELETE_ONLY":
                if action == "DELETE":
                    # This signals that only soft delete is allowed
                    restricted_fields.append("_soft_delete_only")
        
        return PermissionResult(
            allowed=True,
            restricted_fields=restricted_fields if restricted_fields else None
        )
    
    async def _count_references(self, ref_entity: str, resource: dict) -> int:
        """Count references to a resource in another entity"""
        # Map entity names to collection names and reference fields
        entity_collection_map = {
            "BOM": "bill_of_materials",
            "ProductionBatch": "production_batches",
            "FGInventory": "fg_inventory",
            "Dispatch": "dispatches",
            "RMStockMovement": "rm_stock_movements",
            "PurchaseOrderLine": "purchase_order_lines",
            "DispatchLot": "dispatch_lots",
            "ProductionPlan": "production_plans",
            "VendorRMPrice": "vendor_rm_prices",
            "PurchaseOrder": "purchase_orders"
        }
        
        entity_field_map = {
            "BOM": ("sku_id", ["id", "sku_id"]),
            "ProductionBatch": ("sku_id", ["id", "sku_id"]),
            "FGInventory": ("sku_id", ["id", "sku_id"]),
            "Dispatch": ("sku_id", ["id", "sku_id"]),
            "RMStockMovement": ("rm_id", ["id", "rm_id"]),
            "PurchaseOrderLine": ("rm_id", ["id", "rm_id"]),
            "DispatchLot": ("forecast_id", ["id"]),
            "ProductionPlan": ("forecast_id", ["id"]),
            "VendorRMPrice": ("vendor_id", ["id", "vendor_id"]),
            "PurchaseOrder": ("vendor_id", ["id", "vendor_id"])
        }
        
        if ref_entity not in entity_field_map:
            return 0
        
        ref_field, resource_fields = entity_field_map[ref_entity]
        collection_name = entity_collection_map.get(ref_entity, ref_entity.lower() + "s")
        
        # Find resource ID
        resource_value = None
        for field in resource_fields:
            if field in resource:
                resource_value = resource[field]
                break
        
        if not resource_value:
            return 0
        
        try:
            collection = db[collection_name]
            count = await collection.count_documents({ref_field: resource_value})
            return count
        except Exception as e:
            logger.warning(f"Error counting references in {ref_entity}: {e}")
            return 0
    
    def clear_cache(self, role_code: Optional[str] = None):
        """Clear permission cache"""
        if role_code:
            self._permission_cache.pop(role_code, None)
            self._cache_timestamps.pop(role_code, None)
        else:
            self._permission_cache.clear()
            self._cache_timestamps.clear()


# Global RBAC service instance
rbac_service = RBACService()


def require_permission(entity: str, action: str):
    """
    Decorator to enforce RBAC on routes
    
    Usage:
        @router.post("/buyer-skus")
        @require_permission("BuyerSKU", "CREATE")
        async def create_buyer_sku(...):
            pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs (injected by Depends)
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # Convert user to dict if it's a Pydantic model
            if hasattr(current_user, "model_dump"):
                user_dict = current_user.model_dump()
            elif hasattr(current_user, "dict"):
                user_dict = current_user.dict()
            else:
                user_dict = dict(current_user)
            
            # For UPDATE/DELETE, try to load the resource
            resource = None
            context = {}
            
            # Extract resource ID from various kwargs
            resource_id = None
            for key in ["id", "sku_id", "rm_id", "vendor_id", "po_id", "batch_id", "forecast_id"]:
                if key in kwargs:
                    resource_id = kwargs[key]
                    break
            
            # Extract context from kwargs
            if "branch" in kwargs:
                context["branch"] = kwargs["branch"]
            if "movement_type" in kwargs:
                context["movement_type"] = kwargs["movement_type"]
            
            # Load resource for UPDATE/DELETE actions
            if resource_id and action in ["UPDATE", "DELETE"]:
                entity_collection_map = {
                    "BuyerSKU": "skus",
                    "RawMaterial": "raw_materials",
                    "Vendor": "vendors",
                    "PurchaseOrder": "purchase_orders",
                    "ProductionBatch": "production_batches",
                    "Forecast": "forecasts",
                    "QCResult": "qc_results",
                    "IBTTransfer": "ibt_transfers",
                    "Dispatch": "dispatches",
                    "Branch": "branches",
                    "Vertical": "verticals",
                    "Model": "models",
                    "Brand": "brands"
                }
                
                collection_name = entity_collection_map.get(entity, entity.lower() + "s")
                try:
                    resource = await db[collection_name].find_one(
                        {"$or": [{"id": resource_id}, {"sku_id": resource_id}, {"rm_id": resource_id}]},
                        {"_id": 0}
                    )
                except Exception as e:
                    logger.warning(f"Error loading resource for RBAC check: {e}")
            
            # Check permission
            result = await rbac_service.check_permission(
                user=user_dict,
                entity=entity,
                action=action,
                resource=resource,
                context=context
            )
            
            if not result.allowed:
                raise HTTPException(status_code=403, detail=result.reason)
            
            # Store restricted fields in request for downstream use
            # This allows the route handler to know which fields can be edited
            if result.restricted_fields:
                kwargs["_restricted_fields"] = result.restricted_fields
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def check_user_permission(
    user: Any,
    entity: str,
    action: str,
    resource: Optional[dict] = None,
    context: Optional[dict] = None
) -> PermissionResult:
    """
    Utility function to check permission without decorator
    
    Usage in route handlers for complex permission logic
    """
    if hasattr(user, "model_dump"):
        user_dict = user.model_dump()
    elif hasattr(user, "dict"):
        user_dict = user.dict()
    else:
        user_dict = dict(user)
    
    return await rbac_service.check_permission(
        user=user_dict,
        entity=entity,
        action=action,
        resource=resource,
        context=context
    )


# Re-export for convenience
from typing import Any
