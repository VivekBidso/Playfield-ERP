# MRP Implementation Plan - Complete Reference

## Document Version
- **Created**: March 28, 2026
- **Last Updated**: March 28, 2026
- **Status**: APPROVED FOR IMPLEMENTATION

---

## 1. BUSINESS CONTEXT

### Company Profile
- **Industry**: Consumer Goods Manufacturing (Kids Products)
- **Products**: Scooters, Walkers, Ride-ons, Toys
- **Brands**: Multiple (FunCruise, Baybee, etc.) selling same base products
- **Production Sites**: Multiple branches

### Planning Hierarchy
```
MODEL (e.g., Blaze, Pulse, Toodle)
    │
    └── BIDSO SKU (Base product, brand-agnostic)
            │
            └── BUYER SKU (Brand-specific variant)
```

### Forecast Granularity
| Time Horizon | Forecast Level | Reason |
|--------------|----------------|--------|
| Month 1 (M1) | Buyer SKU | Brand orders confirmed |
| Months 2-12 | Model → Bidso SKU | Brand mix unknown |

---

## 2. RM CLASSIFICATION

### By Procurement Level
| Category Prefix | Type | Procure When | BOM Source |
|-----------------|------|--------------|------------|
| ACC_ | COMMON | M1-M12 (Bidso level) | common_bom |
| INP_ | COMMON | M1-M12 (Bidso level) | common_bom |
| SP_ | COMMON | M1-M12 (Bidso level) | common_bom |
| INM_ | COMMON | M1-M12 (Bidso level) | common_bom |
| **BS_** | **BRAND_SPECIFIC** | **M1 only** | brand_specific_bom |
| **LB_** | **BRAND_SPECIFIC** | **M1 only** | brand_specific_bom |
| **PM_** | **BRAND_SPECIFIC** | **M1 only** | brand_specific_bom |

### Classification Function
```python
def classify_rm(rm_id: str) -> str:
    prefix = rm_id.split('_')[0] if '_' in rm_id else rm_id[:2]
    if prefix in ['BS', 'LB', 'PM']:
        return 'BRAND_SPECIFIC'
    return 'COMMON'
```

---

## 3. WEEKLY TIME-PHASED MRP LOGIC

### Core Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| Ordering Frequency | Weekly (Mondays) | Orders placed once per week |
| Site Buffer | 7 days | Material arrives 7 days before production |
| Lead Time | Per RM | From rm_procurement_parameters |
| Planning Horizon | 12 months | Rolling forecast window |

### Timing Calculation
```
Production Week Start
        │
        ▼
Arrival Date = Production Week Start - 7 days (Site Buffer)
        │
        ▼
Order Date = Arrival Date - Lead Time (RM-specific)
        │
        ▼
Order Week = Monday of the week containing Order Date
```

### Example Calculation
```
RM: ACC_024
Lead Time: 14 days
Site Buffer: 7 days
Production Week: April 14, 2026

Arrival Date = April 14 - 7 = April 7, 2026
Order Date = April 7 - 14 = March 24, 2026
Order Week = March 24, 2026 (Monday)
```

---

## 4. NET REQUIREMENT CALCULATION

### Complete Formula
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  NET REQUIREMENT = GROSS REQUIREMENT                                            │
│                  + SAFETY STOCK                                                  │
│                  + SCRAP ALLOWANCE (Yield Factor)                               │
│                  - AVAILABLE STOCK                                               │
│                  - SCHEDULED RECEIPTS (Open POs)                                │
│                  - IN-TRANSIT STOCK                                              │
│                  - INTER-BRANCH AVAILABLE                                        │
│                                                                                  │
│  Where:                                                                          │
│    AVAILABLE STOCK = On-Hand Stock                                              │
│                    - Quality Hold Stock                                          │
│                    - Allocated/Reserved Stock                                    │
│                    - Expired Stock                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Stock Categories
| Category | Description | Include in Available? |
|----------|-------------|----------------------|
| On-Hand | Physical stock in warehouse | ✅ Yes |
| Quality Hold | Failed QC, under inspection | ❌ No |
| Allocated | Reserved for specific orders | ❌ No |
| Expired | Past shelf life | ❌ No |
| In-Transit | Shipped, not yet received | ✅ Yes (separate line) |
| Open PO | Ordered, not yet shipped | ✅ Yes (separate line) |

---

## 5. OPEN PO / SCHEDULED RECEIPTS LOGIC

### PO Status Flow
```
DRAFT → ISSUED → ACKNOWLEDGED → SHIPPED → IN_TRANSIT → RECEIVED → CLOSED
                      │              │           │
                      └──────────────┴───────────┘
                          "Scheduled Receipts"
                      (Include in MRP calculation)
```

### Data Model for PO Tracking
```javascript
purchase_orders: {
  po_number: "PO-202603-0001",
  vendor_id: "VND_123",
  status: "SHIPPED",  // DRAFT|ISSUED|ACKNOWLEDGED|SHIPPED|IN_TRANSIT|RECEIVED|CLOSED
  order_date: "2026-03-17",
  expected_delivery_date: "2026-03-31",
  actual_delivery_date: null,
  
  line_items: [
    {
      rm_id: "ACC_024",
      ordered_qty: 500,
      received_qty: 0,
      pending_qty: 500,  // = ordered_qty - received_qty
      expected_delivery_date: "2026-03-31",  // Can be different per line
      status: "PENDING"  // PENDING|PARTIAL|RECEIVED|CANCELLED
    }
  ]
}
```

### MRP Query for Scheduled Receipts
```python
async def get_scheduled_receipts(rm_id: str, by_date: date) -> int:
    """
    Get total quantity on order expected to arrive by given date.
    """
    pipeline = [
        {"$match": {
            "status": {"$in": ["ISSUED", "ACKNOWLEDGED", "SHIPPED", "IN_TRANSIT"]},
            "line_items.rm_id": rm_id,
            "line_items.expected_delivery_date": {"$lte": by_date}
        }},
        {"$unwind": "$line_items"},
        {"$match": {
            "line_items.rm_id": rm_id,
            "line_items.status": {"$ne": "CANCELLED"}
        }},
        {"$group": {
            "_id": None,
            "total_pending": {"$sum": "$line_items.pending_qty"}
        }}
    ]
    result = await db.purchase_orders.aggregate(pipeline).to_list(1)
    return result[0]["total_pending"] if result else 0
```

---

## 6. ADDITIONAL MRP FACTORS

### 6.1 Scrap/Yield Factor
**Purpose**: Account for expected material wastage in production

```javascript
// In rm_procurement_parameters
{
  rm_id: "ACC_024",
  yield_factor: 0.95,  // 95% yield = 5% scrap
  // OR
  scrap_percentage: 5  // 5% scrap allowance
}

// Calculation
gross_with_scrap = gross_requirement / yield_factor
// OR
gross_with_scrap = gross_requirement * (1 + scrap_percentage/100)
```

### 6.2 Lot Sizing Rules
**Purpose**: Different ordering strategies per RM

| Rule | Code | Description | Use Case |
|------|------|-------------|----------|
| Lot-for-Lot | L4L | Order exact net requirement | Expensive items, low volume |
| Fixed Order Qty | FOQ | Always order fixed amount | Standard items |
| Min Order Qty | MOQ | Already implemented | Supplier constraint |
| Period Order Qty | POQ | Order for X weeks at once | Reduce ordering frequency |
| Economic Order Qty | EOQ | Balance order vs holding cost | Cost optimization |

```javascript
// In rm_procurement_parameters
{
  rm_id: "ACC_024",
  lot_sizing_rule: "MOQ_BATCH",  // Current implementation
  moq: 50,
  batch_size: 10,
  
  // OR for POQ
  lot_sizing_rule: "POQ",
  poq_weeks: 4,  // Order 4 weeks' requirement at once
  
  // OR for FOQ
  lot_sizing_rule: "FOQ",
  fixed_order_qty: 1000
}
```

### 6.3 Inter-Branch Stock Availability
**Purpose**: Use stock from other branches before ordering new

```javascript
// Query available stock across all branches
async def get_inter_branch_available(rm_id: str, exclude_branch: str) -> List:
    return await db.branch_rm_inventory.find({
        "rm_id": rm_id,
        "branch": {"$ne": exclude_branch},
        "available_qty": {"$gt": 0}  // available = on_hand - allocated - hold
    }).to_list(100)
```

**Transfer Lead Time**: Need to add `transfer_lead_time_days` between branches

### 6.4 Supplier Constraints
**Purpose**: Respect supplier limitations

```javascript
// In vendors collection
{
  vendor_id: "VND_123",
  name: "ABC Supplies",
  
  constraints: {
    max_order_value_per_week: 500000,  // ₹5L max per week
    max_order_qty_per_rm: {
      "ACC_024": 5000  // Can supply max 5000/order
    },
    min_order_value: 10000,  // Min ₹10K per order
    blocked_periods: [
      { from: "2026-04-01", to: "2026-04-07", reason: "Annual shutdown" }
    ],
    lead_time_buffer_peak_season: 7  // Add 7 days during peak
  },
  
  credit_limit: 1000000,
  current_outstanding: 450000
}
```

### 6.5 Quality Hold Stock
**Purpose**: Exclude stock under quality inspection

```javascript
// In branch_rm_inventory
{
  rm_id: "ACC_024",
  branch: "Unit 1",
  on_hand_qty: 1000,
  quality_hold_qty: 150,  // Under QC
  allocated_qty: 200,     // Reserved
  available_qty: 650      // = 1000 - 150 - 200
}
```

### 6.6 Shelf Life / Expiry
**Purpose**: Exclude expired stock, prioritize FIFO

```javascript
// Stock lots with expiry tracking
rm_stock_lots: {
  rm_id: "PM_FC_010",  // Packaging material
  branch: "Unit 1",
  lot_number: "LOT-2026-001",
  quantity: 500,
  received_date: "2026-01-15",
  expiry_date: "2026-07-15",
  status: "AVAILABLE"  // AVAILABLE|EXPIRED|CONSUMED
}

// Exclude expired in MRP
async def get_available_stock(rm_id: str, branch: str, as_of_date: date) -> int:
    pipeline = [
        {"$match": {
            "rm_id": rm_id,
            "branch": branch,
            "status": "AVAILABLE",
            "expiry_date": {"$gt": as_of_date}  // Not expired
        }},
        {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
    ]
    result = await db.rm_stock_lots.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0
```

### 6.7 Order Consolidation
**Purpose**: Group orders by vendor for efficiency

```javascript
// After calculating weekly order plan
consolidate_by_vendor: {
  order_week: "2026-03-24",
  vendor_id: "VND_123",
  vendor_name: "ABC Supplies",
  
  items: [
    { rm_id: "ACC_024", order_qty: 500, unit_price: 25.50 },
    { rm_id: "ACC_042", order_qty: 300, unit_price: 18.00 },
    { rm_id: "INP_145", order_qty: 1000, unit_price: 12.50 }
  ],
  
  total_value: 30750,
  min_order_value: 10000,  // Met ✓
  shipping_consolidation: true
}
```

### 6.8 Forecast Accuracy & Safety Stock Adjustment
**Purpose**: Dynamic safety stock based on forecast reliability

```javascript
// Track forecast accuracy per SKU/Model
forecast_accuracy: {
  model_id: "...",
  month: "2026-03",
  forecasted_qty: 15000,
  actual_qty: 13500,
  accuracy_percentage: 90,
  mape: 10  // Mean Absolute Percentage Error
}

// Adjust safety stock based on accuracy
// Low accuracy = Higher safety stock
safety_stock_multiplier = 1 + (1 - accuracy_percentage/100)
adjusted_safety_stock = base_safety_stock * safety_stock_multiplier
```

### 6.9 Expedite Alerts
**Purpose**: Flag items where lead time exceeds available time

```javascript
// Alert when: Order Date < Today
alert: {
  type: "EXPEDITE_REQUIRED",
  severity: "CRITICAL",
  rm_id: "ACC_042",
  rm_name: "Critical Part",
  production_week: "2026-04-07",
  required_arrival: "2026-03-31",
  lead_time_days: 30,
  calculated_order_date: "2026-03-01",  // In the past!
  today: "2026-03-28",
  days_overdue: 27,
  
  recommendations: [
    "Contact supplier for expedited shipping",
    "Check inter-branch availability",
    "Consider substitute material"
  ]
}
```

### 6.10 ABC Classification
**Purpose**: Different policies for different value items

| Class | Criteria | Policy |
|-------|----------|--------|
| A | Top 20% by value (80% of spend) | Tight control, weekly review |
| B | Next 30% by value | Moderate control, bi-weekly |
| C | Bottom 50% by value | Bulk ordering, monthly review |

```javascript
// In raw_materials collection
{
  rm_id: "ACC_024",
  abc_class: "A",
  
  // Class-specific policies
  review_frequency: "WEEKLY",
  safety_stock_weeks: 2,
  lot_sizing_rule: "L4L"
}
```

---

## 7. DATA MODEL CHANGES

### 7.1 Enhanced rm_procurement_parameters
```javascript
{
  rm_id: "ACC_024",
  rm_name: "Scooter Universal",
  category: "ACC",
  
  // Existing
  safety_stock: 100,
  moq: 50,
  batch_size: 10,
  lead_time_days: 14,
  preferred_vendor_id: "VND_123",
  
  // NEW FIELDS
  yield_factor: 0.95,           // 95% yield
  lot_sizing_rule: "MOQ_BATCH", // L4L|FOQ|MOQ_BATCH|POQ|EOQ
  poq_weeks: null,              // For POQ rule
  fixed_order_qty: null,        // For FOQ rule
  abc_class: "A",               // A|B|C
  shelf_life_days: null,        // For perishables
  reorder_point: 200,           // Trigger for reorder
  max_stock_level: 5000,        // Upper limit
  
  is_active: true,
  updated_at: "2026-03-28T..."
}
```

### 7.2 Enhanced branch_rm_inventory
```javascript
{
  rm_id: "ACC_024",
  branch: "Unit 1",
  
  // Stock breakdown
  on_hand_qty: 1000,
  quality_hold_qty: 150,
  allocated_qty: 200,
  in_transit_qty: 300,
  
  // Calculated
  available_qty: 650,  // on_hand - hold - allocated
  
  updated_at: "2026-03-28T..."
}
```

### 7.3 New Collection: stock_allocations
```javascript
{
  id: "uuid",
  rm_id: "ACC_024",
  branch: "Unit 1",
  allocated_qty: 200,
  
  allocated_for: {
    type: "PRODUCTION_ORDER",
    reference_id: "PRD-2026-0042",
    production_date: "2026-04-07"
  },
  
  allocated_at: "2026-03-25T...",
  allocated_by: "user_id",
  status: "ACTIVE"  // ACTIVE|RELEASED|CONSUMED
}
```

### 7.4 Enhanced purchase_orders
```javascript
{
  id: "uuid",
  po_number: "PO-202603-0001",
  vendor_id: "VND_123",
  vendor_name: "ABC Supplies",
  
  // Status tracking
  status: "SHIPPED",
  status_history: [
    { status: "DRAFT", at: "...", by: "..." },
    { status: "ISSUED", at: "...", by: "..." },
    { status: "ACKNOWLEDGED", at: "...", by: "..." },
    { status: "SHIPPED", at: "...", by: "..." }
  ],
  
  // Dates
  order_date: "2026-03-17",
  expected_delivery_date: "2026-03-31",
  actual_delivery_date: null,
  
  // Source
  mrp_run_id: "mrp-run-uuid",
  order_week: "2026-03-17",
  
  // Line items
  line_items: [
    {
      line_number: 1,
      rm_id: "ACC_024",
      rm_name: "Scooter Universal",
      ordered_qty: 500,
      received_qty: 0,
      pending_qty: 500,
      unit_price: 25.50,
      total_price: 12750,
      expected_delivery_date: "2026-03-31",
      status: "PENDING",
      
      // Link to requirement
      for_production_week: "2026-04-07"
    }
  ],
  
  // Totals
  total_value: 125000,
  currency: "INR",
  
  created_at: "...",
  created_by: "..."
}
```

---

## 8. MRP CALCULATION FLOW (COMPLETE)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: COLLECT DEMAND                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ├── M1: Buyer SKU forecasts (demand_forecasts)
        │       → Weekly breakdown
        │       → Explode common_bom + brand_specific_bom
        │
        └── M2-M12: Model forecasts → Bidso SKU split
                → Weekly breakdown
                → Explode common_bom ONLY (skip BS_, LB_, PM_)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AGGREGATE RM REQUIREMENTS BY PRODUCTION WEEK                           │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: FOR EACH RM + PRODUCTION WEEK                                          │
│                                                                                  │
│  3a. Calculate Arrival Date = Production Week - 7 days                          │
│  3b. Calculate Order Date = Arrival Date - Lead Time                            │
│  3c. Determine Order Week (Monday)                                               │
│  3d. Apply Yield Factor: Gross = Gross / Yield                                  │
│  3e. Get Available Stock:                                                        │
│      - On-hand stock                                                             │
│      - MINUS Quality hold                                                        │
│      - MINUS Allocated stock                                                     │
│      - MINUS Expired stock                                                       │
│  3f. Get Scheduled Receipts:                                                     │
│      - Open POs (ISSUED/SHIPPED/IN_TRANSIT)                                     │
│      - Expected to arrive before this production week                           │
│  3g. Get Inter-Branch Available (optional transfer)                             │
│  3h. Calculate Net Requirement:                                                  │
│      Net = Gross + Safety Stock - Available - Scheduled Receipts               │
│  3i. Apply Lot Sizing (MOQ, Batch, POQ, etc.)                                   │
│  3j. Check Supplier Constraints                                                  │
│  3k. Generate Alerts if needed (Expedite, No Price, etc.)                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: GROUP BY ORDER WEEK                                                     │
│                                                                                  │
│  - Consolidate all RMs to be ordered in same week                               │
│  - Sub-group by vendor for PO consolidation                                     │
│  - Calculate week totals                                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: ASSIGN VENDORS & CALCULATE COSTS                                       │
│                                                                                  │
│  - Use preferred vendor if set                                                   │
│  - Else find lowest price vendor                                                 │
│  - Calculate line costs and totals                                               │
│  - Check vendor credit limits                                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: GENERATE OUTPUT                                                         │
│                                                                                  │
│  - Weekly Order Plan (Common Parts) - M1 to M12                                 │
│  - Weekly Order Plan (Brand-Specific) - M1 only                                 │
│  - Alerts & Exceptions                                                           │
│  - Summary Statistics                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. OUTPUT STRUCTURE

### MRP Run Document
```javascript
{
  id: "uuid",
  run_code: "MRP-20260328-143052",
  run_date: "2026-03-28T14:30:52Z",
  status: "CALCULATED",
  
  // Configuration used
  config: {
    site_buffer_days: 7,
    ordering_day: "MONDAY",
    planning_horizon_months: 12,
    include_open_pos: true,
    include_inter_branch: true,
    apply_yield_factor: true
  },
  
  // Input summary
  inputs: {
    m1_buyer_skus: 45,
    m1_demand_qty: 12500,
    m2_m12_models: 8,
    m2_m12_bidso_skus: 258,
    m2_m12_demand_qty: 145000
  },
  
  // Output summary
  summary: {
    total_production_weeks: 52,
    total_order_weeks: 48,
    
    common_rms: {
      count: 850,
      order_value: 45000000,
      order_weeks: 48
    },
    
    brand_specific_rms: {
      count: 120,
      order_value: 2500000,
      order_weeks: 4  // M1 only
    },
    
    total_order_value: 47500000,
    
    alerts: {
      expedite_required: 3,
      no_vendor_price: 15,
      exceeds_supplier_capacity: 2,
      low_stock_coverage: 8
    }
  },
  
  // Detailed plans
  common_weekly_plan: [...],        // See section below
  brand_specific_weekly_plan: [...], // See section below
  alerts: [...],
  
  // Audit
  created_at: "...",
  created_by: "user_id"
}
```

### Weekly Plan Entry
```javascript
{
  order_week: "2026-03-24",
  order_week_label: "Week 13 (Mar 24)",
  order_week_number: 13,
  
  place_order_by: "2026-03-24",
  
  // Items grouped by vendor
  vendors: [
    {
      vendor_id: "VND_123",
      vendor_name: "ABC Supplies",
      items: [
        {
          rm_id: "ACC_024",
          rm_name: "Scooter Universal",
          category: "ACC",
          type: "COMMON",
          
          // Timing
          production_week: "2026-04-07",
          arrival_date: "2026-03-31",
          lead_time_days: 14,
          
          // Quantity breakdown
          gross_qty: 500,
          yield_factor: 0.95,
          gross_with_scrap: 526,
          safety_stock: 100,
          on_hand_stock: 200,
          quality_hold: 20,
          allocated: 50,
          available_stock: 130,
          scheduled_receipts: 0,
          net_requirement: 496,
          
          // After lot sizing
          order_qty: 500,  // Rounded to batch
          lot_sizing_applied: "MOQ_BATCH",
          
          // Cost
          unit_price: 25.50,
          total_cost: 12750.00
        },
        // ... more items
      ],
      vendor_subtotal: 85000
    },
    // ... more vendors
  ],
  
  week_summary: {
    total_vendors: 12,
    total_items: 145,
    total_cost: 285000
  }
}
```

---

## 10. UI REQUIREMENTS

### New Tab: Weekly Order Plan

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  WEEKLY ORDER PLAN                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Select MRP Run: [ MRP-20260328-143052 ▼ ]        [ 📥 Export ] [ 🔄 Refresh ] │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  SUMMARY CARDS                                                               ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          ││
│  │  │ 48       │ │ 850      │ │ ₹4.5 Cr  │ │ 120      │ │ ₹25 L    │          ││
│  │  │ Weeks    │ │ Common   │ │ Common   │ │ Brand    │ │ Brand    │          ││
│  │  │          │ │ RMs      │ │ Value    │ │ Spec RMs │ │ Value    │          ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  FILTERS                                                                     ││
│  │  View: [ All Parts ▼ ]  Category: [ All ▼ ]  Vendor: [ All ▼ ]             ││
│  │        • All Parts       Week Range: [ Week 13 ] to [ Week 24 ]             ││
│  │        • Common Only                                                         ││
│  │        • Brand-Specific                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  ⚠️ ALERTS (5)                                              [ View All → ] ││
│  │  🔴 3 items require expediting  🟡 15 items missing vendor price            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════════│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  📅 WEEK 13: Mar 24, 2026                          [▼]      ₹2,85,000      ││
│  │  ───────────────────────────────────────────────────────────────────────────││
│  │  Place Order By: Mar 24  │  Covers Production: Apr 7  │  12 Vendors        ││
│  │                                                                              ││
│  │  ┌─ Vendor: ABC Supplies ──────────────────────────────── ₹85,000 ─────────┐││
│  │  │ RM ID    │ Name           │ Type   │ Order Qty │ Unit ₹ │ Total ₹      │││
│  │  │──────────│────────────────│────────│───────────│────────│──────────────│││
│  │  │ ACC_024  │ Scooter Univ.  │ COMMON │ 500       │ 25.50  │ 12,750       │││
│  │  │ ACC_042  │ Handle Grip    │ COMMON │ 300       │ 18.00  │ 5,400        │││
│  │  │ INP_145  │ Bearing Set    │ COMMON │ 1,000     │ 12.50  │ 12,500       │││
│  │  └──────────────────────────────────────────────────────────────────────────┘││
│  │                                                                              ││
│  │  ┌─ Vendor: XYZ Limited ───────────────────────────────── ₹45,000 ─────────┐││
│  │  │ ...                                                                      │││
│  │  └──────────────────────────────────────────────────────────────────────────┘││
│  │                                                                              ││
│  │  [ Generate Draft POs for Week 13 ]                                         ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  📅 WEEK 14: Mar 31, 2026                          [►]      ₹3,15,000      ││
│  │  (Collapsed - click to expand)                                               ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  📅 WEEK 15: Apr 7, 2026                           [►]      ₹2,95,000      ││
│  │  (Collapsed - click to expand)                                               ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. IMPLEMENTATION PHASES

### Phase 1: Core Weekly MRP (MVP)
| Task | Description | Priority |
|------|-------------|----------|
| 1.1 | Weekly breakdown of forecasts | P0 |
| 1.2 | Dual BOM explosion (common + brand-specific) | P0 |
| 1.3 | Order timing calculation (buffer + lead time) | P0 |
| 1.4 | Group by order week | P0 |
| 1.5 | Basic UI - Weekly Order Plan tab | P0 |
| 1.6 | Excel export | P0 |

### Phase 2: Open PO Integration
| Task | Description | Priority |
|------|-------------|----------|
| 2.1 | Enhanced PO status tracking | P0 |
| 2.2 | Scheduled receipts query | P0 |
| 2.3 | Include in net requirement calc | P0 |
| 2.4 | PO status update UI | P1 |

### Phase 3: Stock Enhancements
| Task | Description | Priority |
|------|-------------|----------|
| 3.1 | Quality hold tracking | P1 |
| 3.2 | Stock allocation/reservation | P1 |
| 3.3 | Available stock calculation | P1 |

### Phase 4: Advanced Features
| Task | Description | Priority |
|------|-------------|----------|
| 4.1 | Yield/scrap factor | P1 |
| 4.2 | Supplier constraints | P2 |
| 4.3 | Inter-branch availability | P2 |
| 4.4 | ABC classification policies | P2 |
| 4.5 | Forecast accuracy tracking | P2 |

### Phase 5: Alerts & Intelligence
| Task | Description | Priority |
|------|-------------|----------|
| 5.1 | Expedite alerts | P1 |
| 5.2 | Missing price alerts | P1 |
| 5.3 | Capacity constraint alerts | P2 |
| 5.4 | Suggested actions | P2 |

---

## 12. API ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mrp/calculate` | Run MRP calculation |
| GET | `/api/mrp/runs` | List MRP runs |
| GET | `/api/mrp/runs/{id}` | Get MRP run details |
| GET | `/api/mrp/runs/{id}/weekly-plan` | Get weekly order plan |
| GET | `/api/mrp/runs/{id}/weekly-plan/export` | Export to Excel |
| POST | `/api/mrp/runs/{id}/generate-pos` | Generate Draft POs |
| GET | `/api/mrp/runs/{id}/alerts` | Get alerts |
| GET | `/api/mrp/scheduled-receipts` | Get all open POs |
| PUT | `/api/purchase-orders/{id}/status` | Update PO status |

---

## 13. CONFIGURATION

### System Config (Global)
```javascript
mrp_config: {
  site_buffer_days: 7,
  ordering_day: "MONDAY",  // 0=Monday, 6=Sunday
  planning_horizon_months: 12,
  
  brand_specific_categories: ["BS", "LB", "PM"],
  
  default_yield_factor: 1.0,
  default_lead_time_days: 7,
  default_safety_stock: 0,
  
  include_open_pos: true,
  include_inter_branch: false,  // Enable when ready
  
  alert_thresholds: {
    expedite_days_before: 0,  // Alert if order date <= today
    low_stock_weeks: 2        // Alert if coverage < 2 weeks
  }
}
```

---

## APPENDIX A: Glossary

| Term | Definition |
|------|------------|
| Gross Requirement | Total quantity needed for production |
| Net Requirement | Gross - Available Stock - Scheduled Receipts |
| Scheduled Receipt | Quantity on order, expected to arrive |
| Lead Time | Days from order placement to delivery |
| Site Buffer | Days material should arrive before production |
| MOQ | Minimum Order Quantity (supplier constraint) |
| Batch Size | Order must be multiple of this |
| Yield Factor | Expected usable percentage (0.95 = 5% scrap) |
| Safety Stock | Buffer stock for demand variability |
| Order Week | The Monday when order should be placed |
| Production Week | The Monday of the week when production happens |

---

## APPENDIX B: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Weekly ordering cycle (Mondays) | User's operational constraint |
| 2026-03-28 | 7-day site buffer | User requirement - material on site 1 week early |
| 2026-03-28 | Separate common vs brand-specific | Brand unknown for M2-M12 |
| 2026-03-28 | Include Open POs in calculation | Avoid double-ordering |
| 2026-03-28 | Category-based RM classification | BS_, LB_, PM_ = brand-specific |

---

*End of MRP Implementation Plan*
