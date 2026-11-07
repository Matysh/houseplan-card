"""Pure geometry shared by radar setup, live projection and analysis (#485)."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable

UNIT_TO_CM = {"mm": 0.1, "cm": 1.0, "m": 100.0, "in": 2.54, "ft": 30.48}
MAX_LOCAL_CM = 10_000.0


@dataclass(frozen=True)
class RadarFit:
    heading_deg: float
    mirror: bool
    rms_cm: float
    errors_cm: tuple[float, float]


def length_cm(value: Any, unit: str) -> float:
    """Convert one finite length without guessing or clamping its unit."""
    number = float(value)
    if not math.isfinite(number) or unit not in UNIT_TO_CM:
        raise ValueError("invalid_radar")
    result = number * UNIT_TO_CM[unit]
    if abs(result) > MAX_LOCAL_CM:
        raise ValueError("invalid_radar")
    return result


def polar_to_cartesian(distance: Any, bearing: Any, *, unit: str,
                       angle_unit: str, zero: str, clockwise: bool) -> tuple[float, float]:
    distance_cm = length_cm(distance, unit)
    if distance_cm < 0:
        raise ValueError("invalid_radar")
    angle = float(bearing)
    if not math.isfinite(angle) or angle_unit not in {"degrees", "radians"}:
        raise ValueError("invalid_radar")
    angle = math.degrees(angle) if angle_unit == "radians" else angle
    if not clockwise:
        angle = -angle
    if zero == "right":
        angle += 90.0
    elif zero != "forward":
        raise ValueError("invalid_radar")
    radians = math.radians(angle)
    return distance_cm * math.sin(radians), distance_cm * math.cos(radians)


def project_local(mount: dict[str, Any], calibration: dict[str, Any],
                  x_cm: float, y_cm: float) -> tuple[float, float]:
    """Project canonical local centimetres into the square normalized plan."""
    x_cm = float(x_cm)
    y_cm = float(y_cm)
    if not all(map(math.isfinite, (x_cm, y_cm))) or math.hypot(x_cm, y_cm) > MAX_LOCAL_CM:
        raise ValueError("invalid_radar")
    mx, my = float(mount["x"]), float(mount["y"])
    theta = math.radians(float(mount["heading_deg"]))
    cell_cm = float(calibration["cell_cm"])
    if not all(map(math.isfinite, (mx, my, theta, cell_cm))) or cell_cm <= 0:
        raise ValueError("invalid_radar")
    mirror = -1.0 if calibration.get("mirror") else 1.0
    scale = 240.0 * cell_cm
    return (
        mx + (mirror * x_cm * math.cos(theta) + y_cm * math.sin(theta)) / scale,
        my + (mirror * x_cm * math.sin(theta) - y_cm * math.cos(theta)) / scale,
    )


def inverse_project(mount: dict[str, Any], calibration: dict[str, Any],
                    x: float, y: float) -> tuple[float, float]:
    theta = math.radians(float(mount["heading_deg"]))
    dx = (float(x) - float(mount["x"])) * 240.0 * float(calibration["cell_cm"])
    dy = (float(y) - float(mount["y"])) * 240.0 * float(calibration["cell_cm"])
    mirror = -1.0 if calibration.get("mirror") else 1.0
    return (
        mirror * (dx * math.cos(theta) + dy * math.sin(theta)),
        dx * math.sin(theta) - dy * math.cos(theta),
    )


def point_in_polygon(point: tuple[float, float], polygon: Iterable[Any],
                     tolerance: float = 1e-9) -> bool:
    """Boundary-inclusive even/odd test; no bounding-box fallback."""
    points = [(float(p[0] if isinstance(p, (list, tuple)) else p["x"]),
               float(p[1] if isinstance(p, (list, tuple)) else p["y"])) for p in polygon]
    if len(points) < 3:
        return True
    px, py = point
    inside = False
    for index, (ax, ay) in enumerate(points):
        bx, by = points[(index + 1) % len(points)]
        cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
        if abs(cross) <= tolerance and min(ax, bx) - tolerance <= px <= max(ax, bx) + tolerance \
                and min(ay, by) - tolerance <= py <= max(ay, by) + tolerance:
            return True
        if (ay > py) != (by > py):
            at_x = ax + (py - ay) * (bx - ax) / (by - ay)
            if px < at_x:
                inside = not inside
    return inside


def polygon_is_convex(polygon: Iterable[Any]) -> bool:
    """Whether a straight visual transition stays inside this room.

    A chord between valid points can leave a concave room. Smoothing is only
    cosmetic, so disabling it for such rooms is safer than drawing presence
    through a wall.
    """
    points = [(float(p[0] if isinstance(p, (list, tuple)) else p["x"]),
               float(p[1] if isinstance(p, (list, tuple)) else p["y"])) for p in polygon]
    if len(points) < 3:
        return False
    sign = 0
    for index, (ax, ay) in enumerate(points):
        bx, by = points[(index + 1) % len(points)]
        cx, cy = points[(index + 2) % len(points)]
        cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
        if abs(cross) <= 1e-12:
            continue
        current = 1 if cross > 0 else -1
        if sign and current != sign:
            return False
        sign = current
    return sign != 0


def clipped_arc_segments(
    center: tuple[float, float], radius: float, heading_deg: float,
    fov_deg: float | None, polygon: Iterable[Any] | None,
) -> list[list[tuple[float, float]]]:
    """Approximate a range arc and split it at a room boundary.

    Range input has no bearing, so the arc is the honest geometry.  Returning
    only contiguous inside runs prevents the browser from drawing the arc
    through walls or across a concave cut-out.  The resolution (<=4 degrees)
    is considerably finer than the two-CSS-pixel display stroke.
    """
    if not all(math.isfinite(value) for value in (*center, radius, heading_deg)) \
            or radius <= 0 or fov_deg is None or not math.isfinite(fov_deg) \
            or not 0 < fov_deg <= 360:
        return []
    points = list(polygon) if polygon is not None else None
    steps = max(8, min(180, math.ceil(fov_deg / 4)))
    start = heading_deg - 90 - fov_deg / 2
    samples = [
        (
            center[0] + math.cos(math.radians(start + fov_deg * index / steps)) * radius,
            center[1] + math.sin(math.radians(start + fov_deg * index / steps)) * radius,
        )
        for index in range(steps + 1)
    ]
    if points is None:
        return [samples]
    segments: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for sample in samples:
        if point_in_polygon(sample, points, 1e-6):
            current.append(sample)
        else:
            if len(current) >= 2:
                segments.append(current)
            current = []
    if len(current) >= 2:
        segments.append(current)
    return segments


def solve_two_point(mount: tuple[float, float], local_points: list[tuple[float, float]],
                    plan_points: list[tuple[float, float]], cell_cm: float) -> RadarFit:
    """Fit one rigid heading and mirror with the physical scale fixed."""
    if len(local_points) != 2 or len(plan_points) != 2 or cell_cm <= 0:
        raise ValueError("invalid_selection")
    scale = 240.0 * cell_cm
    targets = [((x - mount[0]) * scale, -(y - mount[1]) * scale) for x, y in plan_points]
    if any(math.hypot(*local) < 50 for local in local_points):
        raise ValueError("invalid_selection")
    denominator = math.hypot(*local_points[0]) * math.hypot(*local_points[1])
    angle = math.degrees(math.acos(max(-1.0, min(1.0,
        sum(a * b for a, b in zip(local_points[0], local_points[1], strict=True)) / denominator))))
    if angle < 20 or angle > 160:
        raise ValueError("invalid_selection")

    candidates: list[RadarFit] = []
    for mirrored in (False, True):
        transformed = [((-x if mirrored else x), y) for x, y in local_points]
        dot = sum(sx * tx + sy * ty for (sx, sy), (tx, ty) in zip(transformed, targets, strict=True))
        cross = sum(sx * ty - sy * tx for (sx, sy), (tx, ty) in zip(transformed, targets, strict=True))
        rotation = math.atan2(cross, dot)
        errors = []
        for (sx, sy), (tx, ty) in zip(transformed, targets, strict=True):
            rx = sx * math.cos(rotation) - sy * math.sin(rotation)
            ry = sx * math.sin(rotation) + sy * math.cos(rotation)
            errors.append(math.hypot(rx - tx, ry - ty))
        radial_ok = all(abs(math.hypot(*local) - math.hypot(*target)) <= max(20, .15 * math.hypot(*target))
                        for local, target in zip(local_points, targets, strict=True))
        rms = math.sqrt(sum(error * error for error in errors) / 2)
        if radial_ok and rms <= 20 and max(errors) <= 30:
            candidates.append(RadarFit(
                (-math.degrees(rotation)) % 360,
                mirrored,
                rms,
                (errors[0], errors[1]),
            ))
    if not candidates:
        raise ValueError("invalid_selection")
    candidates.sort(key=lambda fit: fit.rms_cm)
    if len(candidates) > 1 and abs(candidates[0].rms_cm - candidates[1].rms_cm) < 10:
        raise ValueError("ambiguous_sources")
    return candidates[0]
