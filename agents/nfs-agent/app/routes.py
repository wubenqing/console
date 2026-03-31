"""
FastAPI routes for the NFS agent.

Implements:
- GET  /api/registry          – full registry dump
- GET  /api/directories       – list directories
- POST /api/directories       – create directory
- GET  /api/directories/{name}  – get single directory
- DELETE /api/directories/{name} – delete directory (guarded)
- POST /api/directories/{name}/mounts   – add mount record
- DELETE /api/directories/{name}/mounts – remove mount record
"""

from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .registry import RegistryStore


class CreateDirectoryBody(BaseModel):
    name: str


class AddMountBody(BaseModel):
    host: str
    mountPath: str


class RemoveMountBody(BaseModel):
    host: str
    mountPath: str


def create_router(
    *,
    store: RegistryStore,
    shared_path: str,
    nfs_export_host: str,
) -> APIRouter:
    router = APIRouter()
    base = Path(shared_path)

    # ---- helpers ----

    def _build_local_path(name: str) -> str:
        return str(base / name)

    def _build_mount_source(name: str) -> str:
        return f"{nfs_export_host}:/{name}"

    # ---- routes ----

    @router.get("/registry")
    def get_registry():
        return store.read()

    @router.get("/directories")
    def list_directories():
        return store.get_directories()

    @router.post("/directories", status_code=201)
    def create_directory(body: CreateDirectoryBody):
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "Directory name must not be empty")

        if store.find_directory(name) is not None:
            raise HTTPException(409, f"Directory '{name}' already exists")

        local_path = _build_local_path(name)
        os.makedirs(local_path, exist_ok=True)

        entry = {
            "name": name,
            "localPath": local_path,
            "mountSource": _build_mount_source(name),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "mounts": [],
        }
        store.add_directory(entry)
        return entry

    @router.get("/directories/{name}")
    def get_directory(name: str):
        entry = store.find_directory(name)
        if entry is None:
            raise HTTPException(404, f"Directory '{name}' not found")
        return entry

    @router.delete("/directories/{name}", status_code=200)
    def delete_directory(name: str):
        entry = store.find_directory(name)
        if entry is None:
            raise HTTPException(404, f"Directory '{name}' not found")

        active = [m for m in entry.get("mounts", []) if m.get("status") == "mounted"]
        if active:
            raise HTTPException(
                409,
                f"Cannot delete '{name}': {len(active)} active mount(s) remain",
            )

        local_path = entry.get("localPath", _build_local_path(name))
        if Path(local_path).exists():
            shutil.rmtree(local_path)

        store.remove_directory(name)
        return {"success": True}

    @router.post("/directories/{name}/mounts", status_code=201)
    def add_mount(name: str, body: AddMountBody):
        entry = store.find_directory(name)
        if entry is None:
            raise HTTPException(404, f"Directory '{name}' not found")

        mount_record = {
            "host": body.host,
            "mountPath": body.mountPath,
            "status": "mounted",
            "mountedAt": datetime.now(timezone.utc).isoformat(),
            "lastError": "",
        }
        entry.setdefault("mounts", []).append(mount_record)
        store.update_directory(name, entry)
        return entry

    @router.delete("/directories/{name}/mounts", status_code=200)
    def remove_mount(name: str, body: RemoveMountBody):
        entry = store.find_directory(name)
        if entry is None:
            raise HTTPException(404, f"Directory '{name}' not found")

        mounts = entry.get("mounts", [])
        entry["mounts"] = [
            m
            for m in mounts
            if not (m["host"] == body.host and m["mountPath"] == body.mountPath)
        ]
        store.update_directory(name, entry)
        return entry

    return router
