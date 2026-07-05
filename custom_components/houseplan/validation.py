"""Pure House Plan validation and sanitizers — no Home Assistant dependencies.

Kept separate so it can be covered by unit tests (only voluptuous is needed).
"""
from __future__ import annotations

import re

import voluptuous as vol

# ---------- limits and extension sets ----------
PLAN_EXTENSIONS = {"svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}
MAX_PLAN_BYTES = 8 * 1024 * 1024
FILE_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp", "txt"}
MAX_FILE_BYTES = 25 * 1024 * 1024

SPACE_ID_RE = re.compile(r"^[a-z0-9_-]{1,64}$")
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

# ---------- sanitizers ----------


def sanitize_marker_id(value: str) -> str:
    """Safe marker identifier for a folder name.

    Strips path separators and leading dots to rule out directory traversal
    (e.g. '..', '../x'); an empty/dots-only result → 'misc'.
    """
    cleaned = _SAFE_NAME_RE.sub("_", value).lstrip(".")[:64]
    return cleaned or "misc"


def sanitize_filename(value: str) -> str:
    """Drop the path and leading dots, keep a safe file name."""
    raw = value.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return _SAFE_NAME_RE.sub("_", raw).lstrip(".")[:120] or "file"


def file_ext(filename: str) -> str:
    """Lowercase file extension ('' if none)."""
    raw = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return raw.rsplit(".", 1)[-1].lower() if "." in raw else ""


def valid_space_id(value: str) -> bool:
    return bool(SPACE_ID_RE.match(value))


# ---------- voluptuous schemas ----------
POS_SCHEMA = vol.Schema(
    {vol.Required("x"): vol.Coerce(float), vol.Required("y"): vol.Coerce(float)},
    extra=vol.ALLOW_EXTRA,  # v2 records carry the "s" key (space id)
)
LAYOUT_SCHEMA = vol.Schema({str: POS_SCHEMA})

POINT = vol.All([vol.Coerce(float)], vol.Length(min=2, max=2))


def _require_geometry(room: dict) -> dict:
    if "poly" in room or all(k in room for k in ("x", "y", "w", "h")):
        return room
    raise vol.Invalid("room: poly or x/y/w/h is required")


ROOM_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): str,
            vol.Required("name"): str,
            vol.Optional("area"): vol.Any(str, None),
            vol.Optional("x"): vol.Coerce(float),
            vol.Optional("y"): vol.Coerce(float),
            vol.Optional("w"): vol.Coerce(float),
            vol.Optional("h"): vol.Coerce(float),
            vol.Optional("poly"): vol.All([POINT], vol.Length(min=3)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _require_geometry,
)
SPACE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        vol.Required("title"): str,
        vol.Optional("plan_url"): vol.Any(str, None),
        vol.Required("aspect"): vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20)),
        vol.Required("view_box"): vol.All([vol.Coerce(float)], vol.Length(min=4, max=4)),
        vol.Required("rooms"): [ROOM_SCHEMA],
        vol.Optional("segments"): [vol.All([vol.Coerce(float)], vol.Length(min=4, max=4))],
    },
    extra=vol.ALLOW_EXTRA,
)
MARKER_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        # 'device:<device_id>' | 'entity:<entity_id>' | 'virtual'
        vol.Required("binding"): str,
        vol.Optional("space"): vol.Any(str, None),
        vol.Optional("area"): vol.Any(str, None),
        vol.Optional("hidden"): bool,
        vol.Optional("name"): vol.Any(str, None),
        vol.Optional("icon"): vol.Any(str, None),
        vol.Optional("model"): vol.Any(str, None),
        vol.Optional("link"): vol.Any(str, None),
        vol.Optional("description"): vol.Any(str, None),
        vol.Optional("tap_action"): vol.Any("info", "more-info", "toggle", None),
        vol.Optional("pdfs"): [
            vol.Schema({vol.Required("name"): str, vol.Required("url"): str}, extra=vol.ALLOW_EXTRA)
        ],
    },
    extra=vol.ALLOW_EXTRA,
)
CONFIG_SCHEMA = vol.Schema(
    {
        vol.Required("spaces"): [SPACE_SCHEMA],
        vol.Optional("markers", default=list): [MARKER_SCHEMA],
        vol.Optional("settings", default=dict): vol.Schema({}, extra=vol.ALLOW_EXTRA),
    },
    extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading
)
