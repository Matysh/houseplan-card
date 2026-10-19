"""Closed support-v2 wire vocabulary, stdlib only (#942).

This is also shipped with the standalone relay. Parity tests execute both
copies; neither side accepts an opaque diagnostic/config object. A successful
shape check is not an assertion that an observation is current or authorized.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any


class WireRejected(ValueError):
    """No source field/value is reflected in the public error."""


@dataclass(frozen=True)
class Object:
    fields: dict[str, Any]
    required: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Array:
    item: Any
    maximum: int = 100_000
    minimum: int = 0


@dataclass(frozen=True)
class Mapping:
    key: Any
    value: Any
    maximum: int = 100_000


@dataclass(frozen=True)
class Choice:
    items: tuple[Any, ...]


@dataclass(frozen=True)
class Reference:
    kind: str


def enum(*values):
    return ("enum", values)


def nullable(rule):
    return Choice((None, rule))


def fields(names: str, rule):
    return {name: rule for name in names.split()}


NUMBER = "finite"
COUNT = "count"
BOOL = bool
RAW_REF = re.compile(r"[\s\S]{0,1024}\Z")
REF = re.compile(
    r"(?:space|room|area|wall|partition|column|opening|decor|stair|marker|device|entity|attribute|route|map|segment|installation|summary-block|summary-value|radar-slot|led|asset|integration|run|job)-[a-z0-9]{1,16}-[1-9][0-9]*\Z"
)
REF_OR_NULL = nullable(REF)
COLOR = re.compile(
    r"(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba)\([0-9.,% /]+\)|transparent|black|white)\Z"
)
VERSION = re.compile(r"[0-9A-Za-z._+-]{1,32}\Z")
DISPLAY = enum(
    "badge", "ripple", "icon_ripple", "value", "static_icon", "value_static_icon"
)
FILL = enum("none", "lqi", "light", "temp", "custom", "glow")
ACTIVITY = enum("none", "event", "presence", "transition", "running")
SHAPE = enum("numeric", "boolean", "known_enum", "text", "missing", "non_scalar")
FAMILY = enum(
    "dreame_vacuum",
    "xiaomi_cloud_map_extractor",
    "valetudo",
    "roborock",
    "mqtt",
    "zha",
    "esphome",
    "other",
    "unknown",
)
SOURCE_STATUS = enum(
    "ok", "missing", "disabled", "unavailable", "unverified", "unsupported", "none"
)
REASONS = enum(
    "drawable",
    "hidden",
    "static_display",
    "live_disabled",
    "mode_never",
    "stopped",
    "source_missing",
    "source_unavailable",
    "source_disabled",
    "source_unverified",
    "no_telemetry",
    "unmapped",
    "ambiguous",
    "missing_space",
    "needs_calibration",
    "foreign_space",
    "run_source_mismatch",
    "run_route_mismatch",
    "no_path",
    "budget_limited",
    "runtime_unavailable",
)
COVERAGE_REASONS = enum(
    "runtime_not_loaded",
    "revision_mismatch",
    "missing_client",
    "access_denied",
    "collection_limit",
    "geometry_limit",
    "input_limit",
    "unknown_reference",
    "unsupported_version",
    "resource_unobserved",
    "registry_unavailable",
    "not_configured",
)
QUALITY_REASON = enum(
    "sampled",
    "ok",
    "full",
    "limited",
    "run_unverified",
    "coordinates_unverified",
    "invalid",
    "unsupported",
    "unknown",
    "none",
    "timeout",
    "unavailable",
    "stale",
    "empty",
    "empty_integration",
    "error",
)
POINT = Array(NUMBER, 2, 2)
MATRIX = Choice(
    (Array(NUMBER, 6, 6), Object({"status": enum("invalid")}, frozenset({"status"})))
)
FILL_COLOR = Object({"c": COLOR, "a": NUMBER})
VALUE_SOURCE = Object(
    {
        "kind": enum(
            "entity_state", "entity_attribute", "derived_lqi", "derived_marker_state"
        ),
        "entity_id": nullable(Reference("entity")),
        "attribute": nullable(Reference("attribute")),
        "ref": Reference("marker_ref"),
    }
)
VALUE_BADGE = Object(
    {
        "enabled": nullable(BOOL),
        "position": nullable(enum("right", "bottom", "left", "top")),
        "source": nullable(VALUE_SOURCE),
    }
)
ROUTE = Object(
    {**fields("id source map_id space", REF_OR_NULL), "calibration": nullable(MATRIX)}
)
VAC_CONFIG = Object(
    {
        **fields("live trail room_highlight new_run_after_dock", nullable(BOOL)),
        "trail_mode": nullable(enum("never", "cleaning", "always")),
        "source": REF_OR_NULL,
        "map_routes": nullable(Array(ROUTE)),
        "calibration": nullable(Mapping(REF, nullable(MATRIX))),
        "segment_map": nullable(Mapping(REF, REF_OR_NULL)),
    }
)
RADAR_SLOT = Object(
    {
        **fields(
            "id x_entity y_entity distance_entity angle_entity entity_id presence_entity",
            REF_OR_NULL,
        ),
        **fields("swap_xy angle_clockwise", nullable(BOOL)),
        "unit": nullable(enum("mm", "cm", "m", "in", "ft")),
        **fields("x_sign y_sign", nullable(enum(-1, 1))),
        "angle_unit": nullable(enum("degrees", "radians")),
        "angle_zero": nullable(enum("forward", "right")),
        "kind": nullable(enum("occupancy", "count")),
    }
)
RADAR_CONFIG = Object(
    {
        "version": enum(1),
        **fields("enabled show_live", nullable(BOOL)),
        "profile": nullable(
            enum(
                "esphome_ld2450_v1",
                "cartesian_v1",
                "polar_v1",
                "range_v1",
                "zones_v1",
                "presence_v1",
            )
        ),
        "room_id": REF_OR_NULL,
        "allowed_room_ids": Array(REF_OR_NULL),
        "sources": Object(
            {
                **fields(
                    "occupancy_entity count_entity availability_entity", REF_OR_NULL
                ),
                **fields("slots ranges zones", Array(RADAR_SLOT)),
            }
        ),
        "mount": Object(
            {
                "installation_id": REF_OR_NULL,
                **fields("x y heading_deg range_cm fov_deg", nullable(NUMBER)),
            }
        ),
        "calibration": Object(
            {
                "method": nullable(enum("manual", "two_point", "not_required")),
                "mirror": nullable(BOOL),
                **fields("cell_cm rms_cm", nullable(NUMBER)),
                "refs": Array(
                    Object(
                        fields("plan local_cm", Object(fields("x y", nullable(NUMBER))))
                    )
                ),
            }
        ),
    }
)
UNSUPPORTED = Object({"status": enum("unsupported_version")}, frozenset({"status"}))
SUMMARY_SOURCE = Object(
    {
        "type": enum("entity", "system"),
        "entity_id": REF_OR_NULL,
        "key": enum("device_count", "total_area", "datetime"),
    }
)
SUMMARY_CONFIG = Object(
    {
        "version": enum(1),
        "title": enum("[redacted text]"),
        "show_on_mobile": nullable(BOOL),
        "blocks": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "title": enum("[redacted text]"),
                    "visible": nullable(BOOL),
                    "scope": Object(
                        {"type": enum("all", "space"), "space_id": REF_OR_NULL}
                    ),
                    "values": Array(
                        Object(
                            {
                                "id": REF_OR_NULL,
                                "label": enum("[redacted text]"),
                                "source": SUMMARY_SOURCE,
                            }
                        )
                    ),
                }
            )
        ),
    }
)
GLOBAL_SETTINGS = Object(
    {
        **fields("glow_radius_cm north_deg", nullable(NUMBER)),
        **fields("bg_color", nullable(COLOR)),
        "bg_mode": nullable(enum("static", "daynight")),
        "sun_ray_origin": enum("inner", "outer"),
        **fields(
            "sun_rays show_room_tooltip show_lqi volumetric_view moon filter_seeded group_lights",
            nullable(BOOL),
        ),
        "show_device_battery": Choice((None, BOOL, enum("low"))),
        "fill_colors": Object(
            fields(
                "light_on light_off light_none temp_cold temp_ok temp_hot lqi_low lqi_high glow_light wall_fill",
                FILL_COLOR,
            )
        ),
        "decor_default_style": Object(
            {
                **fields("color fill_color", COLOR),
                **fields("opacity width_cm fill_opacity", NUMBER),
                "fill": BOOL,
            }
        ),
        "summary_panel": nullable(Choice((SUMMARY_CONFIG, UNSUPPORTED))),
        "exclude_integrations": Array(REF_OR_NULL),
        "radar": Object({"show_live": nullable(BOOL)}),
    }
)
SPACE_SETTINGS = Object(
    {
        **fields(
            "show_borders show_names glow_enabled show_lqi hide_decor hide_openings label_temp label_hum label_co2 label_lqi label_light sun_rays",
            nullable(BOOL),
        ),
        **fields("room_color bg_color", nullable(COLOR)),
        **fields(
            "room_opacity temp_min temp_max card_font_scale card_name_scale card_label_scale north_deg", nullable(NUMBER)
        ),
        "fill_mode": nullable(FILL),
        "bg_mode": nullable(enum("static", "daynight")),
        "custom_fill": nullable(FILL_COLOR),
        "show_lqi_mode": enum("inherit", "on", "off"),
        "show_device_battery_mode": enum("inherit", "all", "low", "off"),
    }
)
ROOM = Object(
    {
        "id": REF_OR_NULL,
        "name": re.compile(r"Room [0-9]+\Z"),
        "area": REF_OR_NULL,
        **fields("x y w h", NUMBER),
        "poly": Array(POINT),
        "wall_ids": Array(REF_OR_NULL),
        "open_to": Array(REF_OR_NULL),
        "settings": Object(
            {
                "fill_mode": nullable(FILL),
                "custom_fill": nullable(FILL_COLOR),
                "glow": nullable(BOOL),
                **fields("name_scale label_scale temp_min temp_max", nullable(NUMBER)),
                **fields(
                    "temp_source hum_source co2_source",
                    Choice((None, re.compile(r"(?:device|entity):" + REF.pattern))),
                ),
                **fields(
                    "temp_source_kind hum_source_kind co2_source_kind",
                    enum("device", "entity", "virtual", "unknown"),
                ),
            }
        ),
    }
)
DECOR = Object(
    {
        "id": REF_OR_NULL,
        "kind": enum(
            "line", "rect", "ellipse", "text", "furniture", "image", "unknown"
        ),
        **fields("color fill_color", nullable(COLOR)),
        **fields(
            "opacity width_cm width x1 y1 x2 y2 x y w h angle fill_opacity size_cm scale",
            nullable(NUMBER),
        ),
        "size": Choice((NUMBER, enum("s", "m", "l"))),
        **fields("fill flip_h flip_v has_resource", nullable(BOOL)),
        "line_style": enum("solid", "dashed"),
        "symbol": re.compile(r"[a-z0-9_-]{1,80}\Z"),
        "text": enum("[redacted text]"),
        **fields("entity attr asset_id", REF_OR_NULL),
    }
)
SPACE = Object(
    {
        "id": REF_OR_NULL,
        "title": re.compile(r"Space [0-9]+\Z"),
        "has_plan": BOOL,
        **fields(
            "cell_cm plan_aspect plan_x plan_y plan_scale plan_scale_x plan_scale_y plan_angle plan_opacity",
            nullable(NUMBER),
        ),
        "view_box": Array(NUMBER, 4, 4),
        "zero_wall_style": enum("dashed", "solid"),
        "settings": SPACE_SETTINGS,
        "rooms": Array(ROOM),
        "wall_segments": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "a": nullable(POINT),
                    "b": nullable(POINT),
                    "cm": nullable(NUMBER),
                }
            )
        ),
        "walls": Array(
            Object(
                {
                    "key": REF_OR_NULL,
                    "a": nullable(POINT),
                    "b": nullable(POINT),
                    "cm": nullable(NUMBER),
                }
            )
        ),
        "partitions": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "a": nullable(POINT),
                    "b": nullable(POINT),
                    "cm": nullable(NUMBER),
                }
            )
        ),
        "wall_columns": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "shape": enum("square", "circle"),
                    "center": POINT,
                    "cm": NUMBER,
                    "angle": NUMBER,
                }
            )
        ),
        "openings": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "type": enum("door", "window", "gate", "passage"),
                    **fields("x y angle length", NUMBER),
                    **fields("invert flip_h flip_v", BOOL),
                    **fields("contact lock", REF_OR_NULL),
                    "host": Object(
                        {
                            "kind": enum("wall", "partition"),
                            "id": REF_OR_NULL,
                            "t": NUMBER,
                        }
                    ),
                }
            )
        ),
        "decor": Array(DECOR),
        "stairs": Array(
            Object(
                {
                    "id": REF_OR_NULL,
                    "kind": enum("straight", "spiral"),
                    **fields(
                        "x y angle length width radius opacity fill_opacity", NUMBER
                    ),
                    "direction": enum(
                        "forward", "backward", "clockwise", "counterclockwise"
                    ),
                    **fields("color fill_color", COLOR),
                    "target_space_id": REF_OR_NULL,
                }
            )
        ),
        "open_spans": Array(Object(fields("a b", nullable(POINT)))),
        "led_strips": Array(
            Object(
                {
                    **fields("id marker", REF_OR_NULL),
                    "active": nullable(BOOL),
                    "points": Array(POINT),
                }
            )
        ),
    }
)
MARKER = Object(
    {
        "id": REF_OR_NULL,
        "binding_kind": enum("device", "entity", "virtual", "unknown"),
        "binding": Choice(
            (
                enum("virtual", "unknown"),
                re.compile(r"(?:device|entity):" + REF.pattern),
            )
        ),
        **fields(
            "hidden removed tap_confirm is_light use_climate_temp hide_battery hide_signal",
            nullable(BOOL),
        ),
        **fields("ripple_size size angle glow_radius_cm", nullable(NUMBER)),
        "tap_action": nullable(
            enum("toggle", "card", "info", "more-info", "run", "cover", "none", "link")
        ),
        "display": nullable(DISPLAY),
        "ripple_color": nullable(COLOR),
        "glow_color": nullable(Object({"c": COLOR, "bri": nullable(NUMBER)})),
        "icon": re.compile(r"mdi:[a-z0-9-]{1,80}\Z"),
        **fields(
            "space room_id area light_entity toggle_entity tap_target", REF_OR_NULL
        ),
        "controls": nullable(
            Array(nullable(Choice((Reference("entity"), Reference("marker_ref")))))
        ),
        "vacuum": nullable(VAC_CONFIG),
        "value_source": nullable(VALUE_SOURCE),
        "value_badge": nullable(VALUE_BADGE),
        "radar": nullable(Choice((RADAR_CONFIG, UNSUPPORTED))),
    }
)
CONFIG = Object(
    {
        "model_version": COUNT,
        "settings": GLOBAL_SETTINGS,
        "spaces": Array(SPACE),
        "markers": Array(MARKER),
    },
    frozenset({"model_version", "settings", "spaces", "markers"}),
)
LAYOUT = Mapping(
    Choice((REF, re.compile(r"rl_" + REF.pattern))),
    Object({**fields("x y k", NUMBER), "s": REF_OR_NULL}),
)

TIME = Object(
    {"state": enum("valid", "null", "invalid", "missing"), "age_s": NUMBER},
    frozenset({"state"}),
)
SAMPLE = Object(
    {
        "status": enum("available", "unavailable"),
        **fields(
            "raw_points valid_points invalid_points kept_points total_fragments", COUNT
        ),
        **fields("scan_limited truncated", BOOL),
        "fragments": Array(
            Object(
                {**fields("fragment start end", COUNT), "points": Array(POINT, 4096)}
            ),
            256,
        ),
    },
    frozenset(
        {
            "status",
            "raw_points",
            "valid_points",
            "invalid_points",
            "kept_points",
            "total_fragments",
            "scan_limited",
            "truncated",
            "fragments",
        }
    ),
)
RUN = Object(
    {
        **fields("map_id source route_id generation job", REF_OR_NULL),
        "format": COUNT,
        **fields("started ended received last_sample", TIME),
        "sample": SAMPLE,
        "final": enum("confirmed", "unconfirmed", "unknown"),
        **fields("revision_present gap_pending last_good_retained", BOOL),
        "quality": Object(
            {
                "source": enum("native", "positions", "unknown"),
                "reason": QUALITY_REASON,
                **fields("raw_points stored_points", COUNT),
            }
        ),
        "provenance": Object(
            {
                "provider": enum("dreame", "attributes", "unknown"),
                "schema": enum("tasshack-2.0.2", "full-path-v1", "unknown"),
                "final_capability": enum("unknown", "explicit", "unconfirmed"),
            }
        ),
    }
)
VALUE_RESULT = Object(
    {
        "source": nullable(VALUE_SOURCE),
        "shape": SHAPE,
        "outcome": enum("value", "icon", "fallback", "unavailable", "none"),
        "attribute_present": BOOL,
    }
)
DEVICE_CLIENT = Object(
    {
        "id": Reference("marker"),
        "binding": Reference("binding"),
        **{
            key: nullable(Reference(kind))
            for key, kind in {
                "area": "area",
                "space": "space",
                "room": "room",
                "primary": "entity",
            }.items()
        },
        "entities": Array(Reference("entity"), 512),
        "binding_status": enum(
            "active", "ha_disabled", "orphaned", "unverified", "unknown"
        ),
        "placement": enum("explicit_room", "area", "unmapped", "unknown"),
        "display": DISPLAY,
        "source_kind": enum(
            "cover", "light", "controls", "device_role", "primary", "none"
        ),
        "sources": Array(Reference("target"), 512),
        "availability": enum("available", "unavailable"),
        "status": enum("neutral", "open", "working", "alarm"),
        "activity": ACTIVITY,
        "pulse_kind": enum("none", "alarm", "short", "continuous"),
        "pulse_reason": enum(
            "none", "alarm", "event", "presence", "transition", "running"
        ),
        "tap_action": enum("info", "more-info", "toggle", "run", "none"),
        **fields("hidden ha_disabled orphaned vacuum_live", BOOL),
        "face": VALUE_RESULT,
        "badge": VALUE_RESULT,
        "action": Object(
            {
                "kind": enum("none", "single", "group"),
                "reason": nullable(
                    enum(
                        "no-binding",
                        "no-actionable-entity",
                        "configured-targets-missing",
                        "ha-disabled",
                        "unavailable",
                        "unsupported",
                        "secure",
                    )
                ),
                "next": nullable(
                    enum("turn-on", "turn-off", "open", "close", "stop", "toggle")
                ),
                "targets": Array(Reference("target"), 512),
                "skipped": Array(
                    Object(
                        {
                            "ref": nullable(Reference("target")),
                            "reason": enum(
                                "missing",
                                "ha-disabled",
                                "unavailable",
                                "unsupported",
                                "secure",
                            ),
                        }
                    ),
                    512,
                ),
            }
        ),
    },
    frozenset({"id", "binding"}),
)
VAC_CLIENT = Object(
    {
        "marker": Reference("marker"),
        "source": nullable(Reference("entity")),
        "effective_source": nullable(Reference("entity")),
        "source_status": SOURCE_STATUS,
        "resolution": enum(
            "ready",
            "needs_calibration",
            "unmapped",
            "ambiguous",
            "missing_space",
            "none",
        ),
        **{
            key: nullable(Reference(kind))
            for key, kind in {
                "space": "space",
                "route": "route",
                "map_id": "map",
            }.items()
        },
        **fields("current_matches previous_visible moving live", BOOL),
        "mode": enum("never", "cleaning", "always"),
        "reasons": Array(REASONS, 24),
        **fields("raw stored rendered", COUNT),
        "trail_source": enum(
            "native", "positions", "integration", "server", "local", "none"
        ),
        "trail_reason": QUALITY_REASON,
        "position": nullable(POINT),
        "local": SAMPLE,
        "candidates": Array(
            Object(
                {
                    "source": Reference("entity"),
                    "status": SOURCE_STATUS,
                    "family": FAMILY,
                    **fields(
                        "same_device selected has_position has_rooms has_path has_map_id",
                        BOOL,
                    ),
                }
            ),
            16,
        ),
        "rooms": Array(
            Object(
                {
                    "id": Reference("segment"),
                    "anchor": POINT,
                    "bounds": Array(NUMBER, 4, 4),
                    "plan_room": nullable(Reference("room")),
                }
            ),
            256,
        ),
    },
    frozenset({"marker"}),
)
RESOURCE = Object(
    {
        "kind": enum("plan", "decor_image"),
        **{key: nullable(Reference(key)) for key in ("space", "decor", "asset")},
        "status": enum("present", "loaded", "error", "unobserved", "missing"),
    }
)
ROOM_FACT = Object(
    {
        **{key: nullable(Reference(key)) for key in ("space", "room")},
        "fill": FILL,
        **fields("glow sun_rays", BOOL),
        "fill_origin": enum("room", "space", "default"),
        "glow_origin": enum("room", "space", "default"),
    }
)
ENVIRONMENT = Object(
    {
        "mode": enum("view", "plan", "devices", "decor"),
        "projection": enum("flat", "iso"),
        "space": nullable(Reference("space")),
        **fields("write_pending accepted", BOOL),
        "recovery": enum("live", "holding", "recovering", "blocked", "unknown"),
        "resources": Array(RESOURCE, 2000),
        "rooms": Array(ROOM_FACT, 2000),
        "panel": Object(
            {
                "status": enum(
                    "loaded",
                    "runtime_not_loaded",
                    "unsupported_version",
                    "not_configured",
                ),
                **fields("shown mobile_allowed mobile", BOOL),
                "values": Array(
                    Object(
                        {
                            "block": Reference("summary-block"),
                            "value": Reference("summary-value"),
                            "shape": SHAPE,
                            "reason": enum(
                                "visible",
                                "hidden_block",
                                "foreign_space",
                                "missing_source",
                                "unavailable",
                                "runtime_unavailable",
                            ),
                        }
                    ),
                    2000,
                ),
            }
        ),
    }
)
CLIENT = Object(
    {
        "schema": enum(1),
        **fields("config_rev layout_rev", COUNT),
        "age_ms": NUMBER,
        "devices": Array(DEVICE_CLIENT, 2000),
        "vacuums": Array(VAC_CLIENT, 32),
        "environment": ENVIRONMENT,
        "limited": BOOL,
    },
    frozenset(
        {
            "schema",
            "config_rev",
            "layout_rev",
            "devices",
            "vacuums",
            "environment",
            "limited",
        }
    ),
)


def raw_references(rule):
    """The browser submits bounded raw references; only the server anonymizes."""
    if isinstance(rule, Reference):
        return RAW_REF
    if isinstance(rule, Object):
        return Object(
            {key: raw_references(child) for key, child in rule.fields.items()},
            rule.required,
        )
    if isinstance(rule, Array):
        return Array(raw_references(rule.item), rule.maximum, rule.minimum)
    if isinstance(rule, Mapping):
        return Mapping(
            raw_references(rule.key), raw_references(rule.value), rule.maximum
        )
    if isinstance(rule, Choice):
        return Choice(tuple(raw_references(child) for child in rule.items))
    return rule


CLIENT_INPUT = raw_references(CLIENT)
ENTITY_FACT = Object(
    {
        "id": REF,
        "exists": nullable(BOOL),
        "disabled": nullable(BOOL),
        "availability": enum(
            "available",
            "unknown",
            "unavailable",
            "missing",
            "unverified",
            "access_denied",
        ),
        "shape": SHAPE,
        "family": FAMILY,
        "integration": REF_OR_NULL,
        "state": enum(
            "on",
            "off",
            "open",
            "closed",
            "locked",
            "unlocked",
            "cleaning",
            "returning",
            "docked",
            "paused",
            "idle",
            "unavailable",
            "unknown",
            "other",
        ),
        "attributes": Array(Object({"id": REF, "present": BOOL, "shape": SHAPE}), 64),
    }
)
VAC_SERVER = Object(
    {
        "marker": REF,
        "vacuum_entity": REF_OR_NULL,
        "status": enum(
            "available", "access_denied", "runtime_unavailable", "unsupported_version"
        ),
        "activity": enum("moving", "stopped", "unknown", "unavailable", "missing"),
        "sources": Array(
            Object(
                {
                    "source": REF,
                    "map_id": REF_OR_NULL,
                    "position": nullable(POINT),
                    "input": SAMPLE,
                    "family": FAMILY,
                    "version": VERSION,
                }
            ),
            64,
        ),
        "current": nullable(RUN),
        "previous": nullable(RUN),
        "client": VAC_CLIENT,
    }
)
DIAGNOSTICS = Object(
    {
        "schema": enum(1),
        "snapshot": Object(
            {
                **fields("config_rev layout_rev", COUNT),
                "client_status": enum(
                    "matched", "revision_mismatch", "missing", "pending"
                ),
                **fields("client_config_rev client_layout_rev", COUNT),
                "client_age_ms": NUMBER,
                "parts": Array(
                    Object(
                        {
                            "part": enum("config", "states", "trails", "frontend"),
                            "status": enum("available", "unavailable", "unverified"),
                            "age_s": NUMBER,
                        }
                    ),
                    4,
                ),
            },
            frozenset({"config_rev", "layout_rev", "client_status", "parts"}),
        ),
        "coverage": Array(
            Object(
                {
                    "category": enum("config", "devices", "vacuums", "environment"),
                    "status": enum(
                        "complete",
                        "partial",
                        "unavailable",
                        "not_applicable",
                        "unsupported_version",
                    ),
                    "reasons": Array(COVERAGE_REASONS, 16),
                    **fields("observed total", COUNT),
                },
                frozenset({"category", "status", "reasons", "observed", "total"}),
            ),
            4,
            4,
        ),
        "devices": Object(
            {
                "entities": Array(ENTITY_FACT, 8192),
                "client": Array(DEVICE_CLIENT, 2000),
                "total_entities": COUNT,
            }
        ),
        "vacuums": Array(VAC_SERVER, 32),
        "environment": ENVIRONMENT,
    },
    frozenset({"schema", "snapshot", "coverage", "devices", "vacuums", "environment"}),
)

PACKAGE = Object(
    {
        "format": enum("houseplan-support-package"),
        "version": enum(2),
        "versions": Object(
            {
                **fields("card integration home_assistant", VERSION),
                **fields("model export_schema", COUNT),
            }
        ),
        "runtime": Object(
            {
                "browser_family": enum("chromium", "firefox", "webkit", "unknown"),
                "browser_major": COUNT,
                "language": enum("en", "ru", "de", "fr"),
                **fields("coarse_pointer hover_capable", BOOL),
                "registry_access": enum("full", "partial", "unavailable"),
                "registry_age_bucket": enum("fresh", "stale", "unknown"),
            }
        ),
        "revisions": Object(fields("config layout", COUNT)),
        "summary": Object(
            {
                **fields(
                    "spaces rooms walls partitions columns stairs layout_entries", COUNT
                ),
                "openings": Object(fields("door window gate passage unknown", COUNT)),
                "decor": Object(
                    fields("line rect ellipse text furniture image unknown", COUNT)
                ),
                "markers": Object(
                    {
                        "total": COUNT,
                        "lifecycle": Object(fields("active hidden removed", COUNT)),
                        "binding": Object(
                            fields("device entity virtual unknown", COUNT)
                        ),
                    }
                ),
                "led_strips": Object(fields("total unbound hidden", COUNT)),
            }
        ),
        "validation": Object(
            {
                **fields("config layout", enum("valid")),
                "unknown_fields": enum("dropped"),
            }
        ),
        "repairs": Array(
            Object({"code": re.compile(r"[a-z][a-z0-9_]{0,63}\Z"), "count": COUNT}),
            1024,
        ),
        "plan_backup": Object(
            {"config": CONFIG, "layout": LAYOUT}, frozenset({"config", "layout"})
        ),
        "diagnostics": DIAGNOSTICS,
        "build": Object(
            {"channel": enum("dev"), "source": re.compile(r"[0-9a-f]{40}\Z")},
            frozenset({"channel", "source"}),
        ),
    },
    frozenset(
        {
            "format",
            "version",
            "versions",
            "runtime",
            "revisions",
            "summary",
            "validation",
            "repairs",
            "plan_backup",
            "diagnostics",
        }
    ),
)


def validate(
    value: object,
    rule: Any,
    *,
    depth: int = 0,
    max_depth: int = 24,
    _remaining: list[int] | None = None,
) -> None:
    remaining = _remaining if _remaining is not None else [4_000_000]
    remaining[0] -= 1
    if depth > max_depth or remaining[0] < 0:
        raise WireRejected("support_rejected")
    if isinstance(rule, Reference):
        if rule.kind == "binding":
            if value in ("virtual", "unknown"):
                return
            if not isinstance(value, str) or not re.fullmatch(
                r"(?:device|entity):" + REF.pattern, value
            ):
                raise WireRejected("support_rejected")
        elif rule.kind == "marker_ref":
            if not isinstance(value, str) or not value.startswith("marker:marker-"):
                raise WireRejected("support_rejected")
            validate(value[7:], REF, depth=depth, _remaining=remaining)
        else:
            validate(value, REF, depth=depth, _remaining=remaining)
            kinds = ("entity", "marker") if rule.kind == "target" else (rule.kind,)
            if not any(value.startswith(kind + "-") for kind in kinds):
                raise WireRejected("support_rejected")
        return
    if isinstance(rule, Choice):
        for item in rule.items:
            try:
                validate(
                    value, item, depth=depth, max_depth=max_depth, _remaining=remaining
                )
                return
            except WireRejected:
                pass
        raise WireRejected("support_rejected")
    if isinstance(rule, Object):
        if (
            not isinstance(value, dict)
            or set(value) - rule.fields.keys()
            or not rule.required <= value.keys()
        ):
            raise WireRejected("support_rejected")
        for key, child in value.items():
            validate(
                child,
                rule.fields[key],
                depth=depth + 1,
                max_depth=max_depth,
                _remaining=remaining,
            )
    elif isinstance(rule, Array):
        if (
            not isinstance(value, list)
            or not rule.minimum <= len(value) <= rule.maximum
        ):
            raise WireRejected("support_rejected")
        for child in value:
            validate(
                child,
                rule.item,
                depth=depth + 1,
                max_depth=max_depth,
                _remaining=remaining,
            )
    elif isinstance(rule, Mapping):
        if not isinstance(value, dict) or len(value) > rule.maximum:
            raise WireRejected("support_rejected")
        for key, child in value.items():
            validate(
                key,
                rule.key,
                depth=depth + 1,
                max_depth=max_depth,
                _remaining=remaining,
            )
            validate(
                child,
                rule.value,
                depth=depth + 1,
                max_depth=max_depth,
                _remaining=remaining,
            )
    elif isinstance(rule, re.Pattern):
        if not isinstance(value, str) or len(value) > 1024 or not rule.fullmatch(value):
            raise WireRejected("support_rejected")
    elif isinstance(rule, tuple) and rule[0] == "enum":
        if not any(type(value) is type(item) and value == item for item in rule[1]):
            raise WireRejected("support_rejected")
    elif rule is None:
        if value is not None:
            raise WireRejected("support_rejected")
    elif rule is BOOL:
        if not isinstance(value, bool):
            raise WireRejected("support_rejected")
    elif rule == COUNT:
        if type(value) is not int or value < 0 or value > 2**53 - 1:
            raise WireRejected("support_rejected")
    elif rule == NUMBER:
        try:
            valid = type(value) in (int, float) and math.isfinite(value)
        except OverflowError:
            valid = False
        if not valid:
            raise WireRejected("support_rejected")
    else:
        raise WireRejected("support_rejected")


def canonical_bytes(value: object, maximum: int) -> bytes:
    try:
        raw = (
            json.dumps(
                value,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            )
            + "\n"
        ).encode()
    except (ValueError, TypeError, OverflowError, RecursionError) as error:
        raise WireRejected("support_rejected") from error
    if len(raw) > maximum:
        raise WireRejected("support_package_too_large")
    return raw


def validate_client(value: object) -> dict:
    validate(value, CLIENT_INPUT, max_depth=12, _remaining=[300_000])
    canonical_bytes(value, 512 * 1024)
    return value


def anonymize_client(value: object, ids, rule=CLIENT):
    """Only schema-identified references can carry raw strings into this step."""
    if isinstance(rule, Reference):
        kind = rule.kind
        if kind == "binding":
            if value in ("virtual", "unknown"):
                return value
            binding_kind, separator, raw = value.partition(":")
            if not separator or binding_kind not in ("device", "entity"):
                raise WireRejected("support_rejected")
            return binding_kind + ":" + ids.get(binding_kind, raw)
        if kind == "marker_ref":
            return "marker:" + ids.get("marker", value.removeprefix("marker:"))
        if kind == "target":
            prefix, separator, raw = value.partition(":")
            return (
                ids.get("marker", raw)
                if separator and prefix == "marker"
                else ids.get("entity", value)
            )
        return ids.get(kind, value)
    if isinstance(rule, Choice):
        for item in rule.items:
            try:
                validate(value, raw_references(item))
                return anonymize_client(value, ids, item)
            except WireRejected:
                continue
        raise WireRejected("support_rejected")
    if isinstance(rule, Object):
        return {
            key: anonymize_client(child, ids, rule.fields[key])
            for key, child in value.items()
        }
    if isinstance(rule, Array):
        return [anonymize_client(child, ids, rule.item) for child in value]
    return value


def validate_package(value: object) -> None:
    validate(value, PACKAGE)
    canonical_bytes(value, 8 * 1024 * 1024)
    diagnostic = value["diagnostics"]
    canonical_bytes(diagnostic, 2 * 1024 * 1024)
    categories = [row["category"] for row in diagnostic["coverage"]]
    if len(set(categories)) != 4:
        raise WireRejected("support_rejected")
    for row in diagnostic["coverage"]:
        if row["observed"] > row["total"]:
            raise WireRejected("support_rejected")
    points = fragments = 0

    def visit(node):
        nonlocal points, fragments
        if isinstance(node, list):
            for item in node:
                visit(item)
        elif isinstance(node, dict):
            if "kept_points" in node and "fragments" in node:
                actual = sum(len(row["points"]) for row in node["fragments"])
                if actual != node["kept_points"] or actual > node["valid_points"]:
                    raise WireRejected("support_rejected")
                for row in node["fragments"]:
                    if row["end"] - row["start"] != len(row["points"]):
                        raise WireRejected("support_rejected")
                points += actual
                fragments += len(node["fragments"])
            for item in node.values():
                visit(item)

    visit(diagnostic)
    if points > 4096 or fragments > 256:
        raise WireRejected("support_rejected")
