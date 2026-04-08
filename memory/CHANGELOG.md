# Changelog - Factory OPS

## April 7, 2026

### IBT Flow Simplification

**Deployment: IBT Workflow Update**

Removed the approval step from Inter-Branch Transfer (IBT) flow per user request:

**Before:**
1. Branch Ops initiates IBT → Status: `INITIATED`
2. Master Admin approves → Status: `APPROVED`
3. Logistics dispatches → Status: `IN_TRANSIT`
4. Destination receives → Status: `COMPLETED`

**After (Simplified):**
1. Branch Ops initiates IBT → Status: `READY_FOR_DISPATCH`
2. Logistics dispatches → Status: `IN_TRANSIT`
3. Destination receives → Status: `COMPLETED`

#### Changes Made
- **Backend** (`procurement_routes.py`):
  - New IBT transfers now get status `READY_FOR_DISPATCH` instead of `INITIATED`
  - Dispatch endpoint now accepts `INITIATED`, `READY_FOR_DISPATCH`, or `APPROVED` status
  - Approve endpoint deprecated (kept for backward compatibility, just returns success)
  
- **Frontend** (`IBT.js`):
  - Removed "Approve" button from the UI
  - "Dispatch" button now shows immediately after IBT creation
  - Updated status badges to show "READY" for `READY_FOR_DISPATCH` status
  - "Pending" card renamed to "Ready to Dispatch"

#### Backward Compatibility
- Existing `INITIATED` and `APPROVED` transfers can still be dispatched
- Legacy approve endpoint returns success without blocking

---

### System Design Documentation

**Deployment: Documentation Update**

Created comprehensive system architecture documentation at `/app/memory/SYSTEM_DESIGN.md`:

- **High-Level Architecture Diagram** (Mermaid): Frontend → API Gateway → Backend → Database layer visualization
- **Detailed Data Flow Diagram** (Mermaid): Route-to-collection read/write mappings
- **Database Schema Documentation**: Complete field-level documentation for all 69 MongoDB collections including:
  - Master Data (users, roles, branches, brands, buyers, verticals, models, vendors)
  - SKU Data (bidso_skus, buyer_skus, common_bom, brand_specific_bom)
  - Inventory (branch_rm_inventory, fg_inventory, rm_stock_movements)
  - Production (production_schedules, production_plans, production_batches)
  - Demand & Dispatch (forecasts, dispatch_lots, dispatch_lot_lines)
  - Procurement (purchase_orders, ibt_transfers)
- **Route Mappings**: All 22 backend route modules with endpoint-level read/write collection mapping
- **Frontend Pages**: 30+ pages mapped to their primary API endpoints

#### Files Created
- `/app/memory/SYSTEM_DESIGN.md` (1,182 lines)

#### Files Updated
- `/app/memory/PRD.md` - Added reference to new documentation

---

## April 5, 2026

### In-House Production Module - Phase 2A/2B Complete

#### Phase 2A - RM Production Inward Page
- Created new `/rm-production` page for Branch Ops users
- **Produce RM tab**:
  - Branch selector for multi-branch operations
  - Category filter to narrow down manufacturable RMs
  - RM selection list showing current stock levels
  - Production quantity input with notes
  - Preview dialog showing component requirements and stock availability
  - Confirm production button (disabled if insufficient stock)
- **Preview functionality**:
  - Shows all BOM components required
  - Indicates available stock vs required quantity
  - Highlights shortages in red
  - Blocks production if any component is insufficient

#### Phase 2B - Production Reports
- **Production Log tab**:
  - History of all RM production entries
  - Filters: Category, RM ID, Date range
  - Expandable rows showing consumed components
  - Export to Excel
  - Pagination support
- **Reports tab**:
  - Date range picker for report period
  - Summary cards: Total Produced, Production Entries, Categories Active
  - Production by Category table
  - Component Consumption Report (L1 materials consumed)
  - Export consumption report to Excel

#### Navigation & Access
- Added "RM Production" menu item in sidebar
- Visible for: Master Admin, Branch Ops users

### In-House Production Module - Phase 1 Complete

#### Phase 1B/1C - TechOps UI
- Added "RM Categories" tab to TechOps page
  - Displays 15+ categories with Source Type and BOM Level
  - CRUD operations for managing categories
  - Source Type options: PURCHASED, MANUFACTURED, BOTH
  - BOM Level options: L1, L2, L3, L4
- Added "RM BOM" tab to TechOps page
  - Create/Edit/Delete Bill of Materials for manufactured RMs
  - Component management with quantity, UOM, and wastage factor
  - Yield factor configuration
  - Validates RMs exist before creating BOM

#### Phase 1D - RM Repository Enhancement
- Added Source Type filter dropdown to RM Repository page
- Added BOM Level filter dropdown to RM Repository page
- Added Source and Level columns to RM Repository table
- Color-coded badges:
  - MANUFACTURED: Orange badge
  - BOTH: Blue badge
  - PURCHASED: Outline badge
- Updated Excel export to include source_type and bom_level columns

#### Backend Updates
- `/api/raw-materials/by-tags` now supports `source_type` and `bom_level` query parameters
- All 19 API tests passed (100% pass rate)

#### Files Modified
- `/app/frontend/src/pages/TechOps.js` - Added RM Categories and RM BOM tabs
- `/app/frontend/src/pages/RMRepository.js` - Added filters and columns
- `/app/backend/routes/rm_routes.py` - Added new filter parameters

---

## Previous Sessions

### March 2026
- IBT Module Overhaul (100% test pass)
- Global Radix UI Select crash fix
- RM Repository Export feature
- MRP Weekly Planning module
- Pantone Shade Management System
- Clone Bidso SKU feature
- Demand Hub module
