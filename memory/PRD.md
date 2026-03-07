# Factory OPS - Product Requirements Document

## Original Problem Statement
Build a factory management tool with the following modules:
1. **Raw Material (RM) Management**: Bulk upload RM IDs, enter daily purchase quantities, and track inventory.
2. **SKU Management**: Create and manage finished goods SKU IDs.
3. **BOM Mapping**: Map RM IDs to SKU IDs, specifying the quantity of each RM required per SKU.
4. **Production Entry**: Record production counts against SKU IDs.
5. **Inventory Consumption**: Automatically deduct RM inventory based on production entries.
6. **Dispatch Tracking**: Mark outgoing SKUs as dispatched.
7. **Reporting**: Provide a net-off tracking of RM and SKU inventory.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + TailwindCSS + Shadcn/UI + Zustand
- **Auth**: JWT-based authentication with role-based access control

## Multi-Branch System
7 Branches supported:
- Unit 1 Vedica, Unit 2 Trikes, Unit 3 TM, Unit 4 Goa, Unit 5 Emox, Unit 6 Baabus, BHDG WH

## User Roles
- **Master Admin**: Global view, can manage users
- **Branch User**: View/edit data only for assigned branch

## RM Categories
| Code | Name | Count | Highest ID |
|------|------|-------|------------|
| INP | In-house Plastic | 955 | INP_1003 |
| ACC | Accessories | 261 | ACC_274 |
| ELC | Electric Components | 39 | ELC_053 |
| LB | Labels | 540 | LB_543 |
| PM | Packaging | 137 | PM_145 |
| SP | Spares | 192 | SP_196 |
| BS | Brand Assets | 278 | BS_318 |

**Total RMs: 2,402**

---

## What's Been Implemented

### Completed ✅
- [x] Multi-branch architecture with branch selector
- [x] Master Dashboard for global overview
- [x] Global SKU/RM system with branch activation
- [x] Production Planning module with shortage analysis
- [x] Bulk SKU-RM Mapping upload
- [x] Automated RM ID generation with category prefixes
- [x] 709 SKUs uploaded from Excel (Buyer_SKU_ID as primary)
- [x] **2,402 RMs imported** from 7 Excel files - March 7, 2026
- [x] Fixed sequence logic for proper numeric ID continuation
- [x] New API `/api/raw-materials/import-with-ids` for bulk import with existing IDs
- [x] UI tab visibility fix
- [x] **Authentication system working** - JWT login, role-based access
- [x] **RM Inward Entry module complete** - search, auto-activate RMs, branch inventory
- [x] **User Management module working** - view users, create users (admin only)

### Testing Status ✅
- Backend: 100% (15/15 tests passed)
- Frontend: 100% (all UI flows working)
- Test file: `/app/backend/tests/test_factory_api.py`

---

## Prioritized Backlog

### P0 - Critical (DONE)
- ~~Fix authentication flow~~ ✅
- ~~Complete RM Inward module~~ ✅

### P1 - High Priority
- Add pagination to `/api/raw-materials` endpoint (currently limited to 1000 items)
- Create new branch users and test branch-specific data visibility

### P2 - Medium Priority
- Inter-branch stock transfer
- Dispatch tracking module enhancements

### P3 - Future
- Barcode scanning capabilities
- Multi-month production planning view
- Validation preview for bulk uploads

---

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info
- `POST /api/users` - Create user (admin only)
- `GET /api/raw-materials` - List RMs (branch-filtered or global)
- `POST /api/raw-materials` - Create RM (auto-generates ID)
- `POST /api/raw-materials/import-with-ids` - Bulk import with existing IDs
- `POST /api/purchase-entries` - Record RM inward (auto-activates in branch)
- `GET /api/purchase-entries` - List inward entries
- `GET /api/skus` - List SKUs
- `POST /api/sku_rm_mapping/upload` - Bulk BOM upload

## Database Collections
- `users` - User accounts and roles
- `raw_materials` - Global RM definitions (2,402 records)
- `branch_rm_inventory` - Branch-specific RM stock
- `skus` - Global SKU definitions (709 records)
- `branch_sku_inventory` - Branch-specific SKU stock
- `sku_rm_mapping` - BOM mappings
- `production` - Production entries
- `purchase_entries` - RM inward entries

## Default Credentials
- Email: `admin@factory.com`
- Password: `admin123`

---
*Last updated: March 7, 2026*
