"""Immutable original logical pair, referenced by small migration metadata.

Write and verify this source before the recoverable pair intent. Ordinary
layout saves carry only its reference, not another complete configuration.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re

from homeassistant.helpers.storage import Store

from .plan_graph_exact import GraphError

SOURCE_VERSION = 1
MAX_SOURCE_BYTES = 32 * 1024 * 1024
SOURCE_KEY_PREFIX = "houseplan.plan_graph_source."
BACKUP_KEY = "plan_graph_migration_backup"
PASSPORT_KEY = "plan_graph_migration"
_DIGEST = re.compile(r"[0-9a-f]{64}\Z")


def source_bytes(source: dict) -> bytes:
    try:
        raw = json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    except (TypeError, ValueError, RecursionError) as err:
        raise GraphError("invalid_migration_source") from err
    if len(raw) > MAX_SOURCE_BYTES:
        raise GraphError("migration_source_limit", code="plan_graph_resource_limit")
    return raw


def logical_source(config_data: dict, layout_data: dict) -> dict:
    source = {"version": SOURCE_VERSION,
              "config": copy.deepcopy(config_data.get("config") or {}),
              "layout": copy.deepcopy(layout_data.get("layout") or {}),
              "config_rev": int(config_data.get("rev", 0)),
              "layout_rev": int(layout_data.get("rev", 0)),
              "model_version": (config_data.get("config") or {}).get("model_version", 0),
              "passports": {key: copy.deepcopy(layout_data[key]) for key in ("config_migration", PASSPORT_KEY) if key in layout_data}}
    source_bytes(source)
    return source


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
