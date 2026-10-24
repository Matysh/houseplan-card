"""Stdlib-only LED inventory shared by validation and support projection."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any


def iter_led_strips(
    config: dict[str, Any],
) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    for space in config.get("spaces") or []:
        if not isinstance(space, dict):
            continue
        for strip in space.get("led_strips") or []:
            if isinstance(strip, dict):
                yield space, strip


def led_strip_counts(config: dict[str, Any]) -> dict[str, int]:
    """Support-package counters: no coordinates, names or HA identifiers."""
    total = unbound = hidden = 0
    for _space, strip in iter_led_strips(config):
        total += 1
        if not isinstance(strip.get("marker"), str):
            unbound += 1
        elif strip.get("active") is False:
            hidden += 1
    return {
        "led_strips": total,
        "led_strips_unbound": unbound,
        "led_strips_hidden": hidden,
    }
