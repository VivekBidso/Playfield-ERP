# Factory OPS - System Documentation

## 1. DATA FLOW & SEQUENCE DIAGRAMS

### 1.1 Master Data Setup Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MASTER DATA SETUP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Vertical │───▶│  Model   │───▶│  Brand   │───▶│  Buyer   │              │
│  │ (10)     │    │ (47)     │    │ (28)     │    │ (2)      │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                                │                     │
│       ▼                                                ▼                     │
│  ┌──────────┐                                    ┌──────────┐              │
│  │   SKU    │◀───────────────────────────────────│ Forecast │              │
│  │ (710)    │                                    │ (Demand) │              │
│  └──────────┘                                    └──────────┘              │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────┐    ┌──────────┐                                              │
│  │   BOM    │───▶│    RM    │◀──────────────────┐                         │
│  │ (20159)  │    │ (2418)   │                   │                         │
│  └──────────┘    └──────────┘                   │                         │
│                       │                          │                         │
│                       ▼                          │                         │
│                  ┌──────────┐              ┌──────────┐                    │
│                  │  Vendor  │─────────────▶│ RM Price │                    │
│                  │ (504)    │              │ (296)    │                    │
│                  └──────────┘              └──────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Production Flow Sequence
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: DEMAND PLANNING                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │ Forecast │───▶│ Dispatch │───▶│   CPC    │                              │
│  │          │    │   Lot    │    │ Schedule │                              │
│  └──────────┘    └──────────┘    └──────────┘                              │
│                                        │                                     │
│  STEP 2: CAPACITY ALLOCATION           ▼                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │  Branch  │───▶│ Capacity │───▶│ Branch   │                              │
│  │ (7 units)│    │ per Day  │    │Allocation│                              │
│  └──────────┘    └──────────┘    └──────────┘                              │
│                                        │                                     │
│  STEP 3: PRODUCTION EXECUTION          ▼                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │Production│───▶│  L1/L2   │───▶│   FG     │                              │
│  │  Batch   │    │ Engine   │    │Inventory │                              │
│  └──────────┘    └──────────┘    └──────────┘                              │
│       │                                │                                     │
│       │         ┌──────────┐           │                                     │
│       └────────▶│RM Stock  │◀──────────┘                                    │
│                 │Movement  │ (Deduction)                                     │
│                 └──────────┘                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 L1/L2 Material Consumption Engine
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    L1/L2 CONSUMPTION ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FOR INP (In-house Plastic):                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ L2 Part  │───▶│ Moulding │───▶│ L1 Resin │───▶│ Deduct   │              │
│  │ Required │    │ Process  │    │ + MB %   │    │ L1 Stock │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                                              │
│  Formula: L1_consumption = L2_qty × unit_weight × (1 + scrap_factor)        │
│                                                                              │
│  FOR INM (In-house Metal):                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ L2 Part  │───▶│Fabricate │───▶│ L1 Metal │───▶│ Deduct   │              │
│  │ Required │    │ Process  │    │ + Coating│    │ L1 Stock │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                       │                                                      │
│                       ▼                                                      │
│               ┌──────────────┐                                               │
│               │Powder Coating│ (Optional - INM_PC_001 to INM_PC_006)        │
│               │  Consumption │                                               │
│               └──────────────┘                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Quality Control Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       QUALITY CONTROL FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │Production│───▶│    QC    │───▶│QC Result │───▶│    QC    │              │
│  │  Batch   │    │Checklist │    │(Pass/Fail│    │ Approval │              │
│  │ COMPLETED│    │ (2 lists)│    │  counts) │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                        │                                     │
│                                        ▼                                     │
│                  ┌─────────────────────┴─────────────────────┐              │
│                  │                                           │              │
│            ┌──────────┐                               ┌──────────┐          │
│            │ QC_PASSED│                               │QC_FAILED │          │
│            │  Event   │                               │  Event   │          │
│            └──────────┘                               └──────────┘          │
│                  │                                           │              │
│                  ▼                                           ▼              │
│            ┌──────────┐                               ┌──────────┐          │
│            │ Dispatch │                               │  Alert   │          │
│            │   Ready  │                               │ Created  │          │
│            └──────────┘                               └──────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.5 Procurement Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROCUREMENT FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Vendor  │───▶│ RM Price │───▶│ Purchase │───▶│ PO Lines │              │
│  │  Master  │    │ Contract │    │  Order   │    │ (Items)  │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                        │                                     │
│                                        ▼                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  DRAFT   │───▶│   SENT   │───▶│ PARTIAL  │───▶│ RECEIVED │              │
│  │          │    │          │    │          │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌──────────────┐                               │
│                               │RM Stock Added│                               │
│                               │  to Branch   │                               │
│                               └──────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.6 Logistics & Dispatch Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LOGISTICS & DISPATCH FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Dispatch │───▶│ Dispatch │───▶│ PENDING  │───▶│ SHIPPED  │              │
│  │   Lot    │    │  Record  │    │          │    │(Tracking)│              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                         │                    │
│                                                         ▼                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Invoice  │◀───│DELIVERED │◀───│IN_TRANSIT│◀───│          │              │
│  │ Created  │    │          │    │          │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                              │
│  │  DRAFT   │───▶│   SENT   │───▶│   PAID   │                              │
│  │          │    │          │    │          │                              │
│  └──────────┘    └──────────┘    └──────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.7 Inter-Branch Transfer (IBT) Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IBT TRANSFER FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ PENDING  │───▶│ APPROVED │───▶│IN_TRANSIT│───▶│COMPLETED │              │
│  │(Request) │    │(by Admin)│    │ (Shipped)│    │(Received)│              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                        │               │                     │
│                                        ▼               ▼                     │
│                               ┌──────────────┐ ┌──────────────┐             │
│                               │RM Deducted   │ │RM Added to   │             │
│                               │from Source   │ │ Destination  │             │
│                               └──────────────┘ └──────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.8 Event System Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENT SYSTEM FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐         ┌──────────────┐         ┌──────────┐                 │
│  │  Action  │────────▶│  Event Bus   │────────▶│ Handlers │                 │
│  │ (CRUD)   │         │  (Publish)   │         │(Process) │                 │
│  └──────────┘         └──────────────┘         └──────────┘                 │
│                              │                       │                       │
│                              ▼                       ▼                       │
│                       ┌──────────────┐        ┌──────────┐                  │
│                       │ Events Table │        │  Alerts  │                  │
│                       │   (Log)      │        │(if needed│                  │
│                       └──────────────┘        └──────────┘                  │
│                                                                              │
│  35 Event Types → 11 Active Handlers                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CRUD MAPPING BY MODULE

### 2.1 Tech Ops Module
| Entity    | Create | Read | Update | Delete | API Endpoint |
|-----------|--------|------|--------|--------|--------------|
| Vertical  | ✅ | ✅ | ✅ | ✅ | `/api/verticals` |
| Model     | ✅ | ✅ | ✅ | ✅ | `/api/models` |
| Brand     | ✅ | ✅ | ✅ | ✅ | `/api/brands` |
| Buyer     | ✅ | ✅ | ✅ | ✅ | `/api/buyers` |
| Branch    | ❌ | ✅ | ✅ | ❌ | `/api/branches` |

### 2.2 Raw Materials Module
| Entity          | Create | Read | Update | Delete | API Endpoint |
|-----------------|--------|------|--------|--------|--------------|
| Raw Material    | ✅ | ✅ | ❌ | ✅ | `/api/raw-materials` |
| RM Categories   | ❌ | ✅ | ❌ | ❌ | `/api/rm-categories` |
| Branch RM Stock | ❌ | ✅ | ✅ | ❌ | `/api/branch-rm-inventory` |
| RM Activation   | ✅ | ❌ | ❌ | ❌ | `/api/raw-materials/activate` |
| Bulk Upload     | ✅ | ❌ | ❌ | ❌ | `/api/raw-materials/bulk-upload` |

### 2.3 SKU Module
| Entity          | Create | Read | Update | Delete | API Endpoint |
|-----------------|--------|------|--------|--------|--------------|
| SKU             | ✅ | ✅ | ✅ | ✅ | `/api/skus` |
| SKU Mapping     | ✅ | ✅ | ✅ | ❌ | `/api/sku-mappings` |
| SKU Activation  | ✅ | ❌ | ❌ | ❌ | `/api/skus/activate` |
| Bill of Materials | ✅ | ✅ | ✅ | ❌ | `/api/bill-of-materials` |

### 2.4 Vendor Module
| Entity          | Create | Read | Update | Delete | API Endpoint |
|-----------------|--------|------|--------|--------|--------------|
| Vendor          | ✅ | ✅ | ✅ | ✅ | `/api/vendors` |
| Vendor RM Price | ✅ | ✅ | ❌ | ✅ | `/api/vendor-rm-prices` |
| Purchase Entry  | ✅ | ✅ | ❌ | ❌ | `/api/purchase-entries` |

### 2.5 Demand Module
| Entity        | Create | Read | Update | Delete | API Endpoint |
|---------------|--------|------|--------|--------|--------------|
| Forecast      | ✅ | ✅ | ✅ | ✅ | `/api/forecasts` |
| Dispatch Lot  | ✅ | ✅ | ✅ | ✅ | `/api/dispatch-lots` |

### 2.6 CPC Module (Central Production Control)
| Entity              | Create | Read | Update | Delete | API Endpoint |
|---------------------|--------|------|--------|--------|--------------|
| Production Schedule | ✅ | ✅ | ✅ | ❌ | `/api/production-schedules` |
| Branch Allocation   | ✅ | ✅ | ✅ | ❌ | `/api/branch-allocations` |
| Branch Capacity     | ❌ | ✅ | ✅ | ❌ | `/api/branches/{name}/capacity` |
| Capacity Forecast   | ❌ | ✅ | ❌ | ❌ | `/api/branches/{name}/capacity-forecast` |
| CPC Dashboard       | ❌ | ✅ | ❌ | ❌ | `/api/cpc/dashboard` |
| Auto-Allocate       | ✅ | ❌ | ❌ | ❌ | `/api/branch-allocations/auto-allocate` |

### 2.7 Production Module
| Entity            | Create | Read | Update | Delete | API Endpoint |
|-------------------|--------|------|--------|--------|--------------|
| Production Entry  | ✅ | ✅ | ❌ | ❌ | `/api/production-entries` |
| Production Batch  | ✅ | ✅ | ✅ | ❌ | `/api/production-batches` |
| Production Plan   | ✅ | ✅ | ❌ | ❌ | `/api/production-plans` |
| L2 Production     | ✅ | ❌ | ❌ | ❌ | `/api/production-batches/{id}/produce-l2` |

### 2.8 Quality Module
| Entity        | Create | Read | Update | Delete | API Endpoint |
|---------------|--------|------|--------|--------|--------------|
| QC Checklist  | ✅ | ✅ | ✅ | ✅ | `/api/qc-checklists` |
| QC Result     | ✅ | ✅ | ✅ | ❌ | `/api/qc-results` |
| QC Approval   | ✅ | ✅ | ❌ | ❌ | `/api/qc-approvals` |

### 2.9 Procurement Module
| Entity            | Create | Read | Update | Delete | API Endpoint |
|-------------------|--------|------|--------|--------|--------------|
| Purchase Order    | ✅ | ✅ | ✅ | ❌ | `/api/purchase-orders` |
| PO Line Items     | ✅ | ✅ | ❌ | ❌ | `/api/purchase-orders/{id}/lines` |
| Send PO           | ❌ | ❌ | ✅ | ❌ | `/api/purchase-orders/{id}/send` |
| Receive PO        | ❌ | ❌ | ✅ | ❌ | `/api/purchase-orders/{id}/receive` |

### 2.10 Logistics Module
| Entity      | Create | Read | Update | Delete | API Endpoint |
|-------------|--------|------|--------|--------|--------------|
| Dispatch    | ✅ | ✅ | ✅ | ❌ | `/api/dispatches` |
| Ship        | ❌ | ❌ | ✅ | ❌ | `/api/dispatches/{id}/ship` |
| Deliver     | ❌ | ❌ | ✅ | ❌ | `/api/dispatches/{id}/deliver` |
| Invoice     | ✅ | ✅ | ✅ | ❌ | `/api/invoices` |
| Send Invoice| ❌ | ❌ | ✅ | ❌ | `/api/invoices/{id}/send` |
| Pay Invoice | ❌ | ❌ | ✅ | ❌ | `/api/invoices/{id}/pay` |

### 2.11 IBT Module
| Entity       | Create | Read | Update | Delete | API Endpoint |
|--------------|--------|------|--------|--------|--------------|
| IBT Transfer | ✅ | ✅ | ✅ | ❌ | `/api/ibt-transfers` |
| Approve      | ❌ | ❌ | ✅ | ❌ | `/api/ibt-transfers/{id}/approve` |
| Ship         | ❌ | ❌ | ✅ | ❌ | `/api/ibt-transfers/{id}/ship` |
| Receive      | ❌ | ❌ | ✅ | ❌ | `/api/ibt-transfers/{id}/receive` |

### 2.12 Reports Module
| Entity           | Create | Read | Update | Delete | API Endpoint |
|------------------|--------|------|--------|--------|--------------|
| FG Inventory     | ❌ | ✅ | ❌ | ❌ | `/api/fg-inventory` |
| FG Summary       | ❌ | ✅ | ❌ | ❌ | `/api/fg-inventory/summary` |
| RM Movements     | ❌ | ✅ | ❌ | ❌ | `/api/rm-stock-movements` |
| Price History    | ❌ | ✅ | ❌ | ❌ | `/api/price-history` |
| Audit Logs       | ❌ | ✅ | ❌ | ❌ | `/api/audit-logs` |

### 2.13 Event System Module
| Entity        | Create | Read | Update | Delete | API Endpoint |
|---------------|--------|------|--------|--------|--------------|
| Events        | ✅ | ✅ | ❌ | ❌ | `/api/events` |
| Event Types   | ❌ | ✅ | ❌ | ❌ | `/api/events/types` |
| Event Stats   | ❌ | ✅ | ❌ | ❌ | `/api/events/stats` |
| Alerts        | ❌ | ✅ | ✅ | ❌ | `/api/events/alerts` |
| Subscriptions | ❌ | ✅ | ❌ | ❌ | `/api/events/subscriptions` |
| Publish Event | ✅ | ❌ | ❌ | ❌ | `/api/events/publish` |

### 2.14 User Management Module
| Entity    | Create | Read | Update | Delete | API Endpoint |
|-----------|--------|------|--------|--------|--------------|
| User      | ✅ | ✅ | ✅ | ✅ | `/api/users` |
| Login     | ✅ | ❌ | ❌ | ❌ | `/api/auth/login` |
| Me        | ❌ | ✅ | ❌ | ❌ | `/api/auth/me` |
| Password  | ❌ | ❌ | ✅ | ❌ | `/api/auth/change-password` |
| Toggle    | ❌ | ❌ | ✅ | ❌ | `/api/users/{id}/toggle-active` |

---

## 3. USER ROLE MATRIX

### 3.1 Role Definitions
| Role | Description | Branch Access | System Access |
|------|-------------|---------------|---------------|
| **MASTER_ADMIN** | Full system access | All 7 branches | Full admin |
| **BRANCH_USER** | Limited to assigned branches | Assigned only | Limited |

### 3.2 Permission Matrix by Module

#### Authentication & User Management
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| Login | ✅ | ✅ |
| View Own Profile | ✅ | ✅ |
| Change Own Password | ✅ | ✅ |
| List All Users | ✅ | ❌ |
| Create User | ✅ | ❌ |
| Update User | ✅ | ❌ |
| Delete User | ✅ | ❌ |
| Toggle User Status | ✅ | ❌ |

#### Tech Ops (Master Data)
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Verticals | ✅ | ✅ |
| Create/Edit/Delete Vertical | ✅ | ❌ |
| View Models | ✅ | ✅ |
| Create/Edit/Delete Model | ✅ | ❌ |
| View Brands | ✅ | ✅ |
| Create/Edit/Delete Brand | ✅ | ❌ |
| View Buyers | ✅ | ✅ |
| Create/Edit/Delete Buyer | ✅ | ❌ |

#### Raw Materials
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View All RMs | ✅ | ✅ |
| Create RM | ✅ | ✅ |
| Delete RM | ✅ | ❌ |
| Bulk Upload RMs | ✅ | ❌ |
| Activate RM in Branch | ✅ | ✅ (own branch) |
| View Branch RM Stock | ✅ | ✅ (own branch) |

#### SKU Management
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View All SKUs | ✅ | ✅ |
| Create/Edit SKU | ✅ | ✅ |
| Delete SKU | ✅ | ❌ |
| Create/Edit SKU Mapping | ✅ | ✅ |
| Activate SKU in Branch | ✅ | ✅ (own branch) |

#### Vendors & Procurement
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Vendors | ✅ | ✅ |
| Create/Edit Vendor | ✅ | ✅ |
| Delete Vendor | ✅ | ❌ |
| View Vendor Prices | ✅ | ✅ |
| Create Vendor Price | ✅ | ✅ |
| Create Purchase Order | ✅ | ✅ (own branch) |
| Send/Receive PO | ✅ | ✅ (own branch) |

#### Demand Planning
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Forecasts | ✅ | ✅ |
| Create/Edit Forecast | ✅ | ✅ |
| View Dispatch Lots | ✅ | ✅ |
| Create/Edit Dispatch Lot | ✅ | ✅ |

#### CPC (Central Production Control)
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View CPC Dashboard | ✅ | ✅ |
| View Production Schedules | ✅ | ✅ |
| Create Production Schedule | ✅ | ✅ |
| Auto-Allocate Production | ✅ | ❌ |
| View Branch Capacity | ✅ | ✅ (own branch) |
| Update Branch Capacity | ✅ | ❌ |
| Start Branch Allocation | ✅ | ✅ (own branch) |

#### Production
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Production Entries | ✅ | ✅ (own branch) |
| Create Production Entry | ✅ | ✅ (own branch) |
| View Production Batches | ✅ | ✅ (own branch) |
| Create/Complete Batch | ✅ | ✅ (own branch) |

#### Quality Control
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View QC Checklists | ✅ | ✅ |
| Create/Edit QC Checklist | ✅ | ✅ |
| View QC Results | ✅ | ✅ (own branch) |
| Create QC Result | ✅ | ✅ (own branch) |
| Approve QC | ✅ | ✅ (own branch) |

#### Logistics
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Dispatches | ✅ | ✅ (own branch) |
| Create Dispatch | ✅ | ✅ (own branch) |
| Ship/Deliver Dispatch | ✅ | ✅ (own branch) |
| View Invoices | ✅ | ✅ |
| Create/Send/Pay Invoice | ✅ | ✅ |

#### IBT (Inter-Branch Transfers)
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View IBT Transfers | ✅ | ✅ (involved branches) |
| Create IBT Request | ✅ | ✅ (from own branch) |
| Approve IBT | ✅ | ❌ |
| Ship IBT | ✅ | ✅ (source branch) |
| Receive IBT | ✅ | ✅ (dest branch) |

#### Reports & Analytics
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View FG Inventory | ✅ | ✅ (own branch) |
| View RM Movements | ✅ | ✅ (own branch) |
| View Audit Logs | ✅ | ❌ |
| View Price History | ✅ | ✅ |

#### Event System
| Action | MASTER_ADMIN | BRANCH_USER |
|--------|:------------:|:-----------:|
| View Events | ✅ | ✅ |
| View Alerts | ✅ | ✅ |
| Mark Alert Read | ✅ | ✅ |
| Publish Manual Event | ✅ | ❌ |
| View Subscriptions | ✅ | ✅ |

---

## 4. BRANCH ACCESS SUMMARY

### 4.1 Branches (7 Units)
| Branch Code | Branch Name |
|-------------|-------------|
| UNIT_1_VEDICA | Unit 1 Vedica |
| UNIT_2_TRIKES | Unit 2 Trikes |
| UNIT_3_TM | Unit 3 TM |
| UNIT_4_GOA | Unit 4 Goa |
| UNIT_5_BAABUS | Unit 5 Baabus |
| UNIT_6_EMOX | Unit 6 Emox |
| BHDG_WH | BHDG WH |

### 4.2 Branch User Access Control
```
MASTER_ADMIN:
├── Can access ALL branches
├── Can create/manage users
├── Can update branch capacities
├── Can approve IBT transfers
└── Can publish manual events

BRANCH_USER (e.g., assigned to "Unit 1 Vedica"):
├── Can ONLY view/edit data for "Unit 1 Vedica"
├── Cannot access other branch data
├── Cannot create users
├── Cannot approve IBT (only request/ship/receive)
└── Cannot update branch capacities
```

---

## 5. DATABASE STATISTICS

| Collection | Documents | Purpose |
|------------|-----------|---------|
| skus | 710 | Product definitions |
| raw_materials | 2,418 | Material master |
| bill_of_materials | 20,159 | SKU-RM mappings |
| vendors | 504 | Supplier master |
| vendor_rm_prices | 296 | Price contracts |
| branches | 7 | Production units |
| users | 3 | System users |
| verticals | 10 | Product categories |
| models | 47 | Product models |
| brands | 28 | Brand master |
| events | 2 | Event log |
| alerts | 1 | System alerts |

---

## 6. TEST CREDENTIALS

| Role | Email | Password | Branches |
|------|-------|----------|----------|
| Master Admin | admin@factory.com | admin123 | All |
| Branch User | vedica_user@factory.com | vedica123 | Unit 1 Vedica |

---

*Document Generated: March 14, 2026*
