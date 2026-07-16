"""Diagnostics for House Plan (Settings → ... → Download diagnostics)."""
from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from .store import HouseplanConfigEntry

# Marker metadata may contain personal notes, external links and manual filenames.
TO_REDACT = {"link", "description", "pdfs", "name"}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: HouseplanConfigEntry
) -> dict[str, Any]:
    """Return a redacted dump of the stores."""
    data = entry.runtime_data
    cfg_raw = await data.config_store.async_load() or {}
    layout_raw = await data.store.async_load() or {}
    config = cfg_raw.get("config", {})
    layout = layout_raw.get("layout", {})
    return {
        "options": dict(entry.options),
        "rev": cfg_raw.get("rev", 0),
        "spaces": [
            {
                "id": s.get("id"),
                "aspect": s.get("aspect"),
                "has_plan": bool(s.get("plan_url")),
                "rooms": len(s.get("rooms", [])),
                "rooms_with_area": sum(1 for r in s.get("rooms", []) if r.get("area")),
            }
            for s in config.get("spaces", [])
        ],
        "markers": async_redact_data(config.get("markers", []), TO_REDACT),
        "settings": config.get("settings", {}),
        "layout_entries": len(layout),
    }
