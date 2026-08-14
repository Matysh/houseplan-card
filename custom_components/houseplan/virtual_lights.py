"""Persistent operational state for manual virtual lights."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .store import HouseplanStore


EVENT_VIRTUAL_LIGHT_UPDATED = "houseplan_virtual_light_updated"


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
    rev, state_config_rev, stored_off = _read_state(stored)
    eligible = eligible_virtual_light_ids(config)
    off = stored_off & eligible if state_config_rev == config_rev else set()
    if off != stored_off:
        rev += 1
    payload = _wire(rev, config_rev, off)
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
    rev, state_config_rev, stored_off = _read_state(stored)
    eligible = eligible_virtual_light_ids(config)
    off = stored_off & eligible if state_config_rev == previous_config_rev else set()
    if off != stored_off:
        rev += 1
    payload = _wire(rev, config_rev, off)
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
