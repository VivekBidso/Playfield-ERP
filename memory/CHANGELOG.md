# CHANGELOG

## April 21, 2026

### RM Price History & Margin Calculation (P0 complete)
- **New collection** `rm_prices_history` storing { date, invoice_no, vendor_id, vendor_name, rm_id, price_per_unit, month_key }
- **New backend module** `/app/backend/routes/rm_price_routes.py` registered at `/api/rm-prices/*`
- **Endpoints:**
  - `POST /rm-prices/upload` — Excel (Date | Invoice No | Vendor ID | RM ID | Price); append/overwrite modes; validates vendor + RM IDs
  - `GET /rm-prices/template` — downloadable Excel template with instructions
  - `GET /rm-prices/stats` — totals, unique counts, date range, rolling window start
  - `GET /rm-prices/avg-prices?window_months=3` — simple rolling 3-month average per RM with rm_name/category enrichment
  - `GET /rm-prices/history` — paginated invoice list with rm_id/vendor_id filters
  - `GET /rm-prices/bom-cost/{buyer_sku_id}` — derived BOM cost + per-RM line breakdown (avg_price × qty)
  - `POST /rm-prices/bom-cost-bulk` — compact map of costs for a list of SKU IDs (table enrichment)
  - `GET /rm-prices/margin-report` — per-SKU Margin % = (Avg ASP − BOM Cost)/ASP × 100 joining historical_sales; totals include overall_margin_pct + gross profit
  - `DELETE /rm-prices/history` — admin clear-all
- **Frontend — RM Repository:** New "Price History" tab with upload widget, 4 stat cards, average price table, invoice history log with filters
- **Frontend — SKU Management (Buyer SKU tab):** New "BOM Cost" column (bulk-fetched on page load) + "Derived BOM Cost" emerald panel in the View BOM dialog with per-RM avg price/line cost breakdown and missing-price warnings
- **Frontend — Reports:** New "Margin Report" tab showing totals (revenue/COGS/gross profit/overall margin %), per-SKU table with colour-coded margin % (≥30% green, ≥10% amber, else red), month range filter + Excel export
- **Testing:** 11/11 backend pytest cases passed; all frontend data-testids verified by testing agent

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
