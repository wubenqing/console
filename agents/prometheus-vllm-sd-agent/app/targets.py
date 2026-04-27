from __future__ import annotations


def build_prometheus_targets(
    models,
    instances_by_model,
    allowed_model_names,
    host_field_candidates=None,
    port_field_candidates=None,
    default_metrics_port=None,
):
    allowed_names = set(allowed_model_names or [])
    host_candidates = tuple(host_field_candidates or ("ip", "host"))
    port_candidates = tuple(port_field_candidates or ("port",))
    fallback_port = default_metrics_port
    targets = []

    for model in models:
        if str(model.get("backend", "")).lower() != "vllm":
            continue

        if allowed_names and model.get("name") not in allowed_names:
            continue

        for instance in instances_by_model.get(model.get("id"), []):
            host = _first_non_empty(instance, host_candidates)
            port = _first_non_empty(instance, port_candidates)
            if port in (None, ""):
                port = fallback_port

            if not host or port in (None, ""):
                continue

            targets.append(
                {
                    "targets": [f"{host}:{port}"],
                    "labels": {
                        "model_id": str(model["id"]),
                        "model_name": str(model["name"]),
                        "instance_id": str(instance["id"]),
                        "instance_name": str(instance["name"]),
                    },
                }
            )

    return targets


def _first_non_empty(payload, candidates):
    for key in candidates:
        value = payload.get(key)
        if value not in (None, ""):
            return value

    return None