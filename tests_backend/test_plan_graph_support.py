"""Exact graph geometry survives support projection; opaque source never does."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.support_package import build_support_package
from custom_components.houseplan.support_wire_schema import PLAN_GRAPH, WireRejected, validate
from tests_backend.test_support_package import _facts


def test_graph_support_keeps_exact_geometry_and_consistent_private_refs():
    config = normalize_graph_config({"model_version": 10, "spaces": [{"id": "private-floor", "title": "Secret", "rooms": [], "partitions": [
        {"id": "private-edge", "a": [0, 0], "b": [1, 0], "cm": 10, "private": "token@example.test"},
        {"id": "branch", "a": [.5, 0], "b": [.5, .5], "cm": 10},
    ]}], "markers": [], "settings": {}})
    raw, _ = build_support_package(config, {}, config_rev=1, layout_rev=0,
                                  card_version="1", integration_version="1", home_assistant_version="2026.10.0",
                                  runtime=_facts(), repairs=[], namespace="graph")
    text = raw.decode()
    assert all(secret not in text for secret in ("private-floor", "private-edge", "Secret", "token@example.test"))
    package = json.loads(raw)
    graph = package["plan_backup"]["config"]["spaces"][0]["plan_graph"]
    validate(graph, PLAN_GRAPH)
    assert [n["p"] for n in graph["nodes"]] == [n["p"] for n in config["spaces"][0]["plan_graph"]["nodes"]]
    nodes = {n["id"] for n in graph["nodes"]}
    assert all(e["from"] in nodes and e["to"] in nodes and "props" not in e for e in graph["edges"])
    assert all(d["node"] in nodes and all(r["from"] in nodes and r["to"] in nodes for r in d["refs"]) for d in graph["dependencies"])
    poisoned = copy.deepcopy(graph)
    poisoned["edges"][0]["props"] = {"secret": "private"}
    with pytest.raises(WireRejected):
        validate(poisoned, PLAN_GRAPH)
    poisoned = copy.deepcopy(graph)
    poisoned["nodes"][0]["p"] = ["q", "secret", "1", "0", "1"]
    with pytest.raises(WireRejected):
        validate(poisoned, PLAN_GRAPH)


def test_closed_schema_relay_twin_is_exact():
    root = Path(__file__).parents[1]
    assert (root / "custom_components/houseplan/support_wire_schema.py").read_bytes() == (root / "scripts/support-relay/hp_relay/support_wire_schema.py").read_bytes()
