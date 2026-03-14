"""Routes module - exports all routers"""
from .tech_ops_routes import router as tech_ops_router
from .demand_routes import router as demand_router
from .quality_routes import router as quality_router
from .procurement_routes import router as procurement_router

__all__ = [
    'tech_ops_router',
    'demand_router', 
    'quality_router',
    'procurement_router'
]
