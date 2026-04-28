"""
Seed service — runs all heavy startup work (test users, RBAC, RM categories).

Designed to run as a background task AFTER the FastAPI server has bound to its
port and started accepting connections. This keeps the deploy health check fast
even on resource-constrained tiers (250m CPU / 512Mi RAM) where the full seed
chain previously exceeded the 120s startup window.
"""
import uuid
from datetime import datetime, timezone


# Test users created if they don't already exist. Idempotent.
TEST_USERS = [
    {"email": "admin@factory.com", "name": "Master Admin", "role": "master_admin", "password": "bidso123"},
    {"email": "masteradmin@bidso.com", "name": "Master Admin", "role": "master_admin", "password": "bidso123"},
    {"email": "demandplanner@bidso.com", "name": "Test Demand Planner", "role": "demand_planner", "password": "bidso123", "branches": ["Unit 1 Vedica", "Unit 2 Trikes"]},
    {"email": "techops@bidso.com", "name": "Tech Ops Engineer", "role": "tech_ops_engineer", "password": "bidso123"},
    {"email": "cpcplanner@bidso.com", "name": "CPC Planner", "role": "cpc_planner", "password": "bidso123"},
    {"email": "procurement@bidso.com", "name": "Procurement Officer", "role": "procurement_officer", "password": "bidso123"},
    {"email": "branchops@bidso.com", "name": "Branch Ops User", "role": "branch_ops_user", "password": "bidso123", "branches": ["Unit 1 Vedica"]},
    {"email": "qcinspector@bidso.com", "name": "Quality Inspector", "role": "quality_inspector", "password": "bidso123"},
    {"email": "logistics@bidso.com", "name": "Logistics Coordinator", "role": "logistics_coordinator", "password": "bidso123"},
    {"email": "financeviewer@bidso.com", "name": "Finance Viewer", "role": "finance_viewer", "password": "bidso123"},
    {"email": "auditor@bidso.com", "name": "Auditor", "role": "auditor_readonly", "password": "bidso123"},
]


async def _seed_test_users(db, logger):
    """Create test users if missing. Each user is one find_one + conditional insert_one."""
    from services.utils import hash_password

    for user_data in TEST_USERS:
        try:
            existing = await db.users.find_one({"email": user_data["email"]})
            if not existing:
                new_user = {
                    "id": str(uuid.uuid4()),
                    "email": user_data["email"],
                    "password_hash": hash_password(user_data["password"]),
                    "name": user_data["name"],
                    "role": user_data["role"],
                    "assigned_branches": user_data.get("branches", []),
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.users.insert_one(new_user)
                logger.info(f"Created test user: {user_data['email']}")
        except Exception as e:
            logger.error(f"Failed to seed user {user_data['email']}: {e}")


async def _migrate_rm_categories(db, logger):
    """Populate description_columns from existing RM data. Idempotent."""
    pipeline = [
        {"$match": {"category": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    categories_in_rms = await db.raw_materials.aggregate(pipeline).to_list(100)

    if not categories_in_rms:
        logger.info("RM Categories migration: No RMs found, skipping")
        return

    category_names = {
        "INP": "In-house Plastic Parts", "ACC": "Accessories", "ELC": "Electrical Components",
        "SP": "Spare Parts", "BS": "Brand Stickers/Assets", "PM": "Packaging Materials",
        "LB": "Labels", "INM": "Input Materials (Coated)", "INM_FAB": "Fabricated Metal Parts",
        "STK": "Stickers", "SPR": "Spray Paints", "POLY": "Polymer Grades",
        "MB": "Master Batches", "PWD": "Powder Coating Materials", "PIPE": "Metal Pipes",
    }

    updated_count = 0
    created_count = 0

    for cat_info in categories_in_rms:
        cat_code = cat_info["_id"]
        if not cat_code:
            continue

        existing = await db.rm_categories.find_one({"code": cat_code})

        samples = await db.raw_materials.find(
            {"category": cat_code, "category_data": {"$exists": True, "$ne": None}},
            {"category_data": 1, "uom": 1},
        ).limit(50).to_list(50)

        all_keys = set()
        sample_uom = "PCS"
        for sample in samples:
            if sample.get("category_data") and isinstance(sample["category_data"], dict):
                all_keys.update(sample["category_data"].keys())
            if sample.get("uom"):
                sample_uom = sample["uom"]

        description_columns = []
        if all_keys:
            for idx, field in enumerate(sorted(all_keys)):
                if field.startswith("_") or field in ["id", "created_at", "updated_at"]:
                    continue
                col = {
                    "key": field,
                    "label": field.replace("_", " ").title(),
                    "type": "number" if field in ["per_unit_weight", "weight", "qty", "quantity", "mfi", "thickness", "diameter", "length"] else "text",
                    "required": field in ["mould_code", "model_name", "part_name", "grade", "colour_name", "base_part_code", "type"],
                    "options": [],
                    "include_in_name": field in ["mould_code", "model_name", "part_name", "colour", "grade", "colour_name", "type", "brand", "position"],
                    "order": idx,
                }
                description_columns.append(col)

        max_id_rm = await db.raw_materials.find_one(
            {"category": cat_code, "rm_id": {"$regex": f"^{cat_code}_\\d+$"}},
            {"rm_id": 1},
            sort=[("rm_id", -1)],
        )
        next_seq = cat_info["count"] + 1
        if max_id_rm and max_id_rm.get("rm_id"):
            try:
                num_part = max_id_rm["rm_id"].split("_")[-1]
                next_seq = int(num_part) + 1
            except (ValueError, IndexError):
                pass

        source_type = "PURCHASED"
        bom_level = 1
        if cat_code == "INP":
            source_type = "MANUFACTURED"
            bom_level = 2
        elif cat_code in ["INM", "INM_FAB"]:
            source_type = "BOTH"
            bom_level = 3 if cat_code == "INM" else 2

        now = datetime.now(timezone.utc)

        if existing:
            if not existing.get("description_columns") and description_columns:
                await db.rm_categories.update_one(
                    {"code": cat_code},
                    {"$set": {
                        "description_columns": description_columns,
                        "next_sequence": max(next_seq, existing.get("next_sequence", 1)),
                        "default_uom": sample_uom,
                        "updated_at": now,
                    }},
                )
                updated_count += 1
        else:
            cat_doc = {
                "id": str(uuid.uuid4()),
                "code": cat_code,
                "name": category_names.get(cat_code, cat_code),
                "description": f"Auto-migrated from existing RMs ({cat_info['count']} items)",
                "default_source_type": source_type,
                "default_bom_level": bom_level,
                "default_uom": sample_uom,
                "rm_id_prefix": cat_code,
                "description_columns": description_columns,
                "next_sequence": next_seq,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            await db.rm_categories.insert_one(cat_doc)
            created_count += 1

    if created_count > 0 or updated_count > 0:
        logger.info(f"RM Categories migration: Created {created_count}, Updated {updated_count}")
    else:
        logger.info("RM Categories migration: All categories up to date")


async def run_seeds(db, logger):
    """Orchestrate all startup seed/migration work.

    Each step is wrapped in try/except so a single failure doesn't abort the
    rest. Designed to be invoked via asyncio.create_task() from the FastAPI
    startup hook, so it runs in the background after the port is bound.
    """
    logger.info("Background seeding: starting...")

    try:
        await _seed_test_users(db, logger)
    except Exception as e:
        logger.error(f"Background seeding: test users failed: {e}")

    try:
        from services.seed_rbac import seed_rbac
        await seed_rbac(db)
        logger.info("Background seeding: RBAC complete")
    except Exception as e:
        logger.error(f"Background seeding: RBAC failed: {e}")

    try:
        await _migrate_rm_categories(db, logger)
    except Exception as e:
        logger.error(f"Background seeding: RM categories migration failed: {e}")

    logger.info("Background seeding: all tasks complete")
