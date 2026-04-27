from __future__ import annotations

from urllib.parse import urlencode

import httpx


class GpustackClient:
    def __init__(self, settings):
        self._settings = settings

    def list_models(self):
        payload = self._request("/models", {"page": -1})
        return payload.get("items", [])

    def list_model_instances(self, model_id):
        payload = self._request(f"/models/{model_id}/instances", {"page": -1})
        return payload.get("items", [])

    def _request(self, path, query):
        url = f"{self._settings.gpustack_api_url}/{path.lstrip('/')}"
        if query:
            url = f"{url}?{urlencode(query)}"

        response = httpx.get(
            url,
            headers={
                "Accept": "application/json",
                "X-API-Key": self._settings.gpustack_api_key,
            },
            timeout=self._settings.request_timeout_seconds,
        )
        response.raise_for_status()
        return response.json()