# MRP Planning

**Route**: `/mrp`  
**Access**: MASTER_ADMIN, CPC_PLANNER, PROCUREMENT_OFFICER  
**Frontend**: `/app/frontend/src/pages/MRPDashboard.js`

---

## Overview

Material Requirements Planning dashboard. Shows RM requirements based on production schedules, calculates shortages, and generates procurement recommendations.

---

## Key Features

### Weekly Time-Phased View
- Shows RM requirements by week
- Columns: RM ID, Description, Current Stock, Week 1-4 Requirements
- Shortage highlighting

### Requirements Calculation
- Explodes BOMs from production schedules
- Aggregates by RM and time period
- Compares against current inventory

### Shortage Report
- RMs with insufficient stock
- Lead time considerations
- Procurement recommendations

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mrp/requirements` | RM requirements |
| GET | `/api/mrp/shortage-report` | Shortage analysis |
| GET | `/api/mrp/weekly-view` | Time-phased view |
| GET | `/api/cpc/rm-shortage-report` | CPC shortage report |

---

## Database Collections

- `branch_schedules` - Production schedules
- `common_boms` / `brand_specific_boms` - BOM data
- `branch_rm_inventory` - Current stock
- `raw_materials` - RM master

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/MRPDashboard.js`
- **Backend**: `/app/backend/routes/mrp_routes.py`

