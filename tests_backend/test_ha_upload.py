"""HTTP upload endpoint tests (CI)."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from aiohttp import FormData
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN


async def _setup(hass: HomeAssistant, *, options: dict | None = None) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN, title="House Plan", data={}, options=options or {}
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def _household_access_token(hass: HomeAssistant) -> str:
    user = await hass.auth.async_create_user(
        "House Plan household", group_ids=[GROUP_ID_USER]
    )
    refresh_token = await hass.auth.async_create_refresh_token(
        user, client_id="http://houseplan.test"
    )
    return hass.auth.async_create_access_token(refresh_token)


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


async def test_issue_625_concurrent_uploads_serialize_exact_quota_check(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, monkeypatch,
) -> None:
    """#625 AC6: concurrent uploads cannot race their final quota decisions."""
    import asyncio
    import threading
    import time

    from custom_components.houseplan import http_api as hp_http

    await _setup(hass)
    client = await hass_client()
    monkeypatch.setattr(hp_http, "MAX_FILES_BYTES", 1000)

    real_check = hp_http.check_quota
    state_lock = threading.Lock()
    active = 0
    max_active = 0

    def observed_check(*args, **kwargs):
        nonlocal active, max_active
        with state_lock:
            active += 1
            max_active = max(max_active, active)
        try:
            time.sleep(0.05)
            return real_check(*args, **kwargs)
        finally:
            with state_lock:
                active -= 1

    monkeypatch.setattr(hp_http, "check_quota", observed_check)
    responses = await asyncio.gather(
        client.post("/api/houseplan/upload", data=_pdf_form("a.pdf", 600)),
        client.post("/api/houseplan/upload", data=_pdf_form("b.pdf", 600)),
    )
    statuses = sorted(response.status for response in responses)
    assert statuses != [200, 200], "1200 bytes would be stored against a 1000-byte quota"
    assert all(status in (200, 507) for status in statuses), [await r.text() for r in responses]
    assert max_active == 1

    from pathlib import Path

    from custom_components.houseplan.const import FILES_DIR

    root = Path(hass.config.path(FILES_DIR))
    assert not list(root.glob(hp_http.TMP_PREFIX + "*"))
    stored = sum(p.stat().st_size for p in (root / "m1").iterdir()) if (root / "m1").is_dir() else 0
    assert stored <= 1000


async def test_issue_554_upload_uses_actual_free_space_after_staging(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, monkeypatch,
) -> None:
    """A completed staging file needs no second disk reserve before its rename."""
    import shutil
    from pathlib import Path

    from custom_components.houseplan.const import FILES_DIR, MIN_FREE_BYTES
    from custom_components.houseplan.plans import TMP_PREFIX

    await _setup(hass)
    client = await hass_client()
    usage = type("Usage", (), {"free": MIN_FREE_BYTES})()
    monkeypatch.setattr(shutil, "disk_usage", lambda _path: usage)

    accepted = await client.post(
        "/api/houseplan/upload", data=_pdf_form("at-reserve.pdf", 50),
    )
    assert accepted.status == 200, await accepted.text()

    usage.free = MIN_FREE_BYTES - 1
    refused = await client.post(
        "/api/houseplan/upload", data=_pdf_form("below-reserve.pdf", 50),
    )
    assert refused.status == 507
    assert (await refused.json())["error"] == "low_disk_space"

    root = Path(hass.config.path(FILES_DIR))
    assert not list(root.glob(TMP_PREFIX + "*"))
    assert sorted(path.name for path in (root / "m1").iterdir()) == ["at-reserve.pdf"]


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


# ---------------- #617: plan upload over HTTP ----------------


def _plan_form(data: bytes, space_id: str = "f1", ext: str = "png", files: int = 1) -> FormData:
    fd = FormData()
    fd.add_field("space_id", space_id)
    fd.add_field("ext", ext)
    for _ in range(files):
        fd.add_field("file", data, filename=f"plan.{ext}", content_type="application/octet-stream")
    return fd


def _plans_listing(hass: HomeAssistant) -> list[str]:
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR

    root = Path(hass.config.path(PLANS_DIR))
    return sorted(p.name for p in root.iterdir()) if root.is_dir() else []


async def test_issue_617_plan_upload_stores_a_5_mib_plan_byte_for_byte(
    hass: HomeAssistant, hass_client: ClientSessionGenerator,
) -> None:
    """#617 AC1: a 5 MiB plan — above the old ~3 MiB WebSocket ceiling — is stored."""
    import hashlib
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR

    await _setup(hass)
    client = await hass_client()
    raw = b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * (5 * 1024 * 4 - 1) + b"x" * 248
    assert len(raw) == 5 * 1024 * 1024
    resp = await client.post("/api/houseplan/plans/upload", data=_plan_form(raw))
    assert resp.status == 200, await resp.text()
    body = await resp.json()
    assert body["ok"] is True
    assert body["url"].startswith("/api/houseplan/content/plans/_/f1.")
    assert body["url"].endswith(".png")
    name = body["url"].rsplit("/", 1)[-1]
    stored = Path(hass.config.path(PLANS_DIR)) / name
    digest = await hass.async_add_executor_job(lambda: hashlib.sha256(stored.read_bytes()).hexdigest())
    assert digest == hashlib.sha256(raw).hexdigest()


async def test_issue_617_plan_upload_limit_is_inclusive_and_refusal_leaves_nothing(
    hass: HomeAssistant, hass_client: ClientSessionGenerator,
) -> None:
    """#617 AC4: exactly MAX_PLAN_BYTES passes; one byte more is 413 with max_mb, no file."""
    from custom_components.houseplan.validation import MAX_PLAN_BYTES

    await _setup(hass)
    client = await hass_client()
    exact = await client.post(
        "/api/houseplan/plans/upload", data=_plan_form(b"\0" * MAX_PLAN_BYTES, "fexact"),
    )
    assert exact.status == 200, await exact.text()

    before = await hass.async_add_executor_job(_plans_listing, hass)
    over = await client.post(
        "/api/houseplan/plans/upload", data=_plan_form(b"\0" * (MAX_PLAN_BYTES + 1), "fover"),
    )
    assert over.status == 413
    assert await over.json() == {"error": "too_large", "max_mb": 8}
    after = await hass.async_add_executor_job(_plans_listing, hass)
    assert after == before, "a refused plan leaves neither a file nor a temporary behind"


async def test_issue_617_plan_upload_refuses_non_admin_by_default(
    hass: HomeAssistant,
    hass_client: ClientSessionGenerator,
    hass_read_only_access_token: str,
) -> None:
    """#617 AC4: default admin-only policy rejects non-admin HTTP uploads."""
    await _setup(hass)
    client = await hass_client(hass_read_only_access_token)
    before = await hass.async_add_executor_job(_plans_listing, hass)
    resp = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"PLAN"))
    assert resp.status == 403
    assert (await resp.json())["error"] == "unauthorized"
    assert await hass.async_add_executor_job(_plans_listing, hass) == before


async def test_issue_626_plan_upload_refuses_read_only_but_allows_household(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, hass_read_only_access_token: str,
) -> None:
    """#626 AC5: HTTP upload follows the same group-aware writer policy as WS."""
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    client = await hass_client(hass_read_only_access_token)
    before = await hass.async_add_executor_job(_plans_listing, hass)
    resp = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"PLAN"))
    assert resp.status == 403
    assert (await resp.json())["error"] == "unauthorized"
    assert await hass.async_add_executor_job(_plans_listing, hass) == before

    household = await hass_client(await _household_access_token(hass))
    allowed = await household.post(
        "/api/houseplan/plans/upload", data=_plan_form(b"PLAN", "household")
    )
    assert allowed.status == 200, await allowed.text()


async def test_issue_617_plan_upload_validates_fields_like_ws_plan_set(
    hass: HomeAssistant, hass_client: ClientSessionGenerator,
) -> None:
    """#617 AC4: space id and extension are checked; one file per request."""
    await _setup(hass)
    client = await hass_client()
    before = await hass.async_add_executor_job(_plans_listing, hass)

    bad_space = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"x", "../evil"))
    assert bad_space.status == 400
    assert (await bad_space.json())["error"] == "invalid_space_id"

    bad_ext = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"x", "f1", "gif"))
    assert bad_ext.status == 400
    assert (await bad_ext.json())["error"] == "bad_ext"

    # Without a file field aiohttp's FormData falls back to
    # application/x-www-form-urlencoded, which is not multipart at all: the
    # view answers bad_request for it (the card never sends such a body). The
    # "multipart without a file part" case has to be forced explicitly.
    no_file = FormData(default_to_multipart=True)
    no_file.add_field("space_id", "f1")
    no_file.add_field("ext", "png")
    missing = await client.post("/api/houseplan/plans/upload", data=no_file)
    assert missing.status == 400
    assert (await missing.json())["error"] == "no_file"

    urlencoded = FormData()
    urlencoded.add_field("space_id", "f1")
    urlencoded.add_field("ext", "png")
    not_multipart = await client.post("/api/houseplan/plans/upload", data=urlencoded)
    assert not_multipart.status == 400
    assert (await not_multipart.json())["error"] == "bad_request"

    two = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"x", files=2))
    assert two.status == 400
    assert (await two.json())["error"] == "one_file_only"

    assert await hass.async_add_executor_job(_plans_listing, hass) == before


async def test_issue_617_plan_upload_quota_answers_507_with_reason(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, monkeypatch,
) -> None:
    """#617 AC4: the plan store quota is the one ws_plan_set enforces."""
    from pathlib import Path

    from custom_components.houseplan import http_api as hp_http
    from custom_components.houseplan.const import PLANS_DIR
    from custom_components.houseplan.plans import dir_usage

    await _setup(hass)
    client = await hass_client()
    _bytes, stored = await hass.async_add_executor_job(
        dir_usage, Path(hass.config.path(PLANS_DIR)),
    )
    monkeypatch.setattr(hp_http, "MAX_PLANS_FILES", stored)  # no room for one more
    resp = await client.post("/api/houseplan/plans/upload", data=_plan_form(b"PLAN"))
    assert resp.status == 507
    body = await resp.json()
    assert body["error"] == "too_many_files" and body["detail"]
    _bytes2, after = await hass.async_add_executor_job(
        dir_usage, Path(hass.config.path(PLANS_DIR)),
    )
    assert after == stored
