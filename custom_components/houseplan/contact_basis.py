"""Optional reference faces. No geometry inference, read migration or live writes."""
from __future__ import annotations

import copy
import json
import math
from typing import Any, TypeGuard

import voluptuous as vol


def _number(value: Any, limit: float) -> TypeGuard[int | float]:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and abs(value) <= limit)


def valid_contact_basis(value: Any) -> TypeGuard[dict[str, Any]]:
    """Known v1 only; an unknown future block remains opaque/inert."""
    if not isinstance(value, dict) or type(value.get("v")) is not int or value["v"] != 1:
        return False
    at, diameter, box = value.get("at"), value.get("diameter"), value.get("box")
    return bool(
        isinstance(at, dict) and _number(at.get("x"), 5000) and _number(at.get("y"), 5000)
        and isinstance(at.get("s"), str) and 0 < len(at["s"]) <= 64
        and _number(diameter, 10000) and diameter > 0
        and ("legacy" not in value or isinstance(value["legacy"], bool))
        and isinstance(box, list) and len(box) == 4 and all(_number(v, 5000) for v in box)
        and box[0] < box[2] and box[1] < box[3]
        and max(abs(v) for v in box) <= diameter * 64
    )


def validate_contact_bases(candidate: dict[str, Any], previous: dict[str, Any]) -> None:
    """Only changed known blocks are judged; unrelated legacy/future data survives."""
    for key, entry in candidate.items():
        if not isinstance(entry, dict) or "contact_basis" not in entry:
            continue
        value = entry["contact_basis"]
        old = previous.get(key)
        if isinstance(old, dict) and value == old.get("contact_basis"):
            continue
        if isinstance(value, dict) and value.get("v") != 1:
            continue
        if (not valid_contact_basis(value) or value["at"] != {
            "x": entry.get("x"), "y": entry.get("y"), "s": entry.get("s"),
        } or len(json.dumps(value, separators=(",", ":"))) > 2048):
            raise vol.Invalid("invalid device contact basis")


def remap_contact_basis(entry: dict[str, Any], space_id: str) -> dict[str, Any]:
    """Copy-space changes only a valid matching basis's own space identity."""
    result = copy.deepcopy(entry)
    basis = result.get("contact_basis")
    if valid_contact_basis(basis) and basis["at"] == {
        "x": entry.get("x"), "y": entry.get("y"), "s": entry.get("s"),
    }:
        basis["at"]["s"] = space_id
    result["s"] = space_id
    return result
