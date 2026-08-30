"""Portable House Plan backup/export and two-phase import service.

The browser never interprets an import document.  It uploads bytes for a
bounded server-side preview, receives a short-lived opaque token and can apply
only the exact candidate that produced that preview.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
import secrets
import time
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit

import voluptuous as vol

from .const import (
    CONTENT_URL,
    EXPORT_VERSION,
    FILES_URL,
    FILES_DIR,
    IMPORT_PREVIEW_TTL_S,
    MAX_EXPORT_BYTES,
    MAX_IMPORT_PREVIEWS_PER_USER,
    MAX_IMPORT_PREVIEWS_TOTAL,
    PLAN_MODEL_VERSION,
    PLANS_DIR,
    PLANS_URL,
    VERSION,
)
from .store import HouseplanData
from .wall_segment_model import (
    WallSegmentMigrationError,
    commit_wall_segment_model,
)
from .validation import (
    CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    MAX_CONFIG_BYTES,
    MAX_CONTROLS,
    MAX_LAYOUT,
    MAX_MARKERS,
    MAX_SPACES,
    sanitize_filename,
    sanitize_marker_id,
    validate_marker_controls,
    validate_marker_light_entities,
    validate_marker_value_badges,
    validate_opening_passages, validate_partition_opening_hosts,
    MarkerControlError,
    OpeningPassageError,
    PartitionOpeningHostError,
    PartitionOpeningJambMarginError,
)

FORMAT = "houseplan-export"
_PROTO_KEYS = {"__proto__", "prototype", "constructor"}
_SAFE_FILE = re.compile(r"[^A-Za-z0-9._-]+")
_LIVE_TEXT_TOKEN = re.compile(r"\{([^{}\r\n]+)\}")
_LIVE_TEXT_ENTITY = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_LIVE_TEXT_ATTRIBUTE = re.compile(r"^[a-zA-Z0-9_.-]+$")
_PLAN_ONLY_DASH = "—"
_IMPORT_ID_NAMESPACES = {
    "space", "room", "marker", "partition", "wall", "opening", "decor", "draft",
    "draft_segment", "column",
}
_MAX_IMPORT_LINEAGE_DEPTH = 16
_REPORT_EXAMPLE_LIMIT = 24

_SPACE_PLAN_FIELDS = (
    "id", "title", "cell_cm", "plan_url", "plan_aspect", "plan_x", "plan_y",
    "plan_scale", "plan_scale_x", "plan_scale_y", "plan_angle", "view_box",
    "zero_wall_style",
)
_SPACE_DISPLAY_FIELDS = (
    "show_borders", "show_names", "room_color", "bg_color", "room_opacity",
    "fill_mode", "custom_fill", "glow_enabled", "temp_min", "temp_max",
    "show_lqi", "hide_decor", "hide_openings", "label_temp", "label_hum",
    "label_lqi", "label_light", "card_font_scale", "north_deg", "bg_mode",
    "sun_rays",
)
_ROOM_PLAN_FIELDS = ("id", "name", "open_to", "x", "y", "w", "h", "poly", "wall_ids")
_ROOM_DISPLAY_FIELDS = (
    "fill_mode", "custom_fill", "glow", "name_scale", "label_scale",
)
_DECOR_COMMON_FIELDS = ("id", "kind", "color", "opacity", "width_cm", "width")
_DECOR_KIND_FIELDS = {
    "line": ("x1", "y1", "x2", "y2", "line_style"),
    "rect": ("x", "y", "w", "h", "angle", "fill", "fill_color", "fill_opacity"),
    "ellipse": ("x", "y", "w", "h", "angle", "fill", "fill_color", "fill_opacity"),
    "text": ("x", "y", "text", "size", "size_cm", "scale", "angle"),
    "furniture": ("symbol", "x", "y", "w", "h", "angle"),
}


class ImportFailure(Exception):
    """Stable public import error."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message or code


def source_fingerprint(instance_id: str) -> str:
    raw = "houseplan-export-v1|" + instance_id
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def _json_copy(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, allow_nan=False))


def _background_mode(settings: Any) -> str | None:
    if not isinstance(settings, dict):
        return None
    mode = settings.get("bg_mode")
    return mode if mode in ("static", "daynight") else None


def _materialize_global_background(config: dict[str, Any], fallback: str = "static") -> str:
    """Make the global mode portable instead of relying on a code default."""
    settings = config.get("settings")
    if not isinstance(settings, dict):
        settings = {}
        config["settings"] = settings
    mode = _background_mode(settings) or fallback
    settings["bg_mode"] = mode
    return mode


def _materialize_space_background(space: dict[str, Any], fallback: str) -> str:
    """Make one space independent from the target installation's default."""
    settings = space.get("settings")
    if not isinstance(settings, dict):
        settings = {}
        space["settings"] = settings
    mode = _background_mode(settings) or fallback
    settings["bg_mode"] = mode
    return mode


def _stored_model_version(config: dict[str, Any]) -> int:
    """Return the model actually stored without silently upgrading it."""
    value = config.get("model_version", 0)
    if value is None:
        return 0
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ImportFailure("invalid_config", "Invalid configuration model version")
    return value


def _document_digest(document: dict[str, Any]) -> str:
    """Digest the normalized candidate a preview token is allowed to apply."""
    raw = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def live_layout(config: dict[str, Any], layout: dict[str, Any]) -> dict[str, Any]:
    """Return only positions that still have a possible live owner."""
    markers = config.get("markers") or []
    removed = {str(m.get("id")) for m in markers if m.get("removed") is True}
    explicit = {
        str(m.get("id")) for m in markers if m.get("removed") is not True
    }
    return {
        key: dict(pos)
        for key, pos in layout.items()
        if key not in removed
        and (not key.startswith("v_") or key in explicit)
    }


def _pick_fields(source: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    """Copy only fields explicitly classified as portable plan data."""
    return {key: _json_copy(source[key]) for key in fields if key in source}


def _is_live_text_reference(raw: str) -> bool:
    """Mirror ``liveTextReference`` without evaluating Home Assistant state."""
    ref = raw.strip()
    if not ref:
        return False
    entity = ref
    attribute = ""
    colon = ref.find(":")
    if colon >= 0:
        entity = ref[:colon].strip()
        attribute = ref[colon + 1:].strip()
    else:
        parts = ref.split(".")
        if len(parts) > 2:
            entity = ".".join(parts[:2])
            attribute = ".".join(parts[2:])
    if _LIVE_TEXT_ENTITY.fullmatch(entity) is None:
        return False
    if colon >= 0 and not attribute:
        return False
    return not attribute or _LIVE_TEXT_ATTRIBUTE.fullmatch(attribute) is not None


def _plan_only_text(value: str) -> str:
    """Freeze every recognized live reference while preserving authored copy."""
    replaced = _LIVE_TEXT_TOKEN.sub(
        lambda match: _PLAN_ONLY_DASH
        if _is_live_text_reference(match.group(1)) else match.group(0),
        value,
    )
    return replaced.replace("{}", _PLAN_ONLY_DASH)


def _project_plan_only_room(room: dict[str, Any]) -> dict[str, Any]:
    projected = _pick_fields(room, _ROOM_PLAN_FIELDS)
    if "settings" in room:
        settings = room.get("settings")
        projected["settings"] = (
            _pick_fields(settings, _ROOM_DISPLAY_FIELDS)
            if isinstance(settings, dict) else None
        )
    return projected


def _project_plan_only_decor(shape: dict[str, Any]) -> dict[str, Any]:
    kind = str(shape.get("kind", ""))
    projected = _pick_fields(
        shape, _DECOR_COMMON_FIELDS + _DECOR_KIND_FIELDS.get(kind, ()),
    )
    if kind == "text" and isinstance(projected.get("text"), str):
        projected["text"] = _plan_only_text(projected["text"])
    return projected


def _project_plan_only_space(space: dict[str, Any]) -> dict[str, Any]:
    """Build the fail-closed geometry/presentation projection for #167."""
    projected = _pick_fields(space, _SPACE_PLAN_FIELDS)
    if "settings" in space:
        projected["settings"] = _pick_fields(
            space.get("settings") or {}, _SPACE_DISPLAY_FIELDS,
        )
    projected["rooms"] = [
        _project_plan_only_room(room) for room in space.get("rooms") or []
    ]
    collections: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("walls", ("key", "cm", "a", "b")),
        ("wall_segments", ("id", "a", "b", "cm")),
        ("room_drafts", ("id", "points", "segments")),
        ("partitions", ("id", "a", "b", "cm")),
        ("wall_columns", ("id", "shape", "center", "cm", "angle")),
        ("open_spans", ("a", "b")),
    )
    for name, fields in collections:
        if name not in space:
            continue
        values = []
        for item in space.get(name) or []:
            selected = _pick_fields(item, fields)
            if name == "room_drafts" and "segments" in selected:
                selected["segments"] = [
                    _pick_fields(segment, ("id", "cm"))
                    for segment in selected.get("segments") or []
                ]
            values.append(selected)
        projected[name] = values
    if "openings" in space:
        projected["openings"] = [
            _pick_fields(
                opening,
                ("id", "type", "x", "y", "angle", "length")
                + (() if opening.get("type") == "passage" else ("flip_h", "flip_v"))
                + (("host",) if opening.get("host") else ()),
            )
            for opening in space.get("openings") or []
        ]
    if "decor" in space:
        projected["decor"] = [
            _project_plan_only_decor(shape) for shape in space.get("decor") or []
        ]
    return projected


def _plan_only_room_label_layout(
    layout: dict[str, Any], space: dict[str, Any],
) -> dict[str, Any]:
    space_id = str(space.get("id", ""))
    room_ids = {str(room.get("id", "")) for room in space.get("rooms") or []}
    projected: dict[str, Any] = {}
    for key, pos in layout.items():
        if not (
            isinstance(key, str)
            and key.startswith("rl_")
            and key[3:] in room_ids
            and isinstance(pos, dict)
            and str(pos.get("s", "")) == space_id
        ):
            continue
        value = _pick_fields(pos, ("x", "y", "s"))
        scale = pos.get("k")
        if isinstance(scale, (int, float)) and not isinstance(scale, bool) \
                and math.isfinite(scale) and 0.5 <= scale <= 3:
            value["k"] = scale
        projected[key] = value
    return projected


def _marker_owned(marker: dict[str, Any], space: dict[str, Any], layout: dict[str, Any]) -> bool:
    marker_id = str(marker.get("id", ""))
    room_ids = {str(room.get("id")) for room in space.get("rooms") or []}
    pos = layout.get(marker_id)
    return bool(
        (isinstance(pos, dict) and str(pos.get("s")) == str(space.get("id")))
        or str(marker.get("space") or "") == str(space.get("id"))
        or str(marker.get("room_id") or "") in room_ids
    )


def placement_manifest(config: dict[str, Any], layout: dict[str, Any]) -> list[dict[str, Any]]:
    markers = {str(m.get("id")): m for m in config.get("markers") or []}
    room_ids = {
        str(r.get("id"))
        for sp in config.get("spaces") or []
        for r in sp.get("rooms") or []
    }
    out: list[dict[str, Any]] = []
    for key, pos in layout.items():
        marker = markers.get(key)
        if marker:
            kind = "marker"
            binding = marker.get("binding")
            label = marker.get("name")
            icon = marker.get("icon")
            owner_id = key
        elif key.startswith("rl_") and key[3:] in room_ids:
            kind, binding, label, icon, owner_id = "room_label", None, None, None, key[3:]
        elif key.startswith("lg_"):
            kind, binding, label, icon, owner_id = "light_group", "entity:" + key[3:], None, None, key
        else:
            kind, binding, label, icon, owner_id = "auto_device", "device:" + key, None, None, key
        out.append({
            "layout_id": key,
            "space_id": pos.get("s") if isinstance(pos, dict) else None,
            "owner": kind,
            "owner_id": owner_id,
            "binding": binding,
            "label": label,
            "icon": icon,
        })
    return out


def _internal_path(root: Path, url: str) -> tuple[str, Path] | None:
    # A url is parsed as a url, not as a string: everything after "?" or "#"
    # addresses the transfer, never the file. Legacy attachments carry a
    # cache-buster (".../files/m1/doc.pdf?v=1783170649"), and while the string
    # form fed "doc.pdf?v=1783170649" to sanitize_filename the name never
    # matched itself — the reference read as internal-but-non-canonical and
    # every backup holding one refused to import (issue #225). Path segments
    # keep doing the guarding: dropping the query cannot widen what a segment
    # is allowed to be.
    #
    # Only a same-document reference may be trusted this way: with a scheme or
    # an authority the path belongs to another host, and taking it would let
    # "https://evil.example/houseplan_files/files/m1/doc.pdf" resolve onto a
    # local file (review CODE-REVIEW-225-r1, M1). Such a url stays external,
    # which is also what _looks_internal says about it.
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        return None
    url = parsed.path
    content_plan = CONTENT_URL + "/plans/_/"
    if url.startswith(content_plan) or url.startswith(PLANS_URL + "/"):
        prefix = content_plan if url.startswith(content_plan) else PLANS_URL + "/"
        raw_name = url[len(prefix):]
        if not raw_name or "/" in raw_name:
            return None
        name = sanitize_filename(raw_name)
        if name != raw_name:
            return None
        return "plan", root / PLANS_DIR / name
    for prefix in (CONTENT_URL + "/files/", FILES_URL + "/"):
        if url.startswith(prefix):
            tail = url[len(prefix):].split("/")
            if len(tail) != 2:
                return None
            marker, name = sanitize_marker_id(tail[0]), sanitize_filename(tail[1])
            if marker != tail[-2] or name != tail[-1]:
                return None
            return "attachment", root / FILES_DIR / marker / name
    return None


def _looks_internal(url: str) -> bool:
    """Whether a URL claims one of House Plan's local namespaces."""
    return any(url.startswith(prefix) for prefix in (
        CONTENT_URL + "/", PLANS_URL + "/", FILES_URL + "/",
    ))


def content_manifest(config: dict[str, Any], config_root: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def add(kind: str, owner: str, owner_id: str, field: str, value: Any) -> None:
        if not isinstance(value, str) or not value:
            return
        internal = _internal_path(config_root, value)
        out.append({
            "kind": kind,
            "owner": owner,
            "owner_id": owner_id,
            "field": field,
            "url": value,
            "storage": "internal" if internal else "external",
            "exists_at_export": internal[1].is_file() if internal else None,
        })

    for space in config.get("spaces") or []:
        add("plan", "space", str(space.get("id")), "plan_url", space.get("plan_url"))
    for marker in config.get("markers") or []:
        for index, pdf in enumerate(marker.get("pdfs") or []):
            add(
                "attachment", "marker", str(marker.get("id")),
                f"pdfs[{index}].url", pdf.get("url") if isinstance(pdf, dict) else None,
            )
    return out


def _safe_title(value: str) -> str:
    safe = _SAFE_FILE.sub("-", unicodedata.normalize("NFC", value).strip()).strip("-._")
    return (safe or "space")[:60]


def create_export(
    runtime: HouseplanData,
    config_data: dict[str, Any],
    layout_data: dict[str, Any],
    *,
    kind: str,
    space_id: str | None,
    plan_only: bool = False,
    card_version: str,
    config_root: Path,
) -> tuple[dict[str, Any], str]:
    if not isinstance(plan_only, bool) or plan_only and kind != "space":
        raise ImportFailure("invalid_format", "Plan-only export requires one space")
    raw_config = _json_copy(
        config_data.get("config") or {"spaces": [], "markers": [], "settings": {}}
    )
    # Read before voluptuous coercions: bool is an int subclass and must not
    # become a plausible model 1 in an otherwise valid export.
    model_version = _stored_model_version(raw_config)
    config = CONFIG_SCHEMA(raw_config)
    # Compatibility belongs to the envelope.  Keeping this field inside the
    # payload would either duplicate it or tempt an exporter to silently stamp
    # the current version over an older/future stored model.
    config.pop("model_version", None)
    global_background = _materialize_global_background(config)
    layout = live_layout(config, LAYOUT_SCHEMA(_json_copy(layout_data.get("layout") or {})))
    stamp = datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S")
    title = ""
    dropped_marker_links = 0
    if kind == "space":
        space = next((sp for sp in config.get("spaces") or [] if str(sp.get("id")) == space_id), None)
        if not space:
            raise ImportFailure("space_not_found", "Space was not found")
        _materialize_space_background(space, global_background)
        title = str(space.get("title") or space.get("id") or "space")
        selected_layout = {
            key: pos for key, pos in layout.items()
            if isinstance(pos, dict) and str(pos.get("s")) == str(space_id)
        }
        if plan_only:
            projected_space = _project_plan_only_space(space)
            config = {"spaces": [projected_space], "markers": []}
            layout = _plan_only_room_label_layout(selected_layout, projected_space)
        else:
            selected_markers = [
                m for m in config.get("markers") or []
                if m.get("removed") is not True and _marker_owned(m, space, selected_layout)
            ]
            selected_ids = {str(marker.get("id")) for marker in selected_markers}
            for marker in selected_markers:
                controls = marker.get("controls")
                if isinstance(controls, list):
                    kept = []
                    for ref in controls:
                        if isinstance(ref, str) and ref.startswith("marker:") \
                                and ref[len("marker:"):] not in selected_ids:
                            dropped_marker_links += 1
                            continue
                        kept.append(ref)
                    marker["controls"] = kept or None
                # #385(г): the two neutralisation formats below differ on
                # purpose and are a PAIR — each disarms an external ref the
                # way its own model represents "no source": the badge keeps
                # its object with enabled=False/source=None (enabled is part
                # of the badge model), while value_source's absence IS auto,
                # so the key is dropped. Both count in dropped_marker_links;
                # changing either format would break round-trips of existing
                # exports.
                badge = marker.get("value_badge")
                source = badge.get("source") if isinstance(badge, dict) else None
                ref = source.get("ref") if isinstance(source, dict) \
                    and source.get("kind") == "derived_marker_state" else None
                if isinstance(ref, str) and ref.startswith("marker:") \
                        and ref[len("marker:"):] not in selected_ids:
                    badge["enabled"] = False
                    badge["source"] = None
                    dropped_marker_links += 1
                value_source = marker.get("value_source")
                ref = value_source.get("ref") if isinstance(value_source, dict) \
                    and value_source.get("kind") == "derived_marker_state" else None
                if isinstance(ref, str) and ref.startswith("marker:") \
                        and ref[len("marker:"):] not in selected_ids:
                    marker.pop("value_source", None)
                    dropped_marker_links += 1
            config = {
                "spaces": [_json_copy(space)],
                "markers": _json_copy(selected_markers),
            }
            layout = selected_layout
    elif kind != "full":
        raise ImportFailure("invalid_format", "Unknown export kind")
    document = {
        "format": FORMAT,
        "export_version": EXPORT_VERSION,
        "kind": kind,
        "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "source_fingerprint": source_fingerprint(runtime.instance_id),
        "card_version": card_version,
        "integration_version": VERSION,
        "model_version": model_version,
        "payload": {"config": config, "layout": layout},
        "placement_manifest": placement_manifest(config, layout),
        "content_manifest": content_manifest(config, config_root),
        "transfer": {
            "dropped_marker_links": dropped_marker_links,
            **({"plan_only": True} if plan_only else {}),
        },
    }
    if len(json.dumps(
        document, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")) > MAX_EXPORT_BYTES:
        raise ImportFailure("too_large", "Export is larger than 8 MiB")
    filename = (
        f"houseplan-full-{stamp}.json" if kind == "full"
        else f"houseplan-space-{_safe_title(title)}-{stamp}.json"
    )
    return document, filename


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise ImportFailure("invalid_json", f"Duplicate JSON key: {key}")
        if key in _PROTO_KEYS:
            raise ImportFailure("invalid_json", f"Forbidden JSON key: {key}")
        out[key] = value
    return out


def parse_document(raw: bytes) -> dict[str, Any]:
    if len(raw) > MAX_EXPORT_BYTES:
        raise ImportFailure("too_large", "Import is larger than 8 MiB")
    try:
        # utf-8-sig accepts a BOM only at the very start.  A later U+FEFF is a
        # normal character and cannot disguise trailing JSON.
        text = raw.decode("utf-8-sig")
        if "\ufeff" in text:
            raise ImportFailure("invalid_json", "A UTF-8 BOM is allowed only at the start")
        document = json.loads(
            text,
            object_pairs_hook=_strict_object,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ImportFailure("invalid_json", f"Non-finite number: {value}")
            ),
        )
    except ImportFailure:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError) as err:
        raise ImportFailure("invalid_json", str(err)) from err
    if not isinstance(document, dict) or document.get("format") != FORMAT:
        raise ImportFailure("invalid_format", "Not a House Plan export")
    if document.get("export_version") != EXPORT_VERSION:
        raise ImportFailure("unsupported_export_version", "Unsupported export version")
    if document.get("kind") not in ("full", "space"):
        raise ImportFailure("invalid_format", "Export kind must be full or space")
    model = document.get("model_version", 0)
    if isinstance(model, bool) or not isinstance(model, int) or model < 0:
        raise ImportFailure("invalid_format", "Invalid data model version")
    if model > PLAN_MODEL_VERSION:
        raise ImportFailure("future_model", "The export uses a newer data model")
    payload = document.get("payload")
    if not isinstance(payload, dict):
        raise ImportFailure("invalid_format", "Missing payload")
    try:
        config_candidate = _json_copy(payload.get("config"))
        # The envelope is authoritative. Export deliberately omits this field
        # inside payload.config, but v8 semantic validation still has to run
        # before an import token can be issued.
        if model > 0:
            config_candidate["model_version"] = model
        config = CONFIG_SCHEMA(config_candidate)
        config.pop("model_version", None)
    except (vol.Invalid, TypeError, ValueError) as err:
        raise ImportFailure("invalid_config", str(err)) from err
    if document["kind"] == "full":
        _materialize_global_background(config)
    else:
        for space in config.get("spaces") or []:
            if isinstance(space, dict):
                _materialize_space_background(space, "static")
    try:
        layout = LAYOUT_SCHEMA(_json_copy(payload.get("layout") or {}))
    except (vol.Invalid, TypeError, ValueError) as err:
        raise ImportFailure("invalid_layout", str(err)) from err
    document["payload"] = {"config": config, "layout": layout}
    placement = document.get("placement_manifest")
    if not isinstance(placement, list):
        raise ImportFailure("invalid_format", "Missing placement manifest")
    if len(placement) > MAX_LAYOUT:
        raise ImportFailure("too_large", "Placement manifest exceeds the layout limit")
    placement_ids: set[str] = set()
    for item in placement:
        if not isinstance(item, dict):
            raise ImportFailure("invalid_format", "Invalid placement manifest")
        layout_id = item.get("layout_id", item.get("key"))
        if not isinstance(layout_id, str) or layout_id in placement_ids:
            raise ImportFailure("invalid_format", "Invalid placement manifest id")
        placement_ids.add(layout_id)
    if document["kind"] == "space" and placement_ids != set(layout):
        raise ImportFailure("invalid_format", "Placement manifest does not match layout")
    dropped_marker_links = _transfer_dropped_marker_links(document)
    plan_only = _transfer_plan_only(document)
    document["transfer"] = {
        **(document.get("transfer") or {}),
        "dropped_marker_links": dropped_marker_links,
    }
    if plan_only:
        _validate_plan_only_document(document, config, layout, placement)
    if len(json.dumps(
        config, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")) > MAX_CONFIG_BYTES:
        raise ImportFailure("too_large", "Imported configuration exceeds the store limit")
    return document


def _counts(config: dict[str, Any], layout: dict[str, Any]) -> dict[str, int]:
    spaces = config.get("spaces") or []
    return {
        "spaces": len(spaces),
        "rooms": sum(len(sp.get("rooms") or []) for sp in spaces),
        "walls": sum(
            len(sp.get("walls") or [])
            for sp in spaces
        ),
        "markers": len(config.get("markers") or []),
        "openings": sum(len(sp.get("openings") or []) for sp in spaces),
        "decor": sum(len(sp.get("decor") or []) for sp in spaces),
        "layout": len(layout),
    }


def _binding_key(marker: dict[str, Any]) -> str | None:
    binding = marker.get("binding")
    return binding if isinstance(binding, str) and binding != "virtual" else None


def _layout_binding(
    key: str, marker_ids: set[str], manifest: dict[str, dict[str, Any]] | None = None,
) -> str | None:
    """Recover the literal HA binding owned by a layout-only placement."""
    if key in marker_ids or key.startswith("rl_") or key.startswith("v_"):
        return None
    declared = (manifest or {}).get(key, {}).get("binding")
    if isinstance(declared, str) and declared != "virtual":
        return declared
    if key.startswith("lg_") and len(key) > 3:
        return "entity:" + key[3:]
    return "device:" + key


def _binding_inventory(
    config: dict[str, Any], layout: dict[str, Any],
    manifest: dict[str, dict[str, Any]] | None = None,
) -> set[str]:
    markers = config.get("markers") or []
    marker_ids = {str(marker.get("id")) for marker in markers}
    out = {binding for marker in markers if (binding := _binding_key(marker))}
    out.update(
        binding for key in layout
        if (binding := _layout_binding(str(key), marker_ids, manifest))
    )
    return out


def _transfer_dropped_marker_links(document: dict[str, Any]) -> int:
    """Return the bounded, schema-independent transfer loss counter."""
    transfer = document.get("transfer")
    if transfer is None:
        return 0
    if not isinstance(transfer, dict):
        raise ImportFailure("invalid_format", "Transfer metadata must be an object")
    value = transfer.get("dropped_marker_links", 0)
    maximum = MAX_MARKERS * (MAX_CONTROLS + 2)
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum:
        raise ImportFailure("invalid_format", "Invalid dropped marker link count")
    return value


def _transfer_plan_only(document: dict[str, Any]) -> bool:
    """Read strict additive plan-only metadata without widening old exports."""
    transfer = document.get("transfer")
    if transfer is None:
        return False
    if not isinstance(transfer, dict):
        raise ImportFailure("invalid_format", "Transfer metadata must be an object")
    value = transfer.get("plan_only", False)
    if not isinstance(value, bool):
        raise ImportFailure("invalid_format", "Plan-only metadata must be a boolean")
    if value and document.get("kind") != "space":
        raise ImportFailure("invalid_format", "Plan-only metadata requires one space")
    return value


def _validate_plan_only_document(
    document: dict[str, Any],
    config: dict[str, Any],
    layout: dict[str, Any],
    placement: list[Any],
) -> None:
    """Reject forged plan-only flags unless every privacy invariant is true."""
    spaces = config.get("spaces") or []
    if len(spaces) != 1 or config.get("markers") != []:
        raise ImportFailure("invalid_format", "Plan-only export has invalid owners")
    expected_config = CONFIG_SCHEMA({
        "spaces": [_project_plan_only_space(spaces[0])],
        "markers": [],
    })
    if config != expected_config:
        raise ImportFailure("invalid_format", "Plan-only export contains private fields")
    expected_layout = _plan_only_room_label_layout(layout, spaces[0])
    if layout != expected_layout:
        raise ImportFailure("invalid_format", "Plan-only export contains device layout")
    expected_placement = placement_manifest(config, layout)
    if placement != expected_placement:
        raise ImportFailure("invalid_format", "Plan-only placement manifest is not canonical")
    content = document.get("content_manifest")
    if not isinstance(content, list) or any(
        not isinstance(item, dict) or item.get("owner") != "space"
        for item in content
    ):
        raise ImportFailure("invalid_format", "Plan-only export contains private content")


def _drop_invalid_import_marker_links(
    config: dict[str, Any], *, clean_ids: set[str] | None = None,
) -> int:
    """Drop import-only dormant/broken marker links without touching legacy data.

    Self-links and cycles remain hard errors in ``validate_marker_controls``.
    Missing, removed, non-light and duplicate targets are a normal loss of
    import context and are removed with an explicit preview counter.
    """
    markers = config.get("markers") or []
    by_id = {str(marker.get("id")): marker for marker in markers}
    dropped = 0
    for marker in markers:
        marker_id = str(marker.get("id"))
        if clean_ids is not None and marker_id not in clean_ids:
            continue
        controls = marker.get("controls")
        if isinstance(controls, list):
            kept: list[Any] = []
            seen_targets: set[str] = set()
            for ref in controls:
                if not isinstance(ref, str) or not ref.startswith("marker:"):
                    kept.append(ref)
                    continue
                target_id = ref[len("marker:"):]
                # Preserve one self-link so the semantic validator returns the
                # stable marker_control_self error instead of silently repairing it.
                if target_id == marker_id:
                    if target_id in seen_targets:
                        dropped += 1
                        continue
                    seen_targets.add(target_id)
                    kept.append(ref)
                    continue
                target = by_id.get(target_id)
                if target_id in seen_targets or target is None or target.get("removed") is True \
                        or target.get("is_light") is not True:
                    dropped += 1
                    continue
                seen_targets.add(target_id)
                kept.append(ref)
            marker["controls"] = kept or None
        badge = marker.get("value_badge")
        source = badge.get("source") if isinstance(badge, dict) else None
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            target_id = ref[len("marker:"):] if isinstance(ref, str) and ref.startswith("marker:") else ""
            target = by_id.get(target_id)
            if not target_id or target is None or target.get("removed") is True \
                    or target.get("is_light") is not True:
                badge["enabled"] = False
                badge["source"] = None
                dropped += 1
        source = marker.get("value_source")
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            target_id = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else ""
            target = by_id.get(target_id)
            if not target_id or target is None or target.get("removed") is True \
                    or target.get("is_light") is not True:
                marker.pop("value_source", None)
                dropped += 1
    return dropped


def _unique_title(base: str, existing: list[dict[str, Any]]) -> str:
    base = unicodedata.normalize("NFC", base).strip() or "Space"
    names = {
        unicodedata.normalize("NFC", str(sp.get("title") or "").strip()).casefold()
        for sp in existing
    }
    if unicodedata.normalize("NFC", base).casefold() not in names:
        return base
    n = 2
    while unicodedata.normalize("NFC", f"{base} ({n})").casefold() in names:
        n += 1
    return f"{base} ({n})"


def canonical_import_root(prefix: str, value: str) -> tuple[str, int, bool]:
    """Return the bounded root of ids generated by a previous space import.

    Only the exact ``<same namespace>_<stem>_<8 lowercase hex>`` envelope is
    reversible. Similar user ids, other namespaces and uppercase/short hashes
    remain literal. The layer count and bounded flag are shared with the
    TypeScript helper through one conformance fixture. The flag reports that
    another valid layer remained after the safety bound.
    """
    root = str(value)
    pattern = re.compile(rf"^{re.escape(prefix)}_(.+)_([0-9a-f]{{8}})$")
    layers = 0
    for _depth in range(_MAX_IMPORT_LINEAGE_DEPTH):
        match = pattern.fullmatch(root)
        if match is None:
            return root, layers, False
        root = match.group(1)
        layers += 1
    return root, layers, pattern.fullmatch(root) is not None


def _fresh(prefix: str, old: str, used: set[str]) -> str:
    root, _layers, _bounded = canonical_import_root(prefix, old) \
        if prefix in _IMPORT_ID_NAMESPACES else (old, 0, False)
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", root).strip("_")[:35] or prefix
    while True:
        value = f"{prefix}_{stem}_{secrets.token_hex(4)}"
        if value not in used:
            used.add(value)
            return value


def _orphan_marker(key: str, manifest: dict[str, Any] | None, space_id: str, used: set[str]) -> dict[str, Any]:
    marker_id = _fresh("v_import", key, used)
    return {
        "id": marker_id,
        "binding": "virtual",
        "space": space_id,
        "name": (manifest or {}).get("label") or key,
        "icon": (manifest or {}).get("icon") or "mdi:map-marker-outline",
        "display": "static_icon",
    }


def _empty_reference_report() -> dict[str, Any]:
    return {
        "remapped": {"incoming": {}, "target": {}},
        "collisions": {},
        "preservedUnresolved": {},
        "droppedIncomingLinks": {},
        "boundedLineages": 0,
        "examples": [],
    }


def _report_reference(
    report: dict[str, Any], bucket: str, category: str, owner: str, reference: str,
) -> None:
    section = report.setdefault(bucket, {})
    section[category] = int(section.get(category, 0)) + 1
    examples = report.setdefault("examples", [])
    if len(examples) < _REPORT_EXAMPLE_LIMIT:
        examples.append({
            "bucket": bucket, "category": category,
            "owner": str(owner)[:160], "reference": str(reference)[:160],
        })


def _report_remap(
    report: dict[str, Any], side: str, category: str, owner: str, reference: str,
) -> None:
    section = report.setdefault("remapped", {}).setdefault(side, {})
    section[category] = int(section.get(category, 0)) + 1
    examples = report.setdefault("examples", [])
    if len(examples) < _REPORT_EXAMPLE_LIMIT:
        examples.append({
            "bucket": f"remapped.{side}", "category": category,
            "owner": str(owner)[:160], "reference": str(reference)[:160],
        })


def _record_bounded_lineage(
    report: dict[str, Any], seen: set[tuple[str, str]], prefix: str, value: str,
) -> None:
    _root, _layers, bounded = canonical_import_root(prefix, value)
    if bounded:
        seen.add((prefix, value))
        report["boundedLineages"] = len(seen)


def _lineage_resolver(
    prefix: str,
    exact_map: dict[str, str],
    live_ids: set[str],
    report: dict[str, Any],
    bounded_seen: set[tuple[str, str]],
) -> Callable[[str], tuple[str | None, str]]:
    """Resolve only dead exact or uniquely provable cross-generation refs."""
    imported: dict[str, set[str]] = {}
    live: dict[str, set[str]] = {}
    for old, new in exact_map.items():
        root, _layers, bounded = canonical_import_root(prefix, old)
        imported.setdefault(root, set()).add(new)
        if bounded:
            _record_bounded_lineage(report, bounded_seen, prefix, old)
    for value in live_ids:
        root, _layers, bounded = canonical_import_root(prefix, value)
        live.setdefault(root, set()).add(value)
        if bounded:
            _record_bounded_lineage(report, bounded_seen, prefix, value)

    def resolve(reference: str) -> tuple[str | None, str]:
        if reference in live_ids:
            return None, "live"
        if reference in exact_map:
            return exact_map[reference], "exact"
        root, _layers, bounded = canonical_import_root(prefix, reference)
        if bounded:
            _record_bounded_lineage(report, bounded_seen, prefix, reference)
        candidates = imported.get(root, set())
        if not candidates:
            return None, "unrelated"
        if len(candidates) == 1 and not live.get(root):
            return next(iter(candidates)), "lineage"
        return None, "ambiguous"

    return resolve


def _repair_target_space_refs(
    current_config: dict[str, Any],
    current_layout: dict[str, Any],
    id_maps: dict[str, dict[str, str]],
    marker_link_map: dict[str, str],
    report: dict[str, Any],
    bounded_seen: set[tuple[str, str]],
) -> tuple[dict[str, Any], dict[str, Any], int]:
    """Repair target refs by exact map, then by one safe lineage candidate."""
    config = _json_copy(current_config)
    layout = _json_copy(current_layout)
    spaces = config.get("spaces") or []
    markers = config.get("markers") or []
    live_spaces = {str(item.get("id")) for item in spaces if item.get("id") is not None}
    live_rooms = {
        str(room.get("id")) for space in spaces for room in space.get("rooms") or []
        if room.get("id") is not None
    }
    live_partitions = {
        str(item.get("id")) for space in spaces for item in space.get("partitions") or []
        if item.get("id") is not None
    }
    live_markers = {
        str(marker.get("id")) for marker in markers if marker.get("id") is not None
    }
    resolve_space = _lineage_resolver(
        "space", id_maps.get("space", {}), live_spaces, report, bounded_seen,
    )
    resolve_room = _lineage_resolver(
        "room", id_maps.get("room", {}), live_rooms, report, bounded_seen,
    )
    resolve_partition = _lineage_resolver(
        "partition", id_maps.get("partition", {}), live_partitions, report, bounded_seen,
    )
    resolve_marker = _lineage_resolver(
        "marker", id_maps.get("marker", {}), live_markers, report, bounded_seen,
    )
    resolve_marker_link = _lineage_resolver(
        "marker", marker_link_map, live_markers, report, bounded_seen,
    )
    imported_space_ids = set(id_maps.get("space", {}).values())
    repaired = 0
    unresolved: set[tuple[str, str, str]] = set()

    def replace(
        owner: str, category: str, reference: Any,
        resolver: Callable[[str], tuple[str | None, str]],
    ) -> str | None:
        nonlocal repaired
        if not isinstance(reference, str) or not reference:
            return None
        mapped, reason = resolver(reference)
        if mapped is not None:
            repaired += 1
            _report_remap(report, "target", category, owner, reference)
            return mapped
        if reason == "ambiguous":
            preserve_once(owner, category, reference)
        return None

    def preserve_once(owner: str, category: str, reference: str) -> None:
        key = (owner, category, reference)
        if key in unresolved:
            return
        unresolved.add(key)
        _report_reference(
            report, "preservedUnresolved", category, owner, reference,
        )

    def preserve_related(
        owner: str, category: str, reference: Any,
        resolver: Callable[[str], tuple[str | None, str]],
    ) -> None:
        if not isinstance(reference, str) or not reference:
            return
        mapped, reason = resolver(reference)
        if mapped is not None or reason == "ambiguous":
            preserve_once(owner, category, reference)

    for space in spaces:
        space_id = str(space.get("id", "?"))
        for room in space.get("rooms") or []:
            room_id = str(room.get("id", "?"))
            values = room.get("open_to")
            if isinstance(values, list):
                for value in values:
                    preserve_related(
                        f"{space_id}:{room_id}", "room.open_to", value, resolve_room,
                    )
        for opening in space.get("openings") or []:
            host = opening.get("host") if isinstance(opening, dict) else None
            if isinstance(host, dict) and host.get("kind") == "partition":
                # A partition host is space-local. An imported partition lives
                # in the new independent copy, so a pre-existing opening in a
                # different target space cannot be rebound to it safely.
                preserve_related(
                    f"{space_id}:{opening.get('id', '?')}", "opening.host",
                    host.get("id"), resolve_partition,
                )

    for marker in markers:
        marker_id = str(marker.get("id", "?"))
        mapped = replace(marker_id, "marker.space", marker.get("space"), resolve_space)
        if mapped is not None:
            marker["space"] = mapped
        may_rebind_room = marker.get("space") in imported_space_ids
        if may_rebind_room:
            mapped = replace(marker_id, "marker.room_id", marker.get("room_id"), resolve_room)
            if mapped is not None:
                marker["room_id"] = mapped
        else:
            preserve_related(
                marker_id, "marker.room_id", marker.get("room_id"), resolve_room,
            )
        vacuum = marker.get("vacuum")
        segment_map = vacuum.get("segment_map") if isinstance(vacuum, dict) else None
        if isinstance(segment_map, dict):
            for key, room_id in list(segment_map.items()):
                if may_rebind_room:
                    mapped = replace(
                        marker_id, "marker.vacuum.segment_map", room_id, resolve_room,
                    )
                    if mapped is not None:
                        segment_map[key] = mapped
                else:
                    preserve_related(
                        marker_id, "marker.vacuum.segment_map", room_id, resolve_room,
                    )
        controls = marker.get("controls")
        if isinstance(controls, list):
            for index, ref in enumerate(controls):
                if not isinstance(ref, str) or not ref.startswith("marker:"):
                    continue
                old_target = ref[len("marker:"):]
                mapped = replace(
                    marker_id, "marker.controls", old_target, resolve_marker_link,
                )
                if mapped is not None:
                    controls[index] = "marker:" + mapped
                else:
                    # A duplicate may have been virtualised or otherwise lost
                    # light-source semantics. Such a marker remains a valid
                    # layout owner, but it is not a valid controls target.
                    preserve_related(
                        marker_id, "marker.controls", old_target, resolve_marker,
                    )
        badge = marker.get("value_badge")
        source = badge.get("source") if isinstance(badge, dict) else None
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            old_target = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else None
            mapped = replace(
                marker_id, "marker.value_badge", old_target, resolve_marker_link,
            )
            if mapped is not None:
                source["ref"] = "marker:" + mapped
            else:
                preserve_related(
                    marker_id, "marker.value_badge", old_target, resolve_marker,
                )
        source = marker.get("value_source")
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            old_target = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else None
            mapped = replace(
                marker_id, "marker.value_source", old_target, resolve_marker_link,
            )
            if mapped is not None:
                source["ref"] = "marker:" + mapped
            else:
                preserve_related(
                    marker_id, "marker.value_source", old_target, resolve_marker,
                )

    # Destination wins collisions. Rekey only proven dead plan-owned keys;
    # opaque HA owners remain literal.
    for key in list(layout):
        position = layout[key]
        if isinstance(position, dict):
            mapped_space = replace(key, "layout.space", position.get("s"), resolve_space)
            if mapped_space is not None:
                position["s"] = mapped_space
        new_key: str | None = None
        category = ""
        if key.startswith("rl_"):
            if isinstance(position, dict) and position.get("s") in imported_space_ids:
                mapped_room = replace(key, "layout.room_label", key[3:], resolve_room)
                if mapped_room is not None:
                    new_key, category = "rl_" + mapped_room, "layout.room_label"
            else:
                preserve_related(key, "layout.room_label", key[3:], resolve_room)
        elif key not in live_markers:
            mapped_marker = replace(key, "layout.marker", key, resolve_marker)
            if mapped_marker is not None:
                new_key, category = mapped_marker, "layout.marker"
        if new_key is None or new_key == key:
            continue
        if new_key in layout:
            _report_reference(report, "collisions", category, key, new_key)
        else:
            layout[new_key] = position
        del layout[key]
    return config, layout, repaired


def build_space_merge(
    document: dict[str, Any],
    current_config: dict[str, Any],
    current_layout: dict[str, Any],
    duplicate_policy: str,
    *,
    same_source: bool = False,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Create the exact independent space copy used by preview and apply."""
    if duplicate_policy not in ("skip", "virtual"):
        raise ImportFailure("invalid_format", "Unknown duplicate policy")
    incoming = _json_copy(document["payload"]["config"])
    spaces = incoming.get("spaces") or []
    if len(spaces) != 1:
        raise ImportFailure("invalid_config", "A space export must contain exactly one space")
    space = spaces[0]
    _materialize_space_background(space, "static")
    reference_report = _empty_reference_report()
    bounded_seen: set[tuple[str, str]] = set()
    target_config = _json_copy(current_config)
    target_layout = _json_copy(current_layout)
    used = {
        str(value)
        for sp in current_config.get("spaces") or []
        for collection in (
            (sp,), sp.get("rooms") or [], sp.get("room_drafts") or [],
            sp.get("partitions") or [], sp.get("wall_segments") or [],
            sp.get("wall_columns") or [],
            sp.get("openings") or [], sp.get("decor") or [],
        )
        for item in collection
        if isinstance(item, dict)
        for value in [item.get("id")]
        if value is not None
    } | {
        str(m.get("id")) for m in current_config.get("markers") or []
        if m.get("id") is not None
    } | {
        str(segment.get("id"))
        for sp in current_config.get("spaces") or []
        for draft in sp.get("room_drafts") or []
        for segment in draft.get("segments") or []
        if isinstance(segment, dict) and segment.get("id") is not None
    } | {
        str(value)
        for incoming_space in spaces
        for collection in (
            (incoming_space,), incoming_space.get("rooms") or [],
            incoming_space.get("room_drafts") or [],
            incoming_space.get("partitions") or [], incoming_space.get("wall_segments") or [],
            incoming_space.get("wall_columns") or [],
            incoming_space.get("openings") or [], incoming_space.get("decor") or [],
        )
        for item in collection
        if isinstance(item, dict)
        for value in [item.get("id")]
        if value is not None
    } | {
        str(m.get("id")) for m in incoming.get("markers") or []
        if m.get("id") is not None
    } | {
        str(segment.get("id"))
        for incoming_space in spaces
        for draft in incoming_space.get("room_drafts") or []
        for segment in draft.get("segments") or []
        if isinstance(segment, dict) and segment.get("id") is not None
    }
    old_space_id = str(space.get("id"))
    _record_bounded_lineage(
        reference_report, bounded_seen, "space", old_space_id,
    )
    new_space_id = _fresh("space", old_space_id, used)
    id_map: dict[str, str] = {old_space_id: new_space_id}
    id_maps: dict[str, dict[str, str]] = {
        prefix: {} for prefix in _IMPORT_ID_NAMESPACES
    }
    id_maps["space"][old_space_id] = new_space_id
    for collection, prefix in (
        ("rooms", "room"), ("room_drafts", "draft"), ("partitions", "partition"),
        ("wall_segments", "wall"),
        ("wall_columns", "column"), ("openings", "opening"), ("decor", "decor"),
    ):
        for item in space.get(collection) or []:
            if isinstance(item, dict) and item.get("id") is not None:
                old = str(item["id"])
                _record_bounded_lineage(
                    reference_report, bounded_seen, prefix, old,
                )
                id_map[old] = _fresh(prefix, old, used)
                id_maps[prefix][old] = id_map[old]
                item["id"] = id_map[old]
    for draft in space.get("room_drafts") or []:
        for segment in draft.get("segments") or []:
            if not isinstance(segment, dict) or segment.get("id") is None:
                continue
            old = str(segment["id"])
            _record_bounded_lineage(
                reference_report, bounded_seen, "draft_segment", old,
            )
            new = _fresh("draft_segment", old, used)
            id_map[old] = new
            id_maps["draft_segment"][old] = new
            segment["id"] = new
    old_room_ids = id_maps["room"]
    for room in space.get("rooms") or []:
        if room.get("open_to"):
            remapped_open_to = []
            for value in room["open_to"]:
                old_value = str(value)
                mapped_value = old_room_ids.get(old_value, old_value)
                remapped_open_to.append(mapped_value)
                if mapped_value != old_value:
                    _report_remap(
                        reference_report, "incoming", "room.open_to",
                        str(room.get("id", "?")), old_value,
                    )
            room["open_to"] = remapped_open_to
        if room.get("wall_ids"):
            room["wall_ids"] = [
                id_maps["wall"].get(str(value), str(value))
                for value in room["wall_ids"]
            ]
    # Opening ownership is part of the same space-local id graph. Remap the
    # nested reference together with the partition itself; otherwise the
    # invariant validator correctly rejects a copied space whose host.id still
    # names the source partition.
    for opening in space.get("openings") or []:
        host = opening.get("host") if isinstance(opening, dict) else None
        if isinstance(host, dict) and host.get("kind") in ("partition", "wall"):
            old_host_id = str(host.get("id"))
            if old_host_id in id_map:
                host["id"] = id_map[old_host_id]
                _report_remap(
                    reference_report, "incoming", "opening.host",
                    str(opening.get("id", "?")), old_host_id,
                )
    space["id"] = new_space_id
    space["title"] = _unique_title(
        str(space.get("title") or old_space_id), current_config.get("spaces") or []
    )

    incoming_layout = document["payload"].get("layout") or {}
    manifest = {
        str(item.get("layout_id", item.get("key"))): item
        for item in document.get("placement_manifest") or []
        if isinstance(item, dict)
    }
    incoming_bindings = _binding_inventory(incoming, incoming_layout, manifest)
    current_bindings = _binding_inventory(target_config, target_layout)
    duplicate = incoming_bindings & current_bindings
    marker_map: dict[str, str] = {}
    output_markers: list[dict[str, Any]] = []
    skipped: set[str] = set()
    virtualized_targets: set[str] = set()
    virtualized = 0
    dropped_marker_links = _transfer_dropped_marker_links(document)
    for marker in incoming.get("markers") or []:
        old_id = str(marker.get("id"))
        _record_bounded_lineage(
            reference_report, bounded_seen, "marker", old_id,
        )
        binding = _binding_key(marker)
        if binding in duplicate and duplicate_policy == "skip":
            skipped.add(old_id)
            continue
        new_id = _fresh("marker", old_id, used)
        marker_map[old_id] = new_id
        id_maps["marker"][old_id] = new_id
        marker["id"] = new_id
        marker["space"] = new_space_id
        _report_remap(
            reference_report, "incoming", "marker.space", new_id, old_space_id,
        )
        if marker.get("room_id") is not None:
            old_room_id = str(marker["room_id"])
            marker["room_id"] = old_room_ids.get(old_room_id, marker["room_id"])
            if marker["room_id"] != old_room_id:
                _report_remap(
                    reference_report, "incoming", "marker.room_id", new_id, old_room_id,
                )
        vacuum = marker.get("vacuum")
        if isinstance(vacuum, dict) and isinstance(vacuum.get("segment_map"), dict):
            remapped_segments = {}
            for key, value in vacuum["segment_map"].items():
                old_room_id = str(value)
                remapped_segments[key] = old_room_ids.get(old_room_id, value)
                if remapped_segments[key] != old_room_id:
                    _report_remap(
                        reference_report, "incoming", "marker.vacuum.segment_map",
                        new_id, old_room_id,
                    )
            vacuum["segment_map"] = remapped_segments
        if binding in duplicate and duplicate_policy == "virtual":
            virtualized += 1
            virtualized_targets.add(old_id)
            dropped_marker_links += sum(
                1 for ref in marker.get("controls") or []
                if isinstance(ref, str) and ref.startswith("marker:")
            )
            badge = marker.get("value_badge")
            source = badge.get("source") if isinstance(badge, dict) else None
            if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
                dropped_marker_links += 1
            value_source = marker.get("value_source")
            if isinstance(value_source, dict) \
                    and value_source.get("kind") == "derived_marker_state":
                dropped_marker_links += 1
            marker["binding"] = "virtual"
            marker["display"] = "static_icon"
            for field in (
                "area", "controls", "tap_action", "tap_target", "tap_confirm",
                "vacuum", "is_light", "use_climate_temp", "glow_color",
                "glow_radius_cm", "light_entity", "toggle_entity", "hidden", "removed",
                "value_badge", "value_source",
            ):
                marker.pop(field, None)
        output_markers.append(marker)

    # Marker links share the marker id namespace and therefore follow the same
    # remap as layout ownership. Targets skipped/virtualised by duplicate
    # policy are dropped explicitly; raw marker:* values must never leak into
    # the imported independent copy.
    for marker in output_markers:
        controls = marker.get("controls")
        if isinstance(controls, list):
            remapped = []
            for ref in controls:
                if not isinstance(ref, str) or not ref.startswith("marker:"):
                    remapped.append(ref)
                    continue
                old_target = ref[len("marker:"):]
                target = None if old_target in virtualized_targets else marker_map.get(old_target)
                if not target:
                    dropped_marker_links += 1
                    continue
                remapped.append("marker:" + target)
                _report_remap(
                    reference_report, "incoming", "marker.controls",
                    str(marker.get("id", "?")), old_target,
                )
            marker["controls"] = remapped or None
        badge = marker.get("value_badge")
        source = badge.get("source") if isinstance(badge, dict) else None
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            old_target = ref[len("marker:"):] if isinstance(ref, str) and ref.startswith("marker:") else ""
            target = None if old_target in virtualized_targets else marker_map.get(old_target)
            if target:
                source["ref"] = "marker:" + target
                _report_remap(
                    reference_report, "incoming", "marker.value_badge",
                    str(marker.get("id", "?")), old_target,
                )
            else:
                badge["enabled"] = False
                badge["source"] = None
                dropped_marker_links += 1
        source = marker.get("value_source")
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            old_target = ref[len("marker:"):] \
                if isinstance(ref, str) and ref.startswith("marker:") else ""
            target = None if old_target in virtualized_targets else marker_map.get(old_target)
            if target:
                source["ref"] = "marker:" + target
                _report_remap(
                    reference_report, "incoming", "marker.value_source",
                    str(marker.get("id", "?")), old_target,
                )
            else:
                marker.pop("value_source", None)
                dropped_marker_links += 1

    output_markers_by_id = {
        str(marker.get("id")): marker for marker in output_markers
        if marker.get("id") is not None
    }
    marker_link_map = {
        old_id: new_id for old_id, new_id in marker_map.items()
        if (target := output_markers_by_id.get(new_id)) is not None
        and target.get("removed") is not True
        and target.get("is_light") is True
    }
    target_config, target_layout, repaired_target_refs = _repair_target_space_refs(
        current_config, current_layout, id_maps, marker_link_map,
        reference_report, bounded_seen,
    )

    output_layout: dict[str, Any] = {}
    for key, pos in (document["payload"].get("layout") or {}).items():
        if key in skipped:
            continue
        new_key = marker_map.get(key)
        if new_key is None and key.startswith("rl_"):
            room_id = old_room_ids.get(key[3:])
            new_key = "rl_" + room_id if room_id else None
        layout_binding = _layout_binding(
            key, {str(marker.get("id")) for marker in incoming.get("markers") or []}, manifest
        )
        if new_key is None and layout_binding in duplicate and duplicate_policy == "skip":
            skipped.add(key)
            continue
        if new_key is None and same_source and layout_binding and layout_binding not in duplicate:
            # Same-instance layout-only owners remain discoverable.  Foreign
            # instances cannot safely claim that their opaque HA ids identify
            # the same target object and are materialised as virtual orphans.
            new_key = key
        if new_key is None:
            orphan = _orphan_marker(key, manifest.get(key), new_space_id, used)
            output_markers.append(orphan)
            new_key = orphan["id"]
            if layout_binding in duplicate and duplicate_policy == "virtual":
                virtualized += 1
        if new_key != key:
            _report_remap(
                reference_report, "incoming", "layout.owner", new_key, key,
            )
        old_layout_space = str(pos.get("s", "")) if isinstance(pos, dict) else ""
        if old_layout_space != new_space_id:
            _report_remap(
                reference_report, "incoming", "layout.space", new_key,
                old_layout_space,
            )
        output_layout[new_key] = {**pos, "s": new_space_id}

    merged_config = target_config
    merged_config.setdefault("spaces", []).append(space)
    merged_config.setdefault("markers", []).extend(output_markers)
    dropped_marker_links += _drop_invalid_import_marker_links(
        merged_config,
        clean_ids={str(marker.get("id")) for marker in output_markers},
    )
    merged_layout = {**target_layout, **output_layout}
    if len(merged_config.get("spaces") or []) > MAX_SPACES \
            or len(merged_config.get("markers") or []) > MAX_MARKERS \
            or len(merged_layout) > MAX_LAYOUT:
        raise ImportFailure("capacity_exceeded", "Merged plan exceeds an item limit")
    try:
        merged_config = CONFIG_SCHEMA(merged_config)
    except vol.Invalid as err:
        raise ImportFailure("invalid_config", str(err)) from err
    try:
        validate_marker_controls(merged_config, current_config)
        validate_marker_light_entities(merged_config, current_config)
        validate_marker_value_badges(merged_config, current_config)
        validate_opening_passages(merged_config, current_config)
        validate_partition_opening_hosts(merged_config, current_config)
    except (
        MarkerControlError, OpeningPassageError, PartitionOpeningHostError,
        PartitionOpeningJambMarginError,
    ) as err:
        raise ImportFailure(err.code, str(err)) from err
    try:
        merged_layout = LAYOUT_SCHEMA(merged_layout)
    except vol.Invalid as err:
        raise ImportFailure("invalid_layout", str(err)) from err
    if len(json.dumps(
        merged_config, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")) > MAX_CONFIG_BYTES:
        raise ImportFailure("capacity_exceeded", "Merged configuration exceeds the store limit")
    if dropped_marker_links:
        reference_report["droppedIncomingLinks"]["marker.links"] = dropped_marker_links
    return merged_config, merged_layout, {
        "space_id": new_space_id,
        "space_title": space["title"],
        "duplicates": len(duplicate),
        "skipped": len(skipped),
        "virtualized": virtualized,
        "orphan_markers": len(output_markers) - len(marker_map),
        "dropped_marker_links": dropped_marker_links,
        "repaired_target_refs": repaired_target_refs,
        "preserved_unresolved_refs": sum(
            int(value) for value in reference_report["preservedUnresolved"].values()
        ),
        "reference_report": reference_report,
    }


def _content_state(document: dict[str, Any], same_source: bool, config_root: Path) -> tuple[list[dict[str, Any]], bool]:
    """Validate the manifest against payload refs and resolve local policy.

    The manifest is descriptive, never authoritative: otherwise a crafted file
    could omit an internal ref or label it external and bypass the mandatory
    detach decision.  Every row must correspond exactly to a normalized config
    reference and its storage class is derived again on the target instance.
    """
    expected = content_manifest(document["payload"]["config"], config_root)
    supplied = document.get("content_manifest")
    if not isinstance(supplied, list):
        raise ImportFailure("invalid_content", "Missing content manifest")

    def identity(item: dict[str, Any]) -> tuple[str, str, str, str, str]:
        return (
            str(item.get("kind", "")), str(item.get("owner", "")),
            str(item.get("owner_id", "")), str(item.get("field", "")),
            str(item.get("url", "")),
        )

    supplied_by_id: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
    for item in supplied:
        if not isinstance(item, dict) or not isinstance(item.get("url"), str):
            raise ImportFailure("invalid_content", "Invalid content manifest")
        key = identity(item)
        if key in supplied_by_id:
            raise ImportFailure("invalid_content", "Duplicate content manifest row")
        supplied_by_id[key] = item
    expected_ids = {identity(item) for item in expected}
    if set(supplied_by_id) != expected_ids:
        raise ImportFailure("invalid_content", "Content manifest does not match payload references")

    rows: list[dict[str, Any]] = []
    confirmation = False
    for item in expected:
        row = dict(item)
        declared = supplied_by_id[identity(item)]
        row["exists_at_export"] = declared.get("exists_at_export")
        internal = _internal_path(config_root, item["url"])
        if _looks_internal(item["url"]) and internal is None:
            raise ImportFailure("invalid_content", "Non-canonical internal content URL")
        if internal is not None:
            exists = bool(internal and internal[1].is_file())
            row["exists_on_target"] = exists
            state = "available" if same_source and exists else "detach_required"
            confirmation = confirmation or state == "detach_required"
        else:
            state = "external"
        row["state"] = state
        rows.append(row)
    return rows, confirmation


def _detach_missing(config: dict[str, Any], content: list[dict[str, Any]]) -> None:
    spaces = {str(sp.get("id")): sp for sp in config.get("spaces") or []}
    markers = {str(m.get("id")): m for m in config.get("markers") or []}
    for item in content:
        if item.get("state") != "detach_required":
            continue
        if item.get("owner") == "space":
            owner = spaces.get(str(item.get("owner_id")))
            if owner:
                owner["plan_url"] = None
        elif item.get("owner") == "marker":
            owner = markers.get(str(item.get("owner_id")))
            if owner:
                url = item.get("url")
                owner["pdfs"] = [pdf for pdf in owner.get("pdfs") or [] if pdf.get("url") != url]


def _binding_preview(
    config: dict[str, Any],
    layout: dict[str, Any],
    document: dict[str, Any],
    registry: dict[str, set[str]] | None,
) -> dict[str, int]:
    manifest = {
        str(item.get("layout_id", item.get("key"))): item
        for item in document.get("placement_manifest") or []
        if isinstance(item, dict)
    }
    bindings = _binding_inventory(config, layout, manifest)
    result = {
        "device": sum(value.startswith("device:") for value in bindings),
        "entity": sum(value.startswith("entity:") for value in bindings),
        "virtual": sum(
            marker.get("binding") == "virtual" for marker in config.get("markers") or []
        ),
        "active": 0,
        "disabled": 0,
        "missing": 0,
    }
    if registry is None:
        return result
    for binding in bindings:
        prefix, _, target = binding.partition(":")
        if target in registry.get(f"disabled_{prefix}", set()):
            result["disabled"] += 1
        elif target in registry.get(f"active_{prefix}", set()):
            result["active"] += 1
        else:
            result["missing"] += 1
    return result


def _missing_areas(
    config: dict[str, Any], registry: dict[str, set[str]] | None,
) -> list[str]:
    if registry is None:
        return []
    available = registry.get("areas", set())
    incoming = {
        str(room.get("area"))
        for space in config.get("spaces") or []
        for room in space.get("rooms") or []
        if room.get("area")
    }
    return sorted(incoming - available)


def _materialize_import_candidate(
    document: dict[str, Any],
    current_config: dict[str, Any],
    current_layout: dict[str, Any],
    *,
    duplicate_policy: str,
    same_source: bool,
    content: list[dict[str, Any]],
    confirmation_required: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Build once the normalized config/layout that the preview may apply."""
    prepared = _json_copy(document)
    imported_config = prepared["payload"]["config"]
    if confirmation_required:
        _detach_missing(imported_config, content)
    incoming_model = int(prepared.get("model_version", 0) or 0)
    target_model = int(current_config.get("model_version", 0) or 0)
    requires_v8 = incoming_model >= 8 or target_model >= 8
    if requires_v8:
        try:
            # A v8 target cannot be downgraded by a v7 backup, while an
            # incoming v8 graph must retain its already-persisted IDs. When
            # both sides are v7 the accepted compatibility contract keeps the
            # import v7 until a later structural write or explicit Optimize.
            imported_config["model_version"] = incoming_model
            imported_config, _ = commit_wall_segment_model(imported_config)
            prepared["payload"]["config"] = imported_config
            if prepared["kind"] == "space":
                current_config, _ = commit_wall_segment_model(current_config)
        except WallSegmentMigrationError as err:
            raise ImportFailure(err.code, str(err)) from err
    if prepared["kind"] == "space":
        config, layout, details = build_space_merge(
            prepared, current_config, current_layout, duplicate_policy,
            same_source=same_source,
        )
    else:
        config = imported_config
        if not requires_v8 and incoming_model > 0:
            config["model_version"] = incoming_model
        _materialize_global_background(config)
        layout = _json_copy(prepared["payload"]["layout"])
        if not same_source:
            settings = config.get("settings") or {}
            settings.pop("known_devices", None)
            settings.pop("new_device_ids", None)
        details = {
            "dropped_marker_links": _transfer_dropped_marker_links(prepared),
        }
    try:
        config = CONFIG_SCHEMA(config)
    except vol.Invalid as err:
        raise ImportFailure("invalid_config", str(err)) from err
    try:
        layout = LAYOUT_SCHEMA(layout)
    except vol.Invalid as err:
        raise ImportFailure("invalid_layout", str(err)) from err
    details = _json_copy(details)
    details["counts"] = _counts(config, layout)
    return config, layout, details


def _candidate_digest(candidate: dict[str, Any]) -> str:
    """Bind a token to both its source and the exact normalized target pair."""
    return _document_digest({
        "document": candidate.get("document"),
        "duplicate_policy": candidate.get("duplicate_policy"),
        "config_rev": candidate.get("config_rev"),
        "layout_rev": candidate.get("layout_rev"),
        "content": candidate.get("content"),
        "confirmation_required": candidate.get("confirmation_required"),
        "same_source": candidate.get("same_source"),
        "target_config": candidate.get("target_config"),
        "target_layout": candidate.get("target_layout"),
        "details": candidate.get("details"),
    })


def create_preview(
    runtime: HouseplanData,
    raw: bytes,
    *,
    owner_id: str,
    duplicate_policy: str,
    current_config_data: dict[str, Any],
    current_layout_data: dict[str, Any],
    config_root: Path,
    registry_snapshot: dict[str, set[str]] | None = None,
) -> dict[str, Any]:
    document = parse_document(raw)
    same_source = document.get("source_fingerprint") == source_fingerprint(runtime.instance_id)
    incoming_config = document["payload"]["config"]
    incoming_layout = document["payload"]["layout"]
    current_config = current_config_data.get("config") or {"spaces": [], "markers": [], "settings": {}}
    current_layout = current_layout_data.get("layout") or {}
    details: dict[str, Any] = {}
    try:
        # Every imported opening is new to this installation. A forged full or
        # one-space file must not use the broken-read exception reserved for an
        # already stored legacy passage.
        validate_opening_passages(incoming_config, validate_all=True)
    except OpeningPassageError as err:
        raise ImportFailure(err.code, str(err)) from err
    if document["kind"] == "full":
        dropped_marker_links = _transfer_dropped_marker_links(document)
        dropped_marker_links += _drop_invalid_import_marker_links(incoming_config)
        document["transfer"]["dropped_marker_links"] = dropped_marker_links
        try:
            validate_marker_controls(incoming_config, validate_all=True)
            validate_marker_light_entities(incoming_config, validate_all=True)
            validate_marker_value_badges(incoming_config, validate_all=True)
        except MarkerControlError as err:
            raise ImportFailure(err.code, str(err)) from err
    content, confirmation = _content_state(document, same_source, config_root)
    target_config, target_layout, details = _materialize_import_candidate(
        document, current_config, current_layout,
        duplicate_policy=duplicate_policy,
        same_source=same_source,
        content=content,
        confirmation_required=confirmation,
    )
    token = secrets.token_urlsafe(32)
    now = time.time()
    candidate = {
        "owner_id": owner_id,
        "created": now,
        "expires": now + IMPORT_PREVIEW_TTL_S,
        "document": document,
        "duplicate_policy": duplicate_policy,
        "config_rev": int(current_config_data.get("rev", 0)),
        "layout_rev": int(current_layout_data.get("rev", 0)),
        "content": content,
        "confirmation_required": confirmation,
        "same_source": same_source,
        "target_config": target_config,
        "target_layout": target_layout,
        "details": details,
    }
    candidate["digest"] = _candidate_digest(candidate)
    # Opportunistic expiry and per-user oldest-first eviction.
    runtime.import_previews = {
        key: value for key, value in runtime.import_previews.items()
        if value.get("expires", 0) > now
    }
    mine = [key for key, value in runtime.import_previews.items() if value.get("owner_id") == owner_id]
    while len(mine) >= MAX_IMPORT_PREVIEWS_PER_USER:
        runtime.import_previews.pop(mine.pop(0), None)
    while len(runtime.import_previews) >= MAX_IMPORT_PREVIEWS_TOTAL:
        runtime.import_previews.pop(next(iter(runtime.import_previews)), None)
    runtime.import_previews[token] = candidate
    preview = {
        "kind": document["kind"],
        "plan_only": _transfer_plan_only(document),
        "created_at": document.get("created_at"),
        "card_version": document.get("card_version"),
        "integration_version": document.get("integration_version"),
        "model_version": document.get("model_version", 0),
        "source": "same" if same_source else "foreign",
        "counts": _counts(incoming_config, incoming_layout),
        "current_counts": _counts(current_config, current_layout),
        "legacy_positions": sum(
            1 for pos in incoming_layout.values()
            if isinstance(pos, dict) and not pos.get("s")
        ),
        "bindings": _binding_preview(incoming_config, incoming_layout, document, registry_snapshot),
        "missing_areas": _missing_areas(incoming_config, registry_snapshot),
        "content": content,
        "confirmation_required": confirmation,
        "warnings": (["foreign_source"] if not same_source else [])
            + (["instance_bookkeeping_dropped"] if not same_source and document["kind"] == "full" else [])
            + (["content_detach_required"] if confirmation else [])
            + (["full_replaces_current"] if document["kind"] == "full" else []),
        **details,
    }
    return {
        "token": token,
        "preview": preview,
        "expected_config_rev": candidate["config_rev"],
        "expected_layout_rev": candidate["layout_rev"],
        "expires_at": datetime.fromtimestamp(candidate["expires"], UTC).isoformat().replace("+00:00", "Z"),
    }


def get_candidate(runtime: HouseplanData, token: str, owner_id: str, *, consume: bool = False) -> dict[str, Any]:
    candidate = runtime.import_previews.get(token)
    if not candidate or candidate.get("expires", 0) <= time.time():
        runtime.import_previews.pop(token, None)
        raise ImportFailure("preview_expired", "Import preview expired")
    if candidate.get("owner_id") != owner_id:
        raise ImportFailure("preview_owner_mismatch", "Preview belongs to another user")
    if candidate.get("digest") != _candidate_digest(candidate):
        runtime.import_previews.pop(token, None)
        raise ImportFailure("invalid_format", "Import preview candidate changed")
    if consume:
        runtime.import_previews.pop(token, None)
    return candidate


def revalidate_candidate(
    candidate: dict[str, Any],
    current_config_data: dict[str, Any],
    current_layout_data: dict[str, Any],
    *,
    duplicate_policy: str,
    registry_snapshot: dict[str, set[str]] | None = None,
    config_root: Path | None = None,
) -> dict[str, Any]:
    """Refresh target-dependent preview data without uploading the file again."""
    document = candidate["document"]
    current_config = current_config_data.get("config") or {
        "spaces": [], "markers": [], "settings": {},
    }
    current_layout = current_layout_data.get("layout") or {}
    if config_root is not None:
        content, confirmation = _content_state(
            document, bool(candidate.get("same_source")), config_root
        )
        candidate["content"] = content
        candidate["confirmation_required"] = confirmation
    target_config, target_layout, details = _materialize_import_candidate(
        document, current_config, current_layout,
        duplicate_policy=duplicate_policy,
        same_source=bool(candidate.get("same_source")),
        content=candidate.get("content") or [],
        confirmation_required=bool(candidate.get("confirmation_required")),
    )
    candidate["duplicate_policy"] = duplicate_policy
    candidate["config_rev"] = int(current_config_data.get("rev", 0))
    candidate["layout_rev"] = int(current_layout_data.get("rev", 0))
    candidate["target_config"] = target_config
    candidate["target_layout"] = target_layout
    candidate["details"] = details
    candidate["digest"] = _candidate_digest(candidate)
    incoming = document["payload"]
    return {
        "preview": {
            "kind": document["kind"],
            "plan_only": _transfer_plan_only(document),
            "counts": _counts(incoming["config"], incoming["layout"]),
            "current_counts": _counts(current_config, current_layout),
            "source": "same" if candidate.get("same_source") else "foreign",
            "content": candidate.get("content") or [],
            "confirmation_required": candidate.get("confirmation_required", False),
            "bindings": _binding_preview(
                incoming["config"], incoming["layout"], candidate["document"], registry_snapshot
            ),
            "missing_areas": _missing_areas(incoming["config"], registry_snapshot),
            **details,
        },
        "expected_config_rev": candidate["config_rev"],
        "expected_layout_rev": candidate["layout_rev"],
    }


def prepare_apply(
    candidate: dict[str, Any],
    current_config: dict[str, Any],
    current_layout: dict[str, Any],
    *,
    duplicate_policy: str | None = None,
    confirm_missing_content: bool,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if candidate.get("confirmation_required") and not confirm_missing_content:
        raise ImportFailure("content_confirmation_required", "Missing content must be confirmed")
    if duplicate_policy is not None and duplicate_policy != candidate.get("duplicate_policy"):
        raise ImportFailure("conflict", "Duplicate policy changed after the preview")
    if candidate.get("digest") != _candidate_digest(candidate):
        raise ImportFailure("invalid_format", "Import preview candidate changed")
    config = candidate.get("target_config")
    layout = candidate.get("target_layout")
    details = candidate.get("details")
    if not isinstance(config, dict) or not isinstance(layout, dict) \
            or not isinstance(details, dict):
        raise ImportFailure("invalid_format", "Import preview has no materialized candidate")
    # The current stores are intentionally unused: revisions are checked by
    # the websocket handler under the write lock before this function runs.
    _ = current_config, current_layout
    return _json_copy(config), _json_copy(layout), _json_copy(details)
