# Event System

**Route**: `/events`  
**Access**: MASTER_ADMIN only  
**Frontend**: `/app/frontend/src/pages/Events.js`

---

## Overview

System event log and audit trail. Shows all significant system events for debugging and compliance.

---

## Key Features

### Event Log
- Chronological event list
- Filter by event type
- Filter by date range
- Search by entity

### Event Types
- USER_LOGIN
- USER_LOGOUT
- FORECAST_CREATED
- FORECAST_CONFIRMED
- SCHEDULE_CREATED
- INVENTORY_UPDATED
- TRANSFER_CREATED
- etc.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Event list |
| GET | `/api/events/types` | Event types |

---

## Database Collections

- `system_events`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Events.js`
- **Backend**: `/app/backend/routes/event_routes.py`

