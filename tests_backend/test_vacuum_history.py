"""Ordinary inputs prove record/map identities and all-or-nothing decoding."""
import copy
import json

import pytest

from custom_components.houseplan.vacuum_history import (
    history_catalog,
    history_route,
    history_snapshot,
)
from custom_components.houseplan.vacuum_paths import (
    DREAME_SCHEMA,
    PathRejected,
    dreame_snapshot,
)


def metadata(rows=((1, 1792800000),)):
    return {f"localized label {index}": f"/api/camera_history_map_proxy/camera.map?token=DO_NOT_RETURN&index={index}&v={stamp}"
            for index, stamp in rows}


def payload(**patch):
    return json.dumps({"version": 2, "history_map": True, "completed": True,
                      "map_id": 77, "saved_map_id": 36, "map_index": 1, "frame_id": 4,
                      "path": [[1, 0, 0, 1000, 0, 1000, 1000], [2, 5000, 0, 5000, 200]], **patch})


def witness():
    return {"current": {"path_format": 2, "source": "camera.map", "map_id": "floor", "route_id": "r",
                        "provenance": {"provider": "dreame", "schema": DREAME_SCHEMA},
                        "quality": {"source": "native"}, "_native_identity": ["dreame", "[1,36,1]"]}}


ROUTE = {"id": "r", "source": "camera.map", "map_id": "floor", "space": "f1",
         "calibration": [.001, 0, 10, 0, .001, 20]}


def test_catalog_machine_start_time_opaque_identity_and_index_shift():
    rows, revision, limited = history_catalog(metadata(((1, 1792800010), (2, 1792800040))), "camera.map", "vacuum.robot")
    assert [row.timestamp for row in rows] == [1792800040, 1792800010]
    assert not limited and len(revision) == 64 and all(len(row.id) == 64 for row in rows)
    assert "DO_NOT_RETURN" not in repr(rows) + revision
    shifted, new_revision, _ = history_catalog(metadata(((2, 1792800010), (3, 1792800040))), "camera.map", "vacuum.robot")
    assert [row.id for row in shifted] == [row.id for row in rows]
    assert new_revision != revision and shifted[0].index == 3
    same = metadata(((1, 1792800010), (2, 1792800040)))
    same = {key: url.replace("DO_NOT_RETURN", "ROTATED_TOKEN") for key, url in same.items()}
    assert history_catalog(same, "camera.map", "vacuum.robot")[1] == revision
    assert history_catalog(same, "camera.map", "vacuum.other")[1] != revision


@pytest.mark.parametrize("rows", [((1, 1792800000), (2, 1792800000)), ((1, 1792800000), (1, 1792800010))])
def test_catalog_ambiguous_identity_is_not_first_match(rows):
    raw = {str(i): url for i, url in enumerate(metadata(rows).values())}
    if rows[0][0] == rows[1][0]:
        raw = {"a": next(iter(metadata((rows[0],)).values())), "b": next(iter(metadata((rows[1],)).values()))}
    with pytest.raises(PathRejected, match="ambiguous"):
        history_catalog(raw, "camera.map", "vacuum.robot")


@pytest.mark.parametrize("suffix", ["&index=2", "&v=1792800001", "&cruising=1", "&wifi_map=1", "&cleaning_map=1"])
def test_catalog_rejects_ambiguous_or_noncleanup_query(suffix):
    with pytest.raises(PathRejected):
        history_catalog({"a": next(iter(metadata().values())) + suffix}, "camera.map", "vacuum.robot")


def test_catalog_empty_limited_and_foreign_source_are_distinct():
    assert history_catalog({}, "camera.map", "vacuum.robot")[0] == []
    rows, _, limited = history_catalog(metadata(tuple((i, 1792800000 + i) for i in range(1, 102))), "camera.map", "vacuum.robot")
    assert len(rows) == 100 and limited
    with pytest.raises(PathRejected, match="unsupported"):
        history_catalog(metadata(), "camera.other", "vacuum.robot")
    with pytest.raises(PathRejected, match="unsupported"):
        history_catalog(None, "camera.map", "vacuum.robot")
    with pytest.raises(PathRejected, match="limited"):
        history_catalog({"x" * 66000: "url"}, "camera.map", "vacuum.robot")


def test_genuine_numeric_history_exact_route_and_row_major_affine():
    value, completed = history_snapshot(payload())
    assert completed and value.paths == [[[0, 0], [1000, 0], [1000, 1000]], [[5000, 0], [5000, 200]]]
    route = history_route(value, [ROUTE], witness(), {"f1"})
    a, b, c, d, e, f = route["calibration"]
    assert [[a*x + b*y + c, d*x + e*y + f] for x, y in value.paths[0]] == [[10, 20], [11, 20], [11, 21]]
    with pytest.raises(PathRejected, match="unsupported"):
        dreame_snapshot(payload())
    empty, completed = history_snapshot(payload(path=[], completed=False))
    assert empty.paths == [] and completed is False


@pytest.mark.parametrize("patch", [
    {"history_map": False}, {"history_map": 1}, {"version": 3}, {"completed": None},
    {"saved_map": True}, {"wifi_map": True}, {"recovery_map": True}, {"cruising": True},
    {"saved_map": "true"}, {"wifi_map": 1}, {"recovery_map": None}, {"cruising": []},
    {"frame_id": None}, {"map_id": None}, {"saved_map_id": True}, {"map_index": False},
    {"path": None}, {"path": [[1, 0, 0, float("nan"), 1]]}, {"path": [[1, 0, 0, True, 1]]},
    {"path": [[1, 0, 0], [2, 1]]}, {"path": [[1, 0, 0, 1]]}, {"path": [[True, 0, 0]]},
])
def test_partial_or_wrong_passport_never_becomes_a_shorter_path(patch):
    with pytest.raises(PathRejected):
        history_snapshot(payload(**patch))


def test_geometry_limits_reject_whole_value():
    for raw in (payload(path=[[1, *([0, 0] * 100001)]]), payload(path=[[1, 0, 0]] * 1025), " " * (8*1024*1024 + 1)):
        with pytest.raises(PathRejected, match="limited"):
            history_snapshot(raw)


@pytest.mark.parametrize("field,value", [("source", "camera.other"), ("route_id", "other"), ("map_id", "other"),
                                        ("path_format", 99), ("_native_identity", None),
                                        ("_native_identity", ["dreame", "[77,99,1]"]),
                                        ("_native_identity", ["dreame", '[77,"36",1]']),
                                        ("_native_identity", ["dreame", "[77,36,0]"])])
def test_same_bounds_foreign_or_unproved_native_map_is_refused(field, value):
    book = witness()
    book["current"][field] = value
    with pytest.raises(PathRejected, match="coordinates_unverified"):
        history_route(history_snapshot(payload())[0], [ROUTE], book, {"f1"})


def test_previous_coordinate_witness_zero_and_ambiguous_routes():
    value = history_snapshot(payload(saved_map_id=0, map_index=0))[0]
    book = witness()
    book["previous"] = book.pop("current")
    book["previous"]["_native_identity"] = ["dreame", "[1,0,0]"]
    assert history_route(value, [ROUTE], book, {"f1"}) == ROUTE
    duplicate = copy.deepcopy(book["previous"])
    duplicate["route_id"] = "r2"
    book["current"] = duplicate
    with pytest.raises(PathRejected, match="ambiguous"):
        history_route(value, [ROUTE, {**ROUTE, "id": "r2"}], book, {"f1"})
    with pytest.raises(PathRejected, match="missing_space"):
        history_route(value, [ROUTE], book, set())
    with pytest.raises(PathRejected, match="needs_calibration"):
        history_route(value, [{**ROUTE, "calibration": None}], book, {"f1"})


def test_history_transport_map_id_alone_does_not_prove_the_saved_floor():
    book = witness()
    book["current"]["_native_identity"] = ["dreame", "[77,null,1]"]
    with pytest.raises(PathRejected, match="coordinates_unverified"):
        value = history_snapshot(payload(saved_map_id=None))[0]
        history_route(value, [ROUTE], book, {"f1"})
    # Restored ordinary maps may legitimately identify saved floor 36 by map_id;
    # the historical side must still carry its explicit saved floor witness.
    book["current"]["_native_identity"] = ["dreame", "[36,null,1]"]
    assert history_route(history_snapshot(payload())[0], [ROUTE], book, {"f1"}) == ROUTE


def test_metadata_encode_allocation_is_bounded_before_building_oversized_json():
    import tracemalloc

    # One shared public URL costs only 16 KiB in the incoming mapping. Encoding
    # its repeated values must not allocate tens of MiB merely to reject 64 KiB.
    url = next(iter(metadata().values())) + "&token=" + "x" * 16000
    oversized = {f"record-{index}": url for index in range(1000)}
    tracemalloc.start()
    try:
        with pytest.raises(PathRejected, match="limited"):
            history_catalog(oversized, "camera.map", "vacuum.robot")
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    assert peak < 2 * 1024 * 1024, f"metadata rejection allocated {peak} bytes"


@pytest.mark.parametrize("label", ["ю" * 40000, "\u0001" * 12000])
def test_metadata_character_preflight_retains_exact_encoded_byte_limit(label):
    with pytest.raises(PathRejected, match="limited"):
        history_catalog({label: next(iter(metadata().values()))}, "camera.map", "vacuum.robot")
