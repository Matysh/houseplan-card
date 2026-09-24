"""#617: plan upload bound and the single writer shared by HTTP and WebSocket.

Pure — no Home Assistant needed. The HTTP view itself (status codes, auth,
multipart) is covered by `test_ha_upload.py` in the HA harness (Linux CI).
"""
from __future__ import annotations

import asyncio
import hashlib
import re
from pathlib import Path

import pytest

from pure_imports import HOUSEPLAN_ROOT, load_pure

plans = load_pure("custom_components.houseplan.plans", HOUSEPLAN_ROOT / "plans.py")
validation = load_pure("custom_components.houseplan.validation", HOUSEPLAN_ROOT / "validation.py")

CHUNK = 64 * 1024


class _Part:
    """Minimal stand-in for an aiohttp BodyPartReader: only `read_chunk`."""

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._pos = 0
        self.reads = 0

    async def read_chunk(self, size: int = CHUNK) -> bytes:
        self.reads += 1
        block = self._data[self._pos:self._pos + size]
        self._pos += len(block)
        return block


def _read(data: bytes, limit: int) -> tuple[bytes | None, _Part]:
    part = _Part(data)
    return asyncio.run(plans.read_bounded(part, limit, CHUNK)), part


def test_issue_617_read_bounded_accepts_exactly_the_limit():
    limit = 3 * CHUNK + 17
    data = bytes(range(256)) * (limit // 256) + b"x" * (limit % 256)
    assert len(data) == limit
    out, _part = _read(data, limit)
    assert out == data


def test_issue_617_read_bounded_refuses_one_byte_over_and_stops_reading():
    limit = 3 * CHUNK + 17
    data = b"y" * (limit + 1) + b"z" * (5 * CHUNK)
    out, part = _read(data, limit)
    assert out is None, "one byte over the plan limit must be refused"
    # the read stops at the first block that crosses the bound: an oversized
    # body never gets buffered whole
    assert part.reads == 4


def test_issue_617_read_bounded_real_plan_limit_boundary():
    limit = validation.MAX_PLAN_BYTES
    assert limit == 8 * 1024 * 1024
    exact, _ = _read(b"\0" * limit, limit)
    assert exact is not None and len(exact) == limit
    over, _ = _read(b"\0" * (limit + 1), limit)
    assert over is None


def _quota_ok() -> dict:
    return {"max_bytes": 10 * 1024 * 1024, "max_files": 50}


def test_issue_617_store_plan_upload_writes_bytes_under_a_versioned_name(tmp_path: Path):
    plans_dir = tmp_path / "plans"
    raw = b"\x89PNG" + b"a" * 5000
    name = plans.store_plan_upload(plans_dir, "f1", "png", raw, **_quota_ok())
    assert re.fullmatch(r"f1\.[0-9a-f]{8}\.png", name)
    assert plans.is_plan_file(name)
    stored = plans_dir / name
    assert hashlib.sha256(stored.read_bytes()).hexdigest() == hashlib.sha256(raw).hexdigest()
    assert sorted(p.name for p in plans_dir.iterdir()) == [name], "no temporary file is left"


def test_issue_617_store_plan_upload_is_copy_on_write(tmp_path: Path):
    plans_dir = tmp_path / "plans"
    first = plans.store_plan_upload(plans_dir, "f1", "png", b"one", **_quota_ok())
    second = plans.store_plan_upload(plans_dir, "f1", "png", b"two", **_quota_ok())
    assert first != second
    assert (plans_dir / first).read_bytes() == b"one", "the previous plan is never touched"
    assert (plans_dir / second).read_bytes() == b"two"


@pytest.mark.parametrize(
    ("limits", "reason"),
    [({"max_bytes": 10, "max_files": 50}, "quota_exceeded"),
     ({"max_bytes": 10 * 1024 * 1024, "max_files": 1}, "too_many_files")],
)
def test_issue_617_store_plan_upload_quota_refusal_leaves_nothing(tmp_path: Path, limits, reason):
    plans_dir = tmp_path / "plans"
    plans_dir.mkdir()
    (plans_dir / "old.abcd1234.png").write_bytes(b"12345")
    with pytest.raises(plans.QuotaError) as err:
        plans.store_plan_upload(plans_dir, "f2", "png", b"123456", **limits)
    assert err.value.reason == reason
    assert sorted(p.name for p in plans_dir.iterdir()) == ["old.abcd1234.png"]


def test_issue_617_both_transports_write_through_the_one_writer():
    """AC7: the HTTP view and ws_plan_set share `store_plan_upload`; neither
    carries its own copy of the naming/quota/write sequence."""
    http_src = (HOUSEPLAN_ROOT / "http_api.py").read_text(encoding="utf-8")
    ws_src = (HOUSEPLAN_ROOT / "websocket_api.py").read_text(encoding="utf-8")
    view = http_src.split("class HouseplanPlanUploadView", 1)[1].split("\nclass ", 1)[0]
    ws = ws_src.split("async def ws_plan_set", 1)[1].split("\ndef ", 1)[0]
    for body in (view, ws):
        assert body.count("store_plan_upload,") == 1
        assert "atomic_write(" not in body and "check_quota(" not in body
        assert "token_hex(" not in body
    assert "MAX_PLAN_BYTES" in view and "read_bounded(part, MAX_PLAN_BYTES" in view
