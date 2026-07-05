"""System health for House Plan (Settings → System → Repairs → System information)."""
from __future__ import annotations

from typing import Any

from homeassistant.components import system_health
from homeassistant.core import HomeAssistant, callback

from .store import get_data


@callback
def async_register(hass: HomeAssistant, register: system_health.SystemHealthRegistration) -> None:
    """Register the system health info callback."""
    register.async_register_info(system_health_info)


async def system_health_info(hass: HomeAssistant) -> dict[str, Any]:
    """Return integration health info."""
    data = get_data(hass)
    if data is None:
        return {"status": "not set up"}
    cfg_raw = await data.config_store.async_load() or {}
    layout_raw = await data.store.async_load() or {}
    config = cfg_raw.get("config", {})
    return {
        "config_rev": cfg_raw.get("rev", 0),
        "spaces": len(config.get("spaces", [])),
        "rooms": sum(len(s.get("rooms", [])) for s in config.get("spaces", [])),
        "markers": len(config.get("markers", [])),
        "layout_entries": len(layout_raw.get("layout", {})),
    }
