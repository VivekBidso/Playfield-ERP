"""Helper functions and utilities"""
from datetime import datetime
import re
import uuid

from database import db
from models.core import BranchRMInventory


def serialize_doc(doc):
    """Helper to serialize datetime fields from MongoDB documents"""
    if doc and 'created_at' in doc and isinstance(doc['created_at'], str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if doc and 'date' in doc and isinstance(doc['date'], str):
        doc['date'] = datetime.fromisoformat(doc['date'])
    if doc and 'activated_at' in doc and isinstance(doc['activated_at'], str):
        doc['activated_at'] = datetime.fromisoformat(doc['activated_at'])
    return doc


async def get_next_rm_sequence(category: str) -> int:
    """Get next global sequence number for RM category by finding the highest numeric suffix"""
    all_rms = await db.raw_materials.find(
        {"category": category},
        {"_id": 0, "rm_id": 1}
    ).to_list(10000)
    
    max_seq = 0
    pattern = re.compile(rf'^{category}_(\d+)$')
    
    for rm in all_rms:
        match = pattern.match(rm['rm_id'])
        if match:
            seq = int(match.group(1))
            max_seq = max(max_seq, seq)
    
    return max_seq + 1


async def get_next_vendor_id() -> str:
    """Generate next sequential vendor ID like VND_001, VND_002, etc."""
    all_vendors = await db.vendors.find({}, {"_id": 0, "vendor_id": 1}).to_list(10000)
    
    max_seq = 0
    pattern = re.compile(r'^VND_(\d+)$')
    
    for v in all_vendors:
        vendor_id = v.get('vendor_id', '')
        if vendor_id:
            match = pattern.match(vendor_id)
            if match:
                seq = int(match.group(1))
                max_seq = max(max_seq, seq)
    
    next_seq = max_seq + 1
    return f"VND_{next_seq:03d}"


async def activate_rms_for_sku(sku_id: str, branch: str) -> int:
    """
    Activate all RMs in the BOM for a given SKU in a branch.
    Returns the number of RMs activated.
    """
    activated_count = 0
    
    # Get RM mappings from sku_rm_mapping collection (bulk uploaded)
    rm_mappings = await db.sku_rm_mapping.find({"sku_id": sku_id}, {"_id": 0, "rm_id": 1}).to_list(1000)
    
    # Also check legacy sku_mappings collection
    legacy_mapping = await db.sku_mappings.find_one({"sku_id": sku_id}, {"_id": 0})
    if legacy_mapping and legacy_mapping.get('rm_mappings'):
        for rm in legacy_mapping['rm_mappings']:
            rm_mappings.append({"rm_id": rm['rm_id']})
    
    # Activate each RM in the branch
    for mapping in rm_mappings:
        rm_id = mapping['rm_id']
        
        # Check if RM exists in the system
        rm = await db.raw_materials.find_one({"rm_id": rm_id}, {"_id": 0})
        if not rm:
            continue
        
        # Check if already activated in branch
        existing_inv = await db.branch_rm_inventory.find_one(
            {"rm_id": rm_id, "branch": branch},
            {"_id": 0}
        )
        
        if not existing_inv:
            # Activate RM in branch inventory
            inv_obj = BranchRMInventory(rm_id=rm_id, branch=branch)
            inv_doc = inv_obj.model_dump()
            inv_doc['activated_at'] = inv_doc['activated_at'].isoformat()
            await db.branch_rm_inventory.insert_one(inv_doc)
            activated_count += 1
        elif not existing_inv.get('is_active', False):
            # Re-activate if inactive
            await db.branch_rm_inventory.update_one(
                {"rm_id": rm_id, "branch": branch},
                {"$set": {"is_active": True}}
            )
            activated_count += 1
    
    return activated_count
