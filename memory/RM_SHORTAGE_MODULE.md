# RM Shortage Report Module

**Version**: 1.0  
**Last Updated**: April 4, 2026  
**Status**: ACTIVE

---

## Overview

The RM Shortage Report provides visibility into raw material shortages based on production schedules and Bill of Materials (BOM). It helps Branch Ops and Procurement teams proactively identify and address material shortages.

---

## Access

| Role | Access | Branch Filter |
|------|--------|---------------|
| Master Admin | Full access, all branches | Dropdown to filter |
| Branch Ops | Own assigned branches | Auto-filtered |
| Procurement Officer | All branches | Dropdown to filter |

**Sidebar Location**: RM Shortage (after Branch Ops)

**URL**: `/rm-shortage`

---

## How It Works

### Calculation Logic

```
Today: April 4th
Selected Range: April 10-15

Step 1: Get current RM stock (as of today)
Step 2: Calculate INTERIM consumption (April 4-9) from production schedules + BOM
Step 3: Calculate PERIOD requirement (April 10-15) from production schedules + BOM
Step 4: Projected Stock = Current Stock - Interim Consumption
Step 5: Shortage = Projected Stock - Period Requirement
        (Negative = shortage, Positive = surplus)
```

### BOM Calculation

BOM = `common_bom` (via `bidso_sku_id`) + `brand_bom` (via `buyer_sku_id`) merged

- Production schedules are at **Buyer SKU** level
- Each Buyer SKU links to a Bidso SKU for common BOM
- Brand-specific BOM items are added/merged on top

---

## Features

### Filters
- **Branch**: Dropdown for admin/procurement, auto-set for branch ops
- **From Date**: Start of analysis period (default: today)
- **To Date**: End of analysis period (default: today + 7 days)
- **Search**: Filter by RM ID, description, category

### Summary Cards
- **Total RMs Analyzed**: Count of RMs with requirements in period
- **RMs in Shortage**: Count of RMs where shortage < 0
- **Branches with Shortage**: (Admin/Procurement only) Count of branches having shortages

### Data Table
| Column | Description |
|--------|-------------|
| Branch | Branch name (shown when viewing all branches) |
| RM ID | Raw material identifier |
| Description | RM description |
| Unit | Unit of measurement |
| Current Stock | Stock as of today |
| Interim Consumption | RM needed for production between today and start date |
| Projected Stock | Current Stock - Interim Consumption |
| Period Requirement | RM needed for selected date range |
| Shortage | Projected Stock - Period Requirement (negative = shortage) |

### Export
- **Export to Excel**: Downloads full report with all columns
- Shortage rows are highlighted in red in the Excel file

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rm-shortage-report` | GET | Get shortage report (JSON) |
| `/api/rm-shortage-report/export` | GET | Download Excel report |

### Parameters
- `branch` (optional): Filter by branch name
- `start_date` (optional): Start date (YYYY-MM-DD), default today
- `end_date` (optional): End date (YYYY-MM-DD), default today + 7 days

---

## Files

| File | Purpose |
|------|---------|
| `/app/backend/routes/branch_ops_routes.py` | API endpoints |
| `/app/frontend/src/pages/RMShortage.js` | Frontend page |

---

## Example Response

```json
{
  "branch": "Unit 1 Vedica",
  "start_date": "2026-04-10",
  "end_date": "2026-04-15",
  "interim_period": "2026-04-04 to 2026-04-09",
  "data": [
    {
      "rm_id": "SP_080",
      "description": "Seat Plastic Blue",
      "unit": "nos",
      "category": "SP",
      "current_stock": 70,
      "interim_consumption": 0,
      "projected_stock": 70,
      "period_requirement": 118480,
      "shortage": -118410,
      "is_shortage": true
    }
  ],
  "summary": {
    "total_rms": 202,
    "rms_in_shortage": 116,
    "total_shortage_value": 500000
  }
}
```

---

## Future Enhancements

- P2: Link to PO creation from shortage rows
- P2: Email alerts for critical shortages
- P3: Trend analysis over time

---

*Document created: April 4, 2026*
