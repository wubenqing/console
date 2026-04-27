"""Prometheus vLLM service discovery agent application."""

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="aiunistor-prometheus-vllm-sd-agent")
app.include_router(router)