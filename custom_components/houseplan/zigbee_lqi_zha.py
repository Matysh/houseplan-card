"""Read cached ZHA values across HA 2024.6 and the external-zha gateway era.

No ZHA import or radio operation: optional providers remain optional. Shapes
follow core 2024.6 core/gateway.py and current zha/helpers.py gateway_proxy.
"""
from __future__ import annotations

from collections.abc import Mapping

from .zigbee_lqi_model import MAX_DEVICES, ieee_of, lqi_number


def read_zha(hass) -> tuple[object | None, str | None, dict[str, float | None]]:
    try:
        return _read_zha(hass)
    except Exception:  # noqa: BLE001 - an unsupported optional provider cannot stop Z2M
        return None, None, {}


def _read_zha(hass) -> tuple[object | None, str | None, dict[str, float | None]]:
    data = hass.data.get("zha")
    if data is None:
        return None, None, {}
    gateway = getattr(data, "gateway", None)
    if gateway is None:
        gateway = getattr(getattr(data, "gateway_proxy", None), "gateway", None)
    if gateway is None or getattr(gateway, "shutting_down", False):
        return None, None, {}
    devices = getattr(gateway, "devices", None)
    entry = getattr(gateway, "config_entry", None)
    if entry is None:
        entry = getattr(getattr(gateway, "config", None), "config_entry", None)
    if entry is None:
        entry = getattr(data, "config_entry", None)
    if entry is None:
        entry = getattr(getattr(data, "gateway_proxy", None), "config_entry", None)
    entry_id = getattr(entry, "entry_id", None)
    if not isinstance(devices, Mapping) or len(devices) > MAX_DEVICES or not isinstance(entry_id, str):
        return None, None, {}
    values: dict[str, float | None] = {}
    for device in devices.values():
        ieee = ieee_of(str(getattr(device, "ieee", "")))
        if ieee:
            values[ieee] = lqi_number(getattr(device, "lqi", None))
    return gateway, entry_id, values
