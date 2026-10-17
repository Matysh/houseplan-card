"""Synthetic end-to-end builder/privacy/consumer witnesses for #942."""

import copy
import json
from hashlib import sha256

import pytest
from test_support_package import _facts, _source

from custom_components.houseplan.support_diagnostic_values import (
    GeometryBudget,
    sample_path,
)
from custom_components.houseplan.support_package import (
    SupportPackageError,
    build_support_package,
)
from custom_components.houseplan.support_wire_schema import validate_package
from custom_components.houseplan.vacuum_routes import adopt_legacy_run, effective_routes


def build(config, *, client=None, server=None, namespace="case", version=2, **extra):
    return build_support_package(
        config,
        extra.pop("layout", {}),
        config_rev=7,
        layout_rev=9,
        card_version="1.81.0",
        integration_version="1.81.0",
        home_assistant_version="2026.10.2",
        runtime=_facts(),
        namespace=namespace,
        package_version=version,
        diagnostics=client,
        server_snapshot=server,
        **extra,
    )


def test_real_v2_builder_extends_allowlist_without_changing_old_v1_bytes():
    config, layout, forbidden = _source()
    original = copy.deepcopy(config)
    raw1, _ = build(config, version=1, layout=layout)
    raw, preview = build(config, layout=layout)
    assert config == original
    package = json.loads(raw)
    validate_package(package)
    assert preview["version"] == 2 and preview["sha256"] == sha256(raw).hexdigest()
    assert (
        preview["size"] == len(raw)
        and preview["coverage"] == package["diagnostics"]["coverage"]
    )
    assert "diagnostics" not in json.loads(raw1) and json.loads(raw1)["version"] == 1
    assert "summary_panel" not in json.loads(raw1)["plan_backup"]["config"]["settings"]
    assert "summary_panel" in package["plan_backup"]["config"]["settings"]
    assert all(value not in raw.decode() for value in forbidden)
    assert package["diagnostics"]["snapshot"]["client_status"] == "missing"
    assert (
        next(row for row in preview["coverage"] if row["category"] == "devices")[
            "status"
        ]
        == "unavailable"
    )


@pytest.mark.parametrize("root,matches", [("camera.a", False), ("camera.b", True)])
def test_918_identity_rejection_survives_actual_builder_and_actual_run_adoption(
    root, matches
):
    config = {
        "model_version": 10,
        "settings": {},
        "spaces": [{"id": "s", "rooms": []}],
        "markers": [
            {
                "id": "m",
                "binding": "entity:vacuum.robot",
                "space": "s",
                "vacuum": {
                    "source": root,
                    "map_routes": [
                        {
                            "id": "r",
                            "source": "camera.b",
                            "map_id": "1",
                            "space": "s",
                            "calibration": [1.5, 0.1, -0.1, 2, 300, -5],
                        }
                    ],
                },
            }
        ],
    }
    run = {
        "map_id": "1",
        "path_format": 2,
        "started": 100.25,
        "ended": None,
        "received_at": 120,
        "sample": sample_path([[[10.123456789012, 20], [11, 21]]], GeometryBudget()),
    }
    server = {
        "available": True,
        "trails_available": True,
        "now": 110,
        "vacuums": [
            {
                "marker": "m",
                "vacuum_entity": "vacuum.robot",
                "status": "available",
                "activity": "moving",
                "current": run,
                "sources": [],
            }
        ],
    }
    raw, _ = build(config, server=server)
    package = json.loads(raw)
    marker = package["plan_backup"]["config"]["markers"][0]
    projected_run = package["diagnostics"]["vacuums"][0]["current"]
    routes = effective_routes(
        marker["id"], marker["vacuum"], marker["space"], marker["vacuum"]["source"]
    )
    result = adopt_legacy_run(projected_run, routes, marker["vacuum"]["source"])
    assert (result["kind"] == "adopted") is matches
    assert projected_run["received"] == {"state": "valid", "age_s": -10}
    assert projected_run["started"] == {"state": "valid", "age_s": 9.75}
    assert projected_run["ended"] == {"state": "null"}
    assert projected_run["sample"]["fragments"][0]["points"][0] == [10.123456789012, 20]
    assert routes[0]["calibration"] == [1.5, 0.1, -0.1, 2, 300, -5]
    assert "route_id" not in projected_run
    assert root not in raw.decode() and "camera.b" not in raw.decode()


def test_stale_client_claims_never_replace_server_identity_or_current_facts():
    client = {
        "schema": 1,
        "config_rev": 6,
        "layout_rev": 9,
        "limited": False,
        "devices": [{"id": "m", "binding": "virtual", "status": "alarm"}],
        "vacuums": [],
        "environment": {"mode": "plan", "projection": "flat", "space": "s"},
    }
    raw, _ = build(
        {"settings": {}, "spaces": [], "markers": [{"id": "m", "binding": "virtual"}]},
        client=client,
    )
    diagnostic = json.loads(raw)["diagnostics"]
    assert diagnostic["snapshot"]["client_status"] == "revision_mismatch"
    assert diagnostic["devices"]["client"] == []
    assert "alarm" not in raw.decode()
    assert "revision_mismatch" in diagnostic["coverage"][1]["reasons"]


def test_versions_malformed_fields_and_random_package_namespaces_fail_closed():
    config = {
        "settings": {},
        "spaces": [],
        "markers": [{"id": "private-m", "binding": "virtual"}],
    }
    for version in (True, "2", 0, 3):
        with pytest.raises(SupportPackageError, match="support_rejected"):
            build(config, version=version)
    with pytest.raises(SupportPackageError, match="support_rejected"):
        build(config, version=1, client={})
    first, _ = build(config, namespace=None)
    second, _ = build(config, namespace=None)
    assert (
        json.loads(first)["plan_backup"]["config"]["markers"][0]["id"]
        != json.loads(second)["plan_backup"]["config"]["markers"][0]["id"]
    )
    config["markers"][0]["glow_color"] = {"c": "private text"}
    with pytest.raises(SupportPackageError, match="support_rejected"):
        build(config)


def test_global_samples_are_capped_honestly_without_removing_essential_config():
    config = {
        "settings": {},
        "spaces": [],
        "markers": [{"id": f"m{i}", "binding": "virtual"} for i in range(2001)],
    }
    config["markers"][0]["vacuum"] = {"source": "camera.a"}
    input_path = sample_path(
        [[[i, i * 2] for i in range(10_000)]], GeometryBudget(scans=8192)
    )
    server = {
        "available": True,
        "trails_available": True,
        "now": 10,
        "vacuums": [
            {
                "marker": "m0",
                "status": "available",
                "activity": "stopped",
                "current": {"sample": input_path},
                "previous": {"sample": input_path},
                "sources": [{"source": "camera.a", "input": input_path}],
            }
        ],
    }
    raw, meta = build(config, server=server)
    packet = json.loads(raw)
    assert len(packet["plan_backup"]["config"]["markers"]) == 2001
    vacuum = packet["diagnostics"]["vacuums"][0]
    assert vacuum["current"]["sample"]["kept_points"] == 4096
    assert vacuum["previous"]["sample"]["kept_points"] == 0
    assert vacuum["sources"][0]["input"]["kept_points"] == 0
    assert vacuum["current"]["sample"]["raw_points"] == 10_000
    assert vacuum["current"]["sample"]["scan_limited"] is True
    assert len(raw) < 2 * 1024 * 1024
    assert (
        "geometry_limit"
        in next(row for row in meta["coverage"] if row["category"] == "vacuums")[
            "reasons"
        ]
    )


def test_unknown_subsystems_and_missing_client_are_not_reported_complete():
    config = {
        "settings": {"summary_panel": {"version": 3}},
        "spaces": [],
        "markers": [{"id": "m", "binding": "virtual", "radar": {"version": 2}}],
    }
    _, meta = build(config)
    coverage = {row["category"]: row for row in meta["coverage"]}
    assert coverage["config"]["status"] == "partial"
    assert coverage["config"]["reasons"] == ["unsupported_version"]
    assert coverage["vacuums"] == {
        "category": "vacuums",
        "status": "not_applicable",
        "reasons": [],
        "observed": 0,
        "total": 0,
    }


def test_diagnostic_byte_cap_reduces_runtime_facts_with_original_total():
    entities = [{"id": f"sensor.e{i}", "exists": True, "disabled": False,
                 "availability": "available", "shape": "numeric", "state": "other",
                 "family": "mqtt", "integration": "mqtt", "attributes": [
                     {"id": f"attr{j}", "present": True, "shape": "numeric"} for j in range(4)]}
                for i in range(8192)]
    raw, _ = build({"settings": {}, "spaces": [], "markers": []}, server={"available": True, "entities": entities})
    result = json.loads(raw)["diagnostics"]
    assert result["devices"]["total_entities"] == 8192
    assert len(result["devices"]["entities"]) < 8192
    assert len(json.dumps(result).encode()) < 2 * 1024 * 1024
    assert "collection_limit" in next(row for row in result["coverage"] if row["category"] == "devices")["reasons"]
