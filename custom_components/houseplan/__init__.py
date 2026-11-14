"""HA entrypoints without eager HA imports, so the plan core is reusable."""
from __future__ import annotations

import importlib
from types import ModuleType
from typing import TYPE_CHECKING

from .core.constants import DOMAIN as DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .store import HouseplanConfigEntry

_HA_ADAPTER: ModuleType | None = None


async def _adapter(hass: HomeAssistant) -> ModuleType:
    """Keep first-time adapter imports off HA's loop, including direct setup_entry."""
    global _HA_ADAPTER
    if _HA_ADAPTER is not None:
        # HA may unload after its executor has stopped. Cache only a completed
        # import, never a partially initialized sys.modules entry or a hass.
        return _HA_ADAPTER
    executor = getattr(hass, "async_add_import_executor_job", None)
    if executor is None:
        # Retain the supported old/test host interface without blocking its loop.
        executor = hass.async_add_executor_job
    adapter = await executor(importlib.import_module, f"{__name__}.ha_integration")
    _HA_ADAPTER = adapter
    return adapter


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register the unchanged integration through its HA lifecycle adapter."""
    adapter = await _adapter(hass)
    return await adapter.async_setup(hass, config)


async def async_setup_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Set up an entry, including callers that did not invoke async_setup first."""
    adapter = await _adapter(hass)
    return await adapter.async_setup_entry(hass, entry)


async def async_unload_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> bool:
    """Unload without changing persistence and coordinator shutdown ordering."""
    adapter = await _adapter(hass)
    return await adapter.async_unload_entry(hass, entry)


async def async_remove_entry(hass: HomeAssistant, entry: HouseplanConfigEntry) -> None:
    """Remove HA registrations using their existing owner."""
    adapter = await _adapter(hass)
    await adapter.async_remove_entry(hass, entry)


async def _async_flush_runtime(hass: HomeAssistant, entry: HouseplanConfigEntry) -> None:
    """Compatibility entry for the existing stop/unload writer boundary."""
    adapter = await _adapter(hass)
    await adapter._async_flush_runtime(hass, entry)
