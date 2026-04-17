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



@router.post("/admin/migrate-sku-inventory-field")
async def migrate_sku_inventory_field():
    """
    Migration: Rename 'sku_id' → 'buyer_sku_id' in branch_sku_inventory collection.
    Only updates documents that have 'sku_id' but NOT 'buyer_sku_id'.
    Safe to run multiple times (idempotent).
    """
    from database import db
    
    # Count docs that need migration
    to_migrate = await db.branch_sku_inventory.count_documents({
        "sku_id": {"$exists": True},
        "buyer_sku_id": {"$exists": False}
    })
    
    if to_migrate == 0:
        already_done = await db.branch_sku_inventory.count_documents({"buyer_sku_id": {"$exists": True}})
        return {
            "message": "No migration needed. All documents already use buyer_sku_id.",
            "total_with_buyer_sku_id": already_done
        }
    
    # Rename sku_id → buyer_sku_id for all docs that have sku_id but not buyer_sku_id
    result = await db.branch_sku_inventory.update_many(
        {
            "sku_id": {"$exists": True},
            "buyer_sku_id": {"$exists": False}
        },
        {"$rename": {"sku_id": "buyer_sku_id"}}
    )
    
    # Verify
    remaining_old = await db.branch_sku_inventory.count_documents({
        "sku_id": {"$exists": True},
        "buyer_sku_id": {"$exists": False}
    })
    total_new = await db.branch_sku_inventory.count_documents({"buyer_sku_id": {"$exists": True}})
    
    return {
        "message": f"Migration complete. Renamed sku_id → buyer_sku_id in {result.modified_count} documents.",
        "migrated": result.modified_count,
        "remaining_old_field": remaining_old,
        "total_with_buyer_sku_id": total_new
    }



@router.post("/admin/migrate-fg-inventory-to-branch-sku")
async def migrate_fg_inventory_to_branch_sku():
    """
    Migration: Merge fg_inventory data into branch_sku_inventory.
    For each fg_inventory doc:
      - If a matching branch_sku_inventory doc exists (same buyer_sku_id + branch), 
        adds fg_inventory.quantity to current_stock
      - If not, creates a new branch_sku_inventory doc
    Safe to run multiple times. Does NOT delete fg_inventory (kept as backup).
    """
    from database import db
    
    fg_count = await db.fg_inventory.count_documents({})
    if fg_count == 0:
        return {"message": "No fg_inventory records to migrate.", "migrated": 0, "skipped": 0}
    
    # Get all fg_inventory docs
    fg_docs = await db.fg_inventory.find({}, {"_id": 0}).to_list(50000)
    
    # Build branch_id → branch_name lookup
    branches = await db.branches.find({}, {"_id": 0, "branch_id": 1, "name": 1}).to_list(100)
    branch_id_to_name = {b["branch_id"]: b["name"] for b in branches if b.get("branch_id")}
    
    migrated = 0
    skipped = 0
    errors = []
    
    for fg in fg_docs:
        try:
            buyer_sku_id = fg.get("buyer_sku_id") or fg.get("sku_id")
            if not buyer_sku_id:
                skipped += 1
                continue
            
            # Resolve branch name
            branch = fg.get("branch")
            if not branch and fg.get("branch_id"):
                branch = branch_id_to_name.get(fg["branch_id"])
            if not branch:
                errors.append(f"No branch for {buyer_sku_id}")
                skipped += 1
                continue
            
            quantity = fg.get("quantity", 0)
            if quantity <= 0:
                skipped += 1
                continue
            
            # Check if already exists in branch_sku_inventory
            existing = await db.branch_sku_inventory.find_one({
                "buyer_sku_id": buyer_sku_id,
                "branch": branch
            })
            
            if existing:
                # Add quantity to existing current_stock
                await db.branch_sku_inventory.update_one(
                    {"buyer_sku_id": buyer_sku_id, "branch": branch},
                    {"$inc": {"current_stock": quantity}}
                )
            else:
                # Create new doc
                import uuid
                await db.branch_sku_inventory.insert_one({
                    "id": str(uuid.uuid4()),
                    "buyer_sku_id": buyer_sku_id,
                    "branch": branch,
                    "current_stock": quantity,
                    "is_active": True,
                    "created_at": fg.get("created_at", "")
                })
            
            migrated += 1
        except Exception as e:
            errors.append(f"{buyer_sku_id}: {str(e)}")
            skipped += 1
    
    return {
        "message": f"Merged {migrated} fg_inventory records into branch_sku_inventory.",
        "fg_inventory_total": fg_count,
        "migrated": migrated,
        "skipped": skipped,
        "errors": errors[:20],
        "note": "fg_inventory collection kept as backup. You can drop it manually after verifying."
    }
