#!/bin/bash
exec python -m uvicorn stardew_valley_api.main:app --host 0.0.0.0 --port ${PORT:-8000}
