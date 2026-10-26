"""House Plan: server-side house plan configuration + Lovelace card serving."""
from __future__ import annotations

import inspect
import logging
from datetime import timedelta
from pathlib import Path

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers.event import async_track_time_interval

from . import websocket_api as hp_ws
from .build_identity import read_build_identity
from .const import (
    ASSETS_DIR,
    DOMAIN,
    FILES_DIR,
    PLANS_DIR,
)
from .frontend_registration import (
    async_remove_frontend_registration,
    async_setup_frontend_registration,
)
from .panel_registration import (
    async_setup_panel_registration,
    remove_panel_registration,
)
from .plans import collect_attachments, collect_plans, sweep_upload_temps
from .repairs import async_check_plan_files
from .store import (
    HouseplanConfigEntry,
    async_resolve_pending_pair,
    create_data,
)

_LOGGER = logging.getLogger(__name__)


async def _async_flush_runtime(
    hass: HomeAssistant, entry: HouseplanConfigEntry,
) -> None:
    """Stop deferred writers and persist their latest state once.

    Home Assistant stop and config-entry unload share this exact path.  Both
    writers are independently guarded so one failed store cannot prevent the
    other from reaching disk during shutdown.
    """
    backup_service = getattr(entry.runtime_data, "backup_service", None)
    if backup_service is not None:
        try:
            await backup_service.close()
        except Exception:  # noqa: BLE001 - do not skip other shutdown writers
            _LOGGER.warning("House Plan: backup staging cleanup deferred")
    zigbee = getattr(entry.runtime_data, "zigbee_coordinator", None)
    if zigbee is not None:
        await zigbee.async_close()
    lqi = getattr(entry.runtime_data, "zigbee_lqi", None)
    if lqi is not None:
        await lqi.async_close()

    recorder = hass.data.get(DOMAIN, {}).get("trail_recorder")
    if recorder is not None:
        try:
            await recorder.async_teardown()
        except Exception:  # noqa: BLE001 - shutdown must continue with other stores
            _LOGGER.exception("House Plan: flushing vacuum trails failed")

    virtual_lights = getattr(entry.runtime_data, "virtual_lights", None)
    if virtual_lights is not None:
        try:
            await virtual_lights.async_flush()
        except Exception:  # noqa: BLE001 - shutdown must continue with other stores
            _LOGGER.exception("House Plan: flushing virtual-light state failed")


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register global handlers (survive config-entry reloads): WS commands, HTTP view."""
    hass.data.setdefault(DOMAIN, {})
    hp_ws.async_register(hass)
    from .backup_http import HouseplanArchiveDownloadView, HouseplanArchivePreviewView
    from .frontend_assets import HouseplanFrontendAssetView
    from .http_api import (
        HouseplanContentView,
        HouseplanDecorAssetUploadView,
        HouseplanImportPreviewView,
        HouseplanPlanUploadView,
        HouseplanUploadView,
    )

    hass.http.register_view(HouseplanUploadView())
    hass.http.register_view(HouseplanDecorAssetUploadView())
    hass.http.register_view(HouseplanPlanUploadView())
    hass.http.register_view(HouseplanContentView())
    hass.http.register_view(HouseplanImportPreviewView())
    hass.http.register_view(HouseplanArchivePreviewView())
    hass.http.register_view(HouseplanArchiveDownloadView())
    hass.http.register_view(HouseplanFrontendAssetView())
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Config entry: stores in runtime_data, static paths, card auto-registration."""
    data = create_data(hass)
    data.backup_root = hass.config.path("")
    # Home Assistant's installation id never leaves the instance.  Exports
    # carry only a salted SHA-256 fingerprint so same-instance internal files
    # can be distinguished from cross-instance references.
    try:
        from homeassistant.helpers import instance_id as ha_instance_id

        value = ha_instance_id.async_get(hass)
        data.instance_id = str(await value if inspect.isawaitable(value) else value)
    except Exception:  # noqa: BLE001 - old HA/test harness fallback
        data.instance_id = str(entry.entry_id)
    # test-before-setup: storage must be readable, otherwise retry later
    try:
        await data.store.async_load()
        await data.config_store.async_load()
    except Exception as err:  # noqa: BLE001 — corrupt/unreadable .storage
        raise ConfigEntryNotReady(f"House Plan storage is not readable: {err}") from err
    try:
        await data.virtual_light_store.async_load()
    except Exception:  # noqa: BLE001 — operational state fails safe to default on
        _LOGGER.exception("House Plan: virtual-light storage is not readable; using default on")
    entry.runtime_data = data

    from .zigbee_topology import ZigbeeScanCoordinator
    data.zigbee_coordinator = ZigbeeScanCoordinator(hass, entry)

    card_path = Path(__file__).parent / "frontend" / "houseplan-card.js"
    plans_path = Path(hass.config.path(PLANS_DIR))
    files_path = Path(hass.config.path(FILES_DIR))
    assets_path = Path(hass.config.path(ASSETS_DIR))
    await hass.async_add_executor_job(
        lambda: (
            plans_path.mkdir(parents=True, exist_ok=True),
            files_path.mkdir(parents=True, exist_ok=True),
            assets_path.mkdir(parents=True, exist_ok=True),
        )
    )

    # NOTE (audit B1): plans and marker files are no longer static. They are
    # served by HouseplanContentView, which requires auth. Only the manifest-
    # gated frontend bundle stays public so Lovelace can load it. Registration
    # failures are observable and recoverable, but never skip storage migration,
    # repairs or housekeeping below.
    # #836: the module URL follows the build (frontend fingerprint, dev label),
    # not only the version; both are read once here, off the event loop.
    data.build_identity = await hass.async_add_executor_job(read_build_identity)
    await async_setup_frontend_registration(
        hass, entry, card_path, identity=data.build_identity
    )

    # Resolve an interrupted whole-plan pair before any other setup-time
    # writer reads or mutates either store. This is the same fence used by
    # runtime writers, so startup migration cannot build on a half-commit.
    optimize_revs: tuple[int, int] | None = None
    recovered_import = False
    async with data.write_lock:
        try:
            resolved = await async_resolve_pending_pair(data)
        except Exception as err:  # noqa: BLE001 - retain the original pair/intent for retry
            raise ConfigEntryNotReady("House Plan storage migration could not complete; retry setup") from err
        if resolved.recovered_kind is not None:
            optimize_revs = (
                int(resolved.config_data.get("rev", 0)),
                int(resolved.layout_data.get("rev", 0)),
            )
            recovered_import = resolved.recovered_kind.startswith("import")
            _LOGGER.warning(
                "House Plan: completed an interrupted %s",
                resolved.recovered_kind.replace("_", " "),
            )

    from .radar import RadarCoordinator
    data.radar_coordinator = RadarCoordinator(hass, data)
    await data.radar_coordinator.async_setup()

    # server-side vacuum trails: the integration records the path itself
    from .trails import TrailRecorder
    recorder = TrailRecorder(hass, data)
    await recorder.async_setup()
    # setdefault: the CI harness sets entries up without async_setup, so
    # hass.data[DOMAIN] may not exist yet — a KeyError here failed EVERY
    # downstream WS test with unknown_error
    hass.data.setdefault(DOMAIN, {})["trail_recorder"] = recorder

    if optimize_revs is not None:
        # Setup-time geometry migration may have advanced either revision
        # after pair recovery. Events always describe the final durable stores.
        recovered_config = await data.config_store.async_load() or {}
        recovered_layout = await data.store.async_load() or {}
        optimize_revs = (
            int(recovered_config.get("rev", 0)),
            int(recovered_layout.get("rev", 0)),
        )
        hass.bus.async_fire("houseplan_config_updated", {"rev": optimize_revs[0]})
        hass.bus.async_fire("houseplan_layout_updated", {"rev": optimize_revs[1]})
        if recovered_import:
            current = (await data.config_store.async_load() or {}).get("config") or {}
            await recorder.async_purge_orphans(current)
            await recorder.async_refresh()

    # Only the recovered canonical config may decide whether saved links are OFF.
    # A pre-recovery half of an interrupted import must not erase the map cache.
    config_payload = await data.config_store.async_load() or {}
    await data.zigbee_coordinator.async_setup(config_payload.get("config") or {})
    from .backup_service import get_backup_service
    await get_backup_service(hass, data).sweep()

    await async_check_plan_files(hass, entry)

    # Scheduled collection of everything nobody ended up referencing.
    #
    # A commit collects what that commit superseded, which is the right rule for
    # a commit — but it only ever runs when somebody saves. Cancel a dialog
    # after the file has already uploaded, lose the connection after the upload
    # succeeded, or call the API directly, and the file is unreferenced with no
    # future write to notice it (HP-1461-01). The earlier version of this sweep
    # only removed streaming temporaries, which are a different, narrower case.
    #
    # Passing the CURRENT configuration as both sides means "nothing was
    # superseded": every referenced file is preserved and only unreferenced ones
    # past PLAN_ORPHAN_TTL_S go. It runs under the same lock as a config write,
    # so it cannot decide from a snapshot that a commit is about to replace.
    async def _sweep(_now=None) -> None:
        files_dir = Path(hass.config.path(FILES_DIR))
        plans_dir = Path(hass.config.path(PLANS_DIR))
        try:
            # `data` from the closure, NOT get_data(hass): during
            # async_setup_entry the entry is still SETUP_IN_PROGRESS, so
            # async_loaded_entries() does not list it and the lookup returned
            # None. The startup pass then silently degraded to removing
            # streaming temporaries only, and the real collection waited a full
            # day — restarting more often than that meant it never ran at all
            # (HP-1462-01). The callback is unregistered with the entry, so
            # closing over its runtime data matches the lifecycle exactly.
            async with data.write_lock:
                stored = await data.config_store.async_load() or {}
                cfg = stored.get("config") or {}

                def _collect() -> int:
                    n = sweep_upload_temps(files_dir)
                    # same config on both sides: nothing is superseded, so this
                    # only ever collects what the shared rules call abandoned
                    if data.marker_history is not None:
                        data.marker_history.collect(files_dir, cfg)
                    n += collect_attachments(files_dir, cfg, cfg,
                        pinned=data.marker_history.refs() if data.marker_history is not None else set())
                    n += collect_plans(plans_dir, cfg, cfg)
                    return n

                n = await hass.async_add_executor_job(_collect)
            if n:
                _LOGGER.info("House Plan: removed %s unreferenced file(s)", n)
        except Exception:  # noqa: BLE001 — housekeeping must never fail a setup
            _LOGGER.exception("House Plan: sweeping unreferenced files failed")

    data.sweep = _sweep
    await _sweep()
    entry.async_on_unload(
        async_track_time_interval(hass, _sweep, timedelta(hours=24))
    )

    # The application panel is intentionally the final setup step.  It is a
    # discoverability surface over the already-working stores and APIs, so a
    # missing/colliding/broken panel remains fail-soft and cannot strand a
    # sidebar entry after a migration, repair or initial housekeeping failure.
    panel_path = Path(__file__).parent / "frontend" / "houseplan-panel.js"
    await async_setup_panel_registration(
        hass, entry, panel_path, identity=data.build_identity
    )

    # Start passive subscriptions only after all fallible setup work, directly
    # before installing their shared stop/unload owner.
    from .zigbee_lqi import ZigbeeLqiCoordinator
    data.zigbee_lqi = ZigbeeLqiCoordinator(hass, entry)
    await data.zigbee_lqi.async_setup(config_payload.get("config") or {})

    async def _flush_on_stop(_event) -> None:
        stop_listener[0] = None
        await _async_flush_runtime(hass, entry)

    stop_listener = [hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, _flush_on_stop)]

    def _remove_stop_listener() -> None:
        if stop_listener[0] is not None:
            stop_listener[0]()
            stop_listener[0] = None

    entry.async_on_unload(_remove_stop_listener)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Unload the entry.

    WS commands and the HTTP view are global (async_setup) and stay registered —
    their handlers resolve runtime data per call and answer `not_ready` while no
    entry is loaded. Static paths cannot be unregistered by design.
    """
    remove_panel_registration(hass)
    await _async_flush_runtime(hass, entry)
    hass.data.get(DOMAIN, {}).pop("trail_recorder", None)
    if entry.runtime_data.radar_coordinator:
        entry.runtime_data.radar_coordinator.teardown()
        entry.runtime_data.radar_coordinator = None
    return True


async def async_remove_entry(
    hass: HomeAssistant, entry: HouseplanConfigEntry
) -> None:
    """Clean up frontend registration and notice on integration removal."""
    remove_panel_registration(hass)
    await async_remove_frontend_registration(hass, entry)
