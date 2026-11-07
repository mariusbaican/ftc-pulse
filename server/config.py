import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for server
SERVER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVER_DIR.parent

# Load server/.env first, then fallback to root .env
server_env = SERVER_DIR / ".env"
root_env = PROJECT_ROOT / ".env"

if server_env.exists():
    load_dotenv(dotenv_path=server_env)
if root_env.exists():
    load_dotenv(dotenv_path=root_env)

# Configuration exports
FTC_EVENTS_API_USERNAME = os.getenv("FTC_EVENTS_API_USERNAME", "")
FTC_EVENTS_API_KEY = os.getenv("FTC_EVENTS_API_KEY", "")
FTC_API_BASE_URL = "https://ftc-api.firstinspires.org/v2.0"
FTC_SEASON = int(os.getenv("FTC_SEASON", "2025"))
TARGET_TEAM = int(os.getenv("TARGET_TEAM", "15996"))
SERVER_PORT = int(os.getenv("PORT", "5050"))
FALLBACK_SNAPSHOT_PATH = os.path.join(SERVER_DIR, "data", "fallback_snapshot.json")
