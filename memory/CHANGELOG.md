# CHANGELOG

## April 17, 2026

### Inventory Consolidation & Dedup
- **Unified FG inventory** into single `branch_sku_inventory` collection — eliminated `fg_inventory` dual-write
- **Standardized `buyer_sku_id`** across all FG inventory code (was mixed `sku_id` / `buyer_sku_id`)
- **Inventory reads** now aggregate by key fields (rm_id+branch / buyer_sku_id+branch), show only non-zero stock
- **Atomic writes** — all inventory writes use `update_one(..., upsert=True)` preventing future duplicate rows
- **Dedup migration** — `POST /api/admin/dedup-inventory` merges existing duplicates (sums stock, removes extras)
- **Files changed:** production_routes.py, quality_routes.py, branch_ops_routes.py, cpc_routes.py, inventory_routes.py, demand_routes.py, report_routes.py, sku_routes.py, rm_routes.py, procurement_routes.py, admin_db_routes.py, models/core.py

### RM Description Unification
- Fixed `generate_rm_name()` in `services/utils.py` — was using pipe (`|`), now uses hyphen (` - `)
- Fixed `generate_rm_description()` in `sku_management_routes.py` — was using underscore (`_`), now reads from `rm_categories` DB
- All description generation paths now consistent: hyphen-separated, reading from DB config

### IBT Stock Filter
- Added `GET /api/ibt-transfers/branch-stock/{type}/{branch}` — returns only items with non-zero stock
- Item dropdown in IBT create form loads stock-filtered items with quantity shown in parentheses
- Uses aggregation to group duplicates and exclude zero-stock items

## April 15-16, 2026

### Zoho Books Integration — Tax & Account Dropdowns
- Added **Tax dropdown** fetching all 8 taxes from Zoho Books (GST 18%, IGST18, GST5, etc.) with correct `tax_id` in bill payload
- Added `GET /api/zoho/taxes` endpoint
- Added **Account dropdown** per line item from Zoho Chart of Accounts (85 expense accounts)
- Added `GET /api/zoho/accounts` endpoint with proper error surfacing for auth scope issues
- Auto reverse-charge for unregistered vendors (no GST number)
- Vendor GST number passed to Zoho on contact creation (`gst_treatment: business_gst`)
- Exchanged new grant token for `ZohoBooks.fullaccess.all` scope
- E2E tested: bill created with IGST18 + account_id → synced to Zoho Books

### Previous Session (carried over)
- RM descriptions permanently stored in DB with backfill
- SKU Management BOM Export optimized (fixed 504 timeout)
- BOM Export file corruption fixed (file-saver with correct MIME types)
- Data Integrity feature for orphaned buyer SKUs
- Zoho Books OAuth token exchange and bill creation
