"""#1101: space/delete CPU work is off-loop while its write lock stays held."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import threading

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data
from custom_components.houseplan import websocket_api as ws


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


async def _seed(hass, hass_ws_client, config):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({
        "type": "houseplan/config/set", "config": config, "expected_rev": 0,
    })
    saved = await client.receive_json()
    assert saved["success"], saved
    return client, saved["result"]["rev"]


async def test_issue_1101_space_delete_large_house_cpu_runs_in_executor(
    hass, hass_ws_client, monkeypatch,
):
    result = await hass.async_add_executor_job(lambda: subprocess.run(
        ["node", "--input-type=module", "--eval",
         "import {makeLargeHouseFixture} from './demo/fixtures/large-house.mjs';"
         "process.stdout.write(JSON.stringify(makeLargeHouseFixture().config));"],
        cwd=Path(__file__).resolve().parents[1], check=True, capture_output=True, text=True,
    ))
    config = json.loads(result.stdout)
    client, rev = await _seed(hass, hass_ws_client, config)
    loop_thread = threading.get_ident()
    calls = []
    for name in ("_space_delete_target", "CONFIG_SCHEMA", "LAYOUT_SCHEMA",
                 "canonicalize_config_geometry", "canonicalize_layout_geometry"):
        original = getattr(ws, name)

        def checked(*args, _name=name, _original=original, **kwargs):
            assert threading.get_ident() != loop_thread, f"{_name} ran on the event loop"
            assert get_data(hass).write_lock.locked(), "executor preparation lost write ownership"
            calls.append(_name)
            return _original(*args, **kwargs)

        monkeypatch.setattr(ws, name, checked)
    await client.send_json_auto_id({
        "type": "houseplan/space/delete", "space_id": config["spaces"][0]["id"],
        "remove_markers": True, "expected_config_rev": rev, "expected_layout_rev": 0,
    })
    deleted = await client.receive_json()
    assert deleted["success"], deleted
    assert set(calls) == {"_space_delete_target", "CONFIG_SCHEMA", "LAYOUT_SCHEMA",
                          "canonicalize_config_geometry", "canonicalize_layout_geometry"}


async def test_issue_1101_space_delete_keeps_lock_during_executor_before_competing_write(
    hass, hass_ws_client, monkeypatch,
):
    config = {"spaces": [
        {"id": "a", "title": "A", "rooms": [], "plan_url": None, "view_box": [0, 0, 1, 1]},
        {"id": "b", "title": "B", "rooms": [], "plan_url": None, "view_box": [0, 0, 1, 1]},
    ], "markers": [], "settings": {}}
    client, rev = await _seed(hass, hass_ws_client, config)
    contender = await hass_ws_client(hass)
    entered, release = asyncio.Event(), asyncio.Event()
    executor = hass.async_add_executor_job

    async def held_executor(fn, *args):
        if fn.__name__ == "_prepare_delete_cpu":
            assert get_data(hass).write_lock.locked()
            entered.set()
            await release.wait()
        return await executor(fn, *args)

    monkeypatch.setattr(hass, "async_add_executor_job", held_executor)
    await client.send_json_auto_id({
        "type": "houseplan/space/delete", "space_id": "a",
        "expected_config_rev": rev, "expected_layout_rev": 0,
    })
    await asyncio.wait_for(entered.wait(), 5)
    try:
        await contender.send_json_auto_id({
            "type": "houseplan/config/set", "config": copy.deepcopy(config), "expected_rev": rev,
        })
        reply = asyncio.create_task(contender.receive_json())
        await asyncio.sleep(0)
        assert get_data(hass).write_lock.locked()
        assert not reply.done()
    finally:
        release.set()
    deleted = await client.receive_json()
    assert deleted["success"], deleted
    rejected = await reply
    assert not rejected["success"] and rejected["error"]["code"] == "conflict", rejected