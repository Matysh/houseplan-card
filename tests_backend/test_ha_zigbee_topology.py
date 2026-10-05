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

    async def subscribe(self, _hass, topic, handler, *, qos, encoding):
        assert qos == 0 and encoding is None
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
    return entry, entry.runtime_data.zigbee_coordinator


async def _command(client, kind, **kwargs):
    await client.send_json_auto_id({"type": f"houseplan/zigbee/{kind}", **kwargs})
    while True:
        reply = await client.receive_json()
        if reply["type"] == "result":
            return reply


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
    good = transport.respond("zigbee2mqtt", first["provider"]["job_id"])
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
    assert cancelled["provider"]["stale"] is True
    assert cancelled["provider"]["result"] == good
    assert cancelled["provider"]["elapsed_ms"] == 600_000
    assert (await _command(client, "cancel", base_topic="zigbee2mqtt", job_id=job_id))["result"] == cancelled
    assert transport.listener_count == 0

    newer = await _start(client, transport)
    assert newer["provider"]["stale"] is True
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
    assert coordinator.snapshot("zigbee2mqtt")["provider"]["result"] == good


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
    good = transport.respond("zigbee2mqtt", first["job_id"])
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
    assert still_waiting["phase"] == "loading" and still_waiting["result"] == good
    transport.respond("zigbee2mqtt", refresh["job_id"], value={"nodes": "not an array", "links": []})
    failed = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert failed["phase"] == "error" and failed["error"] == "invalid_payload"
    assert failed["result"] == good and failed["stale"] is True
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
    good = transport.respond("zigbee2mqtt", first["job_id"])
    await _start(client, transport)
    transport.disconnect()
    state = coordinator.snapshot("zigbee2mqtt")["provider"]
    assert state["phase"] == "error" and state["error"] == "connection"
    assert state["stale"] and state["result"] == good
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


async def test_issue_800_eight_slots_reject_ninth_active_and_evict_only_finished(
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
    await _start(client, transport, topic="ninth")
    assert len(coordinator._jobs) == 8 and "mesh3" not in coordinator._jobs
    removed = [event for event in events if event["kind"] == "removed"]
    assert [event["topic"] for event in removed] == ["mesh3"]
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
    coordinator.start("zigbee2mqtt")
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
