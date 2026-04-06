# Bidso SKU Migration to Production

## Export Summary

| Collection | Records | File |
|------------|---------|------|
| SKUs | 225 | `1_skus.json` |
| Buyer SKUs | 201 | `2_buyer_skus.json` |
| Branch Assignments | 303 | `3_sku_branch_assignments.json` |
| BOM Mappings | 0 | `4_sku_rm_mapping.json` |
| Common BOM | 0 | `5_common_bom.json` |
| Models | 24 | `6a_models.json` |
| Verticals | 6 | `6b_verticals.json` |
| Brands | 18 | `6c_brands.json` |

---

## Step-by-Step Import Instructions

### Option A: Using the Python Import Script (Recommended)

**Step 1: Download the migration package**
Download `bidso_sku_migration.zip` from this environment.

**Step 2: Extract and navigate**
```bash
unzip bidso_sku_migration.zip
cd migration_export
```

**Step 3: Install dependencies (if not already installed)**
```bash
pip install motor
```

**Step 4: Run a DRY RUN first (preview without changes)**
```bash
python3 import_data.py \
  --mongo-url "mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net" \
  --db-name "YOUR_DB_NAME" \
  --dry-run
```

**Step 5: Run the actual import**
```bash
python3 import_data.py \
  --mongo-url "mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net" \
  --db-name "YOUR_DB_NAME"
```

---

### Option B: Using mongoimport CLI

If you prefer using MongoDB's native tools:

**Step 1: Import Reference Data First (Verticals, Brands, Models)**
```bash
# Verticals
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection verticals \
  --file data/6b_verticals.json \
  --jsonArray

# Brands  
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection brands \
  --file data/6c_brands.json \
  --jsonArray

# Models
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection models \
  --file data/6a_models.json \
  --jsonArray
```

**Step 2: Import SKU Data**
```bash
# SKUs (main product data)
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection skus \
  --file data/1_skus.json \
  --jsonArray

# Buyer SKUs
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection buyer_skus \
  --file data/2_buyer_skus.json \
  --jsonArray
```

**Step 3: Import Assignments**
```bash
# Branch Assignments
mongoimport --uri "mongodb+srv://USER:PASS@cluster.mongodb.net/DB_NAME" \
  --collection sku_branch_assignments \
  --file data/3_sku_branch_assignments.json \
  --jsonArray
```

---

### Option C: Using MongoDB Compass

1. Open MongoDB Compass and connect to your production database
2. For each collection, go to `Collection > Add Data > Import File`
3. Select the corresponding JSON file
4. Import in this order:
   - `6b_verticals.json` → `verticals`
   - `6c_brands.json` → `brands`
   - `6a_models.json` → `models`
   - `1_skus.json` → `skus`
   - `2_buyer_skus.json` → `buyer_skus`
   - `3_sku_branch_assignments.json` → `sku_branch_assignments`

---

## Important Notes

1. **Import Order Matters**: Always import reference data (Verticals, Brands, Models) BEFORE SKUs
2. **Duplicates**: The Python script skips existing records. `mongoimport` may create duplicates unless you use `--mode=upsert`
3. **BOM Data**: No BOM mappings were found for these SKUs (files are empty)
4. **Backup First**: Always backup your production database before importing

---

## Verification After Import

Run these queries in MongoDB to verify:

```javascript
// Count imported SKUs
db.skus.countDocuments({ bidso_sku: { $in: ["PR_BYLS_024", "SC_BN_002", "KS_TA_207"] } })

// Check a specific SKU
db.skus.findOne({ bidso_sku: "KS_TA_207" })

// Count branch assignments
db.sku_branch_assignments.countDocuments({})
```

---

## Troubleshooting

**Error: "duplicate key error"**
- The record already exists. Use `--mode=upsert` with mongoimport or use the Python script which skips duplicates.

**Error: "connection refused"**
- Check your MongoDB connection string and ensure your IP is whitelisted.

**Missing reference data error**
- Import verticals, brands, and models before importing SKUs.
