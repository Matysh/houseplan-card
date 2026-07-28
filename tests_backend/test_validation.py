"""Unit tests for the pure House Plan validation (validation.py is loaded by path,
without importing the HA integration package)."""
import importlib.util
import os

import pytest
import voluptuous as vol

_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "custom_components", "houseplan", "validation.py",
)
_spec = importlib.util.spec_from_file_location("hp_validation", _PATH)
v = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v)


def _load_pure(name):
    """Load one pure module of the integration without importing the package.

    custom_components/houseplan/__init__.py pulls in Home Assistant, which the
    local sandbox does not have; but plans.py is deliberately pure, so a tiny
    stub package lets it keep its normal relative imports.
    """
    import sys
    import types

    pkg_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "custom_components", "houseplan"
    )
    pkg = sys.modules.get("hp_pure")
    if pkg is None:
        pkg = types.ModuleType("hp_pure")
        pkg.__path__ = [pkg_dir]
        sys.modules["hp_pure"] = pkg
        for dep in ("const", "validation"):
            sp = importlib.util.spec_from_file_location(
                f"hp_pure.{dep}", os.path.join(pkg_dir, f"{dep}.py")
            )
            mod = importlib.util.module_from_spec(sp)
            sys.modules[f"hp_pure.{dep}"] = mod
            sp.loader.exec_module(mod)
    sp = importlib.util.spec_from_file_location(
        f"hp_pure.{name}", os.path.join(pkg_dir, f"{name}.py")
    )
    mod = importlib.util.module_from_spec(sp)
    sys.modules[f"hp_pure.{name}"] = mod
    sp.loader.exec_module(mod)
    return mod


plans = _load_pure("plans")
const = importlib.import_module("hp_pure.const")


def test_sanitize_marker_id():
    assert v.sanitize_marker_id("../etc/passwd") == "_etc_passwd"
    assert v.sanitize_marker_id("..") == "misc"       # pure traversal → misc
    assert v.sanitize_marker_id(".") == "misc"
    assert v.sanitize_marker_id("") == "misc"
    assert len(v.sanitize_marker_id("a" * 200)) == 64


def test_sanitize_filename_strips_path():
    assert v.sanitize_filename("/a/b/c/manual.pdf") == "manual.pdf"
    assert v.sanitize_filename("..\\..\\evil.pdf") == "evil.pdf"   # backslashes = a path
    assert v.sanitize_filename("...hidden.pdf") == "hidden.pdf"      # leading dots stripped


def test_file_ext():
    assert v.file_ext("manual.PDF") == "pdf"
    assert v.file_ext("a/b/x.png") == "png"
    assert v.file_ext("noext") == ""


def test_valid_space_id():
    assert v.valid_space_id("f1")
    assert v.valid_space_id("floor-2_a")
    assert not v.valid_space_id("Floor 1")
    assert not v.valid_space_id("a" * 65)
    assert not v.valid_space_id("../x")


def test_room_schema_poly_or_rect():
    v.ROOM_SCHEMA({"id": "r1", "name": "A", "poly": [[0, 0], [1, 0], [1, 1]]})
    v.ROOM_SCHEMA({"id": "r2", "name": "B", "x": 0, "y": 0, "w": 1, "h": 1})
    with pytest.raises(vol.Invalid):
        v.ROOM_SCHEMA({"id": "r3", "name": "C"})
    with pytest.raises(vol.Invalid):
        v.ROOM_SCHEMA({"id": "r4", "name": "D", "poly": [[0, 0], [1, 1]]})


def test_space_schema_aspect_range():
    ok = {"id": "f1", "title": "1", "aspect": 1.4, "view_box": [0, 0, 1, 1], "rooms": []}
    v.SPACE_SCHEMA(ok)
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "aspect": 0})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "view_box": [0, 0, 1]})


def test_marker_schema():
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc"})
    v.MARKER_SCHEMA({"id": "m2", "binding": "virtual", "name": "X",
                     "pdfs": [{"name": "a.pdf", "url": "/u/a.pdf"}]})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"binding": "virtual"})


def test_config_schema_defaults_and_extra():
    out = v.CONFIG_SCHEMA({"spaces": []})
    assert out["markers"] == [] and out["settings"] == {}
    out2 = v.CONFIG_SCHEMA({"spaces": [], "virtual_devices": [], "device_overrides": {}})
    assert "spaces" in out2


def test_config_schema_full_roundtrip():
    cfg = {
        "spaces": [{
            "id": "f1", "title": "Floor 1", "plan_url": "/p/f1.svg",
            "aspect": 0.8, "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "r1", "name": "Hall", "area": "hall",
                       "poly": [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]}],
            "segments": [[0, 0, 0.5, 0]],
        }],
        "markers": [{"id": "d1", "binding": "device:x", "model": "M", "link": "https://e.com"}],
        "settings": {"group_lights": True},
    }
    out = v.CONFIG_SCHEMA(cfg)
    assert out["spaces"][0]["rooms"][0]["area"] == "hall"
    assert out["markers"][0]["binding"] == "device:x"


def test_layout_schema():
    v.LAYOUT_SCHEMA({"dev1": {"x": 0.1, "y": 0.2, "s": "f1"}})
    with pytest.raises(vol.Invalid):
        v.LAYOUT_SCHEMA({"dev1": {"x": 0.1}})


def test_space_display_settings():
    """Per-space display settings validate; garbage color/mode is rejected."""
    ok = {
        "id": "f1", "title": "Floor 1", "aspect": 1.0, "view_box": [0, 0, 1, 1],
        "rooms": [], "settings": {
            "show_borders": True, "show_names": False,
            "room_color": "#3ea6ff", "room_opacity": 0.5, "fill_mode": "lqi",
        },
    }
    v.SPACE_SCHEMA(ok)
    import pytest as _pytest
    bad_color = dict(ok, settings={"room_color": "javascript:x"})
    with _pytest.raises(Exception):
        v.SPACE_SCHEMA(bad_color)
    bad_mode = dict(ok, settings={"fill_mode": "rainbow"})
    with _pytest.raises(Exception):
        v.SPACE_SCHEMA(bad_mode)


def test_space_temp_bounds():
    """Temperature comfort bounds validate as floats; temp fill mode accepted."""
    ok = {
        "id": "f1", "title": "F", "aspect": 1.0, "view_box": [0, 0, 1, 1], "rooms": [],
        "settings": {"fill_mode": "temp", "temp_min": 19.5, "temp_max": "24"},
    }
    v.SPACE_SCHEMA(ok)


def test_finite_coordinates_rejected():
    """audit B5: NaN/Infinity coordinates must not reach storage."""
    for bad in ("NaN", "Infinity", "-Infinity", float("nan"), float("inf")):
        with pytest.raises(vol.Invalid):
            v.LAYOUT_SCHEMA({"dev1": {"x": bad, "y": 0.5}})
    assert v.LAYOUT_SCHEMA({"dev1": {"x": 0.5, "y": 0.25}})


def test_collection_caps():
    """audit B5: unbounded collections are capped."""
    big = {f"d{i}": {"x": 0.1, "y": 0.1} for i in range(v.MAX_LAYOUT + 1)}
    with pytest.raises(vol.Invalid):
        v.LAYOUT_SCHEMA(big)


def test_finite_on_every_coordinate():
    """audit follow-up B5: NaN/Infinity must be refused everywhere, not only in layout."""
    base = {"id": "s1", "title": "S", "aspect": 1.0, "view_box": [0, 0, 100, 100], "rooms": []}
    # view_box
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "view_box": [0, 0, "NaN", 100]}]})
    # room rect coordinates
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
            {"id": "r", "name": "R", "x": "Infinity", "y": 0, "w": 1, "h": 1}]}]})
    # polygon vertices
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
            {"id": "r", "name": "R", "poly": [[0, 0], [1, "NaN"], [1, 1]]}]}]})
    # opening coordinates
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "openings": [
            {"id": "o", "type": "door", "x": "NaN", "y": 0.5, "angle": 0, "length": 0.1}]}]})
    # a sane config still validates
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
        {"id": "r", "name": "R", "poly": [[0, 0], [1, 0], [1, 1]]}]}]})


def test_openings_cap_enforced():
    """audit follow-up B5: MAX_OPENINGS was defined but never wired in."""
    many = [{"id": f"o{i}", "type": "door", "x": 0.1, "y": 0.1, "angle": 0, "length": 0.1}
            for i in range(v.MAX_OPENINGS + 1)]
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{"id": "s1", "title": "S", "aspect": 1.0,
                                     "view_box": [0, 0, 100, 100], "rooms": [],
                                     "openings": many}]})


# ---------- plan-file collection (review R3-1) ----------


def _plans(tmp_path, names, age=0.0):
    import os, time
    d = tmp_path / "plans"
    d.mkdir(exist_ok=True)
    for n in names:
        (d / n).write_bytes(b"x")
        if age:
            t = time.time() - age
            os.utime(d / n, (t, t))
    return d


def _cfg(*urls):
    return {"spaces": [{"id": f"s{i}", "plan_url": u} for i, u in enumerate(urls)]}


def test_plan_basename_and_refs():
    plan_basename, plan_refs, is_plan_file = plans.plan_basename, plans.plan_refs, plans.is_plan_file

    assert plan_basename("/api/houseplan/content/plans/_/f1.abc.png?v=7") == "f1.abc.png"
    assert plan_basename("/houseplan_files/plans/f1.svg") == "f1.svg"
    assert plan_basename(None) == "" and plan_basename("") == "" and plan_basename(7) == ""
    assert plan_refs(None) == set() and plan_refs({}) == set()
    assert plan_refs(_cfg("/p/a.png", None, "/p/b.svg")) == {"a.png", "b.svg"}
    assert is_plan_file("f1.svg") and is_plan_file("f1.tok.png")
    assert not is_plan_file("notes.txt") and not is_plan_file("readme")
    assert not is_plan_file("deep.name.with.dots.png")  # 4 parts: not ours


def test_collect_plans_removes_only_the_superseded_file(tmp_path):
    collect_plans = plans.collect_plans

    d = _plans(tmp_path, ["f1.old.png", "f1.new.png", "f2.png"])
    removed = collect_plans(d, _cfg("/p/f1.old.png", "/p/f2.png"), _cfg("/p/f1.new.png", "/p/f2.png"))
    assert removed == 1
    assert not (d / "f1.old.png").exists()
    assert (d / "f1.new.png").is_file() and (d / "f2.png").is_file()


def test_collect_plans_keeps_a_fresh_unreferenced_upload(tmp_path):
    """Another client may be mid-transaction: its file is unreferenced but young."""
    collect_plans = plans.collect_plans

    d = _plans(tmp_path, ["f1.committed.png", "f1.inflight.png"])
    removed = collect_plans(d, _cfg("/p/f1.committed.png"), _cfg("/p/f1.committed.png"))
    assert removed == 0
    assert (d / "f1.inflight.png").is_file()


def test_collect_plans_takes_an_aged_orphan(tmp_path):
    PLAN_ORPHAN_TTL_S = const.PLAN_ORPHAN_TTL_S
    collect_plans = plans.collect_plans

    d = _plans(tmp_path, ["f1.keep.png"])
    _plans(tmp_path, ["f1.abandoned.png"], age=PLAN_ORPHAN_TTL_S + 60)
    removed = collect_plans(d, _cfg("/p/f1.keep.png"), _cfg("/p/f1.keep.png"))
    assert removed == 1
    assert (d / "f1.keep.png").is_file() and not (d / "f1.abandoned.png").exists()


def test_collect_plans_never_touches_a_referenced_or_foreign_file(tmp_path):
    PLAN_ORPHAN_TTL_S = const.PLAN_ORPHAN_TTL_S
    collect_plans = plans.collect_plans

    old = PLAN_ORPHAN_TTL_S + 60
    d = _plans(tmp_path, ["f1.png", "notes.txt", "readme", "deep.name.with.dots.png"], age=old)
    removed = collect_plans(d, _cfg("/p/f1.png"), _cfg("/p/f1.png"))
    assert removed == 0
    for n in ("f1.png", "notes.txt", "readme", "deep.name.with.dots.png"):
        assert (d / n).is_file()


def test_collect_plans_survives_a_missing_directory(tmp_path):
    collect_plans = plans.collect_plans

    assert collect_plans(tmp_path / "nope", _cfg(), _cfg()) == 0


def test_collect_plans_never_raises_when_the_directory_disappears(tmp_path, monkeypatch):
    """review R4-1: it runs behind a durable commit, so it may only report 0."""
    collect_plans = plans.collect_plans
    d = tmp_path / "plans"
    d.mkdir()

    def _boom(self):
        raise OSError("gone")

    monkeypatch.setattr(type(d), "iterdir", _boom, raising=False)
    assert collect_plans(d, _cfg("/p/a.png"), _cfg("/p/b.png")) == 0


# ---------- the editor's options must be storable (issue #3) ----------


def _ts_list(name):
    """Read one `export const NAME = [...] as const;` list out of src/logic.ts.

    Deliberately reads the TypeScript source rather than duplicating the values:
    a list that lives in two places drifts, which is exactly what happened here.
    """
    import re

    src = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "logic.ts")
    with open(src, encoding="utf-8") as fh:
        text = fh.read()
    m = re.search(rf"export const {name} = \[(.*?)\] as const;", text, re.S)
    assert m, f"{name} not found in src/logic.ts"
    return re.findall(r"'([^']+)'", m.group(1))


def _marker(**extra):
    return {"id": "m1", "binding": "entity:sensor.x", **extra}


def test_every_display_mode_the_editor_offers_is_accepted():
    """issue #3: 'value' was added to the card in v1.26.0 and never to the schema.

    Saving a sensor set to "value instead of an icon" failed with
    "not a valid value for dictionary value @ data['config']['markers'][n]['display']",
    and because one bad marker rejects the whole config, the user could not save
    at all. Reported 2026-07-27.
    """
    modes = _ts_list("DISPLAY_MODES")
    assert "value" in modes, "the regression this test exists for"
    for mode in modes:
        v.MARKER_SCHEMA(_marker(display=mode))
    v.MARKER_SCHEMA(_marker(display=None))
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA(_marker(display="wat"))


def test_every_tap_action_the_editor_offers_is_accepted():
    for action in _ts_list("TAP_ACTIONS"):
        v.MARKER_SCHEMA(_marker(tap_action=action))
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA(_marker(tap_action="launch-missiles"))


def _space(**settings):
    return {
        "id": "f1", "title": "F1", "aspect": 1.4, "view_box": [0, 0, 1, 1],
        "rooms": [], "settings": settings,
    }


def test_every_fill_mode_the_editor_offers_is_accepted():
    for mode in _ts_list("SPACE_FILL_MODES"):
        v.SPACE_SCHEMA(_space(fill_mode=mode))
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(_space(fill_mode="rainbow"))


def test_every_room_fill_mode_the_editor_offers_is_accepted():
    def room(mode):
        return {
            "id": "f1", "title": "F1", "aspect": 1.4, "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "r1", "name": "R", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2,
                       "settings": {"fill_mode": mode}}],
        }

    for mode in _ts_list("ROOM_FILL_MODES"):
        v.SPACE_SCHEMA(room(mode))
    v.SPACE_SCHEMA(room(None))  # inherit from the space
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(room("rainbow"))


# ---------- attachments & inner limits (HP-1454-02, -05) ----------


def test_unique_filename_never_returns_a_taken_name(tmp_path):
    unique_filename = plans.unique_filename
    d = tmp_path / "m1"
    d.mkdir()
    assert unique_filename(d, "manual.pdf") == "manual.pdf"
    (d / "manual.pdf").write_bytes(b"x")
    assert unique_filename(d, "manual.pdf") == "manual (2).pdf"
    (d / "manual (2).pdf").write_bytes(b"x")
    assert unique_filename(d, "manual.pdf") == "manual (3).pdf"
    # no extension, and a name that needs sanitising
    (d / "readme").write_bytes(b"x")
    assert unique_filename(d, "readme") == "readme (2)"
    assert unique_filename(d, "../../etc/passwd") == "passwd"


def _acfg(*pairs):
    return {"markers": [{"id": f"m{i}", "pdfs": [{"url": f"/api/houseplan/content/files/{p}"}]}
                        for i, p in enumerate(pairs)]}


def test_attachment_refs_reads_marker_urls():
    attachment_refs = plans.attachment_refs
    assert attachment_refs(None) == set()
    assert attachment_refs(_acfg("m1/a.pdf", "m2/b.pdf")) == {"m1/a.pdf", "m2/b.pdf"}
    # legacy and foreign urls are not ours to collect against
    cfg = {"markers": [{"id": "m", "pdfs": [{"url": "/local/x.pdf"}, {"url": "/api/houseplan/content/files/deep/a/b.pdf"}]}]}
    assert plans.attachment_refs(cfg) == set()


def test_collect_attachments_supersedes_and_ages(tmp_path):
    import os
    import time

    collect_attachments = plans.collect_attachments
    files = tmp_path / "files"
    (files / "m1").mkdir(parents=True)
    for n in ("old.pdf", "new.pdf", "cancelled.pdf"):
        (files / "m1" / n).write_bytes(b"x")

    # the commit swapped old.pdf for new.pdf; cancelled.pdf is a fresh upload
    # nobody saved — it may belong to a dialog that is still open
    removed = collect_attachments(files, _acfg("m1/old.pdf"), _acfg("m1/new.pdf"))
    assert removed == 1
    assert not (files / "m1" / "old.pdf").exists()
    assert (files / "m1" / "new.pdf").is_file()
    assert (files / "m1" / "cancelled.pdf").is_file()

    old = time.time() - const.PLAN_ORPHAN_TTL_S - 60
    os.utime(files / "m1" / "cancelled.pdf", (old, old))
    assert collect_attachments(files, _acfg("m1/new.pdf"), _acfg("m1/new.pdf")) == 1
    assert not (files / "m1" / "cancelled.pdf").exists()
    assert (files / "m1" / "new.pdf").is_file()


def test_collect_attachments_removes_the_empty_folder_and_never_raises(tmp_path):
    import os
    import time

    files = tmp_path / "files"
    (files / "up_x").mkdir(parents=True)
    f = files / "up_x" / "orphan.pdf"
    f.write_bytes(b"x")
    old = time.time() - const.PLAN_ORPHAN_TTL_S - 60
    os.utime(f, (old, old))
    assert plans.collect_attachments(files, {}, {}) == 1
    assert not (files / "up_x").exists(), "the staging folder goes with its last file"
    assert plans.collect_attachments(tmp_path / "nope", {}, {}) == 0


def test_inner_collection_limits():
    room = {"id": "r", "name": "R", "poly": [[0.1, 0.1]] * v.MAX_POLY_POINTS}
    v.ROOM_SCHEMA(room)
    with pytest.raises(vol.Invalid):
        v.ROOM_SCHEMA({**room, "poly": [[0.1, 0.1]] * (v.MAX_POLY_POINTS + 1)})

    rect = {"id": "r", "name": "R", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
    v.ROOM_SCHEMA({**rect, "open_to": ["x"] * v.MAX_OPEN_TO})
    with pytest.raises(vol.Invalid):
        v.ROOM_SCHEMA({**rect, "open_to": ["x"] * (v.MAX_OPEN_TO + 1)})

    m = {"id": "m", "binding": "virtual"}
    v.MARKER_SCHEMA({**m, "controls": ["light.x"] * v.MAX_CONTROLS})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({**m, "controls": ["light.x"] * (v.MAX_CONTROLS + 1)})

    pdf = {"name": "n", "url": "/api/houseplan/content/files/m/a.pdf"}
    v.MARKER_SCHEMA({**m, "pdfs": [pdf] * v.MAX_PDFS})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({**m, "pdfs": [pdf] * (v.MAX_PDFS + 1)})

    v.MARKER_SCHEMA({**m, "name": "n" * v.MAX_TEXT})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({**m, "name": "n" * (v.MAX_TEXT + 1)})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({**m, "link": "u" * (v.MAX_URL + 1)})


def test_legacy_segments_are_dropped_by_the_server():
    """A limit that depends on the client stripping the field is not a limit."""
    out = v.SPACE_SCHEMA({
        "id": "f1", "title": "F", "aspect": 1.4, "view_box": [0, 0, 1, 1], "rooms": [],
        "segments": [[1, 2, 3, 4]] * 100000,
    })
    assert "segments" not in out
