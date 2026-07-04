"""WS-команды House Plan: раскладка, конфигурация пространств, загрузка планов."""
from __future__ import annotations

import base64
import binascii
import re
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import CONF_ADMIN_ONLY, DEFAULT_CONFIG, DOMAIN, PLANS_DIR, PLANS_URL

POS_SCHEMA = vol.Schema(
    {vol.Required("x"): vol.Coerce(float), vol.Required("y"): vol.Coerce(float)},
    extra=vol.ALLOW_EXTRA,  # v2-записи несут ключ "s" (space id)
)
LAYOUT_SCHEMA = vol.Schema({str: POS_SCHEMA})

POINT = vol.All([vol.Coerce(float)], vol.Length(min=2, max=2))
ROOM_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): str,
            vol.Required("name"): str,
            vol.Optional("area"): vol.Any(str, None),
            # прямоугольная комната (legacy) …
            vol.Optional("x"): vol.Coerce(float),
            vol.Optional("y"): vol.Coerce(float),
            vol.Optional("w"): vol.Coerce(float),
            vol.Optional("h"): vol.Coerce(float),
            # … или полигон (редактор разметки)
            vol.Optional("poly"): vol.All([POINT], vol.Length(min=3)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    lambda r: r if ("poly" in r or all(k in r for k in ("x", "y", "w", "h")))
    else (_ for _ in ()).throw(vol.Invalid("room: нужен poly или x/y/w/h")),
)
SPACE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        vol.Required("title"): str,
        vol.Optional("plan_url"): vol.Any(str, None),
        vol.Required("aspect"): vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20)),
        vol.Required("view_box"): vol.All([vol.Coerce(float)], vol.Length(min=4, max=4)),
        vol.Required("rooms"): [ROOM_SCHEMA],
        # сегменты-«стены» (разметочный каркас): [x1,y1,x2,y2], нормированные
        vol.Optional("segments"): [vol.All([vol.Coerce(float)], vol.Length(min=4, max=4))],
    },
    extra=vol.ALLOW_EXTRA,
)
VIRTUAL_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        vol.Required("space"): str,
        vol.Required("name"): str,
        vol.Required("icon"): str,
        vol.Required("x"): vol.Coerce(float),
        vol.Required("y"): vol.Coerce(float),
        vol.Optional("note"): vol.Any(str, None),
        vol.Optional("entity_id"): vol.Any(str, None),
    },
    extra=vol.ALLOW_EXTRA,
)
CONFIG_SCHEMA = vol.Schema(
    {
        vol.Required("spaces"): [SPACE_SCHEMA],
        vol.Optional("device_overrides", default=dict): {
            str: vol.Schema(
                {
                    vol.Optional("hidden"): bool,
                    vol.Optional("icon"): vol.Any(str, None),
                    vol.Optional("name"): vol.Any(str, None),
                },
                extra=vol.ALLOW_EXTRA,
            )
        },
        vol.Optional("virtual_devices", default=list): [VIRTUAL_SCHEMA],
        vol.Optional("settings", default=dict): vol.Schema({}, extra=vol.ALLOW_EXTRA),
    },
    extra=vol.ALLOW_EXTRA,
)

SPACE_ID_RE = re.compile(r"^[a-z0-9_-]{1,64}$")
PLAN_EXTENSIONS = {"svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}
MAX_PLAN_BYTES = 8 * 1024 * 1024


@callback
def async_register(hass: HomeAssistant) -> None:
    """Регистрация WS-команд."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_plan_set)


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
    if not SPACE_ID_RE.match(space_id):
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
