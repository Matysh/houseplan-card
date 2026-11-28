"""Bounded Ecovacs SVG values; never execute or return the source document."""
from __future__ import annotations

import base64
import binascii
import hashlib
import io
import math
import re
import struct
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass

MAX_SVG_BYTES = 8 * 1024 * 1024
MAX_PNG_BYTES = 2 * 1024 * 1024
MAX_POINTS = 100_000
MAX_SEGMENTS = 1024
MAX_NODES = 20_000
SVG = "{http://www.w3.org/2000/svg}"
NUMBER = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
TOKEN = re.compile(rf"{NUMBER}|[A-Za-z]")
PNG_HEADER = b"\x89PNG\r\n\x1a\n"


class EcovacsRejected(ValueError):
    """A missing/unsupported value must not masquerade as an empty path."""


@dataclass(frozen=True, slots=True)
class EcovacsMap:
    position: dict[str, float] | None
    paths: list[list[list[float]]]
    bounds: tuple[float, float, float, float]
    digest: str
    png: str | None
    preview_reason: str | None


def _number(value: str | None) -> float:
    if value is None or re.fullmatch(NUMBER, value.strip()) is None:
        raise EcovacsRejected("unsupported")
    number = float(value)
    if not math.isfinite(number) or abs(number) > 1e9:
        raise EcovacsRejected("coordinates_unverified")
    return number


def _tokens(value: str):
    end = 0
    for match in TOKEN.finditer(value):
        if value[end:match.start()].strip(" \t\r\n,"):
            raise EcovacsRejected("unsupported")
        end = match.end()
        yield match.group()
    if value[end:].strip(" \t\r\n,"):
        raise EcovacsRejected("unsupported")


def _scale(value: str) -> tuple[float, float]:
    match = re.fullmatch(r"\s*scale\s*\(([^()]*)\)\s*", value)
    if match is None:
        raise EcovacsRejected("coordinates_unverified")
    values = list(_tokens(match[1]))
    if not 1 <= len(values) <= 2:
        raise EcovacsRejected("coordinates_unverified")
    x = _number(values[0])
    y = _number(values[-1])
    if x == 0 or y == 0:
        raise EcovacsRejected("coordinates_unverified")
    return x, y


def trace_path(value: str, transform: str) -> list[list[list[float]]]:
    """Decode the renderer's compact M/L/H/V without bridging move commands."""
    sx, sy = _scale(transform)
    paths: list[list[list[float]]] = []
    current: list[list[float]] = []
    xy = [0.0, 0.0]
    command = ""
    args: list[float] = []
    visited = 0
    required_value = False

    def finish() -> None:
        nonlocal current
        if current:
            paths.append(current)
            current = []
            if len(paths) > MAX_SEGMENTS:
                raise EcovacsRejected("limited")

    for token in _tokens(value):
        if len(token) == 1 and token.isalpha():
            if args or required_value or token not in "MmLlHhVv":
                raise EcovacsRejected("unsupported")
            command = token
            required_value = True
            continue
        if not command:
            raise EcovacsRejected("unsupported")
        args.append(_number(token))
        required = 1 if command in "HhVv" else 2
        if len(args) < required:
            continue
        kind = command.upper()
        if not current and kind != "M":
            raise EcovacsRejected("unsupported")
        if kind == "M":
            finish()
        if kind in ("M", "L"):
            xy = [args[0] + (xy[0] if command.islower() else 0),
                  args[1] + (xy[1] if command.islower() else 0)]
        elif kind == "H":
            xy[0] = args[0] + (xy[0] if command.islower() else 0)
        else:
            xy[1] = args[0] + (xy[1] if command.islower() else 0)
        args = []
        required_value = False
        point = [xy[0] * sx, xy[1] * sy]
        if not all(math.isfinite(v) and abs(v) <= 1e9 for v in point):
            raise EcovacsRejected("coordinates_unverified")
        visited += 1
        if visited > MAX_POINTS:
            raise EcovacsRejected("limited")
        if not current or current[-1] != point:
            current.append(point)
        if kind == "M":
            command = "l" if command == "m" else "L"
    if args or required_value:
        raise EcovacsRejected("unsupported")
    finish()
    return paths


def _png(data_uri: str) -> str:
    """Keep only verified PNG core chunks, with bounded decoded dimensions."""
    prefix = "data:image/png;base64,"
    if not data_uri.startswith(prefix):
        raise EcovacsRejected("preview_unsupported")
    encoded = data_uri[len(prefix):]
    if len(encoded) > (MAX_PNG_BYTES + 2) // 3 * 4:
        raise EcovacsRejected("limited")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as err:
        raise EcovacsRejected("preview_unsupported") from err
    if len(raw) > MAX_PNG_BYTES:
        raise EcovacsRejected("limited")
    if not raw.startswith(PNG_HEADER):
        raise EcovacsRejected("preview_unsupported")
    offset, kept = 8, bytearray(PNG_HEADER)
    header = ended = data = False
    compressed = bytearray()
    stride = height = 0
    while offset + 12 <= len(raw):
        size = struct.unpack_from(">I", raw, offset)[0]
        end = offset + 12 + size
        if end > len(raw):
            raise EcovacsRejected("preview_unsupported")
        kind, payload = raw[offset + 4:offset + 8], raw[offset + 8:end - 4]
        crc = struct.unpack_from(">I", raw, end - 4)[0]
        if zlib.crc32(kind + payload) & 0xffffffff != crc:
            raise EcovacsRejected("preview_unsupported")
        if not header:
            if kind != b"IHDR" or size != 13:
                raise EcovacsRejected("preview_unsupported")
            width, height = struct.unpack_from(">II", payload)
            if not 0 < width <= 4096 or not 0 < height <= 4096 or width * height > 16_000_000:
                raise EcovacsRejected("limited")
            bits, color, compression, filtering, interlace = payload[8:]
            channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color)
            if bits != 8 or not channels or compression or filtering or interlace:
                raise EcovacsRejected("preview_unsupported")
            stride = 1 + width * channels
            header = True
        elif kind == b"IHDR":
            raise EcovacsRejected("preview_unsupported")
        if kind in (b"IHDR", b"PLTE", b"tRNS", b"IDAT", b"IEND"):
            kept.extend(raw[offset:end])
        elif kind[0] & 32 == 0:
            raise EcovacsRejected("preview_unsupported")
        data |= kind == b"IDAT"
        if kind == b"IDAT":
            compressed.extend(payload)
        if kind == b"IEND":
            if size != 0 or end != len(raw):
                raise EcovacsRejected("preview_unsupported")
            ended = True
            break
        offset = end
    if not header or not ended or not data:
        raise EcovacsRejected("preview_unsupported")
    try:
        inflater = zlib.decompressobj()
        pixels = inflater.decompress(compressed, stride * height + 1)
    except zlib.error as err:
        raise EcovacsRejected("preview_unsupported") from err
    if len(pixels) != stride * height or not inflater.eof or inflater.unused_data \
            or inflater.unconsumed_tail or any(pixels[row * stride] > 4 for row in range(height)):
        raise EcovacsRejected("preview_unsupported")
    return prefix + base64.b64encode(kept).decode("ascii")


def decode_ecovacs_svg(payload: bytes) -> EcovacsMap:
    """Pinned HA/deebot-client SVG dialect. Nothing here fetches resources."""
    if not isinstance(payload, bytes):
        raise EcovacsRejected("unsupported")
    if len(payload) > MAX_SVG_BYTES:
        raise EcovacsRejected("limited")
    # The pinned renderer emits UTF-8. Do not let an alternate XML encoding
    # hide a DTD/entity declaration from the byte-level rejection below.
    if b"\x00" in payload:
        raise EcovacsRejected("unsupported")
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)", payload, flags=re.I):
        raise EcovacsRejected("unsupported")
    root = None
    depth = count = 0
    ids: set[str] = set()
    try:
        for event, node in ET.iterparse(io.BytesIO(payload), events=("start", "end")):
            if event == "end":
                depth -= 1
                continue
            root = node if root is None else root
            depth += 1
            count += 1
            if count > MAX_NODES or depth > 32:
                raise EcovacsRejected("limited")
            tag = node.tag.removeprefix(SVG).lower()
            if not node.tag.startswith(SVG) or tag in {
                "script", "foreignobject", "iframe", "animate", "animatetransform",
                "animatemotion", "set", "audio", "video",
            }:
                raise EcovacsRejected("unsupported")
            ident = node.get("id")
            if ident:
                if ident in ids:
                    raise EcovacsRejected("unsupported")
                ids.add(ident)
            for key, value in node.attrib.items():
                name = key.rsplit("}", 1)[-1].lower()
                if name.startswith("on"):
                    raise EcovacsRejected("unsupported")
                if name == "style" and re.search(r"transform|@import|url\s*\(", value, re.I):
                    raise EcovacsRejected("unsupported")
                if name == "href" and not (value.startswith("#")
                                           or tag == "image" and value.startswith("data:image/png;base64,")):
                    raise EcovacsRejected("unsupported")
    except (ET.ParseError, UnicodeError) as err:
        raise EcovacsRejected("unsupported") from err
    if root is None or root.tag != SVG + "svg" or root.get("transform") or not {"d", "c"} <= ids:
        raise EcovacsRejected("unsupported")
    for style in root.iter(SVG + "style"):
        if re.search(r"transform|@import|url\s*\(", style.text or "", re.I):
            raise EcovacsRejected("unsupported")
    bounds_tokens = list(_tokens(root.get("viewBox", "")))
    if len(bounds_tokens) != 4:
        raise EcovacsRejected("coordinates_unverified")
    bounds = tuple(_number(v) for v in bounds_tokens)
    if bounds[2] <= 0 or bounds[3] <= 0:
        raise EcovacsRejected("coordinates_unverified")
    robots = [node for node in root if node.tag == SVG + "use" and node.get("href") == "#d"]
    if len(robots) > 1:
        raise EcovacsRejected("coordinates_unverified")
    position = None
    if robots:
        if robots[0].get("transform"):
            raise EcovacsRejected("coordinates_unverified")
        position = {"x": _number(robots[0].get("x")), "y": _number(robots[0].get("y"))}
    traces = [node for node in root if node.tag == SVG + "path"
              and node.get("fill") == "none" and node.get("stroke") in ("#fff", "#ffffff")]
    if len(traces) > 1:
        raise EcovacsRejected("unsupported")
    paths = trace_path(traces[0].get("d", ""), traces[0].get("transform", "")) if traces else []
    images = [node for node in root if node.tag == SVG + "image"]
    png = None
    preview_reason = "preview_unsupported"
    if len(images) == 1:
        image = images[0]
        try:
            image_bounds = tuple(_number(image.get(key)) for key in ("x", "y", "width", "height"))
            if image.get("transform") or image_bounds != bounds:
                raise EcovacsRejected("coordinates_unverified")
            png = _png(image.get("href", ""))
            preview_reason = None
        except EcovacsRejected as err:
            preview_reason = str(err)
    return EcovacsMap(position, paths, bounds, hashlib.sha256(payload).hexdigest(), png, preview_reason)
