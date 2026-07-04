"""House Plan: серверная конфигурация плана дома + раздача Lovelace-карточки."""
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
    """Регистрируем WS-команды и хранилища на старте."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data[DOMAIN]["config_store"] = Store(hass, STORAGE_VERSION, STORAGE_CONFIG_KEY)
    hp_ws.async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Config entry: статика фронтенда и планов + авто-подключение JS."""
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
    except ImportError:  # старые версии HA
        if card_path.exists():
            hass.http.register_static_path(FRONTEND_URL, str(card_path), cache_headers=False)
        hass.http.register_static_path(PLANS_URL, str(plans_path), cache_headers=True)
        hass.http.register_static_path(FILES_URL, str(files_path), cache_headers=True)

    if card_path.exists():
        add_extra_js_url(hass, f"{FRONTEND_URL}?v={VERSION}")
    else:
        _LOGGER.warning("houseplan-card.js не найден рядом с интеграцией: %s", card_path)
    return True


async def _update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN]["entry"] = entry


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop("entry", None)
    return True
