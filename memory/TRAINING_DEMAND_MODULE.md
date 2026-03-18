# Demand Module - Training Guide

## Overview

The **Demand Module** manages demand forecasting and connects forecasts to dispatch planning. It's the starting point for the entire production planning cycle.

**Target Users:** Demand Planners, Master Admins

**Access Path:** Login → Demand Forecasts (sidebar)

---

## Module Sections

### 1. Dashboard Tab

**Purpose:** Overview of forecast status and metrics

**Key Metrics:**
- Total Forecasts (Draft, Confirmed, Converted)
- Forecast Quantity by Month
- Top SKUs by Demand
- Buyer-wise Distribution

---

### 2. Forecasts Tab

**Purpose:** Create and manage demand forecasts

**Data Fields:**
| Field | Description | Required |
|-------|-------------|----------|
| Forecast Code | Auto-generated (e.g., FC_202603_0001) | Auto |
| Month | Forecast month (YYYY-MM) | Yes |
| Buyer | Customer name | Yes |
| SKU ID | Product SKU | Yes |
| Quantity | Forecasted demand | Yes |
| Vertical | Product vertical | Auto-filled from SKU |
| Brand | Product brand | Auto-filled from SKU |
| Model | Product model | Auto-filled from SKU |
| Priority | LOW / MEDIUM / HIGH | Optional |
| Status | DRAFT / CONFIRMED / CONVERTED | Auto |

**Status Flow:**
```
DRAFT → CONFIRMED → CONVERTED
  ↓         ↓           ↓
Created   Approved   Linked to
          by Admin   Dispatch Lot
```

---

## Key Actions

### Creating a Single Forecast

```
Step 1: Click "New Forecast" button
Step 2: Fill the form:
   - Select Month (future month)
   - Select Buyer (from dropdown)
   - Select SKU (searchable dropdown)
   - Enter Quantity
   - Set Priority (optional)
Step 3: Click "Save"
Step 4: Forecast created with DRAFT status
```

### Bulk Upload Forecasts

```
Step 1: Click "Template" to download Excel format
Step 2: Fill Excel with forecast data:
   
   | Month   | SKU ID       | Qty  | Buyer          |
   |---------|--------------|------|----------------|
   | 2026-04 | CC_KS_BE_188 | 1000 | Test Buyer Inc |
   | 2026-04 | CC_KS_BE_189 | 500  | ABC Toys Inc   |

Step 3: Click "Bulk Upload" → Select file
Step 4: Review preview:
   - Green rows = Valid (will be uploaded)
   - Red rows = Errors (need fixing)
Step 5: If errors exist:
   - Click "Download Error Report" 
   - Fix issues in Excel
   - Re-upload
Step 6: Click "Upload" to create all valid forecasts
```

**Required Columns:** Month, SKU ID, Qty, Buyer
**Optional Columns:** Vertical, Brand, Model (auto-filled from SKU master)

---

### Confirming Forecasts

**Who can confirm:** Only Master Admin

```
Step 1: Select forecasts using checkboxes
Step 2: Click "Confirm Selected"
Step 3: Status changes: DRAFT → CONFIRMED
```

**Note:** Only CONFIRMED forecasts can be used for production planning.

---

### Exporting Forecasts

**Purpose:** Export data for dispatch lot creation or analysis

```
Step 1: Click "Export Forecasts" button
Step 2: Apply filters:
   - Date Range (Start/End Month)
   - Buyer
   - Brand
   - Model
   - Status
Step 3: Click "Download Excel"
Step 4: Excel includes:
   - Forecast No, Month, Buyer
   - SKU details, Quantities
   - Available Qty (for dispatch planning)
```

---

### Viewing Linked Dispatch Lots

**Purpose:** See which dispatch lots are linked to a forecast

```
Step 1: Find the forecast in the table
Step 2: Click on the Forecast ID (blue link)
Step 3: Dialog shows:
   - All linked dispatch lots
   - Lot status, quantities
   - Line-item details
```

---

## Forecast Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. DEMAND PLANNER creates forecast                         │
│     - Single entry or Bulk upload                           │
│     - Status = DRAFT                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2. MASTER ADMIN reviews and confirms                       │
│     - Validates quantities and buyers                       │
│     - Status = CONFIRMED                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  3. LOGISTICS creates Dispatch Lot from forecast            │
│     - Links forecast to dispatch lot                        │
│     - Status = CONVERTED                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  4. CPC PLANNER creates Production Schedule                 │
│     - Plans production to fulfill dispatch lot              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tips & Best Practices

1. **Use Bulk Upload** for monthly forecast planning
2. **Verify Buyer names** match exactly with master data
3. **Check SKU availability** before creating forecasts
4. **Export before month-end** to plan next month's production
5. **Use filters** to focus on specific buyers or products

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "SKU ID not detected" | SKU doesn't exist in master | Verify SKU ID spelling |
| "Buyer not found" | Buyer name mismatch | Check exact buyer name in Tech Ops |
| "0 uploaded, X failed" | Missing required columns | Ensure Buyer column is filled |
| UI freezes on re-upload | Browser cache issue | Refresh page, try again |

---

## Integration Points

| Module | Integration |
|--------|-------------|
| **Tech Ops** | Uses Buyers, SKUs, Verticals, Models |
| **Dispatch Lots** | Forecasts linked to dispatch lots |
| **CPC** | Production scheduled from confirmed forecasts |

---

## Reports Available

1. **Forecast Summary** - By month, buyer, or SKU
2. **Export to Excel** - Full forecast data with filters
3. **Error Report** - Download failed rows from bulk upload

---

*Document Version: 1.0*
*Last Updated: March 2026*
