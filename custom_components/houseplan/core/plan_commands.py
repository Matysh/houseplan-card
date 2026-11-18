"""Canonical plan command orchestration shared by HA and standalone hosts.

Transport decorators and HA lifecycle are adapters. These commands own the
ordering of CAS, validation, no-op, durable writes and observable events.
"""
from __future__ import annotations

import copy
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import voluptuous as vol

from .command_effects import BestEffortEffects
from .command_execution import (
    begin_preparation,
    command_preparation,
    finish_preparation,
)
from .command_ports import (
    CommandEffects,
    CommandEnvironment,
    CommandError,
    CommandPolicy,
    CpuExecutor,
    PairCommitFailure,
    PlanPair,
    PlanStorage,
    PlanTransaction,
    WriteAuthority,
)
from .command_state import (
    OPTIMIZE_BACKUP,
    OPTIMIZE_PENDING,
    layout_metadata,
    maintenance_pair,
    optimizer_backup_after_layout_maintenance,
    optimizer_backup_is_current,
    undo_kind,
)
from .constants import DECOR_ASSETS_API_VERSION, DEFAULT_CONFIG
from .contact_basis import validate_contact_bases
from .content_index import internal_plan_names
from .coordinate_canonicalization import (
    canonicalize_layout_geometry,
)
from .deletion_layout import deletion_layout_candidate
from .geometry_migration import migrate_layout
from .graph_validation_scope import graph_validation_scope
from .graph_write import prepare_graph_candidate, preserve_legacy_structure
from .import_export import live_layout
from .input_policy import HA_INPUT_POLICY, STRICT_INPUT_POLICY, InputLimit
from .junction_limits import JunctionLimitError, validate_junction_limits
from .led_strips import led_strip_link_report, preserve_led_strips
from .opening_features import guard_opening_features_write
from .plan_graph_exact import GraphError
from .plans import content_retirement
from .projection import project_config, project_layout
from .radar_validation import RadarValidationError, validate_marker_radars
from .room_appearance import config_appearance_materialized, normalize_room_appearance
from .space_copy import is_saved_space_copy
from .space_delete import _space_delete_target
from .validation import (
    CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    MAX_CONFIG_BYTES,
    MAX_LAYOUT,
    POS_SCHEMA,
    DuplicateMarkerIdError,
    MarkerControlError,
    OpeningPassageError,
    OrdinaryWriteScope,
    PartitionOpeningHostError,
    PartitionOpeningJambMarginError,
    WallModelClientOutdatedError,
    external_screens_config_event,
    ordinary_write_scope,
    prepare_ordinary_summary_candidate,
    summary_panel_entity_ids,
    valid_space_id,
    validate_active_marker_ids,
    validate_marker_controls,
    validate_marker_light_entities,
    validate_marker_vacuum_routes,
    validate_marker_value_badges,
    validate_opening_passages,
    validate_partition_opening_hosts,
    validate_scoped_candidate,
    validate_wall_model_transition,
)
from .wall_node_delete import NodeDeleteError, prepare_node_delete
from .wall_node_move import NodeMoveError, node_move_candidate, node_move_host_baseline
from .wall_segment_model import WallSegmentMigrationError

_LOGGER = logging.getLogger(__name__)


PLAN_APIS = {"wall_node_move_api": 1, "wall_node_merge_api": 1, "wall_node_attach_api": 1,
             "wall_node_delete_api": 1, "plan_graph_api": 1, "room_label_layout_api": 1,
             "graph_change_api": 2, "opening_features_api": 1, "structural_upload_api": 1,
             "decor_assets_api": DECOR_ASSETS_API_VERSION}


def changed_summary_entity_ids(config: dict, previous: dict | None) -> set[str] | None:
    settings = config.get("settings") if isinstance(config.get("settings"), dict) else {}
    old = (previous or {}).get("settings") if isinstance((previous or {}).get("settings"), dict) else {}
    if "summary_panel" not in settings or settings["summary_panel"] == old.get("summary_panel"):
        return None
    return summary_panel_entity_ids(settings["summary_panel"])


def radar_changed(config: dict, previous: dict | None) -> bool:
    old = {str(marker.get("id")): marker for marker in (previous or {}).get("markers") or []
           if isinstance(marker, dict)}
    for marker in config.get("markers") or []:
        if (isinstance(marker, dict) and marker.get("radar") is not None
                and marker["radar"] != old.get(str(marker.get("id")), {}).get("radar", object())):
            return True
    missing = object()
    new_settings = config.get("settings") if isinstance(config.get("settings"), dict) else {}
    old_settings = (previous or {}).get("settings") if isinstance((previous or {}).get("settings"), dict) else {}
    radar = new_settings.get("radar", missing)
    return radar is not missing and radar != old_settings.get("radar", missing)


@dataclass(slots=True)
class PlanCommands:
    storage: PlanStorage
    cpu: CpuExecutor
    authority: WriteAuthority
    effects: CommandEffects
    environment: CommandEnvironment | None = None

    def __post_init__(self):
        if not isinstance(self.effects, BestEffortEffects):
            self.effects = BestEffortEffects(self.effects)

    async def load(self, transaction: PlanTransaction) -> PlanPair:
        try:
            pair = await transaction.load()
        except CommandError:
            raise
        except Exception as error:
            raise CommandError("commit_failed",
                               "A previous House Plan save is pending recovery; retry or restart Home Assistant") from error
        if pair.recovered_kind is not None:
            self.effects.emit("houseplan_config_updated", {"rev": int(pair.config_data.get("rev", 0))})
            self.effects.emit("houseplan_layout_updated", {"rev": int(pair.layout_data.get("rev", 0))})
        begin_preparation()
        return pair

    async def execute(self, message: dict[str, Any]) -> dict[str, Any]:
        return await self._invoke(self._execute, message)

    async def _invoke(self, handler, *args):
        environment = self.environment
        policy = (environment.input_policy or (STRICT_INPUT_POLICY if environment.policy is CommandPolicy.PLAN_ONLY
                                              else HA_INPUT_POLICY)) if environment is not None else HA_INPUT_POLICY
        try:
            with command_preparation(policy):
                return await handler(*args)
        except InputLimit as error:
            raise CommandError(error.code) from error

    async def import_preview(self, raw: bytes, duplicate_policy: str = "skip") -> dict:
        from .portable_commands import import_preview

        return await self._invoke(import_preview, self, raw, duplicate_policy)

    async def house_preview(self, blocks, declared_size, operation_id) -> dict:
        from .house_commands import preview

        return await self._invoke(preview, self, blocks, declared_size, operation_id)

    async def upload_plan(self, raw: bytes, space_id: str, extension: str) -> dict:
        from .upload_commands import upload_plan

        return await self._invoke(upload_plan, self, raw, space_id, extension)

    async def upload_asset(self, raw: bytes, filename: str, mime: str | None = None) -> dict:
        from .upload_commands import upload_asset

        return await self._invoke(upload_asset, self, raw, filename, mime)

    async def stage_structural(self, blocks, declared_size: int | None = None) -> dict:
        from .staging_commands import stage

        return await self._invoke(stage, self, blocks, declared_size)

    async def resolve_structural(self, compact: dict, schema=None) -> dict:
        from .staging_commands import resolve

        return await self._invoke(resolve, self, compact, schema)

    def before_commit(self):
        finish_preparation()
        self.authority.ensure()

    async def _execute(self, message: dict[str, Any]) -> dict[str, Any]:
        operation = message.get("type")
        if operation in {"houseplan/plans/list", "houseplan/plans/delete", "houseplan/assets/list",
                         "houseplan/assets/resolve", "houseplan/assets/delete"}:
            from .content_commands import execute

            return await execute(self, message)
        if operation in {"houseplan/export/create", "houseplan/import/revalidate", "houseplan/import/apply",
                         "houseplan/backup/cancel"}:
            if message.get("kind") == "house" or message.get("transfer_kind") == "house":
                from . import house_commands

                handler = {"houseplan/export/create": house_commands.export_create,
                           "houseplan/import/revalidate": house_commands.revalidate,
                           "houseplan/import/apply": house_commands.apply,
                           "houseplan/backup/cancel": house_commands.cancel}[operation]
                return await handler(self, message)
            from . import portable_commands

            handlers = {"houseplan/export/create": portable_commands.export_create,
                        "houseplan/import/revalidate": portable_commands.import_revalidate,
                        "houseplan/import/apply": portable_commands.import_apply,
                        "houseplan/backup/cancel": portable_commands.backup_cancel}
            return await handlers[operation](self, message)
        if operation == "houseplan/config/get":
            return await self.config_get(message)
        if operation == "houseplan/layout/get":
            return await self.layout_get(message)
        if operation == "houseplan/layout/set":
            return await self.layout_set(message)
        if operation == "houseplan/config/set":
            return await self.config_set(message)
        if operation == "houseplan/space/delete":
            return await self.space_delete(message)
        if operation == "houseplan/geometry/repair":
            return await self.geometry_repair(message)
        if operation == "houseplan/plan/optimize":
            return await self.optimize(message)
        if operation == "houseplan/plan/optimize_undo":
            return await self.optimize_undo(message)
        if operation in {"houseplan/wall/node_move", "houseplan/wall/node_delete"}:
            return await self.node_edit(message)
        raise CommandError("invalid_format", "Unknown plan command")

    async def config_get(self, message: dict) -> dict:
        environment = self.environment
        if environment is None:
            raise CommandError("not_ready")
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            config = {**DEFAULT_CONFIG, **pair.config_data.get("config", {})}
            if not config_appearance_materialized(config):
                config = normalize_room_appearance(config)
            rev = int(pair.config_data.get("rev", 0))
            extras = await environment.evidence.configuration_extras(config, rev)
        return {**extras, "config": project_config(config, space_id=message.get("space_id"),
            fields=message.get("fields"), marker_fields=message.get("marker_fields")),
            "rev": rev, "can_write": self.authority.can_write,
            "can_optimize_undo": optimizer_backup_is_current(pair.config_data, pair.layout_data),
            "undo_kind": undo_kind(pair.config_data, pair.layout_data),
            "integration_version": environment.identity.integration_version,
            "frontend_fingerprint": environment.identity.frontend_fingerprint,
            "build": environment.identity.build, **PLAN_APIS,
            **({"house_transfer_api": 1} if environment.house is not None else {}),
            **({"graph_migration": {"version": 1, "source_available": True}}
               if isinstance(pair.layout_data.get("plan_graph_migration_backup"), dict) else {})}

    async def layout_get(self, message: dict) -> dict:
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
        data = pair.layout_data
        return {"layout": project_layout(data.get("layout", {}), space_id=message.get("space_id")),
                "rev": int(data.get("rev", 0)),
                "can_optimize_undo": optimizer_backup_is_current(pair.config_data, data),
                "undo_kind": undo_kind(pair.config_data, data)}

    async def layout_set(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Only administrators may edit the layout")
        self.authority.ensure()
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            data, config_data = pair.layout_data, pair.config_data
            current_rev = int(data.get("rev", 0))
            if ("expected_config_rev" in message
                    and message["expected_config_rev"] != int(config_data.get("rev", 0))):
                raise CommandError("conflict", "Device configuration changed elsewhere")
            if "expected_rev" not in message and current_rev:
                self.effects.missing_revision("layout/set", current_rev)
                raise CommandError("conflict",
                                   "Layout revision is required; reload the layout, or — for "
                                   "external clients — include expected_rev from "
                                   f"houseplan/layout/get (current rev {current_rev})")
            if "expected_rev" in message and message["expected_rev"] != current_rev:
                raise CommandError("conflict", f"Layout changed elsewhere (rev {current_rev})")
            try:
                layout = live_layout(config_data.get("config") or {}, LAYOUT_SCHEMA(message["layout"]))
                validate_contact_bases(layout, data.get("layout", {}))
            except (KeyError, vol.Invalid) as error:
                raise CommandError("invalid_format", str(error)) from error
            if layout == data.get("layout", {}):
                return {"ok": True, "rev": current_rev}
            new_rev = current_rev + 1
            self.before_commit()
            await transaction.save_layout(data, layout, new_rev,
                                          remove=(OPTIMIZE_BACKUP, OPTIMIZE_PENDING),
                                          authorize=self.authority.ensure)
            await self.effects.release_snapshot(data, config_data.get("config") or {}, {})
        self.effects.emit("houseplan_layout_updated", {"rev": new_rev})
        return {"ok": True, "rev": new_rev}

    async def discard_optimizer_snapshot(self, transaction: PlanTransaction) -> None:
        pair = await transaction.load()
        data = pair.layout_data
        if OPTIMIZE_BACKUP not in data and OPTIMIZE_PENDING not in data:
            return
        await transaction.save_layout(data, data.get("layout") or {}, int(data.get("rev", 0)),
                                      remove=(OPTIMIZE_BACKUP, OPTIMIZE_PENDING),
                                      authorize=self.authority.ensure)
        await self.effects.release_snapshot(data, pair.config_data.get("config") or {}, {})

    async def node_edit(self, message: dict) -> dict:
        """Move/delete share storage orchestration, not their distinct proofs."""
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Not allowed to edit the plan")
        self.authority.ensure()
        deleting = message["type"] == "houseplan/wall/node_delete"
        if (not valid_space_id(message.get("space_id")) or not isinstance(message.get("intent"), dict)
                or message.get("direction", "apply") not in {"apply", "undo"}):
            raise CommandError("invalid_format")
        if len(json.dumps(message, separators=(",", ":"))) > MAX_CONFIG_BYTES:
            raise CommandError("too_large", "Node operation exceeds the configuration limit")
        direction = message.get("direction", "apply")
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            data = pair.config_data
            rev = int(data.get("rev", 0))
            if message.get("expected_rev") != rev:
                raise CommandError("conflict", "Plan revision changed; reopen the menu before deleting a node"
                                   if deleting else "Plan revision changed; reload before moving a node")
            previous = data.get("config", {})

            def validate_node():
                if deleting:
                    prepared = prepare_node_delete(previous, message["space_id"], message["intent"],
                                                   direction, message.get("before_space"))
                    candidate = prepared.candidate
                    validate_wall_model_transition(candidate, previous)
                    candidate = CONFIG_SCHEMA(candidate)
                    validate_opening_passages(candidate, previous)
                    validate_partition_opening_hosts(candidate, prepared.host_baseline(candidate))
                    inherited = transaction.cache.junction_baseline
                    counts = validate_junction_limits(candidate, previous, baseline_counts=(
                        inherited[1] if inherited and inherited[0] == rev else None))
                    return candidate, counts
                with graph_validation_scope():
                    trusted = transaction.cache.schema_clean_rev == rev
                    candidate = node_move_candidate(previous, message["space_id"], message["intent"],
                                                    direction, message.get("before_space"), trusted_current=trusted)
                    scope = (ordinary_write_scope(candidate, previous) if trusted
                             else OrdinaryWriteScope(set(), set(), "stored document not stamped"))
                    touched = None if scope.full else scope.touched_spaces
                    validate_wall_model_transition(candidate, previous, touched=touched)
                    candidate = validate_scoped_candidate(candidate, previous, scope)
                    validate_opening_passages(candidate, previous)
                    baseline = node_move_host_baseline(previous, candidate, message["space_id"], message["intent"],
                                                      direction, message.get("before_space"), trusted_current=trusted)
                    validate_partition_opening_hosts(candidate, baseline)
                    inherited = transaction.cache.junction_baseline
                    counts = validate_junction_limits(candidate, previous, baseline_counts=(
                        inherited[1] if inherited and inherited[0] == rev else None), touched_spaces=touched)
                    return candidate, counts

            try:
                candidate, counts = await self.cpu.run(validate_node)
            except (NodeDeleteError, NodeMoveError, GraphError, JunctionLimitError,
                    WallModelClientOutdatedError, OpeningPassageError,
                    PartitionOpeningHostError, PartitionOpeningJambMarginError) as error:
                raise CommandError(error.code, str(error)) from error
            except vol.Invalid as error:
                raise CommandError(NodeDeleteError().code if deleting else NodeMoveError().code,
                                   "Invalid node deletion" if deleting else "Invalid node operation") from error
            except InputLimit:
                raise
            except Exception as error:
                _LOGGER.exception("House Plan: node processing failed")
                raise CommandError("node_delete_backend_unavailable" if deleting else "node_move_backend_unavailable",
                                   "Node deletion could not be processed; try again" if deleting
                                   else "Node operation could not be processed; try again") from error
            if candidate == previous:
                return {"ok": True, "rev": rev, "config": candidate}
            if len(json.dumps(candidate, separators=(",", ":"))) > MAX_CONFIG_BYTES:
                raise CommandError("too_large", "Result exceeds the configuration limit")
            new_rev = rev + 1
            self.before_commit()
            await transaction.save_config(candidate, new_rev, previous=data, canonical=not deleting,
                                          authorize=self.authority.ensure)
            transaction.cache.junction_baseline = (new_rev, counts)
            if not deleting:
                transaction.cache.schema_clean_rev = new_rev
            try:
                await self.discard_optimizer_snapshot(transaction)
            except Exception:  # noqa: BLE001 - the accepted write remains accepted
                _LOGGER.exception("House Plan: discarding stale optimization backup failed")
        self.effects.emit("houseplan_config_updated", {"rev": new_rev})
        return {"ok": True, "rev": new_rev, "config": candidate}

    async def config_set(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Only administrators may edit the configuration")
        self.authority.ensure()
        environment = self.environment
        if environment is None:
            raise CommandError("not_ready")
        if not isinstance(message.get("config"), dict):
            raise CommandError("invalid_format")
        candidate = copy.deepcopy(message["config"])
        size = len(json.dumps(candidate, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        if size > MAX_CONFIG_BYTES:
            raise CommandError("too_large", f"Configuration is {size // 1024} KB, the limit is {MAX_CONFIG_BYTES // 1024} KB")
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            data, layout_data = pair.config_data, pair.layout_data
            current_rev, layout_rev = int(data.get("rev", 0)), int(layout_data.get("rev", 0))
            contact_layout = None
            if any(key in message for key in ("contact_layout", "room_label_layout", "expected_layout_rev")):
                if (not any(key in message for key in ("contact_layout", "room_label_layout"))
                        or message.get("expected_layout_rev") != layout_rev):
                    raise CommandError("conflict", "Device layout changed elsewhere")
                try:
                    contacts = LAYOUT_SCHEMA(message.get("contact_layout", {}))
                    if "contact_layout" in message:
                        validate_contact_bases(contacts, layout_data.get("layout", {}))
                    labels = message.get("room_label_layout")
                    if labels is not None:
                        vol.All(vol.Schema({str: vol.Any(None, POS_SCHEMA)}), vol.Length(max=MAX_LAYOUT))(labels)
                except vol.Invalid as error:
                    raise CommandError("invalid_format", str(error)) from error
                contact_layout = {**(layout_data.get("layout") or {}), **contacts}
            if "expected_rev" not in message and current_rev:
                self.effects.missing_revision("config/set", current_rev)
                raise CommandError("conflict", "Configuration revision is required; reload the configuration, "
                                   "or — for external clients — include expected_rev from "
                                   f"houseplan/config/get (current rev {current_rev})")
            if "expected_rev" in message and message["expected_rev"] != current_rev:
                raise CommandError("conflict", f"Configuration was changed in another window (rev {current_rev} != {message['expected_rev']})")
            baseline = transaction.cache.junction_baseline
            baseline_counts = baseline[1] if baseline and baseline[0] == current_rev else None
            previous = data.get("config")
            try:
                guard_opening_features_write(candidate, previous, message.get("opening_features_api"))
            except vol.Invalid as error:
                raise CommandError(getattr(error, "code", "invalid_format"), str(error)) from error
            entity_ids = changed_summary_entity_ids(candidate, previous)
            readable = environment.evidence.readable_entity_ids(entity_ids) if entity_ids is not None else set()
            radar = environment.evidence.radar_registry() if radar_changed(candidate, previous) else None
            scoped = transaction.cache.schema_clean_rev == current_rev and bool(previous)
            preserve_led_strips(candidate, previous)
            led_report = led_strip_link_report(candidate)

            def validate_config():
                touched = None

                def normalize(source):
                    nonlocal touched
                    source = prepare_graph_candidate(source, previous, message.get("graph_change"), schema_will_validate=True)
                    scope = (ordinary_write_scope(source, previous) if scoped
                             else OrdinaryWriteScope(set(), set(), "stored document not stamped"))
                    touched = None if scope.full else set(scope.touched_spaces)
                    validate_wall_model_transition(source, previous, touched=touched)
                    checked = validate_scoped_candidate(source, previous, scope)
                    return preserve_legacy_structure(checked, source) if int(source.get("model_version", 0) or 0) < 11 else checked

                checked = prepare_ordinary_summary_candidate(candidate, previous, readable, normalize)
                copied = is_saved_space_copy(checked, previous)
                geometry_previous = checked if copied else previous
                validate_active_marker_ids(checked, previous)
                validate_marker_controls(checked, previous)
                validate_marker_light_entities(checked, previous)
                validate_marker_radars(checked, previous, registry=radar)
                validate_marker_value_badges(checked, previous)
                validate_marker_vacuum_routes(checked, previous)
                validate_opening_passages(checked, previous)
                validate_partition_opening_hosts(checked, geometry_previous, allow_room_wall_promotion=True)
                counts = validate_junction_limits(checked, geometry_previous,
                    baseline_counts=None if copied else baseline_counts,
                    touched_spaces=touched if baseline_counts is not None and not copied else None)
                return checked, counts

            try:
                candidate, counts = await self.cpu.run(validate_config)
            except (DuplicateMarkerIdError, JunctionLimitError, MarkerControlError, OpeningPassageError,
                    PartitionOpeningHostError, PartitionOpeningJambMarginError, WallModelClientOutdatedError,
                    RadarValidationError, GraphError) as error:
                raise CommandError(error.code, str(error)) from error
            except vol.Invalid as error:
                raise CommandError("invalid_format", str(error)) from error
            newly_named = internal_plan_names(candidate) - internal_plan_names(previous)
            missing = newly_named - await environment.content.existing_plans(newly_named)
            if missing:
                raise CommandError("missing_plan", "Plan file no longer exists: " + ", ".join(sorted(missing)))
            if "contact_layout" in message:
                contact_layout = live_layout(candidate, contact_layout)
            try:
                owned_layout, layout_changes = await self.cpu.run(deletion_layout_candidate,
                    previous or {}, candidate, contact_layout if contact_layout is not None else layout_data.get("layout") or {},
                    message.get("room_label_layout"))
            except vol.Invalid as error:
                raise CommandError("invalid_format", str(error)) from error
            if layout_changes or "room_label_layout" in message:
                if len(owned_layout) > MAX_LAYOUT:
                    raise CommandError("invalid_format", "Too many saved layout positions")
                contact_layout = owned_layout
            if candidate == previous and (contact_layout is None or contact_layout == layout_data.get("layout", {})):
                self.effects.schedule_repairs()
                unchanged = {"ok": True, "rev": current_rev}
                if contact_layout is not None:
                    unchanged.update(layout_rev=layout_rev,
                                     contact_layout={key: contact_layout.get(key) for key in message.get("contact_layout", {})})
                return unchanged
            new_rev = current_rev + (candidate != previous)
            self.before_commit()
            try:
                if contact_layout is None:
                    await transaction.save_config(candidate, new_rev, previous=data, canonical=True,
                                                  authorize=self.authority.ensure)
                else:
                    original_metadata = layout_metadata(layout_data)
                    final_metadata = {key: value for key, value in original_metadata.items()
                                      if key not in {OPTIMIZE_BACKUP, OPTIMIZE_PENDING}}
                    next_layout_rev = layout_rev + (contact_layout != layout_data.get("layout", {}))
                    await transaction.commit_pair({"kind": "config_layout", "config": candidate,
                        "layout": contact_layout, "config_rev": new_rev, "layout_rev": next_layout_rev,
                        "final_metadata": final_metadata}, {"kind": "config_layout_rollback",
                        "config": previous or DEFAULT_CONFIG, "layout": layout_data.get("layout") or {},
                        "config_rev": current_rev, "layout_rev": layout_rev,
                        "final_metadata": original_metadata}, authorize=self.authority.ensure)
            except PairCommitFailure as error:
                raise CommandError("commit_failed", "Configuration/layout save failed; reload the plan") from error
            transaction.cache.junction_baseline = (new_rev, counts)
            transaction.cache.schema_clean_rev = new_rev
            try:
                await self.discard_optimizer_snapshot(transaction)
            except Exception:  # noqa: BLE001 - post-commit cleanup cannot reject a durable write
                _LOGGER.exception("House Plan: discarding stale optimization backup failed")
            try:
                intent = content_retirement(previous, candidate, self.effects.pinned_attachment_refs())
                await environment.content.retire(intent)
            except Exception:  # noqa: BLE001 - preserves existing best-effort cleanup
                _LOGGER.exception("House Plan: collecting superseded files failed")
            await self.effects.purge_trails(candidate)
        self.effects.emit("houseplan_config_updated", external_screens_config_event(
            previous or DEFAULT_CONFIG, candidate, current_rev, int(new_rev)))
        if contact_layout is not None:
            self.effects.emit("houseplan_layout_updated", {"rev": next_layout_rev})
        self.effects.refresh_trails()
        self.effects.schedule_repairs()
        result = {"ok": True, "rev": new_rev}
        if candidate.get("model_version") == 11:
            # Reply with this accepted pair, not a post-commit reread that can
            # fail or observe another writer while keeping our older config.
            result.update(config=candidate,
                          layout=contact_layout if contact_layout is not None else layout_data.get("layout", {}),
                          config_rev=new_rev, layout_rev=next_layout_rev if contact_layout is not None else layout_rev)
        if contact_layout is not None:
            result.update(layout_rev=next_layout_rev,
                          contact_layout={key: contact_layout.get(key) for key in message.get("contact_layout", {})},
                          layout_changes=layout_changes)
        if any(led_report.values()):
            result["led_strips"] = led_report
        return result

    async def space_delete(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Only editors may delete spaces")
        self.authority.ensure()
        space_id = message.get("space_id")
        if not valid_space_id(space_id):
            raise CommandError("invalid_space_id", "Invalid space id")
        try:
            async with self.storage.transaction() as transaction:
                pair = await self.load(transaction)
                config_rev, layout_rev = int(pair.config_data.get("rev", 0)), int(pair.layout_data.get("rev", 0))
                if message.get("expected_config_rev") != config_rev or message.get("expected_layout_rev") != layout_rev:
                    raise CommandError("conflict", "Plan changed elsewhere")
                config, layout = pair.config_data.get("config") or DEFAULT_CONFIG, pair.layout_data.get("layout") or {}
                if not any(space.get("id") == space_id for space in config.get("spaces") or []):
                    raise CommandError("space_not_found", "Space no longer exists")
                next_config, next_layout = config_rev + 1, layout_rev + 1

                def prepare_delete():
                    candidate, positions, dependencies, removed_layout, removed_markers = _space_delete_target(
                        config, layout, space_id, remove_markers=message.get("remove_markers", False))
                    guard_opening_features_write(candidate, config, message.get("opening_features_api"))
                    spaces = config.get("spaces") or []
                    last = len(spaces) == 1 and spaces[0].get("id") == space_id
                    if dependencies and not last:
                        return None, None, dependencies, removed_layout, removed_markers
                    candidate = CONFIG_SCHEMA(candidate)
                    validate_active_marker_ids(candidate, config)
                    positions = LAYOUT_SCHEMA(positions)
                    metadata = {key: value for key, value in layout_metadata(pair.layout_data).items()
                                if key not in {OPTIMIZE_BACKUP, OPTIMIZE_PENDING, "repair_backup", "geom_pending"}}
                    metadata[OPTIMIZE_BACKUP] = {"kind": "space_delete", "config": copy.deepcopy(config),
                        "layout": copy.deepcopy(layout), "created": int(time.time()),
                        "after_config_rev": next_config, "after_layout_rev": next_layout}
                    target, rollback = maintenance_pair("space_delete", candidate, positions, pair,
                                                        next_config, next_layout, metadata)
                    return target, rollback, dependencies, removed_layout, removed_markers

                target, rollback, dependencies, removed_layout, removed_markers = await self.cpu.run(prepare_delete)
                if target is None:
                    raise CommandError("space_in_use", f"Space is still used by {len(dependencies)} active marker(s)")
                self.before_commit()
                await transaction.commit_pair(target, rollback, authorize=self.authority.ensure)
                if removed_markers:
                    await self.effects.forget_deleted_markers(target["config"], removed_markers)
        except PairCommitFailure as error:
            raise CommandError("commit_failed", "Space delete failed; the previous plan is pending recovery"
                               if error.recovery_pending else "Space delete failed and the previous plan was restored") from error
        except CommandError:
            raise
        except InputLimit:
            raise
        except DuplicateMarkerIdError as error:
            raise CommandError(error.code, str(error)) from error
        except vol.Invalid as error:
            raise CommandError(getattr(error, "code", "invalid_config"), str(error)) from error
        except Exception as error:
            # Preserve stable portable failures rather than leaking their details.
            from .import_export import ImportFailure

            if isinstance(error, ImportFailure):
                raise
            _LOGGER.exception("House Plan space delete failed")
            raise CommandError("commit_failed", "Space delete failed") from error
        self.effects.emit("houseplan_config_updated", {"rev": next_config})
        self.effects.emit("houseplan_layout_updated", {"rev": next_layout})
        self.effects.refresh_trails()
        return {"ok": True, "config_rev": next_config, "layout_rev": next_layout,
                "removed_layout": removed_layout, "removed_markers": removed_markers,
                "can_undo": True, "config": target["config"], "layout": target["layout"]}

    async def geometry_repair(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Only administrators may repair the layout")
        self.authority.ensure()
        space_id = message.get("space_id")
        if not valid_space_id(space_id):
            raise CommandError("invalid_space_id", "Invalid space id")
        try:
            aspect = vol.All(vol.Coerce(float), vol.Range(min=.05, max=20))(message.get("aspect"))
        except vol.Invalid as error:
            raise CommandError("invalid_format", str(error)) from error
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            data = pair.layout_data
            positions, rev = data.get("layout") or {}, int(data.get("rev", 0))
            if "expected_rev" in message and message["expected_rev"] != rev:
                raise CommandError("conflict", f"Layout was changed in another window (rev {rev} != {message['expected_rev']})")
            if message.get("undo"):
                backup = data.get("repair_backup")
                if not isinstance(backup, dict) or backup.get("space") != space_id:
                    raise CommandError("no_backup", "No repair backup stored for this space")
                restored = {**positions, **(backup.get("positions") or {})}
                next_rev = rev + 1
                self.before_commit()
                await transaction.save_layout(data, restored, next_rev,
                    metadata=optimizer_backup_after_layout_maintenance(data, next_rev),
                    remove=("repair_backup",), authorize=self.authority.ensure)
                self.effects.emit("houseplan_layout_updated", {"rev": next_rev})
                return {"ok": True, "rev": next_rev, "restored": len(backup.get("positions") or {})}
            touched = {key: dict(pos) for key, pos in positions.items()
                       if isinstance(pos, dict) and str(pos.get("s")) == space_id}
            if not touched:
                raise CommandError("nothing_to_repair", f"No stored positions belong to space '{space_id}'")
            preview = {key: dict(pos) for key, pos in touched.items()}
            migrate_layout(preview, {space_id: aspect})
            if message.get("dry_run"):
                return {"ok": True, "dry_run": True, "moved": len(preview), "before": touched, "after": preview}
            next_rev = rev + 1
            self.before_commit()
            await transaction.save_layout(data, {**positions, **preview}, next_rev,
                metadata={**optimizer_backup_after_layout_maintenance(data, next_rev),
                          "repair_backup": {"space": space_id, "positions": canonicalize_layout_geometry(touched)}},
                remove=("repair_backup",), authorize=self.authority.ensure)
        self.effects.emit("houseplan_layout_updated", {"rev": next_rev})
        return {"ok": True, "rev": next_rev, "moved": len(preview)}

    async def optimize(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Houseplan write permission is required to optimize plans")
        self.authority.ensure()
        environment = self.environment
        if environment is None:
            raise CommandError("not_ready")
        if not isinstance(message.get("config"), dict) or not isinstance(message.get("layout"), dict):
            raise CommandError("invalid_format")
        size = len(json.dumps(message["config"], separators=(",", ":")))
        if size > MAX_CONFIG_BYTES:
            raise CommandError("too_large", f"Configuration is {size // 1024} KB, the limit is {MAX_CONFIG_BYTES // 1024} KB")
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            config_data, layout_data = pair.config_data, pair.layout_data
            config_rev, layout_rev = int(config_data.get("rev", 0)), int(layout_data.get("rev", 0))
            if message.get("expected_config_rev") != config_rev or message.get("expected_layout_rev") != layout_rev:
                raise CommandError("conflict", f"Plan changed elsewhere (config {config_rev}, layout {layout_rev})")
            previous = config_data.get("config")
            try:
                guard_opening_features_write(message["config"], previous, message.get("opening_features_api"))
            except vol.Invalid as error:
                raise CommandError(getattr(error, "code", "invalid_format"), str(error)) from error
            readable = environment.evidence.readable_entity_ids(None)
            radar = environment.evidence.radar_registry()

            def validate_optimize():
                def normalize(candidate):
                    validate_opening_passages(candidate, previous)
                    candidate = prepare_graph_candidate(candidate, previous, message.get("graph_change"), force=True)
                    validate_wall_model_transition(candidate, previous)
                    return CONFIG_SCHEMA(candidate)

                checked = prepare_ordinary_summary_candidate(copy.deepcopy(message["config"]), previous, readable, normalize)
                if len(json.dumps(checked, separators=(",", ":"))) > MAX_CONFIG_BYTES:
                    raise CommandError("too_large", "Configuration exceeds the store limit")
                validate_active_marker_ids(checked, previous)
                validate_marker_controls(checked, previous)
                validate_marker_light_entities(checked, previous)
                validate_marker_radars(checked, previous, registry=radar)
                validate_marker_value_badges(checked, previous)
                validate_marker_vacuum_routes(checked, previous)
                validate_opening_passages(checked, previous)
                validate_partition_opening_hosts(checked, previous, allow_optimize_rehost=True)
                counts = validate_junction_limits(checked, previous)
                return checked, LAYOUT_SCHEMA(message["layout"]), counts

            try:
                candidate, layout, counts = await self.cpu.run(validate_optimize)
            except (DuplicateMarkerIdError, JunctionLimitError, MarkerControlError, OpeningPassageError,
                    PartitionOpeningHostError, PartitionOpeningJambMarginError, WallModelClientOutdatedError,
                    WallSegmentMigrationError, RadarValidationError, GraphError) as error:
                raise CommandError(error.code, str(error)) from error
            except vol.Invalid as error:
                raise CommandError("invalid_format", str(error)) from error
            newly_named = internal_plan_names(candidate) - internal_plan_names(previous)
            missing = newly_named - await environment.content.existing_plans(newly_named)
            if missing:
                raise CommandError("missing_plan", "Plan file no longer exists: " + ", ".join(sorted(missing)))
            next_config, next_layout = config_rev + 1, layout_rev + 1
            metadata = {key: value for key, value in layout_metadata(layout_data).items()
                        if key not in {OPTIMIZE_BACKUP, OPTIMIZE_PENDING, "repair_backup", "geom_pending"}}
            metadata[OPTIMIZE_BACKUP] = {"kind": "optimize", "config": copy.deepcopy(previous or DEFAULT_CONFIG),
                "layout": canonicalize_layout_geometry(layout_data.get("layout", {})), "created": int(time.time()),
                "after_config_rev": next_config, "after_layout_rev": next_layout}
            target, rollback = maintenance_pair("optimize", candidate, layout, pair, next_config, next_layout, metadata)
            self.before_commit()
            try:
                await transaction.commit_pair(target, rollback, authorize=self.authority.ensure)
            except PairCommitFailure as error:
                raise CommandError("commit_failed", "Plan optimization failed; the previous plan is pending recovery"
                                   if error.recovery_pending else "Plan optimization failed and the previous plan was restored") from error
            transaction.cache.junction_baseline = (next_config, counts or {})
        self.effects.emit("houseplan_config_updated", {"rev": next_config})
        self.effects.emit("houseplan_layout_updated", {"rev": next_layout})
        self.effects.refresh_trails()
        return {"ok": True, "config_rev": next_config, "layout_rev": next_layout, "can_undo": True,
                "config": target["config"], "layout": target["layout"]}

    async def optimize_undo(self, message: dict) -> dict:
        if not self.authority.can_write:
            raise CommandError("unauthorized", "Houseplan write permission is required to undo optimization")
        self.authority.ensure()
        async with self.storage.transaction() as transaction:
            pair = await self.load(transaction)
            config_rev, layout_rev = int(pair.config_data.get("rev", 0)), int(pair.layout_data.get("rev", 0))
            if message.get("expected_config_rev") != config_rev or message.get("expected_layout_rev") != layout_rev:
                raise CommandError("conflict", "Plan changed elsewhere")
            if not optimizer_backup_is_current(pair.config_data, pair.layout_data):
                raise CommandError("no_backup", "The optimization backup is unavailable or a later edit made it stale")
            backup = pair.layout_data[OPTIMIZE_BACKUP]
            restored_kind = str(backup.get("kind") or "optimize")
            if "archive_snapshot" in backup or (restored_kind == "import" and (
                    self.environment is None or self.environment.policy is CommandPolicy.PLAN_ONLY)):
                raise CommandError("invalid_format", "This undo requires the installation backup adapter")
            restored = copy.deepcopy(backup.get("config") or DEFAULT_CONFIG)
            layout = canonicalize_layout_geometry(backup.get("layout") or {})
            metadata = {key: value for key, value in layout_metadata(pair.layout_data).items()
                        if key not in {OPTIMIZE_BACKUP, OPTIMIZE_PENDING, "repair_backup"}}
            next_config, next_layout = config_rev + 1, layout_rev + 1
            target, rollback = maintenance_pair("import_undo" if restored_kind == "import" else "optimize_undo",
                restored, layout, pair, next_config, next_layout, metadata, canonical_config=False)
            self.before_commit()
            try:
                await transaction.commit_pair(target, rollback, authorize=self.authority.ensure)
            except PairCommitFailure as error:
                raise CommandError("commit_failed", "Plan undo failed; the previous plan is pending recovery"
                                   if error.recovery_pending else "Plan undo failed and the previous plan was restored") from error
        self.effects.emit("houseplan_config_updated", {"rev": next_config})
        self.effects.emit("houseplan_layout_updated", {"rev": next_layout})
        if restored_kind == "import":
            await self.effects.purge_trails(restored)
            self.effects.schedule_repairs()
        self.effects.refresh_trails()
        return {"ok": True, "config_rev": next_config, "layout_rev": next_layout, "can_undo": False,
                "config": target["config"], "layout": target["layout"]}
