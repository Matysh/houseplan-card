"""vacuum_routes.py — питоновское зеркало src/vacuum-routes.ts (#162)."""
import json
import pathlib
import re
import types

ROOT = pathlib.Path(__file__).parent.parent
# Модуль читается текстом и исполняется в собственном пространстве имён: ни
# sys.path, ни sys.modules не трогаются намеренно (#393, класс #389).
_source = (ROOT / "custom_components" / "houseplan" / "vacuum_routes.py").read_text(
    encoding="utf-8")
vr = types.ModuleType("vacuum_routes_under_test")
vr.__dict__["re"] = re
exec(compile(_source, "vacuum_routes.py", "exec"), vr.__dict__)

FIXTURES = ROOT / "test" / "fixtures" / "vacuum-routes"
IDENTITY = [1, 0, 0, 0, 1, 0]


def _fixture(name):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def _route(**over):
    base = {
        "id": "r1", "source": "camera.robot", "map_id": "m1",
        "space": "floor1", "calibration": IDENTITY,
    }
    base.update(over)
    return base


def test_matrix_normalisation_matches_frontend():
    assert vr.normalize_route_matrix(IDENTITY) == [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    assert vr.normalize_route_matrix([1, 0, 0, 0, 1]) is None
    assert vr.normalize_route_matrix([1, 0, 0, 0, 1, float("nan")]) is None
    assert vr.normalize_route_matrix([1, 0, 0, 0, 1, True]) is None
    assert vr.normalize_route_matrix("нет") is None


def test_validation_reasons():
    assert vr.validate_marker_routes("mk", [_route()], {"floor1"}) == []
    assert vr.validate_marker_routes("mk", None, {"floor1"}) == []
    assert [p["reason"] for p in vr.validate_marker_routes(
        "mk", [_route(map_id="")], {"floor1"})] == []
    assert [p["reason"] for p in vr.validate_marker_routes(
        "mk", [_route(map_id=0)], {"floor1"})] == ["map_id"]
    assert [p["reason"] for p in vr.validate_marker_routes(
        "mk", [_route(), _route(id="r2")], {"floor1"})] == ["duplicate_identity"]
    assert sorted(p["reason"] for p in vr.validate_marker_routes(
        "mk", [_route(), _route(map_id="m2", space="gone")], {"floor1"})) == [
        "duplicate_id", "unknown_space"]
    # превью импорта ещё не знает целевых пространств
    assert vr.validate_marker_routes("mk", [_route(space="gone")], None) == []
    many = [_route(id=f"r{i}", map_id=f"m{i}") for i in range(vr.VAC_ROUTE_LIMIT + 1)]
    assert any(p["reason"] == "limit" for p in vr.validate_marker_routes("mk", many, {"floor1"}))


def test_legacy_calibration_reads_as_routes_into_dock_space():
    vacuum = {"source": "camera.robot", "calibration": {"m1": IDENTITY, "bad": [1, 2]}}
    routes = vr.effective_routes("mk", vacuum, "floor1")
    assert [r["map_id"] for r in routes] == ["m1"]
    assert routes[0]["space"] == "floor1"
    assert routes[0]["id"] == vr.legacy_route_id("mk", "camera.robot", "m1")
    explicit = dict(vacuum, map_routes=[_route(id="r9", map_id="m9", space="floor2")])
    assert [r["id"] for r in vr.effective_routes("mk", explicit, "floor1")] == ["r9"]


def test_explicit_empty_routes_remain_authoritative():
    legacy = {"source": "camera.robot", "calibration": {"m1": IDENTITY}}
    assert len(vr.effective_routes("mk", legacy, "floor1")) == 1
    assert len(vr.effective_routes(
        "mk", {**legacy, "map_routes": None}, "floor1")) == 1
    assert vr.effective_routes(
        "mk", {**legacy, "map_routes": []}, "floor1") == []


def test_resolve_shared_fixture():
    for row in _fixture("resolve"):
        got = vr.resolve_route(row["routes"], row["observed"], set(row["spaces"]))
        assert got["kind"] == row["expected"]["kind"], row["name"]
        if "route_id" in row["expected"]:
            assert got["route"]["id"] == row["expected"]["route_id"], row["name"]
        if "space" in row["expected"]:
            assert got["route"]["space"] == row["expected"]["space"], row["name"]
        if "route_ids" in row["expected"]:
            assert got["routeIds"] == row["expected"]["route_ids"], row["name"]
        if "source" in row["expected"]:
            assert got["source"] == row["expected"]["source"], row["name"]
        if "map_id" in row["expected"]:
            assert got["mapId"] == row["expected"]["map_id"], row["name"]


def test_resolve_is_order_independent():
    for row in _fixture("resolve"):
        straight = vr.resolve_route(row["routes"], row["observed"], set(row["spaces"]))
        reversed_ = vr.resolve_route(
            list(reversed(row["routes"])), row["observed"], set(row["spaces"]))
        assert reversed_ == straight, row["name"]


def test_adopt_legacy_run_shared_fixture():
    for row in _fixture("legacy-run"):
        got = vr.adopt_legacy_run(row["run"], row["routes"], row["root_source"])
        assert got["kind"] == row["expected"]["kind"], row["name"]
        if "route_id" in row["expected"]:
            assert got["route"]["id"] == row["expected"]["route_id"], row["name"]
        if "route_ids" in row["expected"]:
            assert got["routeIds"] == row["expected"]["route_ids"], row["name"]


def test_adopt_rejects_run_without_map_id():
    for run in (None, {}, {"map_id": 1}):
        assert vr.adopt_legacy_run(run, [_route()], "camera.robot")["kind"] == "orphan_run"
