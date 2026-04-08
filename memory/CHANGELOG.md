# Changelog - Factory OPS

## April 8, 2026

### RM Description & Model Fix

**Deployment: RM Data Migration & Logic Fix**

Fixed the RM naming/description issue across all categories:

**Problems Fixed:**
1. **Description was null for 95% of RMs (2,620 of 2,759)**
   - Now auto-generated from `category_data` fields based on `rm_categories.description_columns`
   
2. **Model column showed "-" for INP category**
   - `model_ids` was empty even though `category_data.model_name` had values
   - Now auto-mapped `model_name` text to `models` collection IDs

3. **Name column showed incomplete values** (e.g., "Wave", "Uni")
   - Frontend was falling back to `category_data.model_name`
   - Now displays full `description` field

**Changes Made:**

*Backend (`services/utils.py`):*
- Updated `generate_rm_name()` to use pipe-separated format: `field1 | field2 | field3`
- Added `get_rm_category_config()` to read from database `rm_categories.description_columns`
- Added `generate_rm_description_async()` for async route usage
- Added `clear_rm_category_cache()` for cache management

*Data Migration (one-time):*
- Updated 2,758 RMs with computed `description` field
- Auto-mapped 281 RMs to `model_ids` based on `category_data.model_name`

*Frontend (`RMRepository.js`):*
- Changed "Name" column to "Description"
- Now displays `rm.description || rm.category_data?.name`

**Description Formats by Category:**
| Category | Format |
|----------|--------|
| INP | `colour \| model_name \| mould_code \| part_name` |
| INM | `colour \| model_name \| part_name \| type` |
| ACC | `colour \| model_name \| type` |
| ELC | `type` |
| PM | `brand \| type` |
| LB | `type` |
| BS | `brand \| position \| type` |
| SP | `type` |

---

### Multi-Item IBT - UI Redesign

**Deployment: IBT Create Form UX Improvement**

Redesigned the IBT Create Transfer dialog based on user feedback:

**Before (Issues):**
- Form was too long, submit button went out of viewport
- Separate "Add Item" blue box was confusing
- Required clicking "Add" before items appeared

**After (Improved UX):**
- Dialog opens with ONE inline item row ready to fill
- User fills Item dropdown + Quantity directly
- Click "+ Add" to add another row below (inline)
- Dialog body is scrollable if content exceeds viewport (max-h: 85vh)
- Footer with Cancel/Create buttons stays fixed at bottom
- Each item row shows available stock and has delete button

**Changes:**
- New state: `itemRows` array with inline editing
- Helper functions: `updateItemRow()`, `addItemRow()`, `removeItemRow()`, `getValidItems()`
- Dialog uses flex layout with `overflow-y-auto` for scrollable body
- Fixed footer with `flex-shrink-0` and border-top

---

### Multi-Item IBT Transfers

**Deployment: IBT Enhancement**

Enhanced Inter-Branch Transfer (IBT) system to support multiple items per transfer:

**New Features:**
- **Add Multiple Items**: Users can now add multiple items (RM or FG) to a single transfer
- **Item-Level Receiving**: Each item can be received with its own quantity, allowing partial receipts
- **Per-Item Shortage Tracking**: Shortage records created for each item with variance

**UI Changes:**
- Create Dialog: Added "Items to Transfer" section with "Add Item" form
- Items can be added one at a time with stock validation
- Items list shows added items with remove option
- Transfer list shows item count badge for multi-item transfers
- Detail Dialog shows expandable items list with individual quantities
- Receive Dialog allows entering received quantity per item

**Backend Changes:**
- `POST /api/ibt-transfers`: Now accepts `items: [{item_id, quantity}]` array
- `PUT /api/ibt-transfers/{id}/dispatch`: Deducts all items from source inventory
- `PUT /api/ibt-transfers/{id}/receive`: Accepts per-item received quantities

**Backward Compatibility:**
- Legacy single-item transfers continue to work (read/dispatch/receive)
- API auto-detects format based on presence of `items` array or `item_id` field

---

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
