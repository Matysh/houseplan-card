"""Bounded, transport-independent own-radio identity and LQI normalization."""
from __future__ import annotations

import json
import math
import re
from typing import Any

MAX_DEVICES = 1500
MAX_INVENTORY_BYTES = 2 * 1024 * 1024
MAX_STATE_BYTES = 64 * 1024
MAX_SNAPSHOT_BYTES = 512 * 1024


def lqi_number(value: object) -> float | None:
    """A real zero is a measurement; partial numbers and booleans are not."""
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    if isinstance(value, str):
        if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value.strip()):
            return None
    try:
        number = float(value)
    except (ValueError, OverflowError):
        return None
    return number if math.isfinite(number) and 0 <= number <= 255 else None


def ieee_of(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.lower().removeprefix("0x").replace(":", "").replace("-", "")
    return text if re.fullmatch(r"[0-9a-f]{16}", text) else None


def registry_ieee(domain: str, value: object) -> str | None:
    if domain == "mqtt" and isinstance(value, str):
        match = re.fullmatch(r"zigbee2mqtt(?:_bridge)?_(.+)", value)
        if match is None:
            return None
        value = match[1]
    return ieee_of(value)


def payload_json(payload: object, limit: int) -> Any:
    try:
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        if not isinstance(payload, bytes) or len(payload) > limit:
            return None
        return json.loads(payload)
    except (ValueError, UnicodeError, RecursionError):
        return None


def inventory_of(payload: object) -> dict[str, str] | None:
    """Only a complete, unambiguous bridge inventory can authorize addresses."""
    rows = payload_json(payload, MAX_INVENTORY_BYTES)
    if not isinstance(rows, list) or len(rows) > MAX_DEVICES:
        return None
    result: dict[str, str] = {}
    addresses: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            return None
        ieee = ieee_of(row.get("ieee_address"))
        name = row.get("friendly_name")
        if not ieee or not isinstance(name, str) or not name or len(name) > 512 or re.search(r"[#+\x00-\x1f\x7f]", name):
            return None
        if name.startswith("/") or name.endswith("/") or name.startswith("bridge/"):
            return None
        # Attribute output must not collide with another device's JSON topic.
        if ieee in result or name in addresses or name + "/linkquality" in addresses or name.removesuffix("/linkquality") in addresses:
            return None
        result[ieee] = name
        addresses.add(name)
    return result


def represented_devices(config: dict, devices: dict, entities: dict) -> set[str]:
    """Read scope includes hidden markers and bound room inventories, never neighbours."""
    scope: set[str] = set()
    areas = {room.get("area") for space in config.get("spaces", []) if isinstance(space, dict)
             for room in space.get("rooms", []) if isinstance(room, dict) and room.get("area")}
    for key, device in devices.items():
        if device.area_id in areas and getattr(device, "disabled_by", None) is None:
            scope.add(key)
    for entity in entities.values():
        if entity.area_id in areas and entity.device_id and getattr(entity, "disabled_by", None) is None:
            scope.add(entity.device_id)
    for marker in config.get("markers", []):
        if not isinstance(marker, dict) or marker.get("removed") is True:
            continue
        binding = marker.get("binding", "")
        if not isinstance(binding, str):
            continue
        kind, _, reference = binding.partition(":")
        if kind == "device":
            scope.add(reference)
        elif kind == "entity" and (entity := entities.get(reference)) is not None and getattr(entity, "disabled_by", None) is None:
            scope.add(entity.device_id)
    return {key for key in scope if key in devices and getattr(devices[key], "disabled_by", None) is None}
