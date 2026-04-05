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
from routes.admin_routes import router as admin_router
from routes.pantone_routes import router as pantone_router
from routes.price_master_routes import router as price_master_router
from routes.dispatch_lots_v2_routes import router as dispatch_lots_v2_router
from routes.rm_production_routes import router as rm_production_router

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
api_router.include_router(admin_router)
api_router.include_router(pantone_router)
api_router.include_router(price_master_router)
api_router.include_router(dispatch_lots_v2_router)
api_router.include_router(rm_production_router)

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
    from services.utils import hash_password
    from database import db
    import uuid
    from datetime import datetime, timezone
    
    # Define all test users that should exist
    TEST_USERS = [
        {"email": "admin@factory.com", "name": "Master Admin", "role": "master_admin", "password": "admin123"},
        {"email": "masteradmin@bidso.com", "name": "Master Admin", "role": "master_admin", "password": "bidso123"},
        {"email": "demandplanner@bidso.com", "name": "Test Demand Planner", "role": "demand_planner", "password": "bidso123", "branches": ["Unit 1 Vedica", "Unit 2 Trikes"]},
        {"email": "techops@bidso.com", "name": "Tech Ops Engineer", "role": "tech_ops_engineer", "password": "bidso123"},
        {"email": "cpcplanner@bidso.com", "name": "CPC Planner", "role": "cpc_planner", "password": "bidso123"},
        {"email": "procurement@bidso.com", "name": "Procurement Officer", "role": "procurement_officer", "password": "bidso123"},
        {"email": "branchops@bidso.com", "name": "Branch Ops User", "role": "branch_ops_user", "password": "bidso123", "branches": ["Unit 1 Vedica"]},
        {"email": "qcinspector@bidso.com", "name": "Quality Inspector", "role": "quality_inspector", "password": "bidso123"},
        {"email": "logistics@bidso.com", "name": "Logistics Coordinator", "role": "logistics_coordinator", "password": "bidso123"},
        {"email": "financeviewer@bidso.com", "name": "Finance Viewer", "role": "finance_viewer", "password": "bidso123"},
        {"email": "auditor@bidso.com", "name": "Auditor", "role": "auditor_readonly", "password": "bidso123"},
    ]
    
    # Create test users if they don't exist
    for user_data in TEST_USERS:
        existing = await db.users.find_one({"email": user_data["email"]})
        if not existing:
            new_user = {
                "id": str(uuid.uuid4()),
                "email": user_data["email"],
                "password_hash": hash_password(user_data["password"]),
                "name": user_data["name"],
                "role": user_data["role"],
                "assigned_branches": user_data.get("branches", []),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_user)
            logger.info(f"Created test user: {user_data['email']}")
    
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
