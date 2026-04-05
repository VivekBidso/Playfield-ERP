# Changelog - Factory OPS

## April 5, 2026

### In-House Production Module - Phase 1 Complete

#### Phase 1B/1C - TechOps UI
- Added "RM Categories" tab to TechOps page
  - Displays 15+ categories with Source Type and BOM Level
  - CRUD operations for managing categories
  - Source Type options: PURCHASED, MANUFACTURED, BOTH
  - BOM Level options: L1, L2, L3, L4
- Added "RM BOM" tab to TechOps page
  - Create/Edit/Delete Bill of Materials for manufactured RMs
  - Component management with quantity, UOM, and wastage factor
  - Yield factor configuration
  - Validates RMs exist before creating BOM

#### Phase 1D - RM Repository Enhancement
- Added Source Type filter dropdown to RM Repository page
- Added BOM Level filter dropdown to RM Repository page
- Added Source and Level columns to RM Repository table
- Color-coded badges:
  - MANUFACTURED: Orange badge
  - BOTH: Blue badge
  - PURCHASED: Outline badge
- Updated Excel export to include source_type and bom_level columns

#### Backend Updates
- `/api/raw-materials/by-tags` now supports `source_type` and `bom_level` query parameters
- All 19 API tests passed (100% pass rate)

#### Files Modified
- `/app/frontend/src/pages/TechOps.js` - Added RM Categories and RM BOM tabs
- `/app/frontend/src/pages/RMRepository.js` - Added filters and columns
- `/app/backend/routes/rm_routes.py` - Added new filter parameters

---

## Previous Sessions

### March 2026
- IBT Module Overhaul (100% test pass)
- Global Radix UI Select crash fix
- RM Repository Export feature
- MRP Weekly Planning module
- Pantone Shade Management System
- Clone Bidso SKU feature
- Demand Hub module
