"""Immutable original logical pair, referenced by small migration metadata.

Write and verify this source before the recoverable pair intent. Ordinary
layout saves carry only its reference, not another complete configuration.
"""
from __future__ import annotations

import hashlib

from homeassistant.helpers.storage import Store

from .core.plan_graph_source import (
    _DIGEST as _DIGEST,
)
from .core.plan_graph_source import (
    BACKUP_KEY as BACKUP_KEY,
)
from .core.plan_graph_source import (
    MAX_SOURCE_BYTES as MAX_SOURCE_BYTES,
)
from .core.plan_graph_source import (
    PASSPORT_KEY as PASSPORT_KEY,
)
from .core.plan_graph_source import (
    PREVIOUS_BACKUP_KEY as PREVIOUS_BACKUP_KEY,
)
from .core.plan_graph_source import (
    SOURCE_KEY_PREFIX as SOURCE_KEY_PREFIX,
)
from .core.plan_graph_source import (
    SOURCE_VERSION as SOURCE_VERSION,
)
from .core.plan_graph_source import (
    GraphError as GraphError,
)
from .core.plan_graph_source import (
    copy as copy,
)
from .core.plan_graph_source import (
    json as json,
)
from .core.plan_graph_source import (
    logical_source as logical_source,
)
from .core.plan_graph_source import (
    re as re,
)
from .core.plan_graph_source import (
    source_bytes as source_bytes,
)


def _store(hass, digest: str):
    return Store(hass, SOURCE_VERSION, SOURCE_KEY_PREFIX + digest)


async def save_source(hass, source: dict) -> dict:
    raw = await hass.async_add_executor_job(source_bytes, source)
    digest = hashlib.sha256(raw).hexdigest()
    target = {"version": SOURCE_VERSION, "sha256": digest, "source": copy.deepcopy(source)}
    store = _store(hass, digest)
    existing = await store.async_load()
    if existing is not None and existing != target:
        raise GraphError("migration_source_corrupt")
    if existing is None:
        try:
            await store.async_save(target)
        except Exception:
            # A storage call can fail after atomic replacement. Only exact
            # durable readback permits continuation to the pair intent.
            if await store.async_load() != target:
                raise
    if await store.async_load() != target:
        raise GraphError("migration_source_not_durable")
    return {"version": SOURCE_VERSION, "sha256": digest, "store": SOURCE_KEY_PREFIX + digest, "bytes": len(raw)}


async def load_source(hass, reference: dict) -> dict:
    if not isinstance(reference, dict) or type(reference.get("version")) is not int or reference["version"] != SOURCE_VERSION:
        raise GraphError("invalid_migration_source_reference")
    digest = reference.get("sha256")
    if not isinstance(digest, str) or not _DIGEST.fullmatch(digest) or reference.get("store") != SOURCE_KEY_PREFIX + digest:
        raise GraphError("invalid_migration_source_reference")
    stored = await _store(hass, digest).async_load()
    if not isinstance(stored, dict) or stored.get("version") != SOURCE_VERSION or stored.get("sha256") != digest or not isinstance(stored.get("source"), dict):
        raise GraphError("migration_source_missing")
    raw = await hass.async_add_executor_job(source_bytes, stored["source"])
    if hashlib.sha256(raw).hexdigest() != digest or len(raw) != reference.get("bytes"):
        raise GraphError("migration_source_corrupt")
    return copy.deepcopy(stored["source"])


async def load_source_at(hass, reference: dict, digest: str | None = None) -> dict:
    """Select only a verified ancestor of the current immutable source."""
    seen = set()
    while isinstance(reference, dict) and reference.get("sha256") not in seen:
        seen.add(reference.get("sha256"))
        source = await load_source(hass, reference)
        if digest is None or reference["sha256"] == digest:
            return source
        reference = source.get("passports", {}).get(PREVIOUS_BACKUP_KEY)
    raise GraphError("migration_source_missing")
