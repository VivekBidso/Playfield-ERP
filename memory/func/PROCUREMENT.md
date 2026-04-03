# Procurement

**Route**: `/procurement`  
**Access**: MASTER_ADMIN, PROCUREMENT_OFFICER  
**Frontend**: `/app/frontend/src/pages/Procurement.js`

---

## Overview

Purchase order management and procurement workflow. Creates POs based on MRP recommendations or manual entries.

---

## Key Features

### Purchase Orders
- Create PO from MRP shortage recommendations
- Manual PO creation
- PO approval workflow
- Track PO status

### PO Lifecycle

```
DRAFT → SUBMITTED → APPROVED → ORDERED → RECEIVED → CLOSED
```

### Vendor Selection
- Choose from approved vendors
- View vendor pricing history
- Compare quotes

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List POs |
| POST | `/api/purchase-orders` | Create PO |
| PUT | `/api/purchase-orders/{id}` | Update PO |
| PUT | `/api/purchase-orders/{id}/status` | Change status |
| GET | `/api/purchase-orders/{id}/items` | PO line items |

---

## Database Collections

- `purchase_orders`
- `purchase_order_items`
- `vendors`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Procurement.js`
- **Backend**: `/app/backend/routes/procurement_routes.py`

