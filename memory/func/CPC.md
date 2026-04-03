# CPC (Central Production Control)

**Route**: `/cpc`  
**Access**: MASTER_ADMIN, CPC_PLANNER  
**Frontend**: `/app/frontend/src/pages/CPC.js`

---

## Overview

CPC is the central production planning module. It takes confirmed forecasts and allocates them to branches based on capacity. Creates production schedules.

---

## Tabs

### 1. Planning Tab
- View confirmed demand forecasts
- Summary cards: Total Qty, Scheduled, Unscheduled
- Create production schedules from forecasts
- Dispatch Lots linkage (click Forecast Code)

### 2. Branch Schedules Tab
- View all branch production schedules
- Filter by date range and branch
- Schedule status: PENDING, IN_PROGRESS, COMPLETED

### 3. Capacity Tab
- View/Edit branch daily capacity
- Upload capacity templates
- Track utilization

---

## Key Features

### Schedule from Forecast
1. Click "Schedule" on a forecast row
2. Select target branch
3. System checks branch capacity
4. Enter quantity and target date
5. Creates production schedule

### Branch Capacity Management
- Units per day per branch
- System validates against capacity when scheduling

### Bulk Upload
- Upload branch schedules from Excel
- Uses Branch ID (BR_001) instead of names

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cpc/demand-forecasts` | Confirmed forecasts |
| GET | `/api/cpc/demand-forecasts/summary` | Summary stats |
| GET | `/api/cpc/branch-schedules` | All schedules |
| POST | `/api/cpc/branch-schedules` | Create schedule |
| GET | `/api/branches/capacity` | Branch capacities |
| PUT | `/api/branches/{id}/capacity` | Update capacity |
| GET | `/api/cpc/branches/reference` | Branch ID reference |
| POST | `/api/cpc/branch-schedules/bulk-upload` | Bulk upload |
| GET | `/api/cpc/branch-schedules/template` | Download template |

---

## Database Collections

- `forecasts` (status=CONFIRMED)
- `branch_schedules` - Production schedules
- `branches` - Branch capacity data

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/CPC.js`
- **Backend**: `/app/backend/routes/cpc_routes.py`

---

## Schedule Excel Template

| branch_id | sku_id | quantity | target_date | priority |
|-----------|--------|----------|-------------|----------|
| BR_001 | SKU123 | 100 | 2026-04-15 | HIGH |

