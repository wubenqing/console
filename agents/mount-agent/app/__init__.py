"""
aiunistor-mount-agent

Executes NFS mount and unmount operations on the local host.
Runs on each target host, typically as a systemd service with root privileges.
"""

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="aiunistor-mount-agent")
app.include_router(router, prefix="/api")
