"""House Plan: server-side house plan configuration + serving the Lovelace card."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import websocket_api as hp_ws
from .const import (
    DOMAIN,
    FILES_DIR,
    FILES_URL,
    FRONTEND_URL,
    PLANS_DIR,
    PLANS_URL,
    STORAGE_CONFIG_KEY,
    STORAGE_KEY,
    STORAGE_VERSION,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register WS commands, the HTTP upload and the stores on startup."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data[DOMAIN]["config_store"] = Store(hass, STORAGE_VERSION, STORAGE_CONFIG_KEY)
    hp_ws.async_register(hass)
    from .http_api import HouseplanUploadView

    hass.http.register_view(HouseplanUploadView())
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Config entry: static frontend and plan files + auto-registration of the JS."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["entry"] = entry
    entry.async_on_unload(entry.add_update_listener(_update_listener))

    card_path = Path(__file__).parent / "frontend" / "houseplan-card.js"
    plans_path = Path(hass.config.path(PLANS_DIR))
    files_path = Path(hass.config.path(FILES_DIR))
    await hass.async_add_executor_job(
        lambda: (plans_path.mkdir(parents=True, exist_ok=True), files_path.mkdir(parents=True, exist_ok=True))
    )

    static_paths = []
    try:
        from homeassistant.components.http import StaticPathConfig

        if card_path.exists():
            static_paths.append(StaticPathConfig(FRONTEND_URL, str(card_path), cache_headers=False))
        static_paths.append(StaticPathConfig(PLANS_URL, str(plans_path), cache_headers=True))
        static_paths.append(StaticPathConfig(FILES_URL, str(files_path), cache_headers=True))
        await hass.http.async_register_static_paths(static_paths)
    except ImportError:  # older HA versions
        if card_path.exists():
            hass.http.register_static_path(FRONTEND_URL, str(card_path), cache_headers=False)
        hass.http.register_static_path(PLANS_URL, str(plans_path), cache_headers=True)
        hass.http.register_static_path(FILES_URL, str(files_path), cache_headers=True)

    if not card_path.exists():
        _LOGGER.warning("houseplan-card.js not found next to the integration: %s", card_path)
        return True

    # Register the card. Preferably as a Lovelace resource (the frontend WAITS for those
    # before rendering dashboards, so the card is available even on a cold start of the mobile
    # app). If the resource registry is unavailable (Lovelace YAML mode, older versions) —
    # fall back to extra_module_url.
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    if not await _register_lovelace_resource(hass, module_url):
        add_extra_js_url(hass, module_url)
    return True


async def _register_lovelace_resource(hass: HomeAssistant, module_url: str) -> bool:
    """Register (or update) the card in the Lovelace resource registry.

    Returns True on success. Writes idempotently: if a resource with our path already exists —
    update the URL on a version change; if absent — create it. Any-except → False (fallback to JS).
    """
    try:
        lovelace = hass.data.get("lovelace")
        resources = getattr(lovelace, "resources", None)
        if resources is None and isinstance(lovelace, dict):
            resources = lovelace.get("resources")
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
        _LOGGER.debug("Failed to register the Lovelace resource (%s), falling back to extra_module_url", err)
        return False


async def _update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN]["entry"] = entry


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop("entry", None)
    return True
