"""#1113 wire namespace, stale-client preservation and non-reusable link IDs."""
import copy
from pathlib import Path

import pytest
import voluptuous as vol
from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
v = load_pure("hp_validation_screens", ROOT / "custom_components/houseplan/validation.py")


def row(number=1, space=None):
    return dict(id=number, space=space, rotation=0, cycle=0, idle=0,
                summary="local", hidden_devices="local", icon_scale=None,
                font_scale=None, controls=True)


def namespace(*rows, next_id=2):
    return dict(version=1, next_id=next_id, screens=list(rows))


def config(screens=None):
    return dict(spaces=[], markers=[], settings={} if screens is None else {"external_screens": screens})


def ordinary(current, previous=None):
    return v.prepare_ordinary_summary_candidate(current, previous, set(), v.CONFIG_SCHEMA)


def test_external_screens_optional_and_v1_round_trip():
    assert "external_screens" not in ordinary(config())["settings"]
    value = namespace(row())
    assert ordinary(config(value))["settings"]["external_screens"] == value


@pytest.mark.parametrize("patch", [
    {"id": True}, {"id": 0}, {"id": 2}, {"rotation": True}, {"rotation": 45},
    {"cycle": True}, {"cycle": -1}, {"cycle": 3601}, {"idle": 1.5},
    {"icon_scale": .49}, {"font_scale": 3.01}, {"icon_scale": .51},
    {"icon_scale": float("nan")}, {"font_scale": True}, {"summary": "auto"},
    {"hidden_devices": False}, {"controls": 1},
])
def test_external_screens_rejects_malformed_known_fields(patch):
    value = row(); value.update(patch)
    with pytest.raises(vol.Invalid):
        ordinary(config(namespace(value)))


@pytest.mark.parametrize("value", [
    namespace(row(), row()), namespace(*[row(n) for n in range(1, 22)], next_id=22),
    dict(version=True, next_id=2, screens=[]), dict(version=1, next_id=True, screens=[]),
])
def test_external_screens_namespace_invariants(value):
    with pytest.raises(vol.Invalid):
        ordinary(config(value))


def test_external_screens_numbers_survive_delete_and_cannot_be_reused():
    old = config(namespace(row(1), row(3), next_id=4))
    assert ordinary(config(namespace(row(1), row(4), next_id=5)), old)
    for current in [namespace(row(1), next_id=3), namespace(row(1), row(2), next_id=4)]:
        with pytest.raises(vol.Invalid):
            ordinary(config(current), old)
    assert old["settings"]["external_screens"]["next_id"] == 4


def test_external_screens_stale_writer_and_future_namespace_lossless():
    for value in [namespace(row()), dict(version=8, opaque={"secret": [1, None, "x"]})]:
        previous = config(value)
        got = ordinary(config(), previous)
        assert got["settings"]["external_screens"] == value
        assert got["settings"]["external_screens"] is not value
        assert previous == config(value)
    with pytest.raises(vol.Invalid):
        ordinary(config(dict(version=3, opaque="x" * (128 * 1024))))


def test_external_screens_only_unchanged_broken_reference_is_retained():
    old = config(namespace(row(space="gone")))
    assert ordinary(copy.deepcopy(old), old)
    changed = copy.deepcopy(old); changed["settings"]["external_screens"]["screens"][0]["rotation"] = 90
    with pytest.raises(vol.Invalid, match="space must exist"):
        ordinary(changed, old)
    with pytest.raises(vol.Invalid, match="space must exist"):
        ordinary(config(namespace(row(space="gone"))))


def test_external_screens_authoritative_import_does_not_inherit_numbers_or_namespace():
    # Full imports use CONFIG_SCHEMA directly, not the ordinary writer's preservation fence.
    assert v.CONFIG_SCHEMA(config(namespace(row(), next_id=2)))["settings"]["external_screens"]["next_id"] == 2
    assert "external_screens" not in v.CONFIG_SCHEMA(config())["settings"]


def test_external_screens_event_is_bounded_and_only_proves_exact_namespace_only_successor():
    before = config(namespace(row()))
    after = copy.deepcopy(before); after["settings"]["external_screens"]["screens"][0]["rotation"] = 90
    data = v.external_screens_config_event(before, after, 7, 8)
    assert data == {"rev": 8, "external_screens_update": {"version": 1, "base_rev": 7, "value": after["settings"]["external_screens"]}}
    assert "spaces" not in data and "markers" not in data
    after["settings"]["external_screens"]["screens"][0]["rotation"] = 180
    assert data["external_screens_update"]["value"]["screens"][0]["rotation"] == 90
    assert v.external_screens_config_event(before, after, 7, 9) == {"rev": 9}
    after["settings"]["show_lqi"] = False
    assert v.external_screens_config_event(before, after, 7, 8) == {"rev": 8}
    assert v.external_screens_config_event(before, before, 7, 7) == {"rev": 7}
