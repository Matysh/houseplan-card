"""System health for House Plan (Settings → System → Repairs → System information)."""
from __future__ import annotations

from typing import Any

from homeassistant.components import system_health
from homeassistant.core import HomeAssistant, callback

from .frontend_registration import get_frontend_registration_state
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
    result = {
        "config_rev": cfg_raw.get("rev", 0),
        "spaces": len(config.get("spaces", [])),
        "rooms": sum(len(s.get("rooms", [])) for s in config.get("spaces", [])),
        "room_drafts": sum(len(s.get("room_drafts", [])) for s in config.get("spaces", [])),
        "partitions": sum(len(s.get("partitions", [])) for s in config.get("spaces", [])),
        "wall_columns": sum(len(s.get("wall_columns", [])) for s in config.get("spaces", [])),
        "markers": len(config.get("markers", [])),
        "layout_entries": len(layout_raw.get("layout", {})),
    }
    frontend = get_frontend_registration_state(hass)
    if frontend is None:
        result.update(
            {
                "card_file": "missing",
                "static_path": "not_registered",
                "resource_status": "not_attempted",
                "resource_loader": "none",
                "resource_url": "unavailable",
                "resource_retry": "not_needed",
                "resource_error": "none",
                "first_reload_notice": "pending_frontend",
            }
        )
        return result

    result.update(
        {
            "card_file": "present" if frontend.card_file_present else "missing",
            "static_path": (
                "registered"
                if frontend.static_path_registered
                else "not_registered"
            ),
            "resource_status": frontend.resource_status,
            "resource_loader": frontend.loader,
            "resource_url": frontend.module_url or "unavailable",
            "resource_retry": (
                "pending"
                if frontend.retry_pending
                else "attempted"
                if frontend.retry_attempted
                else "not_needed"
            ),
            "resource_error": frontend.last_error or "none",
            "first_reload_notice": frontend.first_reload_notice,
        }
    )
    return result
