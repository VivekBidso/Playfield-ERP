# RM Repository

**Route**: `/rm-repository`  
**Access**: MASTER_ADMIN, TECH_OPS_ENGINEER  
**Frontend**: `/app/frontend/src/pages/RMRepository.js`

---

## Overview

Master data repository for all Raw Materials (RMs). Manages RM codes, categories, and attributes.

---

## RM Categories

| Code | Name | Description |
|------|------|-------------|
| INP | Injection Plastic | Plastic molded parts |
| INM | Injection Metal | Metal fabricated parts |
| ACC | Accessories | Vehicle accessories |
| ELC | Electrical | Electrical components |
| LB | Labels | Stickers, decals |
| PM | Packaging | Boxes, wraps |
| BS | Brand Stickers | Brand-specific assets |
| SP | Spare Parts | Replacement parts |

---

## RM ID Format

```
{CATEGORY}_{NUMERIC_CODE}
Example: INP_00654, LB_00123
```

---

## Key Features

### RM List
- Filter by category
- Search by RM ID or description
- Pagination

### Create/Edit RM
- Category selection
- Auto-generate RM ID
- Category-specific attributes

### Bulk Import
- Excel upload for mass creation
- Validates category codes

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/raw-materials` | List RMs with filters |
| POST | `/api/raw-materials` | Create RM |
| PUT | `/api/raw-materials/{id}` | Update RM |
| DELETE | `/api/raw-materials/{id}` | Delete RM |
| POST | `/api/raw-materials/bulk-import` | Bulk import |

---

## Database Collections

- `raw_materials` - RM master data

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/RMRepository.js`
- **Backend**: `/app/backend/routes/rm_routes.py`

