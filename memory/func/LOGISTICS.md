# Logistics

**Route**: `/logistics`  
**Access**: MASTER_ADMIN, LOGISTICS_COORDINATOR  
**Frontend**: `/app/frontend/src/pages/Logistics.js`

---

## Overview

Manages outbound logistics, shipment tracking, and delivery coordination.

---

## Key Features

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

## Shipment Flow

```
CREATED → PICKED_UP → IN_TRANSIT → DELIVERED
                                 → EXCEPTION
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shipments` | Shipment list |
| POST | `/api/shipments` | Create shipment |
| PUT | `/api/shipments/{id}/status` | Update status |
| GET | `/api/transporters` | Transporter list |

---

## Database Collections

- `shipments`
- `transporters`
- `delivery_logs`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Logistics.js`
- **Backend**: `/app/backend/routes/logistics_routes.py`

