"""Authentication routes - Login, User Management, RBAC"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from models import User, UserCreate, UserResponse, LoginRequest, LoginResponse, ChangePasswordRequest
from models import RoleResponse, AssignRoleRequest
from services.utils import (
    get_current_user, check_master_admin, 
    hash_password, verify_password, create_access_token, serialize_doc
)
from services.rbac_service import rbac_service

router = APIRouter(tags=["Authentication"])


@router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """User login"""
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    # Create access token
    access_token = create_access_token(data={"sub": user_doc["id"]})
    
    # Get user's roles from new RBAC system
    user_roles = await rbac_service.get_user_roles(user_doc["id"])
    
    user_response = UserResponse(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        assigned_branches=user_doc.get("assigned_branches", []),
        is_active=user_doc.get("is_active", True),
        created_at=user_doc["created_at"] if isinstance(user_doc["created_at"], datetime) else datetime.fromisoformat(user_doc["created_at"])
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        assigned_branches=current_user.assigned_branches,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )


@router.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user)
):
    """Change user password"""
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    
    if not verify_password(request.current_password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_password_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password changed successfully"}


# ============ User Management (Master Admin Only) ============

@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new user (Master Admin only)"""
    check_master_admin(current_user)
    
    # Check if user already exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Validate role
    if user_data.role not in ["master_admin", "branch_user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Validate branches
    if user_data.role == "branch_user" and not user_data.assigned_branches:
        raise HTTPException(status_code=400, detail="Branch user must have at least one assigned branch")
    
    # Create user
    import uuid
    user_obj = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        role=user_data.role,
        assigned_branches=user_data.assigned_branches if user_data.role == "branch_user" else []
    )
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return UserResponse(
        id=user_obj.id,
        email=user_obj.email,
        name=user_obj.name,
        role=user_obj.role,
        assigned_branches=user_obj.assigned_branches,
        is_active=user_obj.is_active,
        created_at=user_obj.created_at
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: User = Depends(get_current_user)):
    """List all users (Master Admin only)"""
    check_master_admin(current_user)
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**serialize_doc(u)) for u in users]


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserCreate,
    current_user: User = Depends(get_current_user)
):
    """Update user (Master Admin only)"""
    check_master_admin(current_user)
    
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {
        "name": user_data.name,
        "role": user_data.role,
        "assigned_branches": user_data.assigned_branches if user_data.role == "branch_user" else []
    }
    
    # Update password if provided
    if user_data.password:
        update_data["password_hash"] = hash_password(user_data.password)
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return UserResponse(**serialize_doc(updated))


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user (Master Admin only)"""
    check_master_admin(current_user)
    
    # Can't delete yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Protected system users that cannot be deleted
    PROTECTED_EMAILS = [
        "admin@factory.com", "masteradmin@bidso.com", "demandplanner@bidso.com",
        "techops@bidso.com", "cpcplanner@bidso.com", "procurement@bidso.com",
        "branchops@bidso.com", "qcinspector@bidso.com", "logistics@bidso.com",
        "financeviewer@bidso.com", "auditor@bidso.com"
    ]
    
    user_to_delete = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
    if user_to_delete and user_to_delete.get("email") in PROTECTED_EMAILS:
        raise HTTPException(status_code=403, detail="Cannot delete system/test user accounts")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, current_user: User = Depends(get_current_user)):
    """Toggle user active status (Master Admin only)"""
    check_master_admin(current_user)
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user_doc.get("is_active", True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully"}


# ============ RBAC Management Endpoints ============

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(current_user: User = Depends(get_current_user)):
    """List all available roles"""
    roles = await db.roles.find({"is_active": True}, {"_id": 0}).to_list(100)
    return [RoleResponse(**r) for r in roles]


@router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user: User = Depends(get_current_user)):
    """Get roles assigned to a user"""
    check_master_admin(current_user)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get roles from user_roles collection
    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(100)
    role_ids = [ur["role_id"] for ur in user_roles]
    
    roles = []
    if role_ids:
        roles = await db.roles.find({"id": {"$in": role_ids}, "is_active": True}, {"_id": 0}).to_list(100)
    
    # Also include legacy role
    legacy_role = user.get("role", "")
    
    return {
        "user_id": user_id,
        "legacy_role": legacy_role,
        "roles": [RoleResponse(**r) for r in roles]
    }


@router.post("/users/{user_id}/roles")
async def assign_role_to_user(
    user_id: str,
    request: AssignRoleRequest,
    current_user: User = Depends(get_current_user)
):
    """Assign a role to a user (Master Admin only)"""
    check_master_admin(current_user)
    
    # Validate user exists
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role exists
    role = await db.roles.find_one({"code": request.role_code, "is_active": True}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail=f"Role not found: {request.role_code}")
    
    # Check if already assigned
    existing = await db.user_roles.find_one({
        "user_id": user_id,
        "role_id": role["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Role already assigned to user")
    
    # Assign role
    user_role = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role_id": role["id"],
        "branch_id": request.branch_id,
        "is_primary": request.is_primary,
        "granted_by": current_user.id,
        "granted_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_roles.insert_one(user_role)
    
    # Clear RBAC cache for affected roles
    rbac_service.clear_cache()
    
    return {"message": f"Role {request.role_code} assigned to user successfully"}


@router.delete("/users/{user_id}/roles/{role_code}")
async def remove_role_from_user(
    user_id: str,
    role_code: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a role from a user (Master Admin only)"""
    check_master_admin(current_user)
    
    # Get role
    role = await db.roles.find_one({"code": role_code}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail=f"Role not found: {role_code}")
    
    # Remove role assignment
    result = await db.user_roles.delete_one({
        "user_id": user_id,
        "role_id": role["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    
    # Clear RBAC cache
    rbac_service.clear_cache()
    
    return {"message": f"Role {role_code} removed from user"}


@router.get("/auth/permissions")
async def get_my_permissions(current_user: User = Depends(get_current_user)):
    """Get current user's permissions"""
    user_roles = await rbac_service.get_user_roles(current_user.id)
    
    # Get all permissions for user's roles
    permissions = []
    for role_code in user_roles:
        role_perms = await rbac_service.load_role_permissions(role_code)
        for perm in role_perms:
            perm_entry = {
                "entity": perm["entity"],
                "action": perm["action"],
                "scope": perm["scope"],
                "role": role_code
            }
            if perm_entry not in permissions:
                permissions.append(perm_entry)
    
    return {
        "user_id": current_user.id,
        "roles": user_roles,
        "permissions": permissions
    }


# Extended user response with roles
class UserWithRolesResponse(BaseModel):
    id: str
    email: str
    name: str
    legacy_role: str
    roles: List[str]
    assigned_branches: List[str]
    is_active: bool
    created_at: datetime


@router.get("/users-with-roles", response_model=List[UserWithRolesResponse])
async def list_users_with_roles(current_user: User = Depends(get_current_user)):
    """List all users with their roles (Master Admin only)"""
    check_master_admin(current_user)
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    
    for user in users:
        user_roles = await rbac_service.get_user_roles(user["id"])
        
        created_at = user.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(UserWithRolesResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            legacy_role=user.get("role", ""),
            roles=user_roles,
            assigned_branches=user.get("assigned_branches", []),
            is_active=user.get("is_active", True),
            created_at=created_at
        ))
    
    return result

