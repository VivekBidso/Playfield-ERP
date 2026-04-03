# Dispatch Lots

**Route**: `/dispatch-lots`  
**Access**: MASTER_ADMIN, DEMAND_PLANNER, LOGISTICS_COORDINATOR  
**Frontend**: `/app/frontend/src/pages/DispatchLots.js`

---

## Overview

Manages dispatch lots that group forecasts for shipment. Tracks production progress, inventory allocation, and dispatch readiness.

---

## Key Features

### Dashboard Summary
- Cards: Total Lots, In Progress, Ready to Dispatch, Completed
- Notifications panel for delays and upcoming completions

### Lot Management
- Create lots from confirmed forecasts
- Add/remove forecast lines
- Track per-line production status

### Bulk Upload
- Upload lots from Excel
- Links forecasts to lots

### Detailed Lot View
- Click lot to see all line items
- Per-line: Scheduled Date, Actual Completion, Inventory Status
- Visual indicators: In Stock (green), Partial (yellow), No Stock (red)

### Inventory Indicators
- Checks branch inventory against lot requirements
- FIFO allocation logic

---

## Lot Lifecycle

```
DRAFT → CONFIRMED → IN_PRODUCTION → READY_TO_DISPATCH → DISPATCHED
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatch-lots` | List lots |
| POST | `/api/dispatch-lots` | Create lot |
| GET | `/api/dispatch-lots/{id}` | Lot details |
| PUT | `/api/dispatch-lots/{id}` | Update lot |
| GET | `/api/dispatch-lots/dashboard-summary` | Summary stats |
| POST | `/api/dispatch-lots/bulk-upload` | Bulk upload |
| GET | `/api/dispatch/by-forecast/{id}` | Lots by forecast |

---

## Database Collections

- `dispatch_lots` - Lot headers
- `dispatch_lot_lines` - Line items with production dates

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/DispatchLots.js`
- **Backend**: `/app/backend/routes/demand_routes.py`

