"""
JSON-backed registry store with atomic update behaviour.

The registry lives at ``{shared_path}/.aiunistor/registry.json``.
Reads and writes are guarded by a simple file-level approach:
write to a temp file then atomically rename.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any

_REGISTRY_VERSION = 1


class RegistryStore:
    """Thread-safe, file-backed directory registry."""

    def __init__(self, shared_path: str) -> None:
        self._base = Path(shared_path)
        self._meta_dir = self._base / ".aiunistor"
        self._registry_path = self._meta_dir / "registry.json"
        self._lock = Lock()

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def read(self) -> dict[str, Any]:
        """Return the current registry dict.  Missing file → empty registry."""
        with self._lock:
            return self._read_unlocked()

    def write(self, data: dict[str, Any]) -> None:
        """Atomically persist *data* to the registry file."""
        with self._lock:
            self._write_unlocked(data)

    def get_directories(self) -> list[dict[str, Any]]:
        return self.read().get("directories", [])

    def find_directory(self, name: str) -> dict[str, Any] | None:
        for d in self.get_directories():
            if d["name"] == name:
                return d
        return None

    def add_directory(self, entry: dict[str, Any]) -> None:
        with self._lock:
            data = self._read_unlocked()
            dirs = data.setdefault("directories", [])
            dirs.append(entry)
            self._write_unlocked(data)

    def remove_directory(self, name: str) -> None:
        with self._lock:
            data = self._read_unlocked()
            data["directories"] = [d for d in data.get("directories", []) if d["name"] != name]
            self._write_unlocked(data)

    def update_directory(self, name: str, entry: dict[str, Any]) -> None:
        with self._lock:
            data = self._read_unlocked()
            dirs = data.get("directories", [])
            for i, d in enumerate(dirs):
                if d["name"] == name:
                    dirs[i] = entry
                    break
            self._write_unlocked(data)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _read_unlocked(self) -> dict[str, Any]:
        if not self._registry_path.exists():
            return {"version": _REGISTRY_VERSION, "directories": []}
        with open(self._registry_path, encoding="utf-8") as fh:
            return json.load(fh)

    def _write_unlocked(self, data: dict[str, Any]) -> None:
        self._meta_dir.mkdir(parents=True, exist_ok=True)
        data.setdefault("version", _REGISTRY_VERSION)
        fd, tmp = tempfile.mkstemp(dir=str(self._meta_dir), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=2, ensure_ascii=False)
            os.replace(tmp, str(self._registry_path))
        except BaseException:
            # Clean up temp file on failure
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
