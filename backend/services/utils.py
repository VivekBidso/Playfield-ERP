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
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'a881d0c3140340a679b9f9a73d91abc150e63c84ce2c4e9c33caa661ae527646')
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
    "INP": {
        "name": "In-house Plastic", 
        "fields": ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"],
        "nameFormat": ["mould_code", "model_name", "part_name", "colour", "mb"]
    },
    "INM": {
        "name": "In-house Metal", 
        "fields": ["model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"],
        "nameFormat": ["model_name", "part_name", "colour", "mb"]
    },
    "ACC": {
        "name": "Accessories", 
        "fields": ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"],
        "nameFormat": ["type", "model_name", "specs", "colour"]
    },
    "ELC": {
        "name": "Electric Components", 
        "fields": ["model", "type", "specs", "per_unit_weight", "unit"],
        "nameFormat": ["model", "type", "specs"]
    },
    "SP": {
        "name": "Spares", 
        "fields": ["type", "specs", "per_unit_weight", "unit"],
        "nameFormat": ["type", "specs"]
    },
    "BS": {
        "name": "Brand Assets", 
        "fields": ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"],
        "nameFormat": ["position", "type", "brand", "buyer_sku"]
    },
    "PM": {
        "name": "Packaging", 
        "fields": ["model", "type", "specs", "brand", "per_unit_weight", "unit"],
        "nameFormat": ["model", "type", "specs", "brand"]
    },
    "LB": {
        "name": "Labels", 
        "fields": ["type", "buyer_sku", "per_unit_weight", "unit"],
        "nameFormat": ["type", "buyer_sku"]
    }
}

# Cache for rm_categories from database
_rm_categories_cache = {}

async def get_rm_category_config(category: str) -> dict:
    """Get RM category configuration from database with caching"""
    global _rm_categories_cache
    
    if category in _rm_categories_cache:
        return _rm_categories_cache[category]
    
    # Fetch from database
    cat_doc = await db.rm_categories.find_one({"code": category}, {"_id": 0})
    if cat_doc:
        # Extract name format from description_columns with include_in_name=True
        desc_cols = cat_doc.get("description_columns", [])
        name_fields = [
            col["key"] for col in sorted(desc_cols, key=lambda x: x.get("order", 0))
            if col.get("include_in_name")
        ]
        
        config = {
            "name": cat_doc.get("name", category),
            "fields": [col["key"] for col in desc_cols],
            "nameFormat": name_fields,
            "description_columns": desc_cols
        }
        _rm_categories_cache[category] = config
        return config
    
    # Fallback to hardcoded if not in database
    if category in RM_CATEGORIES:
        return RM_CATEGORIES[category]
    
    return {"name": category, "fields": [], "nameFormat": []}


def generate_rm_name(category: str, category_data: dict, category_config: dict = None) -> str:
    """
    Generate RM description from category_data based on nomenclature.
    Uses category_config if provided, otherwise falls back to hardcoded RM_CATEGORIES.
    Format: field1 - field2 - field3 (hyphen-separated, consistent with backfill)
    """
    if category_config:
        name_format = category_config.get("nameFormat", [])
    elif category in RM_CATEGORIES:
        name_format = RM_CATEGORIES[category].get("nameFormat", [])
    else:
        return ""
    
    parts = [str(category_data.get(key, "")).strip() for key in name_format if category_data.get(key)]
    return " - ".join(parts) if parts else ""


async def generate_rm_description_async(category: str, category_data: dict) -> str:
    """
    Async version that fetches category config from database.
    This is the preferred method to use in routes.
    """
    config = await get_rm_category_config(category)
    return generate_rm_name(category, category_data, config)


def clear_rm_category_cache():
    """Clear the RM categories cache (call after updating rm_categories collection)"""
    global _rm_categories_cache
    _rm_categories_cache = {}
