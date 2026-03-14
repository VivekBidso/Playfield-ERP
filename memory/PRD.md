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

## Extended Architecture (PRD v2 - March 2026)
The system is being evolved into an **Integrated Manufacturing & Operations Suite** as defined in `/app/memory/ARCHITECTURE_PRD_v2.md`. Key additions:
- **L1/L2 Raw Material Engine**: INP (plastic) and INM (metal) in-house manufacturing with calculated consumption
- **Modular Service Architecture**: Backend refactoring into services/routes/models
- **Master Data Management**: Verticals, Models, Brands, Buyers entities
- **Quality Control Module**: QC Checklists, Results, Approvals
- **Demand Planning**: Forecasts and Dispatch Lots

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + TailwindCSS + Shadcn/UI + Zustand
- **Auth**: JWT-based authentication with role-based access control
- **Backend Structure** (FULLY REFACTORED - March 14, 2026):
  ```
  /app/backend/
  ├── server.py          # Main entry point (112 lines) - CLEAN!
  ├── database.py        # DB connection
  ├── models/            # Pydantic models (830 lines)
  │   ├── core.py        # RM, SKU, Production models
  │   ├── auth.py        # User, Login models
  │   ├── vendor.py      # Vendor models
  │   ├── master_data.py # Verticals, Models, Brands, Buyers
  │   └── transactional.py # Forecasts, Batches, QC, etc.
  ├── routes/            # Modular API routers (3,386 lines) - ALL ROUTES HERE!
  │   ├── auth_routes.py       # Login, User Management (199 lines)
  │   ├── rm_routes.py         # Raw Materials CRUD (271 lines)
  │   ├── sku_routes.py        # SKU CRUD, Mappings (397 lines)
  │   ├── vendor_routes.py     # Vendors, Pricing (217 lines)
  │   ├── production_routes.py # Production entries/batches (475 lines)
  │   ├── report_routes.py     # FG Inventory, IBT (317 lines)
  │   ├── tech_ops_routes.py   # Verticals, Models, Brands, Buyers (258 lines)
  │   ├── demand_routes.py     # Forecasts, Dispatch Lots (141 lines)
  │   ├── quality_routes.py    # QC Checklists, Results (187 lines)
  │   ├── procurement_routes.py # POs, Dispatches, Invoices (405 lines)
  │   └── cpc_routes.py        # CPC, Branch Capacity (493 lines)
  └── services/          # Business logic
      ├── utils.py            # Shared utilities, auth helpers
      ├── l1_l2_engine.py     # L1/L2 consumption engine
      └── inventory_service.py
  ```

## Multi-Branch System
7 Branches supported:
- Unit 1 Vedica, Unit 2 Trikes, Unit 3 TM, Unit 4 Goa, Unit 5 Baabus, Unit 6 Emox, BHDG WH

## User Roles & RBAC (Role-Based Access Control)

### Legacy Roles
- **Master Admin**: Global view, can manage users
- **Branch User**: View/edit data only for assigned branch

### RBAC System (Implemented March 14, 2026)
10 granular roles with permission-based access control:

| Role | Code | Description |
|------|------|-------------|
| Master Admin | `MASTER_ADMIN` | Full system access - can perform all operations |
| Demand Planner | `DEMAND_PLANNER` | Manages forecasts, dispatch lots, and early SKU lifecycle |
| Tech Ops Engineer | `TECH_OPS_ENGINEER` | Manages master data, BOMs, and technical configurations |
| CPC Planner | `CPC_PLANNER` | Central Production Control planning and scheduling |
| Procurement Officer | `PROCUREMENT_OFFICER` | Vendor management and purchase orders |
| Branch Ops User | `BRANCH_OPS_USER` | Branch-level production and stock operations |
| Quality Inspector | `QUALITY_INSPECTOR` | QC checklists, inspections, and approvals |
| Logistics Coordinator | `LOGISTICS_COORDINATOR` | Dispatch, IBT, and invoice management |
| Finance Viewer | `FINANCE_VIEWER` | Read-only access to financial data |
| Auditor | `AUDITOR_READONLY` | Global read-only access for audit purposes |

**RBAC Features:**
- Permission-based route protection via `@require_permission` decorator
- Constraint-based permissions (STATUS_CHECK, REFERENCE_CHECK, TIME_WINDOW)
- Role assignment UI in User Management page
- Frontend conditional rendering based on user roles

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
- [x] **Production Planning Enhancement** - Add individual plans with date picker and cascading SKU filters - 100% test pass rate (December 2025)
- [x] **Backend Modular Architecture Started** - Created `/models/`, `/routes/`, `/services/` directories with core files (March 14, 2026)
- [x] **Backend Refactoring Phase 1 Complete** - Extracted 2,447 lines into modular files (March 14, 2026):
  - `routes/tech_ops_routes.py` - Verticals, Models, Brands, Buyers CRUD (218 lines)
  - `routes/demand_routes.py` - Forecasts, Dispatch Lots (141 lines)
  - `routes/quality_routes.py` - QC Checklists, Results, Approvals (187 lines)
  - `routes/procurement_routes.py` - POs, Dispatches, Invoices, IBT (405 lines)
  - `models/*.py` - All Pydantic models (830 lines)
  - `services/*.py` - Auth, helpers, L1/L2 engine (552 lines)
- [x] **New Frontend Modules Routed** - TechOps, Demand, Quality pages added to navigation (March 14, 2026)
- [x] **Tech Ops API Endpoints Working** - Verticals, Models, Brands, Buyers CRUD with Edit/Delete (March 14, 2026)
- [x] **Tech Ops Data Seeded** - 9 Verticals, 47 Models, 28 Brands from SKU data (March 14, 2026)
- [x] **SKU ID Migration** - 708 SKUs linked to vertical_id, model_id, brand_id (March 14, 2026)
- [x] **BOM Consolidation** - 20,157 records migrated to bill_of_materials collection (March 14, 2026)
- [x] **Branches Normalized** - 7 branches stored in database collection (March 14, 2026)
- [x] **Purchase Orders** - PO creation, line items, send/receive flow (March 14, 2026)
- [x] **Dispatches** - Dispatch records with shipping tracking (March 14, 2026)
- [x] **Invoices** - Invoice creation with tax calculation (March 14, 2026)
- [x] **CPC Module Complete** - Central Production Control & Branch Capacity Planning (March 14, 2026):
  - `routes/cpc_routes.py` - Full CPC API (494 lines)
  - Production Schedules CRUD with status workflow (DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED)
  - Branch Capacity Management (capacity_units_per_day per branch)
  - Auto-allocate production across branches based on available capacity
  - Branch allocation workflow (manual and automatic)
  - CPC Dashboard with branch utilization metrics
  - 7-day capacity forecast per branch
  - Schedule suggestions from dispatch lots
  - Frontend CPC.js page with 4 tabs (Dashboard, Schedules, Branch Capacity, Suggestions)
  - 100% test pass rate (20 backend tests, all UI flows)
- [x] **RBAC System Complete** - Granular Role-Based Access Control (March 14, 2026):
  - 10 roles seeded on application startup
  - Permission matrix for all entities (CREATE, READ, UPDATE, DELETE)
  - Constraint system: STATUS_CHECK, REFERENCE_CHECK, TIME_WINDOW, MOVEMENT_TYPE_CHECK
  - `@require_permission` decorator for route protection
  - Frontend User Management page with role assignment dialog
  - Navigation items conditionally rendered based on user roles
  - 100% test pass rate (18 backend tests, all UI flows)
  - Files: `services/rbac_service.py`, `services/seed_rbac.py`, `models/rbac.py`

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

### Production Planning Enhancement (December 2025)
- `POST /api/production-plans` - Create single production plan with date picker (sku_id, branch, date, planned_quantity)
- Automatically derives plan_month from date
- Updates existing plan if same SKU/branch/date combination

### New Architecture Endpoints (March 14, 2026)
**Master Data (Tech Ops)**
- `GET/POST /api/verticals` - Product Verticals (SCOOTER, TRIKE, etc.)
- `GET/POST /api/models` - Product Models under Verticals
- `GET/POST /api/brands` - Brands tied to Buyers
- `GET/POST /api/buyers` - Buyer/Customer management

**Demand Module**
- `GET/POST /api/forecasts` - Demand Forecasts
- `GET/POST /api/dispatch-lots` - Dispatch Lot management

**Production Batches**
- `GET/POST /api/production-batches` - Production batch tracking

**Quality Control**
- `GET/POST /api/qc-checklists` - QC checklist items
- `GET/POST /api/qc-results` - QC inspection results
- `POST /api/qc-approvals` - Batch QC approvals

**Finished Goods**
- `GET /api/fg-inventory` - FG inventory tracking
- `GET /api/fg-inventory/summary` - FG summary by SKU

**CPC Module (March 14, 2026)**
- `GET /api/cpc/dashboard` - CPC overview (pending schedules, in-progress, today's stats, branch utilization)
- `GET /api/cpc/schedule-suggestions` - Dispatch lots needing production scheduling
- `GET /api/branches/capacity` - All branch capacities with utilization
- `PUT /api/branches/{branch_name}/capacity` - Update branch daily capacity
- `GET /api/branches/{branch_name}/capacity-forecast` - 7-day capacity forecast
- `GET/POST /api/production-schedules` - Production schedule CRUD
- `GET /api/production-schedules/{schedule_id}` - Schedule details with allocations
- `POST /api/branch-allocations` - Manual branch allocation
- `POST /api/branch-allocations/auto-allocate` - Auto-distribute production to branches
- `PUT /api/branch-allocations/{id}/start` - Start production on allocation
- `PUT /api/branch-allocations/{id}/complete` - Complete allocation with quantity

**RBAC Module (March 14, 2026)**
- `GET /api/roles` - List all available roles (10 roles)
- `GET /api/auth/permissions` - Get current user's roles and permissions
- `GET /api/users/{id}/roles` - Get roles assigned to a specific user
- `POST /api/users/{id}/roles` - Assign a role to a user (Master Admin only)
- `DELETE /api/users/{id}/roles/{role_code}` - Remove a role from a user
- `GET /api/users-with-roles` - List all users with their RBAC roles

**L1/L2 Engine (Backend Services)**
- INP (Plastic) consumption: Weight-based polymer deduction
- INM (Metal) consumption: Dual L1 deduction (base metal + powder coating)

---

## Prioritized Backlog

### P0 - Critical (DONE)
- ~~Fix authentication flow~~ ✅
- ~~Complete RM Inward module~~ ✅
- ~~RM Module filters~~ ✅
- ~~SKU Subscription to Units~~ ✅
- ~~Vendor Management with pricing~~ ✅
- ~~Tech Ops Module (Verticals, Models, Brands, Buyers)~~ ✅ March 14, 2026
- ~~Demand Module (Forecasts, Dispatch Lots)~~ ✅ March 14, 2026
- ~~Quality Control Module (QC Checklists, Results, Approvals)~~ ✅ March 14, 2026
- ~~CPC Module (Central Production Control, Branch Capacity)~~ ✅ March 14, 2026
- ~~Backend Refactoring~~ ✅ March 14, 2026 (server.py: 5500+ → 112 lines)
- ~~RBAC Verification~~ ✅ March 14, 2026 (Branch User tested)
- ~~Procurement UI~~ ✅ March 14, 2026 (Purchase Orders, Vendor Prices)
- ~~Logistics UI~~ ✅ March 14, 2026 (Dispatches, Invoices)
- ~~IBT UI~~ ✅ March 14, 2026 (Inter-Branch Transfers)
- ~~Event System~~ ✅ March 14, 2026 (35 event types, 11 handlers, alerts)

### P1 - High Priority
- Consolidate `sku_rm_mapping` and `sku_mappings` collections into single data model
- Complete backend refactoring - extract remaining routes from server.py into modular files
- Create branch users and test branch-specific data visibility (RBAC)

### P2 - Medium Priority
- ~~Inter-branch stock transfer~~ ✅ DONE
- Dispatch tracking module enhancements
- Add bulk RM inward upload feature
- Wire L1/L2 consumption engine to Production entry flow

### P3 - Future
- Barcode scanning capabilities
- Multi-month production planning view
- Validation preview for bulk uploads
- Event-driven architecture implementation
- Database partitioning for high-volume tables

---

## Database Collections
- `users` - User accounts and roles
- `raw_materials` - Global RM definitions (2,402 records)
- `branch_rm_inventory` - Branch-specific RM stock
- `skus` - Global SKU definitions (709 records)
- `branch_sku_inventory` - Branch-specific SKU stock
- `sku_rm_mapping` - BOM mappings (bulk upload)
- `sku_mappings` - BOM mappings (legacy)
- `sku_branch_assignments` - SKU to branch assignments
- `production_entries` - Production entries
- `purchase_entries` - RM inward entries
- `dispatch_entries` - SKU dispatch entries
- `sku_transfers` - Inter-branch transfer records
- `vendors` - Vendor information (504 records)
- `vendor_rm_prices` - Vendor RM pricing
- `verticals` - Product verticals (NEW)
- `models` - Product models (NEW)
- `brands` - Brands (NEW)
- `buyers` - Buyers/Customers (NEW)
- `forecasts` - Demand forecasts (NEW)
- `dispatch_lots` - Dispatch lots (NEW)
- `production_batches` - Production batches (NEW)
- `qc_checklists` - QC checklist items (NEW)
- `qc_results` - QC inspection results (NEW)
- `qc_approvals` - Batch QC approvals (NEW)
- `fg_inventory` - Finished goods inventory (NEW)
- `rm_stock_movements` - RM stock movement log (NEW)
- `production_schedules` - CPC production schedules (NEW)
- `branch_allocations` - Branch production allocations (NEW)
- `capacity_history` - Branch capacity change history (NEW)

## Default Credentials
- Email: `admin@factory.com`
- Password: `admin123`

---
*Last updated: March 14, 2026 - Event System Complete*
