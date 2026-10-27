"""#1022 real HA apply and JSON/ZIP transfer keep fractional positions and actions."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.const import DOMAIN, PLAN_MODEL_VERSION
from custom_components.houseplan.import_export import create_export, create_preview, parse_document
from custom_components.houseplan.store import get_data
from custom_components.houseplan.validation import CONFIG_SCHEMA

GOLDEN = Path(__file__).resolve().parent.parent / "scripts/sh3d-convert/golden"


@pytest.fixture(autouse=True)
def _custom(enable_custom_integrations):
    yield


class Connection:
    def __init__(self):
        self.user = SimpleNamespace(id="picture-owner", is_admin=True)
        self.result = None
        self.error = None

    def send_result(self, _id, result):
        self.result = result

    def send_error(self, _id, code, message):
        self.error = (code, message)


def assert_picture(config, layout, source):
    expected = source["payload"]["config"]
    space = next(item for item in config["spaces"] if item["title"] == "Ground floor")
    assert space["plan_url"] == "/local/floorplan/ground.png"
    assert space["plan_aspect"] == 1.6
    assert len(config["markers"]) == 11
    keys = ("binding", "name", "icon", "tap_action", "tap_target", "tap_confirm", "value_badge")
    fractions = {"entity:light.edge_a": (0, 1), "entity:light.edge_b": (1, 0),
                 "Night script": (0.31125, 0.7275), "Morning automation": (0.42125, 0.1375)}
    for wanted, actual in zip(expected["markers"], config["markers"], strict=True):
        assert {key: actual.get(key) for key in keys} == {key: wanted.get(key) for key in keys}
        point, original = layout[actual["id"]], source["payload"]["layout"][wanted["id"]]
        assert point["s"] == space["id"]
        assert (point["x"], point["y"]) == pytest.approx((original["x"], original["y"]), abs=1e-9)
        fraction = fractions.get(actual.get("name"), fractions.get(actual["binding"]))
        if fraction:
            x0 = space["plan_x"]
            y0 = space["plan_y"] + (1 - 1 / 1.6) / 2
            assert ((point["x"] - x0) / space["plan_scale_x"],
                    (point["y"] - y0) / (space["plan_scale_y"] / 1.6)) == pytest.approx(fraction, abs=1e-8)
    fields = ("kind", "text", "x", "y", "size_cm", "color")
    assert [{key: item[key] for key in fields} for item in space["decor"]] == [
        {key: item[key] for key in fields} for item in expected["spaces"][0]["decor"]]
    CONFIG_SCHEMA(config)


@pytest.mark.asyncio
@pytest.mark.parametrize("carrier", ["full-json", "space-json", "plan-only-json", "full-zip"])
async def test_picture_ha_transfer(hass, tmp_path, carrier):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    root = Path(hass.config.path(""))
    source = json.loads((GOLDEN / "picture-elements.space-1.json").read_text())
    empty = {"model_version": PLAN_MODEL_VERSION, "spaces": [{"id": "existing", "title": "Untouched",
             "cell_cm": 5, "view_box": [0, 0, 1, 1], "rooms": [], "wall_segments": [], "partitions": []}],
             "markers": [], "settings": {}}

    async def apply(document):
        await runtime.config_store.async_save({"config": copy.deepcopy(empty), "rev": 1})
        await runtime.store.async_save({"layout": {}, "rev": 1})
        preview = create_preview(runtime, json.dumps(document).encode(), owner_id="picture-owner",
            duplicate_policy="skip",
            current_config_data=await runtime.config_store.async_load(),
            current_layout_data=await runtime.store.async_load(), config_root=root)
        connection = Connection()
        await wsapi.ws_import_apply.__wrapped__(hass, connection, {
            "id": 1, "type": "houseplan/import/apply", "token": preview["token"],
            "expected_config_rev": preview["expected_config_rev"], "expected_layout_rev": preview["expected_layout_rev"],
            "confirm_missing_content": True})
        assert connection.error is None, connection.error
        assert connection.result is not None
        return await runtime.config_store.async_load(), await runtime.store.async_load()

    config_data, layout_data = await apply(source)
    assert_picture(config_data["config"], layout_data["layout"], source)
    space = next(item for item in config_data["config"]["spaces"] if item["title"] == "Ground floor")
    plan_only = carrier == "plan-only-json"
    kind = "full" if carrier.startswith("full") else "space"
    exported, _ = create_export(runtime, config_data, layout_data, kind=kind,
        space_id=space["id"] if kind == "space" else None, plan_only=plan_only,
        card_version="test-1022", config_root=root)
    if carrier == "full-zip":
        archive = tmp_path / "picture.zip"
        build_archive(archive, exported, root, {})
        portable = read_archive(archive, tmp_path / "staging")
        exported = portable.document
    parsed = parse_document(json.dumps(exported).encode())
    restored, placed = await apply(parsed)
    if plan_only:
        assert restored["config"]["markers"] == []
        assert placed["layout"] == {}
        assert "script.night" not in json.dumps(parsed)
        assert "{sensor." not in json.dumps(parsed)
    else:
        assert_picture(restored["config"], placed["layout"], source)
