# Dashboard

**Route**: `/dashboard`  
**Access**: ALL USERS  
**Frontend**: `/app/frontend/src/pages/Dashboard.js`

---

## Overview

The Dashboard provides role-specific overview of operations. It automatically detects user role and shows relevant data.

---

## Features by Role

### For DEMAND_PLANNER
- Forecast statistics (pending, confirmed, total)
- Recent dispatch lots
- Forecast pipeline summary

### For Other Roles (Branch Ops, Admin, etc.)
- Branch inventory stats
- Production data charts (bar chart)
- Recent activity log
- Inter-branch transfer summary
- Quick transfer creation dialog

---

## Key Components

### Stats Cards
- Total SKUs in branch
- Total inventory value
- Low stock alerts count
- Recent transfers count

### Production Chart
- Bar chart showing daily production by branch
- Uses Recharts library

### Transfer Dialog
- Create inter-branch stock transfers
- SKU search with vertical/model filters
- From/To branch selection
- Quantity and notes

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats?branch={branch}` | Get branch stats |
| GET | `/api/demand/stats` | Demand planner stats |
| GET | `/api/forecasts` | List forecasts |
| GET | `/api/dispatch-lots` | List dispatch lots |
| POST | `/api/inter-branch-transfers` | Create transfer |

---

## Database Collections

- `skus` - SKU master data
- `branch_inventory` - Branch stock levels
- `inter_branch_transfers` - Transfer records
- `forecasts` - Demand forecasts

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Dashboard.js`
- **Backend**: `/app/backend/routes/dashboard_routes.py`
- **Store**: `/app/frontend/src/store/branchStore.js`

