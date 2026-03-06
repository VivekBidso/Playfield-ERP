# Factory Management System - Enhanced Version

## New Features Added

### 1. Multi-Branch System
The system now supports 7 independent branches:
- Unit 1 Vedica
- Unit 2 Trikes
- Unit 3 TM
- Unit 4 Goa
- Unit 5 Emox
- Unit 6 Baabus
- BHDG WH

**How it works:**
- Users select their branch from the sidebar dropdown
- All data entry (RM, SKU, Production, Dispatch) is tied to the selected branch
- Each branch has separate inventory tracking

### 2. Enhanced SKU Fields
SKUs now include comprehensive details:
- **sku_id**: Primary SKU identifier
- **bidso_sku**: Bidso SKU code
- **buyer_sku_id**: Buyer's SKU reference
- **description**: Detailed product description
- **brand**: Brand name
- **vertical**: Product vertical/category
- **model**: Model identifier
- **branch**: Associated branch

### 3. RM Category Classification
Raw Materials are now classified into 7 categories with auto-generated codes:

#### Category: In-house Plastic (INP_)
**Code Format**: INP_001, INP_002, etc.
**Fields**:
- Mould Code
- Model Name
- Part Name
- Colour
- MB (Master Batch)
- Per Unit Weight (grams)
- Unit

#### Category: Accessories (ACC_)
**Code Format**: ACC_001, ACC_002, etc.
**Fields**:
- Type
- Model Name
- Specs
- Colour
- Per Unit Weight (grams)
- Unit

#### Category: Electric Components (ELC_)
**Code Format**: ELC_001, ELC_002, etc.
**Fields**:
- Model
- Type
- Specs
- Per Unit Weight (grams)
- Unit

#### Category: Spares (SP_)
**Code Format**: SP_001, SP_002, etc.
**Fields**:
- Type
- Specs
- Per Unit Weight (grams)
- Unit

#### Category: Brand Assets (BS_)
**Code Format**: BS_001, BS_002, etc.
**Fields**:
- Position
- Type
- Brand
- Buyer SKU
- Per Unit Weight (grams)
- Unit

#### Category: Packaging (PM_)
**Code Format**: PM_001, PM_002, etc.
**Fields**:
- Model
- Type
- Specs
- Brand
- Per Unit Weight (grams)
- Unit

#### Category: Labels (LB_)
**Code Format**: LB_001, LB_002, etc.
**Fields**:
- Type
- Buyer SKU
- Per Unit Weight (grams)
- Unit

### 4. Bulk Upload with Auto-Generated Codes
When uploading RMs via Excel:
1. Specify the category (INP, ACC, ELC, SP, BS, PM, LB) in the first column
2. System automatically generates sequential RM codes (e.g., INP_001, INP_002)
3. Each branch maintains separate sequence numbers

**Excel Format Example for In-house Plastic**:
```
Category | Mould Code | Model Name | Part Name | Colour | MB    | Weight | Unit | Threshold
INP      | MC001      | Model-X    | Handle    | Red    | MB123 | 45.5   | grams| 10
INP      | MC002      | Model-Y    | Base      | Blue   | MB124 | 67.2   | grams| 15
```

### 5. Master Dashboard for Admin
New admin-level dashboard showing:
- **Overall Statistics**: Aggregated data across all branches
- **Branch Breakdown**: Detailed view of each branch
- **Branch Filter**: Filter data by specific branch or view all
- **Tabs**:
  - Overview: Complete branch comparison
  - Inventory: RM and SKU counts per branch
  - Production: Today's production by branch
  - Alerts: Low stock alerts by branch

## How to Use

### For Regular Users:
1. Select your branch from the sidebar
2. All operations (add RM, SKU, production, dispatch) apply to selected branch
3. Dashboard shows branch-specific data

### For Admins:
1. Access **Master Dashboard** from navigation
2. View overall performance across all branches
3. Filter by specific branch or view aggregated data
4. Monitor alerts and production across the organization

### Bulk Upload Process:
1. Go to Raw Materials page
2. Click "Template" to download the upload template
3. Fill in category and category-specific fields
4. Upload Excel file
5. System auto-generates RM codes with proper sequencing

## API Enhancements

All APIs now support branch filtering:
- `GET /api/raw-materials?branch=Unit%201%20Vedica`
- `GET /api/skus?branch=Unit%201%20Vedica`
- `GET /api/dashboard/stats?branch=Unit%201%20Vedica`
- `GET /api/reports/master-dashboard` - Returns all branches

## Database Changes

All collections now include **branch** field:
- raw_materials
- skus
- sku_mappings
- production_entries
- dispatch_entries
- purchase_entries

Raw materials include:
- **category**: RM category code (INP, ACC, ELC, etc.)
- **category_data**: Dynamic JSON object with category-specific fields
