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
| Code | Name | Fields |
|------|------|--------|
| INP | In-house Plastic | mould_code, model_name, part_name, colour, mb, per_unit_weight, unit |
| ACC | Accessories | type, model_name, specs, colour, per_unit_weight, unit |
| ELC | Electric Components | model, type, specs, per_unit_weight, unit |
| SP | Spares | type, specs, per_unit_weight, unit |
| BS | Brand Assets | position, type, brand, buyer_sku, per_unit_weight, unit |
| PM | Packaging | model, type, specs, brand, per_unit_weight, unit |
| LB | Labels | type, buyer_sku, per_unit_weight, unit |

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
- [x] **1,932 RMs imported** (ACC: 261, ELC: 39, INP: 955, LB: 540, PM: 137) - March 7, 2026
- [x] Fixed sequence logic for proper numeric ID continuation
- [x] New API `/api/raw-materials/import-with-ids` for bulk import with existing IDs
- [x] UI tab visibility fix
- [x] Authentication scaffolding (backend JWT + frontend pages)

### In Progress 🔄
- [ ] **Authentication flow broken** - users get redirected back to login after authenticating
- [ ] **RM Inward Entry module** - page created, route added, needs form connection to backend

### Pending ⏳
- [ ] Test User Management module
- [ ] Verify branch-level data visibility
- [ ] Role-based page restrictions

---

## Prioritized Backlog

### P0 - Critical
1. Fix authentication flow (ProtectedRoute, authStore, token management)
2. Complete RM Inward module
3. Test User Management

### P1 - High Priority
- Verify data visibility restrictions per branch
- Production entry with automatic RM deduction

### P2 - Medium Priority
- Inter-branch stock transfer
- Dispatch tracking module

### P3 - Future
- Barcode scanning capabilities
- Multi-month production planning view
- Validation preview for bulk uploads

---

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info
- `POST /api/users` - Create user (admin only)
- `GET /api/raw-materials` - List RMs (branch-filtered)
- `POST /api/raw-materials` - Create RM (auto-generates ID)
- `POST /api/raw-materials/import-with-ids` - Bulk import with existing IDs
- `POST /api/raw-materials/bulk-upload` - Bulk upload (auto-generates IDs)
- `GET /api/skus` - List SKUs
- `POST /api/sku_rm_mapping/upload` - Bulk BOM upload
- `POST /api/production_planning/shortage` - Shortage analysis

## Database Collections
- `users` - User accounts and roles
- `raw_materials` - Global RM definitions
- `branch_rm_inventory` - Branch-specific RM stock
- `skus` - Global SKU definitions
- `branch_sku_inventory` - Branch-specific SKU stock
- `sku_rm_mapping` - BOM mappings
- `production` - Production entries
- `purchases` - RM purchase entries

## Default Credentials
- Email: `admin@factory.com`
- Password: `admin123`

---
*Last updated: March 7, 2026*
