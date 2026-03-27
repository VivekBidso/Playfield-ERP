"""Authentication service"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional
import hashlib
import jwt
import os

from database import db
from models.auth import User

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
    """Helper to serialize datetime fields"""
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'date' in doc and isinstance(doc['date'], str):
        doc['date'] = datetime.fromisoformat(doc['date'])
    if doc and 'activated_at' in doc and isinstance(doc['activated_at'], str):
        doc['activated_at'] = datetime.fromisoformat(doc['activated_at'])
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
