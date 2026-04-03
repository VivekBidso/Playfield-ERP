# RM Inward Entry

**Route**: `/rm-inward`  
**Access**: MASTER_ADMIN, BRANCH_OPS_USER, PROCUREMENT_OFFICER, FINANCE_VIEWER  
**Frontend**: `/app/frontend/src/pages/RMInward.js`

---

## Overview

Finance-focused module for recording incoming raw material bills/invoices. Creates purchase entries and automatically updates branch inventory.

---

## Key Features

### Bill Entry Dialog
- Vendor selection with search/filter (datalist)
- Bill number, Order number
- Bill date, Due date (auto-calculated from payment terms)
- Payment terms: Net 15/30/45/60, Due on Receipt, Custom
- Accounts Payable selection
- Reverse charge checkbox

### Line Items Table
- RM ID search with auto-complete
- Auto-populated fields when RM selected:
  - Description (from category rules)
  - HSN code (default by category)
  - GST rate (default by category)
- Quantity, Rate, Tax selection
- Amount auto-calculated

### Totals Section
- Sub Total
- Discount (% or amount)
- TDS/TCS deduction
- Tax Total
- Grand Total

### Auto-Processing
- Creates `purchase_entries` for each line item
- Updates `branch_rm_inventory`
- Records `rm_stock_movements`

---

## HSN/GST Defaults by Category

| Category | HSN Code | Default GST |
|----------|----------|-------------|
| INP | 3926 | 18% |
| INM | 7326 | 18% |
| ACC | 8714 | 18% |
| ELC | 8544 | 18% |
| LB | 4821 | 12% |
| PM | 4819 | 12% |
| BS | 4911 | 5% |
| SP | 8714 | 18% |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rm-inward/bills` | Create bill with line items |
| GET | `/api/rm-inward/bills` | List bills |
| GET | `/api/vendors` | Vendor list for dropdown |
| GET | `/api/raw-materials` | RM list for search |
| GET | `/api/purchase-entries` | Legacy entry list |

---

## Bill Data Structure

```json
{
  "vendor_id": "uuid",
  "vendor_name": "string",
  "branch": "Unit 1 Vedica",
  "branch_id": "BR_001",
  "bill_number": "INV-2026-001",
  "order_number": "PO-001",
  "bill_date": "2026-04-03",
  "due_date": "2026-05-03",
  "payment_terms": "NET_30",
  "accounts_payable": "Trade Payables",
  "reverse_charge": false,
  "line_items": [
    {
      "rm_id": "INP_654",
      "description": "Battery Cover",
      "hsn": "3926",
      "quantity": 100,
      "rate": 25.50,
      "tax": "GST_18",
      "amount": 2550
    }
  ],
  "totals": {
    "sub_total": 2550,
    "discount_type": "percentage",
    "discount_value": 5,
    "discount_amount": 127.50,
    "tds_tcs": "TDS_2",
    "grand_total": 2833.05
  }
}
```

---

## Database Collections

- `rm_inward_bills` - Bill headers
- `purchase_entries` - Line item entries
- `branch_rm_inventory` - Inventory updates
- `rm_stock_movements` - Stock movement log
- `vendors` - Vendor master

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/RMInward.js`
- **Backend**: `/app/backend/routes/vendor_routes.py`

