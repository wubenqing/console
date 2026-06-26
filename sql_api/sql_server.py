#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Entry point for the AI Query Service.

Kept for backward compatibility. The app is defined in app/__init__.py.
For production use via systemd: uvicorn app:app
"""

import os
import argparse

# Re-export the app from the app package so that
#   uvicorn sql_server:app
# continues to work.
from app import app

if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="Run the AI Query Service")
    parser.add_argument(
        "--host",
        default=os.getenv("AI_QUERY_SERVICE_HOST", "0.0.0.0"),
        help="Host to bind to",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("AI_QUERY_SERVICE_PORT", "4008")),
        help="Port to bind to",
    )

    args = parser.parse_args()

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
    )
