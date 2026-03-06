# Production Planning Module - User Guide

## Overview
The Production Planning module allows you to upload forward-looking production plans and automatically calculate raw material (RM) shortages based on current inventory and BOM (Bill of Materials) requirements.

## Key Features
1. **Monthly Production Plans**: Upload day-wise SKU production quantities
2. **Automatic RM Calculation**: System calculates total RM needs based on BOM
3. **Shortage Analysis**: Identifies which RMs need to be procured
4. **Branch-Level Planning**: Each branch manages its own production plan
5. **Excel Upload/Export**: Easy data import and shortage report export

## How to Use

### Step 1: Prepare Production Plan Excel

**Format Required:**
| Date       | SKU_ID    | Planned_Quantity |
|------------|-----------|------------------|
| 2025-01-15 | SKU001    | 100              |
| 2025-01-16 | SKU001    | 150              |
| 2025-01-15 | SKU002    | 50               |
| 2025-01-20 | SKU003    | 200              |

**Requirements:**
- Date: YYYY-MM-DD format
- SKU_ID: Must exist globally in the system
- Planned_Quantity: Number of units to produce

**Download Template:**
- Click "Template" button to download sample Excel file
- Fill in your production plan data
- Save the file

### Step 2: Upload Production Plan

1. Select your branch from sidebar
2. Go to "Production Planning" page
3. Click "Upload Plan" button
4. Select your Excel file
5. System will:
   - Validate all SKU IDs
   - Create/update production plan entries
   - Group by month automatically
   - Show success/error summary

### Step 3: View Shortage Analysis

Once plan is uploaded:
1. Select month from dropdown
2. System automatically calculates:
   - Total RM requirements (from all SKUs in plan)
   - Current inventory levels
   - Shortage = Required - Available

**Summary Statistics:**
- Total SKUs: Number of unique SKUs in plan
- Units Planned: Total production quantity
- RM Types: Number of different raw materials needed
- RM Shortage: Count of RMs with insufficient stock
- Plan Entries: Number of day-wise entries

### Step 4: Review Shortage Report

**Three Tabs Available:**

#### 1. Shortage Report Tab
- Lists RMs with insufficient stock
- Shows: RM ID, Category, Total Required, Current Stock, Shortage
- Color-coded in red for easy identification
- Export to Excel for procurement team

#### 2. Sufficient Stock Tab
- Lists RMs with adequate stock
- Shows surplus quantity available
- Color-coded in green

#### 3. Plan Details Tab
- Complete day-wise production plan
- Date, SKU ID, Planned Quantity
- Useful for plan review and adjustments

### Step 5: Export Shortage Report

1. Click "Export" button on Shortage Report tab
2. Excel file downloads with:
   - RM ID
   - Category
   - Total Required
   - Current Stock
   - Shortage quantity
3. Share with procurement team for RM ordering

## Example Scenario

**Scenario:** Planning January 2025 production at Unit 1 Vedica

**Production Plan:**
- Jan 15: SKU001 × 100 units
- Jan 16: SKU001 × 150 units
- Jan 20: SKU002 × 50 units

**BOM (Already defined in system):**
- SKU001 requires: INP_001 (2 units), ACC_001 (1 unit)
- SKU002 requires: INP_001 (3 units), ELC_001 (1 unit)

**RM Calculation:**
- INP_001: (100×2) + (150×2) + (50×3) = 650 units needed
- ACC_001: (100×1) + (150×1) = 250 units needed
- ELC_001: (50×1) = 50 units needed

**Current Inventory:**
- INP_001: 500 units (Shortage: 150)
- ACC_001: 300 units (Sufficient, Surplus: 50)
- ELC_001: 30 units (Shortage: 20)

**Action Required:**
- Procure 150 units of INP_001
- Procure 20 units of ELC_001
- ACC_001 has sufficient stock

## Important Notes

### Prerequisites
1. **Global SKUs must exist**: All SKUs in plan must be created globally
2. **BOM must be defined**: SKU-to-RM mappings must exist
3. **SKUs activated in branch**: SKUs must be active in the selected branch
4. **RMs activated in branch**: All BOM RMs should be activated (happens automatically when SKU is activated)

### Calculation Logic
- System uses **current inventory snapshot** at time of analysis
- Does **not** account for:
  - Future planned purchases
  - In-transit inventory
  - Work-in-progress
- Shortage = Total Required - Current Stock (if negative, it's a shortage)

### Multiple Plans
- You can have plans for different months
- Each month is independent
- Updating a plan for existing month will:
  - Update existing date+SKU entries
  - Add new entries
  - Keep other entries unchanged

### Delete Plan
- Click trash icon next to month selector
- Deletes entire month's plan
- Cannot be undone
- Does not affect actual inventory

## Best Practices

1. **Weekly Planning**: Upload plans on a weekly basis for better accuracy
2. **Buffer Stock**: Maintain 10-15% buffer for unexpected demand
3. **Regular Updates**: Update plan as orders change
4. **Cross-Verify**: Compare shortage report with procurement status
5. **Multiple Scenarios**: Create plans for different months to plan ahead

## API Endpoints (For Integration)

```
POST /api/production-plans/bulk-upload
GET /api/production-plans?branch=X&plan_month=YYYY-MM
GET /api/production-plans/shortage-analysis?branch=X&plan_month=YYYY-MM
GET /api/production-plans/months?branch=X
DELETE /api/production-plans/{plan_month}?branch=X
```

## Troubleshooting

**Error: "SKU not found"**
- Ensure SKU exists globally
- Check SKU ID spelling in Excel

**Error: "RM not active in branch"**
- Activate the SKU in your branch
- This will auto-activate BOM RMs

**Shortage analysis not showing**
- Ensure you have selected a month
- Check if plan was uploaded successfully
- Verify BOM mappings exist for SKUs

**Excel upload failed**
- Check file format (must be .xlsx or .xls)
- Verify columns: Date, SKU_ID, Planned_Quantity
- Ensure dates are in YYYY-MM-DD format
- Check quantities are numbers
