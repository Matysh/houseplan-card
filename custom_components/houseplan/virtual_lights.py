"""Persistent operational state for manual virtual lights."""
from __future__ import annotations

import asyncio
import copy
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .store import HouseplanStore


EVENT_VIRTUAL_LIGHT_UPDATED = "houseplan_virtual_light_updated"
SAVE_DELAY_S = 0.5
_LOGGER = logging.getLogger(__name__)


def is_manual_virtual_light(marker: Any) -> bool:
    """Return whether a marker uses the exact persistent manual-light mode."""
    return (
        isinstance(marker, dict)
        and isinstance(marker.get("id"), str)
        and bool(marker["id"])
        and marker.get("binding") == "virtual"
        and marker.get("is_light") is True
        and marker.get("tap_action") == "toggle"
        and marker.get("removed") is not True
    )


def eligible_virtual_light_ids(config: Any) -> set[str]:
    """Collect live marker ids eligible for persistent manual state."""
    if not isinstance(config, dict):
        return set()
    markers = config.get("markers")
    if not isinstance(markers, list):
        return set()
    return {marker["id"] for marker in markers if is_manual_virtual_light(marker)}


def _integer(value: Any, default: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(0, parsed)


def _read_state(stored: Any) -> tuple[int, int, set[str]]:
    if not isinstance(stored, dict):
        return 0, 0, set()
    raw_off = stored.get("off")
    off = (
        {item for item in raw_off if isinstance(item, str) and item}
        if isinstance(raw_off, list)
        else set()
    )
    return _integer(stored.get("rev")), _integer(stored.get("config_rev")), off


def _wire(rev: int, config_rev: int, off: set[str]) -> dict[str, Any]:
    return {"rev": rev, "config_rev": config_rev, "off": sorted(off)}


def _snapshot_payload(
    stored: Any,
    config: dict[str, Any],
    config_rev: int,
    *,
    previous_config_rev: int | None = None,
) -> dict[str, Any]:
    rev, state_config_rev, stored_off = _read_state(stored)
    eligible = eligible_virtual_light_ids(config)
    expected_rev = config_rev if previous_config_rev is None else previous_config_rev
    off = stored_off & eligible if state_config_rev == expected_rev else set()
    if off != stored_off:
        rev += 1
    return _wire(rev, config_rev, off)


class VirtualLightController:
    """Runtime cache with coalesced durable writes for rapid toggles."""

    def __init__(self, store: HouseplanStore) -> None:
        self.store = store
        self._state: dict[str, Any] | None = None
        self._dirty = False
        self._save_task: asyncio.Task[None] | None = None
        self._flush_event = asyncio.Event()

    async def async_snapshot(
        self, config: dict[str, Any], config_rev: int,
    ) -> dict[str, Any]:
        source = self._state
        if source is None:
            source = await self.store.async_load() or {}
        payload = _snapshot_payload(source, config, config_rev)
        self._state = payload
        if payload != source:
            self._dirty = True
            self._schedule_save()
        return copy.deepcopy(payload)

    async def async_toggle(
        self,
        config: dict[str, Any],
        config_rev: int,
        marker_id: str,
    ) -> dict[str, Any] | None:
        if marker_id not in eligible_virtual_light_ids(config):
            return None
        snapshot = await self.async_snapshot(config, config_rev)
        off = set(snapshot["off"])
        if marker_id in off:
            off.remove(marker_id)
        else:
            off.add(marker_id)
        payload = _wire(_integer(snapshot["rev"]) + 1, config_rev, off)
        self._state = payload
        self._dirty = True
        self._schedule_save()
        return {
            "marker_id": marker_id,
            "on": marker_id not in off,
            "rev": payload["rev"],
        }

    def _schedule_save(self) -> None:
        if self._save_task is None or self._save_task.done():
            self._save_task = asyncio.create_task(self._delayed_save())

    async def _delayed_save(self) -> None:
        try:
            while self._dirty:
                if not self._flush_event.is_set():
                    try:
                        await asyncio.wait_for(
                            self._flush_event.wait(), timeout=SAVE_DELAY_S,
                        )
                    except TimeoutError:
                        pass
                if not self._dirty or self._state is None:
                    continue
                payload = copy.deepcopy(self._state)
                self._dirty = False
                try:
                    await self.store.async_save(payload)
                except Exception:  # noqa: BLE001 - next toggle/unload retries
                    self._dirty = True
                    _LOGGER.exception("House Plan: virtual-light delayed save failed")
                    return
        finally:
            self._save_task = None
            if not self._dirty:
                self._flush_event.clear()

    async def async_flush(self) -> None:
        """Persist the latest state before config transitions or unload."""
        task = self._save_task
        if task is not None:
            self._flush_event.set()
            await task
        if self._dirty and self._state is not None:
            payload = copy.deepcopy(self._state)
            await self.store.async_save(payload)
            self._dirty = False
        if not self._dirty:
            self._flush_event.clear()

    def reset(self) -> None:
        """Forget cache after an external reconciliation wrote the store."""
        self._state = None


async def async_virtual_light_snapshot(
    store: HouseplanStore,
    config: dict[str, Any],
    config_rev: int,
) -> dict[str, Any]:
    """Return a coherent snapshot, repairing stale or interrupted state.

    A revision gap means an older writer may have changed eligibility without
    knowing about this Store.  Clearing every manual-off bit is conservative:
    it restores the pre-feature/default-on behaviour and cannot resurrect an
    old off state for a marker whose role changed in the meantime.
    """
    stored = await store.async_load() or {}
    payload = _snapshot_payload(stored, config, config_rev)
    if payload != stored:
        await store.async_save(payload)
    return payload


async def async_reconcile_virtual_lights(
    store: HouseplanStore,
    config: dict[str, Any],
    config_rev: int,
    *,
    previous_config_rev: int,
) -> dict[str, Any]:
    """Carry eligible state across one known configuration transition."""
    stored = await store.async_load() or {}
    payload = _snapshot_payload(
        stored, config, config_rev, previous_config_rev=previous_config_rev,
    )
    if payload != stored:
        await store.async_save(payload)
    return payload


async def async_toggle_virtual_light(
    store: HouseplanStore,
    config: dict[str, Any],
    config_rev: int,
    marker_id: str,
) -> dict[str, Any] | None:
    """Atomically invert one eligible marker and persist before returning."""
    if marker_id not in eligible_virtual_light_ids(config):
        return None
    snapshot = await async_virtual_light_snapshot(store, config, config_rev)
    off = set(snapshot["off"])
    if marker_id in off:
        off.remove(marker_id)
    else:
        off.add(marker_id)
    payload = _wire(_integer(snapshot["rev"]) + 1, config_rev, off)
    await store.async_save(payload)
    return {
        "marker_id": marker_id,
        "on": marker_id not in off,
        "rev": payload["rev"],
    }
