# Raw Material Auto-Generated IDs & Category Templates

## Overview
The Raw Materials module now features:
1. **Auto-generated RM IDs** based on category (e.g., INP_001, ACC_002)
2. **Category-specific templates** for bulk upload (7 different templates)
3. **Dynamic forms** that show relevant fields based on selected category

## Auto-Generated RM IDs

### How It Works
- User selects category (INP, ACC, ELC, SP, BS, PM, LB)
- System automatically generates sequential ID
- Format: `{CATEGORY}_{SEQUENCE}`
- Examples: INP_001, INP_002, ACC_001, ELC_001

### Manual Entry
1. Click "Add RM" button
2. Select category from dropdown
3. Fill in category-specific fields (dynamically shown)
4. System auto-generates RM ID on save
5. No need to enter RM ID manually

### Categories and Their Fields

#### INP (In-house Plastic) - INP_001, INP_002...
Fields:
- Mould Code
- Model Name
- Part Name
- Colour
- MB (Master Batch)
- Per Unit Weight (grams)
- Unit

#### ACC (Accessories) - ACC_001, ACC_002...
Fields:
- Type
- Model Name
- Specs
- Colour
- Per Unit Weight (grams)
- Unit

#### ELC (Electric Components) - ELC_001, ELC_002...
Fields:
- Model
- Type
- Specs
- Per Unit Weight (grams)
- Unit

#### SP (Spares) - SP_001, SP_002...
Fields:
- Type
- Specs
- Per Unit Weight (grams)
- Unit

#### BS (Brand Assets) - BS_001, BS_002...
Fields:
- Position
- Type
- Brand
- Buyer SKU
- Per Unit Weight (grams)
- Unit

#### PM (Packaging) - PM_001, PM_002...
Fields:
- Model
- Type
- Specs
- Brand
- Per Unit Weight (grams)
- Unit

#### LB (Labels) - LB_001, LB_002...
Fields:
- Type
- Buyer SKU
- Per Unit Weight (grams)
- Unit

## Category-Specific Templates

### Download Templates
1. Click "Templates" button
2. Dialog shows all 7 categories
3. Click on any category to download its specific template
4. Each template has correct column headers for that category

### Template Formats

**INP (In-house Plastic) Template:**
| Category | mould_code | model_name | part_name | colour | mb | per_unit_weight | unit | low_stock_threshold |
|----------|------------|------------|-----------|--------|----|-----------------| -----|---------------------|
| INP      | MC001      | Model-X    | Handle    | Red    | MB123 | 45.5      | grams | 10                  |

**ACC (Accessories) Template:**
| Category | type | model_name | specs | colour | per_unit_weight | unit | low_stock_threshold |
|----------|------|------------|-------|--------|-----------------|------|---------------------|
| ACC      | Bolt | Model-A    | M6x20 | Silver | 15.2            | grams| 10                  |

**ELC (Electric Components) Template:**
| Category | model | type | specs | per_unit_weight | unit | low_stock_threshold |
|----------|-------|------|-------|-----------------|------|---------------------|
| ELC      | XY-100| Motor| 12V   | 250.0           | grams| 5                   |

*Similar format for SP, BS, PM, LB categories with their respective fields*

### Bulk Upload Process
1. Download category-specific template
2. Fill in rows with data (Category column must match template)
3. System auto-generates RM IDs: INP_001, INP_002, etc.
4. Upload Excel file
5. All RMs created with sequential IDs

## Benefits

### 1. No Manual ID Entry
- Eliminates duplicate ID errors
- Ensures consistent naming convention
- Faster data entry

### 2. Category Organization
- Easy to identify RM type from ID
- Better inventory organization
- Simplified reporting

### 3. Sequential Tracking
- Clear progression (INP_001, INP_002...)
- Easy to spot gaps or missing items
- Better audit trail

### 4. Bulk Upload Efficiency
- Category-specific templates reduce errors
- Correct field mapping guaranteed
- Upload 100s of RMs in minutes

## Workflow Examples

### Example 1: Manual Entry
```
1. User clicks "Add RM"
2. Selects "INP - In-house Plastic"
3. Form shows 7 fields specific to plastic
4. Fills in: mould_code="MC001", model_name="Widget", etc.
5. Clicks "Add Raw Material"
6. System generates ID: INP_001
7. RM created: INP_001 (In-house Plastic)
```

### Example 2: Bulk Upload - Accessories
```
1. User clicks "Templates"
2. Clicks "ACC - Accessories"
3. Template downloads with ACC fields
4. User adds 50 rows of accessory data
5. Uploads file
6. System creates: ACC_001 to ACC_050
```

### Example 3: Mixed Categories
```
Excel file contains:
- 10 INP rows → Creates INP_001 to INP_010
- 5 ACC rows → Creates ACC_001 to ACC_005
- 8 ELC rows → Creates ELC_001 to ELC_008

One upload creates 23 RMs across 3 categories
```

## Important Notes

### Sequence Management
- Sequences are global (not branch-specific)
- INP_001 is same across all branches
- If INP_005 exists, next will be INP_006
- Deleted IDs are not reused

### Template Selection
- Always use correct template for category
- Wrong template = upload errors
- Each template has different columns
- Category column in Excel must match

### Data Validation
- System validates all fields
- Empty required fields = error
- Invalid category = skipped
- Errors shown in console

## Migration from Old System

If you have existing RMs with custom IDs:
1. Export current data
2. Map to categories (INP, ACC, etc.)
3. Use bulk upload with category templates
4. Old IDs will be replaced with new format
5. Update any SKU mappings accordingly

## API Changes

**Old API:**
```
POST /api/raw-materials
Body: { rm_id: "CUSTOM_ID", name: "...", unit: "..." }
```

**New API:**
```
POST /api/raw-materials
Body: { category: "INP", category_data: {...}, low_stock_threshold: 10 }
Response: { rm_id: "INP_001", ... }
```

System returns auto-generated rm_id in response.
