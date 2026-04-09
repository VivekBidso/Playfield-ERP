"""
Database Explorer Admin Routes
Allows Master Admin users to browse and query MongoDB databases
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import os
from pydantic import BaseModel

router = APIRouter(tags=["Admin - Database Explorer"])

# Get MongoDB client
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)

# Databases to expose (security - don't expose system DBs)
# Will auto-discover non-system databases
SYSTEM_DATABASES = ['admin', 'config', 'local']  # Always exclude these


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    
    result = {}
    for key, value in doc.items():
        if key == '_id':
            result[key] = str(value)
        elif hasattr(value, 'isoformat'):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        else:
            result[key] = value
    return result


@router.get("/admin/db-explorer/databases")
async def list_databases():
    """List all available databases with their stats"""
    try:
        all_dbs = await client.list_database_names()
        
        databases = []
        for db_name in all_dbs:
            # Skip system databases
            if db_name in SYSTEM_DATABASES:
                continue
                
            db = client[db_name]
            collections = await db.list_collection_names()
            
            # Get total document count
            total_docs = 0
            for coll in collections:
                try:
                    count = await db[coll].count_documents({})
                    total_docs += count
                except:
                    pass
            
            databases.append({
                "name": db_name,
                "collections_count": len(collections),
                "total_documents": total_docs
            })
        
        return {
            "databases": sorted(databases, key=lambda x: -x['total_documents']),
            "total": len(databases)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/db-explorer/databases/{db_name}/collections")
async def list_collections(db_name: str):
    """List all collections in a database with document counts"""
    if db_name in SYSTEM_DATABASES:
        raise HTTPException(status_code=403, detail=f"Access denied to system database: {db_name}")
    
    try:
        db = client[db_name]
        collection_names = await db.list_collection_names()
        
        collections = []
        for coll_name in collection_names:
            count = await db[coll_name].count_documents({})
            
            # Get sample document to show schema
            sample = await db[coll_name].find_one({}, {"_id": 0})
            schema_keys = list(sample.keys()) if sample else []
            
            collections.append({
                "name": coll_name,
                "document_count": count,
                "schema_keys": schema_keys[:10]  # First 10 keys
            })
        
        return {
            "database": db_name,
            "collections": sorted(collections, key=lambda x: -x['document_count']),
            "total": len(collections)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QueryRequest(BaseModel):
    filter: dict = {}
    projection: dict = {}
    sort_field: str = ""
    sort_order: int = -1
    limit: int = 50
    skip: int = 0


@router.post("/admin/db-explorer/databases/{db_name}/collections/{collection}/query")
async def query_collection(
    db_name: str,
    collection: str,
    query: QueryRequest
):
    """Query a collection with filters"""
    if db_name in SYSTEM_DATABASES:
        raise HTTPException(status_code=403, detail=f"Access denied to system database: {db_name}")
    
    try:
        db = client[db_name]
        coll = db[collection]
        
        # Build query
        cursor = coll.find(query.filter, query.projection or {"_id": 0})
        
        # Apply sort
        if query.sort_field:
            cursor = cursor.sort(query.sort_field, query.sort_order)
        
        # Apply pagination
        cursor = cursor.skip(query.skip).limit(min(query.limit, 100))  # Max 100 docs
        
        documents = await cursor.to_list(100)
        total = await coll.count_documents(query.filter)
        
        return {
            "database": db_name,
            "collection": collection,
            "documents": [serialize_doc(doc) for doc in documents],
            "returned": len(documents),
            "total": total,
            "skip": query.skip,
            "limit": query.limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/db-explorer/databases/{db_name}/collections/{collection}/sample")
async def get_sample_documents(
    db_name: str,
    collection: str,
    limit: int = Query(10, ge=1, le=100)
):
    """Get sample documents from a collection"""
    if db_name in SYSTEM_DATABASES:
        raise HTTPException(status_code=403, detail=f"Access denied to system database: {db_name}")
    
    try:
        db = client[db_name]
        coll = db[collection]
        
        documents = await coll.find({}, {"_id": 0}).limit(limit).to_list(limit)
        total = await coll.count_documents({})
        
        return {
            "database": db_name,
            "collection": collection,
            "documents": [serialize_doc(doc) for doc in documents],
            "returned": len(documents),
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/db-explorer/databases/{db_name}/collections/{collection}/search")
async def search_collection(
    db_name: str,
    collection: str,
    field: str = Query(..., description="Field to search"),
    value: str = Query(..., description="Value to search for"),
    exact: bool = Query(False, description="Exact match or contains"),
    limit: int = Query(20, ge=1, le=100)
):
    """Search a collection by field value"""
    if db_name in SYSTEM_DATABASES:
        raise HTTPException(status_code=403, detail=f"Access denied to system database: {db_name}")
    
    try:
        db = client[db_name]
        coll = db[collection]
        
        # Build search filter
        if exact:
            filter_query = {field: value}
        else:
            filter_query = {field: {"$regex": value, "$options": "i"}}
        
        documents = await coll.find(filter_query, {"_id": 0}).limit(limit).to_list(limit)
        total = await coll.count_documents(filter_query)
        
        return {
            "database": db_name,
            "collection": collection,
            "search": {"field": field, "value": value, "exact": exact},
            "documents": [serialize_doc(doc) for doc in documents],
            "returned": len(documents),
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/db-explorer/compare/{collection}")
async def compare_across_databases(
    collection: str,
    field: str = Query(..., description="Field to search by (e.g., rm_id)"),
    value: str = Query(..., description="Value to find")
):
    """Compare a document across all databases"""
    results = []
    
    # Get all non-system databases dynamically
    all_dbs = await client.list_database_names()
    target_dbs = [db for db in all_dbs if db not in SYSTEM_DATABASES]
    
    for db_name in target_dbs:
        try:
            db = client[db_name]
            
            # Check if collection exists
            collections = await db.list_collection_names()
            if collection not in collections:
                results.append({
                    "database": db_name,
                    "found": False,
                    "reason": "Collection not found"
                })
                continue
            
            # Find document
            doc = await db[collection].find_one({field: value}, {"_id": 0})
            
            if doc:
                results.append({
                    "database": db_name,
                    "found": True,
                    "document": serialize_doc(doc)
                })
            else:
                results.append({
                    "database": db_name,
                    "found": False,
                    "reason": "Document not found"
                })
        except Exception as e:
            results.append({
                "database": db_name,
                "found": False,
                "reason": str(e)
            })
    
    return {
        "collection": collection,
        "search": {"field": field, "value": value},
        "results": results
    }


@router.get("/admin/db-explorer/databases/{db_name}/collections/{collection}/aggregate")
async def aggregate_collection(
    db_name: str,
    collection: str,
    group_by: str = Query(..., description="Field to group by"),
    limit: int = Query(20, ge=1, le=100)
):
    """Get aggregated counts by a field"""
    if db_name in SYSTEM_DATABASES:
        raise HTTPException(status_code=403, detail=f"Access denied to system database: {db_name}")
    
    try:
        db = client[db_name]
        coll = db[collection]
        
        pipeline = [
            {"$group": {"_id": f"${group_by}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        
        results = await coll.aggregate(pipeline).to_list(limit)
        
        return {
            "database": db_name,
            "collection": collection,
            "group_by": group_by,
            "results": [{"value": r["_id"], "count": r["count"]} for r in results]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
