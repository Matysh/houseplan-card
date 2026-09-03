"""Map-to-space routing for multi-floor vacuums (#162).

Python mirror of ``src/vacuum-routes.ts``. The recorder and the import/export
flows must answer "which floor is this map on?" exactly the way the card does,
so both sides are driven by the same shared fixtures in
``test/fixtures/vacuum-routes/``. Keep the two files in step: a divergence here
shows up as a robot drawn on the wrong floor, which is worse than no robot.
"""
from __future__ import annotations

import re
from typing import Any

VAC_ROUTE_LIMIT = 32
VAC_ROUTE_ID_MAX = 128
VAC_ROUTE_SOURCE_MAX = 255
VAC_ROUTE_MAP_ID_MAX = 255
VAC_ROUTE_ERROR = "invalid_vacuum_map_route"

_ENTITY_ID = re.compile(r"^[a-z_]+\.[a-zA-Z0-9_]+$")


def normalize_route_matrix(raw: Any) -> list[float] | None:
    """Six finite numbers, or nothing; a five-number matrix is not almost fine."""
    if not isinstance(raw, (list, tuple)) or len(raw) != 6:
        return None
    out: list[float] = []
    for value in raw:
        # bool is an int in Python; a boolean is not a coordinate.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            return None
        out.append(number)
    return out


def is_entity_id_like(value: Any) -> bool:
    return isinstance(value, str) and bool(_ENTITY_ID.match(value))


def validate_marker_routes(
    marker_id: str, routes: Any, space_ids: set[str] | None,
) -> list[dict[str, str]]:
    """Shape/uniqueness/reference issues for one marker's routes.

    ``space_ids`` None means the spaces are not known in this context (import
    preview), so the referential check is skipped instead of failing every
    route.
    """
    if routes is None:
        return []

    def issue(route_id: str, reason: str) -> dict[str, str]:
        return {
            "code": VAC_ROUTE_ERROR, "markerId": marker_id,
            "routeId": route_id, "reason": reason,
        }

    if not isinstance(routes, list):
        return [issue("", "not_object")]
    problems: list[dict[str, str]] = []
    if len(routes) > VAC_ROUTE_LIMIT:
        problems.append(issue("", "limit"))
    seen_ids: set[str] = set()
    seen_identity: set[str] = set()
    for raw in routes:
        if not isinstance(raw, dict):
            problems.append(issue("", "not_object"))
            continue
        route_id = raw.get("id") if isinstance(raw.get("id"), str) else ""
        if not route_id or len(route_id) > VAC_ROUTE_ID_MAX:
            problems.append(issue(route_id or "", "id"))
            continue
        if route_id in seen_ids:
            problems.append(issue(route_id, "duplicate_id"))
        seen_ids.add(route_id)
        source = raw.get("source")
        if not is_entity_id_like(source) or len(source) > VAC_ROUTE_SOURCE_MAX:
            problems.append(issue(route_id, "source"))
        map_id = raw.get("map_id")
        # An empty map id is a real id (resolve_map_id): type and length only.
        if not isinstance(map_id, str) or len(map_id) > VAC_ROUTE_MAP_ID_MAX:
            problems.append(issue(route_id, "map_id"))
        space = raw.get("space")
        if not isinstance(space, str) or not space:
            problems.append(issue(route_id, "space"))
        elif space_ids is not None and space not in space_ids:
            problems.append(issue(route_id, "unknown_space"))
        calibration = raw.get("calibration")
        if calibration is not None and normalize_route_matrix(calibration) is None:
            problems.append(issue(route_id, "calibration"))
        if isinstance(source, str) and isinstance(map_id, str):
            identity = source + " " + map_id
            if identity in seen_identity:
                problems.append(issue(route_id, "duplicate_identity"))
            seen_identity.add(identity)
    return problems


def legacy_route_id(marker_id: str, source: str, map_id: str) -> str:
    return "legacy:" + marker_id + " " + source + " " + map_id


def effective_routes(
    marker_id: str, vacuum: Any, dock_space: str, discovered_source: str | None = None,
) -> list[dict[str, Any]]:
    """The routes a marker effectively has, legacy calibration included."""
    if not isinstance(vacuum, dict):
        return []
    explicit = vacuum.get("map_routes")
    if isinstance(explicit, list) and explicit:
        out = []
        for route in explicit:
            if not isinstance(route, dict) or not isinstance(route.get("id"), str):
                continue
            if not route["id"]:
                continue
            out.append({
                "id": route["id"],
                "source": str(route.get("source") or ""),
                "map_id": str(route.get("map_id") or ""),
                "space": str(route.get("space") or ""),
                "calibration": normalize_route_matrix(route.get("calibration")),
            })
        return out
    source = vacuum.get("source")
    if not isinstance(source, str) or not source:
        source = discovered_source or ""
    if not source:
        return []
    calibration = vacuum.get("calibration")
    if not isinstance(calibration, dict):
        return []
    out = []
    for map_id, matrix in calibration.items():
        normalized = normalize_route_matrix(matrix)
        if normalized is None:
            continue
        out.append({
            "id": legacy_route_id(marker_id, source, str(map_id)),
            "source": source, "map_id": str(map_id), "space": dock_space,
            "calibration": normalized,
        })
    return out


def resolve_route(
    routes: list[dict[str, Any]], observed: dict[str, str], space_ids: set[str] | None,
) -> dict[str, Any]:
    """Pick the one route the robot is on right now — or refuse to pick.

    List order must never decide a floor: two plausible routes are ambiguous,
    not "the first one".
    """
    matched: list[dict[str, Any]] = []
    saw_telemetry = False
    fallback_source = ""
    fallback_map_id = ""
    for route in routes:
        source = route.get("source")
        if source not in observed:
            continue
        seen = observed[source]
        saw_telemetry = True
        if not fallback_source:
            fallback_source = source
            fallback_map_id = seen
        if seen == route.get("map_id"):
            matched.append(route)
    if len(matched) > 1:
        return {"kind": "ambiguous", "routeIds": sorted(str(r.get("id")) for r in matched)}
    if len(matched) == 1:
        route = matched[0]
        if space_ids is not None and route.get("space") not in space_ids:
            return {"kind": "missing_space", "route": route}
        matrix = normalize_route_matrix(route.get("calibration"))
        if matrix is None:
            return {"kind": "needs_calibration", "route": route}
        return {"kind": "ready", "route": {**route, "calibration": matrix}}
    if saw_telemetry:
        return {"kind": "unmapped", "source": fallback_source, "mapId": fallback_map_id}
    if observed:
        source = sorted(observed)[0]
        return {"kind": "unmapped", "source": source, "mapId": observed[source]}
    return {"kind": "none"}


def adopt_legacy_run(
    run: Any, routes: list[dict[str, Any]], root_source: str | None,
) -> dict[str, Any]:
    """Where a run recorded before #162 belongs (spec 11.3.1).

    Such a run stores only ``{map_id, started, ended, points}``: it carries no
    source at all. The one surviving witness of the subscription that wrote it
    is the marker's root ``vacuum.source``, so that is what narrows the
    candidates; without it only the map id is compared. Two candidates mean the
    run is not drawn — not that the first one wins.
    """
    if not isinstance(run, dict) or not isinstance(run.get("map_id"), str):
        return {"kind": "orphan_run"}
    map_id = run["map_id"]
    root = root_source if isinstance(root_source, str) else ""
    candidates = [route for route in routes if route.get("map_id") == map_id]
    if root:
        candidates = [route for route in candidates if route.get("source") == root]
    if len(candidates) == 1:
        return {"kind": "adopted", "route": candidates[0]}
    if not candidates:
        return {"kind": "orphan_run"}
    return {"kind": "ambiguous_run", "routeIds": sorted(str(r.get("id")) for r in candidates)}
