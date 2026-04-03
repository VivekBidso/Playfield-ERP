# Vendor Management

**Route**: `/vendors`  
**Access**: MASTER_ADMIN, PROCUREMENT_OFFICER  
**Frontend**: `/app/frontend/src/pages/VendorManagement.js`

---

## Overview

Manages vendor/supplier master data. Tracks vendor details, pricing, and performance.

---

## Key Features

### Vendor List
- Search and filter vendors
- View vendor details
- Vendor status: ACTIVE/INACTIVE

### Vendor CRUD
- Create new vendors
- Edit vendor details
- Deactivate vendors

### Vendor Details
- Company info: Name, GST, Address
- Contact info: Email, Phone, POC
- Pricing: RM-specific pricing
- Performance: Delivery track record

### Bulk Import
- Upload vendors from Excel

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List vendors |
| POST | `/api/vendors` | Create vendor |
| PUT | `/api/vendors/{id}` | Update vendor |
| DELETE | `/api/vendors/{id}` | Deactivate vendor |
| GET | `/api/vendors/{id}/pricing` | Vendor pricing |
| POST | `/api/vendors/bulk-import` | Bulk import |

---

## Database Collections

- `vendors`
- `vendor_pricing`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/VendorManagement.js`
- **Backend**: `/app/backend/routes/vendor_routes.py`

