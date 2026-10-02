"""#780: LED strip storage — schema, write-path normalisation, transfer rules.

Pure suite (no Home Assistant): ``validation.py`` and ``led_strips.py`` are
loaded by path. The import/export paths that need the HA harness live in
``test_ha_import_export.py``.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
import voluptuous as vol

from pure_imports import load_pure

_HOUSEPLAN = Path(__file__).resolve().parent.parent / "custom_components" / "houseplan"
v = load_pure("hp_validation_led", _HOUSEPLAN / "validation.py")
led = load_pure("custom_components.houseplan.led_strips", _HOUSEPLAN / "led_strips.py")
support = load_pure("custom_components.houseplan.support_package", _HOUSEPLAN / "support_package.py")
wsm = load_pure("custom_components.houseplan.wall_segment_model", _HOUSEPLAN / "wall_segment_model.py")
PLAN_MODEL_VERSION = 10


def _space(space_id: str, title: str) -> dict:
    return {
        "id": space_id, "title": title, "view_box": [0, 0, 1, 1],
        "rooms": [{"id": f"{space_id}-room", "name": title, "poly": [[0, 0], [1, 0], [1, 1]]}],
    }


def _config(strips=None, markers=None, *, space_id: str = "ground", extra_spaces=()) -> dict:
    """A current (v10) document: built from a v9 one by the real migration."""
    legacy = {
        "model_version": PLAN_MODEL_VERSION - 1,
        "spaces": [_space(space_id, "Ground"), *(_space(s, s.title()) for s in extra_spaces)],
        "markers": markers if markers is not None else [
            {"id": "lamp", "binding": "entity:light.kitchen", "space": space_id},
        ],
    }
    config = wsm.commit_wall_segment_model(legacy)[0]
    if strips is not None:
        config["spaces"][0]["led_strips"] = strips
    return config


def _strip(**extra) -> dict:
    return {"id": "led-1", "points": [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]], "marker": "lamp", **extra}


def _check(config: dict) -> dict:
    return v.CONFIG_SCHEMA(copy.deepcopy(config))


def _strips_of(config: dict) -> list[dict]:
    return config["spaces"][0]["led_strips"]


# ---------- AC1: valid geometry is stored ----------

def test_open_and_closed_strips_are_stored_exactly() -> None:
    closed = {"id": "led-2", "points": [[0, 0], [0.2, 0], [0.2, 0.2], [0, 0]], "marker": None}
    checked = _check(_config([_strip(), closed]))
    stored = _strips_of(checked)
    assert stored[0]["points"] == [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]]
    assert stored[0]["marker"] == "lamp"
    assert stored[1]["points"][0] == stored[1]["points"][-1]
    assert led.strip_is_closed(stored[1]["points"])


def test_absent_field_equals_no_strips_and_needs_no_version_bump() -> None:
    checked = _check(_config())
    assert "led_strips" not in checked["spaces"][0]
    assert led.led_strip_counts(checked) == {"led_strips": 0, "led_strips_unbound": 0, "led_strips_hidden": 0}


@pytest.mark.parametrize("points, reason", [
    ([[0, 0]], "one point"),
    ([[0, 0], [0, 0]], "zero length"),
    ([[0, 0], [0, 0], [0, 0]], "zero length, repeated"),
    ([[0, 0], [0.2, 0], [0, 0]], "closed with two distinct vertices"),
    ([["0", 0], [1, 1]], "string coordinate"),
    ([[True, 0], [1, 1]], "boolean coordinate"),
    ([[float("nan"), 0], [1, 1]], "NaN"),
    ([[float("inf"), 0], [1, 1]], "Infinity"),
    ([[0, 0], [6000, 0]], "outside the canvas"),
    ([[0, 0, 0], [1, 1]], "three coordinates"),
    ("[[0,0],[1,1]]", "not a list"),
])
def test_invalid_geometry_rejects_the_whole_write(points, reason) -> None:
    config = _config([_strip(points=points)])
    before = copy.deepcopy(config)
    with pytest.raises(vol.Invalid):
        _check(config)
    assert config == before, f"{reason}: a rejected write must not be half-applied"


def test_point_and_strip_limits_are_50_inclusive() -> None:
    fifty = [[i / 100, (i % 2) / 100] for i in range(50)]
    assert len(_strips_of(_check(_config([_strip(points=fifty)])))[0]["points"]) == 50
    with pytest.raises(vol.Invalid):
        _check(_config([_strip(points=fifty + [[0.9, 0.9]])]))
    strips = [{"id": f"led-{i}", "points": [[0, i / 100], [0.1, i / 100]], "marker": None} for i in range(50)]
    assert len(_strips_of(_check(_config(strips)))) == 50
    strips.append({"id": "led-50", "points": [[0, 0.9], [0.1, 0.9]], "marker": None})
    with pytest.raises(vol.Invalid):
        _check(_config(strips))


def test_hidden_shapes_count_toward_the_strip_limit() -> None:
    markers = [{"id": f"m{i}", "binding": "virtual", "space": "ground"} for i in range(51)]
    strips = [
        {"id": f"led-{i}", "points": [[0, i / 100], [0.1, i / 100]], "marker": f"m{i}", "active": False}
        for i in range(51)
    ]
    with pytest.raises(vol.Invalid):
        _check(_config(strips, markers))


def test_duplicate_strip_id_within_a_space_rejects() -> None:
    other = {"id": "led-1", "points": [[0.5, 0.5], [0.6, 0.5]], "marker": None}
    with pytest.raises(vol.Invalid, match="unique"):
        _check(_config([_strip(), other]))


@pytest.mark.parametrize("active", ["true", 1, 0, None])
def test_active_is_strictly_boolean(active) -> None:
    with pytest.raises(vol.Invalid):
        _check(_config([_strip(active=active)]))


def test_hidden_shape_must_belong_to_a_marker() -> None:
    with pytest.raises(vol.Invalid, match="belong to a marker"):
        _check(_config([_strip(marker=None, active=False)]))


@pytest.mark.parametrize("marker", ["", 5, ["lamp"]])
def test_marker_reference_must_be_a_non_empty_string_or_null(marker) -> None:
    with pytest.raises(vol.Invalid):
        _check(_config([_strip(marker=marker)]))


# ---------- AC1: duplicates and foreign spaces reject, before any normalisation ----------

def test_one_marker_cannot_be_bound_to_two_strips_even_hidden() -> None:
    second = {"id": "led-2", "points": [[0.5, 0.5], [0.6, 0.5]], "marker": "lamp", "active": False}
    with pytest.raises(vol.Invalid, match="more than one LED strip"):
        _check(_config([_strip(), second]))


def test_two_links_to_the_same_missing_marker_are_still_a_conflict() -> None:
    first = _strip(marker="gone")
    second = {"id": "led-2", "points": [[0.5, 0.5], [0.6, 0.5]], "marker": "gone"}
    with pytest.raises(vol.Invalid, match="more than one LED strip"):
        _check(_config([first, second]))


def test_duplicates_across_spaces_are_judged_globally() -> None:
    config = _config([_strip()], extra_spaces=("upper",))
    config["spaces"][1]["led_strips"] = [{"id": "led-1", "points": [[0, 0], [1, 0]], "marker": "lamp"}]
    with pytest.raises(vol.Invalid, match="more than one LED strip"):
        _check(config)


def test_marker_of_another_space_rejects() -> None:
    markers = [{"id": "lamp", "binding": "entity:light.kitchen", "space": "upper"}]
    with pytest.raises(vol.Invalid, match="another space"):
        _check(_config([_strip()], markers, extra_spaces=("upper",)))


# ---------- §9: normalisation of an old client's write ----------

@pytest.mark.parametrize("active", [True, False])
def test_deleted_marker_leaves_an_unbound_strip_with_its_geometry(active) -> None:
    """A client that does not know strips deletes the bound marker: the save stands."""
    config = _config([_strip(active=active)], markers=[])
    report = led.led_strip_link_report(config)
    checked = _check(config)
    strip = _strips_of(checked)[0]
    assert strip["id"] == "led-1"
    assert strip["points"] == [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]]
    assert strip["marker"] is None
    assert strip["active"] is True
    assert report == {"unbound": 1, "space_adopted": 0}


def _old_writer(config: dict) -> dict:
    """The payload of a frontend that does not know the field (r1 H1)."""
    payload = copy.deepcopy(config)
    for space in payload["spaces"]:
        space.pop("led_strips", None)
    return payload


def _ordinary(candidate: dict, previous: dict) -> dict:
    return v.prepare_ordinary_summary_candidate(copy.deepcopy(candidate), previous, set(), v.CONFIG_SCHEMA)


@pytest.mark.parametrize("active", [True, False])
def test_old_writer_omitting_the_field_keeps_the_stored_shapes(active) -> None:
    """r1 H1: an omitted ``led_strips`` is not a deletion on the ordinary write path."""
    previous = _check(_config([_strip(active=active)]))
    checked = _ordinary(_old_writer(previous), previous)
    assert _strips_of(checked) == _strips_of(previous)


def test_old_writer_deleting_the_marker_unbinds_the_kept_shape() -> None:
    previous = _check(_config([_strip(active=False)]))
    payload = _old_writer(previous)
    payload["markers"] = []
    strip = _strips_of(_ordinary(payload, previous))[0]
    assert strip == {**_strip(), "marker": None, "active": True}


def test_explicit_empty_list_deletes_and_a_removed_space_takes_its_shapes() -> None:
    previous = _check(_config([_strip()], extra_spaces=("upper",)))
    explicit = copy.deepcopy(previous)
    explicit["spaces"][0]["led_strips"] = []
    assert _strips_of(_ordinary(explicit, previous)) == []
    removed = _old_writer(previous)
    removed["spaces"] = [space for space in removed["spaces"] if space["id"] != "ground"]
    removed["markers"] = []
    checked = _ordinary(removed, previous)
    assert all("led_strips" not in space for space in checked["spaces"])
    # The preservation never invents a key for a space that had none.
    assert "led_strips" not in _ordinary(_old_writer(_check(_config())), _check(_config()))["spaces"][0]


def test_tombstoned_marker_is_not_live() -> None:
    markers = [{"id": "lamp", "binding": "entity:light.kitchen", "space": "ground", "removed": True}]
    strip = _strips_of(_check(_config([_strip()], markers)))[0]
    assert strip["marker"] is None and strip["active"] is True


@pytest.mark.parametrize("space", ["absent", None, ""])
def test_empty_marker_space_adopts_the_strip_space(space) -> None:
    marker = {"id": "lamp", "binding": "entity:light.kitchen"}
    if space != "absent":
        marker["space"] = space
    config = _config([_strip()], [marker])
    assert led.led_strip_link_report(config) == {"unbound": 0, "space_adopted": 1}
    checked = _check(config)
    assert checked["markers"][0]["space"] == "ground"
    assert _strips_of(checked)[0]["marker"] == "lamp"


def test_normalisation_is_idempotent() -> None:
    config = _config([_strip(active=False)], markers=[])
    once = _check(config)
    twice = _check(once)
    assert once == twice
    assert led.led_strip_link_report(once) == {"unbound": 0, "space_adopted": 0}


def test_unavailable_entity_is_not_a_missing_marker() -> None:
    """Temporary HA unavailability is a state, never a config fact: the link stays."""
    strip = _strips_of(_check(_config([_strip()])))[0]
    assert strip["marker"] == "lamp"


def test_points_carry_only_json_noise_cleanup_not_a_lattice_snap() -> None:
    face = 0.4123456789  # a physical wall face, off the plan lattice
    strip = _strip(points=[[0.1, face], [0.30000000000000004, face]])
    stored = _strips_of(_check(_config([strip])))[0]["points"]
    assert stored == [[0.1, 0.412345679], [0.3, 0.412345679]]


# ---------- transfer rules ----------

def test_plan_only_projection_keeps_geometry_and_drops_every_device_link() -> None:
    space = {"led_strips": [
        _strip(),
        {"id": "led-2", "points": [[0, 0], [1, 0]], "marker": "fan", "active": False, "future": "x"},
    ]}
    projected = led.plan_only_strips(space)
    assert projected == [
        {"id": "led-1", "points": [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]], "marker": None, "active": True},
        {"id": "led-2", "points": [[0, 0], [1, 0]], "marker": None, "active": True},
    ]
    assert "lamp" not in json.dumps(projected) and "fan" not in json.dumps(projected)
    assert led.plan_only_strips({}) is None


def test_transfer_remaps_links_and_unbinds_what_did_not_travel() -> None:
    space = {"led_strips": [
        _strip(),
        {"id": "led-2", "points": [[0, 0], [1, 0]], "marker": "skipped", "active": False},
        {"id": "led-3", "points": [[0, 1], [1, 1]], "marker": None},
    ]}
    unbound = led.unbind_strips(space, remap={"lamp": "marker_lamp_2"})
    strips = space["led_strips"]
    assert strips[0]["marker"] == "marker_lamp_2"
    assert strips[1] == {"id": "led-2", "points": [[0, 0], [1, 0]], "marker": None, "active": True}
    assert strips[2]["marker"] is None
    assert unbound == 1


def test_transfer_never_binds_by_a_coinciding_old_id() -> None:
    """The target has its own marker 'lamp': without a remap entry the strip unbinds."""
    space = {"led_strips": [_strip()]}
    assert led.unbind_strips(space, remap={}) == 1
    assert space["led_strips"][0]["marker"] is None


# ---------- diagnostics privacy ----------

def test_support_summary_counts_strips_without_coordinates_or_ids() -> None:
    config = _config([
        _strip(),
        {"id": "led-secret-id", "points": [[0.123, 0.456], [0.789, 0.456]], "marker": None},
    ])
    config["markers"].append({"id": "hall", "binding": "entity:light.hall", "space": "ground"})
    config["spaces"][0]["led_strips"].append(
        {"id": "led-3", "points": [[0, 0], [1, 0]], "marker": "hall", "active": False},
    )
    summary = support._summary(config, {})
    assert summary["led_strips"] == {"total": 3, "unbound": 1, "hidden": 1}
    text = json.dumps(summary)
    for secret in ("led-secret-id", "0.123", "0.789", "light.kitchen", "light.hall"):
        assert secret not in text
