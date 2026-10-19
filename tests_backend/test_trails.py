"""TrailBook: the pure part of the server-side vacuum trails."""
import math
import pathlib
import uuid
import json
import copy
import pytest
from pure_imports import load_pure, HOUSEPLAN_ROOT
paths = load_pure("hp_vacuum_paths", HOUSEPLAN_ROOT / "vacuum_paths.py")
# TrailBook берётся без импорта: из trails.py читается текст и исполняется срез
# до класса TrailRecorder — только он тянет Home Assistant. Ни sys.path, ни
# sys.modules при этом не трогаются намеренно (#393): правка импорт-машины
# переживает свой тест и достаётся всей сессии, а чем это кончается, показал
# #389 — 85 тестов харнесса падали с голым `assert False`.
src = (pathlib.Path(__file__).parent.parent / "custom_components" / "houseplan" / "trails.py").read_text(encoding="utf-8")
ns = {"Any": object, "annotations": None, "math": math, "uuid": uuid, "json": json,
      "MAX_POINTS": paths.MAX_POINTS, "MAX_SEGMENTS": paths.MAX_SEGMENTS,
      "MAX_JSON_BYTES": paths.MAX_JSON_BYTES, "MAX_ENTRY_BYTES": paths.MAX_ENTRY_BYTES,
      "PathSnapshot": paths.PathSnapshot, "number": paths.number,
      "normalize_paths": paths.normalize_paths, "PathRejected": paths.PathRejected}
exec(src[src.index("TRAIL_CAP"):src.index("class TrailRecorder")], ns)
TrailBook = ns["TrailBook"]
TRAIL_CAP = ns["TRAIL_CAP"]
TRAIL_RESUME_GRACE_S = ns["TRAIL_RESUME_GRACE_S"]


def test_940_first_native_snapshot_needs_no_locally_observed_reset():
    book = TrailBook()
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    native = paths.snapshot("attributes", "full-path-v1", [[[0, 0], [100, 0]]], "floor")
    book.on_snapshot("robot", native, 2, "route", "floor", run["_generation"], False)
    assert run["quality"]["source"] == "native"
    assert run["paths"] == native.paths


def test_940_native_empty_replaces_current_not_previous_or_sampled_reserve():
    book = TrailBook()
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    native = paths.snapshot("attributes", "full-path-v1", [[[i, 0] for i in range(10)]], "floor")
    book.on_snapshot("robot", native, 2, "route", "floor", run["_generation"], True)
    book.on_point("robot", "floor", 99, 99, 3, "route", "camera.map")
    empty = paths.snapshot("attributes", "full-path-v1", [], "floor")
    book.on_snapshot("robot", empty, 4, "route", "floor", run["_generation"], True)
    public = paths.public_trails(book.data)["robot"]["current"]
    assert public["paths"] == []
    assert public["points"] == []
    assert public["quality"]["source"] == "native"
    assert "previous" not in book.data["robot"]


def test_940_native_path_outranks_local_long_stop_boundary():
    book = TrailBook()
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    native = paths.snapshot("attributes", "full-path-v1", [[[0, 0], [100, 0]]], "floor")
    book.on_snapshot("robot", native, 2, "route", "floor", run["_generation"], True)
    book.end_run("robot", 3)
    current, _ = book.ensure_run("robot", "floor", 3 + TRAIL_RESUME_GRACE_S + 1, "route", "camera.map")
    assert current is run
    assert current["paths"] == native.paths
    assert "previous" not in book.data["robot"]


@pytest.mark.parametrize("intermediate", [None, "idle", "paused", "error", "returning", "on", "unknown", "unavailable"])
def test_940_dock_policy_splits_positions_once_with_neutral_intermediates(intermediate):
    book = TrailBook()
    book.configure_policy("robot", "vacuum.robot", True)
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map", apply_policy=True)
    book.on_point("robot", "floor", 1, 2, 2, "route", "camera.map")
    book.observe_policy("robot", "docked")
    book.end_run("robot", 3)
    book.observe_policy("robot", intermediate)
    if intermediate in ("returning", "on"):
        assert book.ensure_run("robot", "floor", 4, "route", "camera.map", apply_policy=True)[0] is run
    book.observe_policy("robot", "cleaning")
    current, _ = book.ensure_run("robot", "floor", 5, "route", "camera.map", apply_policy=True)
    assert current is not run and current["_generation"] != run["_generation"]
    assert book.data["robot"]["previous"] is run
    for _ in range(100):
        book.configure_policy("robot", "vacuum.robot", True)
        book.observe_policy("robot", "cleaning")
        assert book.ensure_run("robot", "floor", 6, "route", "camera.map", apply_policy=True)[0] is current
    assert book.data["robot"]["previous"] is run


def test_940_policy_toggle_cancels_old_proof_and_does_not_retroactively_split():
    book = TrailBook()
    book.configure_policy("robot", "vacuum.robot", True)
    first, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map", apply_policy=True)
    book.observe_policy("robot", "docked")
    book.configure_policy("robot", "vacuum.robot", False)
    book.configure_policy("robot", "vacuum.robot", True)
    book.observe_policy("robot", "cleaning")
    assert book.ensure_run("robot", "floor", 2, "route", "camera.map", apply_policy=True)[0] is first
    book.observe_policy("robot", "docked")
    stored = copy.deepcopy(book.data)
    restarted = TrailBook(stored)
    restarted.configure_policy("robot", "vacuum.robot", True)
    restarted.observe_policy("robot", "cleaning")
    current, _ = restarted.ensure_run("robot", "floor", 3, "route", "camera.map", apply_policy=True)
    assert current["_generation"] != first["_generation"]
    again = TrailBook(copy.deepcopy(restarted.data))
    again.observe_policy("robot", "cleaning")
    assert again.ensure_run("robot", "floor", 4, "route", "camera.map", apply_policy=True)[0]["_generation"] == current["_generation"]


def test_940_native_and_real_session_boundaries_outrank_dock_policy():
    book = TrailBook()
    book.configure_policy("robot", "vacuum.robot", True)
    cur, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map", job_id="job-a", apply_policy=True)
    native = paths.snapshot("attributes", "full-path-v1", [[[0, 0], [100, 0]]], "floor", job_id="job-a")
    book.on_snapshot("robot", native, 2, "route", "floor", cur["_generation"], False)
    book.observe_policy("robot", "docked")
    book.end_run("robot", 3)
    book.observe_policy("robot", "cleaning")
    assert book.ensure_run("robot", "floor", 5000, "route", "camera.map", job_id="job-a", apply_policy=True)[0] is cur
    next_job = paths.snapshot("attributes", "full-path-v1", [[[10, 10]]], "floor", job_id="job-b")
    book.on_snapshot("robot", next_job, 5001, "route", "floor", cur["_generation"], False)
    current = book.data["robot"]["current"]
    assert current is not cur and book.data["robot"]["previous"] is cur
    book.on_snapshot("robot", next_job, 5002, "route", "floor", current["_generation"], False)
    assert book.data["robot"]["current"] is current and book.data["robot"]["previous"] is cur


def test_940_native_empty_is_persistent_and_full_replacements_do_not_archive_versions():
    book = TrailBook()
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    for index, raw in enumerate(([[[0, 0], [10, 10]]], [], [], [[[20, 20]]], [], [[[30, 30]]], [[[30, 30], [40, 40]]])):
        snap = paths.snapshot("attributes", "full-path-v1", raw, "floor")
        book.on_snapshot("robot", snap, index + 2, "route", "floor", run["_generation"], False)
        assert paths.public_trails(book.data)["robot"]["current"]["paths"] == raw
        assert "previous" not in book.data["robot"]
        restored = TrailBook(copy.deepcopy(book.data))
        assert paths.public_trails(restored.data)["robot"]["current"]["paths"] == raw


def test_940_rebinding_cancels_proof_and_native_authority_of_the_old_robot():
    book = TrailBook()
    book.configure_policy("robot", "vacuum.old", True)
    cur, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    book.on_snapshot("robot", paths.snapshot("attributes", "full-path-v1", [[[1, 1]]], "floor"),
                     2, "route", "floor", cur["_generation"], True)
    book.configure_policy("robot", "vacuum.new", True)
    book.configure_policy("robot", "vacuum.new", False)
    current, _ = book.ensure_run("robot", "floor", 3, "route", "camera.map", apply_policy=True)
    assert current is not cur and current["quality"]["source"] == "positions"
    assert not book.data["robot"]["_policy"]["armed"]


def test_940_final_native_reads_keep_first_stop_and_stale_revisions_do_not_reopen_it():
    book = TrailBook()
    run, _ = book.ensure_run("robot", "floor", 1, "route", "camera.map")
    first = paths.snapshot("attributes", "full-path-v1", [[[0, 0], [10, 0]]], "floor", revision=1, job_id="job")
    book.on_snapshot("robot", first, 2, "route", "floor", run["_generation"], False, moving=True)
    book.end_run("robot", 3)
    final = paths.snapshot("attributes", "full-path-v1", [[[0, 0], [20, 0]]], "floor", revision=2, job_id="job")
    assert book.on_snapshot("robot", final, 20, "route", "floor", run["_generation"], False, moving=False)
    assert run["ended"] == 3
    before = copy.deepcopy(book.data)
    assert not book.on_snapshot("robot", first, 21, "route", "floor", run["_generation"], False, moving=True)
    assert book.data == before
    assert book.on_snapshot("robot", final, 5000, "route", "floor", run["_generation"], False, moving=True)
    assert run["ended"] is None and "previous" not in book.data["robot"]


def test_append_dedups_and_records():
    b = TrailBook()
    assert b.on_point("m", "0", 1.0, 2.0, 100.0)
    assert not b.on_point("m", "0", 1.0, 2.0, 101.0)  # same point
    assert b.on_point("m", "0", 3.0, 4.0, 102.0)
    run = b.data["m"]["current"]
    assert run["points"] == [[1.0, 2.0], [3.0, 4.0]]
    assert run["ended"] is None


def test_end_then_new_run_rotates_current_to_previous():
    b = TrailBook()
    b.on_point("m", "0", 1, 1, 1.0)
    b.on_point("m", "0", 2, 2, 2.0)
    assert b.end_run("m", 3.0)
    assert not b.end_run("m", 4.0)  # idempotent
    b.on_point("m", "0", 9, 9, 3.0 + TRAIL_RESUME_GRACE_S + 1)
    rec = b.data["m"]
    assert rec["previous"]["points"] == [[1, 1], [2, 2]]
    assert rec["previous"]["ended"] == 3.0
    assert rec["current"]["points"] == [[9, 9]]
    # a third run forgets the first entirely — exactly two are kept
    b.end_run("m", 4000.0)
    b.on_point("m", "0", 7, 7, 4000.0 + TRAIL_RESUME_GRACE_S + 1)
    assert rec if rec is b.data["m"] else True
    assert b.data["m"]["previous"]["points"] == [[9, 9]]


def test_ended_run_resumes_within_grace_and_duplicate_is_a_change():
    b = TrailBook()
    b.on_point("m", "floor", 1, 1, 100.0)
    b.on_point("m", "floor", 2, 2, 110.0)
    assert b.end_run("m", 120.0)
    assert b.on_point("m", "floor", 2, 2, 120.0 + 600)
    rec = b.data["m"]
    assert rec["current"]["paths"] == [[[1, 1], [2, 2]], [[2, 2]]]
    assert rec["current"]["points"] == [[2, 2]]  # downgrade has no gap bridge
    assert rec["current"]["started"] == 100.0
    assert rec["current"]["ended"] is None
    assert "previous" not in rec


def test_resume_grace_is_inclusive_then_rotates_after_epsilon():
    b = TrailBook()
    b.on_point("m", "floor", 1, 1, 10.0)
    b.end_run("m", 20.0)
    assert b.on_point("m", "floor", 2, 2, 20.0 + TRAIL_RESUME_GRACE_S)
    assert "previous" not in b.data["m"]

    b.end_run("m", 2000.0)
    assert b.on_point("m", "floor", 3, 3, 2000.0 + TRAIL_RESUME_GRACE_S + 0.001)
    assert b.data["m"]["previous"]["paths"] == [[[1, 1]], [[2, 2]]]
    assert b.data["m"]["current"]["points"] == [[3, 3]]


def test_resume_never_crosses_maps_and_malformed_timestamps_fail_closed():
    cases = ["bad", True, float("nan"), float("inf")]
    for ended in cases:
        data = {"m": {"current": {
            "map_id": "floor", "started": 1.0, "ended": ended, "points": [[1, 1]],
        }}}
        b = TrailBook(data)
        assert b.on_point("m", "floor", 2, 2, 100.0)
        assert b.data["m"]["previous"]["ended"] is ended or (
            isinstance(ended, float) and math.isnan(ended)
        )
        assert b.data["m"]["current"]["points"] == [[2, 2]]

    b = TrailBook()
    b.on_point("m", "floor-a", 1, 1, 1.0)
    b.end_run("m", 2.0)
    b.on_point("m", "floor-b", 2, 2, 3.0)
    assert b.data["m"]["previous"]["map_id"] == "floor-a"
    assert b.data["m"]["current"]["map_id"] == "floor-b"


def test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape():
    stored = {"m": {
        "previous": {"map_id": "floor", "started": 1.0, "ended": 2.0, "points": [[0, 0]]},
        "current": {"map_id": "floor", "started": 10.0, "ended": 1000.0, "points": [[1, 1]]},
    }}
    b = TrailBook(stored)
    b.on_point("m", "floor", 2, 2, 900.0)
    assert b.data["m"]["previous"]["points"] == [[1, 1]]
    assert b.data["m"]["current"]["points"] == [[2, 2]]

    persisted = {"m": {"current": {
        "map_id": "floor", "started": 2000.0, "ended": 2100.0, "points": [[3, 3]],
    }}}
    restarted = TrailBook(persisted)
    restarted.on_point("m", "floor", 4, 4, 2100.0 + 300)
    assert restarted.data["m"]["current"]["paths"] == [[[3, 3]], [[4, 4]]]
    assert restarted.data["m"]["current"]["started"] == 2000.0
    assert restarted.data["m"]["current"]["ended"] is None
    assert "previous" not in restarted.data["m"]


def test_repeated_short_stops_keep_all_points_and_existing_previous():
    previous = {"map_id": "floor", "started": 0.0, "ended": 5.0, "points": [[0, 0]]}
    b = TrailBook({"m": {"previous": previous}})
    for index, now in enumerate((100.0, 200.0, 300.0)):
        assert b.on_point("m", "floor", index + 1, index + 1, now)
        assert b.end_run("m", now + 10)
        assert not b.end_run("m", now + 20)
    assert b.data["m"]["current"]["paths"] == [[[1, 1]], [[2, 2]], [[3, 3]]]
    assert b.data["m"]["previous"] is previous


def test_map_switch_mid_run_starts_a_new_run():
    b = TrailBook()
    b.on_point("m", "floor1", 1, 1, 1.0)
    b.on_point("m", "floor2", 2, 2, 2.0)
    assert b.data["m"]["current"]["map_id"] == "floor2"
    assert b.data["m"]["previous"]["map_id"] == "floor1"


def test_cap_stops_append_honestly_without_decimating_accepted_history():
    b = TrailBook()
    for i in range(TRAIL_CAP + 1):
        b.on_point("m", "0", float(i), 0.0, float(i))
    pts = b.data["m"]["current"]["points"]
    assert len(pts) == TRAIL_CAP
    assert pts[-1] == [float(TRAIL_CAP - 1), 0.0]
    assert b.data["m"]["current"]["quality"]["reason"] == "limited"


def test_junk_store_data_tolerated():
    b = TrailBook("not a dict")
    assert b.data == {}
    b.on_point("m", "0", 1, 1, 1.0)
    assert b.data["m"]["current"]["points"] == [[1, 1]]


# --- #162: маршруты карт и пространств ---------------------------------------

def test_route_change_starts_a_new_run_even_on_the_same_map_id():
    b = TrailBook()
    b.on_point("m", "default", 1.0, 1.0, 100.0, route_id="vr_a", source="camera.a")
    b.on_point("m", "default", 2.0, 2.0, 101.0, route_id="vr_b", source="camera.b")
    rec = b.data["m"]
    assert rec["previous"]["route_id"] == "vr_a"
    assert rec["current"]["route_id"] == "vr_b"
    assert rec["current"]["source"] == "camera.b"
    assert rec["current"]["points"] == [[2.0, 2.0]]


def test_same_route_keeps_one_run():
    b = TrailBook()
    b.on_point("m", "default", 1.0, 1.0, 100.0, route_id="vr_a", source="camera.a")
    b.on_point("m", "default", 2.0, 2.0, 101.0, route_id="vr_a", source="camera.a")
    assert "previous" not in b.data["m"]
    assert b.data["m"]["current"]["points"] == [[1.0, 1.0], [2.0, 2.0]]


def test_run_without_route_stays_legacy_shaped():
    b = TrailBook()
    b.on_point("m", "0", 1.0, 2.0, 100.0)
    run = b.data["m"]["current"]
    assert "route_id" not in run and "source" not in run
    assert run["path_format"] == 2
    assert run["paths"] == [[[1.0, 2.0]]]
    assert run["points"] == [[1.0, 2.0]]


def test_legacy_run_resumes_by_map_id_as_before():
    b = TrailBook()
    b.on_point("m", "0", 1.0, 2.0, 100.0)
    b.end_run("m", 200.0)
    assert b.on_point("m", "0", 3.0, 4.0, 300.0)
    assert "previous" not in b.data["m"]
    assert b.data["m"]["current"]["paths"] == [[[1.0, 2.0]], [[3.0, 4.0]]]


def test_route_run_does_not_resume_into_another_route():
    b = TrailBook()
    b.on_point("m", "default", 1.0, 2.0, 100.0, route_id="vr_a")
    b.end_run("m", 200.0)
    b.on_point("m", "default", 3.0, 4.0, 300.0, route_id="vr_b")
    assert b.data["m"]["previous"]["route_id"] == "vr_a"
    assert b.data["m"]["current"]["route_id"] == "vr_b"


def test_drop_unknown_routes_touches_only_runs_that_name_a_route():
    b = TrailBook()
    b.on_point("m", "m1", 1.0, 1.0, 100.0, route_id="vr_gone")
    b.on_point("m", "m2", 2.0, 2.0, 101.0, route_id="vr_live")
    assert b.drop_unknown_routes("m", {"vr_live"}) is True
    assert "previous" not in b.data["m"]
    assert b.data["m"]["current"]["route_id"] == "vr_live"
    assert b.drop_unknown_routes("m", {"vr_live"}) is False
    legacy = TrailBook()
    legacy.on_point("m", "m1", 1.0, 1.0, 100.0)
    assert legacy.drop_unknown_routes("m", set()) is False, "легаси-прогон не трогаем"
    assert legacy.data["m"]["current"]["points"] == [[1.0, 1.0]]
    assert TrailBook().drop_unknown_routes("нет такого", {"vr"}) is False


def test_same_run_identity_contract():
    same = ns["same_run_identity"]
    assert same({"route_id": "vr_a", "map_id": "x"}, "vr_a", "y") is False
    assert same({"route_id": "vr_a", "map_id": "x"}, "vr_a", "x") is True
    assert same({"route_id": "vr_a", "map_id": "x"}, "vr_b", "x") is False
    assert same({"map_id": "x"}, "vr_a", "x") is False, "#918 unknown history is not an identified route"
    assert same({"route_id": "vr_a", "map_id": "x"}, "", "x") is False
    assert same({"map_id": "x"}, "vr_a", "x", legacy=True) is True, "only legacy-only config retains map adoption"
    assert same({"route_id": "vr_a", "map_id": "x", "source": "camera.a"}, "vr_a", "x", "camera.b") is False
    assert same({"map_id": "x"}, "", "y") is False
    assert same(None, "vr", "x") is False


def test_issue918_orphan_rotation_never_promotes_or_joins_old_points():
    import copy
    b = TrailBook()
    b.on_point("m", "same", 900, 900, 1.0)
    old = copy.deepcopy(b.data["m"]["current"])
    b.on_point("m", "same", 10, 10, 2.0, route_id="r", source="camera.b")
    assert b.data["m"]["previous"] == old
    assert b.data["m"]["current"]["paths"] == [[[10, 10]]]
    assert b.data["m"]["current"]["_generation"] != old["_generation"]
    b.on_point("m", "same", 900, 900, 3.0)
    assert "route_id" not in b.data["m"]["current"]
    assert b.data["m"]["previous"]["source"] == "camera.b"


def test_issue918_future_format_is_not_rewritten_by_identity_repair():
    import copy
    b = TrailBook()
    b.data = {"m": {"current": {"path_format": 3, "map_id": "same", "opaque": [1, 2, 3]}}}
    before = copy.deepcopy(b.data)
    assert b.on_point("m", "same", 10, 10, 2.0, route_id="r", source="camera.b") is False
    assert b.data == before
