"""Bounded outbound submit to the compile-time House Plan support relay (#43)."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlsplit

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import SUPPORT_RELAY_URL

_REPORT_ID_PREFIX = "hpr-"


class SupportTransportError(RuntimeError):
    """Stable frontend-facing error; never contains the remote response."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


async def async_submit_report(
    hass,
    *,
    message: str,
    contact: str,
    versions: dict[str, Any],
    idempotency_key: str,
    attachment: bytes | None,
    attachment_sha256: str | None,
    filename_token: str,
) -> str:
    """Send once, without redirects, proxies, arbitrary hosts or reflected text."""
    target = urlsplit(SUPPORT_RELAY_URL)
    if target.scheme != "https" or target.hostname != "support.houseplan.tech":
        raise SupportTransportError("support_unavailable")

    request: dict[str, Any] = {
        "schema_version": 1,
        "message": message,
        "idempotency_key": idempotency_key,
        "versions": {key: str(value) for key, value in versions.items()},
    }
    if contact:
        request["contact"] = contact
    if attachment is not None:
        request["attachment"] = {
            "size": len(attachment),
            "sha256": str(attachment_sha256 or ""),
        }
    form = aiohttp.FormData()
    form.add_field(
        "request", json.dumps(request, ensure_ascii=False, separators=(",", ":")),
        content_type="application/json",
    )
    if attachment is not None:
        form.add_field(
            "attachment", attachment,
            filename=f"houseplan-support-{filename_token[:32]}.json",
            content_type="application/json",
        )

    session = async_get_clientsession(hass)
    timeout = aiohttp.ClientTimeout(total=20, sock_connect=5)
    try:
        async with session.post(
            SUPPORT_RELAY_URL, data=form, timeout=timeout, allow_redirects=False,
        ) as response:
            if response.status == 429:
                raise SupportTransportError("support_rate_limited")
            if response.status == 413:
                raise SupportTransportError("support_package_too_large")
            if response.status in {400, 401, 403, 404, 405, 409, 415, 422}:
                raise SupportTransportError("support_rejected")
            if response.status != 200:
                raise SupportTransportError("support_unavailable")
            # A compromised/misconfigured relay cannot make HA buffer an
            # unbounded response or reflect its details to the browser.
            body = await response.content.read(4097)
            if len(body) > 4096:
                raise SupportTransportError("support_unavailable")
    except SupportTransportError:
        raise
    except (aiohttp.ClientError, TimeoutError, OSError):
        raise SupportTransportError("support_unavailable") from None

    try:
        payload = json.loads(body.decode("utf-8"))
        report_id = payload.get("report_id") if isinstance(payload, dict) else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        report_id = None
    if not isinstance(report_id, str) or not report_id.startswith(_REPORT_ID_PREFIX):
        raise SupportTransportError("support_unavailable")
    if not 8 <= len(report_id) <= 64 or any(
        char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
        for char in report_id
    ):
        raise SupportTransportError("support_unavailable")
    return report_id
