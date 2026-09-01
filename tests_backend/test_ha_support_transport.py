"""Bounded fixed-host transport contract for private support reports (#43)."""
from __future__ import annotations

import json

import pytest

from custom_components.houseplan import support_transport
from custom_components.houseplan.support_transport import (
    SupportTransportError,
    async_submit_report,
)


class _Content:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.read_limit = 0

    async def read(self, limit: int) -> bytes:
        self.read_limit = limit
        return self.body[:limit]


class _Response:
    def __init__(self, status: int, body: bytes) -> None:
        self.status = status
        self.content = _Content(body)


class _Context:
    def __init__(self, response: _Response) -> None:
        self.response = response

    async def __aenter__(self) -> _Response:
        return self.response

    async def __aexit__(self, *_args) -> None:
        return None


class _Session:
    def __init__(self, status: int = 200, body: bytes | None = None) -> None:
        self.response = _Response(
            status,
            body if body is not None else json.dumps({"report_id": "hpr-test-1234"}).encode(),
        )
        self.calls: list[tuple[str, dict]] = []

    def post(self, url: str, **kwargs) -> _Context:
        self.calls.append((url, kwargs))
        return _Context(self.response)


async def _send(monkeypatch: pytest.MonkeyPatch, session: _Session) -> str:
    monkeypatch.setattr(support_transport, "async_get_clientsession", lambda _hass: session)
    return await async_submit_report(
        object(),
        message="plain <message>",
        contact="user@example.test",
        versions={"card": "1.70.0-beta.2"},
        idempotency_key="report-test-one",
        attachment=b"{}\n",
        attachment_sha256="a" * 64,
        filename_token="a" * 48,
    )


async def test_transport_uses_only_fixed_https_host_without_redirects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _Session()
    assert await _send(monkeypatch, session) == "hpr-test-1234"
    assert len(session.calls) == 1
    url, kwargs = session.calls[0]
    assert url == "https://support.houseplan.tech/v1/reports"
    assert kwargs["allow_redirects"] is False
    assert kwargs["timeout"].total == 20
    assert kwargs["timeout"].sock_connect == 5
    assert session.response.content.read_limit == 4097


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (302, "support_unavailable"),
        (400, "support_rejected"),
        (413, "support_package_too_large"),
        (429, "support_rate_limited"),
        (503, "support_unavailable"),
    ],
)
async def test_transport_maps_remote_status_without_reflecting_response(
    monkeypatch: pytest.MonkeyPatch, status: int, code: str,
) -> None:
    session = _Session(status, b"private provider debug text")
    with pytest.raises(SupportTransportError) as caught:
        await _send(monkeypatch, session)
    assert caught.value.code == code
    assert str(caught.value) == code
    assert "private" not in str(caught.value)


async def test_transport_rejects_unbounded_or_invalid_receipt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for body in (b"x" * 4097, b'{"report_id":"remote secret with spaces"}'):
        with pytest.raises(SupportTransportError, match="support_unavailable"):
            await _send(monkeypatch, _Session(200, body))
