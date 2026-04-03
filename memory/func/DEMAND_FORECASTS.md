# Demand Forecasts

**Route**: `/demand`  
**Access**: MASTER_ADMIN, DEMAND_PLANNER  
**Frontend**: `/app/frontend/src/pages/Demand.js`

---

## Overview

Central hub for managing demand forecasts from buyers. Supports bulk upload, BOM expansion, pricing, and forecast confirmation workflow.

---

## Tabs

### 1. Forecasts Tab
- List all forecasts with filters (buyer, vertical, brand, model)
- Server-side pagination (50 per page)
- Expand forecast to see BOM breakdown
- Bulk selection for confirmation
- Link to Dispatch Lots (click Forecast ID)

### 2. Create/Upload Tab
- Single forecast creation form
- Bulk upload from Excel with validation
- Optional columns auto-fill from SKU master
- Error report download for invalid rows

---

## Forecast Lifecycle

```
DRAFT → CONFIRMED (by MASTER_ADMIN only)
```

- Only MASTER_ADMIN can confirm forecasts
- DEMAND_PLANNER can create/edit drafts

---

## Key Features

### Bulk Upload
- Excel columns: Buyer Name, Brand, Model, Part Name, Colour, Quantity, Price, Month, Year
- Optional columns auto-fill from SKU master
- Validates: Buyer exists, SKU exists
- Error report with row-level details

### BOM Expansion
- Click expand arrow to see RM requirements
- Shows: RM ID, Description, Qty Required, Wastage, Total

### Dispatch Lots Linkage
- Click Forecast ID to see linked dispatch lots
- Shows: Lot ID, Status, Quantities, Line items

### Export
- Filter by date range, buyer, brand, model
- Download as Excel

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forecasts` | List with pagination |
| POST | `/api/forecasts` | Create single forecast |
| POST | `/api/forecasts/parse-excel` | Parse bulk upload |
| POST | `/api/forecasts/bulk-create` | Confirm bulk upload |
| POST | `/api/forecasts/download-error-report` | Download errors |
| PUT | `/api/forecasts/{id}/confirm` | Confirm forecast |
| POST | `/api/forecasts/bulk-confirm` | Bulk confirm |
| GET | `/api/dispatch/by-forecast/{id}` | Get linked lots |

---

## Database Collections

- `forecasts` - Forecast records
- `skus` / `bidso_skus` / `buyer_skus` - SKU lookups
- `dispatch_lots` - Linked lots

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Demand.js`
- **Backend**: `/app/backend/routes/demand_routes.py`
- **Backend**: `/app/backend/routes/forecast_routes.py`

---

## Excel Upload Template

| buyer_name | brand | model | part_name | colour | quantity | price | month | year |
|------------|-------|-------|-----------|--------|----------|-------|-------|------|

