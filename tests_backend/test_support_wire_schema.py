"""Actual closed schema checks, not regex assertions about source (#942)."""

import copy
import json

import pytest
from test_support_config_projection import project

from custom_components.houseplan.support_diagnostic_values import (
    GeometryBudget,
    sample_path,
)
from custom_components.houseplan.support_wire_schema import (
    CLIENT_INPUT,
    CONFIG,
    DIAGNOSTICS,
    MATRIX,
    POINT,
    SAMPLE,
    Array,
    WireRejected,
    validate,
    validate_client,
)


def client():
    return {
        "schema": 1,
        "config_rev": 0,
        "layout_rev": 0,
        "devices": [],
        "vacuums": [],
        "environment": {"mode": "view", "projection": "flat", "space": "private-space"},
        "limited": False,
    }


@pytest.mark.parametrize("flag", [None, False, True])
def test_issue940_support_projects_only_public_boolean_and_bounded_empty_reason(flag):
    from custom_components.houseplan.support_diagnostic_values import DiagnosticIds
    from custom_components.houseplan.support_package import _project_marker
    from custom_components.houseplan.support_wire_schema import QUALITY_REASON, VAC_CONFIG
    marker = {"id": "robot", "binding": "entity:vacuum.private", "vacuum": {
        "new_run_after_dock": flag, "_policy": {"vacuum": "vacuum.private", "job": "private-job"}}}
    legacy = _project_marker(DiagnosticIds("940"), marker)
    assert legacy["vacuum"] == {"new_run_after_dock": flag}
    projected, _ = project({"spaces": [], "markers": [marker]})
    projected["model_version"] = 10
    assert projected["markers"][0]["vacuum"] == {"new_run_after_dock": flag}
    validate(projected, CONFIG)
    validate("empty_integration", QUALITY_REASON)
    with pytest.raises(WireRejected):
        validate({"new_run_after_dock": "true"}, VAC_CONFIG)
    with pytest.raises(WireRejected):
        validate({"new_run_after_dock": flag, "job": "private-job"}, VAC_CONFIG)
    assert "private-job" not in json.dumps(projected)


def test_closed_schema_accepts_projected_known_fields_and_raw_client_refs_only_on_input():
    config = {
        "model_version": 10,
        "spaces": [{"id": "s", "rooms": []}],
        "markers": [
            {
                "id": "m",
                "binding": "virtual",
                "vacuum": {"map_routes": [], "source": None},
            }
        ],
    }
    projected, _ = project(config)
    projected["model_version"] = 10
    validate(projected, CONFIG)
    value = client()
    assert validate_client(value) is value
    for update in ({"schema": True}, {"config_rev": False}, {"arbitrary": "secret"}):
        with pytest.raises(WireRejected):
            validate_client({**value, **update})
    bad = copy.deepcopy(value)
    bad["environment"]["url"] = "https://private.example"
    with pytest.raises(WireRejected):
        validate(bad, CLIENT_INPUT)


def test_known_field_wrong_types_and_nonfinite_geometry_do_not_pass_by_coercion():
    for bad in ([1], [1, 2, 3], [True, 2], ["1", 2], [float("inf"), 0]):
        with pytest.raises(WireRejected):
            validate(bad, POINT)
    for bad in ([1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6, 7], [True] * 6):
        with pytest.raises(WireRejected):
            validate(bad, MATRIX)
    validate([0] * 6, MATRIX)
    validate({"status": "invalid"}, MATRIX)
    output = sample_path([[[0, 0], [1, 1]], [[2, 2]]], GeometryBudget())
    validate(output, SAMPLE)
    output["fragments"][0]["private"] = "sensitive"
    with pytest.raises(WireRejected):
        validate(output, SAMPLE)


def test_depth_input_and_utf8_byte_limits_are_actual_rejections():
    value = client()
    value["devices"] = [
        {"id": "m", "binding": "virtual", "entities": ["x" * 512] * 512}
    ] * 3
    assert len(json.dumps(value).encode()) > 512 * 1024
    with pytest.raises(WireRejected):
        validate_client(value)
    value = client()
    value["devices"] = [{"id": "m", "binding": "virtual"}] * 2001
    with pytest.raises(WireRejected):
        validate_client(value)
    with pytest.raises(WireRejected):
        validate([[[[1]]]], Array(POINT), max_depth=1)


def test_coverage_cannot_be_an_arbitrary_backend_text_channel():
    diagnostic = {
        "schema": 1,
        "snapshot": {
            "config_rev": 0,
            "layout_rev": 0,
            "client_status": "missing",
            "parts": [],
        },
        "coverage": [
            {
                "category": category,
                "status": "partial",
                "reasons": ["missing_client"],
                "observed": 0,
                "total": 0,
            }
            for category in ("config", "devices", "vacuums", "environment")
        ],
        "devices": {"entities": [], "client": []},
        "vacuums": [],
        "environment": {},
    }
    validate(diagnostic, DIAGNOSTICS)
    diagnostic["coverage"][0]["reasons"] = ["private provider exception"]
    with pytest.raises(WireRejected):
        validate(diagnostic, DIAGNOSTICS)
