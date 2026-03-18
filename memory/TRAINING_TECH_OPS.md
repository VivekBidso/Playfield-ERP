# Tech Ops Module - Training Guide

## Overview

The **Tech Ops (Technical Operations)** module is the master data management hub for the Factory OPS system. It manages all foundational data that other modules depend on.

**Target Users:** Tech Ops Engineers, Master Admins

**Access Path:** Login → Tech Ops (sidebar)

---

## Module Sections

### 1. Verticals Tab

**Purpose:** Manage product verticals (top-level product categories)

**Examples:** Scooter, Rideon, Trikes, Baby Walker, etc.

**Actions:**
| Action | How To |
|--------|--------|
| View Verticals | Click "Verticals" tab |
| Add New | Click "Add Vertical" → Enter name → Save |
| Edit | Click Edit icon on row → Modify → Save |
| Delete | Click Delete icon (only if no SKUs linked) |

**Important:** Verticals are linked to Models and SKUs. Deleting a vertical with linked data is not allowed.

---

### 2. Models Tab

**Purpose:** Manage product models within each vertical

**Data Fields:**
- Model Code (unique identifier, e.g., "KS", "SR")
- Model Name (display name)
- Vertical (parent category)

**Actions:**
| Action | How To |
|--------|--------|
| View Models | Click "Models" tab |
| Add New | Click "Add Model" → Fill form → Save |
| Bulk Import | Click "Bulk Import" → Upload Excel → Review → Confirm |
| Edit | Click Edit icon → Modify → Save |

**Excel Import Format:**
```
| Model Code | Model Name | Vertical |
|------------|------------|----------|
| KS         | Kids Scooter | Scooter |
| SR         | Sport Rider  | Rideon  |
```

---

### 3. Buyers Tab

**Purpose:** Manage customer/buyer master data

**Data Fields:**
- Customer Code (auto-generated, e.g., "CUST-0001")
- Name (company name)
- Contact Person
- Email
- Phone
- Address
- City, State, PIN Code
- GSTIN
- Payment Terms
- Credit Limit
- Status (Active/Inactive)

**Actions:**
| Action | How To |
|--------|--------|
| View Buyers | Click "Buyers" tab |
| Add New | Click "Add Buyer" → Fill all fields → Save |
| Bulk Import | Click "Bulk Import" → Upload Excel → Confirm |
| Edit | Click on buyer row → Modify details → Save |
| Search | Use search box to filter by name/code |

**Excel Import Format:**
```
| Name | Contact Person | Email | Phone | Address | City | State | PIN | GSTIN | Payment Terms | Credit Limit |
```

---

### 4. Branches Tab

**Purpose:** Manage production units/branches

**Data Fields:**
- Branch Code
- Branch Name (e.g., "Unit 1 Vedica")
- Location
- Branch Type (Production/Warehouse)
- Daily Capacity (units per day)
- Status (Active/Inactive)

**Actions:**
| Action | How To |
|--------|--------|
| View Branches | Click "Branches" tab |
| Edit Capacity | Click Edit → Update capacity → Save |
| Toggle Status | Click Active/Inactive toggle |

**Note:** Branch capacity is the DEFAULT daily capacity. Can be overridden for specific dates via CPC module.

---

### 5. Raw Materials Tab

**Purpose:** View and manage raw material catalog

**Data Fields:**
- RM Code (unique identifier)
- Description
- Category
- UOM (Unit of Measure)
- HSN Code
- Current Stock

**Actions:**
| Action | How To |
|--------|--------|
| View RMs | Click "Raw Materials" tab |
| Search | Use search/filter options |
| View Details | Click on RM row for full details |

---

## Key Workflows

### Workflow 1: Setting Up a New Product Line

```
Step 1: Create Vertical (if new category)
   Tech Ops → Verticals → Add Vertical
   
Step 2: Create Models under Vertical
   Tech Ops → Models → Add Model → Select Vertical
   
Step 3: SKUs will be created in SKU module with these references
```

### Workflow 2: Onboarding a New Customer

```
Step 1: Add Buyer
   Tech Ops → Buyers → Add Buyer
   
Step 2: Fill mandatory fields:
   - Name, Contact Person, Email, Phone
   - Address details (City, State, PIN)
   - GSTIN (for GST compliance)
   - Payment Terms, Credit Limit
   
Step 3: Save → Customer Code auto-generated
```

### Workflow 3: Bulk Data Import

```
Step 1: Download Template
   Click "Template" button to get Excel format
   
Step 2: Fill Data
   Populate Excel with your data
   Match column headers exactly
   
Step 3: Upload
   Click "Bulk Import" → Select file → Upload
   
Step 4: Review
   Check preview for errors
   Fix any validation issues
   
Step 5: Confirm
   Click "Confirm Import" to save all records
```

---

## Tips & Best Practices

1. **Always use Bulk Import** for large data sets (50+ records)
2. **Validate GSTIN format** before saving buyers (15 characters)
3. **Set realistic capacity** for branches based on actual production capability
4. **Keep Model Codes short** (2-4 characters) for easy SKU naming
5. **Deactivate instead of Delete** - keeps historical data intact

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot delete Vertical | Check if Models/SKUs are linked. Reassign them first. |
| Bulk import fails | Verify Excel column headers match template exactly |
| Duplicate Customer Code | System auto-generates unique codes. Check if buyer already exists. |
| Branch capacity not reflecting | Restart browser or clear cache |

---

## Related Modules

- **SKUs Module** - Creates SKUs using Verticals, Models, Brands
- **Demand Module** - Uses Buyers for forecast creation
- **CPC Module** - Uses Branches for production scheduling

---

*Document Version: 1.0*
*Last Updated: March 2026*
