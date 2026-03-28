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
- Consolidate IBT routes into logistics_routes.py

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

---

## 11. CPC MODULE STATUS (COMPLETE - March 15, 2026)

### What's Working:
1. **Production Planning Tab** - Shows confirmed forecasts from Demand team
2. **Branch Capacity Tab** - Day-wise capacity upload with branch cards
3. **Production Schedule Tab** - Branch-wise per-day schedule view

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

---

*Weekly MRP Phase 1 Completed: March 28, 2026*
*Weekly MRP Phase 2 (Quick Filter + Open PO) Completed: March 28, 2026*
*Test Reports: /app/test_reports/iteration_16.json, /app/test_reports/iteration_17.json (100% pass rate)*

