from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    gpustack_api_url: str
    gpustack_api_key: str
    bind_host: str = "0.0.0.0"
    bind_port: int = 18083
    allowed_model_names: tuple[str, ...] = ()
    request_timeout_seconds: float = 10.0
    default_metrics_port: int = 8000
    host_field_candidates: tuple[str, ...] = ("metrics_host", "worker_ip", "ip", "host")
    port_field_candidates: tuple[str, ...] = ("metrics_port", "port")


def load_settings() -> Settings:
    api_url = os.environ.get("GPUSTACK_API_URL", "").strip()
    api_key = os.environ.get("GPUSTACK_API_KEY", "").strip()
    if not api_url or not api_key:
        raise ValueError("GPUSTACK_API_URL and GPUSTACK_API_KEY are required")

    return Settings(
        gpustack_api_url=api_url.rstrip("/"),
        gpustack_api_key=api_key,
        bind_host=os.environ.get("PROMETHEUS_VLLM_SD_HOST", "0.0.0.0").strip() or "0.0.0.0",
        bind_port=int(os.environ.get("PROMETHEUS_VLLM_SD_PORT", "18083")),
        allowed_model_names=_split_csv(os.environ.get("GPUSTACK_ALLOWED_MODEL_NAMES", "")),
        request_timeout_seconds=float(os.environ.get("TARGET_REQUEST_TIMEOUT_SECONDS", "10")),
        default_metrics_port=int(os.environ.get("TARGET_DEFAULT_METRICS_PORT", "8000")),
        host_field_candidates=_split_csv(
            os.environ.get("TARGET_HOST_FIELD_CANDIDATES", "metrics_host,worker_ip,ip,host")
        ),
        port_field_candidates=_split_csv(os.environ.get("TARGET_PORT_FIELD_CANDIDATES", "metrics_port,port")),
    )


def _split_csv(value: str) -> tuple[str, ...]:
    items = [item.strip() for item in value.split(",") if item.strip()]
    return tuple(items)