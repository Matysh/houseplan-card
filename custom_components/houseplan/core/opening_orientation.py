"""Physical opening basis transfer, mirrored by src/opening-orientation.ts."""
from __future__ import annotations

import math as math

from .opening_features_model import (
    reparameterize_opening_features as reparameterize_opening_features,
)


def opening_axis_rotation(a, b, next_a, next_b):
    ux, uy = b[0] - a[0], b[1] - a[1]
    vx, vy = next_b[0] - next_a[0], next_b[1] - next_a[1]
    return math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180 / math.pi


def _inside(point, poly):
    inside = False
    previous = poly[-1]
    for current in poly:
        if ((current[1] > point[1]) != (previous[1] > point[1])
                and point[0] < (previous[0] - current[0]) * (point[1] - current[1])
                / (previous[1] - current[1]) + current[0]):
            inside = not inside
        previous = current
    return inside


def opening_face_normal(space, opening, flip_v=None):
    """Direction-only mirror of the existing room/partition face resolvers.

    The room resolver admits positive overlapping boundary intervals, not just
    a centre probe. Depth is irrelevant to choosing the same physical face.
    Tolerances/probes are the renderer's 1000-unit policy converted to storage.
    """
    from .wall_segment_model import _room_poly

    flip = bool(opening.get("flip_v")) if flip_v is None else flip_v
    face_flip = not flip if opening.get("type") == "gate" else flip
    host = opening.get("host") or {}
    if host.get("kind") == "partition":
        carrier = next((item for item in space.get("partitions", []) if item["id"] == host["id"]), None)
        if carrier:
            dx, dy = carrier["b"][0] - carrier["a"][0], carrier["b"][1] - carrier["a"][1]
            length = math.hypot(dx, dy)
            side = 1 if face_flip else -1
            if length:
                return [-dy / length * side, dx / length * side]
    angle = math.radians(opening["angle"])
    ux, uy = math.cos(angle), math.sin(angle)
    nx, ny = -uy, ux
    half = opening["length"] / 2
    available = set()
    for room in space.get("rooms", []):
        poly = _room_poly(room)
        for i, a in enumerate(poly):
            b = poly[(i + 1) % len(poly)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dy)
            if not length:
                continue
            ex, ey = dx / length, dy / length
            diff = abs(math.atan2(dy, dx) - angle) % math.pi
            if min(diff, math.pi - diff) > math.radians(8):
                continue
            if abs((opening["x"] - a[0]) * ey - (opening["y"] - a[1]) * ex) > 1 / 6000:
                continue
            ta = (a[0] - opening["x"]) * ux + (a[1] - opening["y"]) * uy
            tb = (b[0] - opening["x"]) * ux + (b[1] - opening["y"]) * uy
            if min(half, max(ta, tb)) - max(-half, min(ta, tb)) <= 1 / 6000:
                continue
            ix, iy = -ey, ex
            probe = [(a[0] + b[0]) / 2 + ix * 1e-6, (a[1] + b[1]) / 2 + iy * 1e-6]
            if not _inside(probe, poly):
                ix, iy = -ix, -iy
            available.add(1 if ix * nx + iy * ny >= 0 else -1)
    natural = next(iter(available)) if len(available) == 1 else -1
    side = -natural if face_flip else natural
    return [nx * side, ny * side]


def transport_opening_orientations(before, after, rotations=None):
    rotations = rotations or {}
    # Repair also accepts damaged legacy documents. Leave malformed records to
    # that caller's validation/report rather than raising in this adapter.
    def records(space):
        values = space.get("openings")
        if not isinstance(values, list):
            return []
        return [opening for opening in values if isinstance(opening, dict)
                and isinstance(opening.get("id"), str)
                and all(type(opening.get(key)) in (int, float)
                        and math.isfinite(opening[key]) for key in ("x", "y", "angle", "length"))]

    old = {opening["id"]: opening for opening in records(before)}
    for opening in records(after):
        source = old.get(opening["id"])
        if (not source or not isinstance(source.get("opening_features"), dict)
                or type(source["opening_features"].get("version")) is not int
                or source["opening_features"]["version"] != 1 or source.get("type") != opening.get("type")):
            continue
        if source.get("type") == "window" and not isinstance(source["opening_features"].get("leaves"), list):
            continue
        delta = rotations.get(opening["id"])
        if delta is None:
            delta = opening["angle"] - source["angle"]
            delta -= 180 * math.floor((delta + 90) / 180)
        expected = source["angle"] + delta
        intended = opening["angle"] + 180 * math.floor((expected - opening["angle"]) / 180 + .5)
        transformed = reparameterize_opening_features(source, intended)
        opening["angle"] = transformed["angle"]
        opening["opening_features"] = transformed["opening_features"]
        if source["type"] not in ("door", "gate") or source["opening_features"].get("mechanism") != "slide":
            continue
        previous = opening_face_normal(before, source)
        radians = math.radians(delta)
        desired = [previous[0] * math.cos(radians) - previous[1] * math.sin(radians),
                   previous[0] * math.sin(radians) + previous[1] * math.cos(radians)]
        negative, positive = opening_face_normal(after, opening, False), opening_face_normal(after, opening, True)
        positive_dot = positive[0] * desired[0] + positive[1] * desired[1]
        negative_dot = negative[0] * desired[0] + negative[1] * desired[1]
        if positive_dot > negative_dot:
            opening["flip_v"] = True
        else:
            opening.pop("flip_v", None)
    return after
