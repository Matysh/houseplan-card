"""#1075 diagnostic phases, using original authenticated WS and real HA Stores.

Observers delegate every call unchanged. No planner, guard or save is replaced
with a successful stub; wall time is reported, not a machine-specific budget.
"""
import copy
import json
import time

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("far_rooms", [0, 25])
async def test_issue_1075_actual_handler_phase_report(hass, hass_ws_client, monkeypatch, far_rooms):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    source = {"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 2, 1], "rooms": [],
        "partitions": [{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 15},
                       {"id": "b", "a": [1, 0], "b": [2, 0], "cm": 15}]}], "markers": [], "settings": {}}
    if far_rooms:
        source["spaces"].append({"id": "other", "title": "Other floor", "view_box": [0, 0, 10, 10], "rooms": [
            {"id": f"r{i}", "name": f"Room {i}", "area": None,
             "poly": [[i % 5, i // 5], [i % 5 + .8, i // 5], [i % 5 + .8, i // 5 + .8], [i % 5, i // 5 + .8]]}
            for i in range(far_rooms)]})
    source = commit_wall_segment_model(source)[0]
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": source, "expected_rev": 0})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    snapshot = (await client.receive_json())["result"]
    original = copy.deepcopy(snapshot["config"])
    rt, active, samples = get_data(hass), {}, []

    def sync_observer(owner, name, phase):
        original_call = getattr(owner, name)

        def measured(*args, **kwargs):
            started = time.perf_counter()
            try:
                return original_call(*args, **kwargs)
            finally:
                active[phase] = active.get(phase, 0) + (time.perf_counter() - started) * 1000

        monkeypatch.setattr(owner, name, measured)

    def async_observer(owner, name, phase):
        original_call = getattr(owner, name)

        async def measured(*args, **kwargs):
            started = time.perf_counter()
            try:
                return await original_call(*args, **kwargs)
            finally:
                active[phase] = active.get(phase, 0) + (time.perf_counter() - started) * 1000

        monkeypatch.setattr(owner, name, measured)

    class ObservedLock:
        def __init__(self, lock):
            self.lock = lock

        async def __aenter__(self):
            started = time.perf_counter()
            result = await self.lock.__aenter__()
            active["lock_wait"] = (time.perf_counter() - started) * 1000
            return result

        async def __aexit__(self, *args):
            return await self.lock.__aexit__(*args)

    monkeypatch.setattr(rt, "write_lock", ObservedLock(rt.write_lock))
    for name, phase in [("CONFIG_SCHEMA", "schema"), ("validate_wall_model_transition", "transition"),
                        ("validate_partition_opening_hosts", "hosts"), ("validate_opening_passages", "passages"),
                        ("validate_junction_limits", "junctions")]:
        sync_observer(endpoint, name, phase)
    if hasattr(endpoint, "prepare_node_delete"):
        sync_observer(endpoint, "prepare_node_delete", "candidate")
        from custom_components.houseplan.wall_node_delete import PreparedNodeDelete
        sync_observer(PreparedNodeDelete, "host_baseline", "host_baseline")
    else:
        sync_observer(endpoint, "node_delete_candidate", "candidate")
        sync_observer(endpoint, "node_delete_host_baseline", "host_baseline")
    for owner, name, phase in [(rt.config_store, "async_save", "persist"),
                              (endpoint, "_resolved_write_pair", "resolved_read"),
                              (endpoint, "async_save_config_state", "save_with_dependents"),
                              (endpoint, "_discard_optimizer_snapshot", "maintenance")]:
        async_observer(owner, name, phase)
    executor = hass.async_add_executor_job

    async def measured_executor(fn, *args):
        if fn.__name__ != "_validate_delete_cpu":
            return await executor(fn, *args)
        queued = time.perf_counter()

        def work():
            started = time.perf_counter()
            active["executor_wait"] = (started - queued) * 1000
            try:
                return fn(*args)
            finally:
                active["cpu_total"] = (time.perf_counter() - started) * 1000

        return await executor(work)

    monkeypatch.setattr(hass, "async_add_executor_job", measured_executor)
    for sample in range(6):
        for direction in ["apply", "undo"]:
            active.clear()
            started = time.perf_counter()
            await client.send_json_auto_id({"type": "houseplan/wall/node_delete", "space_id": "f",
                "expected_rev": snapshot["rev"], "intent": {"point": [1, 0]}, "direction": direction,
                **({"before_space": original["spaces"][0]} if direction == "undo" else {})})
            result = await client.receive_json()
            assert result["success"], result
            snapshot = result["result"]
            active["ack_total"] = (time.perf_counter() - started) * 1000
            active["dependent_save"] = active["save_with_dependents"] - active["persist"]
            samples.append({"sample": sample, "direction": direction, **{k: round(v, 3) for k, v in active.items()}})
            if direction == "undo":
                assert snapshot["config"] == original
    assert (await rt.config_store.async_load())["config"] == original
    print(json.dumps({"scene": f"two-segments+{far_rooms}-remote-rooms", "samples": samples}))
