# Reports

**Route**: `/reports`  
**Access**: ALL USERS  
**Frontend**: `/app/frontend/src/pages/Reports.js`

---

## Overview

Centralized reporting module with multiple analytical reports. Available to all authenticated users.

---

## Available Reports

### 1. Production Summary Report
- Daily/weekly/monthly production by branch
- SKU-wise breakdown
- Target vs actual comparison

### 2. Inventory Report
- Current stock levels by branch
- Low stock alerts
- Stock aging analysis

### 3. Dispatch Report
- Dispatch lot status summary
- Buyer-wise dispatch history
- Pending dispatches

### 4. RM Consumption Report
- RM usage by branch
- Wastage tracking
- Trend analysis

---

## Key Features

### Filters
- Date range selection
- Branch filter
- Category/SKU filters
- Export to Excel

### Visualizations
- Charts and graphs
- Summary cards
- Trend lines

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/production-summary` | Production report |
| GET | `/api/reports/inventory` | Inventory report |
| GET | `/api/reports/dispatch` | Dispatch report |
| GET | `/api/reports/rm-consumption` | RM consumption |
| GET | `/api/reports/export` | Export to Excel |

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Reports.js`
- **Backend**: `/app/backend/routes/report_routes.py`

