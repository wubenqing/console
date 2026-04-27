import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class AppRoutesTest(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "GPUSTACK_API_URL": "https://gpustack.example.com",
            "GPUSTACK_API_KEY": "secret",
        },
        clear=False,
    )
    def test_healthz_returns_ok(self):
        from app import app

        client = TestClient(app)
        response = client.get("/healthz")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})

    @patch.dict(
        os.environ,
        {
            "GPUSTACK_API_URL": "https://gpustack.example.com",
            "GPUSTACK_API_KEY": "secret",
        },
        clear=False,
    )
    def test_targets_endpoint_returns_http_sd_payload(self):
        from app import app

        client = TestClient(app)

        with patch("app.routes.fetch_prometheus_targets") as fetch_targets:
            fetch_targets.return_value = [
                {
                    "targets": ["10.0.0.15:8000"],
                    "labels": {
                        "model_id": "8",
                        "model_name": "qwen3-14b",
                        "instance_id": "99",
                        "instance_name": "qwen3-14b-instance-1",
                    },
                }
            ]

            response = client.get("/prometheus/vllm/targets")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["targets"], ["10.0.0.15:8000"])

    @patch.dict(
        os.environ,
        {
            "GPUSTACK_API_URL": "https://gpustack.example.com",
            "GPUSTACK_API_KEY": "secret",
        },
        clear=False,
    )
    def test_targets_endpoint_returns_bad_gateway_on_gpustack_failure(self):
        from app import app

        client = TestClient(app)

        with patch("app.routes.fetch_prometheus_targets", side_effect=RuntimeError("boom")):
            response = client.get("/prometheus/vllm/targets")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "boom")


if __name__ == "__main__":
    unittest.main()