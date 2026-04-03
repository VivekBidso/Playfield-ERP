# Branch Ops

**Route**: `/branch-ops`  
**Access**: MASTER_ADMIN, BRANCH_OPS_USER  
**Frontend**: `/app/frontend/src/pages/BranchOps.js`

---

## Overview

Branch-level operations management. Handles production execution, inventory tracking, and daily operations for factory floor users.

---

## Key Features

### Production Schedules
- View assigned schedules for the branch
- Update status: PENDING → IN_PROGRESS → COMPLETED
- Record actual completion dates
- Track variance (planned vs actual)

### Inventory Management
- View branch RM inventory
- Record stock adjustments
- Track stock movements

### Daily Operations
- Production log entries
- Issue reporting
- Shift handover notes

---

## Schedule Status Flow

```
PENDING → IN_PROGRESS → COMPLETED
                     → PARTIAL_COMPLETE (Future)
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/branch-ops/schedules?branch={branch}` | Branch schedules |
| PUT | `/api/branch-ops/schedules/{id}/status` | Update status |
| GET | `/api/branch-rm-inventory/{branch}` | Branch inventory |
| POST | `/api/branch-ops/stock-adjustment` | Adjust stock |
| GET | `/api/branch-ops/production-log` | Production log |

---

## Database Collections

- `branch_schedules`
- `branch_rm_inventory`
- `rm_stock_movements`
- `production_logs`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/BranchOps.js`
- **Backend**: `/app/backend/routes/branch_ops_routes.py`

