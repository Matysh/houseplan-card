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
MAX_FILE_BYTES = 50 * 1024 * 1024

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
SPACE_DISPLAY_SCHEMA = vol.Schema(
    {
        vol.Optional("show_borders"): bool,
        vol.Optional("show_names"): bool,
        vol.Optional("room_color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
        vol.Optional("room_opacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
        vol.Optional("fill_mode"): vol.In(["none", "lqi", "light", "temp", "glow"]),
        vol.Optional("temp_min"): vol.Coerce(float),
        vol.Optional("temp_max"): vol.Coerce(float),
        vol.Optional("show_lqi"): bool,
        vol.Optional("label_temp"): bool,
        vol.Optional("label_hum"): bool,
        vol.Optional("label_lqi"): bool,
        vol.Optional("label_light"): bool,
    },
    extra=vol.ALLOW_EXTRA,
)

_DECOR_COMMON = {
    vol.Required("id"): str,
    vol.Optional("color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
    vol.Optional("width"): vol.All(vol.Coerce(float), vol.Range(min=0.1, max=30)),
}
_NORM = vol.All(vol.Coerce(float), vol.Range(min=-1, max=2))
DECOR_SCHEMA = vol.Any(
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "line",
                vol.Required("x1"): _NORM, vol.Required("y1"): _NORM,
                vol.Required("x2"): _NORM, vol.Required("y2"): _NORM},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): vol.In(["rect", "ellipse"]),
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                vol.Required("w"): _NORM, vol.Required("h"): _NORM,
                vol.Optional("fill"): bool},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "text",
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                vol.Required("text"): vol.All(str, vol.Length(min=1, max=200)),
                vol.Optional("size"): vol.In(["s", "m", "l"])},
               extra=vol.ALLOW_EXTRA),
)

SPACE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        vol.Required("title"): str,
        vol.Optional("settings"): SPACE_DISPLAY_SCHEMA,
        vol.Optional("plan_url"): vol.Any(str, None),
        vol.Required("aspect"): vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20)),
        vol.Required("view_box"): vol.All([vol.Coerce(float)], vol.Length(min=4, max=4)),
        vol.Required("rooms"): [ROOM_SCHEMA],
        vol.Optional("decor"): [DECOR_SCHEMA],
        vol.Optional("openings"): [
            vol.Schema(
                {
                    vol.Required("id"): str,
                    vol.Required("type"): vol.Any("door", "window"),
                    vol.Required("x"): vol.Coerce(float),
                    vol.Required("y"): vol.Coerce(float),
                    vol.Required("angle"): vol.Coerce(float),
                    vol.Required("length"): vol.All(vol.Coerce(float), vol.Range(min=0.001, max=1)),
                    vol.Optional("contact"): vol.Any(str, None),
                    vol.Optional("lock"): vol.Any(str, None),
                    vol.Optional("invert"): bool,
                    vol.Optional("flip_h"): bool,
                    vol.Optional("flip_v"): bool,
                },
                extra=vol.ALLOW_EXTRA,
            )
        ],
        # Legacy: walls are derived from room outlines since v1.19.0 — a line has no
        # independent existence. Still accepted so a stale browser tab cannot fail a save;
        # the card strips the field on every write.
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
        vol.Optional("room_id"): vol.Any(str, None),
        vol.Optional("display"): vol.Any("badge", "ripple", "icon_ripple", None),
        vol.Optional("ripple_color"): vol.Any(str, None),
        vol.Optional("ripple_size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=1, max=20)), None),
        vol.Optional("size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=0.2, max=6)), None),
        vol.Optional("angle"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=-360, max=360)), None),
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
        vol.Optional("settings", default=dict): vol.Schema(
            {
                vol.Optional("glow_radius_cm"): vol.All(vol.Coerce(float), vol.Range(min=10, max=10000)),
                vol.Optional("known_devices"): [str],
                vol.Optional("new_device_ids"): [str],
                vol.Optional("fill_colors"): vol.Schema(
                    {
                        str: vol.Schema(
                            {
                                vol.Required("c"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
                                vol.Required("a"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                            }
                        )
                    }
                ),
            },
            extra=vol.ALLOW_EXTRA,
        ),
    },
    extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading
)
