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
- Unit 1 Vedica, Unit 2 Trikes, Unit 3 TM, Unit 4 Goa, Unit 5 Baabus, Unit 6 Emox, BHDG WH

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
- [x] **Authentication system working** - JWT login, role-based access
- [x] **RM Inward Entry module complete** - search, auto-activate RMs, branch inventory
- [x] **User Management module working** - view users, create users (admin only)
- [x] **RM Module Enhanced** - Column filters with dropdown + search (Category, Type, Model, Colour, Brand)
- [x] **Pagination** for RM listing (100 items per page)
- [x] **SKU Subscription Module** - Upload Buyer SKU IDs to assign to branches
- [x] **Vendor Management Module** - Add vendors with details (Name, GST, Address, POC, Email, Phone)
- [x] **Vendor RM Pricing** - Map RM IDs to vendors with prices
- [x] **Price Comparison Report** - Shows lowest vendor price per RM for procurement decisions
- [x] **SKU Cascading Filters** - Vertical → Model → Brand filter buttons on SKUs page
- [x] **Production Entry Filters** - Filter SKUs by Vertical/Model/Brand when adding production
- [x] **Bulk SKU Subscription** - Subscribe entire Vertical or Model to a branch
- [x] **Inter-Branch SKU Transfer** - Physical inventory movement without RM consumption (March 7, 2026)
- [x] **Vendor Management & RM Filters Tested** - 100% test pass rate (23/23 backend, all UI flows)

### New API Endpoints (March 7, 2026)
- `GET /api/raw-materials/filter-options` - Get unique filter values
- `GET /api/raw-materials/filtered` - Paginated RM with filters
- `POST /api/vendors` - Create vendor
- `GET /api/vendors` - List vendors
- `GET /api/vendors/{vendor_id}` - Vendor details with RM prices
- `POST /api/vendor-rm-prices` - Add/update vendor RM price
- `GET /api/vendor-rm-prices/by-rm/{rm_id}` - All vendors for an RM
- `GET /api/vendor-rm-prices/comparison` - Price comparison report
- `POST /api/sku-branch-assignments/upload` - Upload SKUs to assign to branch
- `GET /api/sku-branch-assignments` - Get assignments by branch
- `POST /api/sku-branch-assignments/bulk-subscribe` - Bulk subscribe SKUs by Vertical/Model
- `DELETE /api/sku-branch-assignments/bulk-unsubscribe` - Bulk unsubscribe SKUs

### SKU Cascading Filter Endpoints (March 7, 2026)
- `GET /api/skus/filter-options` - Get all distinct verticals, models, brands
- `GET /api/skus/models-by-vertical` - Get models for a specific vertical
- `GET /api/skus/brands-by-vertical-model` - Get brands for vertical+model
- `GET /api/skus/filtered` - Filter SKUs by vertical, model, brand, search, branch

### Inter-Branch Transfer Endpoints (March 7, 2026)
- `POST /api/sku-transfers` - Transfer SKU inventory between branches
- `GET /api/sku-transfers` - Get transfer history
- `GET /api/sku-transfers/summary` - Get incoming/outgoing transfer summary

---

## Prioritized Backlog

### P0 - Critical (DONE)
- ~~Fix authentication flow~~ ✅
- ~~Complete RM Inward module~~ ✅
- ~~RM Module filters~~ ✅
- ~~SKU Subscription to Units~~ ✅
- ~~Vendor Management with pricing~~ ✅

### P1 - High Priority
- Consolidate `sku_rm_mapping` and `sku_mappings` collections into single data model
- Refactor server.py (2400+ lines) into modular structure
- Create branch users and test branch-specific data visibility

### P2 - Medium Priority
- ~~Inter-branch stock transfer~~ ✅ DONE
- Dispatch tracking module enhancements
- Add bulk RM inward upload feature

### P3 - Future
- Barcode scanning capabilities
- Multi-month production planning view
- Validation preview for bulk uploads

---

## Database Collections
- `users` - User accounts and roles
- `raw_materials` - Global RM definitions (2,402 records)
- `branch_rm_inventory` - Branch-specific RM stock
- `skus` - Global SKU definitions (709 records)
- `branch_sku_inventory` - Branch-specific SKU stock
- `sku_rm_mapping` - BOM mappings
- `sku_branch_assignments` - SKU to branch assignments
- `production` - Production entries
- `purchase_entries` - RM inward entries
- `vendors` - Vendor information
- `vendor_rm_prices` - Vendor RM pricing

## Default Credentials
- Email: `admin@factory.com`
- Password: `admin123`

---
*Last updated: March 7, 2026*
