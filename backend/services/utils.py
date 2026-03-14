"""Shared utilities and helpers for routes"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
import hashlib
import os

from database import db
from models import User

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

security = HTTPBearer()

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def serialize_doc(doc):
    """Serialize MongoDB document, converting datetime strings to datetime objects"""
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return doc

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="User account is deactivated")
    
    return User(**serialize_doc(user_doc))

def check_master_admin(user: User):
    """Check if user is master admin"""
    if user.role != "master_admin":
        raise HTTPException(status_code=403, detail="Only master admin can perform this action")

def check_branch_access(user: User, branch: str):
    """Check if user has access to specific branch"""
    if user.role == "master_admin":
        return True
    if branch not in user.assigned_branches:
        raise HTTPException(status_code=403, detail=f"No access to branch: {branch}")
    return True

# ============ Sequence Generators ============

async def get_next_rm_sequence(category: str) -> int:
    """Get next RM sequence number for a category"""
    result = await db.raw_materials.find(
        {"rm_id": {"$regex": f"^{category}"}},
        {"rm_id": 1, "_id": 0}
    ).to_list(10000)
    
    if not result:
        return 1
    
    max_seq = 0
    for item in result:
        try:
            parts = item["rm_id"].split("_")
            if len(parts) >= 2:
                seq = int(parts[-1])
                max_seq = max(max_seq, seq)
        except:
            continue
    
    return max_seq + 1

async def generate_movement_code() -> str:
    """Generate unique movement code for stock movements"""
    from datetime import datetime
    now = datetime.now(timezone.utc)
    prefix = f"MV_{now.strftime('%Y%m%d')}"
    count = await db.rm_stock_movements.count_documents({"movement_code": {"$regex": f"^{prefix}"}})
    return f"{prefix}_{count + 1:04d}"

async def get_branch_rm_stock(branch: str, rm_id: str) -> float:
    """Get current stock for an RM in a branch"""
    inv = await db.branch_rm_inventory.find_one(
        {"branch": branch, "rm_id": rm_id},
        {"_id": 0}
    )
    return inv.get("current_stock", 0.0) if inv else 0.0

async def get_current_rm_price(rm_id: str, branch: str = None) -> float:
    """Get current price for an RM"""
    price_doc = await db.vendor_rm_prices.find_one(
        {"rm_id": rm_id, "is_active": True},
        {"_id": 0}
    )
    return price_doc.get("price", 0.0) if price_doc else 0.0

async def update_branch_rm_inventory(branch: str, rm_id: str, quantity_change: float):
    """Update branch inventory for an RM"""
    existing = await db.branch_rm_inventory.find_one(
        {"branch": branch, "rm_id": rm_id}
    )
    
    if existing:
        new_stock = existing.get("current_stock", 0.0) + quantity_change
        await db.branch_rm_inventory.update_one(
            {"branch": branch, "rm_id": rm_id},
            {"$set": {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new inventory record
        import uuid
        await db.branch_rm_inventory.insert_one({
            "id": str(uuid.uuid4()),
            "rm_id": rm_id,
            "branch": branch,
            "current_stock": quantity_change,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

async def get_next_vendor_id() -> str:
    """Generate next vendor ID"""
    result = await db.vendors.find({}, {"vendor_id": 1, "_id": 0}).to_list(10000)
    
    if not result:
        return "VEN_0001"
    
    max_num = 0
    for item in result:
        try:
            parts = item.get("vendor_id", "").split("_")
            if len(parts) == 2:
                num = int(parts[1])
                max_num = max(max_num, num)
        except:
            continue
    
    return f"VEN_{max_num + 1:04d}"

# Constants
BRANCHES = [
    "Unit 1 Vedica",
    "Unit 2 Trikes",
    "Unit 3 TM",
    "Unit 4 Goa",
    "Unit 5 Baabus",
    "Unit 6 Emox",
    "BHDG WH"
]

RM_CATEGORIES = {
    "INP": {"name": "In-house Plastic", "fields": ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"]},
    "INM": {"name": "In-house Metal", "fields": ["process", "model_name", "part_name", "specs", "per_unit_weight", "unit"]},
    "ACC": {"name": "Accessories", "fields": ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"]},
    "ELC": {"name": "Electric Components", "fields": ["model", "type", "specs", "per_unit_weight", "unit"]},
    "SP": {"name": "Spares", "fields": ["type", "specs", "per_unit_weight", "unit"]},
    "BS": {"name": "Brand Assets", "fields": ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"]},
    "PM": {"name": "Packaging", "fields": ["model", "type", "specs", "brand", "per_unit_weight", "unit"]},
    "LB": {"name": "Labels", "fields": ["type", "buyer_sku", "per_unit_weight", "unit"]}
}
