"""Shared plan journal values and exact maintenance candidates, without storage."""
from __future__ import annotations

import copy

from .command_ports import PlanPair
from .constants import DEFAULT_CONFIG
from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
)

OPTIMIZE_BACKUP = "optimize_backup"
OPTIMIZE_PENDING = "optimize_pending"
LAYOUT_CORE_KEYS = frozenset({"layout", "rev"})


def layout_metadata(data: dict) -> dict:
    return {key: value for key, value in data.items() if key not in LAYOUT_CORE_KEYS}


def optimizer_backup_is_current(config_data: dict, layout_data: dict) -> bool:
    backup = layout_data.get(OPTIMIZE_BACKUP)
    if not isinstance(backup, dict):
        return False
    try:
        return (int(backup.get("after_config_rev", -1)) == int(config_data.get("rev", 0))
                and int(backup.get("after_layout_rev", -1)) == int(layout_data.get("rev", 0)))
    except (TypeError, ValueError):
        return False


def undo_kind(config_data: dict, layout_data: dict) -> str | None:
    if not optimizer_backup_is_current(config_data, layout_data):
        return None
    return str(layout_data[OPTIMIZE_BACKUP].get("kind") or "optimize")


def optimizer_backup_after_layout_maintenance(data: dict, rev: int) -> dict:
    backup = data.get(OPTIMIZE_BACKUP)
    return {OPTIMIZE_BACKUP: {**backup, "after_layout_rev": rev}} if isinstance(backup, dict) else {}


def maintenance_pair(kind: str, config: dict, layout: dict, previous: PlanPair,
                     config_rev: int, layout_rev: int, metadata: dict, *,
                     canonical_config: bool = True) -> tuple[dict, dict]:
    target = {"kind": kind, "config": canonicalize_config_geometry(config) if canonical_config else copy.deepcopy(config),
              "layout": canonicalize_layout_geometry(layout), "config_rev": config_rev,
              "layout_rev": layout_rev, "final_metadata": metadata}
    rollback = {"kind": kind + "_rollback",
                "config": canonicalize_config_geometry(previous.config_data.get("config") or DEFAULT_CONFIG),
                "layout": canonicalize_layout_geometry(previous.layout_data.get("layout") or {}),
                "config_rev": int(previous.config_data.get("rev", 0)),
                "layout_rev": int(previous.layout_data.get("rev", 0)),
                "final_metadata": layout_metadata(previous.layout_data)}
    return target, rollback
