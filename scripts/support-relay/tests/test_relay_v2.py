"""Closed package-v2 validator parity and actual HTTP/transport witnesses (#942)."""
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

import test_relay as helpers
from test_relay import build_body, request_json, validate

FIXTURE = Path(__file__).parent / "fixtures" / "package-v2.json"


class V2TestCase(unittest.TestCase):
    setUp = helpers.RelayTestCase.setUp
    tearDown = helpers.RelayTestCase.tearDown
    post = helpers.RelayTestCase.post
    def test_schema_copy_and_both_actual_validators_accept_the_same_closed_package(self):
        root = Path(__file__).resolve().parents[3]
        canonical = root / "custom_components/houseplan/support_wire_schema.py"
        copied = Path(validate.__file__).with_name("support_wire_schema.py")
        self.assertEqual(canonical.read_bytes(), copied.read_bytes())
        spec = importlib.util.spec_from_file_location("canonical_support_wire", canonical)
        module = importlib.util.module_from_spec(spec)
        # Dataclasses resolve their defining module while it is being loaded.
        import sys
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        package = json.loads(FIXTURE.read_bytes())
        module.validate_package(package)
        status, payload = self.post(request_json(FIXTURE.read_bytes()), FIXTURE.read_bytes())
        self.assertEqual(status, 200, payload)
        self.assertEqual(self.provider.calls[0][2], FIXTURE.read_bytes())
        bad_inputs = []
        for path, value in [
            (("diagnostics", "environment", "opaque"), "secret"),
            (("diagnostics", "schema"), True),
            (("version",), 3),
            (("diagnostics", "devices", "entities"), [{"id": "sensor.raw", "shape": "numeric"}]),
            (("diagnostics", "vacuums"), [{"marker": "marker-case-1", "current": {"sample": {"kept_points": True}}}]),
        ]:
            bad = copy.deepcopy(package)
            parent = bad
            for key in path[:-1]:
                parent = parent[key]
            parent[path[-1]] = value
            bad_inputs.append(bad)
        for index, bad in enumerate(bad_inputs):
            with self.subTest(index=index):
                with self.assertRaises(module.WireRejected):
                    module.validate_package(bad)
                raw = json.dumps(bad).encode()
                status, payload = self.post(request_json(raw, key=f"invalid-v2-{index}"), raw, source=f"203.0.113.{index + 2}")
                self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_duplicate_keys_deep_input_wrong_hash_and_typed_counts_are_rejected(self):
        raw = FIXTURE.read_bytes()
        duplicate = raw.replace(b'"version":2', b'"version":2,"version":2')
        self.assertNotEqual(duplicate, raw)
        for index, blob in enumerate((duplicate, b"[" * 1500 + b"]" * 1500)):
            status, payload = self.post(request_json(blob, key=f"bad-json-{index}"), blob, source=f"203.0.113.{index + 50}")
            self.assertEqual((status, payload["error"]), (400, "support_rejected"))
        request = request_json(raw, key="v2-wrong-digest")
        request["attachment"]["sha256"] = "0" * 64
        status, payload = self.post(request, raw, source="203.0.113.60")
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))


class V2HttpTestCase(unittest.TestCase):
    setUp = helpers.HttpSurfaceTestCase.setUp
    tearDown = helpers.HttpSurfaceTestCase.tearDown
    call = helpers.HttpSurfaceTestCase.call
    def test_http_v2_attachment_is_exact_and_nested_unknown_is_not_accepted(self):
        raw = FIXTURE.read_bytes()
        content_type, body = build_body(request_json(raw, key="http-v2-positive"), raw)
        status, payload = self.call("POST", "/v1/reports", body, content_type)
        self.assertEqual(status, 200, payload)
        self.assertEqual(self.service.delivery.calls[0][2], raw)
        package = json.loads(raw)
        package["diagnostics"]["environment"]["debug"] = "opaque provider response"
        bad = json.dumps(package).encode()
        content_type, body = build_body(request_json(bad, key="http-v2-negative"), bad)
        status, payload = self.call("POST", "/v1/reports", body, content_type)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))
