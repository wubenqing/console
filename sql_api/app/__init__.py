"""
aiunistor-sql-api

Provides SQL query capability over Iceberg REST catalog and Lance tables.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

app = FastAPI(title="AI Query Service", description="Service to query Iceberg and Lance tables using SQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
