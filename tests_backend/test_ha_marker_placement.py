"""#1512 authenticated HA WebSocket and actual Store round trips."""
import copy
import pytest
from tests_backend.test_ha_config_set_scoped import _setup, _stored
from tests_backend.test_plan_commands import valid_service
from custom_components.houseplan.store import get_data, async_save_config_state, async_save_layout_state


@pytest.fixture(autouse=True)
def _integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("operation,change", [("save", {"tap_action": "more-info"}),
    ("save", {"size": .9}), ("save", {"size": .8}), ("optimize", {})])
async def test_legacy_marker_space_round_trip(hass, hass_ws_client, operation, change):
    await _setup(hass)
    runtime = get_data(hass)
    config = valid_service().storage.snapshot().config_data["config"]
    config["spaces"][0]["rooms"][0]["area"] = "garage"
    config["markers"] = [{"id": "sensor", "binding": "device:ble", "space": "gone",
        "area": "garage", "tap_action": "info", "size": 1}]
    layout = {"sensor": {"s": "floor", "x": .2134, "y": .6735},
              "foreign": {"s": "floor", "x": .8, "y": .2}}
    # Seed pre-fix storage, bypassing only the command whose recovery is tested.
    async with runtime.write_lock:
        await async_save_config_state(runtime, copy.deepcopy(config), 4, canonical=True)
        await async_save_layout_state(runtime, {}, copy.deepcopy(layout), 7)
    client = await hass_ws_client(hass)
    candidate = copy.deepcopy(config)
    candidate["markers"][0].update(change)
    message = ({"type": "houseplan/config/set", "expected_rev": 4} if operation == "save" else
        {"type": "houseplan/plan/optimize", "expected_config_rev": 4,
         "expected_layout_rev": 7, "layout": copy.deepcopy(layout)})
    await client.send_json_auto_id({**message, "config": candidate, "opening_features_api": 1})
    reply = await client.receive_json()
    assert reply["success"], reply
    stored = await _stored(client)
    marker = stored["config"]["markers"][0]
    assert marker["space"] == "floor"
    assert all(marker[k] == v for k, v in change.items())
    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    positions = await client.receive_json()
    assert positions["success"] and positions["result"]["layout"] == layout
