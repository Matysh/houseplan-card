"""Imported openings that miss their host are repaired, not refused (#1033).

A plan exported by an older version, or edited by hand, may carry a door whose
host no longer holds it: the wall is gone or has no body, the door slid off
it, turned, outgrew it, or sits over another door. The schema rightly refuses
such a host. Refusing the whole file left the person with no plan at all, so
the import repairs only these openings and reports each one.

Pure: no Home Assistant. The repair runs on the raw document config before
``CONFIG_SCHEMA`` and asks the schema's own questions
(``wall_opening_host_fault`` / ``partition_opening_host_fault``) on the same
numbers the schema will judge. Wall hosts are judged after the shared
coordinate canonicaliser, partition hosts before it, exactly as the schema
does. Everything else in the file is left as it is; an opening or host the
repair cannot read is left for the schema to refuse.

1. Openings that pass every host check keep their host. Of two overlapping
   ones, the one earlier in the document keeps it.
2. Every other opening loses its host and then gets the same chance the next
   plan write would give it (#316 §3.3, #1033 overlap guard): a free in-place
   wall by the rule of that write. Its centre is put onto the wall, which is a
   shift of at most 1/50 of a grid step. Otherwise it stays without a host,
   drawn where it was, cutting no wall.

Documents older than the wall-segment model (< 8) only lose broken partition
hosts here: their initial migration places every unhosted opening itself, and
the import reports what it left unhosted.
"""
from __future__ import annotations

import math
from typing import Any

from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_lattice_coordinate,
    canonicalize_number,
)
from .validation import partition_opening_host_fault, wall_opening_host_fault
from .wall_segment_model import (
    WALL_SEGMENT_MODEL_VERSION,
    opening_frame,
    pick_wall_carrier,
    wall_carrier_eligible,
    wall_host_t,
    wall_interval_free,
)

MAX_REPAIR_EXAMPLES = 24
_UNREADABLE = (KeyError, TypeError, ValueError, IndexError, AttributeError)


def empty_repair_report() -> dict[str, Any]:
    return {"rehosted": 0, "detached": 0, "examples": []}


def _number(value: Any) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value))


def _host(opening: Any) -> dict[str, Any] | None:
    """A host record of the schema's exact shape, or None (left to the schema)."""
    if not isinstance(opening, dict):
        return None
    host = opening.get("host")
    if (not isinstance(host, dict) or set(host) != {"kind", "id", "t"}
            or host["kind"] not in ("wall", "partition")
            or not isinstance(host["id"], str) or not 1 <= len(host["id"]) <= 64
            or not _number(host["t"]) or not 0 <= host["t"] <= 1):
        return None
    if not all(_number(opening.get(key)) for key in ("x", "y", "angle", "length")):
        return None
    return host


def _intervals(openings: list[Any], carrier: dict[str, Any], skip: Any) -> list[tuple[float, float]]:
    """Every interval the schema will reserve on ``carrier`` besides ``skip``'s."""
    span = ((carrier["b"][0] - carrier["a"][0]) ** 2
            + (carrier["b"][1] - carrier["a"][1]) ** 2) ** 0.5
    taken = []
    for other in openings:
        host = other.get("host") if isinstance(other, dict) else None
        if other is skip or not isinstance(host, dict) or host.get("kind") != "wall" \
                or host.get("id") != carrier["id"]:
            continue
        along, half = float(host["t"]) * span, float(other["length"]) / 2
        taken.append((along - half, along + half))
    return taken


def _place_on_wall(
    view_space: dict[str, Any], view: dict[str, Any], segments: list[dict[str, Any]],
    model: int,
) -> dict[str, Any] | None:
    """The placement the next plan write would give an unhosted opening, checked.

    Model 10 writes heal only onto a unique free carrier; older models go
    through the initial migration, which picks among free carriers (#316 §3.2).
    The placement is canonicalised and judged by the schema predicate and by
    the carrier rule again, so that write keeps it as it is.
    """
    frame = opening_frame(view)
    if frame is None:
        return None
    centre, angle, half = frame
    eligible = [segment for segment in segments
                if wall_carrier_eligible(segment, centre, angle, half)]
    free = [segment for segment in eligible
            if wall_interval_free(view_space, view, segment, centre, half)]
    if model >= WALL_SEGMENT_MODEL_VERSION:
        carrier = eligible[0] if len(eligible) == 1 and free else None
    else:
        carrier = pick_wall_carrier(free, None, centre)
    if carrier is None:
        return None
    t = wall_host_t(carrier, centre)
    placed = {
        **view,
        "x": canonicalize_lattice_coordinate(
            float(carrier["a"][0]) + (float(carrier["b"][0]) - float(carrier["a"][0])) * t),
        "y": canonicalize_lattice_coordinate(
            float(carrier["a"][1]) + (float(carrier["b"][1]) - float(carrier["a"][1])) * t),
        "host": {"kind": "wall", "id": carrier["id"], "t": canonicalize_number(t)},
    }
    if wall_opening_host_fault(placed, carrier, _intervals(view_space["openings"], carrier, view)):
        return None
    if not wall_carrier_eligible(carrier, [placed["x"], placed["y"]], angle, half):
        return None
    return placed


def _example(space: dict[str, Any], opening: dict[str, Any], result: str) -> dict[str, str]:
    return {
        "space_id": str(space.get("id", ""))[:64],
        "space_title": str(space.get("title") or space.get("id") or "")[:160],
        "opening_id": str(opening.get("id", ""))[:64],
        "type": str(opening.get("type", ""))[:16],
        "result": result,
    }


def _repair_space(
    space: dict[str, Any], view_space: dict[str, Any], model: int, report: dict[str, Any],
) -> None:
    openings, views = space["openings"], view_space["openings"]
    partitions = {
        item["id"]: item for item in space.get("partitions") or []
        if isinstance(item, dict) and item.get("id")
    } if isinstance(space.get("partitions"), list) else {}
    raw_segments = view_space.get("wall_segments") if model >= 8 else None
    segments = [item for item in raw_segments if isinstance(item, dict)] \
        if isinstance(raw_segments, list) else []
    by_id = {item.get("id"): item for item in segments}
    wall_taken: dict[str, list[tuple[float, float]]] = {}
    partition_taken: dict[str, list[tuple[float, float]]] = {}
    broken: list[int] = []
    # 1. What the schema accepts, in document order: the first of two
    #    overlapping openings keeps its host.
    for index, (opening, view) in enumerate(zip(openings, views, strict=True)):
        host = _host(opening)
        if host is None or _host(view) is None:
            continue
        try:
            if host["kind"] == "partition":
                partition = partitions.get(host["id"])
                if model >= 8 and partition is not None and float(partition["cm"]) <= 0:
                    fault: str | None = "opening host must have positive thickness"
                else:
                    fault = partition_opening_host_fault(
                        opening, partition, partition_taken.setdefault(host["id"], []))
            elif model >= 8:
                fault = wall_opening_host_fault(
                    view, by_id.get(host["id"]), wall_taken.setdefault(host["id"], []))
            else:
                # Before the wall-segment model a wall host is the migration's
                # business; it re-hosts or unhosts and never refuses (#316).
                fault = None
        except _UNREADABLE:
            continue
        if fault:
            broken.append(index)
    for index in broken:
        openings[index].pop("host", None)
        views[index].pop("host", None)
    if model < 8:
        # The initial migration places every unhosted opening of an old model
        # itself; the import counts what it leaves unhosted afterwards.
        return
    # 2. The rest, in document order, get the next write's own placement.
    for index in broken:
        opening, view = openings[index], views[index]
        placed = None
        if segments:
            try:
                placed = _place_on_wall(view_space, view, segments, model)
            except _UNREADABLE:
                placed = None
        if placed is not None:
            for key in ("x", "y", "host"):
                opening[key] = placed[key]
                view[key] = placed[key] if key != "host" else dict(placed[key])
            result = "rehosted"
        else:
            result = "detached"
        report[result] += 1
        if len(report["examples"]) < MAX_REPAIR_EXAMPLES:
            report["examples"].append(_example(space, opening, result))


def repair_imported_openings(config: Any, model: int) -> dict[str, Any]:
    """Repair, in place, the openings of a raw imported config; return the report.

    ``model`` is the document's data model. Nothing is read from or trusted in
    the file's own transfer metadata.
    """
    report = empty_repair_report()
    if not isinstance(config, dict) or not isinstance(config.get("spaces"), list):
        return report
    view = canonicalize_config_geometry(config)
    for space, view_space in zip(config["spaces"], view["spaces"], strict=True):
        if (isinstance(space, dict) and isinstance(space.get("openings"), list)
                and isinstance(view_space, dict)
                and len(space["openings"]) == len(view_space.get("openings") or [])):
            _repair_space(space, view_space, model, report)
    return report


def merge_repair_reports(*reports: dict[str, Any] | None) -> dict[str, Any]:
    """Sum server-made reports (a ZIP is parsed twice: archive, then preview)."""
    merged = empty_repair_report()
    for report in reports:
        if not report:
            continue
        merged["rehosted"] += int(report.get("rehosted", 0))
        merged["detached"] += int(report.get("detached", 0))
        merged["examples"].extend(report.get("examples") or [])
    merged["examples"] = merged["examples"][:MAX_REPAIR_EXAMPLES]
    return merged
