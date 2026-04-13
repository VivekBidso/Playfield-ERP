"""Database connection and configuration"""
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Constants
BRANCHES = [
    "Unit 1 Vedica",
    "Unit 2 Trikes",
    "Unit 3 TM",
    "Unit 4 Goa",
    "Unit 5 Baabus",
    "Unit 6 Emox",
    "BHDG WH"
]

RM_CATEGORIES = {
    "INP": {
        "name": "In-house Plastic", 
        "fields": ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"],
        "nameFormat": ["mould_code", "model_name", "part_name", "colour", "mb"]  # Mould Code - Model Name - Part Name - Colour - Masterbatch
    },
    "INM": {
        "name": "In-house Metal", 
        "fields": ["type", "color", "finish", "per_unit_weight", "unit"],
        "nameFormat": ["type", "color", "finish"]  # Type - Color - Finish
    },
    "ACC": {
        "name": "Accessories", 
        "fields": ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"],
        "nameFormat": ["type", "model_name", "specs", "colour"]  # Type - Model Name - Specs - Colour
    },
    "ELC": {
        "name": "Electric Components", 
        "fields": ["model", "type", "specs", "per_unit_weight", "unit"],
        "nameFormat": ["model", "type", "specs"]  # Model - Type - Specs
    },
    "SP": {
        "name": "Spares", 
        "fields": ["type", "specs", "per_unit_weight", "unit"],
        "nameFormat": ["type", "specs"]  # Type - Specs
    },
    "BS": {
        "name": "Brand Assets", 
        "fields": ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"],
        "nameFormat": ["position", "type", "brand", "buyer_sku"]  # Position - Type - Brand - Buyer SKU
    },
    "PM": {
        "name": "Packaging", 
        "fields": ["model", "type", "specs", "brand", "per_unit_weight", "unit"],
        "nameFormat": ["model", "type", "specs", "brand"]  # Model - Type - Specs - Brand
    },
    "LB": {
        "name": "Labels", 
        "fields": ["type", "buyer_sku", "per_unit_weight", "unit"],
        "nameFormat": ["type", "buyer_sku"]  # Type - Buyer SKU
    }
}


def generate_rm_name(category: str, category_data: dict) -> str:
    """Generate RM name from category_data based on nomenclature"""
    if category not in RM_CATEGORIES:
        return ""
    
    name_format = RM_CATEGORIES[category].get("nameFormat", [])
    parts = [str(category_data.get(key, "")).strip() for key in name_format if category_data.get(key)]
    return " - ".join(parts) if parts else ""

async def shutdown_db():
    """Close database connection"""
    client.close()
