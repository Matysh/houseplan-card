"""Storage helpers: versioned stores and per-entry runtime data."""
from __future__ import annotations

import asyncio
import copy
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    STORAGE_CONFIG_KEY,
    STORAGE_KEY,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
    STORAGE_VIRTUAL_LIGHTS_KEY,
)
from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
)


_LOGGER = logging.getLogger(__name__)
_BG_MODES = frozenset({"static", "daynight"})


def migrate_config_background_mode(old_data: dict[str, Any]) -> dict[str, Any]:
    """Materialize the legacy implicit background mode without changing its view.

    Only the config-store document has a top-level ``config`` object. Layout
    and virtual-light stores pass through this helper unchanged even though
    they share the same Store subclass and minor version.
    """
    config = old_data.get("config")
    if not isinstance(config, dict):
        return old_data
    settings = config.get("settings")
    mode = settings.get("bg_mode") if isinstance(settings, dict) else None
    if mode in _BG_MODES:
        return old_data

    data = copy.deepcopy(old_data)
    migrated_config = data["config"]
    migrated_settings = migrated_config.get("settings")
    if not isinstance(migrated_settings, dict):
        migrated_settings = {}
        migrated_config["settings"] = migrated_settings
    migrated_settings["bg_mode"] = "static"
    return data


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
        if old_major_version == 1 and old_minor_version < 2:
            return migrate_config_background_mode(old_data)
        return old_data


@dataclass
class HouseplanData:
    """Runtime data of the single config entry (entry.runtime_data)."""

    store: HouseplanStore
    config_store: HouseplanStore
    virtual_light_store: HouseplanStore
    # One lock for every load→modify→save cycle of both stores: prevents
    # lost updates from concurrent WS calls and makes the rev check atomic.
    write_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # A separate, narrower lock for the check-quota→write-file pair of an
    # upload. Without it N parallel uploads all measure the store BEFORE any
    # of them writes, and all pass a quota only one of them fits under
    # (HP-1490-02). Separate from write_lock so a slow directory scan does not
    # stall config/layout commits.
    upload_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Collect files nothing references any more. Set during setup, which also
    # runs it once and schedules it daily. Exposed so it can be invoked
    # directly — a test that fakes a 24 h jump proves the timer fires, not that
    # the work happens, and those are different claims.
    sweep: Callable[[], Awaitable[None]] | None = None
    # Stable HA instance id used only through a one-way export fingerprint.
    instance_id: str = ""
    # Parsed import candidates are short-lived, user-bound and memory-only.
    # dict keeps insertion order, which lets the preview service evict oldest.
    import_previews: dict[str, dict[str, Any]] = field(default_factory=dict)


HouseplanConfigEntry = ConfigEntry[HouseplanData]


def create_data(hass: HomeAssistant) -> HouseplanData:
    """Create the stores for a config entry."""
    return HouseplanData(
        store=HouseplanStore(hass, STORAGE_VERSION, STORAGE_KEY, minor_version=STORAGE_MINOR_VERSION),
        config_store=HouseplanStore(
            hass, STORAGE_VERSION, STORAGE_CONFIG_KEY, minor_version=STORAGE_MINOR_VERSION
        ),
        virtual_light_store=HouseplanStore(
            hass,
            STORAGE_VERSION,
            STORAGE_VIRTUAL_LIGHTS_KEY,
            minor_version=STORAGE_MINOR_VERSION,
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


OPTIMIZE_BACKUP = "optimize_backup"
OPTIMIZE_PENDING = "optimize_pending"
LAYOUT_STORE_CORE_KEYS = frozenset({"layout", "rev"})


def layout_store_payload(
    stored: dict[str, Any],
    layout: dict[str, Any],
    rev: int,
    *,
    metadata: dict[str, Any] | None = None,
    remove: tuple[str, ...] = (),
    replace_metadata: bool = False,
) -> dict[str, Any]:
    """Build one layout-store write without silently dropping metadata.

    Layout used to be saved by several independent dict comprehensions.  Every
    new metadata key therefore had to be added to every caller or was lost on
    the next drag.  All writers now express only the metadata they intentionally
    add/remove and this helper preserves the rest.
    """
    excluded = {*LAYOUT_STORE_CORE_KEYS, *remove}
    out = {} if replace_metadata else {
        key: value for key, value in stored.items() if key not in excluded
    }
    if metadata:
        out.update(metadata)
    out["layout"] = canonicalize_layout_geometry(layout)
    out["rev"] = rev
    return out


async def async_save_layout_state(
    runtime: HouseplanData,
    stored: dict[str, Any],
    layout: dict[str, Any],
    rev: int,
    *,
    metadata: dict[str, Any] | None = None,
    remove: tuple[str, ...] = (),
    replace_metadata: bool = False,
) -> dict[str, Any]:
    """Persist layout and return the exact store document written."""
    payload = layout_store_payload(
        stored,
        layout,
        rev,
        metadata=metadata,
        remove=remove,
        replace_metadata=replace_metadata,
    )
    await runtime.store.async_save(payload)
    return payload


async def async_save_config_state(
    runtime: HouseplanData,
    config: dict[str, Any],
    rev: int,
    *,
    previous_rev: int | None = None,
) -> dict[str, Any]:
    """Persist configuration and reconcile dependent operational state.

    Callers already hold ``runtime.write_lock``.  Reading the previous
    revision here keeps less common writers (import recovery and undo) on the
    same path as ordinary editor saves without duplicating lifecycle rules.
    """
    if previous_rev is None:
        previous = await runtime.config_store.async_load() or {}
        try:
            previous_rev = int(previous.get("rev", 0))
        except (TypeError, ValueError):
            previous_rev = 0

    canonical_config = canonicalize_config_geometry(config)
    payload = {"config": canonical_config, "rev": rev}
    await runtime.config_store.async_save(payload)

    # The config is already durable at this point.  Reconciliation remains a
    # separate Store write; an interrupted pair is detected from config_rev on
    # the next read and fails safe to the compatibility default (all on).
    from .virtual_lights import async_reconcile_virtual_lights

    try:
        await async_reconcile_virtual_lights(
            runtime.virtual_light_store,
            canonical_config,
            rev,
            previous_config_rev=previous_rev,
        )
    except Exception:  # noqa: BLE001 - config commit already stands
        _LOGGER.exception("House Plan: virtual-light state reconciliation failed")
    return payload
