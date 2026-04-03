# Demand Hub

**Route**: `/demand-hub`  
**Access**: MASTER_ADMIN, DEMAND_PLANNER  
**Frontend**: `/app/frontend/src/pages/DemandHub.js`

---

## Overview

Quick-entry interface for demand planners to create forecasts rapidly. Simplified form compared to full Demand page.

---

## Key Features

### Quick Forecast Entry
- Buyer selection
- SKU selection (filtered by buyer's brands)
- Quantity and price
- Target month/year
- One-click submit

### Recent Forecasts
- Shows last 10 created forecasts
- Quick status view

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/forecasts` | Create forecast |
| GET | `/api/forecasts?limit=10` | Recent forecasts |
| GET | `/api/buyers` | Buyer dropdown |
| GET | `/api/buyer-skus` | SKU dropdown |

---

## Database Collections

- `forecasts`
- `buyers`
- `buyer_skus`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/DemandHub.js`
- **Backend**: `/app/backend/routes/forecast_routes.py`

