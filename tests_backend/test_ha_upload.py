"""HTTP upload endpoint tests (CI)."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

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
    # audit B1: uploads now return the AUTHENTICATED content URL
    # HP-1454-02: uploads take a FREE name and never overwrite, so the url is
    # the name that was actually used — no cache-busting query needed any more
    assert body["ok"] and body["url"].startswith("/api/houseplan/content/files/m1/manual")
    assert body["url"].endswith(".pdf") and "?" not in body["url"]


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
    # both the marker dir and the filename must be flattened to safe names:
    # no path segment may be exactly ".." (dots inside a name are harmless)
    path = body["url"].split("?", 1)[0]
    assert all(seg != ".." for seg in path.split("/"))
    assert path.startswith("/api/houseplan/content/files/")


def _pdf_form(name: str, size: int, marker: str = "m1") -> FormData:
    fd = FormData()
    fd.add_field("marker_id", marker)
    fd.add_field("file", b"%PDF-" + b"x" * (size - 5), filename=name, content_type="application/pdf")
    return fd


async def test_issue_498_upload_accepts_the_last_bytes_and_the_last_file_of_the_quota(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, monkeypatch,
) -> None:
    """#498 AC1: exact byte and count boundaries pass; one more of either is refused."""
    from custom_components.houseplan import http_api as hp_http

    await _setup(hass)
    client = await hass_client()
    monkeypatch.setattr(hp_http, "MAX_FILES_BYTES", 1000)
    monkeypatch.setattr(hp_http, "MAX_FILES_COUNT", 2)

    first = await client.post("/api/houseplan/upload", data=_pdf_form("a.pdf", 600))
    assert first.status == 200, await first.text()
    exact = await client.post("/api/houseplan/upload", data=_pdf_form("b.pdf", 400))
    assert exact.status == 200, await exact.text()
    over = await client.post("/api/houseplan/upload", data=_pdf_form("c.pdf", 1))
    assert over.status == 507
    assert (await over.json())["error"] == "too_many_files"

    monkeypatch.setattr(hp_http, "MAX_FILES_COUNT", 3)
    over_bytes = await client.post("/api/houseplan/upload", data=_pdf_form("c.pdf", 6))
    assert over_bytes.status == 507
    assert (await over_bytes.json())["error"] == "quota_exceeded"

    from pathlib import Path

    from custom_components.houseplan.const import FILES_DIR
    from custom_components.houseplan.plans import TMP_PREFIX

    root = Path(hass.config.path(FILES_DIR))
    assert not list(root.glob(TMP_PREFIX + "*")), "no staged file may outlive its request"
    assert sorted(p.name for p in (root / "m1").iterdir()) == ["a.pdf", "b.pdf"]


async def test_issue_498_concurrent_uploads_still_count_each_other(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, monkeypatch,
) -> None:
    """#498 AC1: excluding one's own staged file must not hide the neighbour's.

    Both uploads are held at the quota check while both staged files exist. Each
    sees the other's `.upload-*` as usage, so together they cannot exceed the
    quota; a check that ignored every staged file would promote both.
    """
    import asyncio
    import threading

    from custom_components.houseplan import http_api as hp_http
    from custom_components.houseplan import plans as hp_plans

    await _setup(hass)
    client = await hass_client()
    monkeypatch.setattr(hp_http, "MAX_FILES_BYTES", 1000)

    real_check = hp_plans.check_quota
    barrier = threading.Barrier(2, timeout=5)

    def both_staged_check(*args, **kwargs):
        barrier.wait()
        return real_check(*args, **kwargs)

    monkeypatch.setattr(hp_http, "check_quota", both_staged_check)
    responses = await asyncio.gather(
        client.post("/api/houseplan/upload", data=_pdf_form("a.pdf", 600)),
        client.post("/api/houseplan/upload", data=_pdf_form("b.pdf", 600)),
    )
    statuses = sorted(response.status for response in responses)
    assert statuses != [200, 200], "1200 bytes would be stored against a 1000-byte quota"
    assert all(status in (200, 507) for status in statuses), [await r.text() for r in responses]

    from pathlib import Path

    from custom_components.houseplan.const import FILES_DIR

    root = Path(hass.config.path(FILES_DIR))
    assert not list(root.glob(hp_plans.TMP_PREFIX + "*"))
    stored = sum(p.stat().st_size for p in (root / "m1").iterdir()) if (root / "m1").is_dir() else 0
    assert stored <= 1000


def _svg_chain(length: int) -> bytes:
    defs = "".join(
        f'<linearGradient id="g{index}" href="#g{index + 1}"/>' for index in range(length - 1)
    ) + f'<linearGradient id="g{length - 1}"/>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        f"<defs>{defs}</defs>" '<rect width="1" height="1" fill="url(#g0)"/></svg>'
    ).encode()


async def test_issue_498_decor_upload_refuses_a_deep_reference_chain_with_a_code_not_a_500(
    hass: HomeAssistant, hass_client: ClientSessionGenerator,
) -> None:
    """#498 AC3: a flat chain of thousands of hrefs is a bounded refusal at the endpoint."""
    await _setup(hass)
    client = await hass_client()
    fd = FormData()
    fd.add_field("file", _svg_chain(2500), filename="chain.svg", content_type="image/svg+xml")
    response = await client.post("/api/houseplan/assets/upload", data=fd)
    assert response.status == 413, await response.text()
    assert (await response.json())["error"] == "too_large"

    ok = FormData()
    ok.add_field("file", _svg_chain(64), filename="chain64.svg", content_type="image/svg+xml")
    accepted = await client.post("/api/houseplan/assets/upload", data=ok)
    assert accepted.status == 200, await accepted.text()
