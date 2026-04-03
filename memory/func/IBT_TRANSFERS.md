# IBT Transfers (Inter-Branch Transfers)

**Route**: `/ibt`  
**Access**: MASTER_ADMIN, LOGISTICS_COORDINATOR, BRANCH_OPS_USER  
**Frontend**: `/app/frontend/src/pages/IBT.js`

---

## Overview

Manages inventory transfers between branches. Handles both SKU and RM transfers.

---

## Key Features

### Transfer Request
- Select source branch
- Select destination branch
- Choose items (SKU or RM)
- Specify quantities
- Add notes/reason

### Transfer Tracking
- Status tracking
- In-transit visibility
- Receipt confirmation

### Transfer Types
- SKU transfers
- RM transfers

---

## Transfer Flow

```
REQUESTED → APPROVED → DISPATCHED → IN_TRANSIT → RECEIVED
                    → REJECTED
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inter-branch-transfers` | Transfer list |
| POST | `/api/inter-branch-transfers` | Create transfer |
| PUT | `/api/inter-branch-transfers/{id}/status` | Update status |
| PUT | `/api/inter-branch-transfers/{id}/receive` | Confirm receipt |

---

## Database Collections

- `inter_branch_transfers`
- `branch_inventory`
- `branch_rm_inventory`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/IBT.js`
- **Backend**: `/app/backend/routes/logistics_routes.py` (Note: Duplicate routes exist in `procurement_routes.py` - needs consolidation)

---

## Technical Debt

⚠️ **IBT routes are duplicated** across `procurement_routes.py` and `report_routes.py`. Needs consolidation into `logistics_routes.py`.

