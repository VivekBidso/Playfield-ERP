#!/usr/bin/env python3
"""
MongoDB Data Export Script for Bidso SKU Migration
Exports SKUs and all related data to JSON files for import into production
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
from datetime import datetime
from bson import ObjectId
import os

# Custom JSON encoder for MongoDB types
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# List of Bidso SKUs to migrate
BIDSO_SKUS = """PR_BYLS_024
PR_BYLS_025
PR_BYLS_026
PR_BYLS_027
PR_BYLS_028
SC_BN_002
SC_BN_003
SC_BN_004
SC_BN_005
SC_BN_011
SC_BN_012
SC_BN_013
SC_BN_014
SC_BNLS_007
SC_BNLS_008
SC_BNLS_009
SC_BNLS4_015
SC_WVLS4_037
KTC_CR_B_054
KTC_CR_C_050
KTC_CR_C_051
KTC_NC_C_018
KTC_NC_C_019
KTC_NC_C_020
KTC_NC_C_021
KTC_PX_B_032
KTC_PX_C_043
KTC_PX_C_044
KTC_PX_C_045
KTC_PX_S_040
KTC_PX_S_041
KTC_PX_S_042
KS_BE_010_SM
KS_BE_012_FH
KS_BE_012_WW
KS_BE_018_BM
KS_BT_078
KS_PE_067
KS_PE_068
KS_PE_069
KS_PE_070
KS_PE_072
KS_PE_073
KS_PE_074
KS_PE_088
KS_PL+_120
KS_PL+_121
KS_PL+_122
KS_PL+_123
KS_PL+_124
KS_SN_052
KS_SN_053
KS_SN_054
KS_SN_055
KS_SN_056
KS_SN_057
KS_SN_058
KS_SN_059
KS_SN_061_BM
KS_SN_062_BS
KS_SN_063_TJ
KS_SN_064_BM
KS_SN_065_SM
KS_SN_066_WW
KS_SN_091
KS_SN_108
KS_SN_109
KS_SN_110
KS_SN_111
KS_SN_144
KS_SN_160_PP
KS_SN_161_PP
KS_SN_162_TF
KS_SN_163_MLP
KS_SN_LS_103
KS_SN_LS_104
KS_SN_TY_105
KS_SN_TY_106
KS_SN_TY_107
KS_SN_TY_113
KS_TA_129
KS_TA_130
KS_TA_145
KS_TA_146
KS_TA_147
KS_TA_148
KS_TA_155
KS_TA_156
KS_SN_LS_140
KS_SN_LS_141
KS_SN_LS_142
KS_TA_164
KS_TA_165
KS_TA_166
SH_SP_001
SC_BN_055_PP
SC_BN_056_PP
KTC_CR_S_082
KTC_CR_S_083
PR_BPLS_086
PR_BPLS_087
PR_BPLS_088
PR_BPLS_089
KS_SR_180
KS_SR_181
KS_SR_182
KS_SR_183
KS_SR_184
KS_SR_185
EV_SK_014
EV_SK_015
EV_SK_016
KS_BE_P_203_PP
KS_BE_P_204_PP
KS_BE_P_205_PP
KS_BE_P_206_PP
KS_SR_199_NS
KS_SR_200_NS
KS_SR_201_NS
KS_SR_202_NS
KS_SR_JP_191
KS_SR_JP_193
KS_SR_JP_195
KS_SR_JP_197
SC_WVLS_043
SC_WVLS_096
SC_WVLS_097
KS_TA_207
SC_WVLS_098
KS_BE_208
KS_BE_209
KS_SR_JP_192
KS_SR_JP_210
KTC_PX_PE_B_088
KTC_PX_PE_B_089
KTC_PX_PE_B_090
KTC_PX_PE_B_091
KS_SN_064
KS_SN_065
PR_BY_029
PR_BY_033
KTC_PX_PE_P_092_PP
KTC_PX_PE_P_093_PP
KTC_PX_PE_P_094_PP
KTC_PX_PE_P_095_PP
KTC_PX_PE_P_096_PP
KTC_PX_PE_P_097_PP
KTC_PX_PE_P_098_PP
KTC_PX_PE_P_099_PP
KTC_PX_PE_P_100_PP
KS_BE_P_211
KS_BE_P_212
KS_BE_P_213
KS_BE_P_214
KS_BE_P_215
KS_BE_P_216
KS_BE_P_217
KS_BE_P_218
KS_SN_219_PP
KS_SN_220_MLP
PR_TGLS_101
PR_TGLS_102
KS_BE_P_225
KS_BE_P_226
KS_BE_P_227_NS
KS_BE_P_228_NS
KS_BE_P_229_NS
KS_SR_221_HP
KS_SR_222_HP
KS_SR_223_HP
KS_SR_224_HP
PR_TG_103
SC_WVLS_104
SC_WVLS_105""".strip().split('\n')

OUTPUT_DIR = "/app/migration_export/data"

async def export_data():
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client["test_database"]
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("MONGODB DATA EXPORT FOR PRODUCTION MIGRATION")
    print("=" * 60)
    print(f"\nExporting {len(BIDSO_SKUS)} Bidso SKUs and related data...\n")
    
    # 1. Export SKUs (main product data)
    print("1. Exporting SKUs...")
    skus = await db.skus.find(
        {"bidso_sku": {"$in": BIDSO_SKUS}},
        {"_id": 0}
    ).to_list(1000)
    
    with open(f"{OUTPUT_DIR}/1_skus.json", "w") as f:
        json.dump(skus, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(skus)} SKUs to 1_skus.json")
    
    # Get buyer_sku_ids for related queries
    buyer_sku_ids = [s.get("buyer_sku_id") for s in skus if s.get("buyer_sku_id")]
    
    # 2. Export Buyer SKUs
    print("2. Exporting Buyer SKUs...")
    buyer_skus = await db.buyer_skus.find(
        {"buyer_sku_id": {"$in": buyer_sku_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    with open(f"{OUTPUT_DIR}/2_buyer_skus.json", "w") as f:
        json.dump(buyer_skus, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(buyer_skus)} Buyer SKUs to 2_buyer_skus.json")
    
    # 3. Export Branch Assignments
    print("3. Exporting Branch Assignments...")
    branch_assignments = await db.sku_branch_assignments.find(
        {"sku_id": {"$in": buyer_sku_ids}},
        {"_id": 0}
    ).to_list(5000)
    
    with open(f"{OUTPUT_DIR}/3_sku_branch_assignments.json", "w") as f:
        json.dump(branch_assignments, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(branch_assignments)} Branch Assignments to 3_sku_branch_assignments.json")
    
    # 4. Export BOM mappings (sku_rm_mapping)
    print("4. Exporting BOM Mappings (sku_rm_mapping)...")
    bom_mappings = await db.sku_rm_mapping.find(
        {"sku_id": {"$in": buyer_sku_ids}},
        {"_id": 0}
    ).to_list(50000)
    
    with open(f"{OUTPUT_DIR}/4_sku_rm_mapping.json", "w") as f:
        json.dump(bom_mappings, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(bom_mappings)} BOM Mappings to 4_sku_rm_mapping.json")
    
    # 5. Export Common BOM
    print("5. Exporting Common BOM...")
    common_bom = await db.common_bom.find(
        {"bidso_sku_id": {"$in": BIDSO_SKUS}},
        {"_id": 0}
    ).to_list(5000)
    
    with open(f"{OUTPUT_DIR}/5_common_bom.json", "w") as f:
        json.dump(common_bom, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(common_bom)} Common BOM entries to 5_common_bom.json")
    
    # 6. Export Reference Data (Models, Verticals, Brands)
    print("6. Exporting Reference Data...")
    
    # Get unique IDs
    model_ids = list(set([s.get("model_id") for s in skus if s.get("model_id")]))
    vertical_ids = list(set([s.get("vertical_id") for s in skus if s.get("vertical_id")]))
    brand_ids = list(set([s.get("brand_id") for s in skus if s.get("brand_id")]))
    
    # Models
    models = await db.models.find({"id": {"$in": model_ids}}, {"_id": 0}).to_list(100)
    with open(f"{OUTPUT_DIR}/6a_models.json", "w") as f:
        json.dump(models, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(models)} Models to 6a_models.json")
    
    # Verticals
    verticals = await db.verticals.find({"id": {"$in": vertical_ids}}, {"_id": 0}).to_list(50)
    with open(f"{OUTPUT_DIR}/6b_verticals.json", "w") as f:
        json.dump(verticals, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(verticals)} Verticals to 6b_verticals.json")
    
    # Brands
    brands = await db.brands.find({"id": {"$in": brand_ids}}, {"_id": 0}).to_list(100)
    with open(f"{OUTPUT_DIR}/6c_brands.json", "w") as f:
        json.dump(brands, f, cls=MongoJSONEncoder, indent=2)
    print(f"   ✓ Exported {len(brands)} Brands to 6c_brands.json")
    
    # Summary
    print("\n" + "=" * 60)
    print("EXPORT COMPLETE!")
    print("=" * 60)
    print(f"\nFiles saved to: {OUTPUT_DIR}/")
    print(f"""
Summary:
  - SKUs:                {len(skus)}
  - Buyer SKUs:          {len(buyer_skus)}
  - Branch Assignments:  {len(branch_assignments)}
  - BOM Mappings:        {len(bom_mappings)}
  - Common BOM:          {len(common_bom)}
  - Models:              {len(models)}
  - Verticals:           {len(verticals)}
  - Brands:              {len(brands)}
""")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(export_data())
