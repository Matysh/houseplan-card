"""Bounded recovery of known, stale device references in a portable COPY.

Not a geometry optimizer or a permissive config parser. Callers still run the
ordinary structural and semantic validators, with explicit dormant-reference
exceptions only at the transfer boundary. No live HA registry is consulted.
"""
from __future__ import annotations

import math
from typing import Any

from .radar_validation import validate_marker_radars
from .validation import (
    validate_active_marker_ids,
    validate_marker_controls,
    validate_marker_light_entities,
    validate_marker_vacuum_routes,
    validate_marker_value_badges,
)

RECOVERY_VERSION = 1
RECOVERY_EXAMPLES = 24


def radar_spatial_problem(
    marker: dict[str, Any], spaces: dict[str, dict[str, Any]],
) -> bool:
    """Recognize stale spatial context, not malformed radar parameters."""
    radar = marker.get("radar")
    if not isinstance(radar, dict) or radar.get("version") != 1:
        return False
    room_id = radar.get("room_id")
    # Structural errors remain errors, even for a dormant radar.
    if not isinstance(room_id, str) or not room_id:
        return False
    space = spaces.get(str(marker.get("space") or ""))
    if space is None:
        return True
    known = {str(room.get("id")) for room in space.get("rooms") or []}
    if room_id not in known:
        return True
    allowed = radar.get("allowed_room_ids")
    if isinstance(allowed, list) and any(
        isinstance(value, str) and value not in known for value in allowed
    ):
        return True
    calibration = radar.get("calibration")
    cell = calibration.get("cell_cm") if isinstance(calibration, dict) else None
    owner_cell = space.get("cell_cm", 5)
    if all(
        not isinstance(value, bool) and isinstance(value, (float, int))
        and math.isfinite(value) and value > 0
        for value in (cell, owner_cell)
    ):
        return not math.isclose(cell, owner_cell, abs_tol=1e-9)
    return False


class _Report:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.examples: list[dict[str, Any]] = []

    def add(self, kind: str, marker: dict[str, Any], count: int = 1) -> None:
        self.counts[kind] = self.counts.get(kind, 0) + count
        marker_id = str(marker.get("id") or "")[:128]
        existing = next((row for row in self.examples
                         if row["kind"] == kind and row["marker_id"] == marker_id), None)
        if existing is not None:
            existing["count"] += count
        elif len(self.examples) < RECOVERY_EXAMPLES:
            self.examples.append({
                "kind": kind, "marker_id": marker_id,
                "name": str(marker.get("name") or marker_id)[:160], "count": count,
            })

    def result(self) -> dict[str, Any]:
        total = sum(self.counts.values())
        return {
            "version": RECOVERY_VERSION, "total": total, "counts": self.counts,
            "examples": self.examples,
            "remaining": total - sum(row["count"] for row in self.examples),
        }


class _ControlGraph:
    """Bitset closure; one update per marker, not a full DFS per control edge."""

    def __init__(self, markers: dict[str, dict[str, Any]], preserved: set[str]) -> None:
        self.indices = {marker_id: i for i, marker_id in enumerate(markers)}
        self.reachable = [0] * len(markers)
        self.ancestors = [0] * len(markers)
        for marker_id in preserved:
            row = self.indices[marker_id]
            for ref in markers[marker_id].get("controls") or []:
                if isinstance(ref, str) and ref.startswith("marker:"):
                    target = self.indices.get(ref[len("marker:"):])
                    if target is not None:
                        self.reachable[row] |= 1 << target
        if preserved:
            for k, downstream in enumerate(self.reachable):
                if downstream:
                    mask = 1 << k
                    for i, row in enumerate(self.reachable):
                        if row & mask:
                            self.reachable[i] |= downstream
            for i, row in enumerate(self.reachable):
                for target in self._bits(row):
                    self.ancestors[target] |= 1 << i

    @staticmethod
    def _bits(value: int):
        while value:
            bit = value & -value
            yield bit.bit_length() - 1
            value ^= bit

    def cycles(self, source: str, target: str) -> bool:
        a, b = self.indices[source], self.indices[target]
        return a == b or bool(self.reachable[b] & (1 << a))

    def add(self, source: str, targets: list[str]) -> None:
        a = self.indices[source]
        downstream = 0
        for target in targets:
            b = self.indices[target]
            downstream |= (1 << b) | self.reachable[b]
        if downstream & ~self.reachable[a] == 0:
            return
        upstream = self.ancestors[a] | (1 << a)
        for parent in self._bits(upstream):
            self.reachable[parent] |= downstream
        for child in self._bits(downstream):
            self.ancestors[child] |= upstream


def recover_portable_references(
    config: dict[str, Any], *, marker_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Normalize only known broken references in an already schema-checked COPY.

    ``marker_ids`` restricts repairs to incoming markers after a space merge.
    Source documents/live stores must never be passed here without copying.
    Re-running preserves the same config; still-unresolved dormant features
    remain visible as setup warnings instead of being silently forgotten.
    """
    report = _Report()
    spaces = {str(space.get("id")): space for space in config.get("spaces") or []}
    markers = config.get("markers") or []
    by_id = {str(marker.get("id")): marker for marker in markers}

    def incoming(marker: dict[str, Any]) -> bool:
        return marker_ids is None or str(marker.get("id")) in marker_ids

    # Existing target links participate in cycle detection but are never edited.
    graph = _ControlGraph(by_id, {
        str(marker.get("id")) for marker in markers if not incoming(marker)
    })

    def usable(target_id: str) -> bool:
        target = by_id.get(target_id)
        return bool(target and target.get("removed") is not True
                    and target.get("is_light") is True)

    for marker in markers:
        if not incoming(marker):
            continue
        marker_id = str(marker.get("id"))
        radar = marker.get("radar")
        if isinstance(radar, dict) and isinstance(radar.get("enabled"), bool) \
                and radar_spatial_problem(marker, spaces):
            radar["enabled"] = False
            report.add("radar", marker)
        vacuum = marker.get("vacuum")
        routes = vacuum.get("map_routes") if isinstance(vacuum, dict) else None
        if isinstance(routes, list) and any(
            isinstance(route, dict) and isinstance(route.get("space"), str)
            and route["space"] and route["space"] not in spaces for route in routes
        ):
            vacuum["live"] = False
            report.add("vacuum", marker)
        controls = marker.get("controls")
        if isinstance(controls, list):
            kept: list[Any] = []
            seen_targets: set[str] = set()
            edges: list[str] = []
            for ref in controls:
                if not isinstance(ref, str) or not ref.startswith("marker:"):
                    kept.append(ref)
                    continue
                target_id = ref[len("marker:"):]
                if target_id in seen_targets or not usable(target_id) \
                        or graph.cycles(marker_id, target_id):
                    report.add("controls", marker)
                    continue
                seen_targets.add(target_id)
                kept.append(ref)
                edges.append(target_id)
            graph.add(marker_id, edges)
            if kept != controls:
                marker["controls"] = kept or None
        badge = marker.get("value_badge")
        source = badge.get("source") if isinstance(badge, dict) else None
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            target = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else ""
            if not usable(target):
                badge["enabled"], badge["source"] = False, None
                report.add("value", marker)
        source = marker.get("value_source")
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            target = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else ""
            if not usable(target):
                marker.pop("value_source", None)
                report.add("value", marker)
    return report.result()


def prepare_portable_markers(
    config: dict[str, Any], previous: dict[str, Any] | None = None, *,
    marker_ids: set[str] | None = None, validate_all: bool = False,
) -> dict[str, Any]:
    """Shared export/import seam; only known dormant reference errors are exempt.

    Duplicate identities are checked before building a graph, so recovery never
    chooses one of two different devices that happen to have the same id.
    Ordinary Save/setup writers must not use this transfer-only function.
    """
    validate_active_marker_ids(config, previous, validate_all=validate_all)
    report = recover_portable_references(config, marker_ids=marker_ids)
    validate_marker_controls(config, previous, validate_all=validate_all)
    validate_marker_light_entities(config, previous, validate_all=validate_all)
    validate_marker_radars(config, previous, validate_all=validate_all,
                           allow_inactive_spatial_refs=True)
    validate_marker_value_badges(config, previous, validate_all=validate_all)
    validate_marker_vacuum_routes(config, previous, validate_all=validate_all,
                                 allow_inactive_missing_space=True)
    return report
