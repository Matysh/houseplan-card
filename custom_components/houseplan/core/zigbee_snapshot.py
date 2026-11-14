"""Portable Zigbee snapshot validation; no MQTT or HA runtime."""
from __future__ import annotations

import json as json
import math as math
import re as re
from typing import Any as Any

MAX_TOPICS = 8
MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
MAX_NODES = 1000
MAX_LINKS = 6000
MAX_CACHE_BYTES = MAX_TOPICS * (MAX_PAYLOAD_BYTES + 1024) + 4096


class ZigbeeScanError(Exception):
    """A stable, already localized WebSocket command refusal."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_base_topic(value: object) -> str:
    """Match the frontend's exact-topic normalization, without a saved-topic gate."""
    if not isinstance(value, str):
        raise ZigbeeScanError("invalid_data")
    topic = re.sub(r"/{2,}", "/", value.strip().strip("/"))
    # JS counts UTF-16 code units; reject lone surrogates as invalid MQTT UTF-8.
    try:
        length = len(topic.encode("utf-16-le")) // 2
        topic.encode("utf-8")
    except UnicodeError as err:
        raise ZigbeeScanError("invalid_data") from err
    if not topic or length > 180 or re.search(r"[#+\x00-\x1f\x7f]", topic):
        raise ZigbeeScanError("invalid_data")
    return topic


def _parse_payload(payload: object) -> dict[str, Any] | None:
    """Bound bytes before decoding; uncorrelatable garbage must not end a job."""
    try:
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        if not isinstance(payload, bytes) or len(payload) > MAX_PAYLOAD_BYTES:
            return None
        value = json.loads(payload)
        if not isinstance(value, dict):
            return None
        pending = [(value, 0)]
        inspected = 0
        while pending:
            item, depth = pending.pop()
            inspected += 1
            if depth > 32 or inspected > 100_000:
                return None
            if isinstance(item, dict):
                pending.extend((child, depth + 1) for child in item.values())
            elif isinstance(item, list):
                pending.extend((child, depth + 1) for child in item)
            elif isinstance(item, float) and not math.isfinite(item):
                return None
        return value
    except (ValueError, UnicodeError, RecursionError):
        return None


def _valid_map(message: dict[str, Any]) -> bool:
    """Check the raw-map shape, not routing evidence (that remains TypeScript)."""
    data = message.get("data")
    value = data.get("value", data) if isinstance(data, dict) else data
    if value is None:
        value = message.get("value", message)
    if isinstance(value, str):
        value = _parse_payload(value)
    if not isinstance(value, dict):
        return False
    nodes, links = value.get("nodes"), value.get("links")
    if not isinstance(nodes, list) or len(nodes) > MAX_NODES:
        return False
    if not isinstance(links, list) or len(links) > MAX_LINKS:
        return False
    for node in nodes:
        if not isinstance(node, dict):
            return False
        ieee = node.get("ieeeAddr", node.get("ieee_address", node.get("ieee")))
        if not isinstance(ieee, str) or not re.fullmatch(
            r"(?:0x)?[0-9a-fA-F]{16}|(?:[0-9a-fA-F]{2}[:-]){7}[0-9a-fA-F]{2}", ieee,
        ):
            return False
    routes_count = 0
    for link in links:
        if not isinstance(link, dict):
            return False
        for side in ("source", "target"):
            endpoint = link.get(f"{side}IeeeAddr", link.get(side))
            if isinstance(endpoint, bool) or not isinstance(endpoint, (dict, str, int)):
                return False
            if not endpoint and endpoint != 0:
                return False
        routes = link.get("routes", [])
        if not isinstance(routes, list) or any(not isinstance(route, dict) for route in routes):
            return False
        routes_count += len(routes)
        if routes_count > MAX_LINKS:
            return False
    return True


def _raw_map(message: dict[str, Any]) -> dict[str, Any]:
    """Persist the provider map, never its transaction/request envelope."""
    data = message.get("data")
    value = data.get("value", data) if isinstance(data, dict) else data
    if value is None:
        value = message.get("value", message)
    if isinstance(value, str):
        value = json.loads(value)
    return {key: item for key, item in value.items() if key != "transaction"}


def validate_saved_topics(value: object) -> dict[str, dict[str, Any]]:
    """Validate a portable snapshot without trusting source entry/job metadata."""
    if not isinstance(value, dict) or len(value) > MAX_TOPICS:
        raise ValueError("invalid snapshot")
    encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    if len(encoded) > MAX_CACHE_BYTES:
        raise ValueError("oversized snapshot")
    out = {}
    for topic, item in value.items():
        try:
            normalized = normalize_base_topic(topic)
        except ZigbeeScanError as err:
            raise ValueError("invalid snapshot") from err
        if (normalized != topic or not isinstance(item, dict)
                or set(item) != {"map", "obtained_at"}
                or type(item.get("obtained_at")) is not int or item["obtained_at"] < 0):
            raise ValueError("invalid snapshot")
        raw = json.dumps(item["map"], ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
        parsed = _parse_payload(raw)
        if parsed is None or not _valid_map(parsed) or "transaction" in parsed:
            raise ValueError("invalid snapshot")
        out[topic] = {"obtained_at": item["obtained_at"], "map": parsed}
    return out

