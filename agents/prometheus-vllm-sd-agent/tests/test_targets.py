import unittest

from app.targets import build_prometheus_targets


class BuildTargetsTest(unittest.TestCase):
    def test_filters_non_vllm_models_and_builds_minimal_labels(self):
        models = [
            {"id": 8, "name": "qwen3-14b", "backend": "vLLM"},
            {"id": 9, "name": "other", "backend": "sglang"},
        ]
        instances_by_model = {
            8: [
                {
                    "id": 99,
                    "model_id": 8,
                    "name": "qwen3-14b-instance-1",
                    "state": "running",
                    "ip": "10.0.0.15",
                    "port": 8000,
                }
            ]
        }

        result = build_prometheus_targets(models, instances_by_model, allowed_model_names=[])

        self.assertEqual(
            result,
            [
                {
                    "targets": ["10.0.0.15:8000"],
                    "labels": {
                        "model_id": "8",
                        "model_name": "qwen3-14b",
                        "instance_id": "99",
                        "instance_name": "qwen3-14b-instance-1",
                    },
                }
            ],
        )

    def test_uses_configured_address_fields_and_default_port(self):
        models = [{"id": 8, "name": "qwen3-14b", "backend": "vllm"}]
        instances_by_model = {
            8: [
                {
                    "id": 99,
                    "model_id": 8,
                    "name": "qwen3-14b-instance-1",
                    "state": "running",
                    "worker_ip": "10.0.0.21",
                }
            ]
        }

        result = build_prometheus_targets(
            models,
            instances_by_model,
            allowed_model_names=["qwen3-14b"],
            host_field_candidates=["worker_ip"],
            port_field_candidates=["metrics_port"],
            default_metrics_port=8000,
        )

        self.assertEqual(result[0]["targets"], ["10.0.0.21:8000"])


if __name__ == "__main__":
    unittest.main()