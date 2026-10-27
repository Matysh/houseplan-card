"""#1096: an ordinary ``config/set`` validates and canonicalises what it touched.

Real authenticated WS and real HA Stores throughout. Observers delegate every
call unchanged and only count or time it; nothing is replaced with a stub
that succeeds. The counters read the integration's own functions:

* ``coordinate_canonicalization._lattice_points`` — one call per room poly
  that ``canonicalize_config_geometry`` canonicalises (floors of 1, 2 and 4
  rooms, so a count names the floors);
* ``junction_limits.space_violations`` — one call per space
  ``validate_junction_limits`` re-judges;
* ``validation.CONFIG_SCHEMA`` / ``CONFIG_TYPE_SCHEMA`` — the number of space
  records handed to the type schema (``SPACE_SCHEMA`` runs for each).

On the unchanged base every write shows all floors in every counter (AC2) and
settings-only costs what the full pass costs (AC10).
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
import statistics
import subprocess
import time
from pathlib import Path

import pytest
import voluptuous as vol
from homeassistant.auth import models as auth_models
from homeassistant.core import StateMachine
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import coordinate_canonicalization as canon
from custom_components.houseplan import junction_limits, room_appearance, zigbee_lqi
from custom_components.houseplan import store as store_module
from custom_components.houseplan import validation as v
from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.const import (
    CONF_ADMIN_ONLY,
    DOMAIN,
    FILES_DIR,
    PLANS_DIR,
)
from custom_components.houseplan.room_appearance import normalize_room_appearance
from custom_components.houseplan.store import async_save_config_state, get_data
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

ROOT = os.path.dirname(os.path.dirname(__file__))


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


# ---------- fixtures: a small v10 house and the browser large-house ----------

def _floor(space_id: str, rooms: int, *, room_color: str | None = None) -> dict:
    settings = {"room_color": room_color, "room_opacity": 0.4} if room_color else {}
    return {
        "id": space_id, "title": space_id.upper(), "view_box": [0, 0, 8, 2], "plan_url": None,
        "rooms": [{
            "id": f"{space_id}r{index}", "name": f"Room {index}",
            "poly": [[index, 0], [index + 1, 0], [index + 1, 1], [index, 1]],
        } for index in range(rooms)],
        **({"settings": settings} if settings else {}),
    }


def _house_source() -> dict:
    """Three floors of 1, 2 and 4 rooms (a count names the floors), two markers."""
    source = {
        "spaces": [_floor("a", 1, room_color="#336699"), _floor("b", 2), _floor("c", 4)],
        "markers": [
            {"id": "m1", "binding": "virtual", "space": "a", "name": "Lamp", "is_light": True},
            {"id": "m2", "binding": "virtual", "space": "b", "name": "Plug"},
            {"id": "m3", "binding": "virtual", "name": "Unplaced"},
        ],
        "settings": {"show_room_tooltip": False, "glow_radius_cm": 100,
                     "fill_colors": {"wall_fill": {"c": "#abcdef", "a": 0.5}}},
    }
    return commit_wall_segment_model(source)[0]


_HOUSE = _house_source()
ROOMS = {"a": 1, "b": 2, "c": 4}


def house() -> dict:
    return copy.deepcopy(_HOUSE)


def _node_fixture(module_name: str) -> dict:
    script = (
        f"import * as fixture from './demo/fixtures/{module_name}.mjs';"
        "const make=fixture.makeLargeHouseFixture||fixture.makeVisualMatrixFixture;"
        "process.stdout.write(JSON.stringify(make()));"
    )
    result = subprocess.run(["node", "--input-type=module", "--eval", script],
                            cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


@pytest.fixture(scope="module")
def large_house() -> dict:
    return _node_fixture("large-house")["config"]


def _thicken(space: dict, cm: float = 15) -> None:
    """A wall edit as a v10 client sends it: the segment and its projection."""
    segment = space["wall_segments"][0]
    segment["cm"] = cm
    space["walls"] = [{"key": "w-1096", "a": list(segment["a"]), "b": list(segment["b"]), "cm": cm}]


def _new_floor(space_id: str, rooms: int) -> dict:
    """A v10 space with its own wall catalogue, as a new client would send it."""
    return commit_wall_segment_model({"spaces": [_floor(space_id, rooms)], "markers": [], "settings": {}})[0]["spaces"][0]


# ---------- counters on the integration's own functions ----------

class Counters:
    """Per-write counts of the per-space steps; see the module docstring."""

    def __init__(self, monkeypatch) -> None:
        self.rooms = 0
        self.junction_spaces = 0
        self.schema_spaces = 0
        lattice = canon._lattice_points

        def counted_lattice(points):
            self.rooms += 1
            return lattice(points)

        monkeypatch.setattr(canon, "_lattice_points", counted_lattice)
        violations = junction_limits.space_violations

        def counted_violations(space):
            self.junction_spaces += 1
            return violations(space)

        monkeypatch.setattr(junction_limits, "space_violations", counted_violations)
        for owner, name in ((v, "CONFIG_SCHEMA"), (endpoint, "CONFIG_SCHEMA"), (v, "CONFIG_TYPE_SCHEMA")):
            schema = getattr(owner, name, None)
            if schema is None:
                continue

            def counted_schema(value, _schema=schema):
                self.schema_spaces += len(value.get("spaces") or [])
                return _schema(value)

            monkeypatch.setattr(owner, name, counted_schema)

    def reset(self) -> None:
        self.rooms = self.junction_spaces = self.schema_spaces = 0

    def floors(self) -> tuple[int, int, int]:
        return self.schema_spaces, self.rooms, self.junction_spaces


def _all_floors(doc: dict) -> tuple[int, int, int]:
    spaces = doc["spaces"]
    return len(spaces), sum(len(space["rooms"]) for space in spaces), len(spaces)


# ---------- WS helpers ----------

async def _setup(hass, *, options: dict | None = None) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _write(client, config: dict, rev: int) -> dict:
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": rev})
    return await client.receive_json()


async def _stored(client) -> dict:
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    answer = await client.receive_json()
    assert answer["success"], answer
    return answer["result"]


# ---------- AC1: the scoped pass returns the document of the full pass ----------

def _corpus(stored: dict) -> dict[str, dict]:
    """Candidates an ordinary client sends over the stored small house."""
    def edited(**changes):
        candidate = copy.deepcopy(stored)
        for path, value in changes.items():
            target = candidate
            keys = path.split(".")
            for key in keys[:-1]:
                target = target[int(key)] if key.isdigit() else target[key]
            target[keys[-1]] = value
        return candidate

    settings_only = edited(**{"settings.show_room_tooltip": True})
    marker_only = edited(**{"markers.0.name": "Renamed lamp"})
    decor = edited(**{"spaces.1.decor": [{"id": "d1", "kind": "line", "x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9}]})
    wall = copy.deepcopy(stored)
    _thicken(wall["spaces"][1])
    new_space = copy.deepcopy(stored)
    new_space["spaces"].append(_new_floor("d", 1))
    removed_space = copy.deepcopy(stored)
    del removed_space["spaces"][2]
    led = copy.deepcopy(stored)
    # A strip of floor b bound to an untouched marker without a space: the
    # whole-document link step gives the marker the strip's space.
    led["spaces"][1]["led_strips"] = [{"id": "led", "marker": "m3", "points": [[0.1, 0.1], [0.5, 0.1]]}]
    led_orphan = copy.deepcopy(stored)
    led_orphan["spaces"][2]["led_strips"] = [{"id": "led", "marker": "gone", "points": [[0.1, 0.1], [0.5, 0.1]]}]
    bg_mode = edited(**{"settings.bg_mode": "daynight"})
    model_version = edited(model_version=stored["model_version"] + 1)
    return {
        "settings-only": settings_only, "marker-only": marker_only, "decor-one-floor": decor,
        "wall-one-floor": wall, "new-space": new_space, "removed-space": removed_space,
        "led-link-across-spaces": led, "led-orphan-link": led_orphan,
        "bg-mode": bg_mode, "model-version": model_version,
    }


EXPECTED_SCOPE = {
    "settings-only": (set(), set(), None),
    "marker-only": (set(), {"m1"}, None),
    "decor-one-floor": ({"b"}, set(), None),
    "wall-one-floor": ({"b"}, set(), None),
    "new-space": ({"d"}, set(), None),
    "removed-space": (set(), set(), None),
    "led-link-across-spaces": ({"b"}, set(), None),
    "led-orphan-link": ({"c"}, set(), None),
    "bg-mode": (set(), set(), "global bg_mode differs"),
    "model-version": (set(), set(), "model_version differs"),
}


@pytest.fixture(scope="module")
def stored_house() -> dict:
    return v.CONFIG_SCHEMA(house())


@pytest.mark.parametrize("name", sorted(EXPECTED_SCOPE))
def test_issue_1096_scoped_candidate_equals_config_schema(stored_house, name):
    candidate = _corpus(stored_house)[name]
    scope = v.ordinary_write_scope(candidate, stored_house)
    assert (scope.touched_spaces, scope.touched_markers, scope.full_reason) == EXPECTED_SCOPE[name]
    expected = v.CONFIG_SCHEMA(copy.deepcopy(candidate))
    assert v.validate_scoped_candidate(candidate, stored_house, scope) == expected
    if name == "led-link-across-spaces":
        assert next(m for m in expected["markers"] if m["id"] == "m3")["space"] == "b"
    if name == "led-orphan-link":
        assert expected["spaces"][2]["led_strips"][0] == {
            "id": "led", "marker": None, "active": True, "points": [[0.1, 0.1], [0.5, 0.1]],
        }


@pytest.mark.parametrize("scenario", ["settings-only", "marker-only", "one-floor-decor", "one-floor-wall"])
def test_issue_1096_scoped_candidate_equals_config_schema_on_large_house(large_house, scenario):
    stored = v.CONFIG_SCHEMA(copy.deepcopy(large_house))
    candidate = copy.deepcopy(stored)
    if scenario == "settings-only":
        candidate["settings"]["show_room_tooltip"] = not candidate["settings"].get("show_room_tooltip", False)
    elif scenario == "marker-only":
        candidate["markers"][0]["name"] = "Renamed"
    elif scenario == "one-floor-decor":
        candidate["spaces"][0].setdefault("decor", []).append(
            {"id": "d-1096", "kind": "line", "x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9})
    else:
        # The browser fixture is a legacy (pre-v8) document: walls are authoritative.
        candidate["spaces"][0]["walls"][0]["cm"] = candidate["spaces"][0]["walls"][0]["cm"] + 1
    scope = v.ordinary_write_scope(candidate, stored)
    assert not scope.full
    assert scope.touched_spaces == ({stored["spaces"][0]["id"]} if scenario.startswith("one-floor") else set())
    assert v.validate_scoped_candidate(candidate, stored, scope) == v.CONFIG_SCHEMA(copy.deepcopy(candidate))


@pytest.mark.parametrize("legacy_spaces", [("a",), ("a", "b", "c")])
def test_issue_1096_legacy_previous_resolves_the_same_colours(stored_house, legacy_spaces):
    """A previous saved before #1037 (no name_color/wall_fill) hands the
    candidate the colours `normalize_room_appearance` computes — not the
    schema defaults — on both paths (r1 M1)."""
    previous = copy.deepcopy(stored_house)
    for space in previous["spaces"]:
        if space["id"] in legacy_spaces:
            for key in ("name_color", "wall_fill"):
                space.get("settings", {}).pop(key, None)
            if not space.get("settings"):
                space.pop("settings", None)
    candidate = copy.deepcopy(previous)
    candidate["settings"]["show_room_tooltip"] = True
    resolved = normalize_room_appearance(previous)

    def full(doc):
        return v.CONFIG_SCHEMA(doc)

    def scoped(doc):
        return v.validate_scoped_candidate(doc, previous, v.ordinary_write_scope(doc, previous))

    expected = v.prepare_ordinary_summary_candidate(copy.deepcopy(candidate), previous, set(), full)
    actual = v.prepare_ordinary_summary_candidate(copy.deepcopy(candidate), previous, set(), scoped)
    assert actual == expected
    for space, resolved_space in zip(actual["spaces"], resolved["spaces"], strict=True):
        assert space["settings"]["name_color"] == resolved_space["settings"]["name_color"]
        assert space["settings"]["wall_fill"] == resolved_space["settings"]["wall_fill"]
    assert actual["spaces"][0]["settings"]["name_color"] == {"c": "#336699", "a": 0.65}
    assert actual["spaces"][0]["settings"]["wall_fill"] == {"c": "#abcdef", "a": 0.5}


@pytest.mark.parametrize("breakage", ["poly", "wall-ids", "too-many-spaces"])
def test_issue_1096_scoped_candidate_rejects_with_the_full_pass_error(stored_house, breakage):
    candidate = copy.deepcopy(stored_house)
    if breakage == "poly":
        candidate["spaces"][2]["rooms"][1]["poly"] = [[0, 0], [1, 1]]
    elif breakage == "wall-ids":
        candidate["spaces"][1]["wall_segments"][1]["id"] = candidate["spaces"][1]["wall_segments"][0]["id"]
    else:
        candidate["spaces"].extend(_new_floor(f"x{index}", 1) for index in range(v.MAX_SPACES))
    scope = v.ordinary_write_scope(candidate, stored_house)
    assert not scope.full
    with pytest.raises(vol.Invalid) as full:
        v.CONFIG_SCHEMA(copy.deepcopy(candidate))
    with pytest.raises(vol.Invalid) as scoped:
        v.validate_scoped_candidate(candidate, stored_house, scope)
    assert str(scoped.value) == str(full.value)
    assert type(scoped.value) is type(full.value)
    if breakage == "poly":
        assert "data['spaces'][2]['rooms'][1]['poly']" in str(full.value)


@pytest.mark.parametrize("breakage", ["spaces-not-a-list", "markers-not-a-list", "settings-not-a-dict"])
def test_issue_1096_malformed_top_level_is_a_full_pass(stored_house, breakage):
    candidate = copy.deepcopy(stored_house)
    key, value = breakage.split("-", 1)[0], ({} if breakage != "settings-not-a-dict" else [])
    candidate[key] = value
    scope = v.ordinary_write_scope(candidate, stored_house)
    assert scope.full_reason == "malformed top level"
    with pytest.raises(vol.Invalid) as full:
        v.CONFIG_SCHEMA(copy.deepcopy(candidate))
    with pytest.raises(vol.Invalid) as scoped:
        v.validate_scoped_candidate(candidate, stored_house, scope)
    assert str(scoped.value) == str(full.value)
    assert f"data['{key}']" in str(full.value)


# ---------- AC2 + AC5: counters on real WS writes, clean stamp lifecycle ----------

async def test_issue_1096_ordinary_write_judges_touched_floors_only(hass, hass_ws_client, monkeypatch):
    counters = Counters(monkeypatch)
    await _setup(hass)
    rt = get_data(hass)
    client = await hass_ws_client(hass)
    source = house()
    everything = _all_floors(source)  # (3 spaces, 7 rooms, 3 spaces)

    async def write(mutate, *, expect=None, success=True):
        """One ordinary write of the stored document with `mutate` applied."""
        stored = await _stored(client)
        candidate = copy.deepcopy(stored["config"])
        mutate(candidate)
        counters.reset()
        answer = await _write(client, candidate, stored["rev"])
        assert answer["success"] is success, answer
        if expect is not None:
            assert counters.floors() == expect, (counters.floors(), expect)
        return answer

    # First write after start: no stamp, the whole document is validated.
    counters.reset()
    first = await _write(client, source, 0)
    assert first["success"], first
    assert counters.floors() == everything
    assert rt.schema_clean_rev == 1 == rt.junction_baseline[0]

    # Stamped: settings-only touches no space; floor b (2 rooms) only itself.
    await write(lambda c: c["settings"].update(show_room_tooltip=True), expect=(0, 0, 0))
    await write(lambda c: c["spaces"][1].update(decor=[
        {"id": "d1", "kind": "line", "x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9}]), expect=(1, ROOMS["b"], 1))
    await write(lambda c: _thicken(c["spaces"][1]), expect=(1, ROOMS["b"], 1))
    await write(lambda c: c["markers"][0].update(name="Renamed"), expect=(0, 0, 0))
    # The counts the scoped write cached for untouched floors are the full recount.
    stored = (await _stored(client))["config"]
    assert rt.junction_baseline == (rt.schema_clean_rev, junction_limits.validate_junction_limits(stored, None))

    # Global inputs of per-space steps: the whole document again.
    await write(lambda c: c["settings"].update(bg_mode="daynight"), expect=everything)
    # A client that does not send model_version (hydrated by the transition
    # guard) differs from the stored document: every floor, at least once.
    await write(lambda c: c.pop("model_version"))
    assert all(got >= want for got, want in zip(counters.floors(), everything, strict=True)), counters.floors()
    assert (await _stored(client))["config"]["model_version"] == source["model_version"]
    await write(lambda c: c["settings"].update(show_room_tooltip=False), expect=(0, 0, 0))

    # No stamp (a restart): full, and the write stamps again.
    rt.schema_clean_rev = None
    await write(lambda c: c["settings"].update(show_room_tooltip=True), expect=everything)
    await write(lambda c: c["settings"].update(show_room_tooltip=False), expect=(0, 0, 0))

    # A pair writer (marker/copy) retires the stamp; the next ordinary write is full.
    before = await _stored(client)
    lamp = next(m for m in before["config"]["markers"] if m["id"] == "m1")
    await client.send_json_auto_id({
        "type": "houseplan/marker/copy", "source_id": "m1", "source_binding": "virtual",
        "marker": {**lamp, "id": "v_m1_copy", "name": "Lamp 2"}, "position": {"s": "a", "x": 0.5, "y": 0.5},
        "expected_config_rev": before["rev"], "expected_layout_rev": 0,
    })
    copied = await client.receive_json()
    assert copied["success"], copied
    assert rt.schema_clean_rev is None
    # ... and the junction baseline (#330): the stored document is re-judged
    # once (3) before the candidate (3), exactly as before this change.
    await write(lambda c: c["settings"].update(show_room_tooltip=True), expect=(3, 7, 6))
    await write(lambda c: c["settings"].update(show_room_tooltip=False), expect=(0, 0, 0))

    # A refused write (conflict, invalid) leaves the stamp as it was.
    stamped = rt.schema_clean_rev
    stored = await _stored(client)
    stale = copy.deepcopy(stored["config"])
    stale["settings"]["glow_radius_cm"] = 200
    refused = await _write(client, stale, stored["rev"] - 1)
    assert refused["error"]["code"] == "conflict"
    broken = copy.deepcopy(stored["config"])
    broken["spaces"][2]["title"] = 5
    counters.reset()
    refused = await _write(client, broken, stored["rev"])
    assert refused["error"]["code"] == "invalid_format"
    assert "data['spaces'][2]['title']" in refused["error"]["message"], refused
    assert counters.floors() == (1, 0, 0)  # floor c alone reached the type schema
    assert rt.schema_clean_rev == stamped
    await write(lambda c: c["settings"].update(show_room_tooltip=True), expect=(0, 0, 0))


# ---------- AC3: the states walk happens only for changed summary references ----------

def _summary(*entity_ids: str) -> dict:
    return {"version": 1, "title": "Summary", "show_on_mobile": True, "blocks": [{
        "id": f"b-{index}", "title": entity_id, "visible": True, "scope": {"type": "all"},
        "values": [{"id": f"v-{index}", "label": entity_id,
                    "source": {"type": "entity", "entity_id": entity_id}}],
    } for index, entity_id in enumerate(entity_ids)]}


async def test_issue_1096_summary_references_are_checked_without_a_states_walk(hass, hass_ws_client, monkeypatch):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    admin = await hass_ws_client(hass)
    for index in range(50):
        hass.states.async_set(f"sensor.noise_{index}", str(index))
    hass.states.async_set("sensor.allowed", "1")
    hass.states.async_set("sensor.secret", "2")
    # A household user who may edit the plan (admin_only off) but may read
    # one sensor only: HA's own entity policy, through a real group.
    hass.auth._store._groups["hp-restricted"] = auth_models.Group(
        name="House Plan restricted", id="hp-restricted",
        policy={"entities": {"entity_ids": {"sensor.allowed": True}}})
    user = await hass.auth.async_create_user("Restricted", group_ids=["hp-restricted"])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    restricted = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))

    walks: list[tuple[set[str] | None, int]] = []
    all_calls = {"count": 0}
    async_all = StateMachine.async_all

    def counted_all(self, *args, **kwargs):
        all_calls["count"] += 1
        return async_all(self, *args, **kwargs)

    monkeypatch.setattr(StateMachine, "async_all", counted_all)
    readable = endpoint._readable_entity_ids

    def observed(hass_, connection, entity_ids=None):
        before = all_calls["count"]
        try:
            return readable(hass_, connection, entity_ids)
        finally:
            walks.append((entity_ids, all_calls["count"] - before))

    monkeypatch.setattr(endpoint, "_readable_entity_ids", observed)

    seeded = await _write(admin, {**house(), "settings": {"summary_panel": _summary("sensor.allowed")}}, 0)
    assert seeded["success"], seeded
    assert walks == [({"sensor.allowed"}, 0)]
    walks.clear()

    stored = await _stored(restricted)
    unchanged = copy.deepcopy(stored["config"])
    unchanged["settings"]["show_room_tooltip"] = True
    assert (await _write(restricted, unchanged, stored["rev"]))["success"]
    assert walks == [], "an unchanged panel needs no readable-entity snapshot"

    stored = await _stored(restricted)
    secret = copy.deepcopy(stored["config"])
    secret["settings"]["summary_panel"] = _summary("sensor.allowed", "sensor.secret")
    refused = await _write(restricted, secret, stored["rev"])
    assert refused["error"]["code"] == "invalid_format"
    assert "new summary entity reference must be readable" in refused["error"]["message"]
    assert walks == [({"sensor.allowed", "sensor.secret"}, 0)], "only the referenced entities are looked up"
    walks.clear()

    allowed = copy.deepcopy(stored["config"])
    allowed["settings"]["summary_panel"] = _summary("sensor.allowed", "sensor.allowed")
    accepted = await _write(restricted, allowed, stored["rev"])
    assert accepted["success"], accepted
    assert walks == [({"sensor.allowed"}, 0)]
    assert (await _stored(restricted))["config"]["settings"]["summary_panel"] == allowed["settings"]["summary_panel"]


# ---------- AC4: registry evidence only for a changed radar block ----------

def _radar(room_id: str) -> dict:
    return {
        "version": 1, "enabled": True, "profile": "presence_v1", "room_id": room_id,
        "sources": {"occupancy_entity": "binary_sensor.presence"},
        "mount": {"installation_id": "mount-1", "x": 0.5, "y": 0.5, "heading_deg": 0},
        "calibration": {"method": "not_required", "mirror": False, "cell_cm": 5},
    }


async def test_issue_1096_radar_registry_is_read_only_for_a_changed_block(hass, hass_ws_client, monkeypatch):
    await _setup(hass)
    client = await hass_ws_client(hass)
    evidence = {"calls": 0}
    radar_registry_evidence = endpoint.radar_registry_evidence

    def counted(hass_):
        evidence["calls"] += 1
        return radar_registry_evidence(hass_)

    monkeypatch.setattr(endpoint, "radar_registry_evidence", counted)
    validated: list[bool] = []
    validate_marker_radars = endpoint.validate_marker_radars

    def observed(config, previous=None, **kwargs):
        validated.append(kwargs.get("registry") is not None)
        return validate_marker_radars(config, previous, **kwargs)

    monkeypatch.setattr(endpoint, "validate_marker_radars", observed)

    source = house()
    source["markers"][0]["radar"] = _radar("ar0")
    assert (await _write(client, source, 0))["success"]
    assert evidence["calls"] == 1 and validated == [True]

    stored = await _stored(client)
    settings_only = copy.deepcopy(stored["config"])
    settings_only["settings"]["show_room_tooltip"] = True
    assert (await _write(client, settings_only, stored["rev"]))["success"]
    assert evidence["calls"] == 1 and validated == [True, False], "an unchanged radar set reads no registry"

    stored = await _stored(client)
    changed = copy.deepcopy(stored["config"])
    changed["markers"][0]["radar"]["enabled"] = False
    assert (await _write(client, changed, stored["rev"]))["success"]
    assert evidence["calls"] == 2 and validated == [True, False, True]

    stored = await _stored(client)
    broken = copy.deepcopy(stored["config"])
    broken["markers"][0]["radar"]["room_id"] = "no-such-room"
    refused = await _write(client, broken, stored["rev"])
    assert refused["error"]["code"] == "invalid_radar", refused
    assert evidence["calls"] == 3

    stored = await _stored(client)
    global_radar = copy.deepcopy(stored["config"])
    global_radar["settings"]["radar"] = {"future": True}
    assert (await _write(client, global_radar, stored["rev"]))["success"]
    assert evidence["calls"] == 4 and validated[-1] is True


# ---------- AC6: one canonicalisation, no second store read, no copies ----------

async def test_issue_1096_one_canonicalisation_no_reload_no_copy(hass, hass_ws_client, monkeypatch):
    await _setup(hass)
    rt = get_data(hass)
    client = await hass_ws_client(hass)
    calls = {"store_canonicalize": 0, "validation_canonicalize": [], "load_in_save": 0,
             "deepcopy_in_get": 0, "normalize_in_get": 0}
    store_canonicalize = store_module.canonicalize_config_geometry

    def counted_store_canonicalize(config):
        calls["store_canonicalize"] += 1
        return store_canonicalize(config)

    monkeypatch.setattr(store_module, "canonicalize_config_geometry", counted_store_canonicalize)
    validation_canonicalize = v.canonicalize_config_geometry

    def counted_validation_canonicalize(config):
        calls["validation_canonicalize"].append(len(config.get("spaces") or []))
        return validation_canonicalize(config)

    monkeypatch.setattr(v, "canonicalize_config_geometry", counted_validation_canonicalize)
    in_save = {"active": False}
    async_load = rt.config_store.async_load

    async def counted_load():
        if in_save["active"]:
            calls["load_in_save"] += 1
        return await async_load()

    monkeypatch.setattr(rt.config_store, "async_load", counted_load)
    save = endpoint.async_save_config_state

    async def observed_save(*args, **kwargs):
        in_save["active"] = True
        try:
            return await save(*args, **kwargs)
        finally:
            in_save["active"] = False

    monkeypatch.setattr(endpoint, "async_save_config_state", observed_save)
    deepcopy = room_appearance.deepcopy

    def counted_deepcopy(value):
        calls["deepcopy_in_get"] += 1
        return deepcopy(value)

    monkeypatch.setattr(room_appearance, "deepcopy", counted_deepcopy)
    normalize = endpoint.normalize_room_appearance

    def counted_normalize(config):
        calls["normalize_in_get"] += 1
        return normalize(config)

    monkeypatch.setattr(endpoint, "normalize_room_appearance", counted_normalize)

    assert (await _write(client, house(), 0))["success"]
    assert calls["store_canonicalize"] == 0 and calls["load_in_save"] == 0

    # config/get of a materialised document: no copy, no normalisation.
    calls["deepcopy_in_get"] = calls["normalize_in_get"] = 0
    stored = await _stored(client)
    assert calls["deepcopy_in_get"] == 0 and calls["normalize_in_get"] == 0
    assert all({"name_color", "wall_fill"} <= set(space["settings"]) for space in stored["config"]["spaces"])

    # A scoped write canonicalises the touched floor once, in validation only.
    calls["validation_canonicalize"].clear()
    candidate = copy.deepcopy(stored["config"])
    candidate["spaces"][1]["decor"] = [{"id": "d1", "kind": "line", "x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9}]
    assert (await _write(client, candidate, stored["rev"]))["success"]
    assert calls["validation_canonicalize"] == [1]
    assert calls["store_canonicalize"] == 0 and calls["load_in_save"] == 0

    # A legacy document (saved before #1037): config/get still resolves on a
    # copy, and an ordinary write inherits the computed colours, not defaults.
    stored = await _stored(client)
    legacy = copy.deepcopy(stored["config"])
    for space in legacy["spaces"]:
        for key in ("name_color", "wall_fill"):
            space["settings"].pop(key)
    await async_save_config_state(rt, legacy, stored["rev"] + 1, previous_rev=stored["rev"])
    assert rt.schema_clean_rev is None
    calls["deepcopy_in_get"] = calls["normalize_in_get"] = 0
    read = await _stored(client)
    assert calls["normalize_in_get"] == 1 and calls["deepcopy_in_get"] >= 1
    resolved = normalize_room_appearance(legacy)
    assert read["config"]["spaces"][0]["settings"]["name_color"] == {"c": "#336699", "a": 0.65}
    assert read["config"]["spaces"] == resolved["spaces"]
    candidate = copy.deepcopy(legacy)
    candidate["settings"]["show_room_tooltip"] = True
    assert (await _write(client, candidate, read["rev"]))["success"]
    written = (await _stored(client))["config"]
    for space, resolved_space in zip(written["spaces"], resolved["spaces"], strict=True):
        assert space["settings"]["name_color"] == resolved_space["settings"]["name_color"]
        assert space["settings"]["wall_fill"] == resolved_space["settings"]["wall_fill"]
    assert written["spaces"][0]["settings"]["name_color"] != {"c": "#55606c", "a": 0.8}


# ---------- AC7: file collection lists only what a commit can drop ----------

async def test_issue_1096_file_collection_lists_only_what_a_commit_can_drop(hass, hass_ws_client, monkeypatch):
    await _setup(hass)
    client = await hass_ws_client(hass)
    plans_dir = Path(hass.config.path(PLANS_DIR))
    files_dir = Path(hass.config.path(FILES_DIR))

    def seed():
        (files_dir / "m1").mkdir(parents=True, exist_ok=True)
        plans_dir.mkdir(parents=True, exist_ok=True)
        for path in (plans_dir / "a.tok.png", plans_dir / "a.new.png", plans_dir / "a.reject.png",
                     files_dir / "m1" / "manual.pdf", files_dir / "m1" / "extra.pdf"):
            path.write_bytes(b"x")

    await hass.async_add_executor_job(seed)
    listed: list[str] = []
    iterdir = Path.iterdir

    def observed_iterdir(self):
        listed.append(str(self))
        return iterdir(self)

    monkeypatch.setattr(Path, "iterdir", observed_iterdir)
    source = house()
    source["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/a.tok.png"
    source["markers"][0]["pdfs"] = [{"name": "manual", "url": "/api/houseplan/content/files/m1/manual.pdf"}]
    assert (await _write(client, source, 0))["success"]

    def exists(name: str) -> bool:
        return (plans_dir / name).is_file() if name.endswith(".png") else (files_dir / "m1" / name).is_file()

    # Nothing replaced or dropped: the plans directory and the device folder
    # are not entered (the files root is listed for the staging-folder sweep).
    listed.clear()
    stored = await _stored(client)
    candidate = copy.deepcopy(stored["config"])
    candidate["settings"]["show_room_tooltip"] = True
    assert (await _write(client, candidate, stored["rev"]))["success"]
    assert str(plans_dir) not in listed and str(files_dir / "m1") not in listed, listed
    for name in ("a.tok.png", "a.new.png", "a.reject.png", "manual.pdf", "extra.pdf"):
        assert await hass.async_add_executor_job(exists, name), name

    # A replaced plan: the superseded file goes, the others stay, as before.
    listed.clear()
    stored = await _stored(client)
    candidate = copy.deepcopy(stored["config"])
    candidate["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/a.new.png"
    assert (await _write(client, candidate, stored["rev"]))["success"]
    assert str(plans_dir) in listed and str(files_dir / "m1") not in listed
    assert not await hass.async_add_executor_job(exists, "a.tok.png")
    assert await hass.async_add_executor_job(exists, "a.new.png")
    assert await hass.async_add_executor_job(exists, "a.reject.png")

    # A dropped attachment: the device folder is entered and the file goes.
    listed.clear()
    stored = await _stored(client)
    candidate = copy.deepcopy(stored["config"])
    candidate["markers"][0]["pdfs"] = []
    assert (await _write(client, candidate, stored["rev"]))["success"]
    assert str(files_dir / "m1") in listed and str(plans_dir) not in listed
    assert not await hass.async_add_executor_job(exists, "manual.pdf")
    assert await hass.async_add_executor_job(exists, "extra.pdf")


# ---------- AC8: the LQI scope is rebuilt only when its inputs change ----------

def test_issue_1096_lqi_scope_key_reads_areas_bindings_and_topics():
    from custom_components.houseplan.zigbee_lqi_model import lqi_scope_key

    config = {
        "spaces": [{"id": "a", "rooms": [{"id": "r1", "area": "kitchen"}, {"id": "r2", "area": None}]},
                   {"id": "b", "rooms": [{"id": "r3", "area": "hall"}]}],
        "markers": [{"id": "m1", "binding": "device:dev1"}, {"id": "m2", "binding": "entity:light.x"},
                    {"id": "m3", "binding": "device:gone", "removed": True}, {"id": "m4", "binding": "virtual"}],
        "settings": {"zigbee_topology": {"z2m_base_topics": ["zigbee2mqtt", "z2m2"]}},
    }
    key = lqi_scope_key(config)
    assert key == (("hall", "kitchen"), ("device:dev1", "entity:light.x", "virtual"), ("zigbee2mqtt", "z2m2"))
    reordered = copy.deepcopy(config)
    reordered["spaces"].reverse()
    reordered["markers"].reverse()
    assert lqi_scope_key(reordered) == key
    renamed = copy.deepcopy(config)
    renamed["markers"][0]["name"] = "Renamed"
    renamed["spaces"][0]["rooms"][0]["name"] = "Kitchen"
    assert lqi_scope_key(renamed) == key
    for change in (lambda c: c["spaces"][0]["rooms"][1].update(area="bath"),
                   lambda c: c["markers"][3].update(binding="device:dev2"),
                   lambda c: c["markers"][2].pop("removed"),
                   lambda c: c["settings"]["zigbee_topology"].update(z2m_base_topics=["zigbee2mqtt"]),
                   lambda c: c["settings"].pop("zigbee_topology")):
        changed = copy.deepcopy(config)
        change(changed)
        assert lqi_scope_key(changed) != key


async def test_issue_1096_lqi_registry_walk_only_when_scope_inputs_change(hass, hass_ws_client, monkeypatch):
    await _setup(hass)
    rt = get_data(hass)
    client = await hass_ws_client(hass)
    walks = {"represented": 0, "refresh": 0}
    represented = zigbee_lqi.represented_devices

    def counted_represented(config, registry, entities):
        walks["represented"] += 1
        return represented(config, registry, entities)

    monkeypatch.setattr(zigbee_lqi, "represented_devices", counted_represented)
    coordinator = rt.zigbee_lqi
    request_refresh = coordinator.request_refresh

    def counted_refresh(*args, **kwargs):
        walks["refresh"] += 1
        return request_refresh(*args, **kwargs)

    monkeypatch.setattr(coordinator, "request_refresh", counted_refresh)

    async def settled() -> dict:
        """The counts once the background refresh the save may have started is done."""
        for _ in range(5000):
            if coordinator._refresh_task is None:
                break
            await asyncio.sleep(0)
        assert coordinator._refresh_task is None
        return dict(walks)

    assert (await _write(client, house(), 0))["success"]
    first = await settled()
    assert first["refresh"] == 1 and first["represented"] >= 1, "the first save after setup rebuilds the scope"
    assert coordinator.config == (await rt.config_store.async_load())["config"]

    async def write(mutate) -> dict:
        stored = await _stored(client)
        candidate = copy.deepcopy(stored["config"])
        mutate(candidate)
        answer = await _write(client, candidate, stored["rev"])
        assert answer["success"], answer
        assert coordinator.config == (await rt.config_store.async_load())["config"]
        return await settled()

    assert await write(lambda c: c["settings"].update(show_room_tooltip=True)) == first
    assert await write(lambda c: c["markers"][0].update(name="Renamed")) == first
    assert await write(lambda c: c["spaces"][1]["rooms"][0].update(name="Renamed room")) == first, \
        "no scope input changed: no registry walk, no refresh"
    after_area = await write(lambda c: c["spaces"][1]["rooms"][0].update(area="kitchen"))
    assert after_area["refresh"] == first["refresh"] + 1 and after_area["represented"] > first["represented"]
    after_binding = await write(lambda c: c["markers"][0].update(binding="device:dev-1096"))
    assert after_binding["refresh"] == after_area["refresh"] + 1 and after_binding["represented"] > after_area["represented"]
    after_removed = await write(lambda c: c["markers"][0].update(removed=True))
    assert after_removed["refresh"] == after_binding["refresh"] + 1


# ---------- AC10: the scoped pass costs a fraction of the full pass ----------

# `one-floor` edits the second floor (a fifth of the document's bytes, like
# the third); the first floor carries the fixture's 250 stairs — half of the
# document — so its edit is reported without a threshold: the cost of a floor
# is the cost of that floor.
BUDGET = {"settings-only": 0.10, "marker-only": 0.10, "one-floor": 0.50, "one-floor-largest": None}
FLOOR = {"one-floor": 1, "one-floor-largest": 0}


async def test_issue_1096_scoped_write_budget_on_large_house(hass, hass_ws_client, monkeypatch, large_house):
    """Same process, same document, real WS and Stores: for each scenario the
    full pass (stamp cleared before the write) and the scoped pass alternate,
    7 repeats each; medians of the executor CPU phase are compared. Absolute
    times are reported, not judged."""
    await _setup(hass)
    rt = get_data(hass)
    client = await hass_ws_client(hass)
    cpu = {"ms": None}
    executor = hass.async_add_executor_job

    async def measured_executor(fn, *args):
        if fn.__name__ != "_validate_config_cpu":
            return await executor(fn, *args)

        def work():
            started = time.perf_counter()
            try:
                return fn(*args)
            finally:
                cpu["ms"] = (time.perf_counter() - started) * 1000

        return await executor(work)

    monkeypatch.setattr(hass, "async_add_executor_job", measured_executor)
    seeded = await _write(client, copy.deepcopy(large_house), 0)
    assert seeded["success"], seeded

    def mutate(scenario: str, config: dict, turn: int) -> None:
        if scenario == "settings-only":
            config["settings"]["show_room_tooltip"] = bool(turn % 2)
        elif scenario == "marker-only":
            config["markers"][0]["name"] = f"Marker {turn % 2}"
        else:
            floor = config["spaces"][FLOOR[scenario]]
            decor = [d for d in floor.get("decor") or [] if d.get("id") != "d-1096"]
            if turn % 2:
                decor.append({"id": "d-1096", "kind": "line", "x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9})
            floor["decor"] = decor

    report = {}
    for scenario, budget in BUDGET.items():
        samples = {"full": [], "scoped": []}
        turn = 0
        for _repeat in range(7):
            for mode in ("full", "scoped"):
                stored = await _stored(client)
                candidate = copy.deepcopy(stored["config"])
                turn += 1
                mutate(scenario, candidate, turn)
                if mode == "full":
                    rt.schema_clean_rev = None
                cpu["ms"] = None
                started = time.perf_counter()
                answer = await _write(client, candidate, stored["rev"])
                ack_ms = (time.perf_counter() - started) * 1000
                assert answer["success"], answer
                assert answer["result"]["rev"] == stored["rev"] + 1, "every sample is a real revision"
                assert cpu["ms"] is not None
                samples[mode].append((cpu["ms"], ack_ms))
        full = statistics.median(ms for ms, _ in samples["full"])
        scoped = statistics.median(ms for ms, _ in samples["scoped"])
        report[scenario] = {
            "full_cpu_ms": round(full, 3), "scoped_cpu_ms": round(scoped, 3),
            "ratio": round(scoped / full, 4), "budget": budget,
            "full_ack_ms": round(statistics.median(ack for _, ack in samples["full"]), 3),
            "scoped_ack_ms": round(statistics.median(ack for _, ack in samples["scoped"]), 3),
        }
    print(json.dumps({"issue": 1096, "fixture": "large-house", "repeats": 7, "scenarios": report}))
    for scenario, budget in BUDGET.items():
        if budget is not None:
            assert report[scenario]["ratio"] <= budget, (scenario, report[scenario])
