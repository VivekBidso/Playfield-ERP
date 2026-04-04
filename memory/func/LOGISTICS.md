# Logistics (DEPRECATED)

> **⚠️ DEPRECATED: April 4, 2026**
> 
> This module has been replaced by **Dispatch Lots V2**. Do not use for new development.
> 
> **Replacement**: `/dispatch-lots` → See `/app/memory/func/DISPATCH_LOTS_V2_PLANNING.md`

---

**Route**: `/logistics` (HIDDEN from sidebar)  
**Access**: MASTER_ADMIN, LOGISTICS_COORDINATOR  
**Frontend**: `/app/frontend/src/pages/Logistics.js`

---

## Deprecation Details

| Aspect | Legacy (Logistics) | Replacement (Dispatch Lots V2) |
|--------|-------------------|-------------------------------|
| **Collection** | `dispatches` | `dispatch_lots` |
| **Routes** | `/api/dispatches` in `procurement_routes.py` | `/api/dispatch-lots-v2` |
| **Workflow** | Single-stage: dispatch → ship → deliver | Two-stage: Demand creates lot → Finance invoices |
| **Status Flow** | PENDING → SHIPPED → DELIVERED | DRAFT → PENDING_FINANCE → INVOICED → DISPATCHED |

---

## Migration Notes

- Legacy `dispatches` collection has minimal data (1 record as of April 2026)
- No data migration required - can be archived
- Frontend route `/logistics` still exists but hidden from navigation
- Backend endpoints in `procurement_routes.py` still functional but unused

---

## Original Features (For Reference Only)

### Shipment Management
- Create shipments from dispatch lots
- Assign carriers/transporters
- Track shipment status

### Delivery Tracking
- Real-time status updates
- Proof of delivery
- Exception handling

### Transporter Management
- Transporter master data
- Rate cards
- Performance tracking

---

## Original Shipment Flow

```
CREATED → PICKED_UP → IN_TRANSIT → DELIVERED
                                 → EXCEPTION
```

---

## Original API Endpoints (DEPRECATED)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/dispatches` | Dispatch list | DEPRECATED |
| POST | `/api/dispatches` | Create dispatch | DEPRECATED |
| PUT | `/api/dispatches/{id}/ship` | Mark shipped | DEPRECATED |
| PUT | `/api/dispatches/{id}/deliver` | Mark delivered | DEPRECATED |

---

## Cleanup Tasks (Future)

- [ ] Remove `/api/dispatches` endpoints from `procurement_routes.py`
- [ ] Archive `dispatches` collection data
- [ ] Delete `/app/frontend/src/pages/Logistics.js`
- [ ] Remove route from `/app/frontend/src/App.js`

---

*Deprecated: April 4, 2026*
*Replaced by: Dispatch Lots V2*
