# Factory OPS - Product Requirements Document
## Integrated Manufacturing & Operations Suite

---

## 1. SYSTEM OVERVIEW

**What is Factory OPS?**
A complete factory management system that tracks everything from raw materials to finished goods dispatch. It connects the Demand team, Production team, Quality team, and Logistics team in one unified platform.

**Who uses it?**
- 7 Manufacturing Units (Branches)
- 10 User Roles with specific permissions
- Buyers/Customers who place orders

**Tech Stack:**
- Backend: FastAPI + MongoDB
- Frontend: React + TailwindCSS + Shadcn/UI
- Authentication: JWT tokens with Role-Based Access Control (RBAC)

---

## 1.1 SKU ARCHITECTURE (NEW - March 2026)

**Two-Level SKU Structure:**

### Bidso SKU (Base Product)
- **Format:** `{VerticalCode}_{ModelCode}_{NumericCode}`
- **Example:** `KS_PE_001` (Kids Scooter, Pulse model, #001)
- **Purpose:** Internal/base product definition
- **Contains:** Common BOM shared by all branded variants

### Buyer SKU (Branded Variant)
- **Format:** `{BrandCode}_{BidsoSKU}`
- **Example:** `BE_KS_PE_001` (Baybee brand variant of KS_PE_001)
- **Purpose:** Customer-facing product with brand-specific additions
- **Contains:** Brand-specific BOM items (labels, packaging, etc.)

**Hierarchy:**
```
Vertical (e.g., Kids Scooter - KS)
└── Model (e.g., Pulse - PE)
    └── Bidso SKU (KS_PE_001)
        ├── Common BOM (shared components)
        ├── Buyer SKU: BE_KS_PE_001 (Baybee variant)
        ├── Buyer SKU: FC_KS_PE_001 (Firstcry variant)
        └── Buyer SKU: WM_KS_PE_001 (Walmart variant)
```

**BOM Structure:**
1. **Common BOM** - Locked at Bidso SKU level (core components)
2. **Brand-specific BOM** - Additional RM per brand (labels, packaging)
3. **Full BOM for Buyer SKU** = Common BOM + Brand-specific BOM

**Key Collections:**
- `bidso_skus` - Base product definitions
- `buyer_skus` - Branded variants
- `common_bom` - Core BOMs locked at Bidso level
- `brand_specific_bom` - Brand additions

**API Endpoints:**
- `GET/POST /api/sku-management/bidso-skus`
- `GET/POST /api/sku-management/buyer-skus`
- `POST /api/sku-management/buyer-skus/bulk-create`
- `GET/POST /api/sku-management/bom/common/{bidso_sku_id}`
- `POST /api/sku-management/bom/common/{bidso_sku_id}/lock`
- `GET/POST /api/sku-management/bom/brand-specific/{bidso_sku_id}/{brand_id}`
- `GET /api/sku-management/bom/full/{buyer_sku_id}`

---

## 2. MODULES & FEATURES

### 2.1 DASHBOARD MODULE
**Purpose:** Quick overview of factory operations

**Features:**
- Total Raw Materials count
- Total SKUs count  
- Low stock alerts
- Today's production summary
- Production last 7 days chart
- Recent activity feed

**Who uses it:** Everyone (view based on role)

---

### 2.2 DEMAND FORECASTS MODULE
**Purpose:** Record buyer demand before production begins

**Features:**
| Feature | Description |
|---------|-------------|
| Create Forecast | Enter buyer, SKU, month, quantity, priority |
| Confirm Forecast | Move from DRAFT to CONFIRMED status |
| View Lots | See dispatch lots linked to a forecast |
| Add to Lot | Add unallocated quantity to existing/new dispatch lot |
| Export | Download forecasts as Excel |

**Key Columns in Forecast Table:**
- Forecast Qty (what buyer wants)
- Dispatch Allocated (quantity assigned to dispatch lots)
- Production Scheduled (quantity in production plans)
- Schedule Pending (what still needs to be scheduled)

**Who uses it:** 
- **Demand Planner** - Creates and confirms forecasts
- **CPC Planner** - Views confirmed forecasts to plan production

**Data Flow:**
```
Buyer Order → Demand Planner creates Forecast → Confirms Forecast → 
CPC sees it for production planning
```

---

### 2.3 DISPATCH LOTS MODULE
**Purpose:** Group SKUs for shipping to buyers

**Features:**
| Feature | Description |
|---------|-------------|
| Create Lot | Select buyer, add multiple SKU lines with quantities |
| Edit Lot | Change target date, priority, line quantities |
| View Readiness | See % ready based on FG inventory |
| Link to Forecast | Lots automatically link to source forecast |

**Lot Statuses:** CREATED → READY → DISPATCHED

**Who uses it:**
- **Demand Planner** - Creates lots from forecasts
- **Logistics Coordinator** - Dispatches ready lots

**Data Flow:**
```
Confirmed Forecast → Demand Planner creates Dispatch Lot → 
Production fills inventory → Lot becomes READY → Logistics dispatches
```

---

### 2.4 CPC (Central Production Control) MODULE
**Purpose:** Plan and track production across all branches

**3 Tabs:**

#### Tab 1: Production Planning
Shows confirmed forecasts from Demand team. CPC can only plan production for items that have forecasts.

**Features:**
| Feature | Description |
|---------|-------------|
| View Forecasts | See all confirmed forecasts with pending quantities |
| Plan Button | Create production schedule for a forecast |
| Export | Download forecasts as Excel |
| Upload Plan | Bulk upload production plans from Excel template |

**Key Calculation:**
```
Schedule Pending = Forecast Qty - Inventory Available - Already Scheduled
```

#### Tab 2: Branch Capacity
Manage how much each branch can produce per day.

**Features:**
| Feature | Description |
|---------|-------------|
| View Capacity | See each branch's daily capacity and utilization |
| Edit Capacity | Change base capacity for a branch |
| Day-wise Upload | Upload Excel with specific dates and capacities |
| 7-Day Forecast | Click branch to see upcoming availability |

#### Tab 3: Production Schedule
See what's scheduled across all branches by date.

**Features:**
| Feature | Description |
|---------|-------------|
| Branch-Date View | Schedules grouped by branch and date |
| Filters | Filter by date range and branch |
| Capacity Check | Shows capacity vs scheduled vs available |

**Who uses it:**
- **CPC Planner** - Plans production, manages capacity
- **Branch Ops User** - Views schedules for their branch

**Data Flow:**
```
Confirmed Forecast → CPC selects forecast → Picks branch & date → 
Checks capacity → Creates Production Schedule → Branch executes
```

---

### 2.5 TECH OPS MODULE
**Purpose:** Manage master data that defines products

**Entities:**
| Entity | Description | Example |
|--------|-------------|---------|
| Verticals | Product categories | SCOOTER, TRIKE, BICYCLE |
| Models | Product models under verticals | DASH, ZOOM, FLASH |
| Brands | Brand names (tied to buyers) | AMAZON, FLIPKART |
| Buyers | Customers who place orders | ABC Toys Inc |

**Features:**
- Create, Edit, Delete for all entities
- Link Models to Verticals
- Link Brands to Buyers
- Cascading filters (Vertical → Model → Brand)

**Who uses it:**
- **Tech Ops Engineer** - Manages all master data
- **Master Admin** - Full access

**Data Flow:**
```
Tech Ops creates Vertical → Creates Models under it → 
Creates Buyers → Links Brands to Buyers → SKUs reference these
```

---

### 2.6 RAW MATERIALS (RM) MODULE
**Purpose:** Track raw material inventory

**RM Categories:**
| Code | Name | Count |
|------|------|-------|
| INP | In-house Plastic | 955 |
| ACC | Accessories | 261 |
| ELC | Electric Components | 39 |
| LB | Labels | 540 |
| PM | Packaging | 137 |
| SP | Spares | 192 |
| BS | Brand Assets | 278 |

**Features:**
| Feature | Description |
|---------|-------------|
| View RMs | Paginated list with filters (category, type, model, brand) |
| RM Inward | Record incoming raw material purchases |
| Auto-ID | System generates RM IDs like INP_1001 |
| Branch Stock | Each branch tracks its own inventory |

**Who uses it:**
- **Procurement Officer** - Records RM purchases
- **Branch Ops User** - Views branch RM stock

---

### 2.7 SKU MODULE
**Purpose:** Manage finished goods definitions

**Features:**
| Feature | Description |
|---------|-------------|
| View SKUs | 709 SKUs with cascading filters |
| BOM Mapping | Define which RMs make each SKU |
| Branch Subscription | Assign SKUs to branches that produce them |
| Bulk Subscribe | Subscribe entire Vertical/Model to a branch |

**SKU Structure:**
```
SKU links to: Vertical → Model → Brand → Buyer
Example: FC_KS_BE_115 (Kids Scooter, Blue, LED wheels)
```

**Who uses it:**
- **Tech Ops Engineer** - Creates SKUs, manages BOM
- **Branch Ops User** - Views subscribed SKUs

---

### 2.8 PRODUCTION MODULE
**Purpose:** Record actual production output

**Features:**
| Feature | Description |
|---------|-------------|
| Production Entry | Record units produced per SKU per branch |
| Production Batches | Group production into trackable batches |
| Auto Consumption | System deducts RMs based on BOM |
| Cascading Filters | Filter SKUs by Vertical/Model/Brand when entering |

**Who uses it:**
- **Branch Ops User** - Records daily production
- **CPC Planner** - Views production against schedules

**Data Flow:**
```
Production Schedule created → Branch produces → 
Records Production Entry → System deducts RM inventory → 
FG Inventory increases
```

---

### 2.9 QUALITY CONTROL MODULE
**Purpose:** Ensure product quality before dispatch

**Features:**
| Feature | Description |
|---------|-------------|
| QC Checklists | Define inspection criteria for SKUs |
| QC Results | Record pass/fail for each checklist item |
| QC Approvals | Approve batches after inspection |

**Who uses it:**
- **Quality Inspector** - Performs inspections, records results

**Data Flow:**
```
Production Batch created → QC Inspector checks quality → 
Records Results → Approves/Rejects batch → 
Approved batches go to FG Inventory
```

---

### 2.10 VENDOR & PROCUREMENT MODULE
**Purpose:** Manage suppliers and purchases

**Features:**
| Feature | Description |
|---------|-------------|
| Vendor Management | Add vendors with GST, address, contact |
| RM Pricing | Map RMs to vendors with prices |
| Price Comparison | See lowest price per RM across vendors |
| Purchase Orders | Create POs, send to vendors, receive goods |

**Who uses it:**
- **Procurement Officer** - Manages vendors, creates POs

---

### 2.11 LOGISTICS MODULE
**Purpose:** Handle dispatch and transfers

**Features:**
| Feature | Description |
|---------|-------------|
| Dispatches | Record outgoing shipments |
| Invoices | Generate invoices with tax calculation |
| Inter-Branch Transfer | Move inventory between branches |

**Who uses it:**
- **Logistics Coordinator** - Manages dispatches, IBT

---

### 2.12 USER MANAGEMENT MODULE
**Purpose:** Control system access

**Features:**
| Feature | Description |
|---------|-------------|
| Create Users | Add new users with email/password |
| Assign Roles | Give users specific role permissions |
| View Users | See all users with their roles |

**Who uses it:**
- **Master Admin** - Full user management

---

## 3. USER ROLES & PERMISSIONS

| Role | What They Can Do |
|------|------------------|
| **Master Admin** | Everything - full system access |
| **Demand Planner** | Create forecasts, dispatch lots, view SKUs |
| **Tech Ops Engineer** | Manage verticals, models, brands, buyers, BOMs |
| **CPC Planner** | Plan production, manage branch capacity |
| **Procurement Officer** | Manage vendors, create purchase orders |
| **Branch Ops User** | Record production, view branch inventory |
| **Quality Inspector** | Perform QC, approve batches |
| **Logistics Coordinator** | Dispatch goods, manage transfers |
| **Finance Viewer** | Read-only access to financial data |
| **Auditor** | Read-only access to everything |

---

## 4. END-TO-END DATA FLOW

### The Complete Journey: Order to Dispatch

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEMAND PLANNING                              │
├─────────────────────────────────────────────────────────────────────┤
│  1. Buyer places order                                               │
│  2. Demand Planner creates FORECAST (Buyer + SKU + Qty + Month)     │
│  3. Demand Planner CONFIRMS forecast                                 │
│  4. Demand Planner creates DISPATCH LOT (groups SKUs for shipping)  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION PLANNING (CPC)                       │
├─────────────────────────────────────────────────────────────────────┤
│  5. CPC Planner views confirmed forecasts                           │
│  6. Checks available INVENTORY (if any already in stock)            │
│  7. Calculates SCHEDULE PENDING = Forecast - Inventory - Scheduled  │
│  8. Creates PRODUCTION SCHEDULE (assigns branch + date + qty)       │
│  9. System validates BRANCH CAPACITY before allowing schedule       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         PROCUREMENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│  10. Procurement checks RM REQUIREMENTS based on BOM                │
│  11. Creates PURCHASE ORDERS for missing raw materials              │
│  12. Receives goods, updates RM INVENTORY                           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION EXECUTION                           │
├─────────────────────────────────────────────────────────────────────┤
│  13. Branch Ops views PRODUCTION SCHEDULE for their branch          │
│  14. Produces goods, records PRODUCTION ENTRY                       │
│  15. System auto-deducts RM INVENTORY based on BOM                  │
│  16. Creates PRODUCTION BATCH for tracking                          │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        QUALITY CONTROL                               │
├─────────────────────────────────────────────────────────────────────┤
│  17. QC Inspector performs inspection on batch                      │
│  18. Records QC RESULTS (pass/fail per checklist item)              │
│  19. APPROVES batch → moves to FINISHED GOODS INVENTORY             │
│      OR REJECTS batch → goes for rework                             │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          DISPATCH                                    │
├─────────────────────────────────────────────────────────────────────┤
│  20. Dispatch Lot shows READINESS % based on FG inventory           │
│  21. When 100% ready, Logistics creates DISPATCH                    │
│  22. Generates INVOICE                                              │
│  23. Goods shipped to buyer                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. KEY CALCULATIONS

### Schedule Pending (in CPC)
```
Schedule Pending = Forecast Qty - FG Inventory - Already Scheduled

Example:
- Forecast Qty: 1000 units
- FG Inventory: 200 units (already made)
- Already Scheduled: 300 units (in production)
- Schedule Pending: 1000 - 200 - 300 = 500 units still to plan
```

### Dispatch Lot Readiness
```
Readiness % = (Available FG Inventory / Required Qty) × 100

Example:
- Lot requires: 500 units
- FG Inventory: 400 units
- Readiness: 400/500 × 100 = 80% ready
```

### Branch Capacity Utilization
```
Utilization % = (Scheduled Qty / Daily Capacity) × 100

Example:
- Daily Capacity: 500 units
- Already Scheduled: 350 units
- Available: 150 units
- Utilization: 70%
```

---

## 6. BRANCH STRUCTURE

| Branch | Code | Capacity |
|--------|------|----------|
| Unit 1 Vedica | U1 | 500/day |
| Unit 2 Trikes | U2 | 300/day |
| Unit 3 TM | U3 | 400/day |
| Unit 4 Goa | U4 | 600/day |
| Unit 5 Baabus | U5 | 300/day |
| Unit 6 Emox | U6 | 600/day |
| BHDG WH | WH | 0 (Warehouse only) |

---

## 7. DATABASE COLLECTIONS

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and roles |
| `raw_materials` | 2,402 RM definitions |
| `branch_rm_inventory` | RM stock per branch |
| `skus` | 709 SKU definitions |
| `fg_inventory` | Finished goods stock |
| `vendors` | 504 vendor records |
| `forecasts` | Demand forecasts |
| `dispatch_lots` | Dispatch lot headers |
| `dispatch_lot_lines` | Dispatch lot line items |
| `production_schedules` | CPC production schedules |
| `branch_allocations` | Branch production assignments |
| `branch_daily_capacity` | Day-wise capacity overrides |
| `production_entries` | Actual production records |
| `production_batches` | Batch tracking |
| `qc_checklists` | QC criteria |
| `qc_results` | Inspection results |
| `qc_approvals` | Batch approvals |
| `verticals` | Product categories |
| `models` | Product models |
| `brands` | Brand names |
| `buyers` | Customer records |

---

## 8. LOGIN CREDENTIALS

### Admin Account
- Email: `admin@factory.com`
- Password: `admin123`

### Test Accounts (password: `bidso123`)
| Role | Email |
|------|-------|
| Master Admin | `master_admin@factory.com` |
| Demand Planner | `demand_planner@factory.com` |
| CPC Planner | `cpc_planner@factory.com` |
| Tech Ops | `techops@bidso.com` |
| Procurement | `procurement@bidso.com` |
| Branch Ops | `branchops@bidso.com` |
| QC Inspector | `qcinspector@bidso.com` |
| Logistics | `logistics@bidso.com` |

---

## 9. COMPLETED FEATURES (March 2026)

- [x] Multi-branch architecture
- [x] Role-based access control (10 roles)
- [x] Demand Forecasts with confirmation workflow
- [x] Multi-line Dispatch Lots with readiness tracking
- [x] CPC Module with forecast-driven planning
- [x] Branch capacity management (base + day-wise overrides)
- [x] Production scheduling with capacity validation
- [x] Branch-wise production schedule view
- [x] Bulk upload for capacity and production plans
- [x] Schedule Pending considers inventory
- [x] Vendor management with price comparison
- [x] Inter-branch stock transfers
- [x] QC checklists and approvals
- [x] Excel export/import throughout

---

## 10. PENDING TASKS

### P1 - High Priority
- Define Bidso SKU BOM creation workflow (how to author a new BOM for new products)

### P2 - Medium Priority
- Implement Zoho Books API Integration (playbook ready, needs credentials)
- RM Shortage Report UI (backend endpoint exists)
- Auto-generate dispatch lots from forecasts
- Lot status workflow automation
- Production vs Forecast tracking dashboard

### P3 - Future
- Auto-populate Brand column for Buyers (from dispatch data)
- Dispatch Lot Notifications (dashboard alerts)
- Barcode scanning
- Real-time dashboard with auto-refresh
- Multi-month production planning view

### IN PROGRESS (April 6, 2026)
- 🔄 **SKU Data Model Migration** - Migrate from legacy `skus` collection to `bidso_skus` + `buyer_skus`
  - Status: STARTING
  - Scope: 56 references across 9 files
  - Plan: `/app/memory/SKU_MIGRATION_PLAN.md`

### COMPLETED (April 6, 2026)
- ✅ **Production Plan Excel Upload Overhaul** - Complete rewrite with FIFO allocation, capacity conflict detection, and Excel result report
  - **Three modes**: `check` (default, returns warning if conflicts), `add` (allocate within remaining), `override` (clear existing and allocate)
  - **FIFO allocation**: First rows in file get full allocation before later rows
  - **Conflict dialog**: Frontend shows conflict summary with Override/Add options
  - **Excel result**: Status (SCHEDULED/PARTIAL/REJECTED/ERROR), Allocated, Not Allocated, Schedule Code, Remarks columns
  - **Date format**: Standardized to DD-MM-YYYY across all templates

### COMPLETED (April 4, 2026)
- ✅ Consolidated IBT routes into procurement_routes.py (removed legacy duplicate routes from report_routes.py)
- ✅ IBT Module Overhaul - 6 features: inventory validation, transit tracking, variance logging, shortage records

---

## 11. CPC MODULE STATUS (UPDATED - April 6, 2026)

### What's Working:
1. **Production Planning Tab** - Shows confirmed forecasts from Demand team
2. **Branch Capacity Tab** - Day-wise capacity upload with branch cards
3. **Production Schedule Tab** - Branch-wise per-day schedule view
4. **Production Plan Excel Upload (NEW)** - FIFO allocation with capacity conflict detection

### Production Plan Upload (NEW - April 6, 2026):
The bulk upload feature now supports intelligent capacity management:

**Endpoint:** `POST /api/cpc/production-plan/upload-excel?mode={check|add|override}`

**Modes:**
| Mode | Description |
|------|-------------|
| `check` (default) | Validates and returns conflict info if existing schedules + new demand > capacity |
| `add` | Keeps existing schedules, allocates only within remaining capacity |
| `override` | Clears existing schedules for conflicting dates/branches, then allocates fresh |

**Excel Result Columns:**
| Column | Description |
|--------|-------------|
| Status | SCHEDULED / PARTIAL / REJECTED / ERROR |
| Allocated | Quantity successfully allocated |
| Not Allocated | Overflow quantity (for PARTIAL/REJECTED) |
| Schedule Code | Generated code (PS_YYYYMM_XXXX) |
| Remarks | Details about allocation or error |

**FIFO Allocation Logic:**
1. Rows are grouped by Date + Branch
2. For each group, rows are processed in order (first rows in file get priority)
3. Capacity is reduced after each allocation
4. Later rows may get PARTIAL or REJECTED status if capacity exhausted

**Frontend Dialog:**
- When `check` mode detects conflicts, a dialog appears showing conflict summary
- User can choose "Override Existing" or "Add to Remaining Capacity"
- Result Excel is automatically downloaded after processing

### Rules Enforced:
- **No standalone schedule creation** - All planning starts from forecasts
- **Branch is REQUIRED** - Cannot create schedule without branch
- **Status = SCHEDULED** - When branch is assigned (not DRAFT)
- **Inventory considered** - Schedule Pending = Forecast - Inventory - Scheduled

### APIs Added:
- `GET /api/cpc/rm-shortage-report` - RM shortage by branch
- `GET /api/cpc/rm-shortage-report/download` - Excel export
- `DELETE /api/cpc/cleanup/unassigned-schedules` - Data cleanup
- `POST /api/cpc/fix-draft-schedules` - Fix legacy DRAFT status

### Navigation Changes (March 15, 2026):
- **Production Planning page REMOVED** - No longer in sidebar/routes
- **SKU Subscription moved under CPC** - Now visible to CPC_PLANNER role
- CPC is the ONLY way to plan production

### SKU Subscription Module (Restored):
- `POST /api/sku-branch-assignments/upload` - Upload SKU IDs from Excel
- `GET /api/sku-branch-assignments` - List assignments by branch
- `DELETE /api/sku-branch-assignments/{sku_id}/{branch}` - Remove single assignment
- `POST /api/sku-branch-assignments/bulk-subscribe` - Bulk subscribe by vertical/model
- `DELETE /api/sku-branch-assignments/bulk-unsubscribe` - Bulk unsubscribe

---

## 12. BUYERS MODULE STATUS (COMPLETE - March 16, 2026)

### New Data Model:
| Field | Type | Description |
|-------|------|-------------|
| `customer_code` | String | Auto-generated unique code (CUST001, CUST002, etc.) |
| `name` | String | Customer/Buyer name (required) |
| `gst` | String | GST Number |
| `email` | String | Contact email |
| `phone_no` | String | Phone number |
| `poc_name` | String | Point of Contact name |
| `brands_dispatched` | Array | Auto-populated from dispatch data |

### Features:
- **Auto-generated Customer Code**: Format CUST001, CUST002, etc.
- **Excel Import**: Bulk import buyers from Excel file
- **Brands Column**: Shows brands dispatched to each buyer (from dispatch_lots aggregation)
- **Soft Delete**: Buyers are marked INACTIVE, not deleted

### APIs:
- `GET /api/buyers` - Returns all buyers with brands_dispatched field
- `POST /api/buyers` - Create buyer (customer_code auto-generated)
- `PUT /api/buyers/{buyer_id}` - Update buyer (customer_code preserved)
- `DELETE /api/buyers/{buyer_id}` - Soft delete buyer
- `POST /api/buyers/bulk-import` - Bulk import from Excel
- `DELETE /api/buyers/clear-all` - Admin cleanup endpoint

### Frontend Updates:
- 7 columns: Customer Code, Customer Name, GST, Email, Phone No, POC Name, Brands
- Import Excel button with expected column guide
- Add Buyer dialog shows "Customer code will be auto-generated"
- Edit Buyer dialog shows customer_code as read-only

---

---

## 13. DEMAND FORECASTS BULK UPLOAD FIX (March 18, 2026)

### Issue Fixed:
- **UI Non-responsive on Re-upload**: When a user tried to re-upload an Excel file (same or different file), the file picker would not trigger the `onChange` event again, making the UI appear frozen.

### Root Cause:
- The file input's value was not being reset after processing, so the browser's `onChange` event would not fire for the same file selection.

### Solution:
- Added `e.target.value = ''` after file processing in `handleFileSelect()` function in `Demand.js`
- This resets the file input, allowing the same file to be re-selected

### Files Modified:
- `frontend/src/pages/Demand.js` - Line 421 and 427

---

## 14. FORECAST EXPORT & DISPATCH LOT TEMPLATE (March 18, 2026)

### New Features:

#### 1. Forecast Export with Filters (Demand page)
- **Button**: "Export Forecasts" on Demand Forecasts tab
- **Filters available**:
  - Start/End Month (date range)
  - Buyer
  - Brand
  - Model
  - Status (Draft/Confirmed/Converted)
- **Output**: Excel file with columns: Forecast No, Month, Buyer Name, Vertical, Model, Brand, SKU ID, SKU Description, Forecast Qty, Dispatched Qty, Available Qty, Status, Priority
- **Use case**: Export data for creating dispatch lot bulk uploads

#### 2. Dispatch Lot Template Download (Dispatch Lots page)
- **Button**: "Template" on Dispatch Lots header
- **Output**: Excel file with:
  - Main sheet: Sample data with columns (Buyer Name, Forecast No, SKU ID, Qty, Serial No)
  - Instructions sheet: Explains how to use Serial No for grouping lines into lots
- **Sample data**: Shows how rows with same Serial No become one lot with multiple lines

### APIs Added:
- `GET /api/forecasts/export` - Export forecasts with filters (returns Excel)
- `GET /api/dispatch-lots/template` - Download bulk upload template (returns Excel)

### Files Modified:
- `backend/routes/demand_routes.py` - Added export and template endpoints
- `frontend/src/pages/Demand.js` - Added Export dialog with filters
- `frontend/src/pages/DispatchLots.js` - Added Template download button

---

*Last updated: March 18, 2026*
*Forecast Export & Dispatch Lot Template features complete*

---

## 15. CPC BRANCH CAPACITY OVERRIDE SYSTEM (March 18, 2026)

### Requirement:
- Base capacity (branch's default daily capacity) should apply to ALL days of the year
- If a specific day has a capacity upload, it should override the base capacity only for that day

### Implementation:

#### Logic Flow:
```
For any date:
1. Check branch_daily_capacity for (branch, date)
2. If found → Use override capacity
3. If not found → Use branch's base capacity_units_per_day
```

#### Updated Endpoints:

1. **GET /api/branches/{branch}/capacity-for-date**
   - Returns: `base_capacity`, `daily_override_capacity`, `effective_capacity`, `capacity_type`
   - `capacity_type` is one of: `"base"`, `"daily_override"`, `"model_specific"`

2. **GET /api/branches/{branch}/capacity-forecast**
   - Returns: Forecast with `is_override` flag for each day
   - Shows both `base_capacity` and `effective_capacity`

3. **POST /api/branch-allocations (updated)**
   - Now checks for daily override before allocating
   
4. **POST /api/branch-allocations/auto-allocate (updated)**
   - Now uses effective capacity (override or base) for auto-allocation

#### Helper Function:
- `get_effective_branch_capacity(branch_name, date_str, base_capacity)` - Reusable function to get effective capacity

### Files Modified:
- `backend/routes/cpc_routes.py` - Updated capacity lookup in 4 endpoints, added helper function

### Test Results:
```
Date 2026-03-19 (with override): Base=500, Override=750, Effective=750, Type=daily_override
Date 2026-03-20 (no override):   Base=500, Override=None, Effective=500, Type=base
```

---

*Last updated: March 18, 2026*
*CPC Branch Capacity Override System complete*

---

## 16. BRANCH OPS DASHBOARD (March 18, 2026)

### Requirement:
- User x Branch mapped view for branch operations users
- Separate page where branch users see ONLY their assigned branch's schedules
- Date filtering: today, week, month, or custom date range

### Implementation:

#### New Backend Routes (`/app/backend/routes/branch_ops_routes.py`):
1. **GET /api/branch-ops/my-branches** - Returns user's assigned branches
2. **GET /api/branch-ops/schedules** - Get production schedules with filters
   - `date_filter`: today, week, month, custom
   - `start_date`, `end_date`: For custom range
   - `branch`: Optional specific branch filter
   - `status`: SCHEDULED, COMPLETED, CANCELLED
3. **GET /api/branch-ops/dashboard** - Summary stats for user's branches
4. **PUT /api/branch-ops/schedules/{id}/complete** - Mark schedule as completed

#### Security:
- Branch ops users ONLY see schedules for their `assigned_branches`
- Master admin sees all branches
- Branch access is validated on all operations

#### New Frontend Page (`/app/frontend/src/pages/BranchOps.js`):
- Dashboard cards: Today's Production, Today's Quantity, This Week, Completion Rate
- Filters: Date Filter dropdown, Branch dropdown (if multiple), Status dropdown
- Production Schedules table with Complete buttons
- Complete dialog with quantity input and notes

#### Test Users Created:
- `branchops@unit1.com` / `bidso123` - Assigned to Unit 1 Vedica

### Files Created/Modified:
- `backend/routes/branch_ops_routes.py` (NEW)
- `backend/routes/__init__.py` (updated)
- `backend/server.py` (updated)
- `frontend/src/pages/BranchOps.js` (NEW)
- `frontend/src/App.js` (updated)
- `frontend/src/components/Layout.js` (updated)

---

## 17. RM REPOSITORY & TAGGING SYSTEM (March 26, 2026)

### Requirement:
- Raw Materials (RM) can be tagged with Brand, Vertical, and Model metadata
- Demand Planners can request new RMs to be created
- Tech Ops engineers approve/reject RM requests
- Dedicated page for Tech Ops to manage RM tags and approve requests

### Data Model Updates (`raw_materials` collection):
| Field | Type | Description |
|-------|------|-------------|
| `brand_ids` | Array | List of brand IDs this RM can be used with |
| `vertical_ids` | Array | List of vertical IDs this RM belongs to |
| `model_ids` | Array | List of model IDs this RM belongs to |
| `is_brand_specific` | Boolean | Whether RM is brand-specific (labels, packaging) |

### New Collection: `rm_requests`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Request ID |
| `requested_by` | String | User ID of requester |
| `requester_name` | String | Name of requester |
| `category` | String | RM category (LB, PM, etc.) |
| `requested_name` | String | Name/description for new RM |
| `description` | String | Detailed description |
| `brand_ids` | Array | Brands this RM is for |
| `buyer_sku_id` | String | Optional Buyer SKU reference |
| `status` | Enum | PENDING / APPROVED / REJECTED |
| `created_rm_id` | String | RM ID created upon approval |
| `requested_at` | DateTime | Request timestamp |
| `reviewed_at` | DateTime | Review timestamp |
| `reviewed_by` | String | Reviewer user ID |
| `review_notes` | String | Notes from reviewer |

### API Endpoints:

**RM Tagging:**
- `GET /api/raw-materials/by-tags` - Get RMs with tag filters (brand, vertical, model, category)
- `PUT /api/raw-materials/{rm_id}` - Update RM tags (brand_ids, vertical_ids, model_ids, is_brand_specific)
- `POST /api/raw-materials/{rm_id}/tag` - Add tags to RM (preserves existing)

**RM Requests:**
- `GET /api/rm-requests` - Get all RM requests (optionally filter by status)
- `GET /api/rm-requests/pending-count` - Get count of pending requests
- `POST /api/rm-requests` - Create new RM request (Demand Planner)
- `POST /api/rm-requests/{request_id}/review` - Approve/Reject request (Tech Ops)

### Frontend Page: `/rm-repository`

**RM Repository Tab:**
- Stats cards: Total RMs, Tagged RMs, Brand Specific, Pending Requests
- Filters: Search, Category, Brand, Vertical, Model, Brand Specific
- Table: RM ID, Category, Name, Brands, Verticals, Models, Brand Specific, Actions
- Bulk tag operations (select multiple RMs, add tags to all)
- Edit Tags dialog for individual RMs

**RM Requests Tab:**
- Table: Status, Category, Requested Name, For Brands, Buyer SKU, Requested By, Date, Actions
- Quick Approve/Reject buttons for pending requests
- Shows created RM ID for approved requests

### Access Control:
- Tech Ops Engineer: Full access to tag management and request approval
- Master Admin: Full access
- Demand Planner: Can create RM requests, view repository (read-only)

### Migration Notes:
- 1,843 existing RMs were auto-tagged based on legacy BOM relationships
- Total RMs: 2,576
- Auto-tagging script analyzed BOM configurations to infer brand/vertical/model associations

### Files Created/Modified:
- `backend/routes/rm_routes.py` - Updated with tagging and request endpoints
- `backend/models/core.py` - Updated RawMaterial model with tag fields
- `frontend/src/pages/RMRepository.js` - NEW RM Repository page
- `frontend/src/App.js` - Added /rm-repository route
- `frontend/src/components/Layout.js` - Added sidebar navigation

---

## 18. DEMAND HUB MODULE (March 26, 2026)

### Purpose:
Provides Demand Planners/KAMs with a self-service portal to:
1. Request new Buyer SKUs (branded variants of base products)
2. Request new Raw Materials (labels, packaging, brand assets)
3. Track their request history and status

### Workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEMAND PLANNER                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Goes to Demand Hub                                          │
│  2. Selects Bidso SKU (base product)                           │
│  3. Picks Brand → Submits Buyer SKU Request                    │
│  4. OR Creates RM Request (labels, packaging)                  │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                     TECH OPS ENGINEER                           │
├─────────────────────────────────────────────────────────────────┤
│  5. Views requests in RM Repository                            │
│     - "Buyer SKU Requests" tab (new)                           │
│     - "RM Requests" tab (existing)                             │
│  6. Reviews and Approves/Rejects                               │
│  7. On Approval: Buyer SKU or RM is auto-created               │
└─────────────────────────────────────────────────────────────────┘
```

### New Database Collection: `buyer_sku_requests`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Request ID |
| `bidso_sku_id` | String | Base product ID (e.g., KS_PE_001) |
| `brand_id` | String | Brand for the variant |
| `brand_code` | String | Brand code (e.g., FC) |
| `buyer_sku_id` | String | Proposed ID (e.g., FC_KS_PE_001) |
| `status` | Enum | PENDING / APPROVED / REJECTED |
| `requested_by` | String | User ID |
| `requested_at` | DateTime | Request timestamp |
| `reviewed_by` | String | Reviewer user ID |
| `reviewed_at` | DateTime | Review timestamp |
| `review_notes` | String | Notes from reviewer |

### API Endpoints:

**Demand Hub (`/api/demand-hub`):**
- `GET /bidso-skus` - Get Bidso SKUs with filters (vertical, model, search)
- `GET /existing-buyer-skus/{bidso_sku_id}` - Check which brands already have variants
- `POST /buyer-sku-requests` - Create Buyer SKU request
- `GET /buyer-sku-requests` - Get all Buyer SKU requests
- `GET /buyer-sku-requests/pending-count` - Get pending count
- `POST /buyer-sku-requests/{id}/review` - Approve/Reject (Tech Ops)
- `GET /my-requests` - Get current user's requests (RM + Buyer SKU)
- `GET /my-requests/summary` - Get summary counts
- `GET /rm-categories` - Get RM categories for request form

### Frontend Pages:

**Demand Hub (`/demand-hub`):**
- Stats cards: Pending, Approved, SKU Requests, RM Requests
- Tabs: Request Buyer SKU, Request RM, My Requests
- Bidso SKU table with Select buttons
- Existing Buyer SKU display (prevents duplicates)
- Request dialogs with brand selection

**RM Repository Updates (`/rm-repository`):**
- NEW "Buyer SKU Requests" tab
- Shows pending requests with Approve/Reject buttons
- Badge showing pending count

### Access Control:
- **Demand Planner**: Can create requests, view own request history
- **Tech Ops Engineer**: Can view all requests, approve/reject
- **Master Admin**: Full access to both sides

### Files Created/Modified:
- `backend/routes/demand_hub_routes.py` - NEW Demand Hub API
- `frontend/src/pages/DemandHub.js` - NEW Demand Hub UI
- `frontend/src/pages/RMRepository.js` - Updated with Buyer SKU Requests tab
- `frontend/src/App.js` - Added /demand-hub route
- `frontend/src/components/Layout.js` - Added Demand Hub to sidebar

---

## 19. CLONE BIDSO SKU FEATURE (March 26, 2026)

### Purpose:
Allows Demand Planners to create new Bidso SKU variants by cloning existing ones. Instead of recreating entire BOMs from scratch, users can:
1. Select an existing Bidso SKU with a BOM
2. View the BOM with locked/editable indicators
3. Modify only the editable items (change colors, swap accessories, create new RMs)
4. Submit for Tech Ops approval

### Edit Rules:
| RM Category | Edit Type | What Can Be Done |
|-------------|-----------|------------------|
| INP (In-house Plastic) | COLOUR_ONLY | Change to different color variant of same part |
| INM (In-house Metal) | COLOUR_ONLY | Change to different color variant of same part |
| ACC (Accessories) | COLOUR_OR_SWAP | Change color OR swap entirely with different accessory |
| Others (ELC, SP, BS, PM, LB) | LOCKED | Cannot edit - copied as-is |

### Workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEMAND PLANNER (Demand Hub)                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: SELECT SOURCE                                          │
│  - Filter by Vertical/Model                                     │
│  - Select Bidso SKU with existing BOM                           │
│  - Click "Clone"                                                │
├─────────────────────────────────────────────────────────────────┤
│  Step 2: MODIFY BOM                                             │
│  - View all BOM items with Lock/Unlock indicators               │
│  - For editable items (INP/INM/ACC):                            │
│    • Change to different color variant (palette icon)           │
│    • Swap with different RM (refresh icon, ACC only)            │
│    • Create new RM on-the-fly (plus icon)                       │
│  - Modifications shown with before→after                        │
├─────────────────────────────────────────────────────────────────┤
│  Step 3: PREVIEW & SUBMIT                                       │
│  - Enter new SKU name (required)                                │
│  - See summary of modifications                                 │
│  - Preview auto-generated SKU ID format                         │
│  - Submit for approval                                          │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                     TECH OPS (RM Repository)                     │
├─────────────────────────────────────────────────────────────────┤
│  "Bidso SKU Clone" Tab:                                         │
│  - View pending clone requests                                  │
│  - See proposed name, source SKU, modifications count           │
│  - View detail dialog with full BOM summary                     │
│  - Approve → Creates new Bidso SKU, new RMs, and Common BOM     │
│  - Reject → Returns to requester                                │
└─────────────────────────────────────────────────────────────────┘
```

### Database Collections:

**`bidso_clone_requests`**:
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Request ID |
| `status` | Enum | PENDING / APPROVED / REJECTED |
| `source_bidso_sku_id` | String | Source SKU being cloned |
| `proposed_name` | String | Name for new SKU |
| `proposed_description` | String | Optional description |
| `bom_modifications` | Array | List of RM modifications |
| `locked_items_count` | Integer | Count of locked BOM items |
| `total_bom_items` | Integer | Total items in source BOM |
| `requested_by` | String | User ID |
| `requested_at` | DateTime | Request timestamp |
| `created_bidso_sku_id` | String | New SKU ID (on approval) |
| `created_rm_ids` | Array | New RM IDs created (on approval) |

**BOM Modification Structure**:
```json
{
  "original_rm_id": "INP_001",
  "action": "SWAP_COLOUR" | "SWAP_RM" | "CREATE_NEW",
  "new_rm_id": "INP_002" | null,
  "new_rm_name": "Part_Red",
  "new_colour": "Red",
  "new_rm_definition": { ... }  // Only for CREATE_NEW
}
```

### API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/demand-hub/bidso-skus-for-clone` | GET | List SKUs with BOMs for cloning |
| `/api/demand-hub/bidso-skus/{id}/bom-for-clone` | GET | Get BOM with edit indicators |
| `/api/demand-hub/colour-variants/{rm_id}` | GET | Find color variants of an RM |
| `/api/demand-hub/search-rm-for-swap` | GET | Search RMs for swapping (ACC) |
| `/api/demand-hub/bidso-clone-requests` | GET | List clone requests |
| `/api/demand-hub/bidso-clone-requests` | POST | Submit clone request |
| `/api/demand-hub/bidso-clone-requests/{id}` | GET | Get request detail |
| `/api/demand-hub/bidso-clone-requests/{id}/review` | POST | Approve/Reject request |
| `/api/demand-hub/bidso-clone-requests/pending-count` | GET | Get pending count |

### On Approval:
1. Generate new Bidso SKU ID: `{VerticalCode}_{ModelCode}_{NextNumericCode}`
2. Create new RMs for any CREATE_NEW modifications
3. Copy source BOM with modifications applied
4. Create new Common BOM entry
5. Update request with `created_bidso_sku_id` and `created_rm_ids`

### Files Created/Modified:
- `frontend/src/components/CloneBidsoSKU.js` - NEW Clone wizard component (910 lines)
- `frontend/src/pages/DemandHub.js` - Added Clone Bidso SKU tab
- `frontend/src/pages/RMRepository.js` - Added Bidso SKU Clone tab for Tech Ops
- `backend/routes/demand_hub_routes.py` - Added clone endpoints

### Access Control:
- **Demand Planner**: Can create clone requests, view own requests
- **Tech Ops Engineer**: Can view all requests, approve/reject
- **Master Admin**: Full access

### Bug Fix (March 26, 2026):
**Issue**: "Create New Colour Variant" dialog showed empty form fields instead of pre-filled data.
**Root Cause**: Source RM's `category_data` was often empty/missing in the database.
**Fix**: 
1. Backend now returns `mb` and `per_unit_weight` fields explicitly
2. Frontend `handleOpenCreateRmDialog` now attempts to pull data from both `category_data` AND flat fields returned by the API
3. When no structured data exists, a warning message is displayed: "Source RM has no structured data. Please fill in all fields."

---

*Last updated: March 26, 2026*
*Clone Bidso SKU feature complete - Full workflow from Demand Hub request to Tech Ops approval*

---

## 18. DEMAND SKU VIEW MODULE (NEW - March 26, 2026)

**Purpose:** Read-only catalog view for Demand Planners to browse and export SKU master data

**Location:** Demand Planner Sidebar → "SKU Catalog"

### Features:

| Feature | Description |
|---------|-------------|
| Bidso SKUs Tab | View all 255 Bidso SKUs with ID, Name, Vertical, Model, Status |
| Buyer SKUs Tab | View all 711 Buyer SKUs with ID, Vertical, Brand, Model, Buyer, Bidso SKU, Status |
| Vertical Filter | Filter by product vertical (Scooter, Walker, Tricycle, etc.) |
| Model Filter | Filter by product model within selected vertical |
| Brand Filter | Filter Buyer SKUs by brand (Blush Baby, Babyhug, Star & Daisy, etc.) |
| Buyer Filter | Filter Buyer SKUs by specific buyer/customer |
| Search | Search by SKU ID across either tab |
| Download | Export filtered or full list to Excel (.xlsx) |

### Access Control:
- **Demand Planner**: Full read-only access
- **Master Admin**: Full read-only access
- Other roles: No access

### API Endpoints Used:
- `GET /api/demand-hub/bidso-skus` - Fetches enriched Bidso SKU data with vertical/model names
- `GET /api/skus` - Fetches Buyer SKU data with filters
- `GET /api/verticals` - For filter dropdown
- `GET /api/brands` - For filter dropdown
- `GET /api/models` - For filter dropdown
- `GET /api/buyers` - For filter dropdown

### Files:
- `frontend/src/pages/DemandSKUView.js` - Main component (519 lines)
- `frontend/src/App.js` - Added route `/demand-sku-view`
- `frontend/src/components/Layout.js` - Added sidebar link for Demand Planner

---

*Last updated: March 26, 2026*


---

## 20. MATERIAL REQUISITION PLANNING (MRP) MODULE (March 27, 2026)

**Purpose:** Automate raw material procurement planning with 12-month rolling forecasts

**Location:** Sidebar → "MRP Planning" (visible to Master Admin, CPC Planner, Procurement Officer)

### Core Logic:

#### 12-Month Forecast Rules:
```
Month 1: Uses production_plans (SKU-level, day-wise actuals)
Months 2-12: Uses model_level_forecasts split to SKU level using 6-month rolling ratio
```

#### 6-Month Rolling Ratio:
- Calculates historical production ratios from last 6 months of production_plans
- Splits model-level forecasts proportionally to each Bidso SKU within that model
- If no historical data exists, equal split among all SKUs in the model

#### BOM Explosion:
- Takes SKU requirements and explodes via common_bom
- Calculates total RM quantity needed per RM ID
- Applies procurement parameters (safety stock, MOQ, batch size, lead time)

#### Draft PO Generation:
- Consolidates RM requirements by vendor
- Auto-assigns vendors based on:
  1. Preferred vendor in rm_procurement_parameters
  2. Lowest price from vendor_rm_prices
- Calculates order quantities respecting MOQ/batch size

### New Database Collections:

| Collection | Purpose |
|------------|---------|
| `model_level_forecasts` | Model-level monthly forecasts for Months 2-12 |
| `rm_procurement_parameters` | RM-specific parameters (MOQ, lead time, safety stock, preferred vendor) |
| `mrp_runs` | Historical MRP calculation runs with full breakdown |
| `mrp_draft_pos` | Draft Purchase Orders generated from MRP |

### Key Data Schemas:

#### model_level_forecasts:
```json
{
  "id": "uuid",
  "model_id": "model_uuid",
  "model_code": "PE",
  "model_name": "Pulse",
  "vertical_id": "vertical_uuid",
  "vertical_code": "KS",
  "month_year": "2026-04",
  "forecast_qty": 500,
  "created_at": "datetime"
}
```

#### rm_procurement_parameters:
```json
{
  "id": "uuid",
  "rm_id": "ACC_001",
  "rm_name": "Wheel Assembly",
  "category": "ACC",
  "safety_stock": 100,
  "moq": 50,
  "batch_size": 10,
  "lead_time_days": 7,
  "preferred_vendor_id": "vendor_uuid",
  "preferred_vendor_name": "ABC Supplier"
}
```

#### mrp_runs:
```json
{
  "id": "uuid",
  "run_code": "MRP-20260327-193506",
  "run_date": "datetime",
  "status": "CALCULATED/APPROVED/PO_GENERATED",
  "planning_horizon_months": 12,
  "month1_data": {"SKU_001": 100, ...},
  "model_splits": [...],
  "sku_requirements": {"SKU_001": 500, ...},
  "rm_requirements": [
    {
      "rm_id": "ACC_001",
      "total_required": 1000,
      "current_stock": 200,
      "safety_stock": 100,
      "net_requirement": 900,
      "moq": 50,
      "order_qty": 900,
      "vendor_id": "...",
      "vendor_name": "...",
      "unit_price": 25.50,
      "total_cost": 22950.00
    }
  ],
  "total_skus": 258,
  "total_rms": 1302,
  "total_order_value": 573394845.75
}
```

### API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mrp/dashboard` | GET | Dashboard stats (runs, POs, forecasts, shortages) |
| `/api/mrp/runs` | GET | List MRP calculation runs |
| `/api/mrp/runs/{id}` | GET | MRP run detail with RM requirements |
| `/api/mrp/runs/calculate` | POST | Execute MRP calculation |
| `/api/mrp/runs/{id}/approve` | POST | Approve MRP run |
| `/api/mrp/runs/{id}/generate-pos` | POST | Generate Draft POs from run |
| `/api/mrp/draft-pos` | GET | List Draft POs |
| `/api/mrp/draft-pos/{id}` | GET | Draft PO detail with lines |
| `/api/mrp/draft-pos/{id}/vendor` | PUT | Update vendor assignment |
| `/api/mrp/draft-pos/{id}/approve` | POST | Approve Draft PO |
| `/api/mrp/draft-pos/{id}/convert-to-po` | POST | Convert to actual PO |
| `/api/mrp/model-forecasts` | GET | List model-level forecasts |
| `/api/mrp/model-forecasts` | POST | Create/update forecast |
| `/api/mrp/model-forecasts/bulk` | POST | Bulk import forecasts |
| `/api/mrp/rm-params` | GET | List RM procurement parameters |
| `/api/mrp/rm-params` | POST | Create/update RM parameters |
| `/api/mrp/rm-params/bulk` | POST | Bulk import RM parameters |
| `/api/mrp/seed-data` | POST | Seed test data (admin only) |

### Frontend Features:

#### Dashboard Tab (MRP Runs):
- Stats cards: Total Runs, Pending Approval, Draft POs, RM Shortages, Model Forecasts, Pending Value
- MRP Runs table with: Run Code, Date, Status, SKUs, RMs, Order Value, Actions
- Run detail dialog showing RM requirements breakdown
- "Run MRP Calculation" button
- "Generate Draft POs" button

#### Draft POs Tab:
- POs consolidated by vendor
- Table: PO Code, Vendor, MRP Run, Items, Amount, Status, Order Date, Actions
- Approve and Convert to PO workflows
- PO detail dialog with line items

#### Model Forecasts Tab:
- Forecasts for Months 2-12
- Filter by Vertical
- Shows: Vertical, Model, Month, Forecast Qty, Created Date

#### RM Parameters Tab:
- Procurement parameters for each RM in BOM
- Shows: RM ID, Category, MOQ, Batch Size, Lead Time, Safety Stock, Preferred Vendor

### Workflow:

```
┌──────────────────────────────────────────────────────────────┐
│                     1. SETUP                                  │
│  - Seed model_level_forecasts (or import from Excel)         │
│  - Configure rm_procurement_parameters (MOQ, lead time)      │
│  - Set preferred vendors for RMs                             │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  2. RUN MRP CALCULATION                       │
│  - Click "Run MRP Calculation"                               │
│  - System aggregates Month 1 from production_plans           │
│  - System splits Months 2-12 forecasts by rolling ratio      │
│  - BOM explosion calculates RM requirements                  │
│  - Net requirements = Required + Safety - Stock              │
│  - Order qty rounded to MOQ/batch size                       │
│  - Vendors auto-assigned by lowest price                     │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   3. REVIEW MRP RUN                          │
│  - View RM requirements breakdown                            │
│  - Check vendor assignments                                  │
│  - Verify order quantities and costs                         │
│  - Approve run if correct                                    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                 4. GENERATE DRAFT POs                        │
│  - Click "Generate Draft POs"                                │
│  - System creates one Draft PO per vendor                    │
│  - Lines consolidated by RM                                  │
│  - Totals calculated                                         │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  5. APPROVE & CONVERT                        │
│  - Review Draft POs                                          │
│  - Reassign vendor if needed                                 │
│  - Approve Draft PO                                          │
│  - Convert to actual Purchase Order                          │
└──────────────────────────────────────────────────────────────┘
```

### Access Control:
- **Master Admin**: Full access
- **CPC Planner**: Full access (plans production, needs to see RM requirements)
- **Procurement Officer**: Full access (manages purchasing)

### Files Created:
- `backend/models/mrp_models.py` - MRP data models
- `backend/services/mrp_service.py` - MRP calculation engine
- `backend/routes/mrp_routes.py` - MRP API endpoints
- `frontend/src/pages/MRPDashboard.js` - MRP Dashboard UI

### Files Modified:
- `backend/routes/__init__.py` - Added mrp_router
- `backend/server.py` - Registered mrp_router
- `frontend/src/App.js` - Added /mrp route
- `frontend/src/components/Layout.js` - Added MRP to sidebar

### Test Coverage:
- 25 backend API tests (100% pass)
- Frontend UI verification complete
- Test file: `/app/backend/tests/test_mrp_module.py`

### Current Data:
- 1232 model-level forecasts (seeded)
- 1302 RM procurement parameters (seeded)
- 8 MRP calculation runs
- 78 Draft POs generated

---

---

## 15. SKU DATA CONSOLIDATION (March 28, 2026)

### Problem Resolved:
- SKU Catalog (Demand Hub) showed 711 Buyer SKUs from legacy `db.skus` collection
- SKU Management (TechOps) showed 453 Buyer SKUs from newer `db.buyer_skus` collection
- Users saw inconsistent SKU counts depending on which page they visited

### Solution Implemented:
1. **Data Migration**: Migrated 245 missing records from `db.skus` to `db.buyer_skus`
2. **Endpoint Update**: Modified `/api/skus/filtered` to query consolidated `db.buyer_skus` collection
3. **Export/Import Update**: Updated Data Sync feature to use `buyer_skus` collection

### Final State:
- `db.buyer_skus` now contains **730 records** (single source of truth)
- Both SKU Catalog and SKU Management show consistent data
- Backward compatibility maintained via `sku_id` alias field
- 2 test SKUs with DRAFT status (excluded from ACTIVE-only queries)

### Files Modified:
- `backend/routes/sku_routes.py` - Updated `/api/skus/filtered` endpoint
- `backend/routes/demand_hub_routes.py` - Updated export/import functions

---

*Last updated: March 28, 2026*
*SKU Data Consolidation complete - Single source of truth in db.buyer_skus*

---

## 16. MRP ENGINE ENHANCEMENT (March 28, 2026)

### Status: ✅ PHASE 1 COMPLETE - Weekly Time-Phased MRP Implemented

### What Was Implemented

#### Backend (Completed)
- **Weekly MRP Service**: `/app/backend/services/mrp_weekly_service.py` 
  - 1107 lines of optimized code processing 417k entries in ~1.7s
  - Dual BOM explosion (common + brand-specific for M1, common only for M2-12)
  - 7-day site buffer calculation
  - Weekly order bucketing with lead time consideration
  - Chunked storage in `mrp_weekly_plans` collection (avoids 16MB BSON limit)

- **API Endpoints**:
  - `POST /api/mrp/runs/calculate-weekly` - Run weekly MRP calculation
  - `GET /api/mrp/runs/{run_id}/weekly-plan` - Get weekly plan data
  - `GET /api/mrp/runs/{run_id}/weekly-plan/export` - Export to Excel
  - `GET /api/mrp/runs` - Returns `version`, `common_weeks_count`, `summary` fields (Bug fixed March 28, 2026)

#### Frontend (Completed)
- **Weekly Order Plan Tab**: New tab in MRP Dashboard
  - Dropdown filters to show only weekly MRP runs (version=WEEKLY_V1 or common_weeks_count > 0)
  - Summary cards: Order Weeks, Common RMs, Common Value, Brand-Specific RMs, Total Value
  - Expandable week accordions showing detailed RM procurement data
  - Export Excel functionality
  - Run Weekly MRP button

#### Bug Fix (March 28, 2026)
- **Issue**: Weekly Order Plan dropdown was empty
- **Root Cause**: `/api/mrp/runs` endpoint wasn't returning `version` and `common_weeks_count` fields
- **Fix**: Added missing fields to MongoDB projection in `mrp_routes.py`
- **Additional Fix**: Changed TabsList from `grid-cols-4` to `grid-cols-5` for 5 tabs

### Reference Document
See detailed implementation plan: `/app/memory/MRP_IMPLEMENTATION_PLAN.md`

### Key Features Planned

#### 16.1 Weekly Time-Phased MRP
- **Ordering Cycle**: Weekly (Mondays)
- **Site Buffer**: 7 days (material arrives 7 days before production)
- **Order Date Calculation**: Arrival Date - Lead Time
- **Order Week**: Monday of the week containing Order Date

#### 16.2 Dual-Level Forecasting
| Time Horizon | Forecast Level | BOM Used | RM Categories |
|--------------|----------------|----------|---------------|
| Month 1 (M1) | Buyer SKU | common_bom + brand_specific_bom | ALL |
| Months 2-12 | Bidso SKU | common_bom ONLY | Common only (skip BS_, LB_, PM_) |

#### 16.3 Net Requirement Formula
```
NET = GROSS + SAFETY_STOCK + SCRAP_ALLOWANCE
    - AVAILABLE_STOCK
    - SCHEDULED_RECEIPTS (Open POs)
    - IN_TRANSIT
```

#### 16.4 Open PO Integration
- Track PO status: DRAFT → ISSUED → SHIPPED → RECEIVED
- Include pending PO quantities in MRP calculation
- Prevent double-ordering when re-running MRP

#### 16.5 RM Classification
| Prefix | Type | Procure At |
|--------|------|------------|
| ACC_, INP_, SP_, INM_ | COMMON | Bidso SKU level (M1-M12) |
| BS_, LB_, PM_ | BRAND_SPECIFIC | Buyer SKU level (M1 only) |

### Implementation Phases
1. **Phase 1 (MVP)**: ✅ COMPLETE - Weekly breakdown, dual BOM, order timing, UI
2. **Phase 2**: ✅ COMPLETE - Open PO integration (Net = Gross + Safety - Stock - Open POs)
3. **Phase 3**: 🔜 Stock enhancements (quality hold, allocation)
4. **Phase 4**: Advanced (yield factor, supplier constraints)
5. **Phase 5**: Alerts & intelligence

### Phase 2 Implementation (March 28, 2026)

#### Quick Filter Feature (Frontend)
- Added Category dropdown (ACC, ELC, INM, INP, SPR)
- Added Vendor dropdown with all vendors from loaded data
- Clear button to reset filters
- "Showing X items" badge for filtered count
- Week accordion item counts update dynamically

#### Open PO / Scheduled Receipts (Backend)
- Fixed `_get_scheduled_receipts` to query `purchase_order_lines` collection
- Open PO statuses: DRAFT, ISSUED, ACKNOWLEDGED, SHIPPED, IN_TRANSIT, PARTIAL_RECEIVED
- New formula: **Net = Gross + Safety - Stock - Scheduled_Receipts**

#### New Table Columns
- Safety Stock
- Current Stock
- Open PO (purple highlight)
- Net Qty
- Order Qty

### Verified Data (Test Run MRP-20260328-165305)
- 52 Order Weeks generated
- 1302 Common RMs processed  
- Total Order Value: ₹58,35,84,843
- Quick Filter working: ELC filter shows 1081 items, 23 per week

### Phase 3 Implementation: Weekly PO Generation (March 28, 2026)

#### Features Implemented
1. **PO Generation Toolbar**
   - "Select Next 4 Weeks" and "Select All Weeks" buttons
   - Week selection via checkboxes with blue ring highlight
   - Clear button with selection count
   - Download Template, Upload POs, Preview POs buttons

2. **Preview POs Dialog**
   - Summary cards: Vendors count, Items count, Total Amount, Items needing vendor
   - Warning banner for items without vendor assignment
   - Vendor PO list showing item count, weeks, amount, quantity per vendor
   - Download Template and Upload & Generate actions

3. **Download/Upload Workflow**
   - Excel template with 3 sheets: PO_Lines (editable), Vendors_Reference, Instructions
   - Editable columns: Final Qty, Vendor ID, Notes
   - Yellow highlight for rows needing vendor
   - Upload creates Draft POs grouped by vendor

4. **Weekly Draft POs Management**
   - Table showing generated POs with code, vendor, weeks, items, amount, status
   - Edit dialog: Change vendor, modify line quantities
   - Actions: Approve, Issue PO (convert to actual PO)

#### Backend API Endpoints (New)
- `POST /api/mrp/runs/{run_id}/weekly-pos/preview`
- `POST /api/mrp/runs/{run_id}/weekly-pos/download-template`
- `POST /api/mrp/runs/{run_id}/weekly-pos/upload`
- `GET /api/mrp/weekly-draft-pos`
- `PUT /api/mrp/weekly-draft-pos/{id}`
- `PUT /api/mrp/weekly-draft-pos/{id}/line/{rm_id}`

---

*Weekly MRP Phase 1 Completed: March 28, 2026*
*Weekly MRP Phase 2 (Quick Filter + Open PO) Completed: March 28, 2026*
*Weekly MRP Phase 3 (Weekly PO Generation) Completed: March 28, 2026*
*Test Reports: /app/test_reports/iteration_16.json, iteration_17.json, iteration_18.json (100% pass rate)*

---

## MRP v1 - SAVED FOR FUTURE IMPLEMENTATION

**Reference Document**: `/app/memory/MRP_V1_REQUIREMENTS.md`

**Trigger**: When user says "implement MRP v1", refer to the above document.

**Key Features Pending**:
1. Site × RM × Vendor Parameters (multi-dimensional)
2. PO Lot Splitting with staggered delivery dates
3. Safety Days + Frozen Window in calculations
4. Partial Receipt date tracking with GRN
5. Day/Week/Month aggregation toggle
6. Vendor Capacity correlation
7. Air vs Ship transit modes for imports
8. Demand fallback to historical data
9. Zoho Books integration

**Priority Order**: P0 → P1 → P2 → P3 (see document for details)

---

## 21. PANTONE SHADE MANAGEMENT SYSTEM (March 29, 2026)

### Phase 1: COMPLETE ✅

**Reference Document**: `/app/memory/PANTONE_SYSTEM_PLAN.md`

**Overview**: Universal Pantone shade references for INP, INM, and ACC raw materials with vendor-specific master batch mapping and QC approval workflow.

### What Was Implemented

#### Backend (`/app/backend/routes/pantone_routes.py` - 952 lines):
- **Pantone Shades CRUD**: Full create, read, update, soft-delete (deprecate)
- **Vendor Master Batch Mapping**: Link vendors to Pantone codes with master batch codes
- **QC Approval Workflow**: PENDING → APPROVED/REJECTED status flow
- **Set Preferred Vendor**: Only one vendor can be preferred per Pantone shade
- **Bulk Import/Export**: Excel template with 3 sheets (Shades, Vendor Mapping, RM Mapping)
- **Color Development Requests**: Design team can request new Pantone codes (Phase 2 scope)

#### API Endpoints:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pantone/shades` | GET | List all shades with filters (category, color_family, search) |
| `/api/pantone/shades` | POST | Create new Pantone shade |
| `/api/pantone/shades/{id}` | GET | Get shade with vendor mappings |
| `/api/pantone/shades/{id}` | PUT | Update shade |
| `/api/pantone/shades/{id}` | DELETE | Soft delete (deprecate) |
| `/api/pantone/shades/export` | GET | Export all data to Excel |
| `/api/pantone/shades/download-template` | GET | Download import template |
| `/api/pantone/shades/bulk-import` | POST | Bulk import from Excel |
| `/api/pantone/vendor-masterbatch` | POST | Add vendor mapping |
| `/api/pantone/vendor-masterbatch/{id}` | PUT | Update mapping |
| `/api/pantone/vendor-masterbatch/{id}/approve` | PUT | QC approve (master_admin, quality_inspector) |
| `/api/pantone/vendor-masterbatch/{id}/reject` | PUT | QC reject |
| `/api/pantone/vendor-masterbatch/{id}/set-preferred` | PUT | Set as preferred vendor |
| `/api/pantone/vendor-masterbatch/pending` | GET | Get pending approvals |
| `/api/pantone/by-category/{category}` | GET | Get shades by category |

#### Frontend (`/app/frontend/src/components/PantoneLibrary.jsx` - 835 lines):
- **New Tab in TechOps**: "Pantone Library" tab with full CRUD UI
- **Color Swatches**: Visual preview of Pantone colors using hex codes
- **Stats Cards**: Total Shades, With Approved Vendors, Pending Vendor Setup, Total Vendor Mappings
- **Filters**: Search by code/name, Category filter (INP/INM/ACC), Color Family filter
- **Expandable Rows**: Click to see vendor master batch mappings
- **QC Actions**: Approve/Reject buttons for pending vendor mappings
- **Import/Export**: Download template, bulk import, export all data

#### Bug Fix Applied (Testing Agent):
- **Issue**: Export and Download Template endpoints returning 404 "Pantone shade not found"
- **Root Cause**: Route ordering issue - `/shades/{shade_id}` was matching "export" and "download-template" as IDs
- **Fix**: Moved static routes (`/shades/export`, `/shades/download-template`) before dynamic route (`/shades/{shade_id}`)

#### New Collections:
- `pantone_shades`: Universal Pantone code registry with color hex, color family, applicable categories
- `pantone_vendor_masterbatch`: Vendor × Master Batch mapping with approval workflow, delta E values, lead time, MOQ
- `color_development_requests`: Design team requests for new Pantone codes (Phase 2)

### Phase 2: PARTIAL ✅

**What Was Implemented (March 29, 2026)**:
1. **Color Development Sidebar** for Demand Planner role ✅
   - New page at `/color-development`
   - "My Requests" tab - track submitted requests
   - "Available Pantone Shades" tab - browse existing colors
   - "All Requests" tab - view organization-wide requests
   - Submit new color development requests with priority
   - Color preview, category selection, notes/justification

**Still Pending**:
1. Link RMs to Pantone IDs (update `raw_materials` collection)
2. Update BOM flow to support Pantone selection
3. MRP/PO expansion (resolve Pantone → vendor master batch at order time)
4. RM Repository integration (filter RMs by Pantone shade)

**Trigger for remaining Phase 2**: "implement Pantone RM linkage"

### User Requirements Captured:
- **Scope**: INP, INM, ACC categories only
- **Approval**: QC team approves master batches
- **Design Team**: Separate sidebar in Demand Planner role (Phase 2)
- **Pricing**: Master Batch level (vendor-specific)

### Test Results:
- Backend: 23/23 tests passed (100%)
- Frontend: All UI elements verified
- Test report: `/app/test_reports/iteration_19.json`

---

*Phase 1 Completed: March 29, 2026*
*Test Coverage: 100% backend, 100% frontend UI verification*




## 22. SERVER-SIDE PAGINATION (March 30, 2026)

### Phase 1: COMPLETE ✅

**Overview**: Implemented server-side pagination to improve loading performance for pages with 100+ rows.

### What Was Implemented

#### Reusable Pagination Component (`/app/frontend/src/components/Pagination.jsx`):
- Page size selector (10, 25, 50 rows)
- Current page indicator with "Showing X - Y of Z"
- First/Previous/Next/Last page buttons
- Clickable page numbers with ellipsis for large page counts
- Disabled states during loading

#### Backend Updates:
All paginated endpoints return:
```json
{
  "items": [...],
  "total": 258,
  "page": 1,
  "page_size": 50,
  "total_pages": 6
}
```

#### Pages Updated (Phase 1):
| Page | Collection | Total Rows | Status |
|------|-----------|------------|--------|
| SKU Management - Bidso SKUs | `bidso_skus` | 258 | ✅ DONE |
| SKU Management - Buyer SKUs | `buyer_skus` | 730 | ✅ DONE |
| RM Repository | `raw_materials` | 200+ | ✅ DONE |
| Demand Forecasts | `forecasts` | 100+ | ✅ DONE |

#### Backend Endpoints Updated:
- `GET /api/sku-management/bidso-skus` - Added `page`, `page_size` params
- `GET /api/sku-management/buyer-skus` - Added `page`, `page_size` params
- `GET /api/raw-materials/by-tags` - Added `page`, `page_size` params
- `GET /api/forecasts` - Added `page`, `page_size`, `search` params

#### Key Features:
- **Server-side filtering**: Filters apply to entire dataset before pagination
- **Page reset on filter change**: Changing filters resets to page 1
- **Search integration**: Search queries are sent to server for full-dataset search

### Phase 2: PENDING
- Dispatch Lots page
- MRP Dashboard (500+ rows)
- Vendors page
- Production entries
- CPC plans

---

*Phase 1 Completed: March 30, 2026*



## 23. BOM DATA CONSOLIDATION (March 30, 2026)

### COMPLETE ✅

**Problem**: Two conflicting BOM systems existed:
- Old: `sku_mappings` collection (legacy, 1 document)
- New: `common_bom` + `brand_specific_bom` collections (253+ BOMs)

### Changes Made

#### 1. Removed Legacy SKU Mapping Page
- Removed `/sku-mapping` route from App.js
- Removed "RM-SKU Mapping" from sidebar in Layout.js
- Cleared `sku_mappings` collection (1 document)
- Cleared `bill_of_materials` collection (20,159 legacy documents)

#### 2. Added Bulk BOM Upload to SKU Management

**New Endpoints**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sku-management/bom/bulk-upload/template` | GET | Download Excel template |
| `/api/sku-management/bom/bulk-upload` | POST | Upload BOM from Excel |
| `/api/sku-management/bom/export` | GET | Export all BOM data |

**Upload Logic (Buyer SKU → Bidso SKU)**:
- When uploading Buyer SKU BOM, system finds linked Bidso SKU
- Items marked `BRAND_SPECIFIC=N` → Common BOM (Bidso SKU's `common_bom`)
- Items marked `BRAND_SPECIFIC=Y` → Brand-specific BOM (`brand_specific_bom`)
- Existing items are updated, new items are added (merge logic)
- Locked BOMs are skipped with warning

**Template Structure**:
```
BuyerSKU_BOM sheet: BUYER_SKU_ID | RM_ID | QUANTITY | UNIT | BRAND_SPECIFIC
BidsoSKU_BOM sheet: BIDSO_SKU_ID | RM_ID | QUANTITY | UNIT
```

**Export Structure**:
- Common_BOM sheet: All Bidso SKU common BOMs
- Brand_Specific_BOM sheet: All brand-specific additions
- Full_BuyerSKU_BOM sheet: Combined view per Buyer SKU

#### Current Data State
- `common_bom`: 253 BOMs (linked to Bidso SKUs)
- `brand_specific_bom`: Brand additions
- `sku_mappings`: CLEARED (legacy)
- `bill_of_materials`: CLEARED (legacy)

### Single Source of Truth
```
Bidso SKU (Base Product)
├── Common BOM → `common_bom` collection
│
└── Buyer SKU (Branded Variant)
    └── Brand-Specific BOM → `brand_specific_bom` collection

Full Buyer SKU BOM = Common BOM + Brand-Specific BOM
```

---

## CHANGELOG

### March 30, 2026 - Raw Materials Export Fix
**Issue**: When exporting Raw Materials, only the paginated view (50-100 rows) was downloaded instead of the complete dataset.

**Root Cause**: The frontend `handleExport` function was exporting the client-side `materials` state, which only contained the current page's data after server-side pagination was implemented.

**Fix Applied**:
1. Added new backend endpoint `GET /api/raw-materials/export` that:
   - Accepts all filter parameters (search, category, type, model, colour, brand, branch)
   - Explicitly ignores pagination parameters
   - Returns ALL matching records as an Excel file
2. Updated frontend `RawMaterials.js` to call this new endpoint with current filters
3. Verified export now returns full dataset (2,583 records vs. 50 paginated rows)

**Testing**: 
- Backend endpoint tested with curl - returns 200 with full dataset
- Filtered export tested (INP category returned 961 rows correctly)

---

### April 3, 2026 - Custom Reports Module

**Feature**: 4 new analytical reports for operations tracking

**Reports Implemented**:
1. **Dispatch by Manufacturing Origin** - Track where dispatched goods were originally manufactured
2. **Production Output by Unit** - What each branch/unit manufactured over time
3. **Forecast vs Actual** - Compare demand forecasts against actual dispatches
4. **Buyer/Customer Dispatch History** - Dispatch history grouped by buyer/customer

**Backend Endpoints** (`/app/backend/routes/report_routes.py`):
- `GET /api/dispatch-by-origin` - Returns summary by manufacturing unit + detailed records
- `GET /api/production-by-unit` - Returns production summary by branch + schedule details
- `GET /api/forecast-vs-actual` - Returns variance analysis with accuracy metrics
- `GET /api/buyer-dispatch-history` - Returns buyer aggregation with top SKUs

**Frontend** (`/app/frontend/src/pages/Reports.js`):
- 4-tab layout with tab-specific views
- Filters: Start Date, End Date, Branch, Buyer
- Summary cards with key metrics
- Detailed data tables
- Export to Excel functionality per tab
- Refresh button to reload data

**Testing**:
- Backend: 17/17 tests passed (100%)
- Frontend: All UI elements verified
- Test report: `/app/test_reports/iteration_20.json`

---

### April 3, 2026 - BOM Upload & Viewer Enhancements

**Bug Fix: BOM Bulk Upload "RM Not Found" Issue**
- **Problem**: BOM upload was failing with "RM not found" errors even when RMs existed
- **Root Cause**: MongoDB query was using case-sensitive exact matching
- **Fix**: Added case-insensitive fallback using regex: `{"$regex": "^{rm_id}$", "$options": "i"}`
- **Files Changed**: `/app/backend/routes/sku_management_routes.py`

**Feature: View Full BOM for Buyer SKUs**
- **Problem**: Users could only view Common BOM for Bidso SKUs, not the complete BOM for Buyer SKUs
- **Solution**: Added "View BOM" button to Buyer SKUs tab with comprehensive dialog showing:
  - Summary cards: Total Items, Common Items, Brand-Specific Items, Parent Bidso SKU
  - Common BOM section (inherited from parent Bidso SKU)
  - Brand-Specific BOM section (unique to this Buyer SKU)
  - Each section shows: RM ID, Description, Quantity, Unit
- **Backend**: Uses existing `GET /api/sku-management/bom/full/{buyer_sku_id}` endpoint
- **Frontend**: `/app/frontend/src/pages/SKUManagement.js` - Added `handleViewBuyerBOM()` and dialog component

**Feature: Category-Specific RM Descriptions**
- Descriptions now follow naming conventions per RM category:
  - Labels (LB): `{Type}_{Buyer SKU}`
  - Packaging (PM): `{Model}_{Type}_{Specs}_{Brand}`
  - Brand Assets (BS): `{Position}_{Type}_{Brand}_{Buyer SKU}`
  - In House Plastic (INP): `{Mould Code}_{Model Name}_{Part Name}_{Colour}_{Masterbatch}`
  - Accessories (ACC): `{Type}_{Model Name}_{Specs}_{Colour}`
  - In House Metal (INM): `{Model Name}_{Part Name}_{Colour}_{Masterbatch}`
  - Spares (SP): `{Type}_{Specs}`
  - Electronic Components (ELC): `{Model}_{Type}_{Specs}`

**Feature: Brand-Specific BOM Line-Level Editing with Approval Workflow**
- **Inline Edit/Delete**: Each brand-specific BOM item shows edit (pencil) and delete (trash) icons on hover
- **Edit Dialog**: Allows changing RM ID, Quantity, and Unit
- **Production Schedule Check**: If SKU is scheduled for production in next 10 days:
  - Edit requires **Master Admin approval**
  - **Notifications sent to**: CPC Planner, Master Admin, relevant Branch Ops
- **If NOT scheduled**: Changes apply immediately
- **New Endpoints**:
  - `GET /api/sku-management/bom/buyer-sku/{id}/check-schedule` - Check production schedule
  - `PUT /api/sku-management/bom/buyer-sku/{id}/item` - Edit BOM item
  - `POST /api/sku-management/bom/buyer-sku/{id}/item` - Add BOM item
  - `DELETE /api/sku-management/bom/buyer-sku/{id}/item/{rm_id}` - Remove BOM item
  - `GET /api/sku-management/bom/change-requests` - List pending approvals
  - `PUT /api/sku-management/bom/change-request/{id}/approve` - Master Admin approves
  - `PUT /api/sku-management/bom/change-request/{id}/reject` - Master Admin rejects
  - `GET /api/sku-management/notifications` - Get user notifications by role
- **New Collections**: `bom_change_requests`, `notifications`

**Other Changes**:
- Added new branch: **Unit 7 BHDG** (PRODUCTION type)

**Testing**:
- Screenshot verification: BOM dialog displays with edit buttons, edit dialog works
- API tested: Edit successfully changed BS_034 quantity from 1 to 2

---

*Last Updated: April 3, 2026*

## 26. RM INWARD / PURCHASE BILL FEATURE (April 3, 2026)

### COMPLETE ✅

**Purpose**: Comprehensive bill/invoice entry dialog for Finance team to record incoming raw materials with full invoice details.

### Features Implemented

#### Backend (`/app/backend/routes/vendor_routes.py`):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rm-inward/bills` | POST | Create full RM inward bill with multiple line items |
| `/api/rm-inward/bills` | GET | List bills with optional branch/vendor filters |

#### Bill Data Structure:
```json
{
  "vendor_id": "uuid",
  "vendor_name": "string",
  "branch": "string",
  "branch_id": "BR_001",
  "bill_number": "INV-2026-001",
  "order_number": "PO-001",
  "bill_date": "2026-04-03",
  "due_date": "2026-05-03",
  "payment_terms": "NET_30",
  "accounts_payable": "Trade Payables",
  "reverse_charge": false,
  "notes": "string",
  "line_items": [
    {"rm_id": "INP_654", "quantity": 100, "rate": 25.50, "tax": "GST_18", "tax_amount": 459, "amount": 2550}
  ],
  "totals": {
    "sub_total": 2550,
    "discount_type": "percentage",
    "discount_value": 5,
    "discount_amount": 127.50,
    "tds_tcs": "TDS_2",
    "tds_tcs_amount": 48.45,
    "tax_total": 459,
    "grand_total": 2833.05
  }
}
```

#### Frontend (`/app/frontend/src/pages/RMInward.js`):
- **Page Header**: Title, stats cards (Bills This Month, Active RMs, Total Qty, Total Value)
- **New Bill Dialog**:
  - Vendor selection dropdown (504 vendors)
  - Branch selection dropdown (8 branches)
  - Bill number, order number inputs
  - Bill date (defaults to today), due date
  - Payment terms (NET_15/30/45/60, Due on Receipt, Custom)
  - Accounts payable (Trade Payables, Sundry Creditors, Other Payables)
  - Reverse charge checkbox
  - Line items table with RM search, quantity, rate, tax selection (GST 5/12/18/28%)
  - Add Line / Remove Line functionality
  - Notes/Remarks textarea
  - Totals section: Sub Total, Discount (% or amount), TDS/TCS, Tax Total, Grand Total
- **Bills Table**: Shows all inward entries with bill number, vendor, RM ID, qty, rate, amount, stock
- **Export Button**: Download bills as Excel

#### Automatic Processing:
1. Creates individual `purchase_entries` for each line item
2. Updates `branch_rm_inventory` for each RM
3. Records `rm_stock_movements` with PURCHASE type

#### Tax Options:
| Code | Label | Rate |
|------|-------|------|
| NONE | None | 0% |
| GST_5 | GST 5% | 5% |
| GST_12 | GST 12% | 12% |
| GST_18 | GST 18% | 18% |
| GST_28 | GST 28% | 28% |

#### TDS/TCS Options:
| Code | Label | Rate |
|------|-------|------|
| NONE | None | 0% |
| TDS_1 | TDS 1% | 1% |
| TDS_2 | TDS 2% | 2% |
| TDS_10 | TDS 10% | 10% |
| TCS_1 | TCS 1% | 1% |

### Access Control:
- **FINANCE_VIEWER**: Added access to RM Inward page and RMStockMovement CREATE permission
- **BRANCH_OPS_USER**: Existing access
- **PROCUREMENT_OFFICER**: Existing access
- **MASTER_ADMIN**: Full access

### Testing:
- Backend: 19/19 API tests passed (100%)
- Frontend: All UI elements verified
- Test Report: `/app/test_reports/iteration_21.json`

### Bugs Fixed During Implementation:
1. Missing `BaseModel` import in `vendor_routes.py` crashed backend
2. Infinite loop in `useEffect` caused "Maximum update depth exceeded" error
3. Invalid HTML in datalist options (span inside option)
4. Missing aria-describedby for accessibility

---

*Completed: April 3, 2026*

## 27. RM INWARD ENHANCEMENTS (April 3, 2026)

### COMPLETE ✅

**Purpose**: Enhanced the RM Inward bill entry with vendor search filtering, auto-populated RM fields (Description, HSN, GST), and fixed form submission issues.

### Features Implemented

#### 1. Vendor Search Filtering
- Added search input above vendor dropdown
- Typing filters vendors in real-time (e.g., typing "IN" shows all vendors with "IN" in name)
- Shows count of matching vendors

#### 2. RM Auto-Population
When an RM ID is selected or typed, the following fields are now auto-populated:
| Field | Source |
|-------|--------|
| Description | Category-specific (e.g., part_name for INP/INM) |
| HSN Code | Default by category: INP=3926, LB=4821, PM=4819, etc. |
| GST Rate | Default by category: INP=18%, LB=12%, BS=5%, etc. |

#### 3. Line Items Table Columns
| Column | Description |
|--------|-------------|
| RM ID | Searchable input with datalist suggestions |
| Description | Auto-filled from RM data, editable |
| HSN | Auto-filled (default by category), editable |
| Qty | Quantity input |
| Rate | Unit rate input |
| Tax | GST dropdown (auto-selected based on category) |
| Amount | Auto-calculated (Qty × Rate) |

#### 4. HSN Default Mapping by Category:
```
INP -> 3926 (Plastic parts)
INM -> 7326 (Metal parts)
ACC -> 8714 (Vehicle accessories)
ELC -> 8544 (Electrical components)
LB  -> 4821 (Labels)
PM  -> 4819 (Packaging materials)
BS  -> 4911 (Brand assets/stickers)
SP  -> 8714 (Spare parts)
```

#### 5. GST Default Mapping by Category:
```
INP, INM, ACC, ELC, SP -> 18%
LB, PM                  -> 12%
BS                      -> 5%
```

### Bugs Fixed:
1. **Vendor search not filtering**: Added real-time filter on vendor name
2. **"Please add at least one valid line item" error**: Fixed RM ID extraction from search input using regex pattern `/^([A-Z]+_\d+)/`
3. **Description/HSN/GST not pre-filling**: Added auto-populate functions `getRMDescription()`, `getHSNCode()`, `getDefaultGST()`
4. **Backend not storing description/hsn**: Updated `vendor_routes.py` to include description and hsn in purchase entries

### Files Modified:
- `/app/frontend/src/pages/RMInward.js`
- `/app/backend/routes/vendor_routes.py`

---

*Completed: April 3, 2026*

---

## 27. PRICE MASTER MODULE (April 4, 2026)

### COMPLETE ✅

**Purpose**: Customer-specific pricing management for Buyer SKUs. Allows Demand team to set and manage unit prices per customer-SKU combination. Finance team uses these prices to auto-populate invoice rates during dispatch lot conversion.

### UI Location
- **Page**: SKU Catalog (`/sku-catalog`)
- **Tab**: Price Master (3rd tab after Bidso SKUs and Buyer SKUs)

### Features Implemented

#### Backend (`/app/backend/routes/price_master_routes.py`):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/price-master` | GET | List prices with filters (customer_id, buyer_sku_id, active_only) |
| `/api/price-master` | POST | Create new price entry |
| `/api/price-master/{id}` | PUT | Update existing price |
| `/api/price-master/{id}` | DELETE | Soft delete (deactivate) price |
| `/api/price-master/lookup` | GET | Get active price for customer+SKU combo |
| `/api/price-master/by-customer/{id}` | GET | Get all prices for a customer |
| `/api/price-master/bulk-upload` | POST | Bulk import from Excel |
| `/api/price-master/template` | GET | Get template columns for bulk upload |

#### Data Model (`price_master` collection):
```json
{
  "id": "uuid",
  "customer_id": "CUST_0001",
  "customer_name": "ABC Toys Inc",
  "buyer_sku_id": "KM_SC_BN_001",
  "sku_name": "Kidsmate - Rideon - Bentley",
  "unit_price": 1500.00,
  "currency": "INR",
  "effective_from": "2026-04-04T...",
  "effective_to": null,
  "notes": "FY 2026-27 pricing",
  "created_by": "user_id",
  "created_at": "2026-04-04T..."
}
```

#### Frontend (`/app/frontend/src/pages/DemandSKUView.js`):
- **Price Master Tab**: Third tab in SKU Catalog page
- **Action Buttons**: Template download, Bulk Upload, Export, Add Price
- **Filter**: Customer dropdown to filter prices by customer
- **Add/Edit Dialog**:
  - Customer selector (required, locked on edit)
  - Buyer SKU selector (required, locked on edit)
  - Unit Price input (₹)
  - Notes field
- **Price Table**: Customer, Buyer SKU, SKU Name, Unit Price, Effective From, Notes, Actions
- **Inline Actions**: Edit (pencil icon), Delete (trash icon)

#### Business Logic:
1. **Price Versioning**: When a new price is created for existing customer+SKU, old price is auto-deactivated (effective_to set)
2. **Active Prices**: Only prices with `effective_to: null` or future date are considered active
3. **Validation**: Customer and Buyer SKU must exist in database

#### Bulk Upload Excel Format:
| customer_id | buyer_sku_id | unit_price | currency | notes |
|-------------|--------------|------------|----------|-------|
| CUST_0001 | ERW001_TVS | 1500.00 | INR | FY 2026-27 |

### Files Created/Modified:
- `/app/backend/routes/price_master_routes.py` (NEW)
- `/app/frontend/src/pages/DemandSKUView.js` (UPDATED - added Price Master tab)

---

*Completed: April 4, 2026*

---

## 28. CPC MODULE MVP SIMPLIFICATION (April 4, 2026)

### COMPLETE ✅

**Purpose**: Simplified CPC (Central Production Control) module for MVP. Removed forecast dependencies and MRP module as per user's request to focus on core production planning functionality.

### Changes Implemented

#### 1. Dashboard - Transfer SKU Button Removed ✅
- **What**: Removed the "Transfer SKU" button from the main dashboard
- **Why**: User requested removal; not needed at dashboard level
- **File**: `/app/frontend/src/pages/Dashboard.js`

#### 2. Production Schedule Upload Simplified ✅
- **Old Format**: Forecast Code | Branch ID | Target Date | Quantity | Priority
- **New Format**: Branch ID | Date | Buyer SKU ID | Quantity (4 columns)
- **Changes**:
  - Backend template updated to provide new format with reference sheets
  - Upload endpoint now creates schedules directly from Buyer SKU IDs (no forecast linking)
  - Priority defaults to "MEDIUM"
- **Files Modified**:
  - `/app/backend/routes/cpc_routes.py` (Template and Upload endpoints)
  - `/app/frontend/src/pages/CPC.js` (UI simplified)

#### 3. MRP Module Rolled Back ✅
- **Sidebar**: Removed "MRP Planning" from sidebar navigation
- **Routes**: Removed `/mrp` route from App.js
- **Documentation**: MRP requirements preserved at `/app/memory/MRP_V1_REQUIREMENTS.md` for future implementation
- **Files Modified**:
  - `/app/frontend/src/components/Layout.js` (removed sidebar item)
  - `/app/frontend/src/App.js` (removed route and import)

#### 4. RM Stock View Enhanced ✅
- **Branch Filter**: Added explicit branch dropdown filter (not just global store)
- **Export Logic**:
  - If branch filtered: Export only that branch's stock
  - If no filter (all branches): Each row includes Branch ID column
- **Pagination**: 100 rows per page (server-side)
- **Download**: Works across ALL pages, not just current view
- **Files Modified**:
  - `/app/frontend/src/pages/RawMaterials.js`
  - `/app/backend/routes/rm_routes.py`

### Upload Template Format (New)
| Branch ID | Date (YYYY-MM-DD) | Buyer SKU ID | Quantity |
|-----------|-------------------|--------------|----------|
| BR_001 | 2026-04-10 | KM_SC_BN_001 | 100 |
| BR_002 | 2026-04-10 | KM_RO_BT_002 | 50 |

### Files Changed
- `/app/backend/routes/cpc_routes.py` - Simplified upload template and endpoint
- `/app/backend/routes/rm_routes.py` - Enhanced export with branch columns
- `/app/frontend/src/pages/CPC.js` - Simplified Production Planning tab
- `/app/frontend/src/pages/Dashboard.js` - Removed Transfer SKU button
- `/app/frontend/src/pages/RawMaterials.js` - Added branch filter dropdown
- `/app/frontend/src/components/Layout.js` - Removed MRP Planning link
- `/app/frontend/src/App.js` - Removed MRP route

### MRP Documentation (Saved for Future)
- `/app/memory/MRP_V1_REQUIREMENTS.md` - Complete MRP v1 specification
- `/app/memory/MRP_IMPLEMENTATION_PLAN.md` - Implementation plan

---

*Completed: April 4, 2026*


---

## 36. PRODUCTION SCHEDULE COMPLETION WITH INVENTORY MANAGEMENT (April 4, 2026)

### Requirement:
When marking a production schedule as "Completed", the system must:
1. Check if sufficient RM stock exists in the branch (based on merged Common + Brand BOM)
2. If insufficient, return an error showing exactly which RMs are short
3. If sufficient, consume RM from `branch_rm_inventory` and add FG to `branch_sku_inventory`

### Implementation:

#### BOM Merge Logic (`get_merged_bom_for_sku`):
```
Full BOM = common_bom (via bidso_sku_id) + brand_bom (via buyer_sku_id)
- Brand items ADD to common items (not replace)
- Returns: {rm_id: total_quantity_per_unit, ...}
```

#### Backend Functions (`/app/backend/routes/branch_ops_routes.py`):
| Function | Purpose |
|----------|---------|
| `get_merged_bom_for_sku(buyer_sku_id)` | Returns merged BOM dict {rm_id: qty} |
| `check_rm_availability_for_production(branch, buyer_sku_id, quantity)` | Returns {sufficient: bool, shortages: [...], bom: {...}} |
| `consume_rm_for_production(branch, buyer_sku_id, quantity, schedule_code)` | Deducts RM and logs to `rm_consumption_log` |
| `add_fg_inventory(branch, buyer_sku_id, quantity, schedule_code)` | Adds FG to `branch_sku_inventory`, logs to `fg_production_log` |

#### API Endpoints:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/branch-ops/schedules/{id}/check-rm` | GET | Pre-check RM availability before completion |
| `/api/branch-ops/schedules/{id}/complete` | PUT | Complete schedule with inventory updates |

#### Error Response (Insufficient RM):
```json
{
  "detail": {
    "error": "INSUFFICIENT_RM_STOCK",
    "message": "Cannot complete production. 30 RM(s) have insufficient stock.",
    "shortages": [
      {"rm_id": "SP_002", "description": "Axle Bolt", "required": 5000, "available": 935, "shortage": 4065}
    ]
  }
}
```

#### Success Response:
```json
{
  "message": "Schedule PS_202604_0002 completed successfully",
  "completed_quantity": 10,
  "rm_consumed": {"total_items": 35, "items": [...]},
  "fg_added": {"buyer_sku_id": "TB_KS_BT_093", "quantity": 10, "branch": "Unit 1 Vedica"}
}
```

#### New Collections:
| Collection | Purpose |
|------------|---------|
| `branch_sku_inventory` | Tracks FG stock by branch + buyer_sku_id |
| `rm_consumption_log` | Audit trail of RM deductions per schedule |
| `fg_production_log` | Audit trail of FG additions per schedule |

#### Frontend (`/app/frontend/src/pages/BranchOps.js`):
- Shows RM shortage dialog when completion fails
- Displays table of short RMs with required/available/shortage amounts
- Toast notification on success/failure

### Test Verification (April 4, 2026):
- ✅ Backend correctly checks RM availability
- ✅ Backend consumes RM and logs to `rm_consumption_log`
- ✅ Backend adds FG and logs to `fg_production_log`
- ✅ Backend returns proper shortage error with details
- ✅ Frontend displays shortage error dialog
- ✅ Schedule status updates to COMPLETED



---

## 37. OVERDUE SCHEDULE HANDLING & SPILLOVER (April 4, 2026)

### Requirement:
1. **Overdue Schedules**: Track and alert when production schedules are past their target_date but still SCHEDULED
2. **Partial Completion**: When completed_qty < target_qty, prompt user to create a spillover schedule for the balance

### Implementation:

#### A. Overdue Schedule Handling

**Backend Endpoints (`/app/backend/routes/branch_ops_routes.py`):**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/branch-ops/overdue-count` | GET | Quick count for dashboard badge |
| `/api/branch-ops/overdue-schedules` | GET | Full list with days_overdue, is_critical flag |
| `/api/branch-ops/reschedule` | POST | Bulk reschedule selected schedules to new date |

**Logic:**
- Overdue = `target_date < today` AND `status = SCHEDULED`
- Critical = 3+ days overdue
- Reschedule updates `target_date` and logs `rescheduled_from`, `rescheduled_by`

**Frontend:**
- Amber/Red alert banner shows when overdue count > 0
- Click opens dialog with table of overdue schedules
- Bulk select + date picker + "Reschedule" button

#### B. Partial Completion Spillover

**Backend Endpoint:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/branch-ops/create-spillover` | POST | Create new schedule for remaining balance |

**Spillover Schedule Fields:**
```json
{
  "is_spillover": true,
  "parent_schedule_id": "uuid",
  "parent_schedule_code": "PS_202604_0001",
  "notes": "Spillover from PS_202604_0001"
}
```

**Frontend Flow:**
1. User enters completed_qty < target_qty
2. On "Confirm Complete":
   - Schedule marked COMPLETED with completed_qty
   - RM consumed, FG added
   - Spillover dialog auto-opens with:
     - Shortfall quantity pre-filled
     - Tomorrow's date pre-selected
3. User chooses:
   - "Create Spillover" → New schedule created
   - "Discard Balance" → No action, balance lost

### Test Verification (April 4, 2026):
- ✅ Overdue count endpoint returns correct count and critical count
- ✅ Overdue schedules endpoint returns list with days_overdue
- ✅ Reschedule endpoint bulk updates schedules to new date
- ✅ Overdue alert banner displays correctly (amber/red based on critical)
- ✅ Overdue dialog shows table with checkboxes and reschedule controls
- ✅ Spillover dialog auto-opens on partial completion
- ✅ Spillover schedule created with correct parent linkage
- ✅ "Discard Balance" closes dialog without action

---

*Last Updated: April 4, 2026*

---

## 22. INTER-BRANCH TRANSFER (IBT) MODULE OVERHAUL (April 4, 2026)

### Overview
The IBT module has been completely overhauled to support strict inventory tracking, transit management, and variance/shortage recording.

### Status Flow
```
INITIATED → APPROVED → IN_TRANSIT → COMPLETED
                     ↓
                CANCELLED (only before dispatch)
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Inventory Check on Create** | Validates source branch has sufficient stock before allowing transfer |
| **Inventory Re-validation** | Checks stock again at approve and dispatch stages |
| **Transit Tracking** | Captures vehicle number, driver name, driver contact, expected arrival |
| **Dispatch Deduction** | Stock is deducted from source branch at dispatch (not approve) |
| **Receiver Input** | Receiving branch enters actual received quantity |
| **Shortage Records** | Automatic variance logging when received < dispatched |
| **Cancel Protection** | Cancel only allowed for INITIATED/APPROVED, not after dispatch |

### API Endpoints (`/app/backend/routes/procurement_routes.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ibt-transfers` | GET | List all transfers with filters |
| `/api/ibt-transfers` | POST | Create transfer (validates inventory) |
| `/api/ibt-transfers/{id}` | GET | Get single transfer with details |
| `/api/ibt-transfers/check-inventory/{type}/{item}/{branch}` | GET | Check available stock |
| `/api/ibt-transfers/{id}/approve` | PUT | Approve transfer (re-validates inventory) |
| `/api/ibt-transfers/{id}/dispatch` | PUT | Dispatch - deducts from source, status=IN_TRANSIT |
| `/api/ibt-transfers/{id}/receive` | PUT | Receive - adds to destination, creates shortage if variance |
| `/api/ibt-transfers/{id}/cancel` | PUT | Cancel (only before dispatch) |
| `/api/ibt-shortages` | GET | List shortage records |
| `/api/ibt-shortages/{id}/resolve` | PUT | Resolve shortage (write-off, recovered, etc.) |

### Database Collections

**ibt_transfers:**
```json
{
  "id": "uuid",
  "transfer_code": "IBT_20260404_0001",
  "transfer_type": "RM",  // or "FG"
  "source_branch": "Unit 1 Vedica",
  "destination_branch": "Unit 2 Trikes",
  "item_id": "INP_654",
  "item_name": "Battery Cover - Red",
  "quantity": 50,
  "dispatched_quantity": 50,
  "received_quantity": 45,
  "variance": 5,
  "status": "COMPLETED",
  "initiated_at": "2026-04-04T19:35:12Z",
  "approved_at": "2026-04-04T19:35:18Z",
  "dispatched_at": "2026-04-04T19:35:22Z",
  "received_at": "2026-04-04T19:35:28Z",
  "vehicle_number": "MH-12-AB-1234",
  "driver_name": "John Driver",
  "driver_contact": "9876543210",
  "expected_arrival": "2026-04-05",
  "notes": "Test transfer",
  "shortage_record_id": "uuid"
}
```

**ibt_shortages:**
```json
{
  "id": "uuid",
  "ibt_transfer_id": "uuid",
  "transfer_code": "IBT_20260404_0001",
  "transfer_type": "RM",
  "item_id": "INP_654",
  "source_branch": "Unit 1 Vedica",
  "destination_branch": "Unit 2 Trikes",
  "dispatched_quantity": 50,
  "received_quantity": 45,
  "shortage_quantity": 5,
  "shortage_percentage": 10.0,
  "status": "PENDING_INVESTIGATION",
  "damage_notes": "5 pieces damaged during transit",
  "received_notes": "Counted 45 pieces",
  "created_at": "2026-04-04T19:35:28Z"
}
```

### Frontend Components (`/app/frontend/src/pages/IBT.js`)

| Component | Description |
|-----------|-------------|
| Summary Cards | Total, Pending, In Transit, Completed, Shortages counts |
| Shortage Alert | Banner showing pending investigation count |
| Transfers Table | List with status badges, variance indicators |
| Create Dialog | Transfer type, branches, item, quantity, transit details |
| Dispatch Dialog | Transit details update, inventory warning |
| Receive Dialog | Actual quantity input, damage/receipt notes |
| Detail Dialog | Full transfer timeline, transit info, shortage details |

### Technical Debt Resolved
- Removed duplicate legacy IBT endpoints from `/app/backend/routes/report_routes.py`
- Consolidated all IBT logic into `/app/backend/routes/procurement_routes.py`

### Test Verification (April 4, 2026)
- ✅ 20/20 backend API tests passed (100%)
- ✅ All frontend UI elements verified
- ✅ Inventory validation on create/approve/dispatch working
- ✅ Shortage record creation on variance working
- ✅ Cancel protection working (blocked after dispatch)
- ✅ Transit details captured and displayed correctly

---





---

## 23. IN-HOUSE PRODUCTION MODULE (April 5, 2026)

### Overview
This module enables tracking of internally manufactured raw materials (L2/L3) that are produced by consuming other raw materials (L1/L2).

### BOM Levels
| Level | Description | Source Type | Examples |
|-------|-------------|-------------|----------|
| L1 | Raw purchased materials | PURCHASED | Polymers, Master Batches, Pipes, Powder |
| L2 | First transformation | MANUFACTURED/BOTH | Molded plastic parts, Fabricated metal parts |
| L3 | Second transformation | MANUFACTURED/BOTH | Powder coated parts |

### Source Types
| Type | Purchased Inward | Production Inward | Has BOM |
|------|------------------|-------------------|---------|
| PURCHASED | ✅ | ❌ | No |
| MANUFACTURED | ❌ | ✅ | Yes |
| BOTH | ✅ | ✅ | Yes |

### New Categories Added
| Code | Name | Level | Default Source |
|------|------|-------|----------------|
| POLY | Polymer Grades | L1 | PURCHASED |
| MB | Master Batches | L1 | PURCHASED |
| PWD | Powder Coating Materials | L1 | PURCHASED |
| PIPE | Metal Pipes | L1 | PURCHASED |
| INM_FAB | Fabricated Metal Parts | L2 | BOTH |

### Database Collections
- `rm_categories` - Category master with source type defaults
- `rm_bom` - Bill of Materials for manufactured RMs
- `rm_production_log` - Production entries with component consumption

### API Endpoints (Backend Complete)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/production/rm-categories` | GET | List all RM categories |
| `/api/production/rm-categories/{code}` | GET/PUT | Get/Update category |
| `/api/production/rm-categories` | POST | Create category |
| `/api/rm-bom` | GET/POST | List/Create BOMs |
| `/api/rm-bom/{rm_id}` | GET/PUT/DELETE | Manage specific BOM |
| `/api/rm-production/preview` | POST | Preview production consumption |
| `/api/rm-production/confirm` | POST | Confirm production & consume |
| `/api/rm-production/log` | GET | Get production history |
| `/api/rm-production/summary` | GET | Category-wise summary |
| `/api/rm-production/consumption-report` | GET | L1 consumption report |
| `/api/rm-production/manufacturable-rms` | GET | List RMs that can be produced |
| `/api/rm-production/active-categories` | GET | Categories with active BOMs |

### Status
- ✅ Backend models created (`/app/backend/models/production.py`)
- ✅ Backend routes created (`/app/backend/routes/rm_production_routes.py`)
- ✅ RM Categories seeded (15 categories)
- ✅ Existing RMs updated with source_type (INP=MANUFACTURED, INM=BOTH, others=PURCHASED)
- ✅ Tech Ops - Category Management UI (Phase 1B complete)
- ✅ Tech Ops - RM BOM Management UI (Phase 1C complete)
- ✅ RM Repository - Source Type & BOM Level columns/filters (Phase 1D complete)
- ✅ Branch Ops - Production RM Inward page (Phase 2A complete)
- ✅ Branch Ops - Production Reports (Phase 2B complete)

### Files Updated (April 5, 2026)
- `/app/frontend/src/pages/TechOps.js` - Added RM Categories and RM BOM tabs
- `/app/frontend/src/pages/RMRepository.js` - Added source_type and bom_level filters/columns
- `/app/frontend/src/pages/RMProduction.js` - NEW: Production Inward page with 3 tabs
- `/app/frontend/src/App.js` - Added RMProduction route
- `/app/frontend/src/components/Layout.js` - Added RM Production nav item
- `/app/backend/routes/rm_routes.py` - Added source_type and bom_level params to /raw-materials/by-tags

### Documentation
See `/app/memory/func/IN_HOUSE_PRODUCTION.md` for full module documentation.

---

## BUG FIXES LOG

### April 6, 2026 - Excel Template Branch ID Fix
**Issue:** Production Plan and Model Capacity template downloads were generating Branch Names (e.g., "Unit 2", "Goa") instead of proper Branch IDs (BR_001, BR_002).

**Root Cause:** In production, the `branches` collection doesn't have `branch_id` field populated, causing `None` values in the Excel output.

**Fix Applied:**
1. Updated all 3 template endpoints to generate `branch_id` dynamically if missing (BR_001, BR_002, etc.)
2. Added a new migration endpoint `POST /api/branches/migrate-ids` to persist branch_ids in production
3. Updated Model Capacity upload endpoint to accept both `branch_id` and `branch_name`

**Files Modified:**
- `/app/backend/routes/cpc_routes.py` - Template generation logic
- `/app/backend/routes/tech_ops_routes.py` - Added migration endpoint

**Verified Templates (All using Branch IDs):**
- `/api/cpc/production-plan/template` ✅ (FIXED)
- `/api/branches/daily-capacity/template` ✅ (FIXED)
- `/api/branches/model-capacity/template` ✅ (FIXED)

### April 6, 2026 - BOM Upload Error Handling Enhancement
**Issue:** BOM bulk upload was showing generic "Failed to upload" without details.

**Fix Applied:**
1. Enhanced BOM upload to pre-validate all Buyer SKUs and RM IDs before processing
2. Returns specific list of missing items (e.g., "Missing RM IDs: LB_00564")
3. Added `success: true/false` field to clearly indicate upload status
4. Frontend now shows appropriate toast messages based on success/warning/error

**Files Modified:**
- `/app/backend/routes/sku_management_routes.py` - BOM upload validation
- `/app/frontend/src/pages/SKUManagement.js` - Error display logic

---

## PRODUCTION DEPLOYMENT INSTRUCTIONS

### For Branch ID Migration (Run Once in Production)
After deploying, call the migration endpoint to populate branch_id for all branches:
```bash
curl -X POST https://your-production-url/api/branches/migrate-ids
```

This will assign BR_001, BR_002, etc. to branches that don't have a branch_id.

---

## NEW FEATURE: Inventory Management Page (April 6, 2026)

### Overview
A dedicated page to view and bulk import existing RM and Finished Goods inventory data.

### Access
- URL: `/inventory`
- Sidebar: "Inventory" (accessible to Admin, Branch Ops, Procurement, Finance)

### Features
1. **Two Tabs**: Raw Materials | Finished Goods
2. **View Current Inventory**: Table with filters for branch, category/model, search
3. **Bulk Import**: Upload Excel files to import inventory data
4. **Import Modes**:
   - **Add to Existing**: Quantities added to current stock
   - **Replace Stock**: Uploaded quantities replace current stock

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory/rm` | GET | Get RM inventory with filters |
| `/api/inventory/fg` | GET | Get FG inventory with filters |
| `/api/inventory/rm/bulk-import?mode=add|replace` | POST | Bulk import RM inventory |
| `/api/inventory/fg/bulk-import?mode=add|replace` | POST | Bulk import FG inventory |
| `/api/inventory/rm/template` | GET | Download RM import template |
| `/api/inventory/fg/template` | GET | Download FG import template |
| `/api/inventory/summary` | GET | Get inventory summary stats |
| `/api/inventory/filters` | GET | Get filter options |

### Excel Template Format

**RM Inventory Template:**
| RM_ID | BRANCH_ID | QUANTITY | UNIT |
|-------|-----------|----------|------|
| LB_001 | BR_001 | 500 | KG |

**FG Inventory Template:**
| BUYER_SKU_ID | BRANCH_ID | QUANTITY |
|--------------|-----------|----------|
| AD_KS_BE_010 | BR_001 | 100 |

### Files Created
- `/app/backend/routes/inventory_routes.py` - Backend API endpoints
- `/app/frontend/src/pages/Inventory.js` - Frontend page

### Database Collections
- `rm_inventory`: Stores RM stock by branch
- `fg_inventory`: Stores Finished Goods stock by branch

---

## RM Categories Dynamic Configuration (April 6, 2026)

### Overview
Synced frontend RM category configurations with the database. Categories are now fetched from the API instead of being hardcoded.

### Changes Made

**Frontend Files Updated:**
- `/app/frontend/src/pages/RMRepository.js` - Now fetches categories from `/api/rm-categories`
- `/app/frontend/src/pages/DemandHub.js` - Now fetches categories from `/api/rm-categories`

**How It Works:**
1. Frontend loads, fetches RM categories from `/api/rm-categories` endpoint
2. API returns categories with `fields` (string[]) and `nameFormat` (string[])
3. Frontend enriches the data with labels, placeholders, and required flags
4. Falls back to `DEFAULT_RM_CATEGORIES` if API fails

**Benefits:**
- Single source of truth (database)
- Categories can be updated in TechOps without code changes
- Name generation uses `nameFormat` from database
- Backward compatible with fallback defaults

### Database Collection
`rm_categories` stores:
```json
{
  "code": "INP",
  "name": "In-house Plastic",
  "description_columns": [
    {"key": "mould_code", "label": "Mould Code", "include_in_name": true},
    {"key": "model_name", "label": "Model Name", "include_in_name": true},
    ...
  ],
  "default_uom": "PCS",
  "rm_id_prefix": "INP"
}
```



