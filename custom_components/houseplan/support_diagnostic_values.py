"""Small, HA-free privacy primitives for opt-in support package 2 (#942).

Only a projector knows which fields it may offer here. These helpers never
walk an arbitrary config object, stringify provider data, or invent geometry.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


def finite(value: object) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def point(value: object) -> list[float] | None:
    if isinstance(value, dict):
        pair = [value.get("x"), value.get("y")]
    elif isinstance(value, (list, tuple)) and len(value) >= 2:
        pair = [value[0], value[1]]
    else:
        return None
    return pair if all(finite(item) for item in pair) else None


@dataclass
class DiagnosticIds:
    """One namespace for config, client and server references in one package.

    A map ID is already normalized by the actual consumer before entering this
    table. In particular 0/"0" name one map; the empty string is not null.
    """

    namespace: str
    maps: dict[str, dict[str, str]] = field(default_factory=dict)

    def get(self, kind: str, raw: object) -> str | None:
        if raw is None:
            return None
        if isinstance(raw, bool) or not isinstance(raw, (str, int)):
            return None
        values = self.maps.setdefault(kind, {})
        key = str(raw)
        if key not in values:
            values[key] = f"{kind}-{self.namespace}-{len(values) + 1}"
        return values[key]


def relative_time(value: object, now: float) -> dict[str, Any]:
    """Keep sign/precision of elapsed time, never an absolute user timestamp."""
    if value is None:
        return {"state": "null"}
    if not finite(value) or not finite(now) or not finite(now - value):
        return {"state": "invalid"}
    return {"state": "valid", "age_s": now - value}


@dataclass
class GeometryBudget:
    """Shared across ALL robot input/current/previous/local samples."""

    points: int = 4096
    fragments: int = 256
    scans: int = 100_000


def sample_path(raw: object, budget: GeometryBudget) -> dict[str, Any]:
    """Copy contiguous original ranges, with literal gaps and exact indices.

    This executor-side helper scans at most the existing provider quota. A
    clipped scan is explicit; it never labels an uninspected tail valid. The
    caller retains any authoritative pre-sampling raw/stored/rendered counts
    separately. No index decimation, coordinate rounding or affine transform.
    """
    if isinstance(raw, dict):
        raw = raw.get("path", raw.get("points"))
    if not isinstance(raw, (list, tuple)):
        return {
            "status": "unavailable",
            "raw_points": 0,
            "valid_points": 0,
            "invalid_points": 0,
            "kept_points": 0,
            "total_fragments": 0,
            "scan_limited": False,
            "truncated": False,
            "fragments": [],
        }

    def point_shape(value: object) -> bool:
        return isinstance(value, dict) or (
            isinstance(value, (list, tuple))
            and len(value) >= 2
            and not isinstance(value[0], (list, tuple, dict))
        )

    # Detection and scans have an independent ceiling even on hostile inputs.
    first = next(
        (item for item in raw[:1024] if isinstance(item, (dict, list, tuple)) and item),
        None,
    )
    flat = point_shape(first)
    groups = [raw] if flat else raw
    scan_limited = len(groups) > 1024
    raw_count = valid = invalid = kept = scanned = 0
    fragments: list[dict[str, Any]] = []
    for fragment_index, group in enumerate(groups[:1024]):
        if not isinstance(group, (list, tuple)):
            invalid += 1
            continue
        raw_count += len(group)
        current: dict[str, Any] | None = None
        for index, candidate in enumerate(group):
            if scanned >= 100_000 or budget.scans <= 0:
                scan_limited = True
                break
            scanned += 1
            budget.scans -= 1
            p = point(candidate)
            if p is None:
                invalid += 1
                current = None
                continue
            valid += 1
            if budget.points <= 0 or (current is None and budget.fragments <= 0):
                current = None
                continue
            if current is None:
                current = {
                    "fragment": fragment_index,
                    "start": index,
                    "end": index,
                    "points": [],
                }
                fragments.append(current)
                budget.fragments -= 1
            current["points"].append(p)
            current["end"] = index + 1
            kept += 1
            budget.points -= 1
    return {
        "status": "available",
        "raw_points": raw_count,
        "valid_points": valid,
        "invalid_points": invalid,
        "kept_points": kept,
        "total_fragments": len(groups),
        "scan_limited": scan_limited,
        "truncated": scan_limited or kept < valid,
        "fragments": fragments,
    }
