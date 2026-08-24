"""Unit tests for the pure House Plan validation (validation.py is loaded by path,
without importing the HA integration package)."""
import importlib.util
import json
import os
import subprocess
import sys
import types

import pytest
import voluptuous as vol

_ROOT = os.path.dirname(os.path.dirname(__file__))
_PACKAGE_ROOT = os.path.join(_ROOT, "custom_components")
_HOUSEPLAN_ROOT = os.path.join(_PACKAGE_ROOT, "houseplan")

# Keep this pure test independent of Home Assistant even though Python normally
# executes package __init__.py before resolving the validation submodule.
if "custom_components" not in sys.modules:
    package = types.ModuleType("custom_components")
    package.__path__ = [_PACKAGE_ROOT]
    sys.modules["custom_components"] = package
if "custom_components.houseplan" not in sys.modules:
    package = types.ModuleType("custom_components.houseplan")
    package.__path__ = [_HOUSEPLAN_ROOT]
    sys.modules["custom_components.houseplan"] = package

_PATH = os.path.join(
    _ROOT,
    "custom_components", "houseplan", "validation.py",
)
_spec = importlib.util.spec_from_file_location("hp_validation", _PATH)
v = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v)


def test_backend_model_version_matches_frontend_constant():
    root = os.path.dirname(os.path.dirname(__file__))
    source = open(os.path.join(root, "src", "plan-optimizer.ts"), encoding="utf-8").read()
    const_path = os.path.join(root, "custom_components", "houseplan", "const.py")
    const_spec = importlib.util.spec_from_file_location("hp_const", const_path)
    const = importlib.util.module_from_spec(const_spec)
    const_spec.loader.exec_module(const)
    assert f"PLAN_MODEL_VERSION = {const.PLAN_MODEL_VERSION}" in source


@pytest.mark.parametrize("module_name, expected_spaces", [
    ("large-house", 3),
    ("visual-matrix", 2),
])
def test_browser_fixtures_match_backend_schema(module_name, expected_spaces):
    """Browser fixtures must not bypass constraints real saves enforce."""
    root = os.path.dirname(os.path.dirname(__file__))
    script = (
        f"import * as fixture from './demo/fixtures/{module_name}.mjs';"
        "const make=fixture.makeLargeHouseFixture||fixture.makeVisualMatrixFixture;"
        "process.stdout.write(JSON.stringify(make()));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    fixture = json.loads(result.stdout)
    validated = v.CONFIG_SCHEMA(fixture["config"])
    validated_layout = v.LAYOUT_SCHEMA(fixture.get("layout", {}))
    assert len(validated["spaces"]) == expected_spaces
    assert sum(len(space["rooms"]) for space in validated["spaces"]) >= 6
    assert len(validated_layout) == len(fixture.get("layout", {}))


def test_shared_additive_glow_fixture_matches_backend_schema():
    path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "test", "fixtures", "glow", "additive-pools.json",
    )
    with open(path, encoding="utf-8") as handle:
        fixture = json.load(handle)
    validated = v.CONFIG_SCHEMA(fixture["config"])
    validated_layout = v.LAYOUT_SCHEMA(fixture["layout"])
    assert fixture["variants"] == [1, 10, 30, 60]
    assert len(validated["markers"]) == 60
    assert len(validated_layout) == 60


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


def test_space_schema_drops_the_old_aspect_and_bounds_the_image_ratio():
    """v1.48.0: the canvas is square; only the IMAGE keeps proportions.

    A stale tab may still send `aspect`. It is dropped rather than trusted —
    the coordinates it arrives with were normalised against a different box, so
    honouring the field would not make them right anyway.
    """
    ok = {"id": "f1", "title": "1", "view_box": [0, 0, 1, 1], "rooms": []}
    assert "aspect" not in v.SPACE_SCHEMA({**ok, "aspect": 1.4})
    v.SPACE_SCHEMA({**ok, "plan_aspect": 1.4})
    v.SPACE_SCHEMA({**ok, "plan_aspect": None})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "plan_aspect": 0})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "view_box": [0, 0, 1]})


def test_space_backdrop_transform_is_optional_and_bounded():
    """plan_x / plan_y / plan_scale — the backdrop placement (docs/BACKDROP.md).

    Optional to the letter: a space that has never been through the backdrop
    editor validates exactly as it did before, and the keys stay absent (there
    is no migration and no default written into anybody's store).
    """
    ok = {"id": "f1", "title": "1", "view_box": [0, 0, 1, 1], "rooms": []}
    out = v.SPACE_SCHEMA(ok)
    assert "plan_x" not in out and "plan_y" not in out and "plan_scale" not in out

    v.SPACE_SCHEMA({**ok, "plan_x": 0.25, "plan_y": -1.5, "plan_scale": 2.5})
    v.SPACE_SCHEMA({**ok, "plan_x": None, "plan_y": None, "plan_scale": None})
    # the offset is a coordinate: the whole canvas range, both signs
    v.SPACE_SCHEMA({**ok, "plan_x": v.CANVAS_LIMIT, "plan_y": -v.CANVAS_LIMIT})
    # the scale is a MULTIPLIER: strictly positive, human-sized
    v.SPACE_SCHEMA({**ok, "plan_scale": v.PLAN_SCALE_MIN})
    v.SPACE_SCHEMA({**ok, "plan_scale": v.PLAN_SCALE_MAX})

    for bad in ({"plan_x": v.CANVAS_LIMIT + 1}, {"plan_y": -v.CANVAS_LIMIT - 1},
                {"plan_x": float("nan")}, {"plan_y": float("inf")},
                {"plan_scale": 0}, {"plan_scale": -1},
                {"plan_scale": v.PLAN_SCALE_MIN / 2},
                {"plan_scale": v.PLAN_SCALE_MAX * 2},
                {"plan_scale": float("nan")}):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA({**ok, **bad})


def test_space_cell_scale_is_optional_finite_and_bounded():
    ok = {"id": "f1", "title": "1", "view_box": [0, 0, 1, 1], "rooms": []}
    assert "cell_cm" not in v.SPACE_SCHEMA(ok)
    assert v.SPACE_SCHEMA({**ok, "cell_cm": 20})["cell_cm"] == 20.0
    for bad in (0, -1, v.CELL_CM_MAX + 1, float("nan"), float("inf")):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA({**ok, "cell_cm": bad})


def test_marker_schema():
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc"})
    v.MARKER_SCHEMA({"id": "m2", "binding": "virtual", "name": "X",
                     "pdfs": [{"name": "a.pdf", "url": "/u/a.pdf"}]})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"binding": "virtual"})


def test_marker_removed_tombstone_is_strictly_boolean():
    assert v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "removed": True})["removed"] is True
    assert v.MARKER_SCHEMA({"id": "m1", "binding": "entity:sensor.x", "removed": False})["removed"] is False
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "removed": "yes"})


def test_marker_binding_shape_and_ripple_color():
    """audit P3-4: binding is device:/entity:/virtual; ripple_color is #rrggbb."""
    v.MARKER_SCHEMA({"id": "m1", "binding": "entity:sensor.temp"})
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "ripple_color": "#3ea6ff"})
    for bad in ("foo", "device:", "virtualx", "entity:"):
        with pytest.raises(vol.Invalid):
            v.MARKER_SCHEMA({"id": "m1", "binding": bad})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"id": "m1", "binding": "device:x", "ripple_color": "red"})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"id": "m1", "binding": "device:x", "ripple_color": "#fff"})


def test_decor_rect_extents_must_be_positive():
    """audit P3-4: rect/ellipse w/h are sizes, not signed canvas coords."""
    v.DECOR_SCHEMA({"id": "d", "kind": "rect", "x": 0, "y": 0, "w": 0.1, "h": 0.2})
    with pytest.raises(vol.Invalid):
        v.DECOR_SCHEMA({"id": "d", "kind": "rect", "x": 0, "y": 0, "w": -1, "h": 1})
    with pytest.raises(vol.Invalid):
        v.DECOR_SCHEMA({"id": "d", "kind": "ellipse", "x": 0, "y": 0, "w": 0, "h": 1})


def test_decor_line_style_is_bounded_and_optional():
    base = {"id": "d", "kind": "line", "x1": 0, "y1": 0, "x2": 1, "y2": 1}
    assert "line_style" not in v.DECOR_SCHEMA(base)
    assert v.DECOR_SCHEMA({**base, "line_style": "solid"})["line_style"] == "solid"
    assert v.DECOR_SCHEMA({**base, "line_style": "dashed"})["line_style"] == "dashed"
    with pytest.raises(vol.Invalid):
        v.DECOR_SCHEMA({**base, "line_style": "dots"})


def test_decor_physical_style_and_backdrop_transform():
    """New canonical style/transform fields are bounded; legacy fields stay valid."""
    shape = {
        "id": "d", "kind": "rect", "x": 0, "y": 0, "w": 0.2, "h": 0.1,
        "color": "#123456", "opacity": 0.7, "width_cm": 3.5,
        "fill": True, "fill_color": "#abcdef", "fill_opacity": 0.25, "angle": 45,
    }
    assert v.DECOR_SCHEMA(shape)["width_cm"] == 3.5
    assert v.DECOR_SCHEMA({**shape, "width": 3})["width"] == 3
    for patch in ({"opacity": 1.1}, {"width_cm": 0}, {"fill_opacity": -0.1}):
        with pytest.raises(vol.Invalid):
            v.DECOR_SCHEMA({**shape, **patch})

    space = {
        "id": "s", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
        "plan_scale_x": 1.2, "plan_scale_y": 0.8, "plan_angle": -35,
    }
    out = v.SPACE_SCHEMA(space)
    assert out["plan_scale_x"] == 1.2 and out["plan_angle"] == -35
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**space, "plan_scale_x": 0})


def test_space_id_matches_SPACE_ID_RE():
    ok = {"id": "f1", "title": "F", "view_box": [0, 0, 1, 1], "rooms": []}
    v.SPACE_SCHEMA(ok)
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "id": "Bad Id"})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**ok, "id": ""})


def test_marker_use_climate_temp_is_bool_or_none():
    # opt-in room-temperature from climate devices (owner's feature 2026-08-03)
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "use_climate_temp": True})
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "use_climate_temp": False})
    v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "use_climate_temp": None})
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA({"id": "m1", "binding": "device:abc", "use_climate_temp": "yes"})


def test_marker_light_role_and_glow_override_contract():
    base = {"id": "m1", "binding": "device:abc"}
    for role in (True, False, None):
        assert v.MARKER_SCHEMA({**base, "is_light": role})["is_light"] is role

    assert v.MARKER_SCHEMA({**base, "glow_color": {"c": "#123456"}})["glow_color"] == {
        "c": "#123456",
    }
    assert v.MARKER_SCHEMA({
        **base, "glow_color": {"c": "#123456", "bri": None},
    })["glow_color"] == {"c": "#123456", "bri": None}
    assert v.MARKER_SCHEMA({
        **base, "glow_color": {"c": "#123456", "bri": 0.01},
    })["glow_color"]["bri"] == 0.01

    for glow in (
        {"c": "red"}, {"c": "#123456", "bri": 0},
        {"c": "#123456", "bri": 1.01}, {"c": "#123456", "bri": float("nan")},
        {"c": "#123456", "bri": float("inf")}, {"c": "#123456", "extra": True},
        {"bri": 0.5},
    ):
        with pytest.raises(vol.Invalid):
            v.MARKER_SCHEMA({**base, "glow_color": glow})


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


def test_hide_layer_settings():
    """«Скрыть декоративный слой» / «Скрыть проёмы»: optional, strictly bool."""
    base = {"id": "f1", "title": "F", "view_box": [0, 0, 1, 1], "rooms": []}
    # absent — every plan written before 2026-08-05 still validates
    v.SPACE_SCHEMA(dict(base, settings={}))
    v.SPACE_SCHEMA(dict(base, settings={"hide_decor": True, "hide_openings": True}))
    v.SPACE_SCHEMA(dict(base, settings={"hide_decor": False, "hide_openings": False}))
    for bad in ("yes", 1, None, [], {}):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA(dict(base, settings={"hide_decor": bad}))
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA(dict(base, settings={"hide_openings": bad}))


def test_bg_color_setting():
    """Background-around-the-plan color: strict #rrggbb, globally and per space."""
    ok_space = {
        "id": "f1", "title": "F", "view_box": [0, 0, 1, 1], "rooms": [],
        "settings": {"bg_color": "#102030"},
    }
    v.SPACE_SCHEMA(ok_space)
    v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_color": "#A1b2C3"}})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(dict(ok_space, settings={"bg_color": "red"}))
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_color": "url(javascript:x)"}})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_color": "#12345"}})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_color": "#1234567"}})


def test_all_persisted_color_fields_share_the_strict_hex_contract():
    """Issue #21: no CSS grammar reaches storage through any colour field."""
    space = {"id": "f1", "title": "F", "view_box": [0, 0, 1, 1], "rooms": []}
    line = {"id": "d", "kind": "line", "x1": 0, "y1": 0, "x2": 1, "y2": 1}
    rect = {"id": "r", "kind": "rect", "x": 0, "y": 0, "w": 1, "h": 1}
    marker = {"id": "m", "binding": "device:x"}
    bad_colors = (
        "#fff", " #123456", "#123456 ", "red", "rgb(1, 2, 3)",
        "red;position:fixed", "#123456;inset:0", "url(https://example.test/x)",
        "#123456/*x*/", "#12345\\36", "#123456\ncolor:red", "#12345678",
    )
    for color in bad_colors:
        calls = (
            lambda: v.SPACE_SCHEMA({**space, "settings": {"room_color": color}}),
            lambda: v.SPACE_SCHEMA({**space, "settings": {"bg_color": color}}),
            lambda: v.DECOR_SCHEMA({**line, "color": color}),
            lambda: v.DECOR_SCHEMA({**rect, "fill_color": color}),
            lambda: v.MARKER_SCHEMA({**marker, "ripple_color": color}),
            lambda: v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_color": color}}),
            lambda: v.CONFIG_SCHEMA({
                "spaces": [], "settings": {"fill_colors": {"glow_base": {"c": color, "a": 1}}},
            }),
        )
        for call in calls:
            with pytest.raises(vol.Invalid):
                call()


def test_sun_settings_global():
    """Active sun settings plus the accepted-but-ignored legacy weather field."""
    v.CONFIG_SCHEMA({"spaces": [], "settings": {
        "north_deg": 0, "bg_mode": "daynight", "sun_rays": True, "weather_entity": "weather.home",
    }})
    v.CONFIG_SCHEMA({"spaces": [], "settings": {"north_deg": 359, "bg_mode": "static"}})
    v.CONFIG_SCHEMA({"spaces": [], "settings": {"weather_entity": None}})
    for bad in (360, -1, 1.5, "90", True, None):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [], "settings": {"north_deg": bad}})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"bg_mode": "disco"}})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"sun_rays": "yes"}})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"weather_entity": {"e": 1}}})


def test_sun_settings_per_space():
    """The same three at the space level; None/absent = inherit; no weather here."""
    ok = {"id": "f1", "title": "F", "view_box": [0, 0, 1, 1], "rooms": []}
    v.SPACE_SCHEMA(dict(ok, settings={"north_deg": 90, "bg_mode": "daynight", "sun_rays": False}))
    v.SPACE_SCHEMA(dict(ok, settings={"north_deg": None, "bg_mode": None, "sun_rays": None}))
    for bad in (360, -1, 2.5, "0", True):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA(dict(ok, settings={"north_deg": bad}))
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(dict(ok, settings={"bg_mode": "auto"}))
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(dict(ok, settings={"sun_rays": 1}))


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
    base = {"id": "s1", "title": "S", "aspect": 1.0, "view_box": [0, 0, 1, 1], "rooms": []}
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


def test_geometry_magnitudes_are_bounded():
    """HP-1501-01: any finite float used to pass, and one schema-valid 1e100
    room vertex made the space unviewable for every client — the exact failure
    HP-1500-03 closed for layout positions, one schema over. The range is
    garbage insurance, not an envelope for the plan (docs/CANVAS.md)."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    huge = 1e100
    for cfg in (
        {**base, "rooms": [{"id": "r", "name": "R", "poly": [[0, 0], [huge, 0], [1, 1]]}]},
        {**base, "rooms": [{"id": "r", "name": "R", "poly": [[0, 0], [-huge, 0], [1, 1]]}]},
        {**base, "rooms": [{"id": "r", "name": "R", "x": huge, "y": 0, "w": 1, "h": 1}]},
        {**base, "rooms": [{"id": "r", "name": "R", "x": 0, "y": 0, "w": huge, "h": 1}]},
        {**base, "view_box": [0, 0, huge, 1]},
        {**base, "openings": [{"id": "o", "type": "door", "x": huge, "y": 0.5,
                               "angle": 0, "length": 0.1}]},
        {**base, "openings": [{"id": "o", "type": "door", "x": 0.5, "y": 0.5,
                               "angle": 1e6, "length": 0.1}]},
    ):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [cfg]})
    # a vertex a bit past the canvas edge is a drawing, not an attack
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
        {"id": "r", "name": "R", "poly": [[-0.2, 0], [1.3, 0], [1, 1]]}]}]})


def test_infinite_canvas_range():
    """docs/CANVAS.md §3: the canvas is unbounded, so a plan drawn far past the
    old unit square must SAVE. The limits moved from ±4 to ±5000: 4.5 and 1000
    are ordinary plans now, 6000 is still refused."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    assert v.CANVAS_LIMIT == 5000.0
    # --- coordinates that used to be rejected by the ±4 envelope -----------
    for good in (4.5, 12.0, 1000.0, -4.5, -1000.0):
        assert v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
            {"id": "r", "name": "R", "poly": [[good, good], [good + 0.5, good],
                                              [good + 0.5, good + 0.5]]}]}]})
        assert v.LAYOUT_SCHEMA({"d1": {"s": "s1", "x": good, "y": good}})
        assert v.CONFIG_SCHEMA({"spaces": [{**base, "openings": [
            {"id": "o", "type": "door", "x": good, "y": good,
             "angle": 30, "length": 0.1}]}]})
        assert v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [
            {"id": "d", "kind": "rect", "x": good, "y": good, "w": 0.2, "h": 0.2}]}]})
    # sizes follow the same ceiling but stay strictly positive
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
        {"id": "r", "name": "R", "x": 1.5, "y": 1.5, "w": 4.5, "h": 1000.0}]}]})
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "view_box": [1.5, 1.5, 4.5, 1000.0]}]})
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "openings": [
        {"id": "o", "type": "door", "x": 2.5, "y": 2.5, "angle": 0, "length": 4.5}]}]})
    # --- and 6000 is still garbage ---------------------------------------
    for bad in (6000.0, -6000.0):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
                {"id": "r", "name": "R", "poly": [[bad, 0], [1, 0], [1, 1]]}]}]})
        with pytest.raises(vol.Invalid):
            v.LAYOUT_SCHEMA({"d1": {"s": "s1", "x": bad, "y": 0.5}})
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [
                {"id": "d", "kind": "line", "x1": bad, "y1": 0, "x2": 1, "y2": 1}]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "view_box": [0, 0, 6000.0, 1]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
            {"id": "r", "name": "R", "x": 0, "y": 0, "w": 6000.0, "h": 1}]}]})
    # sizes are still not coordinates: zero and negative stay refused
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "openings": [
            {"id": "o", "type": "door", "x": 0.5, "y": 0.5, "angle": 0, "length": 0}]}]})


def test_existing_plans_stay_valid():
    """No migration (docs/CANVAS.md §1): a config written by any released
    version must validate untouched after the limits moved."""
    legacy = {
        "spaces": [{
            "id": "f1", "title": "Ground", "aspect": 1.0, "plan_url": "/local/f1.svg",
            "plan_aspect": 1.25, "view_box": [0, 0, 1, 1],
            "segments": [[0, 0, 1, 0]],
            "rooms": [
                {"id": "r1", "name": "Living", "area": "living_room",
                 "poly": [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]]},
                {"id": "r2", "name": "Kitchen", "x": 0.55, "y": 0.14, "w": 0.41, "h": 0.32},
            ],
            "openings": [{"id": "o1", "type": "window", "x": 0.3, "y": 0.14,
                          "angle": 0, "length": 0.08}],
            "decor": [{"id": "d1", "kind": "line", "x1": 0.1, "y1": 0.1,
                       "x2": 0.9, "y2": 0.1, "color": "#ffffff"},
                      {"id": "d2", "kind": "text", "x": 0.5, "y": 0.9, "text": "Porch"}],
            "settings": {"show_borders": True, "room_opacity": 0.5},
        }],
        "markers": [{"id": "m1", "binding": "device:abc", "space": "f1", "size": 1.4}],
        "settings": {"glow_radius_cm": 300},
    }
    out = v.CONFIG_SCHEMA(legacy)
    assert out["spaces"][0]["rooms"][0]["poly"][0] == [0.04, 0.14]
    assert "segments" not in out["spaces"][0]
    assert v.LAYOUT_SCHEMA({"d_light1": {"s": "f1", "x": 0.22, "y": 0.22},
                            "rl_r1": {"s": "f1", "x": 0.3, "y": 0.3}})


def test_sizes_are_not_coordinates():
    """HP-1502-01: a size must be strictly positive — SVG refuses zero and
    negative width/height, and the clients divide by these. view_box [0,0,0,0]
    used to pass the shared validator and blank the plan on every client.
    Coordinates may still be negative: a crop origin can sit past the edge."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    for cfg in (
        {**base, "view_box": [0, 0, 0, 0]},
        {**base, "view_box": [0, 0, -1, -2]},
        {**base, "view_box": [0, 0, 1, 0.0001]},  # below the 0.001 floor
        {**base, "rooms": [{"id": "r", "name": "R", "x": 0.1, "y": 0.1, "w": 0, "h": 0.5}]},
        {**base, "rooms": [{"id": "r", "name": "R", "x": 0.1, "y": 0.1, "w": 0.5, "h": -1}]},
    ):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [cfg]})
    # negative COORDINATES stay legal, and a normal crop viewport passes
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "view_box": [-0.2, -0.1, 1.4, 1.2]}]})
    assert v.CONFIG_SCHEMA({"spaces": [{**base, "rooms": [
        {"id": "r", "name": "R", "x": -0.1, "y": -0.1, "w": 0.4, "h": 0.3}]}]})


def test_openings_cap_enforced():
    """audit follow-up B5: MAX_OPENINGS was defined but never wired in."""
    many = [{"id": f"o{i}", "type": "door", "x": 0.1, "y": 0.1, "angle": 0, "length": 0.1}
            for i in range(v.MAX_OPENINGS + 1)]
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{"id": "s1", "title": "S", "aspect": 1.0,
                                     "view_box": [0, 0, 1, 1], "rooms": [],
                                     "openings": many}]})


def test_gate_is_a_valid_opening_type():
    """Gates share door data semantics; only the frontend symbol differs."""
    space = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
             "openings": [{"id": "g1", "type": "gate", "x": 0.5, "y": 0.1,
                           "angle": 0, "length": 0.3, "contact": "binary_sensor.gate",
                           "lock": "lock.gate"}]}
    out = v.CONFIG_SCHEMA({"spaces": [space]})
    assert out["spaces"][0]["openings"][0]["type"] == "gate"
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**space, "openings": [
            {**space["openings"][0], "type": "garage"}]}]})


def _passage_config(**opening_fields):
    opening = {
        "id": "p1", "type": "passage", "x": 0.5, "y": 0.1,
        "angle": 0, "length": 0.09, **opening_fields,
    }
    return {"spaces": [{
        "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
        "rooms": [], "openings": [opening],
    }]}


def test_passage_schema_and_canonical_semantics():
    config = v.CONFIG_SCHEMA(_passage_config(extension={"future": True}))
    passage = config["spaces"][0]["openings"][0]
    assert passage["type"] == "passage"
    assert passage["extension"] == {"future": True}
    v.validate_opening_passages(config, validate_all=True)


@pytest.mark.parametrize("field,value", [
    ("contact", None), ("lock", "lock.front"), ("invert", False),
    ("flip_h", False), ("flip_v", True),
])
def test_passage_validate_all_rejects_presence_of_every_forbidden_key(field, value):
    with pytest.raises(v.OpeningPassageError) as caught:
        v.validate_opening_passages(_passage_config(**{field: value}), validate_all=True)
    assert caught.value.code == "invalid_passage_fields"
    assert caught.value.fields == (field,)


def test_passage_broken_read_is_change_aware_and_sorted():
    previous = _passage_config(
        contact="binary_sensor.private", flip_h=False, extension={"kept": 1},
    )
    unchanged = _passage_config(
        contact="binary_sensor.private", flip_h=False, extension={"kept": 2},
    )
    unchanged["spaces"][0]["openings"][0]["x"] = 0.6
    v.validate_opening_passages(unchanged, previous)

    repaired = _passage_config(extension={"kept": 2})
    v.validate_opening_passages(repaired, previous)

    changed = _passage_config(contact="binary_sensor.other", flip_h=True)
    with pytest.raises(v.OpeningPassageError) as caught:
        v.validate_opening_passages(changed, previous)
    assert caught.value.fields == ("contact", "flip_h")
    assert "binary_sensor" not in str(caught.value)
    assert str(caught.value) == "space=ground; opening=p1; fields=contact,flip_h"


def test_changing_a_door_with_stale_fields_to_passage_requires_canonicalisation():
    previous = _passage_config(contact="binary_sensor.front")
    previous["spaces"][0]["openings"][0]["type"] = "door"
    with pytest.raises(v.OpeningPassageError):
        v.validate_opening_passages(
            _passage_config(contact="binary_sensor.front"), previous,
        )


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
    # Read/write compatibility for stores created before the unified activity UI.
    v.MARKER_SCHEMA(_marker(display="ripple"))
    v.MARKER_SCHEMA(_marker(display=None))
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA(_marker(display="wat"))


def test_run_target_is_bounded_to_runnable_domains():
    """Owner's spec 2026-07-29: a tap may RUN automations, scripts and scenes —
    and nothing else. The target rides the marker, so the schema is the door."""
    for ok in ("automation.morning", "script.curtains", "scene.movie"):
        v.MARKER_SCHEMA(_marker(tap_action="run", tap_target=ok, tap_confirm=True))
    for bad in ("light.lamp", "lock.front_door", "shell_command.rm", "automation.", "x"):
        with pytest.raises(vol.Invalid):
            v.MARKER_SCHEMA(_marker(tap_action="run", tap_target=bad))


def test_every_tap_action_the_editor_offers_is_accepted():
    for action in _ts_list("TAP_ACTIONS"):
        v.MARKER_SCHEMA(_marker(tap_action=action))
    with pytest.raises(vol.Invalid):
        v.MARKER_SCHEMA(_marker(tap_action="launch-missiles"))


def test_cover_tap_action_is_accepted():
    """Issue #94: the editor no longer offers the separate cover action, but
    old plans must keep loading and round-tripping it losslessly."""
    assert "cover" not in _ts_list("TAP_ACTIONS")
    v.MARKER_SCHEMA(_marker(tap_action="cover"))
    v.MARKER_SCHEMA(_marker(tap_action="cover", tap_confirm=True))


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


def test_custom_fill_color_and_alpha_are_strict_on_space_and_room():
    v.SPACE_SCHEMA(_space(fill_mode="custom", custom_fill={"c": "#123ABC", "a": 0.4}))
    v.SPACE_SCHEMA(_space(fill_mode="custom", custom_fill=None))
    custom_room = _space(fill_mode="none")
    custom_room["rooms"] = [{
        "id": "r1", "name": "R", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2,
        "settings": {"fill_mode": "custom", "custom_fill": {"c": "#abcdef", "a": 1}},
    }]
    v.SPACE_SCHEMA(custom_room)
    custom_room["rooms"][0]["settings"]["custom_fill"] = None
    v.SPACE_SCHEMA(custom_room)
    for bad in ({"c": "red", "a": 0.2}, {"c": "#123456\n", "a": 0.2},
                {"c": "#123456", "a": float("nan")}, {"c": "#123456", "a": 1.1},
                {"c": "#123456"}, {"a": 0.2}):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA(_space(fill_mode="custom", custom_fill=bad))
        room_bad = _space(fill_mode="none")
        room_bad["rooms"] = [{
            "id": "r1", "name": "R", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2,
            "settings": {"fill_mode": "custom", "custom_fill": bad},
        }]
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA(room_bad)


def test_independent_glow_fields_and_legacy_tokens_are_accepted():
    # Current UI writes two independent fields; old dashboard bundles remain
    # valid writers of the legacy enum forever.
    v.SPACE_SCHEMA(_space(fill_mode="temp", glow_enabled=True))
    v.SPACE_SCHEMA(_space(fill_mode="glow", glow_enabled=False))
    legacy_room = _space(fill_mode="none", glow_enabled=False)
    legacy_room["rooms"] = [{
        "id": "r1", "name": "R", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2,
        "settings": {"fill_mode": "glow", "glow": False},
    }]
    v.SPACE_SCHEMA(legacy_room)
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA(_space(glow_enabled="yes"))


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


def test_reserve_filename_claims_the_name_atomically(tmp_path):
    """HP-1460-01: choosing a name and taking it must be one operation.

    The old helper asked `exists()` and returned a string; two uploads racing
    between the check and the write agreed on the same name and one overwrote
    the other, both reporting success.
    """
    reserve = plans.reserve_filename
    d = tmp_path / "m1"

    first = reserve(d, "manual.pdf")
    assert first == "manual.pdf"
    assert (d / first).is_file(), "the name is taken, not merely picked"
    second = reserve(d, "manual.pdf")
    assert second == "manual-2.pdf" and (d / second).is_file()
    assert reserve(d, "manual.pdf") == "manual-3.pdf"

    assert reserve(d, "readme") == "readme"
    assert reserve(d, "readme") == "readme-2"
    assert reserve(d, "../../etc/passwd") == "passwd"


def test_reserve_filename_result_survives_the_content_sanitizer(tmp_path):
    """A name the view would rewrite is a file written and then never served."""
    reserve = plans.reserve_filename
    d = tmp_path / "m2"
    long_stem = "x" * 200                      # far past the limit
    names = [reserve(d, f"{long_stem}.pdf") for _ in range(12)]
    assert len(set(names)) == 12, "each call takes its own name"
    for n in names:
        assert len(n) <= v.MAX_FILENAME
        assert v.sanitize_filename(n) == n, n
        assert n.endswith(".pdf")

    # a name already exactly at the limit still leaves room for the tag
    exact = "y" * (v.MAX_FILENAME - 4) + ".pdf"
    assert len(exact) == v.MAX_FILENAME
    a = reserve(d, exact)
    b = reserve(d, exact)
    assert a != b and len(b) <= v.MAX_FILENAME and v.sanitize_filename(b) == b


def test_reserve_filename_is_safe_under_concurrency(tmp_path):
    """Twenty threads, one filename: twenty distinct files, nothing overwritten."""
    from concurrent.futures import ThreadPoolExecutor

    reserve = plans.reserve_filename
    d = tmp_path / "m3"
    d.mkdir(parents=True)
    with ThreadPoolExecutor(max_workers=20) as pool:
        names = list(pool.map(lambda _: reserve(d, "manual.pdf"), range(20)))
    assert len(set(names)) == 20
    assert sorted(p.name for p in d.iterdir()) == sorted(names)


def test_sweep_upload_temps(tmp_path):
    """HP-1460-02: a crashed transfer leaves a temp no other collector sees."""
    import os
    import time

    files = tmp_path / "files"
    files.mkdir()
    fresh = files / f"{plans.TMP_PREFIX}fresh"
    old = files / f"{plans.TMP_PREFIX}old"
    keep = files / "notes.txt"
    for f in (fresh, old, keep):
        f.write_bytes(b"x")
    t = time.time() - const.PLAN_ORPHAN_TTL_S - 60
    os.utime(old, (t, t))

    assert plans.sweep_upload_temps(files) == 1
    assert not old.exists(), "an aged temporary goes"
    assert fresh.is_file(), "a fresh one may belong to a request in flight"
    assert keep.is_file(), "nothing else is touched"
    assert plans.sweep_upload_temps(tmp_path / "nope") == 0


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


def _aged(path, seconds):
    import os
    import time

    t = time.time() - seconds
    os.utime(path, (t, t))


def _sp(sid, url):
    return {"id": sid, "plan_url": f"/api/houseplan/content/plans/_/{url}" if url else None}


def test_plan_collection_matrix(tmp_path):
    """Which config transition means "the user asked for this file to go"?

    `old_refs - new_refs` cannot tell replace, detach and delete-space apart —
    they look identical. v1.46.4/v1.46.5 added guards for detach and only ever
    reached them on the scheduled pass, so the commit itself still deleted a
    detached plan the moment it was detached (HP-1465-01). One case is a
    deletion the user asked for; the rest are kept.
    """
    collect = plans.collect_plans
    d = tmp_path / "plans"
    d.mkdir()

    def seed(*names):
        for n in names:
            (d / n).write_bytes(b"x")
            _aged(d / n, const.SCHEDULED_GRACE_S * 2)  # old enough for any rule

    # 1. replace: the user picked a different image for the same space
    seed("f1.old.png", "f1.new.png")
    assert collect(d, {"spaces": [_sp("f1", "f1.old.png")]},
                      {"spaces": [_sp("f1", "f1.new.png")]}) == 1
    assert not (d / "f1.old.png").exists() and (d / "f1.new.png").is_file()

    # 2. detach: same space, switched to "draw"
    seed("f2.png")
    assert collect(d, {"spaces": [_sp("f2", "f2.png")]},
                      {"spaces": [_sp("f2", None)]}) == 0
    assert (d / "f2.png").is_file(), "the editor says the file stays — it stays"

    # 3. the space is deleted outright
    seed("f3.png")
    assert collect(d, {"spaces": [_sp("f3", "f3.png")]}, {"spaces": []}) == 0
    assert (d / "f3.png").is_file()

    # 4. the scheduled pass, later, still keeps both
    cfg = {"spaces": [_sp("f2", None)]}
    assert collect(d, cfg, cfg) == 0
    assert (d / "f2.png").is_file() and (d / "f3.png").is_file()

    # 5. an upload whose save was rejected is kept too, at any age. Ageing those
    #    out raced the retry: the sweep deleted a file the save was committing a
    #    reference to (caught by test_sweep_and_a_config_write_do_not_race).
    seed("f4.current.png", "f4.reject.png")
    live = {"spaces": [_sp("f4", "f4.current.png")]}
    assert collect(d, live, live) == 0
    assert (d / "f4.current.png").is_file() and (d / "f4.reject.png").is_file()

    # 6. the same file still referenced by another space is never touched
    seed("shared.png")
    assert collect(d, {"spaces": [_sp("a", "shared.png"), _sp("b", "shared.png")]},
                      {"spaces": [_sp("a", None), _sp("b", "shared.png")]}) == 0
    assert (d / "shared.png").is_file()


def test_attachment_collection_matrix(tmp_path):
    """Removing an attachment is a trash button; deleting the device is not."""
    collect = plans.collect_attachments

    def case(name):
        d = tmp_path / name
        d.mkdir()
        return d

    def seed(root, folder, fname, age=None):
        (root / folder).mkdir(parents=True, exist_ok=True)
        p = root / folder / fname
        p.write_bytes(b"x")
        if age:
            _aged(p, age)
        return p

    def cfg(*markers):
        return {"markers": [
            {"id": mid, "pdfs": [{"url": f"/api/houseplan/content/files/{mid}/{n}"} for n in names]}
            for mid, names in markers
        ]}

    # 1. the user removed one attachment from a device that still exists
    d = case("dropped")
    seed(d, "m1", "dropped.pdf")
    seed(d, "m1", "kept.pdf")
    assert collect(d, cfg(("m1", ["dropped.pdf", "kept.pdf"])), cfg(("m1", ["kept.pdf"]))) == 1
    assert not (d / "m1" / "dropped.pdf").exists()
    assert (d / "m1" / "kept.pdf").is_file()

    # 2. the device itself is gone: its manuals are not ours to throw away
    d = case("device_gone")
    seed(d, "m2", "manual.pdf", age=const.SCHEDULED_GRACE_S * 2)
    assert collect(d, cfg(("m2", ["manual.pdf"])), cfg()) == 0
    assert (d / "m2" / "manual.pdf").is_file()
    # and the scheduled pass, later, agrees
    assert collect(d, cfg(), cfg()) == 0
    assert (d / "m2" / "manual.pdf").is_file()

    # 3. a dialog that was never saved, in its own staging folder
    d = case("staging")
    seed(d, "up_x", "manual.pdf", age=const.PLAN_ORPHAN_TTL_S + 60)
    assert collect(d, cfg(), cfg()) == 1
    assert not (d / "up_x").exists()

    # 4. an upload into a live device's folder whose save was rejected: kept,
    #    for the same reason as a plan's — a retry may be about to reference it
    d = case("reject")
    seed(d, "m3", "current.pdf")
    seed(d, "m3", "rejected.pdf", age=const.SCHEDULED_GRACE_S + 60)
    live = cfg(("m3", ["current.pdf"]))
    assert collect(d, live, live) == 0
    assert (d / "m3" / "current.pdf").is_file()
    assert (d / "m3" / "rejected.pdf").is_file()


def test_only_a_staging_folder_ages_out(tmp_path):
    """The one age rule left. Everything else waits for the user to say so."""
    import os
    import time

    files = tmp_path / "files"
    (files / "m1").mkdir(parents=True)
    (files / "up_abandoned").mkdir(parents=True)
    ancient = time.time() - const.SCHEDULED_GRACE_S * 12
    hour_ago = time.time() - const.PLAN_ORPHAN_TTL_S - 60

    for path, when in (
        ((files / "m1" / "ancient.pdf"), ancient),
        ((files / "up_abandoned" / "manual.pdf"), hour_ago),
    ):
        path.write_bytes(b"x")
        os.utime(path, (when, when))

    cfg = {"markers": [{"id": "m1", "pdfs": []}]}
    assert plans.collect_attachments(files, cfg, cfg) == 1
    assert (files / "m1" / "ancient.pdf").is_file(), "age alone is never a reason"
    assert not (files / "up_abandoned").exists(), "a cancelled dialog goes after an hour"




# ---------- square canvas migration (v1.48.0) ----------


gm = _load_pure("geometry_migration")


def _sq(space, layout=None):
    cfg = {"spaces": [space]}
    gm.migrate_config(cfg, layout if layout is not None else {})
    return cfg["spaces"][0]


def test_the_viewport_becomes_the_whole_square():
    """The grid is drawn over the view box, and the fit fits it.

    Transforming the old rectangle instead would leave the new margins outside
    the canvas — no grid there and nothing to draw on — which is the room the
    square canvas was meant to add.
    """
    sp = _sq({"id": "f1", "aspect": 0.5, "view_box": [0.1, 0.2, 0.5, 0.5], "rooms": []})
    assert sp["view_box"] == [0.0, 0.0, 1.0, 1.0]


def test_a_wide_plan_gains_margins_above_and_below():
    sp = _sq({
        "id": "f1", "aspect": 2.0, "cell_cm": 5, "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "r", "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}],
    })
    r = sp["rooms"][0]
    assert (r["x"], r["w"]) == (0.0, 1.0), "the width is untouched"
    assert r["y"] == 0.25 and r["h"] == 0.5, "half the height, centred"
    assert sp["cell_cm"] == 5, "the grid is tied to the width, which did not change"
    assert "aspect" not in sp


def test_a_tall_plan_gains_margins_on_the_sides_and_rescales_the_grid():
    sp = _sq({
        "id": "f1", "aspect": 0.5, "cell_cm": 5, "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "r", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}],
    })
    poly = sp["rooms"][0]["poly"]
    assert [round(c, 6) for c in poly[0]] == [0.25, 0.0]
    assert [round(c, 6) for c in poly[2]] == [0.75, 1.0], "half the width, centred"
    assert sp["cell_cm"] == 10, "the canvas got twice as wide, so a cell is twice the cm"


def test_a_square_plan_is_left_alone():
    before = {
        "id": "f1", "aspect": 1.0, "cell_cm": 5, "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "r", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}],
    }
    sp = _sq({**before, "rooms": [dict(before["rooms"][0])]})
    assert sp["rooms"][0] == before["rooms"][0]
    assert sp["cell_cm"] == 5 and sp["view_box"] == [0.0, 0.0, 1.0, 1.0]


def test_migration_preserves_real_lengths_and_shapes():
    """A wall keeps its length in centimetres, and a square stays square."""
    GRID = 1000.0

    def wall_cm(space, p, q):
        # render units per normalised unit is the canvas width, always 1000
        dx = (q[0] - p[0]) * GRID
        dy = (q[1] - p[1]) * GRID
        pitch = GRID / 40  # whatever the grid is, the same constant both sides
        return ((dx * dx + dy * dy) ** 0.5 / pitch) * float(space["cell_cm"])

    for aspect in (2.0, 0.5, 0.8155784250916674, 1.4142):
        # a square room, 0.2 x 0.2 of the OLD box, i.e. 200 x 200/aspect render
        old = {"id": "f", "aspect": aspect, "cell_cm": 5,
               "rooms": [{"id": "r", "poly": [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]]}]}
        before_w = 0.2 * GRID
        before_h = 0.2 * GRID / aspect
        before_cm_w = (before_w / (GRID / 40)) * 5
        sp = _sq(old)
        poly = sp["rooms"][0]["poly"]
        after_w = (poly[1][0] - poly[0][0]) * GRID
        after_h = (poly[2][1] - poly[1][1]) * GRID
        assert abs(after_w / after_h - before_w / before_h) < 1e-9, "shape preserved"
        # cell_cm is stored rounded — a user reads it — so allow 0.01 cm on a
        # 40 cm wall rather than pretending the scale is infinitely precise
        assert abs(wall_cm(sp, poly[0], poly[1]) - before_cm_w) < 1e-2, "length in cm preserved"


def test_migration_moves_marker_positions_of_that_space_only():
    layout = {
        "a": {"s": "f1", "x": 0.5, "y": 0.5},
        "b": {"s": "other", "x": 0.5, "y": 0.5},
        "c": "not a dict",
    }
    cfg = {"spaces": [{"id": "f1", "aspect": 2.0, "rooms": []},
                      {"id": "other", "rooms": []}]}
    assert gm.migrate_config(cfg, layout) is True
    assert layout["a"] == {"s": "f1", "x": 0.5, "y": 0.5}, "x untouched for a wide plan"
    assert layout["a"]["y"] == 0.5
    assert layout["b"] == {"s": "other", "x": 0.5, "y": 0.5}, "another space is not touched"


def test_migration_runs_once_and_only_when_needed():
    cfg = {"spaces": [{"id": "f1", "aspect": 2.0, "rooms": [], "cell_cm": 5}]}
    assert gm.migrate_config(cfg, {}) is True
    snapshot = repr(cfg)
    assert gm.migrate_config(cfg, {}) is False, "already square: nothing to do"
    assert repr(cfg) == snapshot


def test_migration_survives_a_crash_between_the_two_store_writes():
    """HP-1490-01: the two stores are written independently and either write
    can fail. The intent (space -> old aspect) is saved BEFORE anything moves
    and cleared with the layout write, so whichever half is missing after a
    crash, the next start finishes exactly it — once.
    """
    cfg = {"spaces": [{"id": "f1", "aspect": 2.0, "rooms": []}]}
    layout = {"m": {"s": "f1", "x": 0.1, "y": 0.1}}

    # start of the migration: the intent is computed from the config
    pending = gm.pending_from_config(cfg)
    assert pending == {"f1": 2.0}

    # the config half commits; the process dies before the layout half
    assert gm.migrate_config(cfg) is True
    assert gm.pending_from_config(cfg) == {}, "the trigger left with the config write"

    # next start: the config offers nothing, the SAVED intent still knows
    assert gm.migrate_layout(layout, pending) is True
    assert layout["m"] == {"s": "f1", "x": 0.1, "y": 0.3}, "y is re-centred for a wide plan"

    # and the layout half never runs twice, because the intent is cleared by
    # the same write that stores the migrated layout — with no intent there is
    # nothing to apply
    assert gm.migrate_layout(layout, {}) is False
    assert layout["m"] == {"s": "f1", "x": 0.1, "y": 0.3}


def test_migration_intent_is_the_union_of_saved_and_current():
    """A crash BEFORE the config write leaves both the intent and the aspects;
    merging them must not double anything, and a space added to the config
    since (there cannot be one mid-crash, but the code should not care) still
    migrates."""
    cfg = {"spaces": [{"id": "f1", "aspect": 2.0, "rooms": []}]}
    saved = {"f1": 2.0}
    merged = {**saved, **gm.pending_from_config(cfg)}
    assert merged == {"f1": 2.0}
    layout = {"m": {"s": "f1", "x": 0.1, "y": 0.1}}
    gm.migrate_config(cfg)
    gm.migrate_layout(layout, merged)
    assert layout["m"]["y"] == 0.3
    assert cfg["spaces"][0]["view_box"] == [0.0, 0.0, 1.0, 1.0]


# ---------- store-wide limits (HP-1470-01) ----------


def test_check_quota_counts_the_whole_store_not_one_request(tmp_path):
    """Per-request caps say nothing about how many requests there are."""
    d = tmp_path / "plans"
    d.mkdir()
    for i in range(3):
        (d / f"p{i}.png").write_bytes(b"x" * 1000)

    plans.check_quota(d, 1000, max_bytes=10_000, max_files=10)   # fits

    with pytest.raises(plans.QuotaError) as e:
        plans.check_quota(d, 8000, max_bytes=10_000, max_files=10)
    assert e.value.reason == "quota_exceeded" and "MB" in e.value.detail

    with pytest.raises(plans.QuotaError) as e:
        plans.check_quota(d, 1, max_bytes=10_000, max_files=3)
    assert e.value.reason == "too_many_files"


def test_dir_usage_walks_subfolders_and_ignores_the_unreadable(tmp_path):
    d = tmp_path / "files"
    (d / "m1").mkdir(parents=True)
    (d / "m1" / "a.pdf").write_bytes(b"x" * 10)
    (d / "b.pdf").write_bytes(b"x" * 5)
    assert plans.dir_usage(d) == (15, 2)
    assert plans.dir_usage(tmp_path / "nope") == (0, 0)


def test_check_quota_refuses_when_the_disk_is_nearly_full(tmp_path, monkeypatch):
    import shutil

    d = tmp_path / "plans"
    d.mkdir()
    monkeypatch.setattr(
        shutil, "disk_usage", lambda _p: type("U", (), {"free": const.MIN_FREE_BYTES // 2})()
    )
    with pytest.raises(plans.QuotaError) as e:
        plans.check_quota(d, 1, max_bytes=10 ** 12, max_files=10 ** 6)
    assert e.value.reason == "low_disk_space"


class TestVacuum:
    """marker.vacuum (docs/VACUUM.md): optional everywhere, matrices strict."""

    def test_full_object_passes(self):
        v.MARKER_SCHEMA(_marker(vacuum={
            "live": True, "trail": True, "room_highlight": False,
            "source": "camera.robo_map",
            "calibration": {"0": [0.02, 0.0, 300.0, 0.0, 0.02, 400.0]},
            "segment_map": {"16": "kitchen"},
        }))

    def test_absent_and_none_pass(self):
        v.MARKER_SCHEMA(_marker())
        v.MARKER_SCHEMA(_marker(vacuum=None))

    def test_bad_matrices_rejected(self):
        import pytest
        for bad in (
            [1, 2, 3, 4, 5],                       # 5 numbers
            [1, 2, 3, 4, 5, 6, 7],                 # 7 numbers
            [1, 2, 3, 4, 5, float("nan")],         # non-finite
            [1, 2, 3, 4, 5, float("inf")],
            [1, 2, 3, 4, 5, "x"],                  # junk type
        ):
            with pytest.raises(Exception):
                v.MARKER_SCHEMA(_marker(vacuum={"calibration": {"0": bad}}))

    def test_unknown_keys_rejected(self):
        import pytest
        with pytest.raises(Exception):
            v.MARKER_SCHEMA(_marker(vacuum={"teleport": True}))

    def test_trail_mode_bounded(self):
        import pytest
        for ok in ("never", "cleaning", "always", None):
            v.MARKER_SCHEMA(_marker(vacuum={"trail_mode": ok}))
        with pytest.raises(Exception):
            v.MARKER_SCHEMA(_marker(vacuum={"trail_mode": "sometimes"}))


def test_decor_text_live_fields():
    """docs/LIVE-TEXT.md: new references live in `text`; the bounded legacy
    entity/attribute/unit fields remain valid until an old label is edited."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    txt = {"id": "d", "kind": "text", "x": 0.5, "y": 0.5,
           "text": "Бак {sensor.water_tank}"}

    def cfg(extra):
        return v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [{**txt, **extra}]}]})

    # --- a plain label is untouched by the new fields ---------------------
    assert cfg({})["spaces"][0]["decor"][0] == txt
    # --- accepted ---------------------------------------------------------
    out = cfg({"entity": "sensor.water_tank", "attr": "battery_level", "unit": "%"})
    shape = out["spaces"][0]["decor"][0]
    assert shape["entity"] == "sensor.water_tank"
    assert shape["attr"] == "battery_level"
    assert shape["unit"] == "%"
    # None is how the dialog clears a field
    assert cfg({"entity": None, "attr": None, "unit": None})
    assert cfg({"entity": "binary_sensor.a_1", "attr": "x", "unit": "°C"})
    # --- refused ----------------------------------------------------------
    for bad in ("sensor", "sensor.", ".tank", "Sensor.Tank", "sensor.tank; drop",
                "sensor." + "x" * 300, 5, True, ["sensor.a"]):
        with pytest.raises(vol.Invalid):
            cfg({"entity": bad})
    with pytest.raises(vol.Invalid):
        cfg({"attr": "a" * (v.MAX_DECOR_ATTR + 1)})
    with pytest.raises(vol.Invalid):
        cfg({"unit": "u" * (v.MAX_DECOR_UNIT + 1)})
    with pytest.raises(vol.Invalid):
        cfg({"attr": 7})
    with pytest.raises(vol.Invalid):
        cfg({"unit": {"a": 1}})
    # the template itself keeps its own bound, placeholder or not
    assert cfg({"text": "x" * v.MAX_DECOR_TEXT})
    with pytest.raises(vol.Invalid):
        cfg({"text": "x" * (v.MAX_DECOR_TEXT + 1)})


def test_decor_text_block_scale_and_angle():
    """Physical font size is canonical; scale and size remain bounded legacy
    fallbacks so a label drawn before the physical field renders unchanged."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    txt = {"id": "d", "kind": "text", "x": 0.5, "y": 0.5, "text": "Porch"}

    def cfg(extra):
        return v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [{**txt, **extra}]}]})

    assert cfg({"scale": 1})["spaces"][0]["decor"][0]["scale"] == 1.0
    assert cfg({"size_cm": 24})["spaces"][0]["decor"][0]["size_cm"] == 24.0
    assert cfg({"scale": v.DECOR_TEXT_SCALE_MIN})
    assert cfg({"scale": v.DECOR_TEXT_SCALE_MAX})
    assert cfg({"angle": 0}) and cfg({"angle": -360}) and cfg({"angle": 360})
    assert cfg({"angle": 45.5})["spaces"][0]["decor"][0]["angle"] == 45.5
    for bad in (0, -1, v.DECOR_TEXT_SCALE_MAX + 1, float("nan"), float("inf")):
        with pytest.raises(vol.Invalid):
            cfg({"scale": bad})
    for bad in (0, -1, v.DECOR_TEXT_CM_MAX + 0.1, float("nan"), float("inf")):
        with pytest.raises(vol.Invalid):
            cfg({"size_cm": bad})
    for bad in (361, -361, float("nan")):
        with pytest.raises(vol.Invalid):
            cfg({"angle": bad})
    # legacy: still valid, still only the three known values
    assert cfg({"size": "s"}) and cfg({"size": "m"}) and cfg({"size": "l"})
    with pytest.raises(vol.Invalid):
        cfg({"size": "xxl"})
    # a multi-line label round-trips with its newlines intact
    assert cfg({"text": "Гараж\nпод ключ"})["spaces"][0]["decor"][0]["text"] == "Гараж\nпод ключ"


def test_decor_furniture():
    """docs/FURNITURE.md: a piece of furniture is a decor shape with a symbol
    id, a normalised box and an optional rotation. Additive — a plan without
    one validates byte-for-byte as before, and no migration runs."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    f = {"id": "f1", "kind": "furniture", "symbol": "sofa",
         "x": 0.2, "y": 0.3, "w": 0.18, "h": 0.075}

    def cfg(extra):
        return v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [{**f, **extra}]}]})

    # --- accepted, and round-trips unchanged ------------------------------
    assert cfg({})["spaces"][0]["decor"][0] == f
    out = cfg({"angle": 90, "color": "#607d8b", "width": 3})["spaces"][0]["decor"][0]
    assert out["angle"] == 90 and out["color"] == "#607d8b" and out["width"] == 3.0
    assert cfg({"angle": -360}) and cfg({"angle": 360}) and cfg({"angle": 12.5})
    # a symbol this backend has never heard of is still SAVED: the card may
    # learn a new one before the integration does, and a plan must not be
    # refused for being newer than the server reading it
    assert cfg({"symbol": "hovercraft"})["spaces"][0]["decor"][0]["symbol"] == "hovercraft"
    # the canvas is unbounded, so a piece may live outside the old unit square
    assert cfg({"x": -3.5, "y": 4.25})

    # --- refused ----------------------------------------------------------
    for bad in ("", "Sofa", "sofa bed", "sofa-bed", "x" * 33, 5, None, True):
        with pytest.raises(vol.Invalid):
            cfg({"symbol": bad})
    for bad in (0, -1, float("nan"), float("inf"), v.CANVAS_LIMIT + 1):
        with pytest.raises(vol.Invalid):
            cfg({"w": bad})
        with pytest.raises(vol.Invalid):
            cfg({"h": bad})
    for bad in (361, -361, float("nan")):
        with pytest.raises(vol.Invalid):
            cfg({"angle": bad})
    for bad in (float("nan"), v.CANVAS_LIMIT + 1, -v.CANVAS_LIMIT - 1):
        with pytest.raises(vol.Invalid):
            cfg({"x": bad})
    # the box is REQUIRED: a piece of furniture without a size is not a shape
    for missing in ("symbol", "x", "y", "w", "h"):
        broken = {k: val for k, val in f.items() if k != missing}
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [broken]}]})


def test_decor_furniture_does_not_disturb_the_other_kinds():
    """The new branch is an addition to `vol.Any`, so every shape that
    validated before validates identically, and a `kind` nobody knows is still
    refused rather than quietly stored."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    shapes = [
        {"id": "a", "kind": "line", "x1": 0, "y1": 0, "x2": 1, "y2": 1},
        {"id": "b", "kind": "rect", "x": 0, "y": 0, "w": 0.5, "h": 0.5},
        {"id": "c", "kind": "ellipse", "x": 0, "y": 0, "w": 0.5, "h": 0.5},
        {"id": "d", "kind": "text", "x": 0.5, "y": 0.5, "text": "Hall"},
        {"id": "e", "kind": "furniture", "symbol": "toilet",
         "x": 0.1, "y": 0.1, "w": 0.03, "h": 0.06},
    ]
    out = v.CONFIG_SCHEMA({"spaces": [{**base, "decor": shapes}]})
    assert out["spaces"][0]["decor"] == shapes
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "decor": [
            {"id": "z", "kind": "hologram", "x": 0, "y": 0, "w": 1, "h": 1}]}]})

def test_space_walls_thickness():
    """docs/WALL-THICKNESS.md: exact endpoints are optional/backward compatible;
    cm, keys, points and the list itself remain bounded."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    # no walls -- byte-compatible
    assert "walls" not in v.CONFIG_SCHEMA({"spaces": [base]})["spaces"][0]

    ok = {"key": "0.50,0.20@0.0000", "cm": 20}
    out = v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [ok]}]})
    assert out["spaces"][0]["walls"] == [ok]

    exact = {**ok, "a": [0.2, 0.1], "b": [0.2, 0.4]}
    out = v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [exact]}]})
    assert out["spaces"][0]["walls"] == [exact]
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{**ok, "a": [0.2, 0.1]}]}]})
    for bad in ([0.2], [0.2, 0.4, 0.6], [float("inf"), 0.4], [5001, 0.4]):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{**ok, "a": bad}]}]})

    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{"key": ok["key"], "cm": 0}]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{"key": ok["key"], "cm": 101}]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{"key": "", "cm": 10}]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [{"key": "k" * 65, "cm": 10}]}]})
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "walls": [
            {"key": f"k{i}", "cm": 10} for i in range(v.MAX_WALLS + 1)]}]})


def test_space_independent_physical_objects():
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    physical = {
        "room_drafts": [{
            "id": "draft", "points": [[0, 0], [0.5, 0], [0.5, 0.5]],
            "segments": [{"cm": 10}, {"cm": 20}],
        }],
        "partitions": [{"id": "part", "a": [0, 0], "b": [1, 0], "cm": 15}],
        "wall_columns": [
            {"id": "square", "shape": "square", "center": [0.5, 0.5],
             "cm": 30, "angle": 45},
            {"id": "circle", "shape": "circle", "center": [0.7, 0.7],
             "cm": 40},
        ],
    }
    out = v.SPACE_SCHEMA({**base, **physical})
    assert out["wall_columns"][0]["angle"] == 45
    assert "angle" not in out["wall_columns"][1]

    for bad_column in (
        {"id": "neg", "shape": "square", "center": [0, 0], "cm": 20,
         "angle": -1},
        {"id": "quarter", "shape": "square", "center": [0, 0], "cm": 20,
         "angle": 90},
        {"id": "round-angle", "shape": "circle", "center": [0, 0], "cm": 20,
         "angle": 10},
    ):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA({**base, "wall_columns": [bad_column]})

    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "partitions": [
            {"id": "zero", "a": [0, 0], "b": [0, 0], "cm": 15}]})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "room_drafts": [{
            "id": "bad", "points": [[0, 0], [1, 0]], "segments": []}]})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "partitions": [physical["partitions"][0]],
                        "wall_columns": [{"id": "part", "shape": "circle",
                                          "center": [0, 0], "cm": 20}]})

    # Limits are shared with the editor contract, including the aggregate
    # segment cap (not merely a per-draft bound).
    drafts = [{"id": f"draft-{i}", "points": [[j / 1000, i / 1000]
               for j in range(402)], "segments": [{"cm": 15}] * 401}
              for i in range(5)]
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "room_drafts": drafts})
    assert v.SPACE_SCHEMA({**base, "partitions": [
        {"id": f"p{i}", "a": [0, i / 10000], "b": [1, i / 10000], "cm": 100}
        for i in range(v.MAX_PARTITIONS)]})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "partitions": [
            {"id": f"p{i}", "a": [0, i / 10000], "b": [1, i / 10000], "cm": 15}
            for i in range(v.MAX_PARTITIONS + 1)]})


def test_partition_opening_host_schema_fit_overlap_and_downgrade_guard():
    base = {
        "id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [{"id": "wall", "a": [0, 0], "b": [1, 0], "cm": 15}],
    }
    opening = {
        "id": "door", "type": "door", "x": 0.5, "y": 0,
        "angle": 0, "length": 0.2,
        "host": {"kind": "partition", "id": "wall", "t": 0.5},
    }
    out = v.SPACE_SCHEMA({**base, "openings": [opening]})
    assert out["openings"][0]["host"] == opening["host"]

    for bad_host in (
        {"kind": "room", "id": "wall", "t": 0.5},
        {"kind": "partition", "id": "missing", "t": 0.5},
        {"kind": "partition", "id": "wall", "t": 2},
        {"kind": "partition", "id": "wall", "t": 0.5, "extra": True},
    ):
        with pytest.raises(vol.Invalid):
            v.SPACE_SCHEMA({**base, "openings": [{**opening, "host": bad_host}]})

    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "openings": [{
            **opening, "length": 0.4,
            "host": {"kind": "partition", "id": "wall", "t": 0.1},
        }]})
    with pytest.raises(vol.Invalid):
        v.SPACE_SCHEMA({**base, "openings": [opening, {
            **opening, "id": "window", "type": "window",
            "host": {"kind": "partition", "id": "wall", "t": 0.55},
        }]})

    previous = {"spaces": [{**base, "openings": [opening]}]}
    current = {"spaces": [{**base, "openings": [{
        key: value for key, value in opening.items() if key != "host"
    }]}]}
    with pytest.raises(v.PartitionOpeningHostError):
        v.validate_partition_opening_hosts(current, previous)
    v.validate_partition_opening_hosts({"spaces": [{**base, "openings": []}]}, previous)


def test_optimize_accepts_only_proved_partition_to_room_wall_rehost():
    root = os.path.dirname(os.path.dirname(__file__))
    fixture_dir = os.path.join(root, "test", "fixtures")
    with open(os.path.join(fixture_dir, "276-coincident-partition.json"),
              encoding="utf-8") as stream:
        previous = json.load(stream)
    with open(os.path.join(fixture_dir, "280-optimize-rehost-candidate.json"),
              encoding="utf-8") as stream:
        candidate = json.load(stream)

    with pytest.raises(v.PartitionOpeningHostError):
        v.validate_partition_opening_hosts(candidate, previous)
    v.validate_partition_opening_hosts(
        candidate, previous, allow_optimize_rehost=True
    )

    def rejected(mutator):
        changed = json.loads(json.dumps(candidate))
        mutator(changed["spaces"][0])
        with pytest.raises(v.PartitionOpeningHostError):
            v.validate_partition_opening_hosts(
                changed, previous, allow_optimize_rehost=True
            )

    rejected(lambda space: space.update(partitions=[{
        "id": "redundant",
        "a": [0.504166667, 0.004166667],
        "b": [0.504166667, 0.995833333],
        "cm": 20,
    }]))
    rejected(lambda space: space["rooms"].pop())
    rejected(lambda space: space["walls"][0].update(cm=10))
    rejected(lambda space: space["openings"][0].update(x=0.51))
    rejected(lambda space: space["openings"][0].update(angle=-89))
    rejected(lambda space: space["openings"][0].update(length=0.19))
    rejected(lambda space: space["openings"][0].update(type="window"))
    rejected(lambda space: space["openings"][0].update(
        contact="binary_sensor.other"
    ))
    rejected(lambda space: space["openings"].append({
        "id": "overlap", "type": "door",
        "x": 0.504166667, "y": 0.5, "angle": -90, "length": 0.1,
    }))
    rejected(lambda space: space.update(open_spans=[{
        "a": [0.504166667, 0.2], "b": [0.504166667, 0.8],
    }]))


def test_optimize_rehost_validation_is_atomic_across_the_batch():
    root = os.path.dirname(os.path.dirname(__file__))
    fixture_dir = os.path.join(root, "test", "fixtures")
    previous = json.load(open(
        os.path.join(fixture_dir, "276-coincident-partition.json"),
        encoding="utf-8",
    ))
    candidate = json.load(open(
        os.path.join(fixture_dir, "280-optimize-rehost-candidate.json"),
        encoding="utf-8",
    ))
    old_space = previous["spaces"][0]
    new_space = candidate["spaces"][0]
    old_space["openings"].append({
        **old_space["openings"][0], "id": "second", "length": 0.1,
        "host": {"kind": "partition", "id": "redundant", "t": 0.75},
    })
    new_space["openings"].append({
        **new_space["openings"][0], "id": "second", "length": 0.1,
        "x": 0.6, "y": 0.747916667,
    })
    with pytest.raises(v.PartitionOpeningHostError) as raised:
        v.validate_partition_opening_hosts(
            candidate, previous, allow_optimize_rehost=True
        )
    assert "opening=second" in str(raised.value)


def test_optimize_rehost_private_exact_fixture_when_available():
    """Local owner acceptance; CI intentionally uses the anonymized contract."""
    source = r"C:\Temp\44.json"
    if not os.path.exists(source):
        pytest.skip("private #280 fixture is not present")
    script = (
        "import {readFileSync} from 'node:fs';"
        "import {optimizePlans} from './test-build/plan-optimizer.js';"
        "const raw=JSON.parse(readFileSync(process.argv[1],'utf8'));"
        "const previous=raw.payload?.config||raw.config||raw;"
        "process.stdout.write(JSON.stringify(optimizePlans(previous,{}).config));"
    )
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script, source],
        cwd=_ROOT, capture_output=True, text=True, check=True,
    )
    candidate = json.loads(completed.stdout)
    raw = json.load(open(source, encoding="utf-8"))
    previous = raw.get("payload", {}).get("config", raw.get("config", raw))
    with pytest.raises(v.PartitionOpeningHostError):
        v.validate_partition_opening_hosts(candidate, previous)
    v.validate_partition_opening_hosts(
        candidate, previous, allow_optimize_rehost=True
    )


@pytest.mark.parametrize("cm,cell_cm", [(1, 5), (15, 5), (100, 2.5)])
@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("opening_type", ["door", "window", "gate", "passage"])
def test_partition_opening_jamb_margin_exact_boundary_and_epsilon(
    cm, cell_cm, reverse, opening_type
):
    a, b = ([1, 1], [0, 0]) if reverse else ([0, 0], [1, 1])
    span = 2 ** 0.5
    margin = cm / cell_cm / v.NORMALIZED_CANVAS_CELLS / 2
    length = 0.2
    exact_t = (length / 2 + margin) / span
    partition = {"id": "wall", "a": a, "b": b, "cm": cm}
    opening = {
        "id": "door", "type": opening_type, "x": 0.1, "y": 0.1,
        "angle": 45, "length": length,
        "host": {"kind": "partition", "id": "wall", "t": exact_t},
    }
    config = {"spaces": [{
        "id": "s1", "title": "S", "cell_cm": cell_cm,
        "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [partition], "openings": [opening],
    }]}
    v.validate_partition_opening_hosts(config, {"spaces": []})
    bad = json.loads(json.dumps(config))
    bad["spaces"][0]["openings"][0]["host"]["t"] = exact_t - 1e-6
    with pytest.raises(v.PartitionOpeningJambMarginError) as raised:
        v.validate_partition_opening_hosts(bad, {"spaces": []})
    assert raised.value.code == "invalid_partition_opening_jamb_margin"
    assert raised.value.margin == pytest.approx(margin)
    assert raised.value.margin_cm == pytest.approx(cm / 2)


def test_partition_opening_jamb_delta_preserves_legacy_and_checks_direct_geometry():
    partition = {"id": "wall", "a": [0, 0], "b": [1, 0], "cm": 15}
    opening = {
        "id": "door", "type": "door", "x": 0.1, "y": 0,
        "angle": 0, "length": 0.2,
        "host": {"kind": "partition", "id": "wall", "t": 0.1},
    }
    space = {
        "id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [partition], "openings": [opening],
    }
    previous = {"spaces": [space]}

    unrelated = json.loads(json.dumps(previous))
    unrelated["spaces"][0]["title"] = "Renamed"
    v.validate_partition_opening_hosts(unrelated, previous)

    type_only = json.loads(json.dumps(previous))
    type_only["spaces"][0]["openings"][0]["type"] = "window"
    v.validate_partition_opening_hosts(type_only, previous)

    translated = json.loads(json.dumps(previous))
    translated["spaces"][0]["partitions"][0]["a"] = [2, 3]
    translated["spaces"][0]["partitions"][0]["b"] = [3, 3]
    v.validate_partition_opening_hosts(translated, previous)

    for mutate in (
        lambda cfg: cfg["spaces"][0]["openings"][0]["host"].update(t=0.105),
        lambda cfg: cfg["spaces"][0]["openings"][0].update(length=0.19),
        lambda cfg: cfg["spaces"][0]["partitions"][0].update(cm=20),
        lambda cfg: cfg["spaces"][0]["partitions"][0].update(b=[0.9, 0]),
    ):
        changed = json.loads(json.dumps(previous))
        mutate(changed)
        with pytest.raises(v.PartitionOpeningJambMarginError):
            v.validate_partition_opening_hosts(changed, previous)


def test_partition_opening_structural_schema_keeps_full_restore_legacy_compatible():
    legacy = {
        "id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [{"id": "wall", "a": [0, 0], "b": [1, 0], "cm": 100}],
        "openings": [{
            "id": "door", "type": "door", "x": 0.1, "y": 0,
            "angle": 0, "length": 0.2,
            "host": {"kind": "partition", "id": "wall", "t": 0.1},
        }],
    }
    restored = v.CONFIG_SCHEMA({"spaces": [legacy]})
    assert restored["spaces"][0]["openings"][0]["host"]["t"] == 0.1


def test_space_open_spans():
    """AUD-159B6-03: `open_spans` used to ride on extra=ALLOW_EXTRA, so any
    shape reached the card and one malformed entry blanked the plan for every
    reader. Two finite points, bounded, capped, deduped -- or refused."""
    base = {"id": "s1", "title": "S", "view_box": [0, 0, 1, 1], "rooms": []}
    # absent -- an existing plan validates exactly as before
    assert "open_spans" not in v.CONFIG_SCHEMA({"spaces": [base]})["spaces"][0]

    ok = {"a": [0.3, 0.14], "b": [0.3, 0.46]}
    out = v.CONFIG_SCHEMA({"spaces": [{**base, "open_spans": [ok]}]})
    assert out["spaces"][0]["open_spans"] == [ok]

    # the exact crash the audit reproduced: `entryToSeg` reading e.a[0]
    for bad in (
        {"foo": 1},
        {"a": [0.1, 0.2]},
        {"a": [0.1], "b": [0.2, 0.3]},
        {"a": [0.1, 0.2], "b": "x"},
        {"a": [0.1, float("nan")], "b": [0.2, 0.3]},
        {"a": [0.1, float("inf")], "b": [0.2, 0.3]},
        {"a": [0.1, 0.2], "b": [0.1, 0.2]},                       # degenerate
        {"a": [0.1, 0.2], "b": [v.CANVAS_LIMIT + 1, 0.3]},        # out of canvas
        "not-an-object",
    ):
        with pytest.raises(vol.Invalid):
            v.CONFIG_SCHEMA({"spaces": [{**base, "open_spans": [bad]}]})

    # capped like every other list
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [{**base, "open_spans": [
            {"a": [0, i / 10000], "b": [1, i / 10000]}
            for i in range(v.MAX_OPEN_SPANS + 1)]}]})

    # one wall, one span: the same stretch twice (either direction) collapses
    dup = v.CONFIG_SCHEMA({"spaces": [{**base, "open_spans": [
        ok, dict(ok), {"a": ok["b"], "b": ok["a"]}]}]})
    assert dup["spaces"][0]["open_spans"] == [ok]


def test_marker_control_semantics_validate_only_new_edges():
    old = {"markers": [
        {"id": "legacy", "controls": ["marker:gone"]},
        {"id": "lamp", "is_light": True},
    ]}
    # An unrelated edit never makes a pre-existing broken ref fatal.
    v.validate_marker_controls({"markers": [
        {"id": "legacy", "name": "renamed", "controls": ["marker:gone"]},
        {"id": "lamp", "is_light": True},
    ]}, old)

    with pytest.raises(v.MarkerControlError) as missing:
        v.validate_marker_controls({"markers": [
            *old["markers"], {"id": "new", "controls": ["marker:gone"]},
        ]}, old)
    assert missing.value.code == "marker_control_missing"

    with pytest.raises(v.MarkerControlError) as not_light:
        v.validate_marker_controls({"markers": [
            {"id": "plain"}, {"id": "new", "controls": ["marker:plain"]},
        ]})
    assert not_light.value.code == "marker_control_not_light"


def test_marker_control_semantics_reject_self_duplicates_and_cycles():
    with pytest.raises(v.MarkerControlError) as self_ref:
        v.validate_marker_controls({"markers": [
            {"id": "a", "is_light": True, "controls": ["marker:a"]},
        ]}, validate_all=True)
    assert self_ref.value.code == "marker_control_self"

    with pytest.raises(v.MarkerControlError) as duplicate:
        v.validate_marker_controls({"markers": [
            {"id": "a", "is_light": True},
            {"id": "b", "controls": ["marker:a", "marker:a"]},
        ]}, validate_all=True)
    assert duplicate.value.code == "duplicate_marker_control"

    with pytest.raises(v.MarkerControlError) as cycle:
        v.validate_marker_controls({"markers": [
            {"id": "a", "is_light": True, "controls": ["marker:b"]},
            {"id": "b", "is_light": True, "controls": ["marker:a"]},
        ]}, validate_all=True)
    assert cycle.value.code == "marker_control_cycle"


def test_marker_control_duplicate_replacement_and_id_rename_are_delta_safe():
    old = {"markers": [
        {"id": "controller-old", "binding": "device:controller", "controls": [
            "marker:lamp", "marker:lamp2", "legacy target",
        ]},
        {"id": "lamp", "binding": "virtual", "is_light": True},
        {"id": "lamp2", "binding": "virtual", "is_light": True},
    ]}
    with pytest.raises(v.MarkerControlError) as duplicate:
        v.validate_marker_controls({"markers": [
            {"id": "controller-old", "binding": "device:controller", "controls": [
                "marker:lamp", "marker:lamp",
            ]},
            *old["markers"][1:],
        ]}, old)
    assert duplicate.value.code == "duplicate_marker_control"

    # A stable binding identifies a renamed HA marker. Its dormant legacy
    # controls remain old data rather than becoming newly-invalid writes.
    renamed = {"markers": [
        {**old["markers"][0], "id": "controller-new"},
        *old["markers"][1:],
    ]}
    v.validate_marker_controls(renamed, old)


def test_marker_control_new_entity_refs_require_real_entity_id_syntax():
    old = {"markers": [{
        "id": "controller", "binding": "device:controller", "controls": ["legacy target"],
    }]}
    v.validate_marker_controls(old, old)
    with pytest.raises(v.MarkerControlError) as invalid:
        v.validate_marker_controls({"markers": [{
            "id": "controller", "binding": "device:controller",
            "controls": ["legacy target", "not an entity"],
        }]}, old)
    assert invalid.value.code == "invalid_marker_control"
    v.validate_marker_controls({"markers": [{
        "id": "controller", "binding": "device:controller",
        "controls": ["legacy target", "switch.valid_target"],
    }]}, old)


def test_light_entity_is_domain_bounded_only_when_new_or_changed():
    cfg = v.CONFIG_SCHEMA({"spaces": [], "markers": [
        {"id": "lamp", "binding": "device:lamp", "is_light": True,
         "light_entity": "light.channel_2"},
    ]})
    assert cfg["markers"][0]["light_entity"] == "light.channel_2"
    old = {"markers": [
        {"id": "lamp", "binding": "virtual", "light_entity": "sensor.legacy"},
    ]}
    # Dormant unknown data survives an unrelated edit byte-for-byte.
    v.CONFIG_SCHEMA({"spaces": [], **old})
    v.validate_marker_light_entities(old, old)
    with pytest.raises(v.MarkerControlError) as changed:
        v.validate_marker_light_entities({"markers": [
            {"id": "lamp", "binding": "virtual", "light_entity": "sensor.changed"},
        ]}, old)
    assert changed.value.code == "invalid_light_entity"
    for invalid in ("light.Uppercase", "light.trailing\n"):
        with pytest.raises(v.MarkerControlError):
            v.validate_marker_light_entities({"markers": [
                {"id": "lamp", "binding": "virtual", "light_entity": invalid},
            ]}, {"markers": []})
    with pytest.raises(v.MarkerControlError):
        v.validate_marker_light_entities(old, validate_all=True)


def test_toggle_entity_is_domain_bounded_only_when_new_or_changed():
    cfg = v.CONFIG_SCHEMA({"spaces": [], "markers": [
        {"id": "washer", "binding": "device:washer",
         "toggle_entity": "switch.child_lock"},
    ]})
    assert cfg["markers"][0]["toggle_entity"] == "switch.child_lock"

    old = {"markers": [
        {"id": "washer", "binding": "device:washer", "toggle_entity": "sensor.future"},
    ]}
    v.validate_marker_light_entities(old, old)

    with pytest.raises(v.MarkerControlError) as changed:
        v.validate_marker_light_entities({"markers": [
            {"id": "washer", "binding": "device:washer", "toggle_entity": "sensor.changed"},
        ]}, old)
    assert changed.value.code == "invalid_toggle_entity"

    for invalid in ("light.UPPER", "switch.bad-id", "marker:other", 7):
        with pytest.raises(v.MarkerControlError) as imported:
            v.validate_marker_light_entities({"markers": [
                {"id": "washer", "binding": "device:washer", "toggle_entity": invalid},
            ]}, validate_all=True)
        assert imported.value.code == "invalid_toggle_entity"

    with pytest.raises(v.MarkerControlError) as full_import:
        v.validate_marker_light_entities(old, validate_all=True)
    assert full_import.value.code == "invalid_toggle_entity"


def test_issue_90_value_badge_validation_is_strict_only_when_changed():
    valid = {
        "enabled": True,
        "source": {"kind": "entity_attribute", "entity_id": "climate.room",
                   "attribute": "current_temperature", "future_source": 1},
        "position": "top",
        "future_badge": {"kept": True},
    }
    config = {"markers": [{"id": "m1", "binding": "entity:climate.room",
                            "value_badge": valid}]}
    v.validate_marker_value_badges(config, {"markers": []})
    stored = v.MARKER_SCHEMA(config["markers"][0])
    assert stored["value_badge"]["future_badge"] == {"kept": True}
    assert stored["value_badge"]["source"]["future_source"] == 1

    broken = {"markers": [{"id": "m1", "binding": "virtual", "value_badge": {
        "enabled": True, "source": None, "position": "right",
    }}]}
    v.validate_marker_value_badges(broken, broken)
    with pytest.raises(v.MarkerControlError) as missing:
        v.validate_marker_value_badges(broken, {"markers": []})
    assert missing.value.code == "value_badge_source_required"

    invalid_attr = {"markers": [{"id": "m1", "binding": "entity:sensor.x",
                                  "value_badge": {
        "enabled": True,
        "source": {"kind": "entity_attribute", "entity_id": "sensor.x",
                   "attribute": "entity_picture"},
        "position": "right",
    }}]}
    with pytest.raises(v.MarkerControlError) as attribute:
        v.validate_marker_value_badges(invalid_attr, {"markers": []})
    assert attribute.value.code == "invalid_value_badge_attribute"


def test_issue_90_marker_value_badge_reference_uses_canonical_ref():
    config = {"markers": [
        {"id": "lamp", "binding": "virtual", "is_light": True},
        {"id": "controller", "binding": "entity:switch.wall", "value_badge": {
            "enabled": True,
            "source": {"kind": "derived_marker_state", "ref": "marker:lamp"},
            "position": "bottom",
        }},
    ]}
    v.validate_marker_value_badges(config, {"markers": []})
    config["markers"][1]["value_badge"]["source"]["ref"] = "lamp"
    with pytest.raises(v.MarkerControlError) as invalid:
        v.validate_marker_value_badges(config, {"markers": []})
    assert invalid.value.code == "invalid_value_badge_source"
