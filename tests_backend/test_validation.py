"""Юнит-тесты чистой валидации House Plan (загружаем validation.py по пути,
без импорта пакета HA-интеграции)."""
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


def test_sanitize_marker_id():
    assert v.sanitize_marker_id("../etc/passwd") == "_etc_passwd"
    assert v.sanitize_marker_id("..") == "misc"       # чистый traversal → misc
    assert v.sanitize_marker_id(".") == "misc"
    assert v.sanitize_marker_id("") == "misc"
    assert len(v.sanitize_marker_id("a" * 200)) == 64


def test_sanitize_filename_strips_path():
    assert v.sanitize_filename("/a/b/c/manual.pdf") == "manual.pdf"
    assert v.sanitize_filename("..\\..\\evil.pdf") == "evil.pdf"   # обратные слэши = путь
    assert v.sanitize_filename("...hidden.pdf") == "hidden.pdf"      # ведущие точки убраны


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
            "id": "f1", "title": "1 этаж", "plan_url": "/p/f1.svg",
            "aspect": 0.8, "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "r1", "name": "Зал", "area": "hall",
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
