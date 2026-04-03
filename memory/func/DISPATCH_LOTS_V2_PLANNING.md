# Dispatch Lots - New Two-Stage Workflow

**Date**: April 3, 2026  
**Status**: PLANNING (Do not implement until approved)

---

## Overview

The Dispatch Lots system will now have a **two-stage workflow**:

1. **Stage 1 - Demand Team**: Creates dispatch requests (what to ship)
2. **Stage 2 - Finance Team**: Converts to invoice with full billing details (how to bill)

---

## Clarified Requirements

| Question | Answer |
|----------|--------|
| Invoice numbering | Sequential across ALL branches (001, 002, 003...) - to be inserted later |
| Multiple branches per lot | NO - single branch per lot |
| Manufacturing origin | Must preserve where item was manufactured (even if dispatched from different branch) |
| Unit Rate source | **Price Master** (Buyer SKU × Customer ID mapping) |
| HSN/GST source | **SKU Catalog** - Finance team maintains this |
| Source of Supply | Manual selection (not auto from branch) |
| Salesperson | Free text (no master table) |

---

## New Master Data: Price Master

**Purpose**: Maintain customer-specific pricing for each Buyer SKU

### Price Master Structure
```javascript
{
  "id": "uuid",
  "customer_id": "CUST_0001",
  "customer_name": "TVS Motors",
  "buyer_sku_id": "ERW001_TVS",
  "unit_price": 1500.00,
  "currency": "INR",
  "effective_from": "2026-04-01",
  "effective_to": null,  // null = currently active
  "created_by": "demand_planner_id",
  "created_at": "2026-04-01T10:00:00Z"
}
```

### Price Master UI (Demand Team)
- Located in: **SKU Catalog** or new **Price Master** page
- Actions: Create, Edit, View history
- Bulk upload support

---

## HSN/GST in SKU Catalog

**Location**: SKU Management → Buyer SKUs tab

### Fields to Add
| Field | Type | Maintained By |
|-------|------|---------------|
| HSN Code | Text (8 digits) | Finance |
| GST Rate | Dropdown (5%, 12%, 18%, 28%) | Finance |

### Example
```
| Buyer SKU ID | Description      | HSN Code | GST Rate |
|--------------|------------------|----------|----------|
| ERW001_TVS   | Body Cover - TVS | 87141090 | 18%      |
| ERW002_TVS   | Wheel Assembly   | 87149990 | 18%      |
```

---

## Manufacturing Origin Tracking

When Finance selects a dispatch branch, the system must track:

### Line Item Extended Data
```javascript
{
  "buyer_sku_id": "ERW001_TVS",
  "quantity": 100,
  "rate": 1500.00,
  "hsn_code": "87141090",
  "gst_rate": 18,
  "tax_amount": 27000.00,
  "amount": 150000.00,
  
  // Manufacturing Origin (from inventory/production records)
  "manufacturing_origin": {
    "branch_id": "BR_003",
    "branch_name": "Unit 3 Nashik",
    "production_date": "2026-03-15",
    "batch_number": "BATCH-2026-0342"
  }
}
```

This preserves WHERE the item was manufactured even if dispatched from a different warehouse/branch.

---

## Stage 1: Demand Team View

### Purpose
Demand team creates dispatch lot requests specifying what products need to be shipped to which customer.

### Create Dispatch Lot (Dialog or Bulk Upload)

**Fields Required:**
| Field | Type | Description |
|-------|------|-------------|
| Customer ID | Dropdown | Select from Buyers master |
| Buyer SKU ID | Dropdown | Filtered by customer's associated brands |
| Quantity | Number | Units to dispatch |

### Bulk Upload Template
```
| customer_id | buyer_sku_id | quantity |
|-------------|--------------|----------|
| CUST_0001   | ERW001_TVS   | 100      |
| CUST_0001   | ERW002_TVS   | 50       |
| CUST_0002   | TRK001_HERO  | 75       |
```

### Dispatch Lot Status (Demand View)
| Status | Description |
|--------|-------------|
| DRAFT | Created by demand, not yet processed |
| PENDING_FINANCE | Sent to finance for invoicing |
| INVOICED | Finance has created invoice |
| DISPATCHED | Shipment completed |

### Demand Team UI Layout
```
+------------------------------------------------------------------+
| DISPATCH LOTS                              [+ New Lot] [Bulk Upload] |
+------------------------------------------------------------------+
| Search: [____________]     Status: [All ▼]    Customer: [All ▼]  |
+------------------------------------------------------------------+
| LOT ID    | CUSTOMER      | ITEMS | QTY  | STATUS          | DATE |
|-----------|---------------|-------|------|-----------------|------|
| DL-001    | TVS Motors    | 3     | 250  | DRAFT           | 4/3  |
| DL-002    | Hero Electric | 2     | 150  | PENDING_FINANCE | 4/2  |
| DL-003    | Ampere        | 5     | 400  | INVOICED        | 4/1  |
+------------------------------------------------------------------+
```

### Actions Available to Demand Team
- Create new dispatch lot
- Edit DRAFT lots
- Delete DRAFT lots
- View lot details
- Send to Finance (status → PENDING_FINANCE)

---

## Stage 2: Finance Team View

### Purpose
Finance team selects a dispatch lot (or creates new) and completes all invoice/billing details before actual dispatch.

### Invoice Fields (from screenshot analysis)

#### Header Section
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer Name | Dropdown | ✅ | Pre-filled if from demand lot |
| Branch | Dropdown | ✅ | Dispatch from branch (GST impact) |
| Source of Supply | Dropdown | ✅ | **Manual selection** (State) |
| Invoice # | Auto-generated | ✅ | Sequential across all branches (inserted later) |
| Order Number | Text | ❌ | Customer PO reference |
| Invoice Date | Date | ✅ | Defaults to today |
| Terms | Dropdown | ✅ | Due on Receipt, Net 15/30/45/60 |
| Due Date | Date | ✅ | Auto-calculated from terms |
| Accounts Receivable | Dropdown | ✅ | AR account selection |
| Salesperson | Text | ❌ | Free text (no master) |
| Subject | Text | ❌ | Invoice description |

#### Item Table (Pre-filled from Demand Lot + Price Master + SKU Catalog)
| Field | Type | Required | Source |
|-------|------|----------|--------|
| Item Details | Dropdown | ✅ | Buyer SKU (pre-filled from lot) |
| Quantity | Number | ✅ | Pre-filled from lot, editable |
| Rate | Number | ✅ | **Auto from Price Master** (Customer × SKU) |
| HSN | Text | ✅ | **Auto from SKU Catalog** |
| Tax | Dropdown | ✅ | **Auto from SKU Catalog** (GST rate) |
| Amount | Calculated | - | Qty × Rate |
| Mfg Origin | Display | - | Shows manufacturing branch (read-only) |

#### Totals Section
| Field | Type | Description |
|-------|------|-------------|
| Sub Total | Calculated | Sum of line amounts |
| Discount | Number + % toggle | Discount amount or percentage |
| TDS/TCS | Radio + Dropdown | Tax deduction/collection |
| Adjustment | Number | Manual adjustment |
| **Total (₹)** | Calculated | Final invoice amount |

#### Footer Section
| Field | Type | Description |
|-------|------|-------------|
| Customer Notes | Textarea | Shows on invoice |
| Terms & Conditions | Textarea | Legal terms |
| Attachments | File upload | Max 10 files, 10MB each |

### Inventory Check (BLOCKING)
⚠️ **Finance CANNOT proceed if:**
- Selected branch doesn't have sufficient inventory for any line item
- Must either:
  1. Edit quantities in the dispatch lot
  2. Wait for inventory update at the branch
  3. Select a different branch

### Finance Team UI Layout
```
+------------------------------------------------------------------+
| DISPATCH INVOICING                    [+ New Invoice] [From Lot ▼] |
+------------------------------------------------------------------+
| Pending Lots from Demand: [3]                                      |
+------------------------------------------------------------------+

[Invoice Form - Full Width]
+------------------------------------------------------------------+
| Customer Name*: [TVS Motors          ▼] 🔍                        |
| Branch*:        [Unit 1 Vedica       ▼]                           |
|                 Source of Supply: Maharashtra                      |
+------------------------------------------------------------------+
| Invoice #*: [26-27/0004]  Order Number: [__________]              |
| Invoice Date*: [04/04/2026]  Terms: [Net 30 ▼]  Due: [05/04/2026] |
| Accounts Receivable: [Accounts Receivable ▼]                      |
| Salesperson: [Select or Add ▼]                                    |
| Subject: [_______________________________________________]        |
+------------------------------------------------------------------+

[Item Table]
+------------------------------------------------------------------+
| ITEM DETAILS          | QTY   | RATE    | TAX      | AMOUNT      |
|-----------------------|-------|---------|----------|-------------|
| ERW001_TVS - Body..   | 100   | 1500.00 | GST 18%  | 150,000.00  |
| [⚠️ Insufficient stock at branch - Available: 80]                 |
|-----------------------|-------|---------|----------|-------------|
| ERW002_TVS - Wheel..  | 50    | 800.00  | GST 18%  | 40,000.00   |
| [✅ In Stock]                                                      |
+------------------------------------------------------------------+
| [+ Add Row]  [+ Add Items in Bulk]                                |
+------------------------------------------------------------------+
|                                    Sub Total:      190,000.00     |
|                                    Discount: [5] [%]:  9,500.00   |
|                                    ● TDS ○ TCS [2% ▼]:  3,610.00  |
|                                    Adjustment: [______]:    0.00  |
|                                    ─────────────────────────────  |
|                                    Total (₹):      176,890.00     |
+------------------------------------------------------------------+

| Customer Notes:        | Terms & Conditions:       | Attachments: |
| [Thanks for business]  | [Payment within 30 days]  | [Upload ▼]   |
+------------------------------------------------------------------+

[Cancel]                              [Save as Draft] [Create Invoice]
                                      ↑ Disabled if inventory insufficient
+------------------------------------------------------------------+
```

---

## Data Model Changes

### dispatch_lots Collection (Updated)
```javascript
{
  "id": "uuid",
  "lot_number": "DL-2026-0001",
  "customer_id": "CUST_0001",
  "customer_name": "TVS Motors",
  
  // Stage 1 - Demand Team fields
  "created_by_role": "DEMAND_PLANNER",
  "created_by": "user_id",
  "created_at": "2026-04-03T10:00:00Z",
  
  // Status
  "status": "DRAFT | PENDING_FINANCE | INVOICED | DISPATCHED | CANCELLED",
  
  // Line items (simple)
  "lines": [
    { "buyer_sku_id": "ERW001_TVS", "quantity": 100 },
    { "buyer_sku_id": "ERW002_TVS", "quantity": 50 }
  ],
  
  // Stage 2 - Finance Team fields (filled when invoiced)
  "invoice_data": {
    "branch_id": "BR_001",
    "branch_name": "Unit 1 Vedica",
    "source_of_supply": "Maharashtra",
    "invoice_number": "26-27/0004",
    "order_number": "PO-12345",
    "invoice_date": "2026-04-04",
    "payment_terms": "NET_30",
    "due_date": "2026-05-04",
    "accounts_receivable": "Accounts Receivable",
    "salesperson": "John Doe",
    "subject": "April dispatch",
    
    "line_items": [
      {
        "buyer_sku_id": "ERW001_TVS",
        "quantity": 100,
        "rate": 1500.00,
        "tax": "GST_18",
        "tax_amount": 27000.00,
        "amount": 150000.00
      }
    ],
    
    "totals": {
      "sub_total": 190000.00,
      "discount_type": "percentage",
      "discount_value": 5,
      "discount_amount": 9500.00,
      "tds_tcs": "TDS",
      "tds_tcs_rate": 2,
      "tds_tcs_amount": 3610.00,
      "adjustment": 0,
      "grand_total": 176890.00
    },
    
    "customer_notes": "Thanks for your business",
    "terms_conditions": "Payment within 30 days",
    "attachments": []
  },
  
  "invoiced_by": "finance_user_id",
  "invoiced_at": "2026-04-04T14:00:00Z",
  "dispatched_at": null
}
```

---

## Access Control

| Action | DEMAND_PLANNER | FINANCE_VIEWER | MASTER_ADMIN |
|--------|----------------|----------------|--------------|
| View all lots | ✅ | ✅ | ✅ |
| Create lot (simple) | ✅ | ❌ | ✅ |
| Edit DRAFT lot | ✅ | ❌ | ✅ |
| Delete DRAFT lot | ✅ | ❌ | ✅ |
| Send to Finance | ✅ | ❌ | ✅ |
| Create invoice | ❌ | ✅ | ✅ |
| Edit invoice data | ❌ | ✅ | ✅ |
| Mark as dispatched | ❌ | ✅ | ✅ |

---

## API Endpoints (Proposed)

### Demand Team
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatch-lots` | List all lots |
| POST | `/api/dispatch-lots` | Create simple lot |
| PUT | `/api/dispatch-lots/{id}` | Edit draft lot |
| DELETE | `/api/dispatch-lots/{id}` | Delete draft lot |
| POST | `/api/dispatch-lots/{id}/send-to-finance` | Change status |
| POST | `/api/dispatch-lots/bulk-upload` | Bulk create |

### Finance Team
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatch-lots?status=PENDING_FINANCE` | Get pending lots |
| GET | `/api/dispatch-lots/{id}/inventory-check` | Check branch inventory |
| POST | `/api/dispatch-lots/{id}/create-invoice` | Add invoice data |
| PUT | `/api/dispatch-lots/{id}/invoice` | Update invoice |
| POST | `/api/dispatch-lots/{id}/dispatch` | Mark dispatched |

---

## Inventory Check Logic

```python
def check_inventory(lot_id, branch_id):
    lot = get_dispatch_lot(lot_id)
    results = []
    can_proceed = True
    
    for line in lot.lines:
        sku = get_buyer_sku(line.buyer_sku_id)
        branch_stock = get_branch_inventory(branch_id, sku.bidso_sku_id)
        
        available = branch_stock.quantity if branch_stock else 0
        required = line.quantity
        
        results.append({
            "buyer_sku_id": line.buyer_sku_id,
            "required": required,
            "available": available,
            "sufficient": available >= required
        })
        
        if available < required:
            can_proceed = False
    
    return {
        "can_proceed": can_proceed,
        "items": results
    }
```

---

## Questions to Confirm

~~1. Invoice Numbering: Should it be auto-generated per financial year (e.g., 26-27/0001)?~~  
**ANSWERED**: Sequential across all branches, to be inserted later

~~2. Multiple Branches: Can a single lot be dispatched from multiple branches?~~  
**ANSWERED**: NO - single branch, but preserve manufacturing origin

~~3. Rate Source: Where does the unit rate come from?~~  
**ANSWERED**: Price Master (Buyer SKU × Customer ID mapping)

~~4. HSN/GST Source:~~  
**ANSWERED**: SKU Catalog - maintained by Finance

~~5. Salesperson Master:~~  
**ANSWERED**: Free text, no master table

~~6. Source of Supply:~~  
**ANSWERED**: Manual selection (not auto from branch)

---

## Implementation Phases

### Phase 1: Master Data Setup ✅ COMPLETE
1. ✅ Add HSN Code and GST Rate fields to `buyer_skus` collection
2. ✅ Create Price Master collection and API (`/api/price-master`)
3. ✅ Allow Finance to edit HSN/GST via `PUT /api/sku-management/buyer-skus/{id}`
4. ⏳ Add Price Master UI to SKU Catalog (frontend pending)

### Phase 2: Dispatch Lots - Demand Team ✅ COMPLETE
1. ✅ Simplify lot creation (Customer + SKU + Qty only)
2. ✅ Remove forecast linkage (paused)
3. ✅ Add bulk upload for simple format
4. ✅ Add "Send to Finance" action
5. ✅ Frontend UI with Create Lot dialog

### Phase 3: Dispatch Lots - Finance Team ✅ COMPLETE
1. ✅ Create invoice form with all fields
2. ✅ Implement inventory check with blocking
3. ✅ Auto-populate Rate from Price Master (lookup endpoint ready)
4. ✅ Auto-populate HSN/GST from SKU Catalog
5. ✅ Preserve manufacturing origin data
6. ✅ Invoice number placeholder (to be implemented later)

---

## Testing Results (April 3, 2026)

**Backend**: 16/16 tests passed (100%)
**Frontend**: All UI elements verified

### Bugs Fixed During Testing:
1. MongoDB ObjectId serialization in Price Master API
2. fetchBuyerSkus page_size limit (100 max, not 1000)

---

## Backup Reference

Current DispatchLots.js (forecast-linked version) saved at:
`/app/memory/func/DISPATCH_LOTS_BACKUP_V1.js`

