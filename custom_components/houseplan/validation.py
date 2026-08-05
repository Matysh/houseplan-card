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
# The name length the content view will accept back in a request. Anything a
# generated name must fit inside, collision tag included (HP-1460-01).
MAX_FILENAME = 120

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
    return _SAFE_NAME_RE.sub("_", raw).lstrip(".")[:MAX_FILENAME] or "file"


def file_ext(filename: str) -> str:
    """Lowercase file extension ('' if none)."""
    raw = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return raw.rsplit(".", 1)[-1].lower() if "." in raw else ""


def valid_space_id(value: str) -> bool:
    return bool(SPACE_ID_RE.match(value))


# ---------- voluptuous schemas ----------
def _finite(value):
    """Coerce to float and reject NaN/Infinity (audit B5).

    'NaN' and 'Infinity' pass Coerce(float) and serialize to null on write,
    silently corrupting a stored position forever.
    """
    f = float(value)
    if f != f or f in (float("inf"), float("-inf")):
        raise vol.Invalid("coordinate must be a finite number")
    return f


# generous caps: the product targets 20-200 devices and a handful of floors
MAX_SPACES = 50
MAX_ROOMS = 400
MAX_MARKERS = 2000
MAX_OPENINGS = 500
MAX_DECOR = 1000
MAX_LAYOUT = 5000
# Inner limits (HP-1454-05). The outer collections were capped, the collections
# INSIDE them were not: a 150 000-point polygon or a 100 000-entry known_devices
# list passed validation, then made the card build gigantic SVG attributes and
# walk them on every render. Any authenticated writer could store one, and with
# `admin_only` off that is every user. These are product limits, not guesses: a
# hand-drawn room does not need 500 vertices, and no home has 200 lights behind
# one switch.
MAX_POLY_POINTS = 500
MAX_OPEN_TO = 50
MAX_CONTROLS = 200
MAX_PDFS = 50
MAX_KNOWN_DEVICES = 20000
MAX_TEXT = 500          # names, models, ids
MAX_DESCRIPTION = 4000
MAX_URL = 2000
# Comfortably below the WebSocket frame limit (aiohttp's default is 4 MB): a
# payload larger than the frame never reaches the handler at all — the socket
# closes with 1009 and the user sees a dropped connection instead of an error
# they can act on. For scale, a real three-floor home with ~200 devices stores
# about 70 KB, so this is ~30x headroom.
MAX_CONFIG_BYTES = 2 * 1024 * 1024

_TEXT = vol.All(str, vol.Length(max=MAX_TEXT))
_TEXT_OR_NONE = vol.Any(None, _TEXT)
_URL = vol.All(str, vol.Length(max=MAX_URL))

# The canvas is UNBOUNDED (docs/CANVAS.md). Coordinates are still normalised —
# 1.0 is still one canvas width — but there is no frame any more, so a plan may
# legitimately live at 2.7 or -1.4. The range below is GARBAGE INSURANCE, not a
# boundary: at the product's own scale (cell_cm=5, 240 cells across the unit
# width) 5000 is about 60 km of plan, unreachable in a home, while a stored
# 1e100 still cannot stretch every client's view until the plan is invisible
# (HP-1500-03 / HP-1501-01). Widened from +/-4 on 2026-08-03.
CANVAS_LIMIT = 5000.0
_COORD = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))

POS_SCHEMA = vol.Schema(
    {vol.Required("x"): _COORD, vol.Required("y"): _COORD},
    extra=vol.ALLOW_EXTRA,  # v2 records carry the "s" key (space id)
)
LAYOUT_SCHEMA = vol.All(vol.Schema({str: POS_SCHEMA}), vol.Length(max=MAX_LAYOUT))

# Room/opening geometry: same story, same range (docs/CANVAS.md). A vertex at
# 2.5 is a plan that grew past the old square, not corruption; 1e100 is
# corruption (HP-1501-01, the room-geometry twin of HP-1500-03).
_GEOM = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))

# A SIZE is not a coordinate (HP-1502-01): SVG requires positive width/height,
# and the clients divide by these. `view_box: [0,0,0,0]` passed the shared
# validator and serialised into viewBox="0 0 0 0" — a blank plan on every
# client. The floor is one thousandth of the canvas (1 render unit): far below
# any real room, but keeps the maths finite. The CEILING follows the canvas
# (docs/CANVAS.md) — a room on an unbounded plane may legitimately be wider
# than the old unit square — while staying strictly positive.
_EXTENT = vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT))

# The backdrop's uniform scale (docs/BACKDROP.md). A MULTIPLIER, not a
# coordinate: strictly positive, and bounded by what a person could mean —
# a hundredth of the canvas is already a thumbnail, a hundred canvases is
# already absurd. Mirrored by PLAN_SCALE_MIN/MAX in src/space-geometry.ts.
PLAN_SCALE_MIN = 0.01
PLAN_SCALE_MAX = 100.0


def _view_box(value):
    """[x, y, w, h]: the first two are coordinates, the last two are sizes."""
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise vol.Invalid("view_box must be [x, y, w, h]")
    return [_GEOM(value[0]), _GEOM(value[1]), _EXTENT(value[2]), _EXTENT(value[3])]


POINT = vol.All([_GEOM], vol.Length(min=2, max=2))


def _require_geometry(room: dict) -> dict:
    if "poly" in room or all(k in room for k in ("x", "y", "w", "h")):
        return room
    raise vol.Invalid("room: poly or x/y/w/h is required")


ROOM_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): _TEXT,
            vol.Required("name"): _TEXT,
            vol.Optional("area"): _TEXT_OR_NONE,
            vol.Optional("open_to"): vol.All([_TEXT], vol.Length(max=MAX_OPEN_TO)),
            vol.Optional("settings"): vol.Any(
                None,
                vol.Schema(
                    {
                        vol.Optional("fill_mode"): vol.Any(None, vol.In(["none", "lqi", "light", "temp"])),
                        vol.Optional("temp_source"): vol.Any(str, None),
                        vol.Optional("hum_source"): vol.Any(str, None),
                        vol.Optional("name_scale"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3))),
                        vol.Optional("label_scale"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3))),
                    },
                    extra=vol.ALLOW_EXTRA,
                ),
            ),
            vol.Optional("x"): _GEOM,
            vol.Optional("y"): _GEOM,
            vol.Optional("w"): _EXTENT,
            vol.Optional("h"): _EXTENT,
            vol.Optional("poly"): vol.All([POINT], vol.Length(min=3, max=MAX_POLY_POINTS)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _require_geometry,
)

def _north_deg(value):
    """Compass (docs/SUN.md): strict integer degrees, 0..359.

    Strict on purpose: Coerce(int) would take "90" and 1.5, and a bool is an
    int in Python — none of those is a compass reading a client stored.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise vol.Invalid("north_deg must be an integer in 0..359")
    if not 0 <= value <= 359:
        raise vol.Invalid("north_deg must be an integer in 0..359")
    return value


_BG_MODE = vol.In(["static", "daynight"])

SPACE_DISPLAY_SCHEMA = vol.Schema(
    {
        vol.Optional("show_borders"): bool,
        vol.Optional("show_names"): bool,
        vol.Optional("room_color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
        # per-space background around the plan; absent = inherit the global one
        vol.Optional("bg_color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
        vol.Optional("room_opacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
        vol.Optional("fill_mode"): vol.In(["none", "lqi", "light", "temp", "glow"]),
        vol.Optional("temp_min"): vol.Coerce(float),
        vol.Optional("temp_max"): vol.Coerce(float),
        vol.Optional("show_lqi"): bool,
        # "draw less" switches; absent = False = everything is drawn as before
        vol.Optional("hide_decor"): bool,
        vol.Optional("hide_openings"): bool,
        vol.Optional("label_temp"): bool,
        vol.Optional("label_hum"): bool,
        vol.Optional("label_lqi"): bool,
        vol.Optional("label_light"): bool,
        vol.Optional("card_font_scale"): vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3)),
        # sun on the plan (docs/SUN.md): per-space overrides, absent = inherit
        vol.Optional("north_deg"): vol.Any(None, _north_deg),
        vol.Optional("bg_mode"): vol.Any(None, _BG_MODE),
        vol.Optional("sun_rays"): vol.Any(None, bool),
    },
    extra=vol.ALLOW_EXTRA,
)

# Live text on a decor label (docs/LIVE-TEXT.md). An entity id is
# `<domain>.<object_id>`; HA itself allows only lowercase letters, digits and
# underscores in both halves. The bound is a sanity limit, not a policy.
MAX_ENTITY_ID = 255
_ENTITY_ID = vol.All(str, vol.Length(min=3, max=MAX_ENTITY_ID),
                     vol.Match(r"^[a-z0-9_]+\.[a-z0-9_]+$"))
# A caption is a caption: the template is bounded, the attribute name is a flat
# name (no dots needed), and a unit is a couple of characters, not a sentence.
MAX_DECOR_TEXT = 200
MAX_DECOR_ATTR = 64
MAX_DECOR_UNIT = 16
# The text block is scaled by dragging its corners; the range is what a human
# could mean on a 1000-unit canvas, the rest is garbage insurance.
DECOR_TEXT_SCALE_MIN = 0.15
DECOR_TEXT_SCALE_MAX = 20.0
# A furniture symbol id (docs/FURNITURE.md). Deliberately NOT the card's list:
# the backend must accept a plan written by a NEWER card, and a card that has
# learnt a new symbol must not have to wait for the integration to be updated
# before the user can save. What is enforced is the shape of the id — a flat
# lowercase name — and its length; an id this backend has never heard of simply
# renders as nothing in an older card.
MAX_FURN_SYMBOL = 32
_FURN_SYMBOL = vol.All(str, vol.Length(min=1, max=MAX_FURN_SYMBOL),
                       vol.Match(r"^[a-z0-9_]+$"))
# …and its size: strictly positive, capped by the same canvas insurance limit
# an opening's length is. A piece of furniture is a SIZE, not a coordinate.
_FURN_SIZE = vol.All(_finite, vol.Range(min=0.0000001, max=CANVAS_LIMIT))

_DECOR_COMMON = {
    vol.Required("id"): str,
    vol.Optional("color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
    vol.Optional("width"): vol.All(vol.Coerce(float), vol.Range(min=0.1, max=30)),
}
# Decor lives on the same unbounded canvas as everything else (docs/CANVAS.md):
# it used to be pinned to -1..2, i.e. "one canvas of slack around the square".
_NORM = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))
DECOR_SCHEMA = vol.Any(
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "line",
                vol.Required("x1"): _NORM, vol.Required("y1"): _NORM,
                vol.Required("x2"): _NORM, vol.Required("y2"): _NORM},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): vol.In(["rect", "ellipse"]),
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                # sizes are extents — negative/zero is garbage, not "canvas slack"
                vol.Required("w"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                vol.Required("h"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                vol.Optional("fill"): bool},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "text",
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                # the template: newlines are the user's own line breaks and are
                # kept verbatim (docs/LIVE-TEXT.md); the label never wraps itself
                vol.Required("text"): vol.All(str, vol.Length(min=1, max=MAX_DECOR_TEXT)),
                # legacy font size ('s'|'m'|'l'). The dialog no longer offers it
                # — the block is scaled by its corner handles — but a plan
                # written before that keeps it, and it is read as the scale it
                # used to render at. Kept in the schema so it stays BOUNDED.
                vol.Optional("size"): vol.In(["s", "m", "l"]),
                # size and rotation of the block (docs/LIVE-TEXT.md §block).
                # Both optional: a shape without them is the old one exactly.
                vol.Optional("scale"): vol.All(
                    _finite, vol.Range(min=DECOR_TEXT_SCALE_MIN, max=DECOR_TEXT_SCALE_MAX)),
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0)),
                # live text: the label may show one entity's value. All three
                # optional, so every existing plan validates unchanged and no
                # migration runs.
                vol.Optional("entity"): vol.Any(None, _ENTITY_ID),
                vol.Optional("attr"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DECOR_ATTR))),
                vol.Optional("unit"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DECOR_UNIT)))},
               extra=vol.ALLOW_EXTRA),
    # A piece of furniture (docs/FURNITURE.md): a symbol id, a normalised box
    # and an optional rotation. It is a NEW kind, so no existing plan carries
    # it, nothing is migrated, and an integration that has this branch reads
    # every older config byte-for-byte as before.
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "furniture",
                vol.Required("symbol"): _FURN_SYMBOL,
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                vol.Required("w"): _FURN_SIZE, vol.Required("h"): _FURN_SIZE,
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0))},
               extra=vol.ALLOW_EXTRA),
)

SPACE_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Match(SPACE_ID_RE.pattern)),
        vol.Required("title"): str,
        vol.Optional("settings"): SPACE_DISPLAY_SCHEMA,
        vol.Optional("plan_url"): vol.Any(str, None),
        # The canvas is square since v1.48.0. What used to be the space's own
        # `aspect` is gone; the background image keeps its own proportions and
        # is centred, so only the IMAGE's ratio is stored. A stale tab may still
        # send the old field — it is dropped rather than trusted, because the
        # coordinates it comes with were normalised against a different box.
        vol.Remove("aspect"): object,
        vol.Optional("plan_aspect"): vol.Any(
            None, vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20))
        ),
        # Backdrop placement (docs/BACKDROP.md): the picture may be moved and
        # scaled UNIFORMLY on the canvas. All three are optional and their
        # absence is the pre-v1.58.0 behaviour exactly — there is no migration,
        # and an old config validates unchanged. The offset is a normalised
        # coordinate like every other one (the ±CANVAS_LIMIT garbage guard);
        # the scale is a positive multiplier in a range a human could mean.
        vol.Optional("plan_x"): vol.Any(None, _COORD),
        vol.Optional("plan_y"): vol.Any(None, _COORD),
        vol.Optional("plan_scale"): vol.Any(
            None, vol.All(_finite, vol.Range(min=PLAN_SCALE_MIN, max=PLAN_SCALE_MAX))
        ),
        vol.Required("view_box"): _view_box,
        vol.Required("rooms"): vol.All([ROOM_SCHEMA], vol.Length(max=MAX_ROOMS)),
        vol.Optional("decor"): vol.All([DECOR_SCHEMA], vol.Length(max=MAX_DECOR)),
        vol.Optional("openings"): vol.All([
            vol.Schema(
                {
                    vol.Required("id"): str,
                    vol.Required("type"): vol.Any("door", "window"),
                    vol.Required("x"): _GEOM,
                    vol.Required("y"): _GEOM,
                    vol.Required("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0)),
                    # a SIZE: strictly positive, capped by the canvas insurance
                    # limit rather than by the old unit square (docs/CANVAS.md)
                    vol.Required("length"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                    vol.Optional("contact"): vol.Any(str, None),
                    vol.Optional("lock"): vol.Any(str, None),
                    vol.Optional("invert"): bool,
                    vol.Optional("flip_h"): bool,
                    vol.Optional("flip_v"): bool,
                },
                extra=vol.ALLOW_EXTRA,
            )
        ], vol.Length(max=MAX_OPENINGS)),
        # Legacy: walls are derived from room outlines since v1.19.0 — a line has no
        # independent existence. Still accepted so a stale browser tab cannot fail a save;
        # the card strips the field on every write.
        # Accepted so a stale browser tab cannot fail a save, then DROPPED here
        # (HP-1454-05): relying on a modern client to strip an unbounded legacy
        # list is not a limit, it is a hope. `Remove` returns the key stripped.
        vol.Remove("segments"): object,
    },
    extra=vol.ALLOW_EXTRA,
)
MARKER_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        # 'device:<device_id>' | 'entity:<entity_id>' | 'virtual'
        vol.Required("binding"): vol.All(
            str,
            vol.Length(min=1, max=MAX_TEXT),
            vol.Match(r"^(device:.+|entity:.+|virtual)$"),
        ),
        vol.Optional("space"): vol.Any(str, None),
        vol.Optional("area"): vol.Any(str, None),
        vol.Optional("hidden"): bool,
        vol.Optional("name"): _TEXT_OR_NONE,
        vol.Optional("icon"): _TEXT_OR_NONE,
        vol.Optional("model"): _TEXT_OR_NONE,
        vol.Optional("link"): vol.Any(None, _URL),
        vol.Optional("description"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DESCRIPTION))),
        vol.Optional("tap_action"): vol.Any("info", "more-info", "toggle", "run", "cover", None),
        # the 'run' target: only the runnable domains, nothing else is callable
        vol.Optional("tap_target"): vol.Any(
            None, vol.All(str, vol.Length(max=MAX_TEXT), vol.Match(r"^(automation|script|scene)\.[A-Za-z0-9_]+$"))
        ),
        vol.Optional("tap_confirm"): vol.Any(bool, None),
        # live robot vacuums (docs/VACUUM.md): everything optional so configs
        # from older versions stay valid untouched
        vol.Optional("vacuum"): vol.Any(
            None,
            vol.Schema({
                vol.Optional("live"): vol.Any(bool, None),
                vol.Optional("trail"): vol.Any(bool, None),
                vol.Optional("trail_mode"): vol.Any(
                    None, vol.In(["never", "cleaning", "always"])
                ),
                vol.Optional("room_highlight"): vol.Any(bool, None),
                vol.Optional("source"): vol.Any(str, None),
                # one 6-number affine per robot map; numbers must be finite
                vol.Optional("calibration"): vol.Schema(
                    {str: vol.All([_finite], vol.Length(min=6, max=6))}
                ),
                vol.Optional("segment_map"): vol.Schema({str: str}),
            }),
        ),
        vol.Optional("controls"): vol.Any(None, vol.All([_TEXT], vol.Length(max=MAX_CONTROLS))),
        vol.Optional("glow_radius_cm"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=10, max=10000)), None),
        vol.Optional("is_light"): vol.Any(bool, None),
        # climate current_temperature: badge + room-average vote (off unless True)
        vol.Optional("use_climate_temp"): vol.Any(bool, None),
        vol.Optional("room_id"): vol.Any(str, None),
        # keep in sync with DISPLAY_MODES in src/logic.ts — a cross-language test
        # asserts every option the editor offers is accepted here (issue #3)
        vol.Optional("display"): vol.Any("badge", "ripple", "icon_ripple", "value", None),
        vol.Optional("ripple_color"): vol.Any(
            None, vol.Match(r"^#[0-9a-fA-F]{6}$")
        ),
        vol.Optional("ripple_size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=1, max=20)), None),
        vol.Optional("size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=0.2, max=6)), None),
        vol.Optional("angle"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=-360, max=360)), None),
        vol.Optional("pdfs"): vol.All(
            [vol.Schema({vol.Required("name"): _TEXT, vol.Required("url"): _URL}, extra=vol.ALLOW_EXTRA)],
            vol.Length(max=MAX_PDFS),
        ),
    },
    extra=vol.ALLOW_EXTRA,
)
CONFIG_SCHEMA = vol.Schema(
    {
        vol.Required("spaces"): vol.All([SPACE_SCHEMA], vol.Length(max=MAX_SPACES)),
        vol.Optional("markers", default=list): vol.All([MARKER_SCHEMA], vol.Length(max=MAX_MARKERS)),
        vol.Optional("settings", default=dict): vol.Schema(
            {
                vol.Optional("glow_radius_cm"): vol.All(vol.Coerce(float), vol.Range(min=10, max=10000)),
                # background around the plan, all spaces (a space may override)
                vol.Optional("bg_color"): vol.Match(r"^#[0-9a-fA-F]{6}$"),
                # sun on the plan (docs/SUN.md): global defaults
                vol.Optional("north_deg"): _north_deg,
                vol.Optional("bg_mode"): _BG_MODE,
                vol.Optional("sun_rays"): bool,
                vol.Optional("weather_entity"): vol.Any(None, _TEXT),
                vol.Optional("known_devices"): vol.All([_TEXT], vol.Length(max=MAX_KNOWN_DEVICES)),
                vol.Optional("new_device_ids"): vol.All([_TEXT], vol.Length(max=MAX_KNOWN_DEVICES)),
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
