"""TrailBook: the pure part of the server-side vacuum trails."""
import math
import pathlib
# TrailBook берётся без импорта: из trails.py читается текст и исполняется срез
# до класса TrailRecorder — только он тянет Home Assistant. Ни sys.path, ни
# sys.modules при этом не трогаются намеренно (#393): правка импорт-машины
# переживает свой тест и достаётся всей сессии, а чем это кончается, показал
# #389 — 85 тестов харнесса падали с голым `assert False`.
src = (pathlib.Path(__file__).parent.parent / "custom_components" / "houseplan" / "trails.py").read_text(encoding="utf-8")
ns = {"Any": object, "annotations": None, "math": math}
exec(src[src.index("TRAIL_CAP"):src.index("class TrailRecorder")], ns)
TrailBook = ns["TrailBook"]
TRAIL_CAP = ns["TRAIL_CAP"]
TRAIL_RESUME_GRACE_S = ns["TRAIL_RESUME_GRACE_S"]


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
    assert rec["current"]["points"] == [[1, 1], [2, 2]]
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
    assert b.data["m"]["previous"]["points"] == [[1, 1], [2, 2]]
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
    assert restarted.data["m"]["current"]["points"] == [[3, 3], [4, 4]]
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
    assert b.data["m"]["current"]["points"] == [[1, 1], [2, 2], [3, 3]]
    assert b.data["m"]["previous"] is previous


def test_map_switch_mid_run_starts_a_new_run():
    b = TrailBook()
    b.on_point("m", "floor1", 1, 1, 1.0)
    b.on_point("m", "floor2", 2, 2, 2.0)
    assert b.data["m"]["current"]["map_id"] == "floor2"
    assert b.data["m"]["previous"]["map_id"] == "floor1"


def test_cap_decimates_but_keeps_the_freshest_point():
    b = TrailBook()
    for i in range(TRAIL_CAP + 1):
        b.on_point("m", "0", float(i), 0.0, float(i))
    pts = b.data["m"]["current"]["points"]
    assert len(pts) <= TRAIL_CAP // 2 + 2
    assert pts[-1] == [float(TRAIL_CAP), 0.0]


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
    assert set(run) == {"map_id", "started", "ended", "points"}


def test_legacy_run_resumes_by_map_id_as_before():
    b = TrailBook()
    b.on_point("m", "0", 1.0, 2.0, 100.0)
    b.end_run("m", 200.0)
    assert b.on_point("m", "0", 3.0, 4.0, 300.0)
    assert "previous" not in b.data["m"]
    assert b.data["m"]["current"]["points"] == [[1.0, 2.0], [3.0, 4.0]]


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
    assert same({"route_id": "vr_a", "map_id": "x"}, "vr_a", "y") is True
    assert same({"route_id": "vr_a", "map_id": "x"}, "vr_b", "x") is False
    assert same({"map_id": "x"}, "vr_a", "x") is True, "легаси-прогон опознаётся картой"
    assert same({"map_id": "x"}, "", "y") is False
    assert same(None, "vr", "x") is False
