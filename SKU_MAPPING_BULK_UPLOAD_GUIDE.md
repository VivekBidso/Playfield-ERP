# SKU-RM Mapping Bulk Upload Guide

## Overview
The RM-SKU Mapping module now supports bulk upload via Excel, making it easy to define Bill of Materials (BOM) for multiple SKUs at once.

## Features
1. **Bulk Upload**: Upload multiple SKU-to-RM mappings via Excel
2. **Template Download**: Get sample Excel format
3. **Export Mappings**: Download existing mappings to Excel
4. **Manual Entry**: Still available for individual mappings

## Excel Format

### Required Columns
| SKU_ID | RM_ID   | Qty |
|--------|---------|-----|
| SKU001 | INP_001 | 2   |
| SKU001 | ACC_001 | 1   |
| SKU002 | INP_001 | 3   |
| SKU002 | ELC_001 | 1   |

### Column Descriptions
- **SKU_ID**: The finished goods SKU identifier (must exist globally)
- **RM_ID**: The raw material identifier (must exist globally)
- **Qty**: Quantity of RM required per unit of SKU (decimal allowed)

### Important Rules
1. **Multiple Rows per SKU**: One SKU can have multiple rows for different RMs
2. **Overwrite Behavior**: If SKU mapping already exists, it will be replaced with new data
3. **Global Validation**: Both SKU_ID and RM_ID must exist globally in the system
4. **Positive Quantities**: Qty must be greater than 0

## How to Use

### Step 1: Download Template
1. Go to "RM-SKU Mapping" page
2. Click "Template" button
3. Sample Excel file downloads with correct format
4. Use as reference for your data

### Step 2: Prepare Your Data
**Example Data:**
```
SKU_ID   | RM_ID   | Qty
---------|---------|----
BIDSO001 | INP_001 | 2.5
BIDSO001 | INP_002 | 3.0
BIDSO001 | ACC_001 | 1.0
BIDSO002 | INP_001 | 4.0
BIDSO002 | ELC_001 | 2.0
BIDSO002 | PM_001  | 1.0
```

This creates:
- BIDSO001 BOM: INP_001 (2.5), INP_002 (3.0), ACC_001 (1.0)
- BIDSO002 BOM: INP_001 (4.0), ELC_001 (2.0), PM_001 (1.0)

### Step 3: Upload File
1. Click "Bulk Upload" button
2. Select your Excel file
3. System processes and shows results:
   - **Created**: New SKU mappings added
   - **Updated**: Existing SKU mappings replaced
   - **Errors**: Rows with issues (check console)

### Step 4: Verify Mappings
1. Mappings appear as cards on the page
2. Each card shows SKU and its required RMs
3. Click "Edit" to modify individual mapping
4. Use "Export" to download all current mappings

## Example Scenarios

### Scenario 1: New Product Line
**Task**: Add BOM for 50 new SKUs

**Solution**:
1. Create Excel with all SKU-RM combinations
2. One upload creates all 50 BOMs
3. Much faster than 50 manual entries

### Scenario 2: Update Existing BOM
**Task**: Change RM quantities for existing SKUs

**Solution**:
1. Export current mappings
2. Modify quantities in Excel
3. Re-upload - replaces old mappings
4. All SKUs updated in one go

### Scenario 3: Product Variant
**Task**: New SKU similar to existing one

**Solution**:
1. Export mappings
2. Copy rows for similar SKU
3. Change SKU_ID, adjust quantities
4. Upload to add new variant

## Upload Results

### Success Message
```
"Uploaded: 15 created, 5 updated"
```
- 15 new SKU mappings created
- 5 existing SKU mappings updated

### Error Handling
If errors occur:
- Success operations complete
- Error rows listed in console
- Common errors:
  - SKU not found
  - RM not found
  - Invalid quantity
  - Missing required columns

## Best Practices

1. **Use Template**: Always start with downloaded template
2. **Verify IDs**: Ensure SKU and RM IDs exist before upload
3. **Test Small**: Upload 5-10 rows first, verify, then do full upload
4. **Keep Backup**: Export current mappings before bulk update
5. **Group by SKU**: Keep all RMs for one SKU together for readability
6. **Document Changes**: Add comments in separate sheet to track versions

## Integration with Other Modules

### Production Planning
- Mappings used to calculate RM requirements
- Shortage analysis relies on these BOMs
- Ensure mappings are correct for accurate planning

### Production Entry
- System uses mappings to deduct RM inventory
- Missing mappings = production blocked
- Keep BOMs up-to-date

### Branch Activation
- When activating SKU in branch
- System auto-activates all mapped RMs
- BOM must exist for auto-activation to work

## Troubleshooting

**"SKU SKU001 not found"**
- SKU must be created globally first
- Go to SKUs page → Add SKU
- Then upload mapping

**"RM INP_001 not found"**
- RM must exist globally
- Go to Raw Materials → Bulk Upload RMs
- Then create mapping

**"Invalid quantity"**
- Quantity must be positive number
- Use decimal point, not comma (2.5 not 2,5)
- Remove any text from Qty column

**File upload shows no results**
- Check Excel format (3 columns exactly)
- Ensure headers match: SKU_ID, RM_ID, Qty
- Verify file is .xlsx or .xls format

## API Endpoint

For programmatic access:
```
POST /api/sku-mappings/bulk-upload
Content-Type: multipart/form-data
Body: file (Excel)

Response:
{
  "created": 15,
  "updated": 5,
  "total_skus": 20,
  "errors": []
}
```

## Export Format

Exported Excel has same format as upload:
- All current mappings
- One row per SKU-RM combination
- Can be modified and re-uploaded
- Useful for backup and version control
