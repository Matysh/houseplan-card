"""Compatibility exports for the canonical plan core; no copied algorithms."""
from __future__ import annotations

from .core.graph_write import (
    MAX_GRAPH_CONFIG_BYTES as MAX_GRAPH_CONFIG_BYTES,
)
from .core.graph_write import (
    Any as Any,
)
from .core.graph_write import (
    GraphError as GraphError,
)
from .core.graph_write import (
    apply_graph_patch as apply_graph_patch,
)
from .core.graph_write import (
    check_graph_config_size as check_graph_config_size,
)
from .core.graph_write import (
    copy as copy,
)
from .core.graph_write import (
    json as json,
)
from .core.graph_write import (
    migrate_graph_space as migrate_graph_space,
)
from .core.graph_write import (
    normalize_graph_config as normalize_graph_config,
)
from .core.graph_write import (
    prepare_graph_candidate as prepare_graph_candidate,
)
from .core.graph_write import (
    preserve_legacy_structure as preserve_legacy_structure,
)
from .core.graph_write import (
    project_graph_space as project_graph_space,
)
from .core.graph_write import (
    structural_projection as structural_projection,
)
from .core.graph_write import (
    verify_projection as verify_projection,
)


async def prepare_graph_pair(runtime, pending, rollback):
    """Persist an immutable logical source before the first graph intent."""
    from .plan_graph_source import (
        BACKUP_KEY,
        PASSPORT_KEY,
        PREVIOUS_BACKUP_KEY,
        load_source,
        logical_source,
        save_source,
        source_bytes,
    )

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
        source = await runtime.hass.async_add_executor_job(logical_source, config_data, layout_data)
        previous_source = None
        if BACKUP_KEY in layout_data:
            previous_source = await load_source(runtime.hass, layout_data[BACKUP_KEY])
        # History is not part of the logical pair's freshness, but revisions,
        # config/layout content and passports are. Never reuse merely by presence.
        comparable = copy.deepcopy(previous_source)
        if comparable is not None:
            comparable.get("passports", {}).pop(PREVIOUS_BACKUP_KEY, None)
        same = comparable is not None and await runtime.hass.async_add_executor_job(source_bytes, comparable) == await runtime.hass.async_add_executor_job(source_bytes, source)
        if same:
            reference = copy.deepcopy(layout_data[BACKUP_KEY])
        else:
            if BACKUP_KEY in layout_data:
                source["passports"][PREVIOUS_BACKUP_KEY] = copy.deepcopy(layout_data[BACKUP_KEY])
            reference = await save_source(runtime.hass, source)
        metadata[BACKUP_KEY] = reference
        metadata[PASSPORT_KEY] = {"version": 1, "source_sha256": reference["sha256"], "source_model": current_model, "target_model": 11}

