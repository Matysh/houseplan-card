"""#800: real HA entry/WS lifecycle with a deterministic, offline MQTT transport."""
from __future__ import annotations

import asyncio
import copy
import json
from types import SimpleNamespace

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import zigbee_topology as zigbee
from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import async_save_config_state


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def _until(predicate):
    # Entry background tasks deliberately do not participate in block_till_done.
    # Yield the loop, never actually wait ten/fifteen minutes in a witness.
    for _ in range(100):
        if predicate():
            return
        await asyncio.sleep(0)
    assert predicate(), "background state did not settle"


class Transport:
    def __init__(self):
        self.enabled = True
        self.connected = True
        self.callbacks = {}
        self.status_callbacks = set()
        self.subscribes = []
        self.unsubscribes = []
        self.published = []
        self.info_enabled = True
        self.ready_enabled = True
        self.ready_callbacks = set()
        self.publish_wait = None
        self.publish_response = None
        self.subscribe_wait = None
        self.late_subscribe = False
        self.publish_error = None
        self.subscribe_error = None
        # #1029 introduces an independent entry-owned passive feed. This
        # transport's failure controls/counts describe scan jobs only; the
        # passive feed has its own lifecycle/ACL witnesses in test_ha_zigbee_lqi.
        self.passive_callbacks = {}
        self.passive_status_callbacks = set()

    async def subscribe(self, _hass, topic, handler, *, qos, encoding):
        assert qos == 0 and encoding is None
        if topic.endswith("/bridge/devices"):
            self.passive_callbacks.setdefault(topic, set()).add(handler)
            return lambda: self.passive_callbacks[topic].discard(handler)
        self.subscribes.append(topic)
        if self.subscribe_error:
            raise self.subscribe_error
        if self.subscribe_wait is not None:
            try:
                await asyncio.shield(self.subscribe_wait)
            except asyncio.CancelledError:
                if not self.late_subscribe:
                    raise
                await asyncio.shield(self.subscribe_wait)
        self.callbacks.setdefault(topic, set()).add(handler)

        def remove():
            self.unsubscribes.append(topic)
            self.callbacks[topic].discard(handler)

        if topic.endswith("/bridge/info") and self.info_enabled:
            handler(SimpleNamespace(topic=topic, retain=True, payload=b'{"version":"2.14.2"}'))
        return remove

    def processed(self, _hass, _topic, qos, handler):
        assert qos == 0
        self.ready_callbacks.add(handler)
        if self.ready_enabled:
            handler()
        return lambda: self.ready_callbacks.discard(handler)

    def connection_status(self, _hass, handler):
        if type(getattr(handler, "__self__", None)).__name__ == "Z2mLqiReader":
            self.passive_status_callbacks.add(handler)
            return lambda: self.passive_status_callbacks.discard(handler)
        self.status_callbacks.add(handler)
        return lambda: self.status_callbacks.discard(handler)

    async def publish(self, _hass, topic, payload, *, qos, retain):
        assert qos == 0 and retain is False
        message = json.loads(payload)
        assert message["type"] == "raw" and message["routes"] is True
        self.published.append((topic, message))
        if self.publish_error:
            raise self.publish_error
        if self.publish_response is not None:
            self.respond(topic.removesuffix("/bridge/request/networkmap"),
                         message["transaction"], **self.publish_response)
        if self.publish_wait is not None:
            await asyncio.shield(self.publish_wait)

    def emit(self, topic, payload, *, retain=False):
        if not isinstance(payload, (str, bytes)):
            payload = json.dumps(payload).encode()
        for handler in tuple(self.callbacks.get(topic, ())):
            handler(SimpleNamespace(topic=topic, retain=retain, payload=payload))

    def respond(self, topic, transaction, *, status="ok", value=None, retain=False):
        message = {
            "transaction": transaction, "status": status,
            "data": {"value": value if value is not None else {
                "nodes": [{"ieeeAddr": "0x00124b0000000001", "type": "Coordinator", "networkAddress": 0}],
                "links": [],
            }},
        }
        self.emit(f"{topic}/bridge/response/networkmap", message, retain=retain)
        return message

    def disconnect(self):
        self.connected = False
        for handler in tuple(self.status_callbacks):
            handler(False)

    def reconnect(self):
        self.connected = True
        for handler in tuple(self.status_callbacks):
            handler(True)

    @property
    def listener_count(self):
        return sum(len(callbacks) for callbacks in self.callbacks.values())


@pytest.fixture
def transport(monkeypatch):
    value = Transport()
    monkeypatch.setattr(zigbee.mqtt, "mqtt_config_entry_enabled", lambda _hass: value.enabled)
    monkeypatch.setattr(zigbee.mqtt, "is_connected", lambda _hass: value.connected)
    monkeypatch.setattr(zigbee.mqtt, "async_subscribe", value.subscribe)
    monkeypatch.setattr(zigbee.mqtt, "async_on_subscribe_done", value.processed)
    monkeypatch.setattr(zigbee.mqtt, "async_subscribe_connection_status", value.connection_status)
    monkeypatch.setattr(zigbee.mqtt, "async_publish", value.publish)
    return value


@pytest.fixture
def clock(monkeypatch):
    value = SimpleNamespace(now=1000.0)
    monkeypatch.setattr(zigbee, "monotonic", lambda: value.now)
    monkeypatch.setattr(zigbee, "time", lambda: 1_800_000_000 + value.now)
    return value


async def _setup(hass, *, options=None):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = entry.runtime_data
    payload = await runtime.config_store.async_load() or {}
    config = copy.deepcopy(payload.get("config") or {})
    config.setdefault("spaces", [])
    config.setdefault("markers", [])
    config.setdefault("settings", {})["zigbee_topology"] = {"enabled": True}
    async with runtime.write_lock:
        await async_save_config_state(runtime, config, int(payload.get("rev", 0)) + 1)
    return entry, entry.runtime_data.zigbee_coordinator


async def _command(client, kind, **kwargs):
    await client.send_json_auto_id({"type": f"houseplan/zigbee/{kind}", **kwargs})
    while True:
        reply = await client.receive_json()
        if reply["type"] == "result":
            return reply


async def test_issue_912_success_survives_real_entry_reload_without_radio_scan(
    hass, hass_ws_client, transport, clock,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    state = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", state["job_id"])
    obtained = coordinator.snapshot("zigbee2mqtt")["provider"]["obtained_at"]
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    clock.now += 90_000
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    replacement = entry.runtime_data.zigbee_coordinator
    events = replacement.initial_events()
    restored = [event["provider"] for event in events if event["kind"] == "state"]
    assert len(restored) == 1, "successful map must survive entry reload"
    assert restored[0]["phase"] == "ready" and restored[0]["stale"] is True
    assert restored[0]["obtained_at"] == obtained
    assert restored[0]["result"]["data"]["value"]["nodes"][0]["networkAddress"] == 0
    assert len(transport.published) == 1 and transport.listener_count == 0
    assert replacement.session_id != coordinator.session_id


async def _durable(coordinator):
    return (await coordinator._store.async_load())["topics"]


@pytest.mark.parametrize("outcome", ["error", "cancel", "reload"])
async def test_issue_912_refresh_durably_forgets_old_map_even_when_replacement_fails(
    hass, hass_ws_client, transport, clock, outcome,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]
    old_callbacks = tuple(transport.callbacks["zigbee2mqtt/bridge/response/networkmap"])
    transport.respond("zigbee2mqtt", first["job_id"])
    await hass.async_block_till_done()
    saved = await _durable(coordinator)
    assert set(saved) == {"zigbee2mqtt"}
    serialized = json.dumps(saved)
    assert first["job_id"] not in serialized and "transaction" not in serialized
    assert not any(key in serialized for key in ("elapsed_ms", "session_id", "started_at"))
    refreshed = (await _start(client, transport))["provider"]
    assert "result" not in refreshed and await _durable(coordinator) == {}
    duplicate = await _command(client, "start", base_topic="zigbee2mqtt")
    assert duplicate["result"]["provider"]["job_id"] == refreshed["job_id"]
    assert len(transport.published) == 2
    if outcome == "error":
        transport.respond("zigbee2mqtt", refreshed["job_id"], status="error")
    elif outcome == "cancel":
        clock.now += 600
        assert (await _command(client, "cancel", base_topic="zigbee2mqtt",
                               job_id=refreshed["job_id"]))["success"]
    late = json.dumps({"transaction": first["job_id"], "status": "ok",
                       "data": {"value": {"nodes": [], "links": []}}}).encode()
    for old_callback in old_callbacks:
        old_callback(SimpleNamespace(topic="zigbee2mqtt/bridge/response/networkmap",
                                     payload=late, retain=False))
    assert "result" not in coordinator.snapshot("zigbee2mqtt")["provider"]
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    replacement = entry.runtime_data.zigbee_coordinator
    assert replacement.initial_events()[0]["topics"] == []
    assert await _durable(replacement) == {} and len(transport.published) == 2


async def test_issue_912_clear_must_finish_before_mqtt_and_replacement_is_durable(
    hass, hass_ws_client, transport, monkeypatch,
):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", first["job_id"])
    await hass.async_block_till_done()
    real_save = coordinator._store.async_save
    entered, release = asyncio.Event(), asyncio.Event()

    async def delayed_clear(data):
        entered.set()
        await release.wait()
        await real_save(data)

    monkeypatch.setattr(coordinator._store, "async_save", delayed_clear)
    command = hass.async_create_task(_command(client, "start", base_topic="zigbee2mqtt"))
    await entered.wait()
    assert not command.done() and len(transport.published) == 1
    assert "zigbee2mqtt" in await _durable(coordinator)
    release.set()
    refreshed = (await command)["result"]["provider"]
    await _until(lambda: len(transport.published) == 2)
    assert await _durable(coordinator) == {} and "result" not in refreshed
    transport.respond("zigbee2mqtt", refreshed["job_id"], value={"nodes": [], "links": []})
    await hass.async_block_till_done()
    assert (await _durable(coordinator))["zigbee2mqtt"]["map"] == {"nodes": [], "links": []}
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["persistence"] == "saved"


async def test_issue_912_clear_failure_refuses_refresh_and_saved_off_without_publish(
    hass, hass_ws_client, transport, monkeypatch,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", first["job_id"])
    await hass.async_block_till_done()
    before = copy.deepcopy(await _durable(coordinator))

    async def fail_save(_data):
        raise OSError("disk full")

    monkeypatch.setattr(coordinator._store, "async_save", fail_save)
    refused = await _command(client, "start", base_topic="zigbee2mqtt")
    assert not refused["success"] and refused["error"]["code"] == "storage_clear"
    assert len(transport.published) == 1 and await _durable(coordinator) == before
    runtime = entry.runtime_data
    previous = await runtime.config_store.async_load()
    off = copy.deepcopy(previous["config"])
    off["settings"]["zigbee_topology"]["enabled"] = False
    with pytest.raises(zigbee.ZigbeeScanError, match="storage_clear"):
        async with runtime.write_lock:
            await async_save_config_state(runtime, off, previous["rev"] + 1)
    assert await runtime.config_store.async_load() == previous
    assert await _durable(coordinator) == before
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": off,
                                   "expected_rev": previous["rev"]})
    public = await client.receive_json()
    assert not public["success"] and public["error"]["code"] == "storage_clear", public
    assert await runtime.config_store.async_load() == previous
    assert await _durable(coordinator) == before and len(transport.published) == 1


async def test_issue_912_failed_success_save_is_honest_and_never_promises_reload_survival(
    hass, hass_ws_client, transport, monkeypatch,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]

    async def fail_save(_data):
        raise OSError("disk full")

    monkeypatch.setattr(coordinator._store, "async_save", fail_save)
    transport.respond("zigbee2mqtt", first["job_id"])
    await hass.async_block_till_done()
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["phase"] == "ready" and "result" in state and state["persistence"] == "failed"
    assert await _durable(coordinator) == {}
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    assert entry.runtime_data.zigbee_coordinator.initial_events()[0]["topics"] == []


async def test_issue_912_only_saved_off_clears_all_topics_and_fences_old_callbacks(
    hass, hass_ws_client, transport,
):
    entry, coordinator = await _setup(hass)
    first_client = await hass_ws_client(hass)
    second_client = await hass_ws_client(hass)
    first = (await _start(first_client, transport, topic="mesh-a"))["provider"]
    transport.respond("mesh-a", first["job_id"])
    second = (await _start(first_client, transport, topic="mesh-b"))["provider"]
    callbacks = tuple(transport.callbacks["mesh-b/bridge/response/networkmap"])
    await hass.async_block_till_done()
    runtime = entry.runtime_data
    previous = await runtime.config_store.async_load()
    draft = copy.deepcopy(previous["config"])
    draft["settings"]["zigbee_topology"]["enabled"] = False
    # A local draft, including closing its dialog, does not invoke a server writer.
    assert set(await _durable(coordinator)) == {"mesh-a"}
    assert coordinator.snapshot("mesh-b")["provider"]["phase"] == "loading"
    async with runtime.write_lock:
        await async_save_config_state(runtime, draft, previous["rev"] + 1)
    assert await _durable(coordinator) == {} and coordinator.initial_events()[0]["topics"] == []
    late = json.dumps({"transaction": second["job_id"], "status": "ok",
                       "data": {"value": {"nodes": [], "links": []}}}).encode()
    for old_callback in callbacks:
        old_callback(SimpleNamespace(topic="mesh-b/bridge/response/networkmap", payload=late, retain=False))
    refused = await _command(second_client, "start", base_topic="mesh-a")
    assert not refused["success"] and refused["error"]["code"] == "disabled"
    async with runtime.write_lock:
        await async_save_config_state(runtime, previous["config"], previous["rev"] + 2)
    assert coordinator.initial_events()[0]["topics"] == [] and await _durable(coordinator) == {}
    assert len(transport.published) == 2 and transport.listener_count == 0


async def test_issue_912_topic_removal_keeps_exact_cache_and_reload_does_not_scan(
    hass, hass_ws_client, transport,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    for topic in ("mesh-a", "mesh-b"):
        job = (await _start(client, transport, topic=topic))["provider"]
        transport.respond(topic, job["job_id"])
    await hass.async_block_till_done()
    before = copy.deepcopy(await _durable(coordinator))
    runtime = entry.runtime_data
    current = await runtime.config_store.async_load()
    candidate = copy.deepcopy(current["config"])
    candidate["settings"]["zigbee_topology"]["z2m_base_topics"] = ["mesh-a"]
    async with runtime.write_lock:
        await async_save_config_state(runtime, candidate, current["rev"] + 1)
    assert await _durable(coordinator) == before
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    replacement = entry.runtime_data.zigbee_coordinator
    assert set(replacement.initial_events()[0]["topics"]) == {"mesh-a", "mesh-b"}
    assert await _durable(replacement) == before and len(transport.published) == 2


@pytest.mark.parametrize("corruption", ["future", "foreign", "topic", "nodes", "time"])
@pytest.mark.parametrize("action", ["refresh", "off"])
async def test_issue_912_invalid_store_is_preserved_until_explicit_recovery(
    hass, hass_ws_client, transport, monkeypatch, corruption, action,
):
    entry, coordinator = await _setup(hass)
    payload = {"schema": 1, "entry_id": entry.entry_id, "topics": {
        "mesh-a": {"obtained_at": 1234, "map": {"nodes": [], "links": []}},
    }}
    if corruption == "future":
        payload["schema"] = 2
    elif corruption == "foreign":
        payload["entry_id"] = "another-entry"
    elif corruption == "topic":
        payload["topics"]["bad/#"] = payload["topics"].pop("mesh-a")
    elif corruption == "nodes":
        payload["topics"]["mesh-a"]["map"]["nodes"] = [{}]
    else:
        payload["topics"]["mesh-a"]["obtained_at"] = True
    await coordinator._store.async_save(payload)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    replacement = entry.runtime_data.zigbee_coordinator
    assert replacement.initial_events()[0]["error"] == "storage_read"
    assert await replacement._store.async_load() == payload
    assert not transport.published and not transport.subscribes

    client = await hass_ws_client(hass)
    runtime = entry.runtime_data
    previous = await runtime.config_store.async_load()
    off = copy.deepcopy(previous["config"])
    off["settings"]["zigbee_topology"]["enabled"] = False

    async def recover():
        if action == "refresh":
            return await _command(client, "start", base_topic="mesh-b")
        await client.send_json_auto_id({"type": "houseplan/config/set", "config": off,
                                       "expected_rev": previous["rev"]})
        return await client.receive_json()

    real_save = replacement._store.async_save
    writes = 0

    async def fail_save(_data):
        nonlocal writes
        writes += 1
        raise OSError("disk full")

    monkeypatch.setattr(replacement._store, "async_save", fail_save)
    refused = await recover()
    assert not refused["success"] and refused["error"]["code"] == "storage_clear"
    assert writes == 1, "an explicit action must attempt I/O despite the earlier read error"
    assert await replacement._store.async_load() == payload
    assert await runtime.config_store.async_load() == previous
    assert not transport.published and not transport.subscribes

    monkeypatch.setattr(replacement._store, "async_save", real_save)
    accepted = await recover()
    assert accepted["success"], accepted
    assert "error" not in replacement.initial_events()[0]
    assert await _durable(replacement) == {}
    if action == "refresh":
        job = accepted["result"]["provider"]
        await _until(lambda: len(transport.published) == 1)
        transport.respond("mesh-b", job["job_id"])
        await hass.async_block_till_done()
        assert replacement.snapshot("mesh-b")["provider"]["persistence"] == "saved"
        assert set(await _durable(replacement)) == {"mesh-b"}
    else:
        assert not (await runtime.config_store.async_load())["config"]["settings"]["zigbee_topology"]["enabled"]
        assert not transport.published and not transport.subscribes

    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    restored = entry.runtime_data.zigbee_coordinator
    assert "error" not in restored.initial_events()[0]
    assert restored.initial_events()[0]["topics"] == (["mesh-b"] if action == "refresh" else [])
    assert len(transport.published) == (1 if action == "refresh" else 0)


async def _start(client, transport, *, topic="zigbee2mqtt"):
    reply = await _command(client, "start", base_topic=topic)
    assert reply["success"], reply
    envelope = reply["result"]
    await _until(lambda: any(message["transaction"] == envelope["provider"]["job_id"]
                            for _topic, message in transport.published))
    return envelope


async def test_issue_800_background_15_minutes_two_clients_and_reopen(
    hass, hass_ws_client, transport, clock, monkeypatch,
):
    entry, coordinator = await _setup(hass)
    first, second = await hass_ws_client(hass), await hass_ws_client(hass)
    subscribed = await _command(first, "subscribe")
    assert subscribed["success"]
    initial = (await first.receive_json())["event"]
    assert initial == {"kind": "reset", "session_id": coordinator.session_id,
                       "revision": 0, "topics": []}
    started = await _start(first, transport, topic=" /zigbee2mqtt// ")
    joined = await _command(second, "start", base_topic="zigbee2mqtt")
    assert joined["result"]["provider"]["job_id"] == started["provider"]["job_id"]
    assert joined["result"]["provider"]["started_at"] == started["provider"]["started_at"]
    await first.close()
    await second.close()
    await hass.async_block_till_done()
    assert len(transport.published) == 1 and not coordinator._listeners
    await _until(lambda: coordinator.snapshot("zigbee2mqtt")["provider"]["stage"] == "waiting")

    # Advance actual event-loop deadlines too, not only the displayed elapsed
    # counter. A reintroduced asyncio.timeout(600) must run and fail this witness.
    original_loop_time, clock_start = hass.loop.time, clock.now
    with monkeypatch.context() as timers:
        timers.setattr(hass.loop, "time", lambda: original_loop_time() + clock.now - clock_start)
        clock.now += 600
        for _ in range(4):
            await asyncio.sleep(0)
        await hass.async_block_till_done()
        assert coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading"
        clock.now += 300
        for _ in range(4):
            await asyncio.sleep(0)
        waiting = coordinator.snapshot("zigbee2mqtt")["provider"]
        assert waiting["elapsed_ms"] == 900_000 and waiting["phase"] == "loading"
        answer = transport.respond("zigbee2mqtt", waiting["job_id"])
    await _until(lambda: not coordinator._operations)
    assert transport.listener_count == 0 and not transport.status_callbacks

    reopened = await hass_ws_client(hass)
    assert (await _command(reopened, "subscribe"))["success"]
    reset, state = (await reopened.receive_json())["event"], (await reopened.receive_json())["event"]
    assert reset["topics"] == ["zigbee2mqtt"] and reset["revision"] == state["revision"]
    assert state["session_id"] == started["session_id"]
    provider = state["provider"]
    assert provider["phase"] == "ready" and provider["result"] == answer
    assert provider["elapsed_ms"] == 900_000
    assert provider["obtained_at"] > provider["started_at"]
    assert len(transport.published) == 1
    # Operational maps never become persisted plan/config data.
    config = await entry.runtime_data.config_store.async_load()
    assert "transaction" not in json.dumps(config)


async def test_issue_800_cancel_boundary_old_id_late_reply_and_last_good(
    hass, hass_ws_client, transport, clock,
):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = await _start(client, transport)
    transport.respond("zigbee2mqtt", first["provider"]["job_id"])
    await _until(lambda: not coordinator._operations)
    refresh = await _start(client, transport)
    job_id = refresh["provider"]["job_id"]
    callbacks = tuple(transport.callbacks["zigbee2mqtt/bridge/response/networkmap"])
    clock.now += 599
    early = await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job_id)
    assert early["success"] is False and early["error"]["code"] == "conflict"
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading"
    clock.now += 1
    cancelled = (await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job_id))["result"]
    assert cancelled["provider"]["phase"] == "cancelled"
    assert "result" not in cancelled["provider"] and "obtained_at" not in cancelled["provider"]
    assert cancelled["provider"]["elapsed_ms"] == 600_000
    assert (await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job_id))["result"] == cancelled
    assert transport.listener_count == 0

    newer = await _start(client, transport)
    assert "result" not in newer["provider"]
    # The new job is itself cancellable: only job-id correlation may reject
    # this stale command, not the unrelated ten-minute threshold.
    clock.now += 600
    stale = await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job_id)
    assert stale["success"] is False
    late = json.dumps({"transaction": job_id, "status": "ok", "data": {"value": {"nodes": [], "links": []}}}).encode()
    for callback in callbacks:
        callback(SimpleNamespace(topic="zigbee2mqtt/bridge/response/networkmap", payload=late, retain=False))
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["job_id"] == newer["provider"]["job_id"]
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading"
    assert "result" not in coordinator.snapshot("zigbee2mqtt")["provider"]


@pytest.mark.parametrize("first", ["success", "cancel"])
async def test_issue_800_success_cancel_race_has_one_terminal_state(
    hass, hass_ws_client, transport, clock, first,
):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    job = (await _start(client, transport))["provider"]
    clock.now += 600
    if first == "success":
        transport.respond("zigbee2mqtt", job["job_id"])
        final = (await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job["job_id"]))["result"]
        assert final["provider"]["phase"] == "ready"
    else:
        final = (await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job["job_id"]))["result"]
        transport.respond("zigbee2mqtt", job["job_id"])
        assert final["provider"]["phase"] == "cancelled"
    assert coordinator.snapshot("zigbee2mqtt") == final
    assert transport.listener_count == 0


@pytest.mark.parametrize("status,expected", [("ok", "ready"), ("error", "error"), ("failed", "error")])
async def test_issue_800_immediate_reply_wins_over_hanging_publish(
    hass, hass_ws_client, transport, status, expected,
):
    _entry, coordinator = await _setup(hass)
    transport.publish_wait = hass.loop.create_future()
    transport.publish_response = {"status": status}
    client = await hass_ws_client(hass)
    await _start(client, transport)
    await _until(lambda: coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] != "loading")
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["phase"] == expected
    if expected == "error":
        assert state["error"] == "provider" and "result" not in state
    await _until(lambda: not coordinator._operations)
    assert transport.listener_count == 0 and not transport.status_callbacks
    transport.publish_wait.set_result(None)


async def test_issue_800_foreign_retained_oversized_and_garbage_cannot_replace_cache(
    hass, hass_ws_client, transport,
):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", first["job_id"])
    refresh = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", "foreign")
    transport.respond("zigbee2mqtt", refresh["job_id"], retain=True)
    topic = "zigbee2mqtt/bridge/response/networkmap"
    transport.emit(topic, b"{" + b" " * zigbee.MAX_PAYLOAD_BYTES)
    # Valid correlated JSON/map over the byte cap must not become last-good.
    transport.emit(topic, {"transaction": refresh["job_id"], "status": "ok",
                           "data": {"value": {"nodes": [], "links": []}},
                           "padding": "x" * zigbee.MAX_PAYLOAD_BYTES})
    transport.emit(topic, b"not-json")
    transport.emit(topic, {"status": "error"})
    still_waiting = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert still_waiting["phase"] == "loading" and "result" not in still_waiting
    transport.respond("zigbee2mqtt", refresh["job_id"], value={"nodes": "not an array", "links": []})
    failed = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert failed["phase"] == "error" and failed["error"] == "invalid_payload"
    assert "result" not in failed and "obtained_at" not in failed
    assert transport.listener_count == 0


@pytest.mark.parametrize("value", [
    {}, {"nodes": [], "links": None}, {"nodes": [{}], "links": []},
    {"nodes": [], "links": [None]}, {"nodes": [], "links": [{}]},
    {"nodes": [{"ieeeAddr": "0x00124b0000000001"}] * 1001, "links": []},
    {"nodes": [], "links": [{"source": 0, "target": 1}] * 6001},
])
async def test_issue_800_correlated_invalid_shapes_are_terminal(hass, hass_ws_client, transport, value):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    job = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", job["job_id"], value=value)
    provider = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert provider["phase"] == "error" and provider["error"] == "invalid_payload"
    assert "result" not in provider


async def test_issue_800_mqtt_disconnect_is_terminal_without_retry(hass, hass_ws_client, transport):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _start(client, transport))["provider"]
    transport.respond("zigbee2mqtt", first["job_id"])
    await _start(client, transport)
    transport.disconnect()
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["phase"] == "error" and state["error"] == "connection"
    assert "result" not in state and "obtained_at" not in state
    assert transport.listener_count == 0 and not transport.status_callbacks
    transport.reconnect()
    await hass.async_block_till_done()
    assert len(transport.published) == 2
    assert coordinator.snapshot("zigbee2mqtt")["provider"] == state


@pytest.mark.parametrize("operation", ["subscribe", "info", "readiness", "publish"])
async def test_issue_800_transport_timeouts_do_not_leave_listeners(
    hass, hass_ws_client, transport, monkeypatch, operation,
):
    _entry, coordinator = await _setup(hass)
    monkeypatch.setattr(zigbee, "TRANSPORT_TIMEOUT", .01)
    monkeypatch.setattr(zigbee, "INFO_TIMEOUT", .01)
    if operation == "subscribe":
        transport.subscribe_wait = hass.loop.create_future()
    elif operation == "info":
        transport.info_enabled = False
    elif operation == "readiness":
        transport.ready_enabled = False
    else:
        transport.publish_wait = hass.loop.create_future()
    client = await hass_ws_client(hass)
    assert (await _command(client, "start", base_topic="zigbee2mqtt"))["success"]
    async with asyncio.timeout(1):
        while coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading":
            await asyncio.sleep(.002)
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["phase"] == "error" and state["error"] == "timeout"
    await _until(lambda: not coordinator._operations)
    assert transport.listener_count == 0 and not transport.ready_callbacks
    assert not transport.status_callbacks
    assert len(transport.published) == (1 if operation == "publish" else 0)


async def test_issue_800_late_subscribe_cleanup_after_transport_timeout(
    hass, hass_ws_client, transport, monkeypatch,
):
    _entry, coordinator = await _setup(hass)
    monkeypatch.setattr(zigbee, "TRANSPORT_TIMEOUT", .01)
    transport.subscribe_wait = hass.loop.create_future()
    transport.late_subscribe = True
    client = await hass_ws_client(hass)
    await _command(client, "start", base_topic="zigbee2mqtt")
    async with asyncio.timeout(1):
        while coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading":
            await asyncio.sleep(.002)
    transport.subscribe_wait.set_result(None)
    await _until(lambda: not coordinator._operations)
    assert transport.listener_count == 0
    assert transport.unsubscribes == ["zigbee2mqtt/bridge/response/networkmap"]
    assert not transport.published


async def test_issue_800_old_ha_without_readiness_helper_still_scans(
    hass, hass_ws_client, transport, monkeypatch,
):
    monkeypatch.delattr(zigbee.mqtt, "async_on_subscribe_done")
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    state = (await _start(client, transport))["provider"]
    assert transport.subscribes == ["zigbee2mqtt/bridge/response/networkmap", "zigbee2mqtt/bridge/info"]
    transport.respond("zigbee2mqtt", state["job_id"])
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "ready"


async def test_issue_912_eight_slots_never_evict_a_successful_map(
    hass, hass_ws_client, transport,
):
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    events = []
    remove = coordinator.add_listener(events.append)
    for index in range(8):
        await _start(client, transport, topic=f"mesh{index}")
    rejected = await _command(client, "start", base_topic="ninth")
    assert rejected["success"] is False and rejected["error"]["code"] == "capacity_exceeded"
    assert len(transport.published) == 8
    third = coordinator.snapshot("mesh3")["provider"]
    transport.respond("mesh3", third["job_id"])
    rejected = await _command(client, "start", base_topic="ninth")
    assert rejected["success"] is False and rejected["error"]["code"] == "capacity_exceeded"
    assert len(coordinator._jobs) == 8 and "mesh3" in coordinator._jobs
    removed = [event for event in events if event["kind"] == "removed"]
    assert removed == []
    assert all(coordinator.snapshot(f"mesh{index}")["provider"]["phase"] == "loading"
               for index in range(8) if index != 3)
    assert [event["revision"] for event in events] == sorted({event["revision"] for event in events})
    remove()


async def test_issue_800_real_websocket_permissions_and_invalid_topics(
    hass, hass_ws_client, transport,
):
    _entry, _coordinator = await _setup(hass, options={"admin_only": False})
    user = await hass.auth.async_create_user("Household", group_ids=[GROUP_ID_USER])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    client = await hass_ws_client(hass, hass.auth.async_create_access_token(refresh))
    for kind, fields in [("subscribe", {}), ("start", {"base_topic": "mesh"}),
                         ("cancel", {"base_topic": "mesh", "job_id": "old"})]:
        reply = await _command(client, kind, **fields)
        assert reply["success"] is False and reply["error"]["code"] == "unauthorized"
    admin = await hass_ws_client(hass)
    for topic in ("/", "mesh/#", "mesh/+", "mesh\x00", "a" * 181, 42):
        reply = await _command(admin, "start", base_topic=topic)
        assert reply["success"] is False
    assert not transport.published and not transport.subscribes
    # Unsaved draft topics remain valid: checking before Save is existing UX.
    await _start(admin, transport, topic="new-unsaved-topic")


async def test_issue_800_entry_unload_clears_jobs_and_new_entry_session_is_idle(
    hass, hass_ws_client, transport,
):
    entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    subscription = await _command(client, "subscribe")
    assert subscription["success"]
    assert (await client.receive_json())["event"]["kind"] == "reset"
    await _start(client, transport)
    previous_revision = coordinator.revision
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert coordinator.closed and not coordinator._jobs
    assert transport.listener_count == 0 and not transport.status_callbacks
    async with asyncio.timeout(1):
        while True:
            event = (await client.receive_json())["event"]
            if event["kind"] == "closed":
                break
    assert event == {"kind": "closed", "session_id": coordinator.session_id,
                     "revision": previous_revision + 1}
    # The same live socket can retire its old feed, then attach to the next
    # loaded entry. Receiving closed never publishes an automatic replacement.
    await client.send_json_auto_id({"type": "unsubscribe_events", "subscription": subscription["id"]})
    assert (await client.receive_json())["success"]
    refused = await _command(client, "subscribe")
    assert refused["success"] is False and refused["error"]["code"] == "not_ready"
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    replacement = entry.runtime_data.zigbee_coordinator
    assert replacement.session_id != coordinator.session_id
    assert replacement.initial_events()[0]["topics"] == []
    assert len(transport.published) == 1
    assert (await _command(client, "subscribe"))["success"]
    reset = (await client.receive_json())["event"]
    assert reset == {"kind": "reset", "session_id": replacement.session_id,
                     "revision": 0, "topics": []}
    restarted = await _start(client, transport)
    assert restarted["session_id"] == replacement.session_id
    assert len(transport.published) == 2


async def test_issue_800_missing_mqtt_is_optional_and_reports_unavailable(
    hass, hass_ws_client, transport,
):
    transport.enabled = False
    _entry, coordinator = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    assert (await client.receive_json())["result"]["zigbee_scan_api"] == 1
    assert (await _command(client, "start", base_topic="zigbee2mqtt"))["success"]
    await _until(lambda: coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "error")
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["error"] == "unsupported"
    assert not transport.published


async def test_issue_800_ha_stop_releases_entry_jobs(hass, transport):
    _entry, coordinator = await _setup(hass)
    await coordinator.start("zigbee2mqtt")
    await _until(lambda: bool(transport.published))
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
    await hass.async_block_till_done()
    assert coordinator.closed and not coordinator._jobs
    assert transport.listener_count == 0 and not transport.status_callbacks
    assert not coordinator._operations


@pytest.mark.parametrize("operation", ["subscribe", "publish"])
async def test_issue_800_transport_exception_is_terminal_and_releases_listeners(
    hass, hass_ws_client, transport, operation,
):
    _entry, coordinator = await _setup(hass)
    setattr(transport, f"{operation}_error", RuntimeError("synthetic transport failure"))
    client = await hass_ws_client(hass)
    await _command(client, "start", base_topic="zigbee2mqtt")
    await _until(lambda: coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "error")
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["error"] == "connection" and "result" not in state
    assert transport.listener_count == 0 and not transport.status_callbacks


async def test_issue_800_late_transport_acknowledgements_are_globally_bounded(
    hass, hass_ws_client, transport, monkeypatch,
):
    _entry, coordinator = await _setup(hass)
    monkeypatch.setattr(zigbee, "TRANSPORT_TIMEOUT", .001)
    transport.subscribe_wait = hass.loop.create_future()
    transport.late_subscribe = True
    client = await hass_ws_client(hass)
    # Reusing one topic must not bypass the resource cap with timed-out tasks.
    for _ in range(8):
        assert (await _command(client, "start", base_topic="zigbee2mqtt"))["success"]
        async with asyncio.timeout(1):
            while coordinator.snapshot("zigbee2mqtt")["provider"]["phase"] == "loading":
                await asyncio.sleep(.001)
    denied = await _command(client, "start", base_topic="zigbee2mqtt")
    assert not denied["success"] and denied["error"]["code"] == "capacity_exceeded"
    assert len(coordinator._operations) == 8
    transport.subscribe_wait.set_result(None)
    await _until(lambda: not coordinator._operations)
    assert transport.listener_count == 0 and len(transport.unsubscribes) == 8


def test_issue_800_payload_byte_limit_depth_and_finite_numbers():
    assert zigbee._parse_payload(b'{"valid":true}') == {"valid": True}
    exact = b'{"padding":"' + b'x' * (zigbee.MAX_PAYLOAD_BYTES - 14) + b'"}'
    assert len(exact) == zigbee.MAX_PAYLOAD_BYTES
    assert zigbee._parse_payload(exact) is not None
    assert zigbee._parse_payload(exact + b' ') is None
    assert zigbee._parse_payload('{"text":"' + "я" * (zigbee.MAX_PAYLOAD_BYTES // 2) + '"}') is None
    assert zigbee._parse_payload(b'{"n":NaN}') is None
    assert zigbee._parse_payload(b'{"n":1e10000}') is None
    assert zigbee._parse_payload(b'{"a":' + b'[' * 34 + b'0' + b']' * 34 + b'}') is None
    assert zigbee._parse_payload(b"\xff") is None


def test_issue_800_map_shape_preserves_upstream_data_without_resolving_routes():
    raw = {"nodes": [{"ieeeAddr": "0x00124b0000000001", "type": "Router"}],
           "links": [{"source": {"ieeeAddr": "0x00124b0000000001"},
                      "target": 0, "routes": [{"destinationAddress": 0, "status": "ACTIVE"}]}]}
    message = {"status": "ok", "data": {"value": raw}}
    before = copy.deepcopy(message)
    assert zigbee._valid_map(message)
    assert zigbee._valid_map({"data": {"value": json.dumps(raw)}})
    assert message == before
