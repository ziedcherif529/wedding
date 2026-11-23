import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ['APP_ENV'] = 'testing'
os.environ['DATABASE_URL'] = 'sqlite:///./test_smartlife.db'
os.environ['JWT_SECRET_KEY'] = 'smartlife-test-secret-key-32-characters-long'

db_path = ROOT / 'test_smartlife.db'
if db_path.exists():
    db_path.unlink()
