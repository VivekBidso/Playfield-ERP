# SKU Management

**Route**: `/sku-management`  
**Access**: MASTER_ADMIN, TECH_OPS_ENGINEER  
**Frontend**: `/app/frontend/src/pages/SKUManagement.js`

---

## Overview

Manages the two-tier SKU system: Bidso SKUs (internal) and Buyer SKUs (customer-specific). Also manages Bill of Materials (BOM) at both levels.

---

## Tabs

### 1. Bidso SKUs Tab
- Create/Edit internal SKU codes
- Format: `{vertical_code}{model_code}{numeric_code}` (e.g., ERW001)
- Filter by Vertical, Model
- Lock/Unlock SKUs

### 2. Buyer SKUs Tab
- Create Buyer SKUs from Bidso SKUs
- Links to Brand
- Format: `{bidso_sku_id}_{brand_code}` (e.g., ERW001_TVS)
- View Full BOM (Common + Brand-Specific)
- Inline Edit/Delete for Brand-Specific BOM items

### 3. BOM Management Tab
- Common BOM: Shared across all brand variants
- Brand-Specific BOM: Additional items per buyer brand
- Bulk upload BOMs from Excel

---

## BOM Architecture

```
Buyer SKU BOM = Common BOM (from Bidso SKU) + Brand-Specific BOM
```

### Common BOM
- Attached to Bidso SKU
- Inherited by all Buyer SKUs of that Bidso

### Brand-Specific BOM
- Attached to Buyer SKU
- Items unique to that brand (labels, packaging, etc.)
- Can be edited inline with 10-day schedule warning

---

## Key Features

### View Full BOM
- Click eye icon on Buyer SKU
- Shows merged Common + Brand-Specific items
- RM descriptions generated dynamically by category rules

### Inline BOM Editing
- Edit quantity, unit, or swap RM ID
- Delete brand-specific items
- 10-day schedule check: warns if SKU has production in next 10 days

### Bulk BOM Upload
- Excel format: sku_id, rm_id, quantity, unit
- Validates RM IDs exist
- Case-insensitive RM matching

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sku-management/bidso-skus` | List Bidso SKUs |
| POST | `/api/sku-management/bidso-skus` | Create Bidso SKU |
| GET | `/api/sku-management/buyer-skus` | List Buyer SKUs |
| POST | `/api/sku-management/buyer-skus` | Create Buyer SKU |
| GET | `/api/sku-management/bom/common/{bidso_id}` | Get common BOM |
| POST | `/api/sku-management/bom/common/{bidso_id}` | Add common BOM item |
| GET | `/api/sku-management/bom/full/{buyer_sku_id}` | Full merged BOM |
| PUT | `/api/sku-management/bom/brand-specific/{buyer_sku_id}/item/{rm_id}` | Edit item |
| DELETE | `/api/sku-management/bom/brand-specific/{buyer_sku_id}/item/{rm_id}` | Delete item |
| GET | `/api/sku-management/bom/brand-specific/{buyer_sku_id}/check-schedule` | 10-day check |
| POST | `/api/sku-management/bom/bulk-upload` | Bulk upload |

---

## Database Collections

- `bidso_skus` - Internal SKU master
- `buyer_skus` - Customer-specific SKUs
- `common_boms` - Shared BOM items
- `brand_specific_boms` - Brand-specific items
- `raw_materials` - RM validation

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/SKUManagement.js`
- **Backend**: `/app/backend/routes/sku_management_routes.py`

---

## BOM Excel Template

| sku_id | rm_id | quantity | unit |
|--------|-------|----------|------|
| ERW001_TVS | LB_00123 | 2 | PCS |
| ERW001_TVS | PM_00456 | 1 | SET |

