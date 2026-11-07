"""Bounded, owner/purpose-bound transport for oversized existing WS writes.

Tokens carry bytes, never permission, import semantics or validation authority.
The ordinary command schema and writer run after resolution. This state is
ephemeral: a restart invalidates every uncommitted token.
"""
from __future__ import annotations

import hashlib
import json
import copy
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

INLINE_BYTES = 3 * 1024 * 1024
MAX_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_STAGED_BYTES = 64 * 1024 * 1024
UPLOAD_TTL = 120
PURPOSES = frozenset({"houseplan/config/set", "houseplan/plan/optimize",
    "houseplan/plan/optimize_undo", "houseplan/wall/node_move", "houseplan/wall/node_delete",
    "houseplan/marker/copy", "houseplan/marker/history", "houseplan/layout/set", "houseplan/layout/update"})
CONTROL_KEYS = frozenset({"expected_rev", "expected_config_rev", "expected_layout_rev", "direction", "action", "space_id"})


class UploadError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def _pairs(items):
    out = {}
    for key, value in items:
        if key in out:
            raise UploadError("invalid_format")
        out[key] = value
    return out


def parse_payload(raw: bytes) -> dict:
    try:
        message = json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs,
            parse_constant=lambda _: (_ for _ in ()).throw(UploadError("invalid_format")))
    except (UnicodeError, ValueError, RecursionError) as err:
        raise UploadError("invalid_format") from err
    if not isinstance(message, dict) or message.get("type") not in PURPOSES:
        raise UploadError("upload_purpose")
    if {"id", "upload_token", "upload_sha256"} & message.keys():
        raise UploadError("invalid_format")
    return message


@dataclass(slots=True)
class Upload:
    owner: str
    expires: float
    blocks: list[bytes] = field(default_factory=list)
    size: int = 0
    digest: str | None = None
    purpose: str | None = None
    revision: int = 0
    identity: object = field(default_factory=object)


@dataclass(frozen=True, slots=True)
class UploadSnapshot:
    """Lease plus immutable bytes; only this value may cross into an executor."""
    token: str
    owner: str
    identity: object
    revision: int
    blocks: tuple[bytes, ...]
    digest: str | None
    purpose: str | None


def prepare_finish(snapshot: UploadSnapshot) -> tuple[bytes, str, str]:
    raw = b"".join(snapshot.blocks)
    message = parse_payload(raw)
    return raw, hashlib.sha256(raw).hexdigest(), message["type"]


def prepare_resolution(snapshot: UploadSnapshot, compact: dict) -> dict:
    raw = snapshot.blocks[0]
    if hashlib.sha256(raw).hexdigest() != snapshot.digest:
        raise UploadError("upload_digest_mismatch")
    message = parse_payload(raw)
    for key in CONTROL_KEYS:
        if (key in compact) != (key in message) or key in compact and (type(compact[key]) is not type(message[key]) or compact[key] != message[key]):
            raise UploadError("upload_control_mismatch")
    return {**message, "id": compact["id"]}


class StructuralUploads:
    """Mutable records are owned by the HA event loop, never by its executor."""
    def __init__(self, *, clock: Callable[[], float] = time.time) -> None:
        self.clock = clock
        self.uploads: dict[str, Upload] = {}

    def _expire(self) -> None:
        now = self.clock()
        for key in list(self.uploads):
            if self.uploads[key].expires <= now:
                self.uploads.pop(key)

    def begin(self, owner: str, declared_size: int | None = None) -> str:
        self._expire()
        if not owner:
            raise UploadError("unauthorized")
        if declared_size is not None and (declared_size < 0 or declared_size > MAX_UPLOAD_BYTES):
            raise UploadError("too_large")
        # A new explicit upload replaces this user's uncommitted candidate,
        # without growing the per-user allowance or touching durable state.
        for key, value in list(self.uploads.items()):
            if value.owner == owner:
                self.uploads.pop(key)
        token = secrets.token_urlsafe(32)
        self.uploads[token] = Upload(owner, self.clock() + UPLOAD_TTL)
        return token

    def _get(self, token: str, owner: str) -> Upload:
        self._expire()
        value = self.uploads.get(token)
        if value is None:
            raise UploadError("upload_expired")
        if value.owner != owner:
            raise UploadError("upload_owner_mismatch")
        return value

    def append(self, token: str, owner: str, chunk: bytes) -> None:
        value = self._get(token, owner)
        if value.digest is not None:
            raise UploadError("upload_consumed")
        if value.size + len(chunk) > MAX_UPLOAD_BYTES:
            self.uploads.pop(token)
            raise UploadError("too_large")
        if sum(item.size for item in self.uploads.values()) + len(chunk) > MAX_STAGED_BYTES:
            self.uploads.pop(token)
            raise UploadError("upload_capacity")
        value.blocks.append(bytes(chunk))
        value.size += len(chunk)
        value.revision += 1

    def snapshot(self, token: str, owner: str) -> UploadSnapshot:
        value = self._get(token, owner)
        return UploadSnapshot(token, owner, value.identity, value.revision,
                              tuple(value.blocks), value.digest, value.purpose)

    def _lease(self, snapshot: UploadSnapshot) -> Upload:
        value = self._get(snapshot.token, snapshot.owner)
        if value.identity is not snapshot.identity or value.revision != snapshot.revision:
            raise UploadError("upload_consumed")
        return value

    def complete_finish(self, snapshot: UploadSnapshot, prepared: tuple[bytes, str, str]) -> dict:
        value = self._lease(snapshot)
        raw, digest, purpose = prepared
        value.blocks = [raw]
        value.digest, value.purpose = digest, purpose
        value.revision += 1
        return {"token": snapshot.token, "sha256": digest, "purpose": purpose,
                "expires_at": datetime.fromtimestamp(value.expires, timezone.utc).isoformat().replace("+00:00", "Z")}

    def finish(self, token: str, owner: str) -> dict:
        """Synchronous adapter for bounded callers/tests; HTTP uses the split API."""
        snapshot = self.snapshot(token, owner)
        try:
            prepared = prepare_finish(snapshot)
        except Exception:
            self.cancel(token, owner)
            raise
        return self.complete_finish(snapshot, prepared)

    def resolution_snapshot(self, compact: dict, owner: str) -> tuple[UploadSnapshot, dict]:
        token = compact.get("upload_token")
        if not isinstance(token, str):
            raise UploadError("invalid_format")
        value = self._get(token, owner)
        if value.digest is None or compact.get("type") != value.purpose:
            raise UploadError("upload_purpose")
        if compact.get("upload_sha256") != value.digest:
            raise UploadError("upload_digest_mismatch")
        if compact.keys() - CONTROL_KEYS - {"type", "id", "upload_token", "upload_sha256"}:
            raise UploadError("invalid_format")
        return self.snapshot(token, owner), copy.deepcopy(compact)

    def resolve(self, compact: dict, owner: str) -> dict:
        snapshot, message = self.resolution_snapshot(compact, owner)
        return prepare_resolution(snapshot, message)

    def consume(self, token: str, owner: str, snapshot: UploadSnapshot | None = None) -> None:
        if snapshot is not None:
            if token != snapshot.token or owner != snapshot.owner:
                raise UploadError("upload_owner_mismatch")
            self._lease(snapshot)
        else:
            self._get(token, owner)
        self.uploads.pop(token)

    def cancel(self, token: str, owner: str) -> None:
        value = self.uploads.get(token)
        if value and value.owner == owner:
            self.uploads.pop(token)


def uploads(runtime) -> StructuralUploads:
    value = getattr(runtime, "structural_uploads", None)
    if value is None:
        value = StructuralUploads()
        runtime.structural_uploads = value
    return value
