"""Config flow tests (run in CI with pytest-homeassistant-custom-component)."""
import json
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.storage import Store
from homeassistant.helpers.translation import async_get_translations
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN, PLAN_MODEL_VERSION
from custom_components.houseplan import previous_data

# Capture real disk I/O at collection time, before phcc's hass_storage fixture
# replaces Store I/O. Only House Plan stores use it; HA registries stay mocked.
_DISK_LOAD = Store._async_load
_DISK_WRITE = Store._async_write_data


@pytest.fixture(autouse=True)
def _isolated_disk(hass):
    mocked_load = Store._async_load
    mocked_write = Store._async_write_data

    async def load(store):
        return await (_DISK_LOAD if store.key in previous_data.STORE_KEYS else mocked_load)(store)

    async def write(store, data):
        return await (_DISK_WRITE if store.key in previous_data.STORE_KEYS else mocked_write)(store, data)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(Store, "_async_load", load)
        patch.setattr(Store, "_async_write_data", write)
        yield


@pytest.fixture
def hass_config_dir(tmp_path):
    return str(tmp_path)


def _seed(hass):
    root = Path(hass.config.config_dir)
    config = {"model_version": PLAN_MODEL_VERSION, "spaces": [{
        "id": "old", "title": "Old floor", "view_box": [0, 0, 1, 1], "rooms": [],
        "plan_url": "/api/houseplan/content/plans/_/old.svg",
    }], "markers": [], "settings": {"bg_mode": "static"}}
    payloads = [
        {"config": config, "rev": 7},
        {"layout": {"old-marker": {"x": 0.2, "y": 0.3}}, "rev": 3},
        {}, {},
    ]
    for key, data in zip(previous_data.STORE_KEYS, payloads, strict=True):
        path = root / ".storage" / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "version": 1, "minor_version": 1 if key == "houseplan.trails" else 2,
            "key": key, "data": data,
        }))
    for name in previous_data.DATA_DIRS:
        path = root / name / "nested" / "keep.bin"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"unchanged")
    (root / "houseplan/plans/old.svg").write_bytes(b'<svg xmlns="http://www.w3.org/2000/svg"/>')
    return root


def _snapshot(root):
    return {str(p.relative_to(root)): (p.read_bytes() if p.is_file() else None, p.stat().st_mtime_ns)
            for p in root.rglob("*") if p.is_file() or p.is_dir()}


def _active_bytes(root):
    return {str(p.relative_to(root)): p.read_bytes() for p in root.rglob("*")
            if p.is_file() and (p.name in previous_data.STORE_KEYS or "houseplan" in p.parts)}


async def _init(hass):
    return await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )


async def _choose(hass, result, choice):
    return await hass.config_entries.flow.async_configure(
        result["flow_id"], user_input={"next_step_id": choice}
    )


async def _finish(hass, result):
    created = await hass.config_entries.flow.async_configure(
        result["flow_id"], user_input={CONF_ADMIN_ONLY: True}
    )
    await hass.async_block_till_done()
    return created


async def _ws_get(hass, hass_ws_client, method):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"houseplan/{method}/get"})
    reply = await client.receive_json()
    assert reply["success"], reply
    return reply["result"]


async def test_user_flow_creates_entry(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], user_input={CONF_ADMIN_ONLY: True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "House Plan"
    assert result["options"] == {CONF_ADMIN_ONLY: True}
    assert result["description"] == "panel_ready"


async def test_single_instance(hass: HomeAssistant) -> None:
    """manifest single_config_entry must prevent a second entry."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    result2 = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result2["type"] is FlowResultType.ABORT
    assert result2["reason"] == "single_instance_allowed"


async def test_options_flow(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], user_input={})
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    await hass.async_block_till_done()  # entry is auto-set-up after the flow

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={CONF_ADMIN_ONLY: True}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == {CONF_ADMIN_ONLY: True}


async def test_previous_data_menu(hass):
    root = _seed(hass)
    before = _snapshot(root)
    result = await _init(hass)
    assert result["type"] is FlowResultType.MENU
    assert result["step_id"] == "previous_data"
    assert result["menu_options"] == ["restore", "start_fresh"]
    placeholders = result["description_placeholders"]
    assert placeholders["spaces"] == "1" and placeholders["files"] == "4"
    assert placeholders["modified"].endswith(" UTC")
    assert placeholders["warning"] == ""
    assert _snapshot(root) == before


async def test_restore_previous_data(hass, hass_ws_client, hass_client):
    root = _seed(hass)
    before = _active_bytes(root)
    result = await _choose(hass, await _init(hass), "restore")
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "user"
    assert _active_bytes(root) == before
    assert (await _finish(hass, result))["type"] is FlowResultType.CREATE_ENTRY
    config = await _ws_get(hass, hass_ws_client, "config")
    assert config["config"]["spaces"][0]["id"] == "old"
    client = await hass_client()
    response = await client.get("/api/houseplan/content/plans/_/old.svg")
    assert response.status == 200
    assert await response.read() == before["houseplan/plans/old.svg"]
    assert _active_bytes(root) == before
    assert not (root / "houseplan/archive").exists()


async def test_start_fresh(hass, hass_ws_client):
    root = _seed(hass)
    before = _active_bytes(root)
    result = await _choose(hass, await _init(hass), "start_fresh")
    assert _active_bytes(root) == before
    assert (await _finish(hass, result))["type"] is FlowResultType.CREATE_ENTRY
    assert (await _ws_get(hass, hass_ws_client, "config"))["config"]["spaces"] == []
    assert (await _ws_get(hass, hass_ws_client, "layout"))["layout"] == {}
    for name in previous_data.DATA_DIRS:
        assert list((root / name).iterdir()) == []
    archives = list((root / "houseplan/archive").iterdir())
    assert len(archives) == 1
    archived = {str(p.relative_to(archives[0])): p.read_bytes()
                for p in archives[0].rglob("*") if p.is_file()}
    assert archived == {p.replace(".storage/", "storage/").replace("houseplan/", "", 1): value
                        for p, value in before.items()}


@pytest.mark.parametrize("choice", [None, "restore", "start_fresh"])
async def test_abort_preserves_data(hass, choice):
    root = _seed(hass)
    before = _snapshot(root)
    result = await _init(hass)
    if choice:
        result = await _choose(hass, result, choice)
    hass.config_entries.flow.async_abort(result["flow_id"])
    await hass.async_block_till_done()
    assert _snapshot(root) == before
    assert hass.config_entries.async_entries(DOMAIN) == []


async def test_archive_only_uses_original_user_step(hass):
    root = Path(hass.config.config_dir)
    path = root / "houseplan/archive/old/storage/houseplan.config"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"old")
    before = _snapshot(root)
    result = await _init(hass)
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "user"
    assert _snapshot(root) == before


@pytest.mark.parametrize("payload", [b"invalid json", b'{"version": 99, "data": {}}'])
@pytest.mark.parametrize("choice", ["restore", "start_fresh"])
async def test_corrupt_previous_config(hass, payload, choice):
    root = _seed(hass)
    path = root / ".storage/houseplan.config"
    path.write_bytes(payload)
    hass.config.language = "ru"
    result = await _init(hass)
    assert result["type"] is FlowResultType.MENU
    assert result["description_placeholders"]["spaces"] == "—"
    assert result["description_placeholders"]["files"] == "4"
    assert "не удалось прочитать" in result["description_placeholders"]["warning"]
    result = await _choose(hass, result, choice)
    # Restore deliberately uses HA's normal corrupt/future Store handling.
    # No promise that setup succeeds for a broken file; the flow still creates.
    result = await _finish(hass, result)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    if choice == "restore":
        if path.exists():  # HA can quarantine malformed JSON as *.corrupt.*.
            assert path.read_bytes() == payload
        else:
            assert any(p.read_bytes() == payload for p in path.parent.glob("houseplan.config*"))
    else:
        assert next((root / "houseplan/archive").glob("*/storage/houseplan.config")).read_bytes() == payload


@pytest.mark.parametrize("language", ["en", "ru", "de", "fr"])
async def test_menu_translations(hass, language):
    translated = await async_get_translations(hass, language, "config", {DOMAIN})
    prefix = f"component.{DOMAIN}.config."
    description = translated[prefix + "step.previous_data.description"]
    assert all("{" + key + "}" in description for key in ("spaces", "files", "modified", "warning"))
    for key in ("step.previous_data.title", "step.previous_data.menu_options.restore",
                "step.previous_data.menu_options.start_fresh", "error.previous_data_unreadable",
                "abort.previous_data_error", "abort.archive_failed", "abort.already_in_progress"):
        assert translated[prefix + key]


async def test_archive_failure_never_creates_entry(hass, monkeypatch):
    root = _seed(hass)
    before = _active_bytes(root)
    result = await _choose(hass, await _init(hass), "start_fresh")
    rename = Path.rename
    calls = 0

    def fail_second(path, destination):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise PermissionError("second rename failed")
        return rename(path, destination)

    monkeypatch.setattr(Path, "rename", fail_second)
    result = await _finish(hass, result)
    assert result["type"] is FlowResultType.ABORT and result["reason"] == "archive_failed"
    assert hass.config_entries.async_entries(DOMAIN) == []
    assert _active_bytes(root) == before and not (root / "houseplan/archive").exists()


async def test_active_entry_prevents_archive(hass):
    root = _seed(hass)
    result = await _choose(hass, await _init(hass), "start_fresh")
    before = _active_bytes(root)
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    result = await _finish(hass, result)
    assert result["type"] is FlowResultType.ABORT and result["reason"] == "single_instance_allowed"
    assert _active_bytes(root) == before and not (root / "houseplan/archive").exists()


async def test_concurrent_flow_is_refused(hass):
    root = _seed(hass)
    first = await _choose(hass, await _init(hass), "start_fresh")
    before = _snapshot(root)
    second = await _init(hass)
    assert second["type"] is FlowResultType.ABORT and second["reason"] == "already_in_progress"
    assert _snapshot(root) == before
    hass.config_entries.flow.async_abort(first["flow_id"])


async def test_inspection_failure_preserves_data(hass, monkeypatch):
    from custom_components.houseplan import config_flow

    root = _seed(hass)
    before = _snapshot(root)

    def cannot_inspect(config_dir):
        raise PermissionError("cannot enumerate data")

    monkeypatch.setattr(config_flow, "inspect_previous_data", cannot_inspect)
    result = await _init(hass)
    assert result["type"] is FlowResultType.ABORT and result["reason"] == "previous_data_error"
    assert _snapshot(root) == before
    assert hass.config_entries.async_entries(DOMAIN) == []
