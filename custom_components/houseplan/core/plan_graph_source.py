"""Canonical immutable migration-source encoding, without HA storage."""
from __future__ import annotations

import copy as copy
import json as json
import re as re

from .plan_graph_exact import GraphError as GraphError

SOURCE_VERSION = 1
MAX_SOURCE_BYTES = 32 * 1024 * 1024
SOURCE_KEY_PREFIX = "houseplan.plan_graph_source."
BACKUP_KEY = "plan_graph_migration_backup"
PASSPORT_KEY = "plan_graph_migration"
PREVIOUS_BACKUP_KEY = "previous_backup"
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

