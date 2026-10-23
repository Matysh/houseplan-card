"""Bounded, integration-independent full path values (no HA or vendor imports)."""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any

MAX_POINTS = 100_000
MAX_SEGMENTS = 1024
MAX_JSON_BYTES = 8 * 1024 * 1024
MAX_ENTRY_BYTES = 64 * 1024 * 1024
DREAME_SCHEMA = "tasshack-2.0.2"
Path = list[list[list[float]]]


class PathRejected(ValueError):
    """An invalid/oversize snapshot must not replace the last good path."""


def number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        return float(value) if math.isfinite(value) else None
    except OverflowError:
        return None


def point(value: Any) -> list[float] | None:
    if isinstance(value, dict):
        x, y = number(value.get("x")), number(value.get("y"))
    elif isinstance(value, (list, tuple)) and len(value) >= 2:
        x, y = number(value[0]), number(value[1])
    else:
        return None
    return [x, y] if x is not None and y is not None else None


def normalize_paths(raw: Any) -> Path:
    """Never filter through a bad point or invent a connector at a gap.

    Raw data is retained, not index-sampled. A singleton is significant as a
    discontinuity even though SVG cannot draw a line from it. All budgets are
    checked before accepting the complete value, including after splitting.
    """
    if isinstance(raw, dict):
        raw = raw.get("path", raw.get("points"))
    if not isinstance(raw, (list, tuple)):
        raise PathRejected("unsupported")
    if len(raw) > MAX_POINTS:
        raise PathRejected("limited")
    flat = any(
        isinstance(v, dict) and ("x" in v or "y" in v)
        or isinstance(v, (list, tuple)) and len(v) >= 2
        and not isinstance(v[0], (list, tuple, dict))
        for v in raw
    )
    segments = [raw] if flat else raw
    out: Path = []
    count = 0
    visited = 0
    size = 2
    for segment in segments:
        if not isinstance(segment, (list, tuple)):
            continue
        current: list[list[float]] = []
        for candidate in segment:
            visited += 1
            if visited > MAX_POINTS:
                raise PathRejected("limited")
            p = point(candidate)
            if p is None:
                if current:
                    out.append(current)
                    current = []
                    if len(out) > MAX_SEGMENTS:
                        raise PathRejected("limited")
                continue
            if current and current[-1] == p:
                continue
            current.append(p)
            count += 1
            size += len(json.dumps(p, separators=(",", ":"))) + 1
            if count > MAX_POINTS or size > MAX_JSON_BYTES:
                raise PathRejected("limited")
        if current:
            out.append(current)
        if len(out) > MAX_SEGMENTS:
            raise PathRejected("limited")
    if len(json.dumps(out, separators=(",", ":"))) > MAX_JSON_BYTES:
        raise PathRejected("limited")
    return out


def attribute_snapshot(raw: Any, map_key: str) -> PathSnapshot:
    """An explicit empty full value is data; all-invalid input is not."""
    value = raw.get("path", raw.get("points")) if isinstance(raw, dict) else raw
    paths = normalize_paths(raw)
    if not paths and value != [] and value != ():
        raise PathRejected("unsupported")
    return snapshot("attributes", "full-path-v1", paths, map_key)


@dataclass(frozen=True, slots=True)
class PathSnapshot:
    """A complete value, not a delta. Private identity never goes on the bus."""

    provider: str
    schema: str
    paths: Path
    map_key: str
    revision: int | None
    digest: str
    job_id: str | None = None
    final: bool = False


def snapshot(provider: str, schema: str, paths: Path, map_key: str,
             revision: int | None = None, job_id: str | None = None,
             final: bool = False) -> PathSnapshot:
    digest = hashlib.sha256(
        json.dumps(paths, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return PathSnapshot(provider, schema, paths, map_key, revision, digest, job_id, final)


def dreame_coordinate_key(map_key: Any) -> tuple[str | int, str | int | None] | None:
    """Only the pinned ordinary serializer's saved floor/slot is permanent.

    map_id is a live transport map while saved_map_id names its saved floor.
    A restored ordinary map can put that same floor in map_id instead. Keep
    the old three-field Store representation; normalize only for comparison.
    """
    if not isinstance(map_key, str) or len(map_key) > 1024:
        return None
    try:
        fields = json.loads(map_key)
    except (ValueError, RecursionError):
        return None
    if not isinstance(fields, list) or len(fields) != 3 or fields[0] is None or any(
        value is not None and (type(value) not in (str, int) or len(str(value)) > 256)
        for value in fields
    ):
        return None
    return fields[1] if fields[1] is not None else fields[0], fields[2]


def is_current_dreame_snapshot(value: PathSnapshot) -> bool:
    """These full reads are ordered by the collector, not a lifetime frame id."""
    return value.provider == "dreame" and value.schema == DREAME_SCHEMA \
        and dreame_coordinate_key(value.map_key) is not None


def same_native_coordinates(prior: Any, value: PathSnapshot, schema: str | None) -> bool:
    identity = [value.provider, value.map_key]
    if prior is None or prior == identity:
        return True
    if not is_current_dreame_snapshot(value) or schema != DREAME_SCHEMA \
            or not isinstance(prior, list) or len(prior) != 2 or prior[0] != "dreame":
        return False
    old = dreame_coordinate_key(prior[1])
    return old is not None and old == dreame_coordinate_key(value.map_key)


def dreame_snapshot(payload: Any) -> PathSnapshot:
    """Tasshack 2.0.2 ordinary camera serializer, pinned in docs/VACUUM.md.

    [S/W/M kind, x,y,...] starts an independently ordered chunk. The kind is
    metadata, NOT an SVG command. Coordinates are the same raw millimetres as
    robot_position/calibration; no pixel conversion or guessed Y reflection.
    Vendor allocation happens before this bridge; our own parse is bounded.
    """
    if not isinstance(payload, (str, bytes)):
        raise PathRejected("unsupported")
    if len(payload) > MAX_JSON_BYTES:
        raise PathRejected("limited")
    if isinstance(payload, str):
        if len(payload.encode("utf-8")) > MAX_JSON_BYTES:
            raise PathRejected("limited")
    try:
        data = json.loads(payload)
    except (ValueError, UnicodeError, RecursionError) as err:
        raise PathRejected("unsupported") from err
    if not isinstance(data, dict) or data.get("version") != 2:
        raise PathRejected("unsupported")
    map_fields = [data.get(key) for key in ("map_id", "saved_map_id", "map_index")]
    if map_fields[0] is None or any(
        value is not None and (isinstance(value, bool)
                               or not isinstance(value, (str, int))
                               or len(str(value)) > 256)
        for value in map_fields
    ):
        raise PathRejected("coordinates_unverified")
    if any(data.get(flag) is True for flag in (
        "saved_map", "wifi_map", "history_map", "recovery_map",
    )):
        raise PathRejected("unsupported")
    raw = data.get("path")
    if not isinstance(raw, list):
        raise PathRejected("empty")
    chunks: list[list[Any]] = []
    for chunk in raw:
        if not isinstance(chunk, list) or not chunk or chunk[0] not in (1, 2, 3) \
                or isinstance(chunk[0], bool) or len(chunk) % 2 != 1:
            raise PathRejected("unsupported")
        if len(chunk) > MAX_POINTS * 2 + 1:
            raise PathRejected("limited")
        chunks.append([chunk[i:i + 2] for i in range(1, len(chunk), 2)])
    paths = normalize_paths(chunks)
    if raw and not paths:
        raise PathRejected("unsupported")
    revision = data.get("frame_id")
    if isinstance(revision, bool) or not isinstance(revision, int):
        revision = None
    # The public ordinary serializer has no proven job id or explicit final
    # marker. Do not fabricate either from receive time, map/frame or progress.
    # map_id alone can repeat across floors; these are private provider map
    # coordinates, never replacements for the saved HA route/map id.
    map_key = json.dumps(map_fields, separators=(",", ":"))
    return snapshot("dreame", DREAME_SCHEMA, paths, map_key, revision)


PUBLIC_RUN_KEYS = frozenset({
    "map_id", "route_id", "started", "ended", "points", "paths", "path_format",
    "quality", "provenance", "received_at", "final_status", "revision",
})


def public_trails(value: Any) -> dict[str, Any]:
    """Exact read policy stays shared; disclose no vendor/source identity."""
    if not isinstance(value, dict):
        return {}
    result: dict[str, Any] = {}
    for marker, record in value.items():
        if not isinstance(record, dict):
            continue
        public: dict[str, Any] = {}
        for slot in ("current", "previous"):
            run = record.get(slot)
            if not isinstance(run, dict):
                continue
            # Unknown future geometry is never interpreted as format 2.
            if isinstance(run.get("path_format"), bool) or run.get("path_format", 1) not in (1, 2):
                continue
            exposed = {key: item for key, item in run.items() if key in PUBLIC_RUN_KEYS}
            for key, allowed in (
                ("quality", {"source", "reason", "raw_points", "stored_points", "rendered_points"}),
                ("provenance", {"provider", "schema", "coordinate_space"}),
            ):
                if isinstance(exposed.get(key), dict):
                    exposed[key] = {k: v for k, v in exposed[key].items()
                                    if k in allowed and (isinstance(v, str) or number(v) is not None)}
            public[slot] = exposed
        result[str(marker)] = public
    return result
