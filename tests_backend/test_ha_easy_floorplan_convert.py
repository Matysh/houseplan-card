"""#937 actual HA preview -> authenticated apply -> export -> repeat import."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN, PLAN_MODEL_VERSION
from custom_components.houseplan.import_export import create_export, create_preview, parse_document
from custom_components.houseplan.store import get_data
from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.validation import CONFIG_SCHEMA

GOLDEN = Path(__file__).resolve().parent.parent / "scripts/sh3d-convert/golden"


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


class Connection:
    def __init__(self):
        self.user = SimpleNamespace(id="converter-owner", is_admin=True)
        self.result = None
        self.error = None

    def send_result(self, _id, result):
        self.result = result

    def send_error(self, _id, code, message):
        self.error = (code, message)


@pytest.mark.asyncio
@pytest.mark.parametrize("filename", ["easy-content.space-1.json", "easy-public-demo.space-1.json",
    "flat-two-rooms.space-1.json", "awkward.space-2.json"])
async def test_issue_937_ha_applies_exports_and_deduplicates_without_changing_existing_plan(hass, filename):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    existing = {"model_version": PLAN_MODEL_VERSION, "spaces": [{
        "id": "existing", "title": "Keep me", "cell_cm": 5, "view_box": [0, 0, 1, 1],
        "rooms": [], "wall_segments": [], "partitions": [],
    }], "markers": [], "settings": {"bg_mode": "static", "glow_radius_cm": 222}}
    await runtime.config_store.async_save({"config": existing, "rev": 1})
    await runtime.store.async_save({"layout": {}, "rev": 1})
    document = json.loads((GOLDEN / filename).read_text())
    root = Path(hass.config.path(""))
    # Existing import code owns absent bindings and permissions; converter does
    # not perform registry writes or need a network connection to the source HA.
    before = copy.deepcopy(existing)
    async def import_it(policy):
        cfg = await runtime.config_store.async_load()
        lay = await runtime.store.async_load()
        response = create_preview(runtime, json.dumps(document).encode(), owner_id="converter-owner",
            duplicate_policy=policy, current_config_data=cfg, current_layout_data=lay, config_root=root)
        assert response["preview"]["counts"]["spaces"] == len(cfg["config"]["spaces"]) + 1
        connection = Connection()
        await wsapi.ws_import_apply.__wrapped__(hass, connection, {
            "id": 1, "type": "houseplan/import/apply", "token": response["token"],
            "expected_config_rev": response["expected_config_rev"], "expected_layout_rev": response["expected_layout_rev"],
            "confirm_missing_content": True,
        })
        assert connection.error is None, connection.error
        assert connection.result is not None
        return (await runtime.config_store.async_load())["config"]

    first = await import_it("skip")
    assert first["spaces"][0] == before["spaces"][0]
    assert first["settings"] == before["settings"]
    expected = document["payload"]["config"]
    assert len(first["markers"]) == len(expected["markers"])
    assert all(marker["id"] not in {m["id"] for m in expected["markers"]} for marker in first["markers"])
    copied = first["spaces"][-1]
    CONFIG_SCHEMA(first)
    exported, _ = create_export(runtime, {"config": first, "rev": 2}, await runtime.store.async_load(),
        kind="space", space_id=copied["id"], card_version="test-937", config_root=root)
    parsed = parse_document(json.dumps(exported).encode())
    assert len(parsed["payload"]["config"]["markers"]) == len(expected["markers"])
    assert copied.get("decor", []) == parsed["payload"]["config"]["spaces"][0].get("decor", [])
    if copied.get("led_strips"):
        assert copied["led_strips"][0]["marker"] in {m["id"] for m in first["markers"]}
    second = await import_it("skip")
    bound = [m for m in first["markers"] if m["binding"] != "virtual"]
    for marker in bound:
        assert sum(m["binding"] == marker["binding"] for m in second["markers"]) == 1
    assert second["settings"] == before["settings"]
    third = await import_it("virtual")
    old_ids = {marker["id"] for marker in second["markers"]}
    copies = [marker for marker in third["markers"] if marker["id"] not in old_ids]
    assert len(copies) == len(expected["markers"])
    assert all(marker["binding"] == "virtual" for marker in copies)
    assert sum(marker.get("display") == "static_icon" for marker in copies) >= len(bound)
    assert third["settings"] == before["settings"]
