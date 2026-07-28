"""One-time migration to a square canvas — pure, so it can be tested alone.

Until v1.48.0 a space had an `aspect`, and coordinates were normalised against
it: x by the width, y by the HEIGHT. Making every canvas square without touching
the numbers would stretch every plan vertically.

Nothing about the drawing changes here. The canvas is padded to a square —
top and bottom for a wide plan, left and right for a tall one — and the
coordinates are re-expressed against that larger box. In render units it is a
uniform scale plus an offset, so angles, room proportions and relative positions
survive exactly. `cell_cm` follows, because the grid is tied to the width: for a
tall plan the width grew, so the same wall would otherwise measure less.
"""
from __future__ import annotations

import logging
from typing import Any

_LOGGER = logging.getLogger(__name__)


def transform_for(aspect: float) -> tuple[float, float, float, float]:
    """(dx, dy, kx, ky) that map old normalised coordinates onto the square.

    x' = dx + x * kx, y' = dy + y * ky. Lengths along an axis scale by that
    axis's factor; both are the same uniform scale in RENDER units, which is
    why angles are preserved.
    """
    a = float(aspect)
    if not a or a <= 0:
        a = 1.0
    k = min(1.0, a)          # how much the old box shrinks inside the square
    kx = k                   # x was normalised by the width
    ky = k / a               # y was normalised by the height (= width / aspect)
    return (1.0 - kx) / 2, (1.0 - ky) / 2, kx, ky


def _pt(p: Any, dx: float, dy: float, kx: float, ky: float) -> Any:
    if isinstance(p, (list, tuple)) and len(p) >= 2:
        return [dx + float(p[0]) * kx, dy + float(p[1]) * ky]
    return p


def migrate_space(space: dict[str, Any]) -> bool:
    """Rewrite one space in place. Returns True when anything was changed."""
    if "aspect" not in space:
        return False
    try:
        aspect = float(space.get("aspect") or 1)
    except (TypeError, ValueError):
        aspect = 1.0
    dx, dy, kx, ky = transform_for(aspect)
    space.pop("aspect", None)

    for room in space.get("rooms") or []:
        if room.get("x") is not None:
            room["x"] = dx + float(room["x"]) * kx
        if room.get("y") is not None:
            room["y"] = dy + float(room["y"]) * ky
        if room.get("w") is not None:
            room["w"] = float(room["w"]) * kx
        if room.get("h") is not None:
            room["h"] = float(room["h"]) * ky
        if room.get("poly"):
            room["poly"] = [_pt(p, dx, dy, kx, ky) for p in room["poly"]]

    for op in space.get("openings") or []:
        op["x"] = dx + float(op.get("x", 0)) * kx
        op["y"] = dy + float(op.get("y", 0)) * ky
        # a length is measured along the wall, and the render scale is uniform
        if op.get("length") is not None:
            op["length"] = float(op["length"]) * kx

    for shape in space.get("decor") or []:
        for a, b, fx, fy in (("x1", "y1", kx, ky), ("x2", "y2", kx, ky), ("x", "y", kx, ky)):
            if shape.get(a) is not None:
                shape[a] = dx + float(shape[a]) * fx
            if shape.get(b) is not None:
                shape[b] = dy + float(shape[b]) * fy
        if shape.get("w") is not None:
            shape["w"] = float(shape["w"]) * kx
        if shape.get("h") is not None:
            shape["h"] = float(shape["h"]) * ky

    vb = space.get("view_box")
    if isinstance(vb, list) and len(vb) == 4:
        space["view_box"] = [
            dx + float(vb[0]) * kx, dy + float(vb[1]) * ky,
            float(vb[2]) * kx, float(vb[3]) * ky,
        ]

    # The grid pitch is a fraction of the WIDTH. A tall plan just got a wider
    # canvas, so a wall now covers fewer cells; without this every measurement
    # in the plan would silently shrink.
    if kx != 1:
        try:
            cell = float(space.get("cell_cm") or 5)
        except (TypeError, ValueError):
            cell = 5.0
        space["cell_cm"] = round(cell / kx, 4)

    # The image keeps its own proportions and is centred; the space no longer
    # has any of its own.
    if space.get("plan_url") and not space.get("plan_aspect"):
        space["plan_aspect"] = round(aspect, 6)
    return True


def migrate_config(config: dict[str, Any], layout: dict[str, Any] | None = None) -> bool:
    """Migrate every space, and the marker positions that belong to them."""
    spaces = config.get("spaces") or []
    factors = {}
    for space in spaces:
        if "aspect" in space:
            factors[str(space.get("id"))] = transform_for(space.get("aspect") or 1)
    if not factors:
        return False

    for space in spaces:
        migrate_space(space)

    for pos in (layout or {}).values():
        if not isinstance(pos, dict):
            continue
        f = factors.get(str(pos.get("s")))
        if not f:
            continue
        dx, dy, kx, ky = f
        if pos.get("x") is not None:
            pos["x"] = dx + float(pos["x"]) * kx
        if pos.get("y") is not None:
            pos["y"] = dy + float(pos["y"]) * ky
    return True
