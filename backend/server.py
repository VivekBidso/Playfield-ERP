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
from routes.inventory_routes import router as inventory_router

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
api_router.include_router(inventory_router)

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
    
    # Migrate RM Categories - populate description_columns from existing RMs
    await migrate_rm_categories(db, logger)


async def migrate_rm_categories(db, logger):
    """
    Migrate RM Categories: Populate description_columns from existing RM data.
    This is idempotent - safe to run on every startup.
    """
    from datetime import datetime, timezone
    
    # Get all categories that exist in raw_materials
    pipeline = [
        {"$match": {"category": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    categories_in_rms = await db.raw_materials.aggregate(pipeline).to_list(100)
    
    if not categories_in_rms:
        logger.info("RM Categories migration: No RMs found, skipping")
        return
    
    # Category display names
    category_names = {
        "INP": "In-house Plastic Parts", "ACC": "Accessories", "ELC": "Electrical Components",
        "SP": "Spare Parts", "BS": "Brand Stickers/Assets", "PM": "Packaging Materials",
        "LB": "Labels", "INM": "Input Materials (Coated)", "INM_FAB": "Fabricated Metal Parts",
        "STK": "Stickers", "SPR": "Spray Paints", "POLY": "Polymer Grades",
        "MB": "Master Batches", "PWD": "Powder Coating Materials", "PIPE": "Metal Pipes"
    }
    
    updated_count = 0
    created_count = 0
    
    for cat_info in categories_in_rms:
        cat_code = cat_info["_id"]
        if not cat_code:
            continue
        
        # Check if category exists
        existing = await db.rm_categories.find_one({"code": cat_code})
        
        # Get samples to analyze category_data fields
        samples = await db.raw_materials.find(
            {"category": cat_code, "category_data": {"$exists": True, "$ne": None}},
            {"category_data": 1, "uom": 1}
        ).limit(50).to_list(50)
        
        # Collect all unique keys from category_data
        all_keys = set()
        sample_uom = "PCS"
        for sample in samples:
            if sample.get("category_data") and isinstance(sample["category_data"], dict):
                all_keys.update(sample["category_data"].keys())
            if sample.get("uom"):
                sample_uom = sample["uom"]
        
        # Build description_columns if we have fields
        description_columns = []
        if all_keys:
            for idx, field in enumerate(sorted(all_keys)):
                if field.startswith("_") or field in ["id", "created_at", "updated_at"]:
                    continue
                col = {
                    "key": field,
                    "label": field.replace("_", " ").title(),
                    "type": "number" if field in ["per_unit_weight", "weight", "qty", "quantity", "mfi", "thickness", "diameter", "length"] else "text",
                    "required": field in ["mould_code", "model_name", "part_name", "grade", "colour_name", "base_part_code", "type"],
                    "options": [],
                    "include_in_name": field in ["mould_code", "model_name", "part_name", "colour", "grade", "colour_name", "type", "brand", "position"],
                    "order": idx
                }
                description_columns.append(col)
        
        # Get highest RM ID sequence for this category
        max_id_rm = await db.raw_materials.find_one(
            {"category": cat_code, "rm_id": {"$regex": f"^{cat_code}_\\d+$"}},
            {"rm_id": 1},
            sort=[("rm_id", -1)]
        )
        next_seq = cat_info["count"] + 1
        if max_id_rm and max_id_rm.get("rm_id"):
            try:
                num_part = max_id_rm["rm_id"].split("_")[-1]
                next_seq = int(num_part) + 1
            except (ValueError, IndexError):
                pass
        
        # Determine source_type and bom_level
        source_type = "PURCHASED"
        bom_level = 1
        if cat_code == "INP":
            source_type = "MANUFACTURED"
            bom_level = 2
        elif cat_code in ["INM", "INM_FAB"]:
            source_type = "BOTH"
            bom_level = 3 if cat_code == "INM" else 2
        
        now = datetime.now(timezone.utc)
        
        if existing:
            # Only update if description_columns is empty or missing
            if not existing.get("description_columns") and description_columns:
                await db.rm_categories.update_one(
                    {"code": cat_code},
                    {"$set": {
                        "description_columns": description_columns,
                        "next_sequence": max(next_seq, existing.get("next_sequence", 1)),
                        "default_uom": sample_uom,
                        "updated_at": now
                    }}
                )
                updated_count += 1
        else:
            # Create new category
            import uuid
            cat_doc = {
                "id": str(uuid.uuid4()),
                "code": cat_code,
                "name": category_names.get(cat_code, cat_code),
                "description": f"Auto-migrated from existing RMs ({cat_info['count']} items)",
                "default_source_type": source_type,
                "default_bom_level": bom_level,
                "default_uom": sample_uom,
                "rm_id_prefix": cat_code,
                "description_columns": description_columns,
                "next_sequence": next_seq,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            await db.rm_categories.insert_one(cat_doc)
            created_count += 1
    
    if created_count > 0 or updated_count > 0:
        logger.info(f"RM Categories migration: Created {created_count}, Updated {updated_count}")
    else:
        logger.info("RM Categories migration: All categories up to date")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    client.close()
    logger.info("Factory OPS API shutting down...")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0.0"}
