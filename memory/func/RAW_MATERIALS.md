# Raw Materials (Branch View)

**Route**: `/raw-materials`  
**Access**: MASTER_ADMIN, BRANCH_OPS_USER, PROCUREMENT_OFFICER, TECH_OPS_ENGINEER  
**Note**: NOT visible to DEMAND_PLANNER or CPC_PLANNER  
**Frontend**: `/app/frontend/src/pages/RawMaterials.js`

---

## Overview

Branch-level view of raw material inventory. Shows stock levels, movements, and allows stock adjustments.

---

## Key Features

### Inventory View
- Filter by branch
- Filter by RM category
- Search by RM ID
- Current stock levels

### Stock Movements
- View inward/outward movements
- Movement types: PURCHASE, PRODUCTION, ADJUSTMENT, TRANSFER
- Date range filtering

### Stock Adjustment
- Manual stock corrections
- Requires reason/notes
- Creates audit trail

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/branch-rm-inventory/{branch}` | Branch stock |
| GET | `/api/rm-stock-movements` | Movement history |
| POST | `/api/rm-stock-adjustment` | Adjust stock |
| GET | `/api/raw-materials` | RM master list |

---

## Database Collections

- `branch_rm_inventory`
- `rm_stock_movements`
- `raw_materials`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/RawMaterials.js`
- **Backend**: `/app/backend/routes/rm_routes.py`

