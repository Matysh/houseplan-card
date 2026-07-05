"""House Plan: server-side house plan configuration + Lovelace card serving."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import issue_registry as ir

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
from .store import HouseplanConfigEntry, create_data

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register global handlers (survive config-entry reloads): WS commands, HTTP view."""
    hass.data.setdefault(DOMAIN, {})
    hp_ws.async_register(hass)
    from .http_api import HouseplanUploadView

    hass.http.register_view(HouseplanUploadView())
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
            static_paths.append(StaticPathConfig(PLANS_URL, str(plans_path), cache_headers=True))
            static_paths.append(StaticPathConfig(FILES_URL, str(files_path), cache_headers=True))
            await hass.http.async_register_static_paths(static_paths)
        except ImportError:  # very old HA versions
            if card_path.exists():
                hass.http.register_static_path(FRONTEND_URL, str(card_path), cache_headers=False)
            hass.http.register_static_path(PLANS_URL, str(plans_path), cache_headers=True)
            hass.http.register_static_path(FILES_URL, str(files_path), cache_headers=True)

    if not card_path.exists():
        _LOGGER.warning("houseplan-card.js not found next to the integration: %s", card_path)
        return True

    # Register the card. Preferably as a Lovelace resource (the frontend AWAITS
    # resources before rendering dashboards, so the card is available even on a cold
    # start of the mobile app). If the resource registry is unavailable (YAML-mode
    # Lovelace, old versions) — fall back to extra_module_url.
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    if not await _register_lovelace_resource(hass, module_url):
        add_extra_js_url(hass, module_url)

    await _check_plan_files(hass, entry)
    return True


async def _check_plan_files(hass: HomeAssistant, entry: HouseplanConfigEntry) -> None:
    """Repairs: raise an issue for every space whose plan file is missing on disk."""
    cfg_raw = await entry.runtime_data.config_store.async_load() or {}
    spaces = cfg_raw.get("config", {}).get("spaces", [])
    plans_dir = Path(hass.config.path(PLANS_DIR))

    def _missing() -> list[tuple[str, str]]:
        res = []
        for sp in spaces:
            url = sp.get("plan_url") or ""
            if not url.startswith(PLANS_URL + "/"):
                continue  # external/legacy URL — not ours to verify
            fname = url[len(PLANS_URL) + 1 :].split("?", 1)[0]
            if not (plans_dir / fname).is_file():
                res.append((sp.get("id", "?"), fname))
        return res

    missing = await hass.async_add_executor_job(_missing)
    seen = set()
    for space_id, fname in missing:
        seen.add(space_id)
        ir.async_create_issue(
            hass,
            DOMAIN,
            f"broken_plan_{space_id}",
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key="broken_plan",
            translation_placeholders={"space": space_id, "file": fname},
        )
    # clear stale issues for spaces that are fine again (or gone)
    for sp in spaces:
        sid = sp.get("id", "?")
        if sid not in seen:
            ir.async_delete_issue(hass, DOMAIN, f"broken_plan_{sid}")


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
