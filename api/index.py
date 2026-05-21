"""
Vercel serverless entry point.
Vercel maps all /api/* requests here, FastAPI handles its own routing internally.
"""
import sys
import os

# Add the backend directory to Python path so 'app' module is importable
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from app.main import app  # noqa: F401 — Vercel picks up 'app' automatically
