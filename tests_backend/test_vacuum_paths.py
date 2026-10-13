"""#872 public provider values: actual codec, negative data, and privacy."""
import json

import pytest

from pure_imports import HOUSEPLAN_ROOT, load_pure

codec = load_pure("hp_vacuum_paths_872", HOUSEPLAN_ROOT / "vacuum_paths.py")


def test_dreame_ordinary_chunks_keep_type_boundaries_and_raw_units():
    value = codec.dreame_snapshot(json.dumps({
        "version": 2, "map_id": 12, "frame_id": 8, "path": [
            [1, -2000, 3000, -2000, 4000, -1000, 4000],
            [2, 0, 0, 1000, 0], [3, 1000, 0, 0, 0],
        ],
    }))
    assert value.paths == [
        [[-2000, 3000], [-2000, 4000], [-1000, 4000]],
        [[0, 0], [1000, 0]], [[1000, 0], [0, 0]],
    ]
    assert value.map_key == "[12,null,null]"
    assert value.revision == 8
    assert value.job_id is None and not value.final
    assert codec.dreame_snapshot('{"version":2,"map_id":12,"path":[]}').paths == []


@pytest.mark.parametrize("point", [[True, 1], [float("nan"), 1],
                                   [float("inf"), 1], ["2", 3], None, {"x": 2}])
def test_bad_point_breaks_path_never_joins_sides(point):
    assert codec.normalize_paths([[0, 0], [1, 1], point, [100, 100], [101, 101]]) == [
        [[0, 0], [1, 1]], [[100, 100], [101, 101]],
    ]


def test_revisits_are_not_global_duplicates_and_dense_corner_survives():
    points = [[i, 0] for i in range(5000)]
    points[2402] = [2402, 1000]
    assert codec.normalize_paths(points)[0] == points
    assert codec.normalize_paths([[0, 0], [0, 0], [1, 0], [0, 0]]) == [
        [[0, 0], [1, 0], [0, 0]],
    ]


@pytest.mark.parametrize("payload", [
    '{"version":2,"path":[[1,0,0,1,1]]}',
    '{"version":2,"map_id":1,"path":[[true,0,0,1,1]]}',
    '{"version":2,"map_id":1,"path":[[9,0,0,1,1]]}',
    '{"version":2,"map_id":1,"path":[[1,0,0,1]]}',
    '{"version":2,"map_id":1,"saved_map":true,"path":[[1,0,0,1,1]]}',
    '{"version":2,"map_id":1,"wifi_map":true,"path":[[1,0,0,1,1]]}',
    '{"version":3,"map_id":1,"path":[[1,0,0,1,1]]}',
    'bad-json', '[]',
])
def test_unknown_schema_and_non_live_maps_do_not_get_guessed(payload):
    with pytest.raises(codec.PathRejected):
        codec.dreame_snapshot(payload)


def test_raw_and_segment_limits_reject_whole_snapshot():
    with pytest.raises(codec.PathRejected, match="limited"):
        codec.dreame_snapshot(" " * (codec.MAX_JSON_BYTES + 1))
    with pytest.raises(codec.PathRejected, match="limited"):
        codec.normalize_paths([[i, 1] for i in range(codec.MAX_POINTS + 1)])
    with pytest.raises(codec.PathRejected, match="limited"):
        codec.normalize_paths([[[0, 0], [1, 1]]] * (codec.MAX_SEGMENTS + 1))


def test_public_run_is_an_allowlist_not_recursive_secret_blacklist():
    geometry = [[[0, 0], [1, 1]]]
    run = {"path_format": 2, "paths": geometry, "points": geometry[-1],
           "source": "camera.secret", "_job_id": "private-job", "token": "secret",
           "_native_identity": ["private", "map"], "arbitrary": {"secret": "private"},
           "quality": {"source": "native", "reason": "ok"},
           "provenance": {"provider": "dreame", "schema": "tasshack-2.0.2"}}
    public = codec.public_trails({"m": {"current": run, "private": "no"}})
    assert public["m"]["current"]["paths"] == geometry
    assert not {"source", "token", "_job_id", "_native_identity", "arbitrary"} & public["m"]["current"].keys()
    assert run["source"] == "camera.secret"
    assert codec.public_trails({"m": {"current": {"path_format": 7, "points": geometry[-1]}}}) == {"m": {}}
    assert codec.public_trails({"m": {"current": {"path_format": True, "points": geometry[-1]}}}) == {"m": {}}
