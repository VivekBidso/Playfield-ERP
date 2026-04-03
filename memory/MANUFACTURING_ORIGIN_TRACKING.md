# Manufacturing Origin Tracking

**Status**: IMPLEMENTED
**Created**: April 3, 2026

---

## Overview

Tracks manufacturing origin of finished goods (SKUs) through the supply chain:
- When produced: Tagged with manufacturing unit (branch)
- When transferred (IBT): Origin preserved
- When dispatched: Origin displayed per line item

---

## How It Works

### 1. Production Completion
When a production schedule is marked as complete:
- System automatically creates a `stock_origin_ledger` entry
- `manufacturing_unit` = branch where production happened
- `production_date` = completion timestamp

### 2. Inter-Branch Transfer (IBT)
When stock is transferred:
- User enters SKU + Qty only (no batch selection)
- System uses **FIFO** to select oldest stock first
- Creates new entries at destination **preserving the original manufacturing_unit**

### 3. Dispatch
When a dispatch lot status becomes "DISPATCHED":
- System allocates stock using **FIFO**
- Stores `origin_breakdown` in each line item
- Displays "Made At" column in dispatch lot detail

---

## Data Model

### stock_origin_ledger Collection
```json
{
  "id": "uuid",
  "sku_id": "BIKE_001",
  "branch": "Unit 1",              // Current location
  "manufacturing_unit": "Unit 6",   // Where it was made (PRESERVED)
  "production_date": "2026-03-31",
  "arrival_date": "2026-04-02",     // When arrived at current branch
  "quantity": 100,
  "available_qty": 100,
  "production_schedule_id": "PS-001",
  "status": "AVAILABLE",
  "created_at": "timestamp"
}
```

### dispatch_lot_lines (Updated)
```json
{
  "sku_id": "BIKE_001",
  "quantity": 70,
  "origin_breakdown": [
    {"manufacturing_unit": "Unit 6", "quantity": 30, "production_date": "2026-03-28"},
    {"manufacturing_unit": "Unit 2", "quantity": 40, "production_date": "2026-03-29"}
  ],
  "origin_display": "Unit 6 (30), Unit 2 (40)"
}
```

---

## API Endpoints

### Get Origin Breakdown for Dispatch Lot
```
GET /api/dispatch-lots/{lot_id}/origin-breakdown
```

Response:
```json
{
  "lot_id": "DL-001",
  "dispatch_from": "Unit 1",
  "status": "DISPATCHED",
  "line_items": [
    {
      "sku_id": "BIKE_001",
      "quantity": 70,
      "origin_breakdown": [...],
      "origin_display": "Unit 6 (30), Unit 2 (40)"
    }
  ]
}
```

---

## UI Changes

### Dispatch Lot Detail View
- New "Made At" column in line items table
- Shows manufacturing origin badges (e.g., "Unit 6 (30), Unit 2 (40)")
- Purple badges for visual distinction

---

## Files Modified

### Backend
- `/app/backend/services/stock_origin_service.py` (NEW)
- `/app/backend/routes/cpc_routes.py` - Production completion creates origin entry
- `/app/backend/routes/procurement_routes.py` - IBT preserves origin
- `/app/backend/routes/demand_routes.py` - Dispatch allocates with FIFO, records origin

### Frontend
- `/app/frontend/src/pages/DispatchLots.js` - "Made At" column added

---

## FIFO Logic

1. Stock entries sorted by `arrival_date` (oldest first)
2. On dispatch/transfer, oldest stock is consumed first
3. Origin is preserved through all movements

Example:
```
Available at Unit 1:
  - 30 units (Made at Unit 6, arrived Apr 01) ← OLDEST
  - 40 units (Made at Unit 2, arrived Apr 02)
  - 50 units (Made at Unit 6, arrived Apr 03)

Dispatch 70 units:
  - Takes 30 from Unit 6 (oldest)
  - Takes 40 from Unit 2 (next oldest)
  
Result: "Made At: Unit 6 (30), Unit 2 (40)"
```

---

## Notes

- Origin tracking only applies to finished goods (SKUs), not raw materials
- Users don't select batches - system handles automatically
- Historical stock (before implementation) won't have origin data
- Origin appears as "-" until stock is dispatched
