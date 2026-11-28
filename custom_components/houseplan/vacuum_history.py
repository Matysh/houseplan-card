"""Pinned public Dreame history values; no camera, recorder or Store writes."""
from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlsplit
from weakref import WeakKeyDictionary

from .vacuum_paths import (
    DREAME_SCHEMA,
    MAX_JSON_BYTES,
    MAX_POINTS,
    MAX_SEGMENTS,
    PathRejected,
    PathSnapshot,
    dreame_coordinate_key,
    normalize_paths,
    number,
    snapshot,
)

HISTORY_LIMIT = 100
HISTORY_METADATA_BYTES = 64 * 1024
_epochs: WeakKeyDictionary = WeakKeyDictionary()
_watches: WeakKeyDictionary = WeakKeyDictionary()


@dataclass(eq=False, slots=True)
class HistoryWatch:
    source: str
    vacuum: str
    revision: str
    state: Any
    retired: bool = False


def begin_history_watch(recorder: object, source: str, vacuum: str, revision: str, state: Any) -> HistoryWatch:
    watch = HistoryWatch(source, vacuum, revision, state)
    _watches.setdefault(recorder, {}).setdefault(source, set()).add(watch)
    return watch


def end_history_watch(recorder: object, watch: HistoryWatch) -> None:
    sources = _watches.get(recorder, {})
    watches = sources.get(watch.source, set())
    watches.discard(watch)
    if not watches:
        sources.pop(watch.source, None)
    if not sources:
        _watches.pop(recorder, None)


def observe_history_state(recorder: object, source: str, state: Any) -> None:
    """Use the recorder's existing callback only while explicit reads await.

    Ordinary positions/token rotation do not change record identity. An observed
    catalog ABA or source loss is sticky even after its original value returns.
    There is no additional subscription, polling or retained history catalog.
    """
    watches = _watches.get(recorder, {}).get(source)
    if not watches:
        return
    revisions: dict[str, str | None] = {}
    for watch in watches:
        watch.state = state
        if watch.retired:
            continue
        if watch.vacuum not in revisions:
            revision = None
            if state is not None and state.state not in ("unknown", "unavailable"):
                try:
                    revision = history_catalog(state.attributes.get("cleaning_history_picture"), source, watch.vacuum)[1]
                except PathRejected:
                    pass
            revisions[watch.vacuum] = revision
        if revisions[watch.vacuum] != watch.revision:
            watch.retired = True


def history_epochs(recorder: object) -> dict:
    """Transient confirmed task fences; no migration or persistent job IDs."""
    if recorder not in _epochs:
        _epochs[recorder] = {"default": uuid.uuid4().hex, "markers": {}}
    return _epochs[recorder]


def history_epoch(recorder: object, marker: str) -> str:
    epochs = history_epochs(recorder)
    return epochs["markers"].get(marker, epochs["default"])


def retire_history(recorder: object, marker: str) -> None:
    history_epochs(recorder)["markers"][marker] = uuid.uuid4().hex


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), sort_keys=True).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class HistoryRecord:
    id: str
    timestamp: int
    index: int


def history_catalog(metadata: Any, source: str, vacuum: str) -> tuple[list[HistoryRecord], str, bool]:
    """Read machine query fields, never localized labels or token-bearing HTTP.

    In the pinned public camera API v is CleaningHistory.date (start epoch),
    index is only its present one-based address. Tokens are ignored, not hashed
    or sent to the client. Duplicate epochs cannot prove which record to load.
    """
    if not isinstance(metadata, Mapping):
        raise PathRejected("unsupported")
    if len(metadata) > 1000:
        raise PathRejected("limited")
    if not isinstance(metadata, dict):
        metadata = dict(metadata)
    # Bound the input before JSON encoding: repeated long strings can otherwise
    # allocate tens of MiB merely to reject the 64-KiB catalog. Character count
    # plus quotes is a lower bound; the exact encoded-byte check remains below.
    characters = 2
    for label, url in metadata.items():
        if not isinstance(label, str) or not isinstance(url, str):
            raise PathRejected("unsupported")
        characters += len(label) + len(url) + 4
        if characters > HISTORY_METADATA_BYTES:
            raise PathRejected("limited")
    try:
        size = len(json.dumps(metadata, ensure_ascii=False).encode())
    except (TypeError, ValueError, RecursionError) as err:
        raise PathRejected("unsupported") from err
    if size > HISTORY_METADATA_BYTES:
        raise PathRejected("limited")
    records = []
    timestamps, indices = set(), set()
    for url in metadata.values():
        try:
            parsed = urlsplit(url)
            query = parse_qs(parsed.query, max_num_fields=16, strict_parsing=True)
            if parsed.scheme or parsed.netloc or parsed.path != f"/api/camera_history_map_proxy/{source}" \
                    or any(query.get(key, ["0"]) != ["0"] for key in ("cruising", "wifi_map", "cleaning_map")):
                raise ValueError("foreign history")
            index, stamp = query.get("index"), query.get("v")
            if not index or not stamp or len(index) != 1 or len(stamp) != 1 \
                    or not index[0].isascii() or not index[0].isdigit() \
                    or not stamp[0].isascii() or not stamp[0].isdigit():
                raise ValueError("invalid record")
            address, timestamp = int(index[0]), int(stamp[0])
            if not 1 <= address <= 1000 or not 0 < timestamp <= 253402300799:
                raise ValueError("invalid record")
        except (ValueError, TypeError) as err:
            raise PathRejected("unsupported") from err
        if timestamp in timestamps or address in indices:
            raise PathRejected("ambiguous")
        timestamps.add(timestamp)
        indices.add(address)
        records.append(HistoryRecord(digest([source, vacuum, timestamp]), timestamp, address))
    records.sort(key=lambda row: (-row.timestamp, row.id))
    revision = digest([[row.id, row.timestamp, row.index] for row in records])
    return records[:HISTORY_LIMIT], revision, len(records) > HISTORY_LIMIT


def history_snapshot(payload: Any) -> tuple[PathSnapshot, bool]:
    """Separate full historical decoder; ordinary live decoder stays strict."""
    if not isinstance(payload, (str, bytes)):
        raise PathRejected("unsupported")
    if len(payload) > MAX_JSON_BYTES or isinstance(payload, str) and len(payload.encode()) > MAX_JSON_BYTES:
        raise PathRejected("limited")
    try:
        data = json.loads(payload)
    except (ValueError, UnicodeError, RecursionError) as err:
        raise PathRejected("unsupported") from err
    if not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] != 2 \
            or data.get("history_map") is not True or type(data.get("completed")) is not bool \
            or any(flag in data and data[flag] is not False
                   for flag in ("saved_map", "wifi_map", "recovery_map", "cruising")):
        raise PathRejected("unsupported")
    frame = data.get("frame_id")
    if type(frame) is not int or frame < 0:
        raise PathRejected("coordinates_unverified")
    key = json.dumps([data.get(key) for key in ("map_id", "saved_map_id", "map_index")], separators=(",", ":"))
    # An archive's transport map_id alone is not proof of its saved floor.
    # Ordinary restored maps retain their existing fallback; history requires
    # the explicit saved-map witness demonstrated by the public producer.
    if data.get("saved_map_id") is None or dreame_coordinate_key(key) is None:
        raise PathRejected("coordinates_unverified")
    raw = data.get("path")
    if not isinstance(raw, list):
        raise PathRejected("incomplete")
    if len(raw) > MAX_SEGMENTS:
        raise PathRejected("limited")
    chunks, count = [], 0
    for chunk in raw:
        if not isinstance(chunk, list) or len(chunk) < 3 or len(chunk) % 2 != 1 \
                or type(chunk[0]) is not int or chunk[0] not in (1, 2, 3):
            raise PathRejected("incomplete")
        count += (len(chunk) - 1) // 2
        if count > MAX_POINTS:
            raise PathRejected("limited")
        if any(number(value) is None for value in chunk[1:]):
            raise PathRejected("incomplete")
        chunks.append([chunk[i:i + 2] for i in range(1, len(chunk), 2)])
    return snapshot("dreame", DREAME_SCHEMA, normalize_paths(chunks), key, frame), data["completed"]


def history_route(value: PathSnapshot, routes: list[dict], book: Any, spaces: set[str]) -> dict:
    """Bind only a unique native-proven floor; history may omit its slot."""
    history_key = dreame_coordinate_key(value.map_key)
    if history_key is None:
        raise PathRejected("coordinates_unverified")
    matched = {}
    for slot in ("current", "previous"):
        run = (book or {}).get(slot)
        if not isinstance(run, dict) or run.get("path_format") != 2 \
                or (run.get("provenance") or {}).get("provider") != "dreame" \
                or (run.get("provenance") or {}).get("schema") != DREAME_SCHEMA \
                or (run.get("quality") or {}).get("source") != "native":
            continue
        identity = run.get("_native_identity")
        if not isinstance(identity, list) or len(identity) != 2 or identity[0] != "dreame":
            continue
        native_key = dreame_coordinate_key(identity[1])
        # Only absent/null HISTORY slots are optional. Known slots, typed saved
        # floors and the ordinary native equality contract remain strict.
        if native_key is None or native_key[0] != history_key[0] \
                or history_key[1] is not None and native_key[1] != history_key[1]:
            continue
        for route in routes:
            if route["source"] == run.get("source") and route["id"] == run.get("route_id") \
                    and route["map_id"] == run.get("map_id"):
                matched[route["id"]] = route
    if len(matched) != 1:
        raise PathRejected("ambiguous" if matched else "coordinates_unverified")
    route = next(iter(matched.values()))
    if route["space"] not in spaces:
        raise PathRejected("missing_space")
    if route["calibration"] is None:
        raise PathRejected("needs_calibration")
    return route
