"""WS-команды House Plan: раскладка, конфигурация пространств, загрузка планов."""
from __future__ import annotations

import base64
import binascii
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_ADMIN_ONLY, DEFAULT_CONFIG, DOMAIN,
    FILES_DIR, FILES_URL, PLANS_DIR, PLANS_URL,
)
from .validation import (
    CONFIG_SCHEMA, FILE_EXTENSIONS, LAYOUT_SCHEMA, MAX_FILE_BYTES, MAX_PLAN_BYTES,
    PLAN_EXTENSIONS, POS_SCHEMA, file_ext, sanitize_filename, sanitize_marker_id, valid_space_id,
)



@callback
def async_register(hass: HomeAssistant) -> None:
    """Регистрация WS-команд."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_plan_set)
    websocket_api.async_register_command(hass, ws_file_set)


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN]["store"]


def _config_store(hass: HomeAssistant):
    return hass.data[DOMAIN]["config_store"]


def _check_write(hass: HomeAssistant, connection) -> bool:
    entry = hass.data[DOMAIN].get("entry")
    admin_only = bool(entry and entry.options.get(CONF_ADMIN_ONLY, False))
    return connection.user.is_admin if admin_only else True


# ---------------- раскладка ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Вернуть сохранённую раскладку."""
    data = await _store(hass).async_load() or {}
    connection.send_result(msg["id"], {"layout": data.get("layout", {})})


@websocket_api.websocket_command(
    {vol.Required("type"): "houseplan/layout/set", vol.Required("layout"): LAYOUT_SCHEMA}
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Полностью заменить раскладку."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Правка раскладки разрешена только администраторам")
        return
    await _store(hass).async_save({"layout": msg["layout"]})
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/update",
        vol.Required("device_id"): str,
        vol.Required("pos"): POS_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_layout_update(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Обновить позицию одного устройства."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Правка раскладки разрешена только администраторам")
        return
    store = _store(hass)
    data = await store.async_load() or {}
    layout = data.get("layout", {})
    layout[msg["device_id"]] = msg["pos"]
    await store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})


# ---------------- конфигурация пространств ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/config/get"})
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Вернуть конфигурацию и её ревизию."""
    data = await _config_store(hass).async_load() or {}
    config = {**DEFAULT_CONFIG, **data.get("config", {})}
    connection.send_result(msg["id"], {"config": config, "rev": data.get("rev", 0)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/config/set",
        vol.Required("config"): CONFIG_SCHEMA,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_config_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Заменить конфигурацию с оптимистичной блокировкой (expected_rev).

    Защита от гонки нескольких открытых клиентов: если конфиг менялся с момента
    последнего чтения клиентом — возвращается ошибка conflict, клиент обязан
    перечитать конфиг и повторить правку поверх свежей версии.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Правка конфигурации разрешена только администраторам")
        return
    store = _config_store(hass)
    data = await store.async_load() or {}
    current_rev = data.get("rev", 0)
    if "expected_rev" in msg and msg["expected_rev"] != current_rev:
        connection.send_error(
            msg["id"], "conflict",
            f"Конфигурация изменена в другом окне (rev {current_rev} != {msg['expected_rev']})",
        )
        return
    new_rev = current_rev + 1
    await store.async_save({"config": msg["config"], "rev": new_rev})
    hass.bus.async_fire("houseplan_config_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- загрузка планов ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plan/set",
        vol.Required("space_id"): str,
        vol.Required("ext"): vol.In(sorted(PLAN_EXTENSIONS)),
        vol.Required("data"): str,  # base64
    }
)
@websocket_api.async_response
async def ws_plan_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Сохранить файл плана пространства; вернуть URL для карточки."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Загрузка планов разрешена только администраторам")
        return
    space_id = msg["space_id"]
    if not valid_space_id(space_id):
        connection.send_error(msg["id"], "invalid_space_id", "space_id: только [a-z0-9_-], до 64 символов")
        return
    try:
        raw = base64.b64decode(msg["data"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_data", "data должен быть корректным base64")
        return
    if len(raw) > MAX_PLAN_BYTES:
        connection.send_error(msg["id"], "too_large", f"План больше {MAX_PLAN_BYTES // 1024 // 1024} МБ")
        return

    plans_dir = Path(hass.config.path(PLANS_DIR))
    path = plans_dir / f"{space_id}.{msg['ext']}"

    def _write() -> None:
        plans_dir.mkdir(parents=True, exist_ok=True)
        # убрать старые варианты с другим расширением
        for old_ext in PLAN_EXTENSIONS:
            old = plans_dir / f"{space_id}.{old_ext}"
            if old_ext != msg["ext"] and old.exists():
                old.unlink()
        path.write_bytes(raw)

    await hass.async_add_executor_job(_write)
    mtime = int(path.stat().st_mtime)
    connection.send_result(
        msg["id"], {"ok": True, "url": f"{PLANS_URL}/{space_id}.{msg['ext']}?v={mtime}"}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/file/set",
        vol.Required("marker_id"): str,
        vol.Required("filename"): str,
        vol.Required("data"): str,  # base64
    }
)
@websocket_api.async_response
async def ws_file_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Загрузить файл-инструкцию (PDF и т.п.) для маркера; вернуть URL."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Загрузка файлов разрешена только администраторам")
        return
    marker_id = sanitize_marker_id(msg["marker_id"])
    raw_name = msg["filename"].rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    ext = file_ext(raw_name)
    if ext not in FILE_EXTENSIONS:
        connection.send_error(msg["id"], "bad_ext", f"Разрешены: {', '.join(sorted(FILE_EXTENSIONS))}")
        return
    safe_name = sanitize_filename(raw_name)
    try:
        blob = base64.b64decode(msg["data"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_data", "data должен быть корректным base64")
        return
    if len(blob) > MAX_FILE_BYTES:
        connection.send_error(msg["id"], "too_large", f"Файл больше {MAX_FILE_BYTES // 1024 // 1024} МБ")
        return
    target_dir = Path(hass.config.path(FILES_DIR)) / marker_id
    path = target_dir / safe_name

    def _write() -> None:
        target_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(blob)

    await hass.async_add_executor_job(_write)
    mtime = int(path.stat().st_mtime)
    connection.send_result(
        msg["id"], {"ok": True, "url": f"{FILES_URL}/{marker_id}/{safe_name}?v={mtime}", "name": raw_name}
    )
