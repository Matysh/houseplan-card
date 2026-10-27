"""Structural #1000 rules. Neither validation nor reads grant HA authority."""
from __future__ import annotations

import math
import re

MAX_MARKER_ALERTS = 3
ALERT_TEXT_LIMIT = 255
_ID = re.compile(r"[a-zA-Z0-9_-]{1,64}")
_ENTITY = re.compile(r"[a-z0-9_]+\.[a-z0-9_]+")
_OPERATORS = frozenset({"eq", "ne", "gt", "lt", "ge", "le"})
_KEYS = frozenset({"id", "type", "level", "entity_id", "attribute", "operator", "value"})
_REQUIRED = _KEYS - {"attribute"}


def _text(value: object) -> bool:
    return (isinstance(value, str) and 1 <= len(value) <= ALERT_TEXT_LIMIT
            and "\r" not in value and "\n" not in value)


def valid_marker_alert(raw: object) -> bool:
    """Closed JSON shape for a newly written rule, preserving exact operands."""
    if not isinstance(raw, dict) or not _REQUIRED <= raw.keys() <= _KEYS:
        return False
    if (not isinstance(raw["id"], str) or not _ID.fullmatch(raw["id"])
            or raw["type"] != "threshold" or raw["level"] not in ("attention", "alarm")
            or not isinstance(raw["entity_id"], str) or len(raw["entity_id"]) > ALERT_TEXT_LIMIT
            or not _ENTITY.fullmatch(raw["entity_id"])
            or not isinstance(raw["operator"], str) or raw["operator"] not in _OPERATORS):
        return False
    if "attribute" in raw and (not _text(raw["attribute"]) or not raw["attribute"].strip()):
        return False
    value = raw["value"]
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        try:
            return math.isfinite(value)
        except OverflowError:
            return False
    return _text(value) and raw["operator"] in ("eq", "ne")


def valid_marker_alerts(raw: object) -> bool:
    """At most three unique local rule IDs; an empty optional block can be removed."""
    if not isinstance(raw, list) or len(raw) > MAX_MARKER_ALERTS:
        return False
    ids: set[str] = set()
    for item in raw:
        if not valid_marker_alert(item) or item["id"] in ids:
            return False
        ids.add(item["id"])
    return True
