"""House Plan: серверное хранилище раскладки + раздача Lovelace-карточки."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from . import websocket_api as hp_ws
from .const import DOMAIN, FRONTEND_URL, STORAGE_KEY, STORAGE_VERSION, VERSION

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Регистрируем WS-команды и хранилище на старте."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hp_ws.async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Config entry: статика фронтенда + авто-подключение JS."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["entry"] = entry
    entry.async_on_unload(entry.add_update_listener(_update_listener))

    card_path = Path(__file__).parent / "frontend" / "houseplan-card.js"
    if card_path.exists():
        try:
            from homeassistant.components.http import StaticPathConfig

            await hass.http.async_register_static_paths(
                [StaticPathConfig(FRONTEND_URL, str(card_path), cache_headers=False)]
            )
        except ImportError:  # старые версии HA
            hass.http.register_static_path(FRONTEND_URL, str(card_path), cache_headers=False)
        add_extra_js_url(hass, f"{FRONTEND_URL}?v={VERSION}")
    else:
        _LOGGER.warning("houseplan-card.js не найден рядом с интеграцией: %s", card_path)
    return True



async def _update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN]["entry"] = entry


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop("entry", None)
    return True
