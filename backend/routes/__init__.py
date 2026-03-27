"""Routes module - exports all routers"""
from .tech_ops_routes import router as tech_ops_router
from .demand_routes import router as demand_router
from .quality_routes import router as quality_router
from .procurement_routes import router as procurement_router
from .cpc_routes import router as cpc_router
from .auth_routes import router as auth_router
from .rm_routes import router as rm_router
from .sku_routes import router as sku_router
from .production_routes import router as production_router
from .report_routes import router as report_router
from .vendor_routes import router as vendor_router
from .event_routes import router as event_router
from .branch_ops_routes import router as branch_ops_router
from .sku_management_routes import router as sku_management_router
from .demand_hub_routes import router as demand_hub_router
from .upload_routes import router as upload_router
from .mrp_routes import router as mrp_router

__all__ = [
    'tech_ops_router',
    'demand_router', 
    'quality_router',
    'procurement_router',
    'cpc_router',
    'auth_router',
    'rm_router',
    'sku_router',
    'production_router',
    'report_router',
    'vendor_router',
    'event_router',
    'branch_ops_router',
    'sku_management_router',
    'demand_hub_router',
    'upload_router',
    'mrp_router'
]
