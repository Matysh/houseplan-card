"""Small registry projection shared by import HTTP and WebSocket previews."""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant


def import_registry_snapshot(hass: HomeAssistant) -> dict[str, set[str]]:
    """Return non-sensitive target inventory used only for preview counts."""
    from homeassistant.helpers import area_registry as ar
    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er

    entities = list(er.async_get(hass).entities.values())
    active_entity: set[str] = set()
    disabled_entity: set[str] = set()
    entities_by_device: dict[str, list[Any]] = {}
    for entry in entities:
        entity_id = str(entry.entity_id)
        if getattr(entry, "disabled_by", None) is None:
            active_entity.add(entity_id)
        else:
            disabled_entity.add(entity_id)
        if entry.device_id:
            entities_by_device.setdefault(str(entry.device_id), []).append(entry)

    # Synthetic/runtime entities may legitimately have no registry row.
    active_entity.update(str(state.entity_id) for state in hass.states.async_all())

    active_device: set[str] = set()
    disabled_device: set[str] = set()
    for entry in dr.async_get(hass).devices.values():
        device_id = str(entry.id)
        children = entities_by_device.get(device_id, [])
        disabled = getattr(entry, "disabled_by", None) is not None or (
            bool(children)
            and all(getattr(child, "disabled_by", None) is not None for child in children)
        )
        (disabled_device if disabled else active_device).add(device_id)
    return {
        "active_device": active_device,
        "disabled_device": disabled_device,
        "active_entity": active_entity,
        "disabled_entity": disabled_entity - active_entity,
        "areas": {str(entry.id) for entry in ar.async_get(hass).areas.values()},
    }
