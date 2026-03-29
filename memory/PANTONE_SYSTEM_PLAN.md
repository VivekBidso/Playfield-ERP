# Pantone Shade Management System - Implementation Plan

**Created**: March 29, 2026  
**Status**: SAVED FOR FUTURE IMPLEMENTATION  
**Trigger**: "implement Pantone system" or "implement Pantone management"

---

## Overview

Replace vendor-specific Master Batch codes with universal Pantone shade references for INP, INM, and ACC raw materials. This enables vendor-agnostic BOM management and easy vendor switching.

---

## User Clarifications

| Question | Answer |
|----------|--------|
| Scope of Pantone | **INP, INM, ACC** categories |
| Approval Workflow | **QC team** approves master batches |
| Existing Data Migration | User has mapping; prepare import template |
| Design Team Access | **Separate sidebar menu** in Demand Planner role |
| Vendor Pricing | **Master Batch level** (vendor-specific) |

---

## Data Model

### 1. New Collection: `pantone_shades`

```javascript
{
  id: "uuid",
  pantone_code: "485 C",               // Official Pantone reference (unique)
  pantone_name: "Bright Red",          // Descriptive name
  color_hex: "#DA291C",                // For UI color preview
  color_family: "RED",                 // RED, BLUE, GREEN, YELLOW, ORANGE, PURPLE, PINK, BROWN, BLACK, WHITE, GREY, METALLIC
  applicable_categories: ["INP", "INM", "ACC"],  // Categories where this shade applies
  status: "ACTIVE",                    // ACTIVE, DEPRECATED
  notes: "Used for Blaze model trims",
  
  // Audit
  created_by: "user_id",
  created_at: "datetime",
  updated_by: "user_id",
  updated_at: "datetime"
}

// Indexes
// - pantone_code: unique
// - color_family: for filtering
// - applicable_categories: for filtering
// - status: for filtering
```

### 2. New Collection: `pantone_vendor_masterbatch`

```javascript
{
  id: "uuid",
  pantone_id: "uuid",                  // FK to pantone_shades
  pantone_code: "485 C",               // Denormalized for display
  vendor_id: "uuid",                   // FK to vendors
  vendor_name: "Colortech India",      // Denormalized for display
  master_batch_code: "CT-RED-485",     // Vendor's internal code (unique per vendor)
  
  // Approval Workflow (QC Team)
  approval_status: "APPROVED",         // PENDING, APPROVED, REJECTED, DEPRECATED
  submitted_by: "user_id",
  submitted_at: "datetime",
  reviewed_by: "user_id",              // QC team member
  reviewed_at: "datetime",
  rejection_reason: "string",
  
  // Quality Documentation
  lab_report_url: "string",            // Color delta E report document
  delta_e_value: 0.8,                  // Color difference measurement (lower is better, <1 is excellent)
  sample_batch_number: "string",
  color_matching_date: "datetime",
  
  // Operational Flags
  is_preferred: true,                  // Primary vendor for this shade (only 1 per pantone)
  is_active: true,                     // Can be used for new orders
  
  // Pricing (at Master Batch level as per user requirement)
  // Note: Actual pricing stored in vendor_rm_prices collection
  
  // Lead Time & MOQ (can override RM defaults)
  lead_time_days: 14,
  moq: 100,
  batch_size: 25,
  
  // Audit
  created_at: "datetime",
  updated_at: "datetime"
}

// Indexes
// - pantone_id + vendor_id: unique (one master batch per vendor per pantone)
// - master_batch_code + vendor_id: unique
// - approval_status: for filtering
// - is_preferred: for quick lookup
```

### 3. Changes to Existing Collections

#### `raw_materials` (INP, INM, ACC categories)
```javascript
{
  // Existing fields...
  rm_id: "INP_001",
  name: "Body Shell - Red",
  category: "INP",
  
  // NEW: Add Pantone reference (for INP, INM, ACC)
  pantone_id: "uuid",                  // FK to pantone_shades (nullable for non-color RMs)
  pantone_code: "485 C",               // Denormalized for display
  
  // EXISTING: Master batch - now resolved at PO time
  master_batch_code: "CT-RED-485",     // Default/last used master batch (for backward compatibility)
  default_vendor_id: "uuid",           // Preferred vendor for this RM
}
```

#### `common_bom` / `brand_specific_bom`
```javascript
{
  // Existing fields...
  rm_id: "INP_001",
  
  // NEW: Pantone reference for color parts
  pantone_id: "uuid",                  // Optional, for INP/INM/ACC items
  pantone_code: "485 C",               // Denormalized
  
  // Note: At production/PO time, system resolves to specific master_batch based on:
  // 1. Preferred vendor
  // 2. User selection in Weekly PO
}
```

#### `purchase_order_lines`
```javascript
{
  // Existing fields...
  rm_id: "INP_001",
  
  // NEW: Full traceability
  pantone_id: "uuid",
  pantone_code: "485 C",
  master_batch_code: "CT-RED-485",     // Actual master batch ordered
  vendor_masterbatch_id: "uuid",       // FK to pantone_vendor_masterbatch
}
```

#### `vendor_rm_prices`
```javascript
{
  // Existing fields...
  vendor_id: "uuid",
  rm_id: "INP_001",
  
  // NEW: Link to master batch for color RMs
  pantone_vendor_masterbatch_id: "uuid",  // FK (nullable)
  master_batch_code: "CT-RED-485",        // For quick reference
  
  // Pricing remains at this level (vendor-specific)
  unit_price: 450.00,
  currency: "INR",
  // ...
}
```

---

## UI Components

### 1. TechOps → "Pantone Library" Tab

**Location**: New tab in TechOps page (after Models, Buyers, etc.)

**Features**:
- Pantone shade CRUD with color preview
- Vendor-Master Batch mapping per Pantone
- Approval status tracking (Pending → Approved/Rejected)
- Bulk import from Excel
- Filter by category, color family, status
- Set preferred vendor per Pantone

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ PANTONE LIBRARY                          [+ Add Pantone] [Bulk Import] │
├─────────────────────────────────────────────────────────────────────────┤
│ Search: [________] Category: [All ▼] Color Family: [All ▼] Status: [●] │
├─────────────────────────────────────────────────────────────────────────┤
│ COLOR │ PANTONE   │ NAME         │ CATEGORIES  │ VENDORS │ STATUS      │
│ ■■■■  │ 485 C     │ Bright Red   │ INP, INM    │ 3       │ ● ACTIVE    │
│ ■■■■  │ 2728 C    │ Royal Blue   │ INP, ACC    │ 2       │ ● ACTIVE    │
│ ■■■■  │ 360 C     │ Grass Green  │ INP, INM    │ 4       │ ● ACTIVE    │
│ ■■■■  │ 123 C     │ Sunshine     │ ACC         │ 1       │ ○ PENDING   │
└─────────────────────────────────────────────────────────────────────────┘

[Click row to expand]
┌─────────────────────────────────────────────────────────────────────────┐
│ ■■■■ Pantone 485 C - Bright Red                      [Edit] [Add Vendor]│
│ Categories: INP, INM, ACC                                               │
│ Notes: Primary red color for Blaze and Speedster models                 │
├─────────────────────────────────────────────────────────────────────────┤
│ APPROVED VENDORS & MASTER BATCHES:                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ PREF │ VENDOR          │ MASTER BATCH │ ΔE   │ STATUS   │ ACTIONS  │ │
│ │  ★   │ Colortech India │ CT-RED-485   │ 0.8  │ APPROVED │ [Edit]   │ │
│ │      │ Plastimix Ltd   │ PM-485-A     │ 1.2  │ APPROVED │ [Edit]   │ │
│ │      │ NewColor Co     │ NC-RD-01     │ 2.1  │ PENDING  │ [Review] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ★ = Preferred Vendor (used by default in MRP/PO)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Demand Planner → "Color Development" Sidebar Menu

**Location**: New sidebar item for Demand Planner role

**Features**:
- Request new Pantone shade development
- Track development status
- View which models/SKUs use which Pantone
- Request additional vendor sourcing for existing Pantone

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ COLOR DEVELOPMENT                              [+ Request New Color]    │
├─────────────────────────────────────────────────────────────────────────┤
│ MY REQUESTS                                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Pantone 7620 C │ Requested: Mar 15 │ Status: VENDOR DEVELOPMENT    │ │
│ │ Pantone 7541 C │ Requested: Mar 10 │ Status: QC APPROVAL PENDING   │ │
│ │ Pantone 2925 C │ Requested: Feb 28 │ Status: APPROVED ✓            │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ PANTONE USAGE BY MODEL                                                  │
│ [Search Model: ________]                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ MODEL    │ PANTONE SHADES USED                                      │ │
│ │ Blaze    │ ■ 485 C, ■ 2728 C, ■ Black 6 C                          │ │
│ │ Speedster│ ■ 485 C, ■ 360 C, ■ 123 C                               │ │
│ │ Tesla    │ ■ 2728 C, ■ 360 C, ■ 7541 C                             │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. RM Repository → Pantone Integration

**Changes to INP/INM/ACC RM forms**:
- Add "Pantone Shade" dropdown (required for color-based RMs)
- Show color preview swatch
- Show approved vendors for selected Pantone
- Auto-suggest vendor based on preferred flag

### 4. BOM Management → Pantone-Based Selection

When adding INP/INM/ACC to BOM:
```
Add RM to BOM
├── Category: [INP ▼]
├── Pantone Shade: [485 C - Bright Red ▼]  ← NEW (shows color swatch)
├── Part Name: [Body Shell]
├── Quantity: [1]
└── [ℹ️ 3 approved vendors available]

Approved Vendors Preview:
├── ★ Colortech India (CT-RED-485) - Preferred
├── Plastimix Ltd (PM-485-A)
└── NewColor Co (NC-RD-01)
```

### 5. MRP Weekly Plan → Pantone Expansion

In Weekly Order Plan, for INP/INM/ACC items:
- Show Pantone code alongside RM details
- Vendor dropdown shows only approved master batches
- Default to preferred vendor
- Operations can override per line

### 6. QC Approval Interface

**Location**: New section in existing QC dashboard or TechOps

**Features**:
- View pending master batch approvals
- Enter Delta E value
- Upload lab report
- Approve/Reject with comments

---

## API Endpoints

### Pantone Shades
```
GET    /api/pantone-shades                    # List all (with filters)
GET    /api/pantone-shades/{id}               # Get single
POST   /api/pantone-shades                    # Create new
PUT    /api/pantone-shades/{id}               # Update
DELETE /api/pantone-shades/{id}               # Soft delete (set DEPRECATED)

GET    /api/pantone-shades/{id}/vendors       # Get all vendor mappings
POST   /api/pantone-shades/bulk-import        # Bulk import from Excel
GET    /api/pantone-shades/export             # Export to Excel
GET    /api/pantone-shades/by-category/{cat}  # Filter by category
```

### Vendor Master Batch Mapping
```
POST   /api/pantone-vendor-masterbatch                    # Add vendor mapping
PUT    /api/pantone-vendor-masterbatch/{id}               # Update mapping
DELETE /api/pantone-vendor-masterbatch/{id}               # Remove mapping

# QC Approval Workflow
GET    /api/pantone-vendor-masterbatch/pending            # Get pending approvals
PUT    /api/pantone-vendor-masterbatch/{id}/approve       # QC approve
PUT    /api/pantone-vendor-masterbatch/{id}/reject        # QC reject
PUT    /api/pantone-vendor-masterbatch/{id}/set-preferred # Set as preferred vendor
```

### Color Development Requests (Design Team)
```
GET    /api/color-development-requests            # List requests
POST   /api/color-development-requests            # Create request
PUT    /api/color-development-requests/{id}       # Update status
GET    /api/color-development-requests/my         # My requests (design team)
```

### Integration Endpoints
```
GET    /api/raw-materials/{id}/pantone-options    # Get available pantone for RM
GET    /api/pantone-shades/{id}/approved-vendors  # Get approved vendors for PO
```

---

## Bulk Import Template

### Sheet 1: Pantone Shades
| pantone_code | pantone_name | color_hex | color_family | categories | notes |
|--------------|--------------|-----------|--------------|------------|-------|
| 485 C | Bright Red | #DA291C | RED | INP,INM,ACC | Blaze primary |
| 2728 C | Royal Blue | #0032A0 | BLUE | INP,ACC | Speedster accent |

### Sheet 2: Vendor Master Batch Mapping
| pantone_code | vendor_code | master_batch_code | is_preferred | delta_e | lead_time_days | moq |
|--------------|-------------|-------------------|--------------|---------|----------------|-----|
| 485 C | VND001 | CT-RED-485 | TRUE | 0.8 | 14 | 100 |
| 485 C | VND002 | PM-485-A | FALSE | 1.2 | 21 | 50 |
| 2728 C | VND001 | CT-BLU-2728 | TRUE | 0.6 | 14 | 100 |

### Sheet 3: RM to Pantone Mapping (Migration)
| rm_id | pantone_code |
|-------|--------------|
| INP_001 | 485 C |
| INP_002 | 2728 C |
| INM_001 | 485 C |

---

## RBAC Permissions

### New Permissions
```
PANTONE_VIEW          - View Pantone library
PANTONE_MANAGE        - Add/Edit/Delete Pantone shades
PANTONE_VENDOR_MANAGE - Add/Edit vendor master batch mappings
PANTONE_APPROVE       - QC approval of master batches (QC Team)
COLOR_REQUEST_CREATE  - Create color development requests (Design/Demand Planner)
COLOR_REQUEST_MANAGE  - Manage all color requests
```

### Role Assignments
| Role | Permissions |
|------|-------------|
| master_admin | All |
| tech_ops_engineer | PANTONE_VIEW, PANTONE_MANAGE, PANTONE_VENDOR_MANAGE |
| quality_inspector | PANTONE_VIEW, PANTONE_APPROVE |
| demand_planner | PANTONE_VIEW, COLOR_REQUEST_CREATE |
| procurement_officer | PANTONE_VIEW |
| branch_user | PANTONE_VIEW |

---

## Implementation Phases

### Phase 1: Foundation (Backend + Basic UI)
1. Create `pantone_shades` collection and API
2. Create `pantone_vendor_masterbatch` collection and API
3. Build "Pantone Library" tab in TechOps
4. Bulk import functionality
5. QC approval workflow

### Phase 2: Integration
1. Add `pantone_id` to `raw_materials`
2. Migration script to link existing INP/INM/ACC to Pantone
3. Update RM Repository UI for Pantone selection
4. Update BOM management for Pantone-based entry

### Phase 3: MRP & PO Integration
1. MRP expands Pantone → Master Batches
2. Weekly PO shows vendor options per Pantone
3. PO lines include Pantone traceability
4. Update pricing lookup to use master batch

### Phase 4: Design Team Tools
1. "Color Development" sidebar menu for Demand Planner
2. Color request workflow
3. Model-Pantone usage view
4. Notifications for status changes

---

## Migration Strategy

### Step 1: Prepare Data
- User provides Excel with: Pantone codes, Vendor mappings, RM-to-Pantone mapping
- Validate data quality

### Step 2: Import Pantone Shades
- Bulk import Pantone codes
- Set categories and color families

### Step 3: Import Vendor Mappings
- Map vendors to Pantone with master batch codes
- Set preferred vendors
- All initially set to APPROVED (existing data)

### Step 4: Link RMs
- Update `raw_materials` with `pantone_id`
- Preserve existing master_batch_code for backward compatibility

### Step 5: Verify
- Spot check random RMs
- Verify BOM expansion
- Test MRP calculation

---

## Notes

- Existing master_batch_code in RMs remains for backward compatibility
- PO generation always records both Pantone and Master Batch for traceability
- Delta E < 1.0 is excellent, 1.0-2.0 is acceptable, > 2.0 needs review
- Only one vendor can be "preferred" per Pantone shade
- Deprecated Pantone shades cannot be used in new BOMs but existing data preserved

---

*Document saved for future implementation.*
*Trigger: "implement Pantone system" or "implement Pantone management"*
