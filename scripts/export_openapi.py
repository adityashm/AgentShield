"""
scripts/export_openapi.py — Exports FastAPI OpenAPI specification and generates TypeScript types.
"""

import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app

def main():
    schema = app.openapi()
    
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "api"))
    os.makedirs(out_dir, exist_ok=True)
    
    json_path = os.path.join(out_dir, "openapi.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
    print(f"[OK] Exported OpenAPI schema to {json_path}")


if __name__ == "__main__":
    main()
