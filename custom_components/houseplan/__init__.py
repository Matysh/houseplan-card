"""House Plan: server-side house plan configuration + Lovelace card serving."""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers.event import async_track_time_interval

from . import websocket_api as hp_ws
from .const import (
    DOMAIN,
    FILES_DIR,
    FILES_URL,
    FRONTEND_URL,
    PLANS_DIR,
    PLANS_URL,
    VERSION,
)
from .plans import collect_attachments, collect_plans, sweep_upload_temps
from .repairs import async_check_plan_files
from .store import HouseplanConfigEntry, create_data

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register global handlers (survive config-entry reloads): WS commands, HTTP view."""
    hass.data.setdefault(DOMAIN, {})
    hp_ws.async_register(hass)
    from .http_api import HouseplanContentView, HouseplanUploadView

    hass.http.register_view(HouseplanUploadView())
    hass.http.register_view(HouseplanContentView())
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Config entry: stores in runtime_data, static paths, card auto-registration."""
    data = create_data(hass)
    # test-before-setup: storage must be readable, otherwise retry later
    try:
        await data.store.async_load()
        await data.config_store.async_load()
    except Exception as err:  # noqa: BLE001 — corrupt/unreadable .storage
        raise ConfigEntryNotReady(f"House Plan storage is not readable: {err}") from err
    entry.runtime_data = data

    card_path = Path(__file__).parent / "frontend" / "houseplan-card.js"
    plans_path = Path(hass.config.path(PLANS_DIR))
    files_path = Path(hass.config.path(FILES_DIR))
    await hass.async_add_executor_job(
        lambda: (plans_path.mkdir(parents=True, exist_ok=True), files_path.mkdir(parents=True, exist_ok=True))
    )

    # Static paths cannot be unregistered — register once per HA run.
    if not hass.data[DOMAIN].get("static_registered"):
        hass.data[DOMAIN]["static_registered"] = True
        static_paths = []
        try:
            from homeassistant.components.http import StaticPathConfig

            if card_path.exists():
                static_paths.append(StaticPathConfig(FRONTEND_URL, str(card_path), cache_headers=False))
            # NOTE (audit B1): plans and marker files are NO LONGER static.
            # They are served by HouseplanContentView, which requires auth.
            # Only the card bundle stays public — Lovelace resources must be.
            if static_paths:
                await hass.http.async_register_static_paths(static_paths)
        except ImportError:  # very old HA versions
            if card_path.exists():
                hass.http.register_static_path(FRONTEND_URL, str(card_path), cache_headers=False)

    if not card_path.exists():
        _LOGGER.warning("houseplan-card.js not found next to the integration: %s", card_path)
        return True

    # Register the card. Preferably as a Lovelace resource (the frontend AWAITS
    # resources before rendering dashboards, so the card is available even on a cold
    # start of the mobile app). If the resource registry is unavailable (YAML-mode
    # Lovelace, old versions) — fall back to extra_module_url.
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    registered = await _register_lovelace_resource(hass, module_url)
    if not registered:
        add_extra_js_url(hass, module_url)
    # Tell the user exactly where the card lives — the #1 support issue is people adding a
    # Lovelace resource pointing at the on-disk path (/custom_components/...), which HA does
    # not serve (wrong MIME → "Custom element doesn't exist"). The correct served URL is below.
    if registered:
        _LOGGER.info("House Plan card auto-registered as a Lovelace resource: %s", module_url)
    else:
        _LOGGER.info(
            "House Plan card is served at %s . Lovelace resources look YAML-managed — add it "
            "manually under `resources:` as { url: %s, type: module }. Do NOT use the on-disk "
            "path /custom_components/houseplan/frontend/houseplan-card.js (HA does not serve it).",
            module_url, module_url,
        )

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
                    n += collect_attachments(files_dir, cfg, cfg)
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
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Unload the entry.

    WS commands and the HTTP view are global (async_setup) and stay registered —
    their handlers resolve runtime data per call and answer `not_ready` while no
    entry is loaded. Static paths cannot be unregistered by design.
    """
    return True


async def async_remove_entry(hass: HomeAssistant, entry) -> None:
    """Clean up on integration removal: drop our Lovelace resource entry."""
    try:
        resources = _lovelace_resources(hass)
        if resources is None or not hasattr(resources, "async_delete_item"):
            return
        for item in list(resources.async_items()):
            if str(item.get("url", "")).split("?", 1)[0] == FRONTEND_URL:
                await resources.async_delete_item(item["id"])
                _LOGGER.debug("House Plan Lovelace resource removed: %s", item.get("url"))
    except Exception as err:  # noqa: BLE001 — best-effort cleanup
        _LOGGER.debug("Could not remove the Lovelace resource on uninstall: %s", err)


def _lovelace_resources(hass: HomeAssistant):
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    return resources


async def _register_lovelace_resource(hass: HomeAssistant, module_url: str) -> bool:
    """Register (or update) the card in the Lovelace resource registry.

    Returns True on success. Idempotent: if a resource with our path exists —
    update the URL on version change; otherwise create it. Any exception → False
    (fall back to extra_module_url).
    """
    try:
        resources = _lovelace_resources(hass)
        if resources is None:
            return False
        # the resource registry must be loaded
        if hasattr(resources, "loaded") and not resources.loaded:
            await resources.async_load()
            resources.loaded = True
        elif hasattr(resources, "async_get_info"):
            await resources.async_get_info()
        # only storage mode allows creating items
        if not hasattr(resources, "async_create_item"):
            return False
        base = FRONTEND_URL
        existing = [
            item for item in resources.async_items()
            if str(item.get("url", "")).split("?", 1)[0] == base
        ]
        if existing:
            item = existing[0]
            if item.get("url") != module_url and hasattr(resources, "async_update_item"):
                await resources.async_update_item(item["id"], {"url": module_url})
            return True
        await resources.async_create_item({"res_type": "module", "url": module_url})
        _LOGGER.debug("House Plan card registered as a Lovelace resource: %s", module_url)
        return True
    except Exception as err:  # noqa: BLE001 — any failure → fallback
        _LOGGER.debug("Could not register the Lovelace resource (%s), falling back to extra_module_url", err)
        return False
