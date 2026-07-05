"""Storage helpers: versioned stores and per-entry runtime data."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_CONFIG_KEY, STORAGE_KEY, STORAGE_MINOR_VERSION, STORAGE_VERSION


class HouseplanStore(Store):
    """Store with a migration hook.

    Bump STORAGE_MINOR_VERSION for backward-compatible schema additions and
    STORAGE_VERSION for breaking changes, then handle them here. Keeping the
    skeleton in place from day one means old installations always pass through
    a single, tested upgrade path.
    """

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        data = old_data
        # if old_major_version == 1 and old_minor_version < 2:
        #     ...migrate...
        return data


@dataclass
class HouseplanData:
    """Runtime data of the single config entry (entry.runtime_data)."""

    store: HouseplanStore
    config_store: HouseplanStore
    # One lock for every load→modify→save cycle of both stores: prevents
    # lost updates from concurrent WS calls and makes the rev check atomic.
    write_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


HouseplanConfigEntry = ConfigEntry[HouseplanData]


def create_data(hass: HomeAssistant) -> HouseplanData:
    """Create the stores for a config entry."""
    return HouseplanData(
        store=HouseplanStore(hass, STORAGE_VERSION, STORAGE_KEY, minor_version=STORAGE_MINOR_VERSION),
        config_store=HouseplanStore(
            hass, STORAGE_VERSION, STORAGE_CONFIG_KEY, minor_version=STORAGE_MINOR_VERSION
        ),
    )


def get_data(hass: HomeAssistant) -> HouseplanData | None:
    """Runtime data of the loaded entry, or None when not set up."""
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    return entries[0].runtime_data if entries else None


def get_entry(hass: HomeAssistant) -> ConfigEntry | None:
    """The loaded config entry, or None."""
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    return entries[0] if entries else None
