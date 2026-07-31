"""TrailBook: the pure part of the server-side vacuum trails."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "custom_components" / "houseplan"))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "trailbook_pure",
    pathlib.Path(__file__).parent.parent / "custom_components" / "houseplan" / "trails.py",
)
# import only TrailBook without HA deps: read the source and exec the class
src = (pathlib.Path(__file__).parent.parent / "custom_components" / "houseplan" / "trails.py").read_text(encoding="utf-8")
ns = {"Any": object, "annotations": None}
exec(src[src.index("TRAIL_CAP"):src.index("class TrailRecorder")], ns)
TrailBook = ns["TrailBook"]
TRAIL_CAP = ns["TRAIL_CAP"]


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
    b.on_point("m", "0", 9, 9, 5.0)
    rec = b.data["m"]
    assert rec["previous"]["points"] == [[1, 1], [2, 2]]
    assert rec["previous"]["ended"] == 3.0
    assert rec["current"]["points"] == [[9, 9]]
    # a third run forgets the first entirely — exactly two are kept
    b.end_run("m", 6.0)
    b.on_point("m", "0", 7, 7, 7.0)
    assert rec if rec is b.data["m"] else True
    assert b.data["m"]["previous"]["points"] == [[9, 9]]


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
