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
        # #920: the new optional room metric must pass the actual deployed
        # boundary, not just the integration's copy of the closed schema.
        package["plan_backup"]["config"]["spaces"] = [{
            "id": "space-case-1", "settings": {"label_co2": True},
            "rooms": [{"id": "room-case-1", "settings": {
                "co2_source": "entity:entity-case-1", "co2_source_kind": "entity",
            }}],
        }]
        package["plan_backup"]["config"]["markers"] = [{
            "id": "marker-case-1", "binding_kind": "entity", "binding": "entity:entity-case-1",
            "vacuum": {"new_run_after_dock": True}, "tap_action": "settings",
        }]
        package["diagnostics"]["devices"]["client"] = [{
            "id": "marker-case-1", "binding": "entity:entity-case-1", "tap_action": "settings",
        }]
        module.validate_package(package)
        positive = json.dumps(package).encode()
        status, payload = self.post(request_json(positive), positive)
        self.assertEqual(status, 200, payload)
        self.assertEqual(self.provider.calls[0][2], positive)
        bad_inputs = []
        for path, value in [
            (("diagnostics", "environment", "opaque"), "secret"),
            (("diagnostics", "schema"), True),
            (("version",), 3),
            (("plan_backup", "config", "markers"), [{"id": "marker-case-1", "vacuum": {"new_run_after_dock": "true"}}]),
            (("plan_backup", "config", "markers"), [{"id": "marker-case-1", "tap_action": "future-settings"}]),
            (("plan_backup", "config", "markers"), [{"id": "marker-case-1", "tap_action": {"private": "not an action"}}]),
            (("diagnostics", "devices", "client"), [{"id": "marker-case-1", "tap_action": "future-settings"}]),
            (("diagnostics", "devices", "client"), [{"id": "marker-case-1", "tap_action": {"private": "not an action"}}]),
            (("diagnostics", "devices", "entities"), [{"id": "sensor.raw", "shape": "numeric"}]),
            (("diagnostics", "vacuums"), [{"marker": "marker-case-1", "current": {"sample": {"kept_points": True}}}]),
            (("plan_backup", "config", "spaces"), [{"settings": {"label_co2": "true"}}]),
            (("plan_backup", "config", "spaces"), [{"rooms": [{"settings": {"co2_source": "sensor.raw"}}]}]),
            (("plan_backup", "config", "spaces"), [{"rooms": [{"settings": {"co2_source_kind": "future"}}]}]),
            # #943: legacy storage may keep this role, diagnostic wire must not.
            (("plan_backup", "config", "settings", "fill_colors"), {"glow_base": {"c": "#15ff2a", "a": 1}}),
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
