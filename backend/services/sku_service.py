"""
SKU Service - Unified SKU data access layer

This service provides functions to access SKU data from the new data model
(bidso_skus + buyer_skus) while returning data in the legacy format for
backward compatibility.

Migration: Replaces direct access to legacy `skus` collection.
"""

from typing import Optional, List, Dict, Any
from database import db

# Cache for reference data (brands, verticals, models)
_brands_cache: Dict[str, dict] = {}
_verticals_cache: Dict[str, dict] = {}
_models_cache: Dict[str, dict] = {}


async def _refresh_reference_cache():
    """Refresh the reference data cache"""
    global _brands_cache, _verticals_cache, _models_cache
    
    brands = await db.brands.find({}, {"_id": 0}).to_list(500)
    _brands_cache = {b["id"]: b for b in brands if b.get("id")}
    
    verticals = await db.verticals.find({}, {"_id": 0}).to_list(100)
    _verticals_cache = {v["id"]: v for v in verticals if v.get("id")}
    
    models = await db.models.find({}, {"_id": 0}).to_list(500)
    _models_cache = {m["id"]: m for m in models if m.get("id")}


async def _get_brand(brand_id: str) -> dict:
    """Get brand by ID with caching"""
    if not brand_id:
        return {}
    if not _brands_cache:
        await _refresh_reference_cache()
    return _brands_cache.get(brand_id, {})


async def _get_vertical(vertical_id: str) -> dict:
    """Get vertical by ID with caching"""
    if not vertical_id:
        return {}
    if not _verticals_cache:
        await _refresh_reference_cache()
    return _verticals_cache.get(vertical_id, {})


async def _get_model(model_id: str) -> dict:
    """Get model by ID with caching"""
    if not model_id:
        return {}
    if not _models_cache:
        await _refresh_reference_cache()
    return _models_cache.get(model_id, {})


def _to_legacy_format(buyer_sku: dict, bidso_sku: dict, brand: dict, vertical: dict, model: dict) -> dict:
    """
    Convert new model data to legacy skus format.
    
    This ensures backward compatibility with existing code that expects
    the old skus collection structure.
    """
    if not buyer_sku:
        return None
    
    # Safely handle None values
    bidso = bidso_sku or {}
    brand_data = brand or {}
    vertical_data = vertical or {}
    model_data = model or {}
    
    return {
        "id": buyer_sku.get("id", ""),
        "sku_id": buyer_sku.get("buyer_sku_id", ""),
        "buyer_sku_id": buyer_sku.get("buyer_sku_id", ""),
        "bidso_sku": buyer_sku.get("bidso_sku_id", ""),
        "bidso_sku_id": buyer_sku.get("bidso_sku_id", ""),
        "description": buyer_sku.get("description") or buyer_sku.get("name") or bidso.get("name", ""),
        "name": buyer_sku.get("name") or bidso.get("name", ""),
        
        # Brand info
        "brand": brand_data.get("name", ""),
        "brand_id": buyer_sku.get("brand_id", ""),
        "brand_code": buyer_sku.get("brand_code") or brand_data.get("code", ""),
        
        # Vertical info (from bidso_sku)
        "vertical": vertical_data.get("name", ""),
        "vertical_id": bidso.get("vertical_id", ""),
        "vertical_code": bidso.get("vertical_code") or vertical_data.get("code", ""),
        
        # Model info (from bidso_sku)
        "model": model_data.get("name", ""),
        "model_id": bidso.get("model_id", ""),
        "model_code": bidso.get("model_code") or model_data.get("code", ""),
        
        # Additional fields
        "status": buyer_sku.get("status", "ACTIVE"),
        "mrp": buyer_sku.get("mrp"),
        "selling_price": buyer_sku.get("selling_price"),
        "gst_rate": buyer_sku.get("gst_rate"),
        "hsn_code": buyer_sku.get("hsn_code"),
        "buyer_id": buyer_sku.get("buyer_id"),
        "created_at": buyer_sku.get("created_at"),
        "updated_at": buyer_sku.get("updated_at"),
        
        # Legacy compatibility
        "low_stock_threshold": buyer_sku.get("low_stock_threshold", 5.0),
        "current_stock": buyer_sku.get("current_stock", 0),
    }


async def get_sku_by_buyer_id(buyer_sku_id: str) -> Optional[dict]:
    """
    Get SKU by buyer_sku_id (the main lookup used throughout the app).
    
    Joins buyer_skus + bidso_skus + reference data and returns in legacy format.
    
    Args:
        buyer_sku_id: The buyer SKU ID (e.g., "FC_KS_BE_115")
        
    Returns:
        SKU dict in legacy format, or None if not found
    """
    if not buyer_sku_id:
        return None
    
    # Find in buyer_skus collection
    buyer_sku = await db.buyer_skus.find_one(
        {"buyer_sku_id": buyer_sku_id},
        {"_id": 0}
    )
    
    if not buyer_sku:
        return None
    
    # Get linked bidso_sku
    bidso_sku = None
    if buyer_sku.get("bidso_sku_id"):
        bidso_sku = await db.bidso_skus.find_one(
            {"bidso_sku_id": buyer_sku["bidso_sku_id"]},
            {"_id": 0}
        )
    
    # Get reference data
    brand = await _get_brand(buyer_sku.get("brand_id"))
    vertical = await _get_vertical(bidso_sku.get("vertical_id") if bidso_sku else None)
    model = await _get_model(bidso_sku.get("model_id") if bidso_sku else None)
    
    return _to_legacy_format(buyer_sku, bidso_sku, brand, vertical, model)


async def get_sku_by_sku_id(sku_id: str) -> Optional[dict]:
    """
    Alias for get_sku_by_buyer_id.
    
    In legacy model, sku_id = buyer_sku_id
    """
    return await get_sku_by_buyer_id(sku_id)


async def get_skus_by_buyer_ids(buyer_sku_ids: List[str]) -> List[dict]:
    """
    Batch fetch multiple SKUs by buyer_sku_id.
    
    More efficient than calling get_sku_by_buyer_id multiple times.
    
    Args:
        buyer_sku_ids: List of buyer SKU IDs
        
    Returns:
        List of SKU dicts in legacy format
    """
    if not buyer_sku_ids:
        return []
    
    # Batch fetch buyer_skus
    buyer_skus = await db.buyer_skus.find(
        {"buyer_sku_id": {"$in": buyer_sku_ids}},
        {"_id": 0}
    ).to_list(len(buyer_sku_ids))
    
    if not buyer_skus:
        return []
    
    # Get unique bidso_sku_ids
    bidso_ids = list(set(b.get("bidso_sku_id") for b in buyer_skus if b.get("bidso_sku_id")))
    
    # Batch fetch bidso_skus
    bidso_skus_list = await db.bidso_skus.find(
        {"bidso_sku_id": {"$in": bidso_ids}},
        {"_id": 0}
    ).to_list(len(bidso_ids)) if bidso_ids else []
    
    bidso_map = {b["bidso_sku_id"]: b for b in bidso_skus_list}
    
    # Ensure reference cache is loaded
    if not _brands_cache:
        await _refresh_reference_cache()
    
    # Build result
    results = []
    for buyer_sku in buyer_skus:
        bidso_sku = bidso_map.get(buyer_sku.get("bidso_sku_id"))
        brand = _brands_cache.get(buyer_sku.get("brand_id"), {})
        vertical = _verticals_cache.get(bidso_sku.get("vertical_id") if bidso_sku else "", {})
        model = _models_cache.get(bidso_sku.get("model_id") if bidso_sku else "", {})
        
        legacy_sku = _to_legacy_format(buyer_sku, bidso_sku, brand, vertical, model)
        if legacy_sku:
            results.append(legacy_sku)
    
    return results


async def get_skus_by_sku_ids(sku_ids: List[str]) -> List[dict]:
    """Alias for get_skus_by_buyer_ids"""
    return await get_skus_by_buyer_ids(sku_ids)


async def get_all_skus(
    query: dict = None,
    skip: int = 0,
    limit: int = 10000,
    include_inactive: bool = False
) -> List[dict]:
    """
    Get all SKUs with optional filtering.
    
    Args:
        query: MongoDB query dict for buyer_skus collection
        skip: Number of records to skip
        limit: Maximum records to return
        include_inactive: Whether to include inactive SKUs
        
    Returns:
        List of SKU dicts in legacy format
    """
    base_query = query or {}
    
    if not include_inactive:
        base_query["status"] = {"$ne": "INACTIVE"}
    
    # Fetch buyer_skus
    buyer_skus = await db.buyer_skus.find(
        base_query,
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    if not buyer_skus:
        return []
    
    # Get unique bidso_sku_ids
    bidso_ids = list(set(b.get("bidso_sku_id") for b in buyer_skus if b.get("bidso_sku_id")))
    
    # Batch fetch bidso_skus
    bidso_skus_list = await db.bidso_skus.find(
        {"bidso_sku_id": {"$in": bidso_ids}},
        {"_id": 0}
    ).to_list(len(bidso_ids)) if bidso_ids else []
    
    bidso_map = {b["bidso_sku_id"]: b for b in bidso_skus_list}
    
    # Ensure reference cache is loaded
    if not _brands_cache:
        await _refresh_reference_cache()
    
    # Build results
    results = []
    for buyer_sku in buyer_skus:
        bidso_sku = bidso_map.get(buyer_sku.get("bidso_sku_id"))
        brand = _brands_cache.get(buyer_sku.get("brand_id"), {})
        vertical = _verticals_cache.get(bidso_sku.get("vertical_id") if bidso_sku else "", {})
        model = _models_cache.get(bidso_sku.get("model_id") if bidso_sku else "", {})
        
        legacy_sku = _to_legacy_format(buyer_sku, bidso_sku, brand, vertical, model)
        if legacy_sku:
            results.append(legacy_sku)
    
    return results


async def get_skus_by_vertical(vertical_id: str, include_inactive: bool = False) -> List[dict]:
    """Get all SKUs for a specific vertical"""
    # Find bidso_skus with this vertical
    bidso_skus = await db.bidso_skus.find(
        {"vertical_id": vertical_id},
        {"_id": 0, "bidso_sku_id": 1}
    ).to_list(5000)
    
    bidso_ids = [b["bidso_sku_id"] for b in bidso_skus]
    
    if not bidso_ids:
        return []
    
    # Find buyer_skus linked to these bidso_skus
    query = {"bidso_sku_id": {"$in": bidso_ids}}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    buyer_skus = await db.buyer_skus.find(query, {"_id": 0}).to_list(10000)
    
    # Convert to legacy format
    return await get_skus_by_buyer_ids([b["buyer_sku_id"] for b in buyer_skus])


async def get_skus_by_brand(brand_id: str, include_inactive: bool = False) -> List[dict]:
    """Get all SKUs for a specific brand"""
    query = {"brand_id": brand_id}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    buyer_skus = await db.buyer_skus.find(query, {"_id": 0}).to_list(10000)
    
    return await get_skus_by_buyer_ids([b["buyer_sku_id"] for b in buyer_skus])


async def get_skus_by_model(model_id: str, include_inactive: bool = False) -> List[dict]:
    """Get all SKUs for a specific model"""
    # Find bidso_skus with this model
    bidso_skus = await db.bidso_skus.find(
        {"model_id": model_id},
        {"_id": 0, "bidso_sku_id": 1}
    ).to_list(5000)
    
    bidso_ids = [b["bidso_sku_id"] for b in bidso_skus]
    
    if not bidso_ids:
        return []
    
    # Find buyer_skus linked to these bidso_skus
    query = {"bidso_sku_id": {"$in": bidso_ids}}
    if not include_inactive:
        query["status"] = {"$ne": "INACTIVE"}
    
    buyer_skus = await db.buyer_skus.find(query, {"_id": 0}).to_list(10000)
    
    return await get_skus_by_buyer_ids([b["buyer_sku_id"] for b in buyer_skus])


async def search_skus(
    search: str,
    vertical_id: str = None,
    brand_id: str = None,
    model_id: str = None,
    limit: int = 100
) -> List[dict]:
    """
    Search SKUs with optional filters.
    
    Args:
        search: Search term (searches in buyer_sku_id, name, description)
        vertical_id: Optional vertical filter
        brand_id: Optional brand filter
        model_id: Optional model filter
        limit: Maximum results
        
    Returns:
        List of matching SKUs in legacy format
    """
    query = {"status": {"$ne": "INACTIVE"}}
    
    # Apply brand filter directly
    if brand_id:
        query["brand_id"] = brand_id
    
    # Apply search filter
    if search:
        query["$or"] = [
            {"buyer_sku_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"bidso_sku_id": {"$regex": search, "$options": "i"}}
        ]
    
    # For vertical/model filters, need to find matching bidso_skus first
    if vertical_id or model_id:
        bidso_query = {}
        if vertical_id:
            bidso_query["vertical_id"] = vertical_id
        if model_id:
            bidso_query["model_id"] = model_id
        
        bidso_skus = await db.bidso_skus.find(bidso_query, {"_id": 0, "bidso_sku_id": 1}).to_list(5000)
        bidso_ids = [b["bidso_sku_id"] for b in bidso_skus]
        
        if not bidso_ids:
            return []
        
        query["bidso_sku_id"] = {"$in": bidso_ids}
    
    buyer_skus = await db.buyer_skus.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    return await get_skus_by_buyer_ids([b["buyer_sku_id"] for b in buyer_skus])


async def count_skus(query: dict = None, include_inactive: bool = False) -> int:
    """Count SKUs matching query"""
    base_query = query or {}
    if not include_inactive:
        base_query["status"] = {"$ne": "INACTIVE"}
    
    return await db.buyer_skus.count_documents(base_query)


async def sku_exists(buyer_sku_id: str) -> bool:
    """Check if a SKU exists"""
    return await db.buyer_skus.count_documents({"buyer_sku_id": buyer_sku_id}) > 0


async def get_bidso_sku(bidso_sku_id: str) -> Optional[dict]:
    """Get a Bidso SKU directly (base product)"""
    return await db.bidso_skus.find_one({"bidso_sku_id": bidso_sku_id}, {"_id": 0})


async def get_buyer_skus_for_bidso(bidso_sku_id: str) -> List[dict]:
    """Get all buyer SKUs for a Bidso SKU"""
    buyer_skus = await db.buyer_skus.find(
        {"bidso_sku_id": bidso_sku_id},
        {"_id": 0}
    ).to_list(100)
    
    return await get_skus_by_buyer_ids([b["buyer_sku_id"] for b in buyer_skus])


# Refresh cache function - call periodically or after reference data changes
async def refresh_cache():
    """Force refresh of reference data cache"""
    await _refresh_reference_cache()
