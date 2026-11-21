"""HA storage, authority and event adapters for the canonical command service."""
from __future__ import annotations

import contextvars
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from .auth import may_write
from .const import (
    SUMMARY_PANEL_API_VERSION,
    SUPPORT_API_VERSION,
    VERSION,
)
from .core.command_ports import (
    CommandEnvironment,
    CommandError,
    CommandPolicy,
    HostIdentity,
    PlanPair,
)
from .core.content_files import FilesystemContent
from .core.import_leases import DictionaryImportLeases
from .core.plan_commands import PlanCommands, optimizer_backup_is_current
from .import_export import ImportFailure
from .radar_validation import radar_registry_evidence
from .store import (
    async_resolve_pending_pair,
    async_save_config_state,
    async_save_layout_state,
    get_data,
)

_LOGGER = logging.getLogger(__name__)


class HaCommandCache:
    """Share exact-revision stamps with writers not extracted yet."""

    def __init__(self, runtime):
        self.runtime = runtime

    @property
    def junction_baseline(self):
        return self.runtime.junction_baseline

    @junction_baseline.setter
    def junction_baseline(self, value):
        self.runtime.junction_baseline = value

    @property
    def schema_clean_rev(self):
        return self.runtime.schema_clean_rev

    @schema_clean_rev.setter
    def schema_clean_rev(self, value):
        self.runtime.schema_clean_rev = value


class HaPlanTransaction:
    def __init__(self, runtime):
        self.runtime = runtime
        self.cache = HaCommandCache(runtime)

    async def load(self):
        pair = await async_resolve_pending_pair(self.runtime)
        return PlanPair(pair.config_data, pair.layout_data, pair.recovered_kind)

    async def save_config(self, config, rev, *, previous, canonical, authorize):
        from .zigbee_topology import ZigbeeScanError

        try:
            await async_save_config_state(self.runtime, config, rev,
                                          previous_rev=int(previous.get("rev", 0)),
                                          previous=previous, canonical=canonical,
                                          authorize=authorize)
        except ZigbeeScanError as error:
            raise CommandError(error.code, str(error)) from error

    async def save_layout(self, previous, layout, rev, *, metadata=None,
                          remove=(), authorize):
        authorize()
        await async_save_layout_state(self.runtime, previous, layout, rev,
                                      metadata=metadata, remove=remove)

    async def commit_pair(self, target, rollback, *, authorize):
        # This is the existing physical HA journal, not command semantics.
        from .websocket_api import _commit_pair

        await _commit_pair(self.runtime, target, rollback, authorize=authorize)


class HaPlanStorage:
    def __init__(self, runtime):
        self.runtime = runtime

    @asynccontextmanager
    async def transaction(self):
        async with self.runtime.write_lock:
            yield HaPlanTransaction(self.runtime)


class HaCpuExecutor:
    def __init__(self, hass):
        self.hass = hass

    async def run(self, function, *args):
        context = contextvars.copy_context()
        return await self.hass.async_add_executor_job(context.run, function, *args)


class HaWriteAuthority:
    def __init__(self, hass, connection, runtime):
        self.hass, self.connection = hass, connection
        self.user = getattr(connection, "user", None)
        self.owner_id = str(getattr(self.user, "id", ""))
        self.scope_id = runtime.instance_id

    @property
    def can_write(self):
        return may_write(self.hass, getattr(self.connection, "user", None))

    @property
    def archive_admin(self):
        return self.can_write and bool(getattr(getattr(self.connection, "user", None), "is_admin", False))

    def ensure(self):
        if (getattr(self.connection, "user", None) is not self.user
                or str(getattr(self.user, "id", "")) != self.owner_id
                or not self.can_write):
            raise CommandError("unauthorized", "Editing permission was lost")


class HaCommandEffects:
    def __init__(self, hass, runtime):
        self.hass, self.runtime = hass, runtime

    def emit(self, name, data):
        self.hass.bus.async_fire(name, data)

    def missing_revision(self, command, current_rev):
        from .websocket_api import _debug_missing_revision_once

        _debug_missing_revision_once(command, current_rev)

    async def release_snapshot(self, previous, config, metadata):
        from .websocket_api import _release_space_delete_snapshot

        await _release_space_delete_snapshot(self.runtime, previous, config, metadata)

    async def purge_trails(self, config):
        from .websocket_api import _purge_trail_recorder

        await _purge_trail_recorder(self.hass, config)

    async def forget_deleted_markers(self, config, marker_ids):
        from .websocket_api import _forget_deleted_markers

        await _forget_deleted_markers(self.hass, config, marker_ids)

    def refresh_trails(self):
        from .websocket_api import _refresh_trail_recorder

        _refresh_trail_recorder(self.hass)

    def schedule_repairs(self):
        from .repairs import async_check_plan_files
        from .store import get_entry

        entry = get_entry(self.hass)
        if entry is not None:
            self.hass.async_create_task(async_check_plan_files(self.hass, entry))

    def pinned_attachment_refs(self):
        return self.runtime.marker_history.refs() if self.runtime.marker_history is not None else set()


class HaPlanContent(FilesystemContent):
    def __init__(self, hass, cpu, runtime):
        from .asset_integrity import get_asset_integrity_verifier

        super().__init__(Path(hass.config.path("")), cpu, lock=runtime.upload_lock,
                         verifier=get_asset_integrity_verifier(hass))


class HaCommandEvidence:
    def __init__(self, hass, connection, runtime):
        self.hass, self.connection, self.runtime = hass, connection, runtime

    def readable_entity_ids(self, selected):
        from .websocket_api import _readable_entity_ids

        return _readable_entity_ids(self.hass, self.connection, selected)

    def radar_registry(self):
        return radar_registry_evidence(self.hass)

    def import_registry_snapshot(self):
        from .registry_snapshot import import_registry_snapshot

        try:
            return import_registry_snapshot(self.hass)
        except Exception:  # noqa: BLE001 - existing best-effort summary
            _LOGGER.debug("House Plan import registry summary unavailable", exc_info=True)
            return None

    async def configuration_extras(self, config, rev):
        from .support_package import PACKAGE_VERSIONS
        from .virtual_lights import async_virtual_light_snapshot

        runtime = self.runtime
        try:
            virtual_lights = await (runtime.virtual_lights.async_snapshot(config, rev)
                if runtime.virtual_lights is not None
                else async_virtual_light_snapshot(runtime.virtual_light_store, config, rev))
        except Exception:  # noqa: BLE001 - configuration is independently readable
            _LOGGER.exception("House Plan: reading virtual-light state failed")
            virtual_lights = {"rev": 0, "config_rev": rev, "off": []}
        return {"virtual_lights": virtual_lights, "support_api": SUPPORT_API_VERSION,
            "support_package_versions": list(PACKAGE_VERSIONS), "vacuum_dock_restart_api": 1,
            "vacuum_history_api": 1, "device_contact_api": 1, "device_history_api": 1,
            "summary_panel_api": SUMMARY_PANEL_API_VERSION, "external_screens_api": 2,
            "external_screens_events_api": 1,
            **({"radar_stage1_api": 1} if runtime.radar_coordinator is not None else {}),
            **({"zigbee_scan_api": 1, "zigbee_maps_api": 1} if runtime.zigbee_coordinator is not None
               and not runtime.zigbee_coordinator.closed else {}),
            **({"zigbee_lqi_api": 1} if runtime.zigbee_lqi is not None and not runtime.zigbee_lqi.closed else {})}


def plan_commands(hass, connection, runtime):
    from .core.staging_commands import DictionaryStructuralStaging
    from .core.structural_upload import uploads
    from .websocket_api import _build_identity

    cpu = HaCpuExecutor(hass)
    build = _build_identity(runtime)
    environment = CommandEnvironment(HaPlanContent(hass, cpu, runtime), HaCommandEvidence(hass, connection, runtime),
                                     CommandPolicy.HA, HostIdentity(runtime.instance_id, VERSION,
                                                                    build.fingerprint, build.build),
                                     leases=DictionaryImportLeases(runtime),
                                     staging=DictionaryStructuralStaging(runtime.instance_id, uploads(runtime)),
                                     house=house_resources(runtime))
    return PlanCommands(HaPlanStorage(runtime), cpu,
                        HaWriteAuthority(hass, connection, runtime),
                        HaCommandEffects(hass, runtime), environment)


def house_resources(runtime):
    """One pool and upload lock for the installation, including startup recovery."""
    from .core.house_resources import FilesystemHouseResources

    if runtime.house_resources is None:
        runtime.house_resources = FilesystemHouseResources(Path(runtime.hass.config.path("")),
            HaCpuExecutor(runtime.hass), lock=runtime.upload_lock)
    return runtime.house_resources


async def dispatch_plan_command(hass, connection, message: dict[str, Any]) -> None:
    if (message.get("type") not in {"houseplan/config/get", "houseplan/layout/get", "houseplan/assets/resolve"}
            and not may_write(hass, getattr(connection, "user", None))):
        connection.send_error(message["id"], "unauthorized", "Houseplan write permission is required")
        return
    runtime = get_data(hass)
    if runtime is None:
        connection.send_error(message["id"], "not_ready", "House Plan is not ready")
        return
    try:
        operation = message.get("type")
        if operation == "houseplan/export/create" and message.get("kind") != "house" and any(message.get(key) for key in (
                "archive", "migration_source", "plan_graph_migration_source")):
            from .command_legacy import export_special

            await export_special(hass, connection, message, runtime)
            return
        if message.get("transfer_kind") != "house" and operation in {"houseplan/import/apply", "houseplan/import/revalidate"} and "archive" in (
                runtime.import_previews.get(message.get("token")) or {}):
            if operation == "houseplan/import/apply":
                from .backup_transaction import apply_archive

                await apply_archive(hass, connection, message, runtime)
            else:
                from .command_legacy import revalidate_archive

                await revalidate_archive(hass, connection, message, runtime)
            return
        if operation == "houseplan/backup/cancel" and message.get("transfer_kind") != "house":
            from .command_legacy import cancel_archive

            if await cancel_archive(hass, connection, message, runtime):
                return
        if message.get("type") == "houseplan/plan/optimize_undo":
            # The installation-backup variant is deliberately not a core
            # plan-only command. Recheck CAS under the same recovery fence
            # before handing its durable file/Zigbee transaction to HA.
            from .backup_transaction import undo_archive_locked
            from .websocket_api import _resolved_write_pair

            async with runtime.write_lock:
                pair = await _resolved_write_pair(hass, connection, message["id"], runtime)
                if pair is None:
                    return
                backup = pair.layout_data.get("optimize_backup")
                if isinstance(backup, dict) and "archive_snapshot" in backup:
                    authority = HaWriteAuthority(hass, connection, runtime)
                    authority.ensure()
                    if (message.get("expected_config_rev") != int(pair.config_data.get("rev", 0))
                            or message.get("expected_layout_rev") != int(pair.layout_data.get("rev", 0))):
                        raise CommandError("conflict", "Plan changed elsewhere")
                    if not optimizer_backup_is_current(pair.config_data, pair.layout_data):
                        raise CommandError("no_backup", "The optimization backup is unavailable or a later edit made it stale")
                    await undo_archive_locked(hass, connection, message, runtime, pair.config_data, pair.layout_data)
                    return
        result = await plan_commands(hass, connection, runtime).execute(message)
    except (CommandError, ImportFailure) as error:
        connection.send_error(message["id"], error.code, error.public_message)
        return
    connection.send_result(message["id"], result)


class HttpPrincipal:
    """Observe the live HTTP principal again at the durable publication fence."""

    def __init__(self, request):
        self.request = request

    @property
    def user(self):
        return self.request.get("hass_user")
