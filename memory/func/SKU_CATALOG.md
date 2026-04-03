# SKU Catalog (Demand SKU View)

**Route**: `/demand-sku-view`  
**Access**: MASTER_ADMIN, DEMAND_PLANNER  
**Frontend**: `/app/frontend/src/pages/DemandSKUView.js`

---

## Overview

Read-only catalog view of all SKUs for demand planners. Shows SKU hierarchy and available variants without edit capabilities.

---

## Key Features

### SKU Browser
- Filter by Vertical, Model, Brand
- Search by SKU ID or name
- View SKU details and variants

### Hierarchy View
- Vertical → Model → Bidso SKU → Buyer SKU

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/verticals` | Vertical list |
| GET | `/api/models` | Model list |
| GET | `/api/sku-management/bidso-skus` | Bidso SKUs |
| GET | `/api/sku-management/buyer-skus` | Buyer SKUs |

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/DemandSKUView.js`

