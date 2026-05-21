import sys
import os

# Resolve the backend directory regardless of where Vercel runs this from.
# In Vercel, the entire repo is deployed to /var/task, so:
#   __file__ → /var/task/api/index.py
#   backend_dir → /var/task/backend
_api_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_api_dir)
_backend_dir = os.path.join(_root_dir, "backend")

if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from app.main import app  # noqa: F401
