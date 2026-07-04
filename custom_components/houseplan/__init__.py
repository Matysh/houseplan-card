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
    """Регистрируем WS-команды, HTTP-загрузку и хранилища на старте."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data[DOMAIN]["config_store"] = Store(hass, STORAGE_VERSION, STORAGE_CONFIG_KEY)
    hp_ws.async_register(hass)
    from .http_api import HouseplanUploadView

    hass.http.register_view(HouseplanUploadView())
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

    if not card_path.exists():
        _LOGGER.warning("houseplan-card.js не найден рядом с интеграцией: %s", card_path)
        return True

    # Подключаем карточку. Предпочтительно — как Lovelace-ресурс (его фронтенд ДОЖИДАЕТСЯ
    # перед рендером дашбордов, поэтому карточка доступна даже на холодном старте мобильного
    # приложения). Если реестр ресурсов недоступен (YAML-режим Lovelace, старые версии) —
    # откатываемся на extra_module_url.
    module_url = f"{FRONTEND_URL}?v={VERSION}"
    if not await _register_lovelace_resource(hass, module_url):
        add_extra_js_url(hass, module_url)
    return True


async def _register_lovelace_resource(hass: HomeAssistant, module_url: str) -> bool:
    """Зарегистрировать (или обновить) карточку в реестре Lovelace-ресурсов.

    Возвращает True при успехе. Пишем идемпотентно: если ресурс с нашим путём уже есть —
    обновляем URL при смене версии; отсутствует — создаём. Any-except → False (фолбэк на JS).
    """
    try:
        lovelace = hass.data.get("lovelace")
        resources = getattr(lovelace, "resources", None)
        if resources is None and isinstance(lovelace, dict):
            resources = lovelace.get("resources")
        if resources is None:
            return False
        # реестр ресурсов должен быть загружен
        if hasattr(resources, "loaded") and not resources.loaded:
            await resources.async_load()
            resources.loaded = True
        elif hasattr(resources, "async_get_info"):
            await resources.async_get_info()
        # только storage-режим позволяет создавать элементы
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
        _LOGGER.debug("House Plan card зарегистрирована как Lovelace-ресурс: %s", module_url)
        return True
    except Exception as err:  # noqa: BLE001 — любой сбой → фолбэк
        _LOGGER.debug("Не удалось зарегистрировать Lovelace-ресурс (%s), фолбэк на extra_module_url", err)
        return False


async def _update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN]["entry"] = entry


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop("entry", None)
    return True
