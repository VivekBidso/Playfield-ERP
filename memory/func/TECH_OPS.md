# Tech Ops

**Route**: `/techops`  
**Access**: MASTER_ADMIN, TECH_OPS_ENGINEER  
**Frontend**: `/app/frontend/src/pages/TechOps.js`

---

## Overview

Tech Ops manages the core master data hierarchy: Verticals → Models → Brands → Buyers. Also includes Pantone color library management.

---

## Tabs

### 1. Verticals Tab
- Create/Edit/Delete product verticals (e.g., E-Rickshaw, Trikes)
- Fields: Code, Name, Description
- Status: ACTIVE/INACTIVE

### 2. Models Tab
- Create/Edit/Delete models under verticals
- Fields: Vertical, Code, Name, Description
- Bulk import from Excel

### 3. Brands Tab
- Create/Edit/Delete brand masters
- Fields: Code, Name
- Used for Buyer SKU branding

### 4. Buyers Tab
- Create/Edit/Delete customer/buyer records
- Fields: Customer Code (auto-generated), Name, GST, Email, Phone, POC Name
- Bulk import from Excel
- Customer Code format: `CUST_XXXX`

### 5. Pantone Library Tab
- Manage Pantone color codes
- Search and browse colors
- Phase 2: Link to RMs

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/verticals` | List verticals |
| POST | `/api/verticals` | Create vertical |
| PUT | `/api/verticals/{id}` | Update vertical |
| DELETE | `/api/verticals/{id}` | Delete vertical |
| GET | `/api/models` | List models |
| POST | `/api/models` | Create model |
| POST | `/api/models/bulk-import` | Bulk import models |
| GET | `/api/brands` | List brands |
| POST | `/api/brands` | Create brand |
| GET | `/api/buyers` | List buyers |
| POST | `/api/buyers` | Create buyer |
| POST | `/api/buyers/bulk-import` | Bulk import buyers |

---

## Database Collections

- `verticals` - Product verticals
- `models` - Product models
- `brands` - Brand masters
- `buyers` - Customer/buyer records
- `pantone_colors` - Pantone library

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/TechOps.js`
- **Backend**: `/app/backend/routes/tech_ops_routes.py`
- **Component**: `/app/frontend/src/components/PantoneLibrary.jsx`

---

## Bulk Import Templates

### Models Excel
| vertical_code | model_code | model_name | description |
|---------------|------------|------------|-------------|

### Buyers Excel
| name | gst | email | phone_no | poc_name |
|------|-----|-------|----------|----------|

