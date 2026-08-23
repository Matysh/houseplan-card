"""Pure tests for the read-only projections (#256).

The main invariant is negative: without parameters nothing may change. Every
other case is measured against that one, because a projection that quietly
reshapes the default response would break clients that never asked for it.
"""
from __future__ import annotations

import copy
import importlib.util
import os

# Модуль грузится по пути, а не импортом пакета: `custom_components.houseplan`
# исполняет `__init__`, который безусловно тянет homeassistant, и на машине без
# HA ломается сбор всего каталога tests_backend, а не только этого файла (#135).
# Тот же приём, что в test_virtual_lights.py; сам модуль не зависит ни от чего,
# кроме стандартной библиотеки.
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "custom_components", "houseplan", "projection.py",
)
_spec = importlib.util.spec_from_file_location("hp_projection", _PATH)
_projection = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_projection)

project_config = _projection.project_config
project_layout = _projection.project_layout
project_markers = _projection.project_markers


CONFIG = {
    "spaces": [
        {"id": "f1", "title": "First", "rooms": [{"id": "r1"}]},
        {"id": "f2", "title": "Second", "rooms": []},
    ],
    "markers": [
        {"id": "m1", "binding": "virtual", "space": "f1", "icon": "mdi:lamp", "pdfs": []},
        {"id": "m2", "binding": "device:abc", "space": "f2", "icon": None},
    ],
    "settings": {"glow_radius_cm": 200},
    "model_version": 6,
}

LAYOUT = {
    "m1": {"s": "f1", "x": 0.1, "y": 0.2},
    "m2": {"s": "f2", "x": 0.3, "y": 0.4},
    "rl_r1": {"s": "f1", "x": 0.5, "y": 0.6},
}


def test_no_parameters_change_nothing():
    original = copy.deepcopy(CONFIG)
    assert project_config(CONFIG) == original
    assert project_config(CONFIG) is CONFIG
    assert project_layout(LAYOUT) is LAYOUT
    assert CONFIG == original


def test_space_id_narrows_spaces_only():
    projected = project_config(CONFIG, space_id="f1")
    assert [space["id"] for space in projected["spaces"]] == ["f1"]
    # Остальные разделы не урезаются: клиент просил меньше пространств, а не
    # меньше конфигурации.
    assert projected["markers"] == CONFIG["markers"]
    assert projected["settings"] == CONFIG["settings"]
    assert projected["model_version"] == 6
    # Исходный документ не тронут.
    assert len(CONFIG["spaces"]) == 2


def test_unknown_space_returns_empty_list_not_an_error():
    projected = project_config(CONFIG, space_id="nope")
    assert projected["spaces"] == []
    assert projected["markers"] == CONFIG["markers"]


def test_marker_fields_keep_id_even_when_not_asked():
    projected = project_config(CONFIG, marker_fields=["binding", "space"])
    assert projected["markers"] == [
        {"id": "m1", "binding": "virtual", "space": "f1"},
        {"id": "m2", "binding": "device:abc", "space": "f2"},
    ]
    assert CONFIG["markers"][0]["icon"] == "mdi:lamp"


def test_unknown_marker_field_adds_nothing():
    projected = project_config(CONFIG, marker_fields=["binding", "does_not_exist"])
    assert projected["markers"][0] == {"id": "m1", "binding": "virtual"}


def test_fields_narrow_top_level_keys():
    projected = project_config(CONFIG, fields=["spaces"])
    assert set(projected) == {"spaces"}
    projected = project_config(CONFIG, fields=["markers", "settings"])
    assert set(projected) == {"markers", "settings"}


def test_fields_and_marker_fields_combine():
    projected = project_config(CONFIG, fields=["markers"], marker_fields=["space"])
    assert projected == {"markers": [{"id": "m1", "space": "f1"}, {"id": "m2", "space": "f2"}]}


def test_empty_or_malformed_lists_mean_no_projection():
    # Пустой список — это «я ничего не выбрал», а не «оставь ноль полей»:
    # второе трактование превращает опечатку клиента в пустой ответ.
    assert project_config(CONFIG, fields=[]) is CONFIG
    assert project_config(CONFIG, marker_fields=[]) is CONFIG
    assert project_config(CONFIG, fields="spaces") is CONFIG
    assert project_markers(CONFIG["markers"], None) == CONFIG["markers"]


def test_layout_space_filter():
    assert project_layout(LAYOUT, space_id="f1") == {
        "m1": {"s": "f1", "x": 0.1, "y": 0.2},
        "rl_r1": {"s": "f1", "x": 0.5, "y": 0.6},
    }
    assert project_layout(LAYOUT, space_id="nope") == {}
    assert LAYOUT == {
        "m1": {"s": "f1", "x": 0.1, "y": 0.2},
        "m2": {"s": "f2", "x": 0.3, "y": 0.4},
        "rl_r1": {"s": "f1", "x": 0.5, "y": 0.6},
    }


def test_non_dict_documents_pass_through():
    # Хранилище может отдать что угодно после ручной правки файла: проекция —
    # не место для валидации, она обязана не мешать читать то, что есть.
    assert project_config(None) is None
    assert project_config([1, 2], space_id="f1") == [1, 2]
    assert project_layout("nope", space_id="f1") == "nope"
    assert project_markers("nope", ["id"]) == "nope"


def test_markers_survive_unexpected_entries():
    markers = [{"id": "m1", "binding": "virtual"}, "junk", None]
    assert project_markers(markers, ["binding"]) == [
        {"id": "m1", "binding": "virtual"}, "junk", None,
    ]
