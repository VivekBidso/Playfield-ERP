# MRP v1 Requirements Specification

**Created**: March 28, 2026  
**Source**: Operations Head Requirements  
**Status**: SAVED FOR FUTURE IMPLEMENTATION

---

## Overview

This document captures the comprehensive MRP requirements from the Operations Head. When instructed to "implement MRP v1", use this as the specification.

---

## Requirements List

### 1. Requirement Calculation Formula
```
Total Requirements = Demand × Days
Days = Lead Time + Safety Days + Frozen Window
```

**Current State**: Uses Lead Time only. Safety Stock is qty-based, not days-based. No Frozen Window concept.

**Implementation Needed**:
- Add `safety_days` field to RM parameters
- Add `frozen_window_days` field to RM parameters
- Update MRP calculation: `order_days = lead_time_days + safety_days + frozen_window_days`

---

### 2. Future Demand Fallback
**Requirement**: If system demand not available, assume current daily volumes for calculations. If demand loaded for month, calculate daily need.

**Current State**: Relies on Model-Level Forecasts. No fallback.

**Implementation Needed**:
- Query last 30 days from `dispatch_lots` collection
- Calculate daily average by SKU/Model
- Use as fallback when forecast missing
- Add monthly → daily conversion: `daily_demand = monthly_forecast / working_days_in_month`

---

### 3. Total Inventory Available
```
Total Inventory = Physical on Hand + Transit (High Seas) + Open PO (yet to be dispatched)
```

**Current State**: ✅ ALREADY IMPLEMENTED
- Physical: from `branch_rm_inventory`
- Transit: POs with status SHIPPED, IN_TRANSIT
- Open PO: POs with status DRAFT, ISSUED, ACKNOWLEDGED

---

### 4. Net Requirement
```
Net Requirement = Total Requirements - Inventory
```

**Current State**: ✅ ALREADY IMPLEMENTED
- Formula: `Net = Gross + Safety Stock - Current Stock - Scheduled Receipts`

---

### 5. PO Generation Rules
**Requirement**: PO generated based on MOQ and Batch Size

**Current State**: ✅ ALREADY IMPLEMENTED
- `_apply_lot_sizing` method handles MOQ and batch rounding

---

### 6. Site × RM × Vendor Parameters
**Requirement**: Parameters defined for each unique combo with: LT, MOQ, Batch Size, Active/Inactive status

**Current State**: Single-level RM parameters only. No site or vendor dimension.

**Implementation Needed**:

New Collection: `site_rm_vendor_parameters`
```javascript
{
  id: "uuid",
  site_id: "FACTORY_A",           // Branch/Factory
  rm_id: "ACC_011",
  vendor_id: "VND_001",
  lead_time_days: 14,
  moq: 500,
  batch_size: 100,
  safety_days: 3,
  frozen_window_days: 2,
  is_active: true,
  priority: 1,                     // For vendor selection (1 = primary)
  created_at: "datetime",
  updated_at: "datetime"
}
```

**UI Changes**:
- New "Site-RM-Vendor Parameters" tab in MRP Dashboard
- Bulk import from Excel
- Filter by Site, RM Category, Vendor
- Active/Inactive toggle

---

### 7. Vendor Capacity Correlation
**Requirement**: PO generated for multiple vendors can be correlated to vendor capacity

**Current State**: NOT PLANNED

**Implementation Needed**:

New Collection: `vendor_capacities`
```javascript
{
  id: "uuid",
  vendor_id: "VND_001",
  rm_category: "ACC",              // Or specific rm_id
  daily_capacity_qty: 5000,
  monthly_capacity_qty: 100000,
  capacity_unit: "PCS",
  lead_time_impact_days: 0,        // Additional days if over 80% capacity
  is_active: true
}
```

**MRP Logic**:
- Check: `if order_qty > (daily_capacity × lead_time) then ALERT`
- Option to auto-split order across multiple vendors
- Show capacity utilization % in PO preview

---

### 8. Day-Level MRP with Aggregation
**Requirement**: MRP run shows requirement at Day level, with option to aggregate at Weekly & Monthly buckets

**Current State**: Weekly view only

**Implementation Needed**:
- Add toggle: Day / Week / Month in Weekly Order Plan UI
- Backend: Store day-level data, aggregate on demand
- Day view: Show daily order schedule
- Month view: Consolidate weeks into monthly totals

---

### 9. Planning Horizon
**Requirement**: 6 months outward horizon

**Current State**: ✅ ALREADY IMPLEMENTED (12 months supported)

---

### 10. PO Bucket Options
**Requirement**: PO should have option for daily, weekly, or monthly buckets

**Current State**: Weekly only

**Implementation Needed**:
- Add "PO Bucket" selector: Daily / Weekly / Monthly
- Daily: Generate PO per day
- Weekly: Current behavior
- Monthly: Consolidate all weeks into monthly PO
- Affects order timing and batch sizing

---

### 11. SOQ vs AOQ
**Requirement**: System gives SOQ (Suggested Order Qty), Planner can adjust to AOQ (Actual Order Qty)

**Current State**: ✅ ALREADY IMPLEMENTED
- Excel template has "Suggested Qty" and "Final Qty" columns
- Planner modifies Final Qty before upload

---

### 12. Import Air vs Ship Options
**Requirement**: For imports, option to generate PO with Air freight (lesser LT) vs Ship. System defaults to Ship.

**Current State**: NOT PLANNED

**Implementation Needed**:

Add to `rm_procurement_parameters`:
```javascript
{
  rm_id: "IMP_001",
  is_import: true,
  transit_modes: {
    SEA: {
      lead_time_days: 45,
      cost_multiplier: 1.0,
      is_default: true
    },
    AIR: {
      lead_time_days: 7,
      cost_multiplier: 2.5,
      is_default: false
    }
  }
}
```

**UI Changes**:
- Show "Mode" column in Weekly PO: SEA / AIR toggle
- AIR option shows cost premium warning
- Default to SEA for all imports

---

### 13. Vendor Clubbing
**Requirement**: PO of different RM but single Vendor should be clubbed in one PO

**Current State**: ✅ ALREADY IMPLEMENTED
- Weekly PO Generation groups all RMs by vendor

---

### 14. Zoho Integration
**Requirement**: PO linked to Zoho, system PO automatically flows into Zoho

**Current State**: NOT IMPLEMENTED (Planned as future task)

**Implementation Needed**:
- Use `integration_playbook_expert` for Zoho Books API
- User provides Zoho API credentials
- On "Issue PO" → Auto-create PO in Zoho Books
- Sync status back: Zoho PO Number, Sync Status
- Error handling for failed syncs

---

### 15. Partial RM Receipts
**Requirement**: RM entry against PO should have feasibility of multiple entries with dates (vendor sends stock in partial lots)

**Current State**: `quantity_received` field exists but no date tracking for partials

**Implementation Needed**:

Update `purchase_order_lines`:
```javascript
{
  id: "uuid",
  po_id: "uuid",
  rm_id: "ACC_011",
  quantity_ordered: 1000,
  quantity_received: 600,         // Total received
  receipts: [                      // NEW: Receipt history
    {
      receipt_id: "uuid",
      date: "2026-04-01",
      quantity: 400,
      grn_number: "GRN-2026-001",
      received_by: "user_id"
    },
    {
      receipt_id: "uuid",
      date: "2026-04-05",
      quantity: 200,
      grn_number: "GRN-2026-002",
      received_by: "user_id"
    }
  ],
  status: "PARTIAL_RECEIVED"
}
```

**UI Changes**:
- "Record Receipt" button on PO line
- Dialog: Date, Quantity, GRN Number
- History table showing all receipts

---

### 16. PO Lot Splitting
**Requirement**: PO generated for certain qty should have option to split into lots with different dates. Prevents system thinking entire PO comes in one day (causes overstocking or low inventory signals).

**Current State**: NOT PLANNED

**Implementation Needed**:

Add to `purchase_orders`:
```javascript
{
  id: "uuid",
  po_number: "PO-2026-001",
  vendor_id: "VND_001",
  total_quantity: 3000,
  delivery_schedule: [             // NEW: Lot splitting
    {
      lot_number: 1,
      quantity: 1000,
      expected_date: "2026-04-01",
      status: "PENDING"
    },
    {
      lot_number: 2,
      quantity: 1000,
      expected_date: "2026-04-15",
      status: "PENDING"
    },
    {
      lot_number: 3,
      quantity: 1000,
      expected_date: "2026-04-30",
      status: "PENDING"
    }
  ]
}
```

**MRP Impact**:
- `_get_scheduled_receipts` considers each lot date separately
- Inventory projection shows staggered arrivals
- Prevents false overstocking/shortage alerts

**UI Changes**:
- "Split into Lots" button on PO
- Dialog to define: Number of lots, Qty per lot, Dates
- Delivery schedule table view

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P0** | #6 Site × RM × Vendor Parameters | High | Critical for multi-site |
| **P0** | #16 PO Lot Splitting | Medium | Inventory accuracy |
| **P1** | #1 Safety Days + Frozen Window | Low | Better calculations |
| **P1** | #15 Partial Receipt Tracking | Low | GRN history |
| **P1** | #8/#10 Day/Week/Month Toggle | Medium | User flexibility |
| **P2** | #7 Vendor Capacity | Medium | Prevents over-ordering |
| **P2** | #12 Air vs Ship Modes | Medium | Import planning |
| **P2** | #2 Demand Fallback | Low | Missing forecast handling |
| **P3** | #14 Zoho Integration | High | External API dependency |

---

## Data Model Changes Summary

### New Collections
1. `site_rm_vendor_parameters` - Multi-dimensional parameters
2. `vendor_capacities` - Capacity tracking

### Modified Collections
1. `rm_procurement_parameters` - Add: safety_days, frozen_window_days, is_import, transit_modes
2. `purchase_orders` - Add: delivery_schedule array
3. `purchase_order_lines` - Add: receipts array

### New API Endpoints
1. CRUD for `site_rm_vendor_parameters`
2. CRUD for `vendor_capacities`
3. POST `/api/po/{id}/split-lots`
4. POST `/api/po-lines/{id}/record-receipt`
5. Zoho sync endpoints

---

## UI Changes Summary

1. **New Tab**: "Site-RM-Vendor Parameters" in MRP Dashboard
2. **New Tab**: "Vendor Capacities" management
3. **Toggle**: Day / Week / Month view in Weekly Order Plan
4. **Toggle**: PO Bucket selector (Daily/Weekly/Monthly)
5. **Button**: "Split into Lots" on PO detail
6. **Button**: "Record Receipt" on PO lines
7. **Column**: Air/Ship toggle for import RMs
8. **Dialog**: Lot splitting configuration
9. **Dialog**: Receipt entry form
10. **View**: Delivery schedule table
11. **View**: Receipt history table

---

## Notes

- All existing functionality must be preserved
- Migration scripts needed for data model changes
- Bulk import Excel templates for new parameters
- Consider backward compatibility for existing POs

---

*Document saved for future implementation. Trigger with: "implement MRP v1"*
