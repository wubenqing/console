"""
Mount / unmount routes for the host-side agent.

All subprocess calls use argument lists (never shell=True) to prevent
command injection.
"""

from __future__ import annotations

import os
import subprocess

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class MountBody(BaseModel):
    source: str  # e.g. "172.24.37.159:/test-dir3"
    mountPath: str  # e.g. "/mnt/remote-kvcache/"


class UnmountBody(BaseModel):
    mountPath: str


@router.post("/mount", status_code=200)
def do_mount(body: MountBody):
    source = body.source.strip()
    mount_path = body.mountPath.strip()
    if not source or not mount_path:
        raise HTTPException(400, "参数缺失：source 和 mountPath 均为必填项")

    # Auto-create the mount directory if it does not exist.
    # If it already exists we refuse to proceed: the directory was not created
    # by this agent and umount would later delete it, potentially destroying
    # data the user placed there intentionally.
    if os.path.isdir(mount_path):
        raise HTTPException(
            409,
            f"挂载目录冲突：{mount_path} 已存在。"
            "该目录不是由挂载代理创建的，为防止误删用户数据，请先手动删除该目录后重试。",
        )
    try:
        os.makedirs(mount_path, exist_ok=False)
    except OSError as exc:
        raise HTTPException(
            500,
            f"无法创建挂载目录 {mount_path}：{exc}",
        )

    try:
        subprocess.run(
            ["mount", "-t", "nfs", "-o", "vers=4,nosharecache",
             source, mount_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            500,
            f"挂载失败：{exc.stderr.strip() or exc.stdout.strip()}",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "挂载超时，请检查 NFS 服务端是否可达")

    return {"success": True, "source": source, "mountPath": mount_path}


@router.post("/unmount", status_code=200)
def do_unmount(body: UnmountBody):
    mount_path = body.mountPath.strip()
    if not mount_path:
        raise HTTPException(400, "参数缺失：mountPath 为必填项")

    try:
        subprocess.run(
            ["umount", mount_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            500,
            f"卸载失败：{exc.stderr.strip() or exc.stdout.strip()}",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "卸载超时，请检查挂载点是否仍在使用中")

    # Remove the mount directory after a successful unmount so that kernel
    # dentry/inode caches are fully invalidated.  This prevents "Stale file
    # handle" errors when the same path is later re-mounted against a
    # server-side directory that was deleted and recreated (new inode).
    # rmdir only removes empty directories, so it is safe against accidental
    # data loss.
    try:
        os.rmdir(mount_path)
    except OSError:
        # Non-fatal: directory may already be gone or not empty.
        pass

    return {"success": True, "mountPath": mount_path}
