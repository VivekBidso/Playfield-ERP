# Color Development

**Route**: `/color-development`  
**Access**: MASTER_ADMIN, DEMAND_PLANNER  
**Frontend**: `/app/frontend/src/pages/ColorDevelopment.js`

---

## Overview

Manages color development requests and Pantone color linkages for new SKU variants.

---

## Key Features

### Color Requests
- Create new color development requests
- Track status: REQUESTED → IN_PROGRESS → APPROVED → REJECTED
- Link to Pantone codes

### Pantone Integration
- Browse Pantone library
- Link colors to SKUs
- Phase 2: Link to RMs

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/color-development` | List requests |
| POST | `/api/color-development` | Create request |
| PUT | `/api/color-development/{id}` | Update status |
| GET | `/api/pantone` | Pantone library |

---

## Database Collections

- `color_development_requests`
- `pantone_colors`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/ColorDevelopment.js`
- **Backend**: `/app/backend/routes/color_routes.py`

