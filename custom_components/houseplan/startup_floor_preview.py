"""Optional, private startup paint cache; never an input to plan storage."""
from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import json
import re
import zlib
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers.storage import Store

from .core.command_state import OPTIMIZE_PENDING
from .core.constants import DEFAULT_CONFIG
from .core.room_appearance import (
    config_appearance_materialized,
    normalize_room_appearance,
)
from .store import get_data

WIRE_BYTES = 512 * 1024
BASE64_BYTES = (WIRE_BYTES + 2) // 3 * 4
VECTOR_BYTES = 2 * 1024 * 1024
PAINT_BYTES = 8 * 1024 * 1024
COUNT_LIMIT = 32
QUOTA_BYTES = 16 * 1024 * 1024
# HA persists a base64 string in a JSON Store plus its index row. Budget
# both envelopes, not just the compressed payload sent inside the string.
STORE_OVERHEAD_BYTES = 1024
PREFIX = "houseplan.startup-paint"
FORMAT = 1
RASTER_FORMAT = 2
RASTER_PIXELS = 2_000_000
HEX = re.compile(r"[0-9a-f]{64}")
LOCAL = re.compile(r"#[A-Za-z_][A-Za-z0-9_.:-]{0,127}")
REF = re.compile(r"url\((#[A-Za-z_][A-Za-z0-9_.:-]{0,127})\)", re.I)
VALUE = re.compile(r"[A-Za-z0-9#_.:,() /%+\-\s]*", re.ASCII)
NUMBERS = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?", re.ASCII)
GEOMETRY = frozenset(("d points x y x1 y1 x2 y2 width height rx ry r cx cy dx dy transform "
                      "viewBox gradientTransform patternTransform offset fx fy fr stdDeviation values").split())
PAINT_INPUTS = frozenset(("hp-stroke-units", "hp-wall-depth", "hp-hatch-step"))
TAGS = frozenset(("svg g defs path rect circle ellipse line polyline polygon clipPath mask linearGradient "
                  "radialGradient stop pattern filter feGaussianBlur feOffset feColorMatrix feFlood feComposite "
                  "feMerge feMergeNode feMorphology use").split())
ATTRS = GEOMETRY | frozenset((
    "id preserveAspectRatio vector-effect clip-rule fill-rule stroke-linecap stroke-linejoin stroke-miterlimit "
    "gradientUnits patternUnits patternContentUnits filterUnits primitiveUnits color-interpolation-filters "
    "in in2 result type operator k1 k2 k3 k4 maskUnits maskContentUnits marker-start marker-mid marker-end href "
    "fill fill-opacity stroke stroke-opacity stroke-width stroke-dasharray stroke-dashoffset opacity color clip-path mask "
    "filter paint-order stop-color stop-opacity flood-color flood-opacity shape-rendering"
).split())


def _digest(*parts: Any) -> str:
    return hashlib.sha256(json.dumps(parts, ensure_ascii=True, sort_keys=True, separators=(",", ":"),
                                     allow_nan=False).encode()).hexdigest()


def source_stamp(runtime, field, rev, body) -> str:
    """Prove exact response content, even when a restore reuses a revision."""
    return _digest(FORMAT, runtime.instance_id, runtime.build_identity.fingerprint, field, rev, body)


def _principal(connection):
    user = getattr(connection, "user", None)
    return user.id if user and user.is_active and user.id else None


def _address(user, message) -> str:
    return _digest(user, message["floor"], message["projection"], message["rotation"])


def _numeric(value) -> bool:
    return type(value) in (float, int) and -10_000_000 <= value <= 10_000_000


def _rect(value) -> bool:
    return (isinstance(value, dict) and set(value) == {"x", "y", "w", "h"}
            and all(_numeric(n) for n in value.values()) and value["w"] > 0 and value["h"] > 0)


def _valid_fit(fit, projection, rotation) -> bool:
    if not isinstance(fit, dict) or set(fit) != {"base", "display", "frame", "projection", "rotation"}:
        return False
    base, frame = fit["base"], fit["frame"]
    return (fit["projection"] == projection and _numeric(fit["rotation"]) and fit["rotation"] == rotation
            and isinstance(base, list) and len(base) == 4 and all(_numeric(n) for n in base)
            and base[2] > 0 and base[3] > 0 and _rect(fit["display"])
            and isinstance(frame, dict) and set(frame) == {"rect", "all", "hasContent", "outliers"}
            and _rect(frame["rect"]) and _rect(frame["all"]) and type(frame["hasContent"]) is bool
            and type(frame["outliers"]) is int and 0 <= frame["outliers"] <= 100_000)


def _valid_attribute(tag, key, value):
    if key in PAINT_INPUTS:
        return (tag == "path" and isinstance(value, str) and len(value) <= 42
                and bool(re.fullmatch(r"\d+(?:\.\d*)?(?:e[-+]?\d+)?", value, re.I | re.ASCII))
                and 0 <= float(value) <= 10_000_000 and (key == "hp-wall-depth" or float(value) > 0))
    if key not in ATTRS or not isinstance(value, str) or len(value) > 520_000:
        return False
    if key == "href":
        return tag == "use" and bool(LOCAL.fullmatch(value))
    if key == "id":
        return bool(LOCAL.fullmatch("#" + value))
    clean = REF.sub("", value)
    if not VALUE.fullmatch(clean) or re.search(r"url\s*\(", clean, re.I):
        return False
    if key in GEOMETRY:
        return (not re.search(r"Infinity|NaN", clean, re.I)
                and all(abs(float(match[0])) <= 10_000_000 for match in NUMBERS.finditer(clean)))
    return True


def _webp_dimensions(image: bytes) -> tuple[int, int]:
    """Accept static WebP with no metadata or animation payload."""
    if (len(image) < 20 or image[:4] != b"RIFF" or image[8:12] != b"WEBP"
            or int.from_bytes(image[4:8], "little") != len(image) - 8):
        raise ValueError("webp header")
    index = 12
    extended = None
    alpha = False
    dimensions = None
    while index < len(image):
        if index + 8 > len(image) or dimensions is not None:
            raise ValueError("webp chunks")
        kind = image[index:index + 4]
        count = int.from_bytes(image[index + 4:index + 8], "little")
        start = index + 8
        end = start + count
        if end + (count & 1) > len(image):
            raise ValueError("webp length")
        if kind == b"VP8X" and index == 12 and count == 10 and image[start:start + 4] == b"\x10\0\0\0":
            extended = (1 + int.from_bytes(image[start + 4:start + 7], "little"),
                        1 + int.from_bytes(image[start + 7:start + 10], "little"))
        elif kind == b"ALPH" and extended and not alpha and count > 1:
            alpha = True
        elif kind == b"VP8 " and count >= 10 and not image[start] & 1 and image[start + 3:start + 6] == b"\x9d\x01\x2a":
            dimensions = (int.from_bytes(image[start + 6:start + 8], "little") & 0x3fff,
                          int.from_bytes(image[start + 8:start + 10], "little") & 0x3fff)
        elif kind == b"VP8L" and count >= 5 and image[start] == 0x2f and extended is None:
            bits = int.from_bytes(image[start + 1:start + 5], "little")
            if bits >> 29:
                raise ValueError("webp version")
            dimensions = (1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff))
        else:
            raise ValueError("webp chunk")
        index = end + (count & 1)
    if not dimensions or not all(dimensions) or dimensions[0] * dimensions[1] > RASTER_PIXELS:
        raise ValueError("webp pixels")
    if extended is not None and (not alpha or extended != dimensions):
        raise ValueError("webp alpha")
    return dimensions


def _valid_raster(packet, projection, rotation):
    if (projection != "iso" or set(packet) != {"version", "fit", "size", "view", "zoom", "image"}
            or not _valid_fit(packet["fit"], projection, rotation)):
        return False
    size, view, zoom, image = packet["size"], packet["view"], packet["zoom"], packet["image"]
    if (not isinstance(size, list) or len(size) != 2
            or not all(type(item) is int and 0 < item <= 16_384 for item in size)
            or not isinstance(view, list) or len(view) != 4
            or not all(type(item) in (int, float) and abs(item) <= 10_000_000 for item in view)
            or not all(item > 0 for item in view[2:])
            or type(zoom) not in (int, float) or not 0 < zoom <= 10_000
            or not isinstance(image, str) or len(image) > BASE64_BYTES):
        return False
    _webp_dimensions(base64.b64decode(image, validate=True))
    return True


def validate_preview(wire: str, projection: str, rotation: int) -> int:
    """Check bounded gzip and inert vector or raster data, returning the wire bytes."""
    if not isinstance(wire, str) or len(wire) > BASE64_BYTES:
        raise ValueError("wire limit")
    data = base64.b64decode(wire, validate=True)
    if not 0 < len(data) <= WIRE_BYTES:
        raise ValueError("wire limit")
    decoder = zlib.decompressobj(wbits=31)
    raw = decoder.decompress(data, VECTOR_BYTES + 1)
    if len(raw) > VECTOR_BYTES or not decoder.eof or decoder.unused_data:
        raise ValueError("expanded limit")
    packet = json.loads(raw)
    if isinstance(packet, dict) and type(packet.get("version")) is int and packet["version"] == RASTER_FORMAT:
        if not _valid_raster(packet, projection, rotation):
            raise ValueError("raster shape")
        return len(data)
    if (not isinstance(packet, dict) or set(packet) != {"version", "fit", "nodes", "pool"}
            or type(packet["version"]) is not int or packet["version"] != FORMAT
            or not _valid_fit(packet["fit"], projection, rotation)
            or not isinstance(packet["nodes"], list) or not packet["nodes"]
            or not isinstance(packet["pool"], list) or len(packet["pool"]) > 100_000
            or not all(isinstance(value, str) for value in packet["pool"])):
        raise ValueError("shape")
    pool = packet["pool"]
    todo = [(row, 0) for row in packet["nodes"]]
    count, chars = 0, 0
    accepted = set()
    while todo:
        row, depth = todo.pop()
        count += 1
        if (count > 25_000 or depth > 48 or not isinstance(row, list) or len(row) != 3
                or not isinstance(row[0], str) or row[0] not in TAGS or not isinstance(row[1], dict)
                or not isinstance(row[2], list)):
            raise ValueError("geometry")
        for key, index in row[1].items():
            if type(index) is not int or not 0 <= index < len(pool):
                raise ValueError("attribute reference")
            value = pool[index]
            chars += len(key) + len(value) + 4
            if chars > PAINT_BYTES:
                raise ValueError("paint expansion")
            identity = row[0], key, index
            if identity not in accepted:
                if not _valid_attribute(row[0], key, value):
                    raise ValueError("attribute")
                accepted.add(identity)
        todo.extend((child, depth + 1) for child in row[2])
    return len(data)


class PreviewStorage:
    """Small durable index with separately read/written cache bodies."""

    def __init__(self, hass) -> None:
        self.hass = hass
        self.index_store = Store(hass, FORMAT, PREFIX)
        self.lock = asyncio.Lock()
        self.rows = None
        self.clock = 0
        self.accepted_input = None

    def body(self, key, generation):
        return Store(self.hass, FORMAT, f"{PREFIX}.{key}.{generation}")

    async def index(self):
        if self.rows is None:
            data = await self.index_store.async_load()
            # HA can restore these optional files independently of the current
            # plan. Invalid keys never reach path construction.
            self.rows = {
                key: row for key, row in data.items()
                if HEX.fullmatch(key) and isinstance(row, dict)
                and isinstance(row.get("generation"), str) and HEX.fullmatch(row["generation"])
                and isinstance(row.get("variant"), str) and HEX.fullmatch(row["variant"])
                and type(row.get("bytes")) is int and 0 < row["bytes"] <= BASE64_BYTES + STORE_OVERHEAD_BYTES
                and type(row.get("used")) is int and 0 <= row["used"] <= 2**53
                and isinstance(row.get("source"), list) and len(row["source"]) == 2
                and all(isinstance(s, str) and HEX.fullmatch(s) for s in row["source"])
            } if isinstance(data, dict) else {}
            self.clock = max((row["used"] for row in self.rows.values()), default=0)
        self.clock += 1
        return self.rows

    async def read(self, key, source, variant):
        async with self.lock:
            rows = await self.index()
            found = rows.get(key)
            if not found or found["source"] != source or found["variant"] != variant:
                return None
            wire = await self.body(key, found["generation"]).async_load()
            found["used"] = self.clock
            return wire if isinstance(wire, str) and len(wire) <= BASE64_BYTES else None

    async def write(self, key, source, variant, wire, size, current):
        async with self.lock:
            rows = await self.index()
            generation = await self.hass.async_add_executor_job(_digest, source, variant, wire)
            previous = rows.get(key)
            if previous and previous["generation"] == generation:
                previous["used"] = self.clock
                return await current()
            if not await current():
                return False
            body_store = self.body(key, generation)
            await body_store.async_save(wire)
            kept = {**rows, key: {
                "generation": generation, "source": source, "variant": variant, "bytes": size, "used": self.clock,
            }}
            retired = [(key, previous)] if previous else []
            while len(kept) > COUNT_LIMIT or sum(row["bytes"] for row in kept.values()) > QUOTA_BYTES:
                oldest = min(kept, key=lambda addr: (kept[addr]["source"] == source, kept[addr]["used"]))
                retired.append((oldest, kept.pop(oldest)))
            if not await current():
                await body_store.async_remove()
                return False
            try:
                await self.index_store.async_save(kept)
            except OSError:
                await body_store.async_remove()
                raise
            self.rows = kept
            for retired_key, row in retired:
                await self.body(retired_key, row["generation"]).async_remove()
            return True


def _pair_source(runtime, config_data, layout_data):
    if OPTIMIZE_PENDING in layout_data or "geom_pending" in layout_data:
        return None
    config = {**DEFAULT_CONFIG, **config_data.get("config", {})}
    if not config_appearance_materialized(config):
        config = normalize_room_appearance(config)
    spaces = frozenset(space["id"] for space in config["spaces"] if isinstance(space, dict) and "id" in space)
    return spaces, [
        source_stamp(runtime, "config", int(config_data.get("rev", 0)), config),
        source_stamp(runtime, "layout", int(layout_data.get("rev", 0)), layout_data.get("layout", {})),
    ]


async def _current(hass, runtime, connection, user, message):
    if _principal(connection) != user or get_data(hass) is not runtime or runtime.write_lock.locked():
        return False
    def generation():
        return runtime.config_store.content_epoch, runtime.store.content_epoch

    epoch = generation()
    if any(value % 2 for value in epoch):
        return False
    storage = runtime.startup_floor_previews
    if storage.accepted_input is None or storage.accepted_input[0] != epoch:
        # Optional reads do not hold the canonical-write lock while accessing
        # disk. Recheck the generation after every wait, including authentication.
        config_data = await runtime.config_store.async_load() or {}
        layout_data = await runtime.store.async_load() or {}
        pair = await hass.async_add_executor_job(_pair_source, runtime, config_data, layout_data)
        if not pair or epoch != generation():
            return False
        storage.accepted_input = epoch, pair
    spaces, source = storage.accepted_input[1]
    active_user = await hass.auth.async_get_user(user)
    return (
        message["floor"] in spaces and source == message["source"] and _principal(connection) == user
        and active_user is not None and active_user.is_active
        and get_data(hass) is runtime and not runtime.write_lock.locked() and epoch == generation()
    )


ADDRESS = {
    vol.Required("floor"): vol.All(str, vol.Length(min=1, max=200)),
    vol.Required("projection"): vol.In(("flat", "iso")),
    vol.Required("rotation"): vol.All(int, vol.In(tuple(range(0, 360, 45)))),
    vol.Required("variant"): vol.All(str, vol.Match(r"^[0-9a-f]{64}$")),
    vol.Required("source"): vol.All([vol.All(str, vol.Match(r"^[0-9a-f]{64}$"))], vol.Length(min=2, max=2)),
}


@websocket_api.websocket_command({vol.Required("type"): "houseplan/startup_floor/get", **ADDRESS})
@websocket_api.async_response
async def ws_get(hass, connection, msg):
    """The same principal can retrieve only its own derived paint."""
    user, runtime = _principal(connection), get_data(hass)
    try:
        storage = runtime.startup_floor_previews if runtime else None
        if storage is not None and user and await _current(hass, runtime, connection, user, msg):
            wire = await storage.read(_address(user, msg), msg["source"], msg["variant"])
            if wire and await _current(hass, runtime, connection, user, msg):
                connection.send_result(msg["id"], {"packet": wire})
                return
    except (OSError, TypeError, ValueError, KeyError):
        pass
    connection.send_result(msg["id"], {"packet": None})


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/startup_floor/put", **ADDRESS,
    vol.Required("packet"): vol.All(str, vol.Length(max=BASE64_BYTES)),
})
@websocket_api.async_response
async def ws_put(hass, connection, msg):
    """Allow a viewer to warm its own non-authoritative cache."""
    user, runtime = _principal(connection), get_data(hass)

    async def current():
        return await _current(hass, runtime, connection, user, msg)

    try:
        storage = runtime.startup_floor_previews if runtime else None
        if storage is not None and user and await current():
            if msg["projection"] == "flat" and msg["rotation"] % 90:
                raise ValueError("flat rotation")
            wire = msg["packet"]
            await hass.async_add_executor_job(validate_preview, wire, msg["projection"], msg["rotation"])
            size = len(wire) + STORE_OVERHEAD_BYTES
            if await storage.write(_address(user, msg), msg["source"], msg["variant"], wire, size, current):
                connection.send_result(msg["id"], {"stored": True})
                return
    except (OSError, TypeError, ValueError, KeyError, RecursionError, zlib.error, binascii.Error):
        pass
    connection.send_result(msg["id"], {"stored": False})


def async_register(hass):
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_put)
