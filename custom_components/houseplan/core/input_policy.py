"""Explicit request bounds for callers of the canonical core, not Store policy.

HA keeps its established byte limits and no new geometry/depth ceiling. A
future untrusted caller must enter one STRICT_INPUT_POLICY scope around the
whole request, not start a fresh budget for every wall, floor or nested helper.
This cooperative bound is not worker isolation or an HTTP rate limiter.
"""
from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from time import monotonic


@dataclass(frozen=True, slots=True)
class InputPolicy:
    strict: bool = False
    archive_bytes: int = 2 * 1024**3
    expanded_bytes: int = 2 * 1024**3
    json_depth: int | None = None
    json_nodes: int | None = None
    xml_depth: int | None = None
    geometry_units: int | None = None
    seconds: float | None = None

    def __post_init__(self) -> None:
        if type(self.strict) is not bool:
            raise ValueError("Invalid input policy")
        ceilings = {
            "archive_bytes": 256 * 1024**2 if self.strict else 2 * 1024**3,
            "expanded_bytes": 512 * 1024**2 if self.strict else 2 * 1024**3,
            "json_depth": 64, "json_nodes": 1_000_000, "xml_depth": 64,
            "geometry_units": 2_000_000,
        }
        for name, maximum in ceilings.items():
            value = getattr(self, name)
            if value is None and name not in ("archive_bytes", "expanded_bytes") and not self.strict:
                continue
            if type(value) is not int or not 0 < value <= maximum:
                raise ValueError(f"Invalid input policy {name}")
        if self.seconds is None and not self.strict:
            return
        seconds = self.seconds
        if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not 0 < seconds <= 5:
            raise ValueError("Invalid input policy seconds")


HA_INPUT_POLICY = InputPolicy()
STRICT_INPUT_POLICY = InputPolicy(
    strict=True, archive_bytes=256 * 1024**2, expanded_bytes=512 * 1024**2,
    json_depth=64, json_nodes=1_000_000, xml_depth=64,
    geometry_units=2_000_000, seconds=5,
)


class InputLimit(Exception):
    """Safe capacity/cancellation error: never includes input or server paths."""

    def __init__(self, reason: str, *, code: str = "capacity_exceeded") -> None:
        self.code = code
        self.reason = reason
        super().__init__("The input exceeds this processing profile's capacity")


@dataclass(slots=True)
class InputBudget:
    policy: InputPolicy
    clock: Callable[[], float]
    cancel: Callable[[], bool] | None = None
    used: int = 0
    started: float = 0
    next_check: int = 1

    def checkpoint(self) -> None:
        if self.cancel is not None and self.cancel():
            raise InputLimit("cancelled", code="zip_cancelled")
        if self.policy.seconds is not None and self.clock() - self.started > self.policy.seconds:
            raise InputLimit("time")

    def charge(self, units: int = 1) -> None:
        if type(units) is not int or units < 1:
            raise ValueError("Work units must be positive integers")
        maximum = self.policy.geometry_units
        if maximum is not None and units > maximum - self.used:
            raise InputLimit("geometry_work")
        # Charge BEFORE the predicate/inner-loop operation, including a rejection.
        self.used += units
        if self.used >= self.next_check:
            self.checkpoint()
            self.next_check = self.used + 256


_request: ContextVar[InputBudget | None] = ContextVar("houseplan_input_budget", default=None)


def current_policy() -> InputPolicy:
    budget = _request.get()
    return budget.policy if budget is not None else HA_INPUT_POLICY


@contextmanager
def input_scope(
    policy: InputPolicy | None = None, *, clock: Callable[[], float] = monotonic,
    cancel: Callable[[], bool] | None = None,
) -> Iterator[InputBudget]:
    """One explicit request owner; nested calls inherit, never reset a budget.

    A different nested policy is rejected rather than silently loosening or
    replacing the current request. Select the desired policy at the outer edge.
    """
    active = _request.get()
    if active is not None:
        if policy is not None and policy != active.policy:
            raise ValueError("Cannot replace an active input policy")
        active.checkpoint()
        yield active
        return
    budget = InputBudget(policy or HA_INPUT_POLICY, clock, cancel)
    budget.started = clock()
    token = _request.set(budget)
    try:
        budget.checkpoint()
        yield budget
        budget.checkpoint()
    finally:
        _request.reset(token)


def charge_work(units: int = 1) -> None:
    budget = _request.get()
    if budget is not None:
        budget.charge(units)


def checkpoint() -> None:
    budget = _request.get()
    if budget is not None:
        budget.checkpoint()


def finite_json_float(value: str) -> float:
    """JSON exponents may overflow float without invoking parse_constant."""
    from math import isfinite

    number = float(value)
    if not isfinite(number):
        raise ValueError("Non-finite JSON number")
    return number


def check_json_bounds(raw: bytes, limit: int) -> None:
    """Linear bytes preflight only; the existing JSON decoder owns grammar.

    Every scalar/container and quoted object key is a node. Brackets and token
    characters inside strings, including escaped quotes/backslashes, are inert.
    No decoded string or nested Python tree is allocated by this scan.
    """
    if len(raw) > limit:
        raise InputLimit("json_bytes", code="too_large")
    policy = current_policy()
    if policy.json_depth is None and policy.json_nodes is None:
        return
    depth = nodes = 0
    quoted = escaped = primitive = False
    start = 3 if raw.startswith(b"\xef\xbb\xbf") else 0
    for index in range(start, len(raw)):
        if index & 65535 == 0:
            checkpoint()
        char = raw[index]
        # UTF16/32 autodetection is not an ASCII-byte grammar. Every encoding
        # of JSON syntax in those forms contains NUL. UTF8 JSON permits only
        # escaped U+0000, not this raw byte. Reject before tree allocation.
        # HA without structural bounds retains its historical decoder path.
        if char == 0:
            raise InputLimit("json_encoding", code="invalid_json")
        if quoted:
            if escaped:
                escaped = False
            elif char == 92:
                escaped = True
            elif char == 34:
                quoted = False
            continue
        if char == 34:
            quoted = True
            primitive = False
            nodes += 1
        elif char in (123, 91):
            depth += 1
            nodes += 1
            primitive = False
            if policy.json_depth is not None and depth > policy.json_depth:
                raise InputLimit("json_depth")
        elif char in (125, 93):
            depth -= 1
            primitive = False
        elif char in (32, 9, 10, 13, 44, 58):
            primitive = False
        elif not primitive:
            primitive = True
            nodes += 1
        if policy.json_nodes is not None and nodes > policy.json_nodes:
            raise InputLimit("json_nodes")
    checkpoint()
