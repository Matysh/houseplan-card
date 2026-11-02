"""Authoritative model11 candidate preparation at structural writer boundaries."""
from __future__ import annotations

import copy
import json
from typing import Any

from .plan_graph import apply_graph_patch, project_graph_space, verify_projection
from .plan_graph_exact import GraphError
from .plan_graph_migration import migrate_graph_space

MAX_GRAPH_CONFIG_BYTES = 16 * 1024 * 1024


def check_graph_config_size(config):
    try:
        size = len(json.dumps(config, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8"))
    except (ValueError, TypeError, RecursionError) as error:
        raise GraphError("invalid_graph_document") from error
    if size > MAX_GRAPH_CONFIG_BYTES:
        raise GraphError("graph_document_limit", code="plan_graph_resource_limit")


def structural_projection(config):
    """Metadata, live HA values, marker faces and furniture do not migrate walls."""
    result = []
    for space in (config or {}).get("spaces", []):
        result.append({
            "id": space.get("id"),
            "plan_graph": space.get("plan_graph"),
            **{key: space.get(key, []) for key in ("room_drafts", "open_spans")},
            **{key: [{name: row.get(name) for name in ("id", "a", "b", "cm", "key")}
                      for row in space.get(key, [])] for key in ("wall_segments", "walls", "partitions")},
            "rooms": [{key: room.get(key) for key in ("id", "poly", "wall_ids", "x", "y", "w", "h", "open_to")} for room in space.get("rooms", [])],
            "openings": [{key: opening.get(key) for key in ("id", "x", "y", "angle", "length", "host")} for opening in space.get("openings", [])],
        })
    return result


def preserve_legacy_structure(checked, source):
    """An unrelated edit cannot trigger the old lattice snap before migration."""
    if structural_projection(checked) == structural_projection(source):
        return checked
    originals = {space["id"]: space for space in source.get("spaces", [])}
    for space in checked.get("spaces", []):
        raw = originals[space["id"]]
        for key in ("wall_segments", "walls", "partitions", "room_drafts", "open_spans"):
            if key in raw:
                space[key] = copy.deepcopy(raw[key])
            else:
                space.pop(key, None)
        for collection, fields in (("rooms", ("poly", "wall_ids", "x", "y", "w", "h", "open_to")), ("openings", ("x", "y", "angle", "length", "host"))):
            rows = {row["id"]: row for row in raw.get(collection, [])}
            for row in space.get(collection, []):
                for key in fields:
                    if key in rows[row["id"]]:
                        row[key] = copy.deepcopy(rows[row["id"]][key])
                    else:
                        row.pop(key, None)
    return checked


def normalize_graph_config(config: dict) -> dict:
    """Detached legacy decode+normalization; never current projection recovery."""
    check_graph_config_size(config)
    out = copy.deepcopy(config)
    model = int(out.get("model_version", 0) or 0)
    if model > 11:
        raise GraphError("unsupported_plan_model")
    if model == 11:
        for space in out.get("spaces", []):
            if space.get("room_drafts") == []:
                space.pop("room_drafts")
            verify_projection(space)
        return out
    from .wall_segment_model import _migrate_room_drafts_to_partitions
    converted = []
    for space in out.get("spaces", []):
        if "plan_graph" in space:
            raise GraphError("mixed_plan_models")
        _migrate_room_drafts_to_partitions(space)
        result = migrate_graph_space(space, {"cell_cm": space.get("cell_cm", out.get("settings", {}).get("cell_cm", 5)), "source_model_version": model})
        converted.append(result["space"])
    out["spaces"] = converted
    out["model_version"] = 11
    check_graph_config_size(out)
    return out


async def prepare_graph_pair(runtime, pending, rollback):
    """Persist an immutable logical source before the first graph intent."""
    from .plan_graph_source import BACKUP_KEY, PASSPORT_KEY, logical_source, save_source, load_source

    config_data = await runtime.config_store.async_load() or {}
    layout_data = await runtime.store.async_load() or {}
    previous = config_data.get("config") or {}
    # A failed first migration restores the actual logical source, not an
    # already snapped projection that a legacy caller used for its rollback.
    rollback["config"] = copy.deepcopy(previous)
    rollback["layout"] = copy.deepcopy(layout_data.get("layout", {}))
    candidate = pending["config"]
    current_model = int(previous.get("model_version", 0) or 0)
    target_model = int(candidate.get("model_version", 0) or 0)
    if current_model >= 11 and target_model < 11:
        if pending.get("kind") not in {"undo", "optimize_undo", "import_undo", "import", "backup", "backup_restore"}:
            raise GraphError("stale_plan_graph_writer", code="wall_model_client_outdated")
        candidate = await runtime.hass.async_add_executor_job(normalize_graph_config, candidate)
    elif target_model == 11:
        candidate = await runtime.hass.async_add_executor_job(normalize_graph_config, candidate)
    elif structural_projection(candidate) != structural_projection(previous):
        candidate = await runtime.hass.async_add_executor_job(normalize_graph_config, candidate)
    pending["config"] = candidate
    metadata = pending.setdefault("final_metadata", {})
    for key in (BACKUP_KEY, PASSPORT_KEY):
        if key in layout_data:
            metadata[key] = copy.deepcopy(layout_data[key])
    if current_model < 11 and candidate.get("model_version") == 11:
        if BACKUP_KEY in layout_data:
            await load_source(runtime.hass, layout_data[BACKUP_KEY])
            reference = copy.deepcopy(layout_data[BACKUP_KEY])
        else:
            source = await runtime.hass.async_add_executor_job(logical_source, config_data, layout_data)
            reference = await save_source(runtime.hass, source)
        metadata[BACKUP_KEY] = reference
        metadata[PASSPORT_KEY] = {"version": 1, "source_sha256": reference["sha256"], "source_model": current_model, "target_model": 11}


def prepare_graph_candidate(candidate: dict, previous: dict | None, change: Any = None, *, force=False, schema_will_validate=False) -> dict:
    """Apply a first-write ID delta to the independently normalized source.

    ``base`` is diagnostic input, never authority. It cannot overwrite a
    source coordinate that the user's explicit patch did not change.
    """
    previous = previous or {}
    old_model, new_model = int(previous.get("model_version", 0) or 0), int(candidate.get("model_version", 0) or 0)
    if old_model >= 11:
        if new_model != 11 or change is not None:
            raise GraphError("stale_plan_graph_writer", code="wall_model_client_outdated")
        return candidate if schema_will_validate else normalize_graph_config(candidate)
    if new_model < 11:
        if change is not None:
            raise GraphError("graph_change_without_current_model")
        if force or structural_projection(candidate) != structural_projection(previous):
            return normalize_graph_config(candidate)
        return candidate if schema_will_validate else copy.deepcopy(candidate)
    if new_model != 11:
        raise GraphError("unsupported_plan_model")
    # No stored source (bootstrap) has no migration delta to rebase.
    if not previous.get("spaces"):
        return normalize_graph_config(candidate)
    if not isinstance(change, dict) or change.get("version") != 1 or set(change) != {"version", "spaces"} or not isinstance(change["spaces"], list):
        raise GraphError("missing_first_graph_change")
    normalized = normalize_graph_config(previous)
    before = {s["id"]: s for s in normalized.get("spaces", [])}
    patches = {}
    for item in change["spaces"]:
        if not isinstance(item, dict) or set(item) != {"space_id", "base", "patch"} or item["space_id"] in patches or item["space_id"] not in before:
            raise GraphError("invalid_graph_change")
        patches[item["space_id"]] = item["patch"]
    out = copy.deepcopy(candidate)
    for index, space in enumerate(out.get("spaces", [])):
        identity = space["id"]
        if identity not in before:
            verify_projection(space)
            continue
        if identity not in patches:
            raise GraphError("missing_space_graph_change")
        result = apply_graph_patch(before[identity]["plan_graph"], patches[identity], {"room_ids": [r["id"] for r in space.get("rooms", [])]})
        out["spaces"][index] = project_graph_space(space, result["graph"])["space"]
    if set(patches) - {s["id"] for s in out.get("spaces", [])}:
        raise GraphError("graph_change_deleted_space")
    check_graph_config_size(out)
    return out
