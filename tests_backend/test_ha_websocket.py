"""WebSocket API tests (CI): layout ops, config rev conflict, not_ready gate."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_layout_roundtrip(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert resp["success"] and resp["result"]["layout"] == {}

    await client.send_json_auto_id(
        {"type": "houseplan/layout/set", "layout": {"dev1": {"s": "f1", "x": 0.5, "y": 0.5}}}
    )
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id(
        {"type": "houseplan/layout/update", "device_id": "dev2", "pos": {"s": "f1", "x": 0.1, "y": 0.2}}
    )
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "houseplan/layout/delete", "device_id": "dev1"})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert set(resp["result"]["layout"]) == {"dev2"}


async def test_config_rev_conflict(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    cfg = {"spaces": [], "markers": [], "settings": {}}

    await client.send_json_auto_id({"type": "houseplan/config/set", "config": cfg, "expected_rev": 0})
    resp = await client.receive_json()
    assert resp["success"] and resp["result"]["rev"] == 1

    # stale expected_rev must be rejected with `conflict`
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": cfg, "expected_rev": 0})
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "conflict"

    await client.send_json_auto_id({"type": "houseplan/config/get"})
    resp = await client.receive_json()
    assert resp["result"]["rev"] == 1


async def test_not_ready_without_entry(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    """WS commands answer not_ready when the integration has no loaded entry."""
    # register only the WS commands, without an entry
    from custom_components.houseplan import websocket_api as hp_ws

    hp_ws.async_register(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "not_ready"


async def test_plan_set_validates(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "../evil", "ext": "png", "data": "aGk="}
    )
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "invalid_space_id"

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "s1", "ext": "png", "data": "%%%not-base64%%%"}
    )
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "invalid_data"

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "s1", "ext": "png", "data": "aGVsbG8="}
    )
    resp = await client.receive_json()
    assert resp["success"] and resp["result"]["url"].startswith("/api/houseplan/content/plans/_/s1.png?v=")


async def test_admin_check_fails_closed(hass, hass_ws_client):
    """audit B2/T4: with no config entry the policy is unknown — deny writes.

    This used to allow them: plan uploads slipped through during a reload.
    """
    from custom_components.houseplan import websocket_api as wsapi

    class _User:
        is_admin = False

    class _Conn:
        user = _User()

    # no entry at all → non-admin must be refused
    assert wsapi._check_write(hass, _Conn()) is False

    class _Admin:
        is_admin = True

    class _AdminConn:
        user = _Admin()

    assert wsapi._check_write(hass, _AdminConn()) is True


async def test_files_migrate_copies_and_reports_mapping(hass, hass_ws_client, tmp_path):
    """review CR-2/CR-3: migrate COPIES, never overwrites, and reports the mapping."""
    import os
    from custom_components.houseplan.const import FILES_DIR

    base = os.path.join(hass.config.path(FILES_DIR))
    src = os.path.join(base, "old1")
    dst = os.path.join(base, "new1")
    await hass.async_add_executor_job(lambda: os.makedirs(src, exist_ok=True))
    await hass.async_add_executor_job(lambda: os.makedirs(dst, exist_ok=True))
    await hass.async_add_executor_job(
        lambda: open(os.path.join(src, "m.pdf"), "wb").write(b"SOURCE")
    )
    # коллизия: в целевой папке уже есть ДРУГОЙ файл с тем же именем
    await hass.async_add_executor_job(
        lambda: open(os.path.join(dst, "m.pdf"), "wb").write(b"OTHER")
    )

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "houseplan/files/migrate",
                            "from_id": "old1", "to_id": "new1"})
    resp = await client.receive_json()
    assert resp["success"]
    mapping = resp["result"]["mapping"]
    assert mapping["m.pdf"] != "m.pdf"          # переименован, а не перезаписан
    # источник ещё на месте (копия, не перенос) и чужой файл не тронут
    assert await hass.async_add_executor_job(lambda: os.path.isfile(os.path.join(src, "m.pdf")))
    assert await hass.async_add_executor_job(
        lambda: open(os.path.join(dst, "m.pdf"), "rb").read()) == b"OTHER"
    assert await hass.async_add_executor_job(
        lambda: open(os.path.join(dst, mapping["m.pdf"]), "rb").read()) == b"SOURCE"

    # cleanup удаляет исходную папку — вызывается только после успешного сохранения
    await client.send_json({"id": 2, "type": "houseplan/files/cleanup", "marker_id": "old1"})
    resp2 = await client.receive_json()
    assert resp2["success"] and resp2["result"]["removed"] is True
    assert not await hass.async_add_executor_job(lambda: os.path.isdir(src))
