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

RM_CATEGORIES = {}  # DEPRECATED - use get_all_rm_categories() from services.utils


def generate_rm_name(category: str, category_data: dict) -> str:
    """DEPRECATED - use generate_rm_description_async() from services.utils instead"""
    return ""

async def shutdown_db():
    """Close database connection"""
    client.close()
