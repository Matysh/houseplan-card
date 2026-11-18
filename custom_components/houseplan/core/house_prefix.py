"""The only client-readable house-container signature (at most 1 KiB)."""
from __future__ import annotations

import re
import struct
import zlib

PREFIX_BYTES = 1024
MIMETYPE = b"application/vnd.houseplan.plan+zip;version=1"
_FAMILY = re.compile(rb"application/vnd\.houseplan\.plan\+zip;version=([1-9][0-9]{0,5})\Z")


def canonical_prefix(version: int = 1) -> bytes:
    if type(version) is not int or not 1 <= version <= 999999:
        raise ValueError("invalid container version")
    body = b"application/vnd.houseplan.plan+zip;version=" + str(version).encode("ascii")
    return struct.pack("<4s5H3I2H", b"PK\x03\x04", 20, 0, 0, 0, 33,
                       zlib.crc32(body), len(body), len(body), 8, 0) + b"mimetype" + body


def classify_prefix(raw: bytes) -> str:
    """Return house/unsupported/other; this is NOT full archive validation."""
    raw = raw[:PREFIX_BYTES]
    if len(raw) < 38:
        return "other"
    signature, version, flags, method, stamp, date, crc, packed, size, name, extra = struct.unpack("<4s5H3I2H", raw[:30])
    if ((signature, version, flags, method, stamp, date, name, extra)
            != (b"PK\x03\x04", 20, 0, 0, 0, 33, 8, 0)
            or size != packed or size > PREFIX_BYTES - 38 or len(raw) < 38 + size
            or raw[30:38] != b"mimetype"):
        return "other"
    body = raw[38:38 + size]
    match = _FAMILY.fullmatch(body)
    if match is None or zlib.crc32(body) != crc:
        return "other"
    number = int(match[1])
    if raw[:38 + size] != canonical_prefix(number):
        return "other"
    return "house" if number == 1 else "unsupported"
