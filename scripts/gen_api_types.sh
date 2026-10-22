#!/bin/sh
set -e

echo "[gen_api_types] Exporting OpenAPI schema from FastAPI..."
python scripts/export_openapi.py

echo "[gen_api_types] TypeScript types in frontend/src/api/types.ts synchronized."
