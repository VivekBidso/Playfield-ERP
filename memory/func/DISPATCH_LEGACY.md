# Dispatch (DELETED)

**Route**: `/dispatch`  
**Status**: ❌ DELETED (April 3, 2026)

---

## Reason for Deletion

Superseded by **Dispatch Lots** (`/dispatch-lots`):

| Dispatch Legacy | Dispatch Lots |
|-----------------|---------------|
| Simple `dispatch_entries` | `dispatch_lots` + `dispatch_lot_lines` |
| Ad-hoc entries | Linked to Forecasts |
| Just SKU + quantity | Full lifecycle tracking |
| No production visibility | Per-line production dates |

---

## Replacement

Use **Dispatch Lots** (`/dispatch-lots`) for all dispatch operations.

---

## Files Deleted

- `/app/frontend/src/pages/Dispatch.js`
- Route removed from `/app/frontend/src/App.js`
- Sidebar entry removed from `/app/frontend/src/components/Layout.js`

