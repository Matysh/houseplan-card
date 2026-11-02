"""Exact structural coordinates for model11; never a rendering rounder.

The wire and decimal ingestion are mirrored by src/plan-exact.ts. Fractions
are reduced before resource checks. Converting a Fraction to float uses
Python's correctly rounded binary64 conversion, not division of two floats.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

MAX_BITS = 4096
CANVAS_LIMIT = 5000
GRID_N = 240
_INTEGER = re.compile(r"(?:0|-[1-9][0-9]*|[1-9][0-9]*)\Z")
_DECIMAL = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\Z")


class GraphError(ValueError):
    """Bounded domain error; callers do not put source coordinates in logs."""

    def __init__(self, reason: str, *, code: str = "invalid_plan_graph") -> None:
        self.code = code
        self.reason = reason
        super().__init__(reason)


def checked(value: Fraction) -> Fraction:
    if abs(value.numerator).bit_length() > MAX_BITS or value.denominator.bit_length() > MAX_BITS:
        raise GraphError("exact_number_limit", code="plan_graph_resource_limit")
    return value


def integer(value: Any) -> int:
    # Avoid passing an attacker-controlled million-digit string to int().
    if not isinstance(value, str) or len(value) > 1235 or not _INTEGER.fullmatch(value):
        raise GraphError("invalid_integer")
    result = int(value)
    if abs(result).bit_length() > MAX_BITS:
        raise GraphError("exact_number_limit", code="plan_graph_resource_limit")
    return result


def decode_rational(value: Any) -> Fraction:
    if not isinstance(value, list) or len(value) != 2:
        raise GraphError("invalid_rational")
    n, d = integer(value[0]), integer(value[1])
    if d <= 0 or math.gcd(n, d) != 1:
        raise GraphError("noncanonical_rational")
    return checked(Fraction(n, d))


def encode_rational(value: Fraction) -> list[str]:
    checked(value)
    return [str(value.numerator), str(value.denominator)]


def parse_decimal(value: Any) -> Fraction:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise GraphError("invalid_decimal")
    if isinstance(value, float):
        if not math.isfinite(value):
            raise GraphError("nonfinite_coordinate")
        value = repr(value)
    else:
        value = str(value)
    if len(value) > 1300 or not _DECIMAL.fullmatch(value):
        raise GraphError("invalid_decimal")
    # Bound exponents before Fraction allocates arbitrary powers of ten.
    exponent = re.search(r"[eE]([+-]?[0-9]+)$", value)
    if exponent and (len(exponent[1].lstrip("+-")) > 4 or abs(int(exponent[1])) > 1233):
        raise GraphError("exact_number_limit", code="plan_graph_resource_limit")
    return checked(Fraction(value))


@dataclass(frozen=True, slots=True)
class ExactPoint:
    x: Fraction
    y: Fraction


def check_point(point: ExactPoint) -> ExactPoint:
    checked(point.x)
    checked(point.y)
    if abs(point.x) > CANVAS_LIMIT or abs(point.y) > CANVAS_LIMIT:
        raise GraphError("coordinate_range")
    return point


def read_source_point(x: Any, y: Any = None) -> ExactPoint:
    if y is None and isinstance(x, (list, tuple)) and len(x) == 2:
        x, y = x
    return check_point(ExactPoint(parse_decimal(x), parse_decimal(y)))


def encode_point(point: ExactPoint) -> list[str]:
    check_point(point)
    ix, iy = point.x * GRID_N, point.y * GRID_N
    if ix.denominator == iy.denominator == 1:
        return ["l", str(ix.numerator), str(iy.numerator)]
    return ["q", *encode_rational(point.x), *encode_rational(point.y)]


def decode_point(value: Any) -> ExactPoint:
    if not isinstance(value, list) or not value:
        raise GraphError("invalid_point")
    if value[0] == "l" and len(value) == 3:
        point = ExactPoint(Fraction(integer(value[1]), GRID_N), Fraction(integer(value[2]), GRID_N))
    elif value[0] == "q" and len(value) == 5:
        point = ExactPoint(decode_rational(value[1:3]), decode_rational(value[3:5]))
    else:
        raise GraphError("invalid_point")
    check_point(point)
    if encode_point(point) != value:
        raise GraphError("noncanonical_point")
    return point


def to_numbers(point: ExactPoint) -> list[float]:
    check_point(point)
    return [float(point.x), float(point.y)]


def cross(a: ExactPoint, b: ExactPoint, c: ExactPoint) -> Fraction:
    return checked((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))


def squared_distance(a: ExactPoint, b: ExactPoint) -> Fraction:
    return checked((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def point_at(a: ExactPoint, b: ExactPoint, t: Fraction) -> ExactPoint:
    checked(t)
    return check_point(ExactPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))


def project_parameter(p: ExactPoint, a: ExactPoint, b: ExactPoint) -> Fraction:
    dx, dy = b.x - a.x, b.y - a.y
    length = dx * dx + dy * dy
    if not length:
        raise GraphError("zero_length_edge")
    return checked(((p.x - a.x) * dx + (p.y - a.y) * dy) / length)


def intersection(a: ExactPoint, b: ExactPoint, c: ExactPoint, d: ExactPoint) -> tuple[ExactPoint, Fraction, Fraction] | None:
    dx, dy, ex, ey = b.x - a.x, b.y - a.y, d.x - c.x, d.y - c.y
    determinant = dx * ey - dy * ex
    if not determinant:
        return None
    t = checked(((c.x - a.x) * ey - (c.y - a.y) * ex) / determinant)
    u = checked(((c.x - a.x) * dy - (c.y - a.y) * dx) / determinant)
    return point_at(a, b, t), t, u


def normalization_radius(cell_cm: Any) -> Fraction:
    cell = parse_decimal(cell_cm)
    if not Fraction(1, 10) <= cell <= 1000:
        raise GraphError("cell_scale_range")
    return min(Fraction(1, 1200000), Fraction(1, 10) / (GRID_N * cell))
