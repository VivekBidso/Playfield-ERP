"""
Factory OPS - Main Server Entry Point
Modular FastAPI Application
"""
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize FastAPI
app = FastAPI(
    title="Factory OPS API",
    description="Integrated Manufacturing & Operations Suite",
    version="2.0.0"
)

# Main API Router
api_router = APIRouter(prefix="/api")

# Import and register modular routers
from routes import (
    tech_ops_router,
    demand_router,
    quality_router,
    procurement_router,
    cpc_router,
    auth_router,
    rm_router,
    sku_router,
    production_router,
    report_router,
    vendor_router,
    event_router,
    branch_ops_router,
    sku_management_router,
    demand_hub_router,
    upload_router,
    mrp_router
)

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(rm_router)
api_router.include_router(sku_router)
api_router.include_router(production_router)
api_router.include_router(vendor_router)
api_router.include_router(report_router)
api_router.include_router(tech_ops_router)
api_router.include_router(demand_router)
api_router.include_router(quality_router)
api_router.include_router(procurement_router)
api_router.include_router(cpc_router)
api_router.include_router(event_router)
api_router.include_router(branch_ops_router)
api_router.include_router(sku_management_router)
api_router.include_router(demand_hub_router)
api_router.include_router(upload_router)
api_router.include_router(mrp_router)

# Register main router
app.include_router(api_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection handling
from database import client

@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("Factory OPS API starting up...")
    # Create default admin if needed
    from services.utils import hash_password
    from database import db
    import uuid
    from datetime import datetime, timezone
    
    admin_exists = await db.users.find_one({"email": "admin@factory.com"})
    if not admin_exists:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@factory.com",
            "password_hash": hash_password("admin123"),
            "name": "Master Admin",
            "role": "master_admin",
            "assigned_branches": [],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default admin user created")
    
    # Seed RBAC roles, permissions, and constraints
    from services.seed_rbac import seed_rbac
    await seed_rbac(db)
    logger.info("RBAC seeding complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    client.close()
    logger.info("Factory OPS API shutting down...")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0.0"}
