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
- Consolidate IBT routes into logistics_routes.py

### P2 - Medium Priority
- Auto-generate dispatch lots from forecasts
- Lot status workflow automation
- Production vs Forecast tracking dashboard

### P3 - Future
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

*Last updated: March 15, 2026*
*CPC Module Complete - SKU Subscription restored and moved under CPC menu*
