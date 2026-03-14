# Integrated Manufacturing & Operations Suite
## Architecture & Data Model Specification Document

**Version:** 2.0  
**Status:** Approved  
**Last Updated:** December 2025

---

# Section 1: Executive Summary & System Overview

## 1.1 Purpose
This system provides a unified platform for managing the end-to-end lifecycle of a product—from demand forecasting and Bill of Materials (BOM) creation to production, quality control, and logistics.

## 1.2 System Modules

| Module | Primary Responsibility |
|--------|------------------------|
| **Master Admin** | System configuration, global approvals, and user management |
| **Demand** | Forecasting, Buyer SKU initialization, and Dispatch Lot creation |
| **Tech Ops** | Raw Material (RM) and BOM management, Technical Specs |
| **CPC** | Central Production Control; scheduling and branch allocation |
| **Procurement** | Vendor management and Purchase Order (PO) execution |
| **Branch Ops** | Floor-level production marking and RM inwarding |
| **Quality** | Checklist management and Finished Goods (FG) validation |
| **Logistics & WH** | Dispatching, Invoicing, and Inter-branch transfers |

---

# Section 2: Cross-Module Data Flow Specification

## 2.1 Data Flow Matrix: Module → Entity Access

| Module | **READ** Access | **WRITE** Access | **Triggers/Notifications** |
|--------|----------------|------------------|---------------------------|
| **Demand** | SKU, Forecast, FGInventory, DispatchLot | Forecast, DispatchLot, BuyerSKU (Draft) | → Tech Ops (BOM Required) |
| **Tech Ops** | Forecast, RM, SKU, Vendor | RM (L1/L2), BOM, Brand, Vertical, Model | → Procurement (New RM Created) |
| **CPC** | Forecast, BOM, FGInventory, BranchCapacity | ProductionPlan, BranchAllocation | → Branch Ops (Plan Assigned) |
| **Procurement** | RM, ProductionPlan, PriceHistory | Vendor, VendorRMPrice, PurchaseOrder | → Branch Ops (PO Approved) |
| **Branch Ops** | ProductionPlan, RM, BOM | ProductionBatch, RMStockMovement, RMInward | → Quality (Batch Complete) |
| **Quality** | ProductionBatch, QCChecklist | QCResult, FGInventory | → Logistics (QC Passed) |
| **Logistics** | FGInventory, DispatchLot | Dispatch, Invoice, IBTTransfer | → Demand (Dispatch Complete) |
| **Master Admin** | ALL | ALL + SystemConfig, UserRoles | Global Override Authority |

---

## 2.2 Entity Lifecycle & Status Flows

### Buyer SKU Lifecycle
```
DRAFT → BOM_PENDING → BOM_COMPLETE → ACTIVE → DISCONTINUED
         ↑                    ↑
    (Created by         (BOM Finalized
     Demand)            by Tech Ops)
```

### Production Batch Lifecycle
```
PLANNED → IN_PROGRESS → COMPLETED → QC_HOLD → QC_PASSED → FG_READY
                                        ↓
                                   QC_FAILED → REWORK/SCRAP
```

### Dispatch Lot Lifecycle
```
CREATED → PRODUCTION_ASSIGNED → PARTIALLY_PRODUCED → FULLY_PRODUCED → 
QC_CLEARED → DISPATCH_READY → DISPATCHED → DELIVERED
```

### Inter-Branch Transfer (IBT) Lifecycle
```
INITIATED → APPROVED → IN_TRANSIT → RECEIVED → COMPLETED
     ↓           ↓
  REJECTED   CANCELLED
```

---

# Section 3: L1/L2 RM Engine Specification

## 3.1 Definitions
- **L1 (Level 1)**: Bulk raw material or base component
- **L2 (Level 2)**: Fabricated component derived from L1

## 3.2 Categories Supporting L1/L2

| Category Code | Name | L1/L2 Applicable | L1 Consumption Model |
|--------------|------|------------------|----------------------|
| **INP** | In-House Plastic | ✅ Yes | **Single L1**: Polymer Grade (KG) |
| **INM** | In-House Metal | ✅ Yes | **Dual L1**: Base Metal (PCS) + Powder Coating (KG) |
| ACC | Accessories | ❌ No | Direct Pcs |
| ELC | Electrical | ❌ No | Direct Pcs |
| PM | Packaging | ❌ No | Direct Pcs |
| BS | Brand Assets | ❌ No | Direct Pcs |
| LB | Labels | ❌ No | Direct Pcs |
| SP | Spares | ❌ No | Direct Pcs |

---

## 3.3 INP (In-House Plastic) Consumption Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INP L2 PRODUCTION                                 │
│                 (Fabricated Plastic Part)                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Consumes
                              ▼
                    ┌───────────────────┐
                    │   POLYMER L1      │
                    │                   │
                    │ • Measured in KG  │
                    │ • Weight-based    │
                    │   consumption     │
                    └───────────────────┘
```

### INP Consumption Formula
```
L1_Consumption = (L2_Qty × L2_Unit_Weight_KG) × (1 + Scrap_Factor)

L2_Unit_Cost = (L2_Unit_Weight × L1_Price_Per_KG) × (1 + Scrap_Factor) + Processing_Cost
```

---

## 3.4 INM (In-House Metal) Dual-Consumption Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INM L2 PRODUCTION                                 │
│                  (Fabricated Metal Part)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Consumes
                              ▼
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────┐
│   BASE METAL L1   │                   │  POWDER COATING   │
│                   │                   │       L1          │
│ • 1:1 Ratio       │                   │                   │
│ • 1 L2 = 1 L1 unit│                   │ • Predefined grams│
│ • Tracked in PCS  │                   │ • Measured in KG  │
│                   │                   │ • 10% scrap factor│
└───────────────────┘                   └───────────────────┘
```

### INM Consumption Formula
```
1. Base Metal Consumption:
   Metal_L1_Consumption = L2_Qty
   (1:1 ratio - each L2 piece consumes 1 L1 unit)

2. Powder Coating Consumption:
   Coating_Consumption_KG = (L2_Qty × Predefined_Powder_Qty_Grams / 1000) × (1 + Coating_Scrap_Factor)

3. Total L2 Cost:
   L2_Unit_Cost = L1_Unit_Cost
                + (Powder_Qty_Grams / 1000 × Coating_Price_Per_KG × (1 + Coating_Scrap_Factor))
                + Processing_Cost
```

### INM Example Calculation

**Scenario:** Produce 100 units of INM_FRAME_001 (L2)

**Setup:**
- `parent_rm_id`: INM_MS_001 (Mild Steel Frame - L1 @ ₹150/unit)
- `secondary_l1_rm_id`: INM_PC_001 (Black Powder Coating @ ₹200/KG)
- `powder_qty_grams`: 25g per unit
- `coating_scrap_factor`: 0.10 (10%)
- `processing_cost`: ₹20/unit

**Calculation:**
```
1. Base Metal: 100 units consumed (1:1)
   Cost = 100 × ₹150 = ₹15,000

2. Powder Coating: (100 × 25g / 1000) × 1.10 = 2.75 KG
   Cost = 2.75 × ₹200 = ₹550

3. L2 Unit Cost:
   = ₹150 (L1) + (0.025 × ₹200 × 1.10) (Coating) + ₹20 (Processing)
   = ₹150 + ₹5.50 + ₹20
   = ₹175.50 per unit

4. Total Batch Cost: 100 × ₹175.50 = ₹17,550
```

---

## 3.5 INP vs INM Comparison Summary

| Aspect | INP (Plastic) | INM (Metal) |
|--------|--------------|-------------|
| **L1 Sources** | Single (Polymer in KG) | **Dual** (Base Metal in PCS + Powder Coating in KG) |
| **Base Material Consumption** | Weight-based (KG per unit) | **1:1 ratio** (1 L2 = 1 L1 unit) |
| **Secondary Material** | None | Powder Coating (predefined grams per unit) |
| **Scrap Factor** | On polymer (~2%) | On coating only (~10%) |
| **Key Fields** | `parent_rm_id`, `unit_weight_grams`, `scrap_factor` | `parent_rm_id`, `secondary_l1_rm_id`, `powder_qty_grams`, `coating_scrap_factor` |
| **L2 Unit Cost** | `(Weight × L1_Price) × (1 + Scrap) + Processing` | `L1_Unit_Cost + (Powder_Grams/1000 × Coating_Price × (1+Scrap)) + Processing` |

---

# Section 4: Quality Checklist Inheritance Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    EFFECTIVE CHECKLIST                           │
│    = Vertical Checks ∪ Model Checks ∪ Brand Checks              │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   VERTICAL    │    │    MODEL      │    │    BRAND      │
│   CHECKLIST   │    │   CHECKLIST   │    │   CHECKLIST   │
│  (Base Rules) │    │(Model-Specific)│   │(Buyer-Specific)│
│               │    │               │    │               │
│ e.g., "No     │    │ e.g., "Fits   │    │ e.g., "Logo   │
│ scratches"    │    │ 12V battery"  │    │ Pantone 286C" │
└───────────────┘    └───────────────┘    └───────────────┘
```

**Query Logic for Effective Checklist:**
```sql
SELECT * FROM qc_checklists WHERE vertical_id = ? AND model_id IS NULL AND brand_id IS NULL
UNION ALL
SELECT * FROM qc_checklists WHERE model_id = ? AND brand_id IS NULL
UNION ALL
SELECT * FROM qc_checklists WHERE brand_id = ?
ORDER BY check_priority;
```

---

# Section 5: Logical Data Model

## 5.1 Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MASTER DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ Vertical│◄───│  Model  │◄───│  Brand  │    │  Buyer  │    │  Branch │   │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘   │
│       │              │              │              │              │         │
│       └──────────────┴──────────────┴──────────────┘              │         │
│                            │                                       │         │
│                    ┌───────▼───────┐                              │         │
│                    │   BuyerSKU    │◄─────────────────────────────┘         │
│                    └───────┬───────┘                                        │
│                            │                                                │
│  ┌─────────┐         ┌─────▼─────┐         ┌─────────┐                     │
│  │   RM    │◄────────│    BOM    │         │  Vendor │                     │
│  │ (L1/L2) │         └───────────┘         └────┬────┘                     │
│  └────┬────┘                                    │                          │
│       │              ┌──────────────────────────┘                          │
│       └──────────────┤                                                     │
│                ┌─────▼─────┐                                               │
│                │VendorRM   │                                               │
│                │  Price    │                                               │
│                └───────────┘                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRANSACTIONAL DATA LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐    ┌───────────────┐    ┌─────────────────┐                 │
│  │ Forecast  │───►│ DispatchLot   │───►│ ProductionPlan  │                 │
│  └───────────┘    └───────┬───────┘    └────────┬────────┘                 │
│                           │                     │                           │
│                           │              ┌──────▼──────┐                    │
│                           │              │ProductionBatch│                  │
│                           │              └──────┬──────┘                    │
│                           │                     │                           │
│                    ┌──────┴──────┐       ┌──────▼──────┐                    │
│                    │             │       │RMStockMovement│                  │
│                    │             │       └─────────────┘                    │
│                    │             │                                          │
│              ┌─────▼─────┐  ┌────▼────┐                                    │
│              │ QCResult  │  │FGInventory│                                  │
│              └───────────┘  └────┬────┘                                    │
│                                  │                                          │
│                    ┌─────────────┼─────────────┐                           │
│                    ▼             ▼             ▼                            │
│              ┌──────────┐ ┌───────────┐ ┌───────────┐                      │
│              │ Dispatch │ │  Invoice  │ │IBTTransfer│                      │
│              └──────────┘ └───────────┘ └───────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5.2 Detailed Entity Specifications

### MASTER DATA ENTITIES

---

#### 1. raw_materials (EXISTING - Extended)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | Internal UUID |
| rm_id | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable ID (e.g., INP_001) |
| category | VARCHAR(10) | NOT NULL | Category code (INP, ACC, etc.) |
| category_data | JSONB | | Category-specific attributes |
| low_stock_threshold | DECIMAL(10,2) | DEFAULT 10 | Safety stock level |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| **--- NEW FIELDS ---** |
| rm_level | ENUM('L1','L2','DIRECT') | DEFAULT 'DIRECT' | Material level classification |
| parent_rm_id | VARCHAR(50) | FK → raw_materials.rm_id | L1 parent for L2 items |
| unit_weight_grams | DECIMAL(10,4) | NULL | Weight per unit (for INP L2) |
| scrap_factor | DECIMAL(5,4) | DEFAULT 0.02 | Waste factor (2% default) |
| processing_cost | DECIMAL(10,2) | DEFAULT 0 | Per-unit processing cost |
| secondary_l1_rm_id | VARCHAR(50) | FK → raw_materials.rm_id | Powder coating RM (INM only) |
| powder_qty_grams | DECIMAL(10,4) | NULL | Predefined powder coating qty in grams (INM only) |
| coating_scrap_factor | DECIMAL(5,4) | DEFAULT 0.10 | Coating waste factor (INM only) |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, DISCONTINUED |
| updated_at | TIMESTAMP | | Last modification |

**Indexes:**
- `idx_rm_category` ON (category)
- `idx_rm_level` ON (rm_level)
- `idx_rm_parent` ON (parent_rm_id)
- `idx_rm_status` ON (status)

---

#### 2. skus (EXISTING - Extended)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | Internal UUID |
| sku_id | VARCHAR(100) | UNIQUE, NOT NULL | Human-readable SKU ID |
| buyer_sku_id | VARCHAR(100) | | Buyer's SKU reference |
| bidso_sku | VARCHAR(100) | | Internal BIDSO reference |
| description | TEXT | | SKU description |
| vertical | VARCHAR(50) | | Product vertical |
| model | VARCHAR(50) | | Product model |
| brand | VARCHAR(50) | | Brand name |
| low_stock_threshold | INT | DEFAULT 5 | Safety stock |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| **--- NEW FIELDS ---** |
| vertical_id | UUID | FK → verticals.id | Normalized vertical reference |
| model_id | UUID | FK → models.id | Normalized model reference |
| brand_id | UUID | FK → brands.id | Normalized brand reference |
| buyer_id | UUID | FK → buyers.id | Buyer reference |
| status | ENUM | DEFAULT 'DRAFT' | DRAFT, BOM_PENDING, BOM_COMPLETE, ACTIVE, DISCONTINUED |
| bom_finalized_at | TIMESTAMP | NULL | When BOM was locked |
| bom_finalized_by | UUID | FK → users.id | Who finalized BOM |
| base_price | DECIMAL(12,2) | NULL | Base manufacturing cost |
| updated_at | TIMESTAMP | | Last modification |

---

#### 3. vendors (EXISTING - Extended)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | Internal UUID |
| vendor_id | VARCHAR(50) | UNIQUE, NOT NULL | Human-readable ID (VND_001) |
| name | VARCHAR(200) | NOT NULL | Vendor name |
| gst_number | VARCHAR(20) | | GST registration |
| address | TEXT | | Address |
| contact_person | VARCHAR(100) | | POC name |
| email | VARCHAR(100) | | Email |
| phone | VARCHAR(20) | | Phone |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| **--- NEW FIELDS ---** |
| legal_name | VARCHAR(200) | NULL | GST-validated legal name |
| gst_validated | BOOLEAN | DEFAULT FALSE | GST validation status |
| payment_terms_days | INT | DEFAULT 30 | Payment terms |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, BLACKLISTED |
| rating | DECIMAL(3,2) | NULL | Vendor rating (1-5) |
| updated_at | TIMESTAMP | | Last modification |

---

#### 4. vendor_rm_prices (EXISTING - Extended)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | Internal UUID |
| vendor_id | VARCHAR(50) | FK → vendors.vendor_id | Vendor reference |
| rm_id | VARCHAR(50) | FK → raw_materials.rm_id | RM reference |
| price | DECIMAL(12,4) | NOT NULL | Current price |
| currency | VARCHAR(10) | DEFAULT 'INR' | Currency |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| **--- NEW FIELDS ---** |
| price_per_unit | VARCHAR(20) | DEFAULT 'EACH' | KG, GRAM, EACH, SET |
| min_order_qty | DECIMAL(10,2) | DEFAULT 1 | Minimum order quantity |
| lead_time_days | INT | DEFAULT 7 | Expected delivery time |
| is_preferred | BOOLEAN | DEFAULT FALSE | Preferred vendor flag |
| valid_from | DATE | DEFAULT CURRENT_DATE | Price validity start |
| valid_until | DATE | NULL | Price validity end |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, EXPIRED, SUPERSEDED |

---

#### 5. verticals (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(20) | UNIQUE, NOT NULL | e.g., "SCOOTER", "TRIKE" |
| name | VARCHAR(100) | NOT NULL | Display name |
| description | TEXT | | |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | UUID | FK → users.id | |

---

#### 6. models (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| vertical_id | UUID | FK → verticals.id, NOT NULL | Parent vertical |
| code | VARCHAR(30) | NOT NULL | e.g., "BLAZE", "THUNDER" |
| name | VARCHAR(100) | NOT NULL | Display name |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Composite Unique:** (vertical_id, code)

---

#### 7. brands (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(30) | UNIQUE, NOT NULL | e.g., "FEBER", "CHICCO" |
| name | VARCHAR(100) | NOT NULL | Display name |
| buyer_id | UUID | FK → buyers.id | Associated buyer |
| logo_url | VARCHAR(500) | | Brand logo |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 8. buyers (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(20) | UNIQUE, NOT NULL | e.g., "BUYER_001" |
| name | VARCHAR(200) | NOT NULL | Company name |
| country | VARCHAR(50) | | |
| contact_email | VARCHAR(100) | | |
| payment_terms_days | INT | DEFAULT 30 | |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 9. branches (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| code | VARCHAR(30) | UNIQUE, NOT NULL | e.g., "UNIT_1_VEDICA" |
| name | VARCHAR(100) | NOT NULL | Display name |
| location | VARCHAR(200) | | Physical address |
| branch_type | ENUM | NOT NULL | PRODUCTION, WAREHOUSE, HYBRID |
| capacity_units_per_day | INT | DEFAULT 0 | Production capacity |
| is_active | BOOLEAN | DEFAULT TRUE | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 10. bill_of_materials (NEW - Consolidated)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| sku_id | VARCHAR(100) | FK → skus.sku_id, NOT NULL | Parent SKU |
| rm_id | VARCHAR(50) | FK → raw_materials.rm_id, NOT NULL | Required RM |
| quantity_required | DECIMAL(12,4) | NOT NULL | Qty per unit SKU |
| unit_of_measure | VARCHAR(20) | DEFAULT 'PCS' | PCS, KG, GRAM, SET |
| is_critical | BOOLEAN | DEFAULT FALSE | Critical component flag |
| alternate_rm_id | VARCHAR(50) | FK → raw_materials.rm_id | Substitute RM |
| version | INT | DEFAULT 1 | BOM version |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, SUPERSEDED |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | UUID | FK → users.id | |

**Composite Unique:** (sku_id, rm_id, version)

---

### TRANSACTIONAL DATA ENTITIES

---

#### 11. forecasts (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| forecast_code | VARCHAR(50) | UNIQUE, NOT NULL | e.g., "FC_2025_Q1_001" |
| buyer_id | UUID | FK → buyers.id | |
| vertical_id | UUID | FK → verticals.id | |
| sku_id | VARCHAR(100) | FK → skus.sku_id | |
| forecast_month | DATE | NOT NULL | Month of forecast |
| quantity | INT | NOT NULL | Forecasted units |
| priority | ENUM | DEFAULT 'MEDIUM' | LOW, MEDIUM, HIGH, CRITICAL |
| status | ENUM | DEFAULT 'DRAFT' | DRAFT, CONFIRMED, CONVERTED |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | UUID | FK → users.id | |

---

#### 12. dispatch_lots (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| lot_code | VARCHAR(50) | UNIQUE, NOT NULL | e.g., "DL_2025_001" |
| forecast_id | UUID | FK → forecasts.id | Source forecast |
| sku_id | VARCHAR(100) | FK → skus.sku_id, NOT NULL | Target SKU |
| buyer_id | UUID | FK → buyers.id, NOT NULL | |
| required_quantity | INT | NOT NULL | Total required |
| produced_quantity | INT | DEFAULT 0 | Completed so far |
| qc_passed_quantity | INT | DEFAULT 0 | QC cleared |
| dispatched_quantity | INT | DEFAULT 0 | Shipped |
| target_date | DATE | NOT NULL | Required by date |
| status | ENUM | DEFAULT 'CREATED' | See lifecycle |
| priority | ENUM | DEFAULT 'MEDIUM' | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 13. production_batches (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| batch_code | VARCHAR(50) | UNIQUE, NOT NULL | e.g., "PB_U1_2025_001" |
| production_plan_id | UUID | FK → production_plans.id | Parent plan |
| dispatch_lot_id | UUID | FK → dispatch_lots.id | Demand link |
| branch_id | UUID | FK → branches.id, NOT NULL | Production branch |
| sku_id | VARCHAR(100) | FK → skus.sku_id, NOT NULL | |
| planned_quantity | INT | NOT NULL | |
| produced_quantity | INT | DEFAULT 0 | |
| good_quantity | INT | DEFAULT 0 | Post-QC good |
| rejected_quantity | INT | DEFAULT 0 | Post-QC rejected |
| batch_date | DATE | NOT NULL | Production date |
| shift | ENUM | DEFAULT 'DAY' | DAY, NIGHT |
| status | ENUM | DEFAULT 'PLANNED' | See lifecycle |
| started_at | TIMESTAMP | | |
| completed_at | TIMESTAMP | | |
| completed_by | UUID | FK → users.id | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 14. rm_stock_movements (NEW - Append-Only)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| movement_code | VARCHAR(50) | UNIQUE, NOT NULL | Auto-generated |
| rm_id | VARCHAR(50) | FK → raw_materials.rm_id, NOT NULL | |
| branch_id | UUID | FK → branches.id, NOT NULL | |
| movement_type | ENUM | NOT NULL | INWARD, CONSUMPTION, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, SCRAP, PRODUCTION |
| quantity | DECIMAL(12,4) | NOT NULL | Positive for in, negative for out |
| unit_of_measure | VARCHAR(20) | NOT NULL | KG, PCS, etc. |
| reference_type | VARCHAR(50) | | 'PRODUCTION_BATCH', 'PURCHASE_ORDER', 'IBT', 'ADJUSTMENT' |
| reference_id | UUID | | FK to source document |
| l1_rm_id | VARCHAR(50) | FK → raw_materials.rm_id | For L2, the L1 source |
| l1_quantity_consumed | DECIMAL(12,4) | | L1 qty deducted |
| unit_cost | DECIMAL(12,4) | | Cost at time of movement |
| total_cost | DECIMAL(14,4) | | quantity × unit_cost |
| balance_after | DECIMAL(12,4) | NOT NULL | Running balance |
| notes | TEXT | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | UUID | FK → users.id | |

**Constraint:** APPEND-ONLY - No UPDATE or DELETE allowed.

---

#### 15. qc_checklists (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| checklist_code | VARCHAR(50) | UNIQUE, NOT NULL | |
| name | VARCHAR(200) | NOT NULL | Check name |
| description | TEXT | | Detailed instruction |
| check_type | ENUM | NOT NULL | VISUAL, MEASUREMENT, FUNCTIONAL, SAFETY |
| vertical_id | UUID | FK → verticals.id | NULL = all verticals |
| model_id | UUID | FK → models.id | NULL = all models |
| brand_id | UUID | FK → brands.id | NULL = all brands |
| expected_value | VARCHAR(200) | | Target value/range |
| is_mandatory | BOOLEAN | DEFAULT TRUE | |
| check_priority | INT | DEFAULT 100 | Sort order |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 16. qc_results (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| result_code | VARCHAR(50) | UNIQUE, NOT NULL | |
| production_batch_id | UUID | FK → production_batches.id, NOT NULL | |
| checklist_id | UUID | FK → qc_checklists.id, NOT NULL | |
| sample_size | INT | NOT NULL | Units inspected |
| passed_count | INT | NOT NULL | |
| failed_count | INT | NOT NULL | |
| actual_value | VARCHAR(200) | | Measured value |
| result_status | ENUM | NOT NULL | PASSED, FAILED, CONDITIONAL |
| defect_type | VARCHAR(100) | | If failed |
| inspected_at | TIMESTAMP | DEFAULT NOW() | |
| inspected_by | UUID | FK → users.id, NOT NULL | |

---

#### 17. qc_approvals (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| production_batch_id | UUID | FK → production_batches.id, UNIQUE | One per batch |
| total_inspected | INT | NOT NULL | |
| total_passed | INT | NOT NULL | |
| total_failed | INT | NOT NULL | |
| overall_status | ENUM | NOT NULL | APPROVED, REJECTED, CONDITIONAL, REWORK |
| approved_quantity | INT | | Units cleared for FG |
| rejection_reason | TEXT | | If rejected |
| approved_at | TIMESTAMP | DEFAULT NOW() | |
| approved_by | UUID | FK → users.id, NOT NULL | |

---

#### 18. fg_inventory (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| branch_id | UUID | FK → branches.id, NOT NULL | |
| sku_id | VARCHAR(100) | FK → skus.sku_id, NOT NULL | |
| dispatch_lot_id | UUID | FK → dispatch_lots.id | |
| production_batch_id | UUID | FK → production_batches.id | |
| quantity | INT | NOT NULL | |
| unit_cost | DECIMAL(12,4) | | Manufacturing cost |
| status | ENUM | DEFAULT 'AVAILABLE' | AVAILABLE, RESERVED, DISPATCHED, DAMAGED |
| qc_approval_id | UUID | FK → qc_approvals.id | QC clearance |
| received_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 19. purchase_orders (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| po_number | VARCHAR(50) | UNIQUE, NOT NULL | |
| vendor_id | VARCHAR(50) | FK → vendors.vendor_id, NOT NULL | |
| branch_id | UUID | FK → branches.id, NOT NULL | Delivery branch |
| order_date | DATE | NOT NULL | |
| expected_delivery_date | DATE | | |
| total_amount | DECIMAL(14,2) | | |
| currency | VARCHAR(10) | DEFAULT 'INR' | |
| status | ENUM | DEFAULT 'DRAFT' | DRAFT, SENT, ACKNOWLEDGED, PARTIAL, RECEIVED, CANCELLED |
| payment_status | ENUM | DEFAULT 'PENDING' | PENDING, PARTIAL, PAID |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | UUID | FK → users.id | |

---

#### 20. purchase_order_lines (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| po_id | UUID | FK → purchase_orders.id, NOT NULL | |
| rm_id | VARCHAR(50) | FK → raw_materials.rm_id, NOT NULL | |
| quantity_ordered | DECIMAL(12,4) | NOT NULL | |
| quantity_received | DECIMAL(12,4) | DEFAULT 0 | |
| unit_price | DECIMAL(12,4) | NOT NULL | |
| unit_of_measure | VARCHAR(20) | NOT NULL | |
| line_total | DECIMAL(14,2) | | |
| status | ENUM | DEFAULT 'PENDING' | PENDING, PARTIAL, RECEIVED, CANCELLED |

---

#### 21. dispatches (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| dispatch_code | VARCHAR(50) | UNIQUE, NOT NULL | |
| dispatch_lot_id | UUID | FK → dispatch_lots.id, NOT NULL | |
| branch_id | UUID | FK → branches.id, NOT NULL | Shipping from |
| buyer_id | UUID | FK → buyers.id, NOT NULL | |
| sku_id | VARCHAR(100) | FK → skus.sku_id, NOT NULL | |
| quantity | INT | NOT NULL | |
| dispatch_date | DATE | NOT NULL | |
| tracking_number | VARCHAR(100) | | |
| status | ENUM | DEFAULT 'PENDING' | PENDING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 22. invoices (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| invoice_number | VARCHAR(50) | UNIQUE, NOT NULL | |
| dispatch_id | UUID | FK → dispatches.id | |
| buyer_id | UUID | FK → buyers.id, NOT NULL | |
| invoice_date | DATE | NOT NULL | |
| subtotal | DECIMAL(14,2) | NOT NULL | |
| tax_amount | DECIMAL(12,2) | DEFAULT 0 | |
| total_amount | DECIMAL(14,2) | NOT NULL | |
| status | ENUM | DEFAULT 'DRAFT' | DRAFT, SENT, PAID, OVERDUE, CANCELLED |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 23. ibt_transfers (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| transfer_code | VARCHAR(50) | UNIQUE, NOT NULL | e.g., "IBT_2025_001" |
| transfer_type | ENUM | NOT NULL | RM, FG |
| source_branch_id | UUID | FK → branches.id, NOT NULL | |
| destination_branch_id | UUID | FK → branches.id, NOT NULL | |
| item_id | VARCHAR(100) | NOT NULL | rm_id or sku_id |
| quantity | DECIMAL(12,4) | NOT NULL | |
| unit_of_measure | VARCHAR(20) | | |
| status | ENUM | DEFAULT 'INITIATED' | See IBT lifecycle |
| initiated_at | TIMESTAMP | DEFAULT NOW() | |
| initiated_by | UUID | FK → users.id | |
| approved_at | TIMESTAMP | | |
| received_at | TIMESTAMP | | |
| received_by | UUID | FK → users.id | |

**Constraint:** source_branch_id ≠ destination_branch_id

---

#### 24. price_history (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| entity_type | ENUM | NOT NULL | VENDOR_RM, SKU_BUYER, RM_COST |
| entity_id | VARCHAR(100) | NOT NULL | Reference ID |
| old_price | DECIMAL(12,4) | | |
| new_price | DECIMAL(12,4) | NOT NULL | |
| currency | VARCHAR(10) | DEFAULT 'INR' | |
| change_reason | TEXT | | |
| effective_date | DATE | NOT NULL | |
| approved_by | UUID | FK → users.id | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

#### 25. audit_logs (NEW)

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | PK | |
| entity_type | VARCHAR(50) | NOT NULL | Table name |
| entity_id | VARCHAR(100) | NOT NULL | Record ID |
| action | ENUM | NOT NULL | CREATE, UPDATE, DELETE, STATUS_CHANGE |
| old_values | JSONB | | Previous state |
| new_values | JSONB | | New state |
| user_id | UUID | FK → users.id | |
| user_email | VARCHAR(100) | | Denormalized |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

# Section 6: Architecture & Scalability

## 6.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                    (Authentication, Rate Limiting, Routing)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  DEMAND SVC   │         │ TECH OPS SVC  │         │PROCUREMENT SVC│
│               │         │               │         │               │
│ • Forecasts   │         │ • RM (L1/L2)  │         │ • Vendors     │
│ • DispatchLots│         │ • BOM         │         │ • VendorPrices│
│ • SKU (Draft) │         │ • Verticals   │         │ • POs         │
└───────────────┘         └───────────────┘         └───────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     MESSAGE QUEUE       │
                    │  (Events & Notifications)│
                    └─────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│PRODUCTION SVC │         │  QUALITY SVC  │         │LOGISTICS SVC  │
│               │         │               │         │               │
│ • Plans       │         │ • Checklists  │         │ • Dispatches  │
│ • Batches     │         │ • QC Results  │         │ • Invoices    │
│ • RMMovements │         │ • Approvals   │         │ • IBT         │
│ • FGInventory │         │               │         │               │
└───────────────┘         └───────────────┘         └───────────────┘
```

## 6.2 Service Ownership Matrix

| Service | Owned Tables (Write) | Read Access |
|---------|---------------------|-------------|
| **Master Admin** | users, branches, system_config, audit_logs | ALL |
| **Demand Service** | forecasts, dispatch_lots, skus (DRAFT only) | skus, fg_inventory, dispatches |
| **Tech Ops Service** | raw_materials, bill_of_materials, verticals, models, brands, buyers | forecasts, vendor_rm_prices |
| **Procurement Service** | vendors, vendor_rm_prices, purchase_orders, po_lines, price_history | raw_materials, production_plans |
| **Production Service** | production_plans, production_batches, rm_stock_movements, fg_inventory | bom, dispatch_lots, qc_approvals |
| **Quality Service** | qc_checklists, qc_results, qc_approvals | production_batches, skus |
| **Logistics Service** | dispatches, invoices, ibt_transfers | fg_inventory, dispatch_lots |

## 6.3 Key Events & Handlers

| Event | Publisher | Subscribers | Action |
|-------|-----------|-------------|--------|
| `SKU_CREATED` | Demand | Tech Ops | Create BOM placeholder |
| `BOM_FINALIZED` | Tech Ops | Demand, CPC | Update SKU status |
| `PLAN_ASSIGNED` | CPC | Branch Ops | Notify branch |
| `BATCH_COMPLETED` | Branch Ops | Quality | Trigger QC |
| `QC_APPROVED` | Quality | Production, Logistics | Move to FG |
| `QC_REJECTED` | Quality | Branch Ops | Trigger rework |
| `DISPATCH_SHIPPED` | Logistics | Demand | Update lot status |
| `RM_LOW_STOCK` | Production | Procurement | Reorder alert |

---

# Section 7: L1/L2 Consumption Engine Code

## 7.1 INM L2 Consumption (Python)

```python
async def consume_inm_l2_material(
    branch_id: UUID,
    rm_id: str,  # L2 INM RM
    quantity: int,
    production_batch_id: UUID,
    user_id: UUID
) -> dict:
    """
    INM L2 consumption:
    1. Base metal: 1:1 ratio (L2_Qty = L1_Qty consumed)
    2. Powder coating: predefined grams per unit × qty × scrap factor
    """
    
    # 1. Fetch L2 RM details
    l2_rm = await db.raw_materials.find_one({"rm_id": rm_id})
    
    if l2_rm.category != "INM" or l2_rm.rm_level != "L2":
        raise ValueError("This function is only for INM L2 materials")
    
    # 2. Get L1 references
    base_metal_rm_id = l2_rm.parent_rm_id
    powder_coating_rm_id = l2_rm.secondary_l1_rm_id
    
    if not base_metal_rm_id:
        raise ValueError(f"INM L2 {rm_id} missing base metal L1 reference")
    if not powder_coating_rm_id:
        raise ValueError(f"INM L2 {rm_id} missing powder coating L1 reference")
    
    # 3. Calculate Base Metal consumption (1:1 ratio)
    metal_consumption = quantity
    
    # 4. Calculate Powder Coating consumption
    powder_qty_grams = l2_rm.powder_qty_grams or 0
    if powder_qty_grams <= 0:
        raise ValueError(f"INM L2 {rm_id} missing predefined powder_qty_grams")
    
    coating_scrap_factor = l2_rm.coating_scrap_factor or 0.10
    coating_consumption_kg = (quantity * powder_qty_grams / 1000) * (1 + coating_scrap_factor)
    
    # 5. Check stock availability
    metal_stock = await get_branch_rm_stock(branch_id, base_metal_rm_id)
    coating_stock = await get_branch_rm_stock(branch_id, powder_coating_rm_id)
    
    if metal_stock < metal_consumption:
        raise InsufficientStockError(
            f"Need {metal_consumption} units of {base_metal_rm_id}, only {metal_stock} available"
        )
    if coating_stock < coating_consumption_kg:
        raise InsufficientStockError(
            f"Need {coating_consumption_kg:.4f} KG of {powder_coating_rm_id}, only {coating_stock:.4f} available"
        )
    
    # 6. Get costs
    l1_unit_cost = await get_current_rm_price(base_metal_rm_id, branch_id)
    coating_price_per_kg = await get_current_rm_price(powder_coating_rm_id, branch_id)
    
    # 7. Calculate L2 Unit Cost
    coating_cost_per_unit = (powder_qty_grams / 1000) * coating_price_per_kg * (1 + coating_scrap_factor)
    processing_cost = l2_rm.processing_cost or 0
    
    l2_unit_cost = l1_unit_cost + coating_cost_per_unit + processing_cost
    
    # 8. Create stock movements (Base Metal)
    await db.rm_stock_movements.insert_one({
        "movement_code": generate_movement_code(),
        "rm_id": base_metal_rm_id,
        "branch_id": branch_id,
        "movement_type": "CONSUMPTION",
        "quantity": -metal_consumption,
        "unit_of_measure": "PCS",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "unit_cost": l1_unit_cost,
        "total_cost": metal_consumption * l1_unit_cost,
        "balance_after": metal_stock - metal_consumption,
        "notes": f"Base metal for {rm_id} x {quantity} (1:1)",
        "created_by": user_id
    })
    
    # 9. Create stock movements (Powder Coating)
    await db.rm_stock_movements.insert_one({
        "movement_code": generate_movement_code(),
        "rm_id": powder_coating_rm_id,
        "branch_id": branch_id,
        "movement_type": "CONSUMPTION",
        "quantity": -coating_consumption_kg,
        "unit_of_measure": "KG",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "unit_cost": coating_price_per_kg,
        "total_cost": coating_consumption_kg * coating_price_per_kg,
        "balance_after": coating_stock - coating_consumption_kg,
        "notes": f"Powder coating for {rm_id} x {quantity} @ {powder_qty_grams}g each",
        "created_by": user_id
    })
    
    # 10. Create L2 production movement
    l2_stock = await get_branch_rm_stock(branch_id, rm_id)
    await db.rm_stock_movements.insert_one({
        "movement_code": generate_movement_code(),
        "rm_id": rm_id,
        "branch_id": branch_id,
        "movement_type": "PRODUCTION",
        "quantity": quantity,
        "unit_of_measure": "PCS",
        "reference_type": "PRODUCTION_BATCH",
        "reference_id": production_batch_id,
        "l1_rm_id": base_metal_rm_id,
        "l1_quantity_consumed": metal_consumption,
        "unit_cost": l2_unit_cost,
        "total_cost": quantity * l2_unit_cost,
        "balance_after": l2_stock + quantity,
        "notes": f"L1: {metal_consumption} pcs, Coating: {coating_consumption_kg:.4f} KG",
        "created_by": user_id
    })
    
    # 11. Update inventory balances
    await update_branch_rm_inventory(branch_id, base_metal_rm_id, -metal_consumption)
    await update_branch_rm_inventory(branch_id, powder_coating_rm_id, -coating_consumption_kg)
    await update_branch_rm_inventory(branch_id, rm_id, quantity)
    
    return {
        "l2_rm_id": rm_id,
        "quantity_produced": quantity,
        "base_metal_consumed": {
            "rm_id": base_metal_rm_id,
            "quantity": metal_consumption,
            "unit": "PCS",
            "unit_cost": round(l1_unit_cost, 2),
            "total_cost": round(metal_consumption * l1_unit_cost, 2)
        },
        "powder_coating_consumed": {
            "rm_id": powder_coating_rm_id,
            "quantity_kg": round(coating_consumption_kg, 4),
            "grams_per_unit": powder_qty_grams,
            "unit_cost_per_kg": round(coating_price_per_kg, 2),
            "total_cost": round(coating_consumption_kg * coating_price_per_kg, 2)
        },
        "l2_unit_cost_breakdown": {
            "l1_unit_cost": round(l1_unit_cost, 2),
            "coating_cost_per_unit": round(coating_cost_per_unit, 2),
            "processing_cost": round(processing_cost, 2),
            "total_l2_unit_cost": round(l2_unit_cost, 2)
        },
        "total_batch_cost": round(quantity * l2_unit_cost, 2)
    }
```

## 7.2 INP L2 Consumption (Python)

```python
async def consume_inp_l2_material(
    branch_id: UUID,
    rm_id: str,  # L2 INP RM
    quantity: int,
    production_batch_id: UUID,
    user_id: UUID
) -> dict:
    """
    INP L2 consumption: Weight-based L1 deduction
    """
    
    l2_rm = await db.raw_materials.find_one({"rm_id": rm_id})
    
    if l2_rm.category != "INP" or l2_rm.rm_level != "L2":
        raise ValueError("This function is only for INP L2 materials")
    
    l1_rm_id = l2_rm.parent_rm_id
    if not l1_rm_id:
        raise ValueError(f"INP L2 {rm_id} missing polymer L1 reference")
    
    # Calculate L1 consumption (weight-based)
    unit_weight_kg = (l2_rm.unit_weight_grams or 0) / 1000
    scrap_factor = l2_rm.scrap_factor or 0.02
    l1_consumption = quantity * unit_weight_kg * (1 + scrap_factor)
    
    # Check stock
    l1_stock = await get_branch_rm_stock(branch_id, l1_rm_id)
    if l1_stock < l1_consumption:
        raise InsufficientStockError(
            f"Need {l1_consumption:.3f} KG of {l1_rm_id}, only {l1_stock:.3f} available"
        )
    
    # Get price and calculate cost
    l1_price = await get_current_rm_price(l1_rm_id, branch_id)
    processing_cost = l2_rm.processing_cost or 0
    l2_unit_cost = (unit_weight_kg * l1_price * (1 + scrap_factor)) + processing_cost
    
    # Create movements and update inventory
    # ... (similar pattern to INM)
    
    return {
        "l2_rm_id": rm_id,
        "quantity_produced": quantity,
        "polymer_consumed": {
            "rm_id": l1_rm_id,
            "quantity_kg": round(l1_consumption, 4),
            "total_cost": round(l1_consumption * l1_price, 2)
        },
        "l2_unit_cost": round(l2_unit_cost, 2),
        "total_batch_cost": round(quantity * l2_unit_cost, 2)
    }
```

---

# Section 8: Predefined Powder Coating RMs

```sql
-- Hardcoded L1 RMs for powder coating materials
INSERT INTO raw_materials (rm_id, category, rm_level, category_data) VALUES
('INM_PC_001', 'INM', 'L1', '{"type": "Powder Coating", "color": "Black", "finish": "Matte", "unit": "KG"}'),
('INM_PC_002', 'INM', 'L1', '{"type": "Powder Coating", "color": "White", "finish": "Gloss", "unit": "KG"}'),
('INM_PC_003', 'INM', 'L1', '{"type": "Powder Coating", "color": "Red", "finish": "Matte", "unit": "KG"}'),
('INM_PC_004', 'INM', 'L1', '{"type": "Powder Coating", "color": "Blue", "finish": "Gloss", "unit": "KG"}'),
('INM_PC_005', 'INM', 'L1', '{"type": "Powder Coating", "color": "Silver", "finish": "Metallic", "unit": "KG"}'),
('INM_PC_006', 'INM', 'L1', '{"type": "Powder Coating", "color": "Custom", "finish": "Various", "unit": "KG"}');

-- Base metal L1 RMs (examples)
INSERT INTO raw_materials (rm_id, category, rm_level, category_data) VALUES
('INM_MS_001', 'INM', 'L1', '{"type": "Mild Steel Sheet", "grade": "IS2062", "unit": "KG"}'),
('INM_MS_002', 'INM', 'L1', '{"type": "Mild Steel Tube", "grade": "IS2062", "unit": "KG"}'),
('INM_AL_001', 'INM', 'L1', '{"type": "Aluminium Sheet", "grade": "6061", "unit": "KG"}'),
('INM_SS_001', 'INM', 'L1', '{"type": "Stainless Steel", "grade": "304", "unit": "KG"}');
```

---

# Section 9: Migration Notes

## 9.1 Non-Breaking Changes (Safe to Apply)
- All new fields on existing tables have DEFAULT values
- New tables can be created without affecting existing functionality
- Existing RM, SKU, Vendor data remains intact

## 9.2 Future Breaking Changes (Requires Migration Plan)
1. **Consolidate sku_rm_mapping → bill_of_materials**
   - Create new table, migrate data, create view for backward compatibility
   
2. **Normalize branch names to branches table**
   - Add branch_id FK columns, populate from name, keep name for compatibility

---

**Document End**
*Version 2.0 - December 2025*
