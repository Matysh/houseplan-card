"""HTTP upload endpoint tests (CI)."""
from aiohttp import FormData
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.houseplan.const import DOMAIN


async def _setup(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_upload_ok(hass: HomeAssistant, hass_client: ClientSessionGenerator) -> None:
    await _setup(hass)
    client = await hass_client()
    fd = FormData()
    fd.add_field("marker_id", "m1")
    fd.add_field("file", b"%PDF-1.4 test", filename="manual.pdf", content_type="application/pdf")
    resp = await client.post("/api/houseplan/upload", data=fd)
    assert resp.status == 200
    body = await resp.json()
    assert body["ok"] and body["url"].startswith("/houseplan_files/files/m1/manual.pdf?v=")


async def test_upload_bad_ext(hass: HomeAssistant, hass_client: ClientSessionGenerator) -> None:
    await _setup(hass)
    client = await hass_client()
    fd = FormData()
    fd.add_field("file", b"MZ", filename="evil.exe")
    resp = await client.post("/api/houseplan/upload", data=fd)
    assert resp.status == 400
    assert (await resp.json())["error"] == "bad_ext"


async def test_upload_traversal_sanitized(hass: HomeAssistant, hass_client: ClientSessionGenerator) -> None:
    await _setup(hass)
    client = await hass_client()
    fd = FormData()
    fd.add_field("marker_id", "../../etc")
    fd.add_field("file", b"x", filename="../..//passwd.txt")
    resp = await client.post("/api/houseplan/upload", data=fd)
    assert resp.status == 200
    body = await resp.json()
    # both the marker dir and the filename must be flattened to safe names
    assert ".." not in body["url"]
