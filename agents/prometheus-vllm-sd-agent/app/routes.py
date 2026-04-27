from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from .config import load_settings
from .gpustack import GpustackClient
from .targets import build_prometheus_targets

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/healthz")
def healthz():
    return {"ok": True}


@router.get("/prometheus/vllm/targets")
def prometheus_vllm_targets():
    try:
        return fetch_prometheus_targets(load_settings())
    except Exception as exc:
        logger.exception("Failed to build Prometheus targets")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def fetch_prometheus_targets(settings):
    client = GpustackClient(settings)
    models = client.list_models()
    instances_by_model = {model["id"]: client.list_model_instances(model["id"]) for model in models}
    return build_prometheus_targets(
        models,
        instances_by_model,
        allowed_model_names=settings.allowed_model_names,
        host_field_candidates=settings.host_field_candidates,
        port_field_candidates=settings.port_field_candidates,
        default_metrics_port=settings.default_metrics_port,
    )