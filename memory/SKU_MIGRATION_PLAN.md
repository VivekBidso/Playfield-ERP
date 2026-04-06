# SKU Data Model Migration Plan

## Objective
Migrate all code from legacy `skus` collection to use `bidso_skus` + `buyer_skus` collections.

## Current State
- **Legacy `skus` collection**: 711 records, 56 code references across 9 files
- **New `bidso_skus` collection**: 258 records (base products)
- **New `buyer_skus` collection**: 693 records (branded variants)

## Data Model Mapping

### Legacy → New Field Mapping
```
LEGACY (skus)              NEW MODEL
─────────────              ─────────
sku_id (buyer)        →    buyer_skus.buyer_sku_id
bidso_sku             →    buyer_skus.bidso_sku_id → bidso_skus.bidso_sku_id
description           →    buyer_skus.description OR bidso_skus.name
brand                 →    buyer_skus.brand_id → brands.name
brand_id              →    buyer_skus.brand_id
vertical              →    bidso_skus.vertical_id → verticals.name
vertical_id           →    bidso_skus.vertical_id
model                 →    bidso_skus.model_id → models.name
model_id              →    bidso_skus.model_id
```

### Sample Legacy Record (skus):
```json
{
  "id": "7c0d544c-ebaf-46ca-ba73-ba8f4dc51183",
  "sku_id": "FC_KS_BE_115",
  "bidso_sku": "KS_BE_115",
  "buyer_sku_id": "FC_KS_BE_115",
  "description": "Kids scooter with LED wheels_Green",
  "brand": "Firstcry",
  "brand_id": "7c634a94-fbf2-4bd8-9ad4-0962c1573c9f",
  "vertical": "Scooter",
  "vertical_id": "ead95105-111e-46ab-b00a-56d851902914",
  "model": "Blaze",
  "model_id": "9e4a819e-a58a-46fa-8045-71d8e4234646"
}
```

### New Model Records:

**bidso_skus:**
```json
{
  "id": "1a158f21-a08e-42ba-a656-7582885b02e1",
  "bidso_sku_id": "KS_PE_001",
  "vertical_id": "ead95105-111e-46ab-b00a-56d851902914",
  "vertical_code": "KS",
  "model_id": "6a83bda7-295e-40ec-a46e-ded88b3b512e",
  "model_code": "PE",
  "name": "Kids Scooter Pulse Test",
  "status": "ACTIVE"
}
```

**buyer_skus:**
```json
{
  "id": "9985e559-ada6-4b7d-a7a3-c79d3f4dba26",
  "buyer_sku_id": "KM_SC_BN_001",
  "bidso_sku_id": "SC_BN_001",
  "brand_id": "49e8b162-3520-4331-8010-d2372a7b15b0",
  "brand_code": "KM",
  "name": "Kidsmate - Rideon - Bentley",
  "status": "ACTIVE"
}
```

## Files To Migrate

| File | References | Priority |
|------|------------|----------|
| sku_routes.py | 17 | 1 (Core CRUD) |
| demand_routes.py | 12 | 2 (Critical - Forecasting) |
| cpc_routes.py | 8 | 3 (Critical - Production) |
| production_routes.py | 6 | 4 (Production batches) |
| demand_hub_routes.py | 4 | 5 (Sync functions) |
| sku_management_routes.py | 3 | 6 (Bulk import) |
| tech_ops_routes.py | 3 | 7 |
| report_routes.py | 2 | 8 |
| branch_ops_routes.py | 1 | 9 |

## Migration Phases

### Phase 1: Create Helper Service
Create `/app/backend/services/sku_service.py` with reusable functions:

```python
async def get_sku_by_buyer_id(buyer_sku_id: str) -> dict:
    """Get SKU by buyer_sku_id, joining buyer_skus + bidso_skus + reference data"""
    
async def get_sku_by_bidso_id(bidso_sku_id: str) -> dict:
    """Get base Bidso SKU"""
    
async def get_skus_by_buyer_ids(buyer_sku_ids: list) -> list:
    """Batch fetch multiple SKUs"""
    
async def get_all_skus(query: dict = None) -> list:
    """Get all SKUs with full enrichment"""
```

These functions MUST return data in the SAME format as legacy `skus` collection to avoid breaking existing code.

### Phase 2: Migrate Each File
Replace `db.skus.find_one({"sku_id": xxx})` with `await get_sku_by_buyer_id(xxx)`
Replace `db.skus.find({"sku_id": {"$in": xxx}})` with `await get_skus_by_buyer_ids(xxx)`

### Phase 3: Data Sync
Ensure all legacy `skus` data exists in new collections:
- Each `skus` record should have corresponding `buyer_skus` record
- Each unique `bidso_sku` should have corresponding `bidso_skus` record

### Phase 4: Cleanup
- Remove `skus` collection references
- Update bulk import to only use new model
- Delete legacy `skus` collection (optional, can keep as backup)

## Important Notes

1. **Backward Compatibility**: Helper functions return data in legacy format so frontend doesn't break
2. **sku_id vs buyer_sku_id**: In legacy, `sku_id` = `buyer_sku_id`. Maintain this.
3. **Lookups**: Most code looks up by `sku_id` (which is the buyer SKU ID)
4. **Testing**: Test each module after migration before proceeding

## Files of Reference
- `/app/backend/routes/sku_routes.py` - Core SKU CRUD
- `/app/backend/routes/demand_routes.py` - Forecasting
- `/app/backend/routes/cpc_routes.py` - Production planning
- `/app/backend/routes/production_routes.py` - Production batches
- `/app/backend/services/` - Where helper service should go

## Credentials
- Test user: admin@factory.com / bidso123
- MongoDB: Uses test_database (from .env)
