"""Strict, allowlisted House Plan support-package projection (#43).

This module deliberately has no Home Assistant imports.  Besides making the
privacy boundary easy to test, that prevents an innocent serializer helper from
gaining access to registries, states, URLs or paths that the package must never
contain.  The caller supplies one coherent config/layout copy and bounded,
already-classified runtime facts; this code constructs a new object field by
field.  It never serializes the source and then tries to redact it.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from .const import (
    EXPORT_VERSION,
    MAX_SUPPORT_ATTACHMENT_BYTES,
    PLAN_MODEL_VERSION,
)

PACKAGE_FORMAT = "houseplan-support-package"
PACKAGE_VERSION = 1
_SAFE_VERSION = re.compile(r"\A[0-9A-Za-z._+-]{1,32}\Z")
_SAFE_ICON = re.compile(r"\Amdi:[a-z0-9-]{1,80}\Z")
_LANGUAGES = frozenset({"en", "ru", "de", "fr"})
_BROWSERS = frozenset({"chromium", "firefox", "webkit", "unknown"})
_REGISTRY_ACCESS = frozenset({"full", "partial", "unavailable"})
_REGISTRY_AGE = frozenset({"fresh", "stale", "unknown"})
_VALUE_BADGE_POSITIONS = frozenset({"right", "bottom", "left", "top"})


class SupportPackageError(ValueError):
    """A stable public failure without source data in its text."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _safe_version(value: object) -> str:
    text = str(value or "unknown")
    return text if _SAFE_VERSION.fullmatch(text) else "unknown"


def validate_frontend_facts(value: object) -> dict[str, Any]:
    """Accept only the small runtime enum/boolean contract from the browser."""
    if not isinstance(value, dict):
        raise SupportPackageError("support_rejected")
    browser = value.get("browser_family")
    language = value.get("language")
    registry = value.get("registry_access")
    age = value.get("registry_age_bucket")
    major = value.get("browser_major")
    if browser not in _BROWSERS or language not in _LANGUAGES:
        raise SupportPackageError("support_rejected")
    if registry not in _REGISTRY_ACCESS or age not in _REGISTRY_AGE:
        raise SupportPackageError("support_rejected")
    if isinstance(major, bool) or not isinstance(major, int) or not 0 <= major <= 999:
        raise SupportPackageError("support_rejected")
    for key in ("coarse_pointer", "hover_capable"):
        if not isinstance(value.get(key), bool):
            raise SupportPackageError("support_rejected")
    return {
        "browser_family": browser,
        "browser_major": major,
        "language": language,
        "coarse_pointer": value["coarse_pointer"],
        "hover_capable": value["hover_capable"],
        "registry_access": registry,
        "registry_age_bucket": age,
    }


@dataclass
class _Pseudonyms:
    namespace: str
    maps: dict[str, dict[str, str]] = field(default_factory=dict)

    def get(self, kind: str, raw: object) -> str | None:
        if raw is None:
            return None
        value = str(raw)
        if not value:
            return None
        items = self.maps.setdefault(kind, {})
        if value not in items:
            items[value] = f"{kind}-{self.namespace}-{len(items) + 1}"
        return items[value]


def _copy_keys(source: object, keys: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(source, dict):
        return {}
    return {key: source[key] for key in keys if key in source}


def _point(value: object) -> list[float] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        return None
    if any(isinstance(item, bool) or not isinstance(item, (int, float)) for item in value):
        return None
    return [value[0], value[1]]


def _points(value: object) -> list[list[float]]:
    if not isinstance(value, list):
        return []
    return [point for item in value if (point := _point(item)) is not None]


def _entity_ref(ids: _Pseudonyms, value: object) -> str | None:
    return ids.get("entity", value)


def _binding(ids: _Pseudonyms, value: object) -> tuple[str, str]:
    text = str(value or "")
    if text == "virtual":
        return "virtual", "virtual"
    kind, separator, raw = text.partition(":")
    if separator and kind in {"device", "entity"} and raw:
        # Reuse the same per-kind namespace as controls/value sources so one
        # raw entity remains one pseudonym everywhere in this package.
        pseudo = ids.get(kind, raw)
        return kind, f"{kind}:{pseudo}"
    return "unknown", "unknown"


def _custom_fill(value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return _copy_keys(value, ("c", "a"))


def _global_settings(value: object) -> dict[str, Any]:
    out = _copy_keys(value, ("glow_radius_cm", "bg_color", "north_deg", "bg_mode", "sun_rays"))
    if not isinstance(value, dict):
        return out
    fill_colors = value.get("fill_colors")
    if isinstance(fill_colors, dict):
        out["fill_colors"] = {
            str(key): _copy_keys(item, ("c", "a"))
            for key, item in fill_colors.items()
            if isinstance(key, str) and isinstance(item, dict)
        }
    style = value.get("decor_default_style")
    if isinstance(style, dict):
        out["decor_default_style"] = _copy_keys(
            style, ("color", "opacity", "width_cm", "fill", "fill_color", "fill_opacity"),
        )
    return out


def _space_settings(value: object) -> dict[str, Any]:
    out = _copy_keys(value, (
        "show_borders", "show_names", "room_color", "bg_color", "room_opacity",
        "fill_mode", "glow_enabled", "temp_min", "temp_max", "show_lqi",
        "hide_decor", "hide_openings", "label_temp", "label_hum", "label_lqi",
        "label_light", "card_font_scale", "north_deg", "bg_mode", "sun_rays",
    ))
    if isinstance(value, dict) and "custom_fill" in value:
        out["custom_fill"] = _custom_fill(value.get("custom_fill"))
    return out


def _room_settings(ids: _Pseudonyms, value: object) -> dict[str, Any]:
    out = _copy_keys(value, ("fill_mode", "glow", "name_scale", "label_scale"))
    if not isinstance(value, dict):
        return out
    if "custom_fill" in value:
        out["custom_fill"] = _custom_fill(value.get("custom_fill"))
    for key in ("temp_source", "hum_source"):
        source = value.get(key)
        if source:
            kind, pseudo = _binding(ids, source)
            out[key] = pseudo
            out[f"{key}_kind"] = kind
    return out


def _project_room(ids: _Pseudonyms, room: dict[str, Any], index: int) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": ids.get("room", room.get("id")),
        "name": f"Room {index}",
    }
    out.update(_copy_keys(room, ("x", "y", "w", "h")))
    if "poly" in room:
        out["poly"] = _points(room.get("poly"))
    if isinstance(room.get("wall_ids"), list):
        out["wall_ids"] = [ids.get("wall", item) for item in room["wall_ids"]]
    if isinstance(room.get("open_to"), list):
        out["open_to"] = [ids.get("room", item) for item in room["open_to"]]
    settings = _room_settings(ids, room.get("settings"))
    if settings:
        out["settings"] = settings
    return out


def _project_decor(ids: _Pseudonyms, item: dict[str, Any]) -> dict[str, Any]:
    kind = str(item.get("kind") or "unknown")
    out: dict[str, Any] = {"id": ids.get("decor", item.get("id")), "kind": kind}
    out.update(_copy_keys(item, (
        "color", "opacity", "width_cm", "width", "x1", "y1", "x2", "y2",
        "line_style", "x", "y", "w", "h", "angle", "fill", "fill_color",
        "fill_opacity", "size", "size_cm", "scale", "symbol", "flip_h", "flip_v",
    )))
    if kind == "text":
        out["text"] = "[redacted text]"
        if item.get("entity"):
            out["entity"] = _entity_ref(ids, item.get("entity"))
    return out


def _project_value_source(ids: _Pseudonyms, value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    kind = value.get("kind")
    if kind in {"entity_state", "entity_attribute"}:
        out: dict[str, Any] = {"kind": kind, "entity_id": _entity_ref(ids, value.get("entity_id"))}
        # Attribute names can be arbitrary user strings and are not needed to
        # reproduce geometry or marker placement, so they are deliberately absent.
        return out
    if kind == "derived_lqi":
        return {"kind": kind}
    if kind == "derived_marker_state":
        raw = str(value.get("ref") or "")
        marker = raw[7:] if raw.startswith("marker:") else raw
        return {"kind": kind, "ref": f"marker:{ids.get('marker', marker)}"}
    return None


def _project_value_badge(ids: _Pseudonyms, value: object) -> dict[str, Any] | None:
    """Project the compatibility-tolerant badge config into safe scalar fields."""
    if not isinstance(value, dict):
        return None
    out: dict[str, Any] = {}
    enabled = value.get("enabled")
    if isinstance(enabled, bool):
        out["enabled"] = enabled
    position = value.get("position")
    if isinstance(position, str) and position in _VALUE_BADGE_POSITIONS:
        out["position"] = position
    source = _project_value_source(ids, value.get("source"))
    if source is not None:
        out["source"] = source
    return out or None


def _project_marker(ids: _Pseudonyms, marker: dict[str, Any]) -> dict[str, Any]:
    binding_kind, binding = _binding(ids, marker.get("binding"))
    out: dict[str, Any] = {
        "id": ids.get("marker", marker.get("id")),
        "binding": binding,
        "binding_kind": binding_kind,
    }
    out.update(_copy_keys(marker, (
        "hidden", "removed", "tap_action", "tap_confirm", "display", "ripple_color",
        "ripple_size", "size", "angle", "glow_radius_cm", "glow_color", "is_light",
        "use_climate_temp",
    )))
    icon = marker.get("icon")
    if isinstance(icon, str) and _SAFE_ICON.fullmatch(icon):
        out["icon"] = icon
    if marker.get("space"):
        out["space"] = ids.get("space", marker.get("space"))
    if marker.get("room_id"):
        out["room_id"] = ids.get("room", marker.get("room_id"))
    for key in ("light_entity", "toggle_entity", "tap_target"):
        if marker.get(key):
            out[key] = _entity_ref(ids, marker.get(key))
    controls = marker.get("controls")
    if isinstance(controls, list):
        out["controls"] = [_entity_ref(ids, value) for value in controls]
    vacuum = marker.get("vacuum")
    if isinstance(vacuum, dict):
        out["vacuum"] = _copy_keys(vacuum, ("live", "trail", "trail_mode", "room_highlight"))
    for key in ("value_source",):
        projected = _project_value_source(ids, marker.get(key))
        if projected:
            out[key] = projected
    safe_badge = _project_value_badge(ids, marker.get("value_badge"))
    if safe_badge is not None:
        out["value_badge"] = safe_badge
    return out


def _project_space(ids: _Pseudonyms, space: dict[str, Any], index: int) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": ids.get("space", space.get("id")),
        "title": f"Space {index}",
        "has_plan": bool(space.get("plan_url")),
    }
    out.update(_copy_keys(space, (
        "cell_cm", "plan_aspect", "plan_x", "plan_y", "plan_scale", "plan_scale_x",
        "plan_scale_y", "plan_angle", "view_box", "zero_wall_style",
    )))
    settings = _space_settings(space.get("settings"))
    if settings:
        out["settings"] = settings

    out["rooms"] = [
        _project_room(ids, room, room_index)
        for room_index, room in enumerate(space.get("rooms") or [], 1)
        if isinstance(room, dict)
    ]
    out["wall_segments"] = [
        {
            "id": ids.get("wall", item.get("id")),
            "a": _point(item.get("a")), "b": _point(item.get("b")), "cm": item.get("cm"),
        }
        for item in space.get("wall_segments") or [] if isinstance(item, dict)
    ]
    out["walls"] = [
        {
            "key": ids.get("wall", item.get("key")), "cm": item.get("cm"),
            **({"a": _point(item.get("a")), "b": _point(item.get("b"))}
               if "a" in item and "b" in item else {}),
        }
        for item in space.get("walls") or [] if isinstance(item, dict)
    ]
    out["room_drafts"] = []
    for draft in space.get("room_drafts") or []:
        if not isinstance(draft, dict):
            continue
        out["room_drafts"].append({
            "id": ids.get("draft", draft.get("id")),
            "points": _points(draft.get("points")),
            "segments": [
                {
                    **({"id": ids.get("wall", segment.get("id"))} if segment.get("id") else {}),
                    "cm": segment.get("cm"),
                }
                for segment in draft.get("segments") or [] if isinstance(segment, dict)
            ],
        })
    out["partitions"] = [
        {"id": ids.get("partition", item.get("id")), "a": _point(item.get("a")),
         "b": _point(item.get("b")), "cm": item.get("cm")}
        for item in space.get("partitions") or [] if isinstance(item, dict)
    ]
    out["wall_columns"] = [
        {"id": ids.get("column", item.get("id")), **_copy_keys(item, ("shape", "center", "cm", "angle"))}
        for item in space.get("wall_columns") or [] if isinstance(item, dict)
    ]
    out["openings"] = []
    for opening in space.get("openings") or []:
        if not isinstance(opening, dict):
            continue
        projected = {"id": ids.get("opening", opening.get("id"))}
        projected.update(_copy_keys(opening, (
            "type", "x", "y", "angle", "length", "invert", "flip_h", "flip_v",
        )))
        for key in ("contact", "lock"):
            if opening.get(key):
                projected[key] = _entity_ref(ids, opening.get(key))
        host = opening.get("host")
        if isinstance(host, dict) and host.get("kind") in {"wall", "partition"}:
            kind = host["kind"]
            projected["host"] = {
                "kind": kind,
                "id": ids.get(kind, host.get("id")),
                "t": host.get("t"),
            }
        out["openings"].append(projected)
    out["decor"] = [
        _project_decor(ids, item) for item in space.get("decor") or [] if isinstance(item, dict)
    ]
    out["open_spans"] = [
        {"a": _point(item.get("a")), "b": _point(item.get("b"))}
        for item in space.get("open_spans") or [] if isinstance(item, dict)
    ]
    return out


def _project_layout(ids: _Pseudonyms, layout: object) -> dict[str, Any]:
    if not isinstance(layout, dict):
        return {}
    marker_ids = ids.maps.get("marker", {})
    room_ids = ids.maps.get("room", {})
    out: dict[str, Any] = {}
    for raw_key, value in layout.items():
        if not isinstance(raw_key, str) or not isinstance(value, dict):
            continue
        if raw_key in marker_ids:
            key = marker_ids[raw_key]
        elif raw_key.startswith("rl_") and raw_key[3:] in room_ids:
            key = "rl_" + room_ids[raw_key[3:]]
        else:
            # Unknown keys may be stale device ids.  Omitting them is the only
            # fail-closed choice; copying them would disclose the raw id.
            continue
        position = _copy_keys(value, ("x", "y", "k"))
        if value.get("s"):
            position["s"] = ids.get("space", value.get("s"))
        out[key] = position
    return out


def _summary(config: object, layout: object) -> dict[str, Any]:
    spaces = config.get("spaces", []) if isinstance(config, dict) else []
    markers = config.get("markers", []) if isinstance(config, dict) else []
    kinds: Counter[str] = Counter()
    bindings: Counter[str] = Counter()
    lifecycles: Counter[str] = Counter()
    decor_kinds: Counter[str] = Counter()
    for marker in markers:
        if not isinstance(marker, dict):
            continue
        bindings[_binding_kind(marker.get("binding"))] += 1
        lifecycles[
            "removed" if marker.get("removed") else "hidden" if marker.get("hidden") else "active"
        ] += 1
    for space in spaces:
        if not isinstance(space, dict):
            continue
        for opening in space.get("openings") or []:
            if isinstance(opening, dict):
                kinds[str(opening.get("type") or "unknown")] += 1
        for item in space.get("decor") or []:
            if isinstance(item, dict):
                decor_kinds[str(item.get("kind") or "unknown")] += 1
    return {
        "spaces": len(spaces),
        "rooms": sum(len(space.get("rooms") or []) for space in spaces if isinstance(space, dict)),
        "room_drafts": sum(len(space.get("room_drafts") or []) for space in spaces if isinstance(space, dict)),
        "walls": sum(len(space.get("wall_segments") or space.get("walls") or []) for space in spaces if isinstance(space, dict)),
        "partitions": sum(len(space.get("partitions") or []) for space in spaces if isinstance(space, dict)),
        "columns": sum(len(space.get("wall_columns") or []) for space in spaces if isinstance(space, dict)),
        "openings": dict(sorted(kinds.items())),
        "decor": dict(sorted(decor_kinds.items())),
        "markers": {
            "total": len(markers),
            "lifecycle": dict(sorted(lifecycles.items())),
            "binding": dict(sorted(bindings.items())),
        },
        "layout_entries": len(layout) if isinstance(layout, dict) else 0,
    }


def _binding_kind(value: object) -> str:
    text = str(value or "")
    if text == "virtual":
        return "virtual"
    if text.startswith("device:"):
        return "device"
    if text.startswith("entity:"):
        return "entity"
    return "unknown"


def build_support_package(
    config: dict[str, Any],
    layout: dict[str, Any],
    *,
    config_rev: int,
    layout_rev: int,
    card_version: str,
    integration_version: str,
    home_assistant_version: str,
    runtime: dict[str, Any],
    repairs: list[dict[str, Any]] | None = None,
    namespace: str | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """Build canonical bytes and a bounded summary for the preview response."""
    facts = validate_frontend_facts(runtime)
    ids = _Pseudonyms(namespace or secrets.token_hex(4))
    spaces = [item for item in config.get("spaces", []) if isinstance(item, dict)]
    markers = [item for item in config.get("markers", []) if isinstance(item, dict)]
    projected_spaces = [
        _project_space(ids, space, index) for index, space in enumerate(spaces, 1)
    ]
    projected_markers = [_project_marker(ids, marker) for marker in markers]
    summary = _summary(config, layout)
    package = {
        "format": PACKAGE_FORMAT,
        "version": PACKAGE_VERSION,
        "versions": {
            "card": _safe_version(card_version),
            "integration": _safe_version(integration_version),
            "home_assistant": _safe_version(home_assistant_version),
            "model": PLAN_MODEL_VERSION,
            "export_schema": EXPORT_VERSION,
        },
        "runtime": facts,
        "revisions": {"config": int(config_rev), "layout": int(layout_rev)},
        "summary": summary,
        "validation": {
            "config": "valid", "layout": "valid", "unknown_fields": "dropped",
        },
        "repairs": repairs or [],
        "plan_backup": {
            "config": {
                "model_version": int(config.get("model_version", PLAN_MODEL_VERSION)),
                "settings": _global_settings(config.get("settings")),
                "spaces": projected_spaces,
                "markers": projected_markers,
            },
            "layout": _project_layout(ids, layout),
        },
    }
    raw = (json.dumps(
        package, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
    ) + "\n").encode("utf-8")
    if len(raw) > MAX_SUPPORT_ATTACHMENT_BYTES:
        raise SupportPackageError("support_package_too_large")
    return raw, {
        "size": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "spaces": summary["spaces"],
        "format": PACKAGE_FORMAT,
        "version": PACKAGE_VERSION,
        "versions": package["versions"],
    }
