"""#1113: real HA viewer permissions and this integration's fixed subscription."""
from __future__ import annotations

import copy

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.external_screens_websocket import EVENT, TYPE


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def setup(hass, hass_ws_client, group=GROUP_ID_READ_ONLY):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    admin = await hass_ws_client(hass)
    user = await hass.auth.async_create_user("Profile screen", group_ids=[group])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    viewer = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    await admin.send_json_auto_id({"type": "houseplan/config/get"})
    full = (await admin.receive_json())["result"]
    return admin, viewer, user, full


async def subscribe(viewer, base):
    await viewer.send_json_auto_id({"type": TYPE, "base_rev": base})
    result = await viewer.receive_json()
    assert result["success"] is True
    return result["id"], (await viewer.receive_json())["event"]


async def write(admin, config, rev):
    await admin.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": rev})
    result = await admin.receive_json()
    assert result["success"] is True, result
    return result["result"]["rev"]


def profiles(config):
    config = copy.deepcopy(config)
    config.setdefault("settings", {})["external_screens"] = {
        "version": 1, "next_id": 2, "screens": [{
            "id": 1, "space": None, "rotation": 90, "cycle": 0, "idle": 0,
            "summary": "local", "hidden_devices": "local", "icon_scale": None,
            "font_scale": None, "controls": True,
        }],
    }
    return config


@pytest.mark.parametrize("group", [GROUP_ID_USER, GROUP_ID_READ_ONLY])
async def test_profile_stream_real_viewer_receives_exact_patch_and_unsubscribes(hass, hass_ws_client, group):
    admin, viewer, _, full = await setup(hass, hass_ws_client, group)
    assert full["external_screens_events_api"] == 1
    count = hass.bus.async_listeners().get(EVENT, 0)
    ident, initial = await subscribe(viewer, full["rev"])
    assert initial == {"kind": "ready", "rev": full["rev"]}
    assert hass.bus.async_listeners().get(EVENT, 0) == count + 1
    config = profiles(full["config"])
    rev = await write(admin, config, full["rev"])
    event = (await viewer.receive_json())["event"]
    assert event == {"rev": rev, "external_screens_update": {
        "version": 1, "base_rev": full["rev"], "value": config["settings"]["external_screens"],
    }}
    await viewer.send_json_auto_id({"type": "unsubscribe_events", "subscription": ident})
    assert (await viewer.receive_json())["success"] is True
    await hass.async_block_till_done()
    assert hass.bus.async_listeners().get(EVENT, 0) == count


async def test_profile_stream_initial_projection_does_not_claim_a_full_revision(hass, hass_ws_client):
    admin, viewer, _, full = await setup(hass, hass_ws_client)
    config = profiles(full["config"])
    rev = await write(admin, config, full["rev"])
    _, initial = await subscribe(viewer, full["rev"])
    assert initial == {"kind": "resync", "rev": rev}
    assert "external_screens_update" not in initial and "config" not in initial
    changed = copy.deepcopy(config)
    changed["settings"]["external_screens"]["screens"][0]["rotation"] = 270
    changed["settings"]["show_lqi"] = not bool(config["settings"].get("show_lqi"))
    next_rev = await write(admin, changed, rev)
    assert (await viewer.receive_json())["event"] == {"rev": next_rev}


async def test_profile_stream_does_not_grant_generic_or_arbitrary_ha_events(hass, hass_ws_client):
    admin, viewer, _, full = await setup(hass, hass_ws_client)
    for event in [EVENT, "private_foreign_event"]:
        await viewer.send_json_auto_id({"type": "subscribe_events", "event_type": event})
        assert (await viewer.receive_json())["error"]["code"] == "unauthorized"
    await viewer.send_json_auto_id({"type": TYPE, "base_rev": full["rev"], "event_type": "private_foreign_event"})
    assert (await viewer.receive_json())["success"] is False
    rev = await write(admin, profiles(full["config"]), full["rev"])
    await subscribe(viewer, rev)
    hass.bus.async_fire(EVENT, {"rev": rev, "secret": "not-a-profile",
        "external_screens_update": {"version": 1, "base_rev": rev - 1, "value": {"secret": "foreign"}}})
    event = (await viewer.receive_json())["event"]
    assert event == {"rev": rev}


async def test_profile_stream_revocation_and_disconnect_remove_own_listener(hass, hass_ws_client):
    _, viewer, user, full = await setup(hass, hass_ws_client)
    count = hass.bus.async_listeners().get(EVENT, 0)
    await subscribe(viewer, full["rev"])
    # Ordinary negative HA user-state input, as in the LQI subscription test.
    # Keep the socket open to exercise this delivery fence separately.
    user.is_active = False
    hass.bus.async_fire(EVENT, {"rev": full["rev"] + 1})
    assert (await viewer.receive_json())["event"] == {"kind": "closed"}
    assert hass.bus.async_listeners().get(EVENT, 0) == count
    await viewer.close()
    await hass.async_block_till_done()
    assert hass.bus.async_listeners().get(EVENT, 0) == count


async def test_profile_stream_bounded_subscriptions_and_invalid_base_inputs(hass, hass_ws_client):
    _, viewer, _, full = await setup(hass, hass_ws_client)
    count = hass.bus.async_listeners().get(EVENT, 0)
    for base in [-1, True, 0.5, "1", 2**53]:
        await viewer.send_json_auto_id({"type": TYPE, "base_rev": base})
        assert (await viewer.receive_json())["success"] is False
    for _ in range(4):
        await subscribe(viewer, full["rev"])
    await viewer.send_json_auto_id({"type": TYPE, "base_rev": full["rev"]})
    assert (await viewer.receive_json())["error"]["code"] == "rate_limited"
    await viewer.close()
    await hass.async_block_till_done()
    assert hass.bus.async_listeners().get(EVENT, 0) == count
