#!/usr/bin/env python3
"""
MongoDB Data Import Script for Production
Imports SKUs and related data from JSON files exported from dev environment

USAGE:
  python3 import_data.py --mongo-url "mongodb+srv://user:pass@cluster.mongodb.net/your_db"
  
OR set environment variable:
  export PROD_MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/your_db"
  python3 import_data.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
import argparse
from datetime import datetime

INPUT_DIR = "./data"  # Same directory where JSON files are located

async def import_data(mongo_url: str, db_name: str, dry_run: bool = False):
    print("=" * 60)
    print("MONGODB DATA IMPORT FOR PRODUCTION")
    print("=" * 60)
    
    if dry_run:
        print("\n*** DRY RUN MODE - No data will be written ***\n")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Test connection
    try:
        await client.admin.command('ping')
        print(f"✓ Connected to MongoDB: {db_name}")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return
    
    import_order = [
        ("6b_verticals.json", "verticals", "id"),
        ("6c_brands.json", "brands", "id"),
        ("6a_models.json", "models", "id"),
        ("1_skus.json", "skus", "id"),
        ("2_buyer_skus.json", "buyer_skus", "buyer_sku_id"),
        ("3_sku_branch_assignments.json", "sku_branch_assignments", None),  # Composite key
        ("4_sku_rm_mapping.json", "sku_rm_mapping", None),  # Composite key
        ("5_common_bom.json", "common_bom", None),  # Composite key
    ]
    
    total_imported = 0
    total_skipped = 0
    
    for filename, collection_name, unique_field in import_order:
        filepath = os.path.join(INPUT_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"\n⚠ Skipping {filename} (file not found)")
            continue
        
        with open(filepath, "r") as f:
            data = json.load(f)
        
        if not data:
            print(f"\n⚠ Skipping {filename} (empty)")
            continue
        
        print(f"\n{collection_name}: Processing {len(data)} records from {filename}...")
        
        collection = db[collection_name]
        imported = 0
        skipped = 0
        
        for doc in data:
            # Check if document already exists
            if unique_field:
                existing = await collection.find_one({unique_field: doc.get(unique_field)})
            elif collection_name == "sku_branch_assignments":
                existing = await collection.find_one({
                    "sku_id": doc.get("sku_id"),
                    "branch": doc.get("branch")
                })
            elif collection_name == "sku_rm_mapping":
                existing = await collection.find_one({
                    "sku_id": doc.get("sku_id"),
                    "rm_id": doc.get("rm_id")
                })
            elif collection_name == "common_bom":
                existing = await collection.find_one({
                    "bidso_sku_id": doc.get("bidso_sku_id"),
                    "rm_id": doc.get("rm_id")
                })
            else:
                existing = None
            
            if existing:
                skipped += 1
                continue
            
            if not dry_run:
                try:
                    await collection.insert_one(doc)
                    imported += 1
                except Exception as e:
                    print(f"   ✗ Error inserting: {e}")
            else:
                imported += 1
        
        print(f"   ✓ Imported: {imported}, Skipped (existing): {skipped}")
        total_imported += imported
        total_skipped += skipped
    
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE!")
    print("=" * 60)
    print(f"""
Summary:
  - Total Imported: {total_imported}
  - Total Skipped:  {total_skipped} (already existed)
  - Dry Run:        {dry_run}
""")
    
    client.close()

def main():
    parser = argparse.ArgumentParser(description="Import MongoDB data to production")
    parser.add_argument("--mongo-url", help="MongoDB connection URL", 
                       default=os.environ.get("PROD_MONGO_URL"))
    parser.add_argument("--db-name", help="Database name", default="test_database")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing data")
    
    args = parser.parse_args()
    
    if not args.mongo_url:
        print("ERROR: MongoDB URL required!")
        print("Use --mongo-url or set PROD_MONGO_URL environment variable")
        return
    
    asyncio.run(import_data(args.mongo_url, args.db_name, args.dry_run))

if __name__ == "__main__":
    main()
