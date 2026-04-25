# CHANGELOG

## April 25, 2026

### Buyer SKU BOM Cost Report (Reports → new tab)
- **NEW endpoint** `GET /api/rm-prices/buyer-sku-cost-detail/{buyer_sku_id}` — returns BOM line items with avg price (3-mo rolling from `rm_prices_history` → fallback to lowest tagged `vendor_rm_prices`), total BOM cost, avg ASP from `historical_sales`, margin % and margin value, plus source attribution counts (invoice/vendor_map/missing).
- **NEW endpoint** `GET /api/rm-prices/buyer-sku-cost-export?vertical_code=&model_code=&brand_id=&buyer_sku_id=` — Excel export (Buyer SKU ID · RM ID · RM Description · Qty · Price). Filter resolution uses `bidso_sku_id` regex for vertical/model since those codes aren't denormalized on `buyer_skus`.
- **`/api/sku-management/buyer-skus`** — already supports `vertical_code` / `model_code` / `brand_id` filters via bidso_sku_id regex; enriched response now carries `vertical_code`, `model_code`, `brand_name`, `vertical_name`, `model_name`.
- **Frontend `Reports.js`** — new "Buyer SKU BOM Cost" tab with cascading dropdowns Vertical → Model → Brand → Buyer SKU, three KPI cards (BOM Cost / Avg ASP / Margin % colored by tier), full BOM table with per-row source badge (Invoice / Vendor map / No price) and Export Excel button.
- **Verified end-to-end** with `AD_KS_BE_010` (37 RMs · 5 invoice · 16 vendor map · 16 missing → cost Rs 1,752.87, ASP 810, margin -116.4%).

## April 23, 2026

### Training Module Framework + Branch Ops Pilot
- **New backend module** `services/training_pdf.py` (ReportLab) and `routes/training_routes.py`
- **Endpoints:** `GET /api/training/modules`, `GET /api/training/branch-ops/download`
- **Capture script:** `scripts/capture_branch_ops_screenshots.py` (Playwright) — logs in, navigates Branch Ops, captures 8 screenshots of the real flow (sidebar, dashboard, filters, row, complete dialog, pre-check OK, pre-check shortage, completed row), writes `flow_metadata.json`
- **Added `reportlab==4.4.10`** + `playwright` + `pdf2image`; installed `poppler-utils` for PDF render validation
- **Output:** 11-page A4 PDF (1.1 MB) with cover, 8 sections, 8 real screenshots, I/O tables, FAQ
- **Bug fixed during build:** 3 unawaited `generate_rm_description(...)` calls in `branch_ops_routes.py` — was causing 500 on `/branch-ops/schedules/{id}/complete`, `/branch-ops/rm-consumption/export`, and one more path

### Vendor × RM Price Mapping
- **NEW `GET /api/vendor-rm-prices/export`** — Excel download with exactly: Vendor ID | Vendor Name | RM ID | RM Description | Price | Currency | Last Invoice Date (derived from `rm_prices_history` max date per vendor+rm combo)
- **NEW `GET /api/vendor-rm-prices/template`** — 4-sheet workbook (main + Instructions + Vendors reference + RM IDs reference)
- **NEW `POST /api/vendor-rm-prices/bulk-upload?mode=upsert|replace-vendor`** — bulk Vendor↔RM↔Price mapping upload with row-level validation
- **NEW `POST /api/vendors/bulk-upload`** — missing vendor master bulk upload (was 405, now live)
- **NEW `GET /api/vendors/{vendor_id}`** — was missing (caused "Failed to fetch vendor details" error). Returns vendor + enriched RM prices with description/category
- **Frontend Vendor Management toolbar (new buttons):** Vendor Template · **Price Template** · Export · **Export Prices** · Bulk Upload Vendors · **Bulk Upload Prices**
- Upload result card enhanced with error drilldown

### Event System Instrumentation
- **New EventTypes:** `SCHEDULE_UPLOAD`, `SCHEDULE_COMPLETED`, `RM_INWARD_RECEIVED`
- **Publishers wired:** CPC production plan upload, CPC schedule completion, IBT create/dispatch/receive, RM Inward bill create
- **Aligned subscriber** `handle_ibt_completed` to read new multi-item payload (source_branch/destination_branch/item_count/total_dispatched/total_received/total_variance/has_shortage)
- All publishers wrapped in try/except → can't break business flow
- Verified: 1 `SCHEDULE_COMPLETED` event fired during testing landed in `db.events`; `handle_ibt_completed` writes audit_logs correctly with `reference_code=transfer_code`

### RM Export — Category-specific columns
- **Frontend `RMRepository.js`** — "Export All RMs" now produces a workbook with ONE sheet per category (INP, INM, ACC, ELC, PM, LB, BS, SP, MB, POLY…). Each sheet has common columns (RM ID, Description, UOM, Dual UOM, HSN, GST, etc.) + category-specific columns pulled dynamically from `rm_categories.description_columns` (e.g., INP gets: Mould Code, Model Name, Part Name, Colour, Mb, Per Unit Weight, Unit)

### Historical Upload Templates — Reference Tabs Added
- **`Reports.js downloadTemplate()`** — Historical Sales template now includes **Customers** reference sheet (Customer ID + Name via `/api/buyers`); Historical Production template now includes **Branches** reference sheet (Branch ID + Name via `/api/branches`)
- **`rm_price_routes.py /template`** — added **Vendors** reference tab (Vendor ID + Name, 505 rows)

### Admin Password Fix for Deployment
- **`server.py`** line 117 — changed seeded admin password from `admin123` to `bidso123` to match `test_credentials.md`
- **`.gitignore`** — rewrote (removed malformed `-e` history artifacts); `memory/test_credentials.md` now excluded

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
