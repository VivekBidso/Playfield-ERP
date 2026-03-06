# Factory Management System - Global SKU/RM with Branch Activation

## Architecture Overview

### Global Creation, Branch Activation Model

**Key Principle**: SKU and RM IDs are globally unique and sequential. They are created once globally, then "activated" in specific branches for operations.

## How It Works

### 1. Global RM/SKU Creation
- **RM IDs**: Sequential across all branches (e.g., INP_001, INP_002, ACC_001)
- **SKU IDs**: User-provided, globally unique
- Created once, exist in global pool
- No inventory tracking at global level

### 2. Branch Activation
- Users "activate" RMs/SKUs in their branch to make them operational
- Only activated items appear in branch views
- Inventory is tracked per branch for activated items only

### 3. Automatic BOM Activation
When you activate an SKU in a branch:
- The system automatically activates all RMs in that SKU's BOM (Bill of Materials)
- This ensures production can proceed without errors
- Manual RM activation is also supported

## Workflow Examples

### Example 1: Setting up a New Branch

**Step 1: Create RMs Globally** (Admin/Central)
```
Upload Excel file with categories:
- INP (In-house Plastic) → Creates INP_001, INP_002, etc.
- ACC (Accessories) → Creates ACC_001, ACC_002, etc.
```

**Step 2: Create SKUs Globally**
```
Create SKU: BIDSO_SKU_001
Fields: Bidso SKU, Buyer SKU ID, Brand, Vertical, Model
```

**Step 3: Define BOM Globally**
```
Map BIDSO_SKU_001:
- INP_001: 2 units
- INP_002: 3 units
- ACC_001: 1 unit
```

**Step 4: Activate in Branch** (Branch User)
```
User at "Unit 1 Vedica":
1. Navigate to SKUs page
2. Click "Activate" on BIDSO_SKU_001
3. System automatically activates:
   - INP_001 in Unit 1 Vedica
   - INP_002 in Unit 1 Vedica
   - ACC_001 in Unit 1 Vedica
4. Now can do production in this branch
```

### Example 2: Manual RM Activation

```
User needs additional RM not part of any SKU BOM:
1. Go to Raw Materials page
2. Browse global RM list
3. Click "Activate" on desired RM
4. RM becomes available for this branch
```

### Example 3: Same SKU Across Multiple Branches

```
BIDSO_SKU_001 is activated in:
- Unit 1 Vedica (stock: 100)
- Unit 2 Trikes (stock: 50)
- Unit 4 Goa (stock: 75)

Each branch tracks inventory independently
Same RM codes used, but separate stock levels
```

## API Endpoints

### Global Operations (No Branch Filter)

**Create RM Globally:**
```
POST /api/raw-materials
Body: { rm_id, category, category_data, low_stock_threshold }
```

**Create SKU Globally:**
```
POST /api/skus
Body: { sku_id, bidso_sku, buyer_sku_id, description, brand, vertical, model }
```

**Get All Global RMs/SKUs:**
```
GET /api/raw-materials (no branch param)
GET /api/skus (no branch param)
```

### Branch-Specific Operations

**Activate RM in Branch:**
```
POST /api/raw-materials/activate
Body: { item_id: "INP_001", branch: "Unit 1 Vedica" }
```

**Activate SKU in Branch (Auto-activates BOM):**
```
POST /api/skus/activate
Body: { item_id: "BIDSO_SKU_001", branch: "Unit 1 Vedica" }
Response: { message, auto_activated_rms: ["INP_001", "INP_002", "ACC_001"] }
```

**Get Active RMs in Branch:**
```
GET /api/raw-materials?branch=Unit%201%20Vedica
Returns only activated RMs with current stock
```

**Get Active SKUs in Branch:**
```
GET /api/skus?branch=Unit%201%20Vedica
Returns only activated SKUs with current stock
```

## Database Collections

### Global Collections (No Branch Reference)
1. **raw_materials** - Global RM definitions
   - rm_id, category, category_data, low_stock_threshold
2. **skus** - Global SKU definitions
   - sku_id, bidso_sku, buyer_sku_id, description, brand, vertical, model
3. **sku_mappings** - Global BOM definitions
   - sku_id, rm_mappings[]

### Branch-Specific Collections
1. **branch_rm_inventory** - RM inventory per branch
   - rm_id, branch, current_stock, is_active
2. **branch_sku_inventory** - SKU inventory per branch
   - sku_id, branch, current_stock, is_active
3. **purchase_entries** - Purchase history (branch, rm_id)
4. **production_entries** - Production history (branch, sku_id)
5. **dispatch_entries** - Dispatch history (branch, sku_id)

## User Workflows

### For Admins/Central Team:
1. Create RMs globally via bulk upload
2. Create SKUs globally with complete details
3. Define BOM (RM-to-SKU mappings) globally
4. Use Master Dashboard to monitor all branches

### For Branch Users:
1. Select branch from sidebar
2. Activate required SKUs (auto-activates BOM RMs)
3. Manually activate additional RMs if needed
4. Add purchase entries to increase RM stock
5. Record production (consumes RM, increases SKU stock)
6. Record dispatches (decreases SKU stock)
7. View branch-specific dashboard and reports

## Benefits of This Architecture

1. **Centralized Master Data**: One source of truth for SKU/RM definitions
2. **Flexible Branch Operations**: Each branch operates independently
3. **Easy Expansion**: New branches can activate existing SKUs/RMs instantly
4. **BOM Consistency**: Same BOM used across all branches
5. **Accurate Tracking**: Separate inventory per branch
6. **Simplified Management**: Global changes reflect everywhere

## Migration Notes

If you have existing data with branch-specific RMs:
1. RMs with same IDs across branches will be merged into one global RM
2. Inventory will be split into branch_rm_inventory entries
3. Each branch will have its own inventory record for the RM
