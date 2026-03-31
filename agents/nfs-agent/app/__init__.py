"""
aiunistor-nfs-agent

Manages NFS-backed shared directories and persists state in a JSON registry.
Runs on the NFS server, typically as a systemd service with root privileges.
"""

import os

from fastapi import FastAPI

from .registry import RegistryStore
from .routes import create_router

SHARED_PATH = os.environ.get("NFS_SHARED_PATH", "")
NFS_EXPORT_HOST = os.environ.get("NFS_EXPORT_HOST", "")

app = FastAPI(title="aiunistor-nfs-agent")

store = RegistryStore(shared_path=SHARED_PATH)
router = create_router(store=store, shared_path=SHARED_PATH, nfs_export_host=NFS_EXPORT_HOST)
app.include_router(router, prefix="/api")
