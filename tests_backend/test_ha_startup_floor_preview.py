"""#1522: private render-only cache in the real HA transport and Store."""
import base64
import gzip
import json

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.startup_floor_preview import (
    STORE_OVERHEAD_BYTES,
    PreviewStorage,
    validate_preview,
)
from custom_components.houseplan.store import get_data


def wire(nodes=None, **extra):
    rect = {"x": 1, "y": 2, "w": 10, "h": 15}
    fit = {
        "base": [1, 2, 10, 15], "display": rect, "projection": "flat", "rotation": 0,
        "frame": {"rect": rect, "all": rect, "hasContent": True, "outliers": 0},
    }
    pool = []

    def compact(row):
        tag, attributes, children = row
        indices = {}
        for name, value in attributes.items():
            indices[name] = len(pool)
            pool.append(value)
        return [tag, indices, [compact(child) for child in children]]

    body = {
        "version": 1, "fit": fit,
        "nodes": [compact(node) for node in (
            nodes if nodes is not None else [["path", {"d": "M1 2 L11 17Z", "fill": "#aabbee"}, []]])],
        "pool": pool,
        **extra,
    }
    return base64.b64encode(gzip.compress(json.dumps(body).encode())).decode()


@pytest.mark.parametrize("nodes", [
    [["image", {"href": "data:image/png;base64,AAAA"}, []]],
    [["use", {"href": "https://remote.invalid/other"}, []]],
    [["path", {"d": "M 1e309 3 Z"}, []]],
    [["path", {"d": "M NaN Infinity"}, []]],
    [["path", {"d": "M 1 2 Z", "onclick": "alert(1)"}, []]],
    [["rect", {"width": "1", "filter": "url (foo)"}, []]],
    [["rect", {"hp-stroke-units": "0.25"}, []]],
    [["path", {"hp-stroke-units": "1e999"}, []]],
    [["path", {"hp-hatch-step": "0"}, []]],
])
def test_closed_render_schema(nodes):
    assert validate_preview(wire(), "flat", 0) > 0
    with pytest.raises(ValueError):
        validate_preview(wire(nodes), "flat", 0)


def test_finite_plan_units_for_receiver_paint():
    assert validate_preview(wire([
        ["path", {"d": "M 0 0 L 3 0 Z", "hp-stroke-units": "2.5e-2"}, []],
        ["path", {"d": "M 0 0 L 3 0 Z", "hp-wall-depth": "0", "hp-hatch-step": "8"}, []],
    ]), "flat", 0) > 0


def test_static_webp_preview_has_its_own_bounded_contract():
    """A GPU capture can use the cache without relaxing the vector validator."""
    packet = {
        "version": 2,
        "fit": json.loads(gzip.decompress(base64.b64decode(wire())))["fit"],
        "size": [400, 240],
        "view": [1, 2, 10, 15],
        "zoom": 1,
        "image": "UklGRmgAAABXRUJQVlA4WAoAAAAQAAAABAAAAgAAQUxQSBAAAAABDzD/ERFCIYAA"
                 "KGgi+h8PVlA4IDIAAADwAQCdASoFAAMAAQAcJYwC7DBAPJVCAAAA/vRRAsO/t+RUYWEsvRePv3xh7C4GFgAAAA==",
    }
    packet["fit"]["projection"] = "iso"

    def encoded(value):
        return base64.b64encode(gzip.compress(json.dumps(value).encode())).decode()

    assert validate_preview(encoded(packet), "iso", 0) > 0
    with pytest.raises(ValueError):
        validate_preview(encoded(packet), "flat", 0)
    with pytest.raises(ValueError):
        validate_preview(encoded({**packet, "view": [1, 2, 0, 15]}), "iso", 0)
    data = bytearray(base64.b64decode(packet["image"]))
    data[20] |= 2  # An animated VP8X header is outside the raster contract.
    with pytest.raises(ValueError):
        validate_preview(encoded({**packet, "image": base64.b64encode(data).decode()}), "iso", 0)
    with pytest.raises(ValueError):
        validate_preview(encoded({**packet, "image": "PHN2Zy8+"}), "iso", 0)


async def test_preview_scope_survives_reload_but_not_equal_rev_restore(
    hass, enable_custom_integrations, hass_ws_client,
):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    config_row = {"config": {"spaces": [{"id": "f1", "title": "Floor", "rooms": []}]}, "rev": 8}
    await runtime.config_store.async_save(config_row)
    await runtime.store.async_save({"rev": 7, "layout": {}})
    viewer = await hass.auth.async_create_user("Preview reader", group_ids=[GROUP_ID_READ_ONLY])
    refresh = await hass.auth.async_create_refresh_token(viewer, client_id="http://houseplan.test")
    reader = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    writer = await hass_ws_client(hass)

    async def call(client, kind, **payload):
        await client.send_json_auto_id({"type": "houseplan/" + kind, **payload})
        reply = await client.receive_json()
        assert reply["success"], reply
        return reply["result"]

    config = await call(reader, "config/get")
    layout = await call(reader, "layout/get")
    assert not config["can_write"]
    address = {"floor": "f1", "projection": "flat", "rotation": 0, "variant": "a" * 64,
               "source": [config["startup_floor_source"], layout["startup_floor_source"]]}
    packet = wire()
    assert await call(reader, "startup_floor/put", **address, packet=packet) == {"stored": True}
    rows = await runtime.startup_floor_previews.index()
    assert next(iter(rows.values()))["bytes"] == len(packet) + STORE_OVERHEAD_BYTES
    assert await call(writer, "startup_floor/get", **address) == {"packet": None}
    assert await call(reader, "startup_floor/get", **address) == {"packet": packet}
    runtime.startup_floor_previews = PreviewStorage(hass)
    assert await call(reader, "startup_floor/get", **address) == {"packet": packet}
    assert await runtime.config_store.async_load() == config_row
    await runtime.config_store.async_save({"config": {"spaces": []}, "rev": 8})
    assert await call(reader, "startup_floor/get", **address) == {"packet": None}
    assert await call(reader, "startup_floor/put", **address, packet=packet) == {"stored": False}


async def test_bounded_store_replaces_and_fences_publication(hass, monkeypatch):
    monkeypatch.setattr("custom_components.houseplan.startup_floor_preview.COUNT_LIMIT", 2)
    storage = PreviewStorage(hass)
    should_pass = True

    async def current():
        return should_pass

    addresses = ["a" * 64, "b" * 64, "c" * 64]
    source = ["d" * 64, "e" * 64]
    variant = "f" * 64
    for key in addresses[:2]:
        assert await storage.write(key, source, variant, "wire", 25, current)
    assert await storage.read(addresses[0], source, variant) == "wire"
    assert await storage.write(addresses[2], source, variant, "wire", 25, current)
    assert await storage.read(addresses[1], source, variant) is None
    should_pass = False
    assert not await storage.write(addresses[0], source, variant, "stale", 22, current)
    reloaded = PreviewStorage(hass)
    assert await reloaded.read(addresses[0], source, variant) == "wire"
