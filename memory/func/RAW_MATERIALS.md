# RM Stock View (formerly Raw Materials)

**Route**: `/raw-materials`  
**Access**: MASTER_ADMIN, BRANCH_OPS_USER, PROCUREMENT_OFFICER, CPC_PLANNER, FINANCE_VIEWER  
**Frontend**: `/app/frontend/src/pages/RawMaterials.js`

---

## Overview

**Read-only** branch-level RM inventory view. Shows stock levels per branch. For RM master data management, use **RM Repository** instead.

---

## Key Features

### Branch Stock View
- Shows RM stock levels **for the selected branch**
- Displays: RM ID, Category, Description, **Current Stock**
- Filter by category, type, model, colour, brand
- Search by RM ID

### Export
- Export filtered RM list with stock levels to Excel

---

## Access Control Update (April 3, 2026)

| Role | Access |
|------|--------|
| MASTER_ADMIN | ✅ |
| BRANCH_OPS_USER | ✅ |
| PROCUREMENT_OFFICER | ✅ |
| CPC_PLANNER | ✅ (NEW) |
| FINANCE_VIEWER | ✅ (NEW) |
| TECH_OPS_ENGINEER | ❌ (REMOVED - use RM Repository) |
| DEMAND_PLANNER | ❌ |

---

## Features Removed

The following features were moved to **RM Repository** (`/rm-repository`):
- Add RM
- Bulk Upload
- Templates
- Data Migration

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/raw-materials` | RM master list |
| GET | `/api/branch-rm-inventory/{branch}` | Branch stock levels |

---

## Database Collections

- `raw_materials` - RM master (read-only here)
- `branch_rm_inventory` - Stock levels per branch

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/RawMaterials.js`
- **Backend**: `/app/backend/routes/rm_routes.py`

