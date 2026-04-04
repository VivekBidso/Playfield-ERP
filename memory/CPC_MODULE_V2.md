# CPC Module v2 - MVP Specification

**Version**: 2.0 (Simplified for MVP)  
**Last Updated**: April 4, 2026  
**Status**: ACTIVE

---

## Overview

The CPC (Central Production Control) module manages production planning and scheduling across all manufacturing branches. This v2 simplifies the workflow by removing forecast dependencies and MRP integration for MVP.

---

## Module Access

**Roles with Access:**
- Master Admin
- CPC Planner

**Sidebar Location:** CPC

**URL:** `/cpc`

---

## Tabs & Features

### Tab 1: Production Planning

**Purpose:** Upload and manage production schedules directly using Buyer SKU IDs.

#### Upload Format (Simplified)
| Column | Description | Example |
|--------|-------------|---------|
| Branch ID | Branch identifier from branches collection | BR_001 |
| Date | Target production date (YYYY-MM-DD) | 2026-04-10 |
| Buyer SKU ID | Buyer SKU identifier | KM_SC_BN_001 |
| Quantity | Production quantity | 100 |

#### Key Changes from v1:
- **Removed**: Forecast Code column (no longer linked to forecasts)
- **Removed**: Priority column (defaults to MEDIUM)
- **Added**: Direct Buyer SKU ID input

#### Buttons:
| Button | Action |
|--------|--------|
| Download Template | Downloads Excel template with valid Branch IDs and Buyer SKU IDs |
| Upload Plan | Bulk upload production schedules from Excel |

#### Upload Validation:
1. Branch ID must exist in `branches` collection
2. Buyer SKU ID must exist in `buyer_skus` collection with status ACTIVE
3. Quantity must be > 0
4. Date must be valid format (YYYY-MM-DD)
5. Branch capacity checked (if exceeded, shows warning)

#### API Endpoints:
```
GET  /api/cpc/production-plan/template  - Download Excel template
POST /api/cpc/production-plan/upload-excel - Bulk upload schedules
```

---

### Tab 2: Branch Capacity

**Purpose:** Manage daily production capacity for each branch.

#### Features:
1. **Default Capacity**: Set default units/day per branch
2. **Day-wise Override**: Upload daily capacity overrides by date

#### Day-wise Capacity Upload Format:
| Column | Description | Example |
|--------|-------------|---------|
| Branch | Branch name | Unit 1 Vedica |
| Date | Date (YYYY-MM-DD) | 2026-04-10 |
| Capacity | Units per day | 500 |

#### API Endpoints:
```
GET  /api/branches - List all branches with capacity
PUT  /api/branches/{branch_id}/capacity - Update default capacity
GET  /api/branches/daily-capacity/template - Download capacity template
POST /api/branches/daily-capacity/upload - Bulk upload daily capacity
```

---

### Tab 3: Production Schedule

**Purpose:** View per-day production schedules by branch.

#### Features:
1. **Date Range Filter**: Select start and end date
2. **Branch Filter**: Filter by specific branch or all
3. **Capacity Display**: Shows daily capacity vs scheduled
4. **Utilization**: Visual progress bar of capacity usage

#### Schedule Card Display:
- Branch name and date
- Capacity source (default or daily override)
- Total scheduled quantity
- Utilization percentage
- Individual schedule items with SKU, quantity, and status

#### API Endpoints:
```
GET /api/cpc/branch-schedules?start_date=X&end_date=Y&branch=Z
```

---

## Data Models

### Production Schedule
```json
{
  "id": "uuid",
  "schedule_code": "PS_202604_0001",
  "forecast_id": null,
  "dispatch_lot_id": null,
  "branch": "Unit 1 Vedica",
  "sku_id": "KM_SC_BN_001",
  "sku_description": "Kidsmate Scooter Bentley",
  "target_quantity": 100,
  "allocated_quantity": 100,
  "completed_quantity": 0,
  "target_date": "2026-04-10T00:00:00Z",
  "priority": "MEDIUM",
  "status": "SCHEDULED",
  "notes": "Bulk upload",
  "created_at": "2026-04-04T05:30:00Z"
}
```

### Branch Daily Capacity
```json
{
  "branch": "Unit 1 Vedica",
  "date": "2026-04-10",
  "capacity": 500,
  "notes": "Holiday reduced capacity",
  "created_at": "2026-04-04T05:30:00Z"
}
```

---

## Schedule Status Flow

```
SCHEDULED -> IN_PROGRESS -> COMPLETED
                        \-> CANCELLED
```

| Status | Description |
|--------|-------------|
| SCHEDULED | Created, awaiting production start |
| IN_PROGRESS | Production started, partially completed |
| COMPLETED | Fully completed |
| CANCELLED | Cancelled by user |

---

## Removed Features (Deferred to Future)

### 1. Forecast Linking
- **What**: Production schedules linked to demand forecasts
- **Status**: Removed for MVP
- **Future**: Will be re-added when forecast module is enhanced

### 2. Priority Selection
- **What**: HIGH, MEDIUM, LOW, CRITICAL priority on schedules
- **Status**: Defaults to MEDIUM
- **Future**: Can be added back via UI enhancement

### 3. MRP Integration
- **What**: Material Requirements Planning with automatic RM shortage detection
- **Status**: Rolled back for MVP
- **Documentation**: Preserved at `/app/memory/MRP_V1_REQUIREMENTS.md`
- **Future**: Will be implemented as separate module

### 4. Transfer SKU (Dashboard)
- **What**: Inter-branch SKU transfer from dashboard
- **Status**: Removed from dashboard
- **Alternative**: Use IBT Transfers page for inter-branch transfers

---

## Files Reference

### Backend
| File | Purpose |
|------|---------|
| `/app/backend/routes/cpc_routes.py` | All CPC endpoints |
| `/app/backend/models/transactional.py` | ProductionSchedule model |

### Frontend
| File | Purpose |
|------|---------|
| `/app/frontend/src/pages/CPC.js` | Main CPC page component |

---

## Template Reference Sheets

The production plan template includes 2 reference sheets:

### Sheet 1: Branches Reference
| Branch ID | Branch Name | Capacity/Day |
|-----------|-------------|--------------|
| BR_001 | Unit 1 Vedica | 1000 |
| BR_002 | Unit 2 Trikes | 800 |

### Sheet 2: Buyer SKUs Reference
| Buyer SKU ID | Name |
|--------------|------|
| KM_SC_BN_001 | Kidsmate Scooter Bentley |
| KM_RO_BT_002 | Kidsmate Rideon Batmobile |

---

## Changelog

### v2.0 (April 4, 2026) - MVP Simplification
- Removed forecast linking from production schedule upload
- Removed priority column from upload (defaults to MEDIUM)
- Simplified upload format to: Branch ID | Date | Buyer SKU ID | Quantity
- Removed MRP Planning from sidebar
- Removed Transfer SKU button from dashboard
- Added reference sheets to Excel template

### v1.0 (March 2026) - Initial
- Full forecast-based production planning
- MRP integration
- Priority-based scheduling

---

*Document maintained by: CPC Module Team*
