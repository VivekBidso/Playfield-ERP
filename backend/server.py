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
from routes.admin_db_routes import router as admin_db_router
from routes.historical_routes import router as historical_router
from routes.rm_price_routes import router as rm_price_router
from routes.training_routes import router as training_router
from routes.zoho_dc_routes import router as zoho_dc_router
from routes.tds_routes import router as tds_router

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
api_router.include_router(admin_db_router)
api_router.include_router(historical_router)
api_router.include_router(rm_price_router)
api_router.include_router(training_router)
api_router.include_router(zoho_dc_router)
api_router.include_router(tds_router)

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

import asyncio


@app.on_event("startup")
async def startup_event():
    """Lightweight startup — bind to port fast, then run seeds in background.

    Heavy work (test users, RBAC, RM category migration) is offloaded to a
    background task so Uvicorn passes the deploy health check within the 120s
    startup window even on tier_0 (250m CPU / 512Mi RAM).
    """
    logger.info("Factory OPS API starting up...")
    from database import db
    from services.seed_service import run_seeds
    asyncio.create_task(run_seeds(db, logger))
    logger.info("Background seeding task started")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    client.close()
    logger.info("Factory OPS API shutting down...")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0.0"}
