"""Portable House Plan backup/export and two-phase import service.

The browser never interprets an import document.  It uploads bytes for a
bounded server-side preview, receives a short-lived opaque token and can apply
only the exact candidate that produced that preview.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import secrets
import time
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

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
    MarkerControlError,
)

FORMAT = "houseplan-export"
_PROTO_KEYS = {"__proto__", "prototype", "constructor"}
_SAFE_FILE = re.compile(r"[^A-Za-z0-9._-]+")


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
    card_version: str,
    config_root: Path,
) -> tuple[dict[str, Any], str]:
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
    layout = live_layout(config, LAYOUT_SCHEMA(_json_copy(layout_data.get("layout") or {})))
    stamp = datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S")
    title = ""
    dropped_marker_links = 0
    if kind == "space":
        space = next((sp for sp in config.get("spaces") or [] if str(sp.get("id")) == space_id), None)
        if not space:
            raise ImportFailure("space_not_found", "Space was not found")
        title = str(space.get("title") or space.get("id") or "space")
        selected_layout = {
            key: pos for key, pos in layout.items()
            if isinstance(pos, dict) and str(pos.get("s")) == str(space_id)
        }
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
            badge = marker.get("value_badge")
            source = badge.get("source") if isinstance(badge, dict) else None
            ref = source.get("ref") if isinstance(source, dict) \
                and source.get("kind") == "derived_marker_state" else None
            if isinstance(ref, str) and ref.startswith("marker:") \
                    and ref[len("marker:"):] not in selected_ids:
                badge["enabled"] = False
                badge["source"] = None
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
        "transfer": {"dropped_marker_links": dropped_marker_links},
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
        config = CONFIG_SCHEMA(_json_copy(payload.get("config")))
    except (vol.Invalid, TypeError, ValueError) as err:
        raise ImportFailure("invalid_config", str(err)) from err
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
    document["transfer"] = {
        **(document.get("transfer") or {}),
        "dropped_marker_links": dropped_marker_links,
    }
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
    maximum = MAX_MARKERS * (MAX_CONTROLS + 1)
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum:
        raise ImportFailure("invalid_format", "Invalid dropped marker link count")
    return value


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


def _fresh(prefix: str, old: str, used: set[str]) -> str:
    stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", old).strip("_")[:35] or prefix
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
    used = {
        str(value)
        for sp in current_config.get("spaces") or []
        for value in [sp.get("id")]
    } | {str(m.get("id")) for m in current_config.get("markers") or []}
    old_space_id = str(space.get("id"))
    new_space_id = _fresh("space", old_space_id, used)
    id_map: dict[str, str] = {old_space_id: new_space_id}
    for collection, prefix in (
        ("rooms", "room"), ("room_drafts", "draft"), ("partitions", "partition"),
        ("wall_columns", "column"), ("openings", "opening"), ("decor", "decor"),
    ):
        for item in space.get(collection) or []:
            if isinstance(item, dict) and item.get("id") is not None:
                old = str(item["id"])
                id_map[old] = _fresh(prefix, old, used)
                item["id"] = id_map[old]
    old_room_ids = {
        old: new for old, new in id_map.items() if old != old_space_id and new.startswith("room_")
    }
    for room in space.get("rooms") or []:
        if room.get("open_to"):
            room["open_to"] = [old_room_ids.get(str(value), str(value)) for value in room["open_to"]]
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
    current_bindings = _binding_inventory(current_config, current_layout)
    duplicate = incoming_bindings & current_bindings
    marker_map: dict[str, str] = {}
    output_markers: list[dict[str, Any]] = []
    skipped: set[str] = set()
    virtualized_targets: set[str] = set()
    virtualized = 0
    dropped_marker_links = _transfer_dropped_marker_links(document)
    for marker in incoming.get("markers") or []:
        old_id = str(marker.get("id"))
        binding = _binding_key(marker)
        if binding in duplicate and duplicate_policy == "skip":
            skipped.add(old_id)
            continue
        new_id = _fresh("marker", old_id, used)
        marker_map[old_id] = new_id
        marker["id"] = new_id
        marker["space"] = new_space_id
        if marker.get("room_id") is not None:
            marker["room_id"] = old_room_ids.get(str(marker["room_id"]), marker["room_id"])
        vacuum = marker.get("vacuum")
        if isinstance(vacuum, dict) and isinstance(vacuum.get("segment_map"), dict):
            vacuum["segment_map"] = {
                key: old_room_ids.get(str(value), value)
                for key, value in vacuum["segment_map"].items()
            }
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
            marker["binding"] = "virtual"
            marker["display"] = "static_icon"
            for field in (
                "area", "controls", "tap_action", "tap_target", "tap_confirm",
                "vacuum", "is_light", "use_climate_temp", "glow_color",
                "glow_radius_cm", "light_entity", "hidden", "removed",
                "value_badge",
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
            marker["controls"] = remapped or None
        badge = marker.get("value_badge")
        source = badge.get("source") if isinstance(badge, dict) else None
        if isinstance(source, dict) and source.get("kind") == "derived_marker_state":
            ref = source.get("ref")
            old_target = ref[len("marker:"):] if isinstance(ref, str) and ref.startswith("marker:") else ""
            target = None if old_target in virtualized_targets else marker_map.get(old_target)
            if target:
                source["ref"] = "marker:" + target
            else:
                badge["enabled"] = False
                badge["source"] = None
                dropped_marker_links += 1

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
        output_layout[new_key] = {**pos, "s": new_space_id}

    merged_config = _json_copy(current_config)
    merged_config.setdefault("spaces", []).append(space)
    merged_config.setdefault("markers", []).extend(output_markers)
    dropped_marker_links += _drop_invalid_import_marker_links(
        merged_config,
        clean_ids={str(marker.get("id")) for marker in output_markers},
    )
    merged_layout = {**_json_copy(current_layout), **output_layout}
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
    except MarkerControlError as err:
        raise ImportFailure(err.code, str(err)) from err
    try:
        merged_layout = LAYOUT_SCHEMA(merged_layout)
    except vol.Invalid as err:
        raise ImportFailure("invalid_layout", str(err)) from err
    if len(json.dumps(
        merged_config, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")) > MAX_CONFIG_BYTES:
        raise ImportFailure("capacity_exceeded", "Merged configuration exceeds the store limit")
    return merged_config, merged_layout, {
        "space_id": new_space_id,
        "space_title": space["title"],
        "duplicates": len(duplicate),
        "skipped": len(skipped),
        "virtualized": virtualized,
        "orphan_markers": len(output_markers) - len(marker_map),
        "dropped_marker_links": dropped_marker_links,
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
    if document["kind"] == "space":
        _merged_config, _merged_layout, details = build_space_merge(
            document, current_config, current_layout, duplicate_policy,
            same_source=same_source,
        )
    else:
        dropped_marker_links = _transfer_dropped_marker_links(document)
        dropped_marker_links += _drop_invalid_import_marker_links(incoming_config)
        document["transfer"]["dropped_marker_links"] = dropped_marker_links
        details["dropped_marker_links"] = dropped_marker_links
        try:
            validate_marker_controls(incoming_config, validate_all=True)
            validate_marker_light_entities(incoming_config, validate_all=True)
            validate_marker_value_badges(incoming_config, validate_all=True)
        except MarkerControlError as err:
            raise ImportFailure(err.code, str(err)) from err
    content, confirmation = _content_state(document, same_source, config_root)
    token = secrets.token_urlsafe(32)
    now = time.time()
    candidate = {
        "owner_id": owner_id,
        "created": now,
        "expires": now + IMPORT_PREVIEW_TTL_S,
        "digest": _document_digest(document),
        "document": document,
        "duplicate_policy": duplicate_policy,
        "config_rev": int(current_config_data.get("rev", 0)),
        "layout_rev": int(current_layout_data.get("rev", 0)),
        "content": content,
        "confirmation_required": confirmation,
        "same_source": same_source,
    }
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
    if candidate.get("digest") != _document_digest(candidate.get("document") or {}):
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
    details: dict[str, Any] = {}
    if document["kind"] == "space":
        _config, _layout, details = build_space_merge(
            document, current_config, current_layout, duplicate_policy,
            same_source=bool(candidate.get("same_source")),
        )
    if config_root is not None:
        content, confirmation = _content_state(
            document, bool(candidate.get("same_source")), config_root
        )
        candidate["content"] = content
        candidate["confirmation_required"] = confirmation
    candidate["duplicate_policy"] = duplicate_policy
    candidate["config_rev"] = int(current_config_data.get("rev", 0))
    candidate["layout_rev"] = int(current_layout_data.get("rev", 0))
    incoming = document["payload"]
    return {
        "preview": {
            "kind": document["kind"],
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
    document = candidate["document"]
    # Detachment is defined in the exported identity space.  Do it before a
    # space import remaps owners to fresh ids.
    imported_config = _json_copy(document["payload"]["config"])
    if candidate.get("confirmation_required"):
        _detach_missing(imported_config, candidate.get("content") or [])
    if document["kind"] == "full":
        config = imported_config
        # Full exports keep the data-model version in the portable envelope so
        # the payload can be validated independently.  Restore it before the
        # configuration is persisted; otherwise every full round-trip silently
        # downgrades the stored plan to an unversioned document.
        model_version = document.get("model_version", 0)
        if isinstance(model_version, int) and not isinstance(model_version, bool) \
                and model_version > 0:
            config["model_version"] = model_version
        layout = _json_copy(document["payload"]["layout"])
        if not candidate.get("same_source"):
            settings = config.get("settings") or {}
            settings.pop("known_devices", None)
            settings.pop("new_device_ids", None)
        details = {"counts": _counts(config, layout)}
    else:
        local_document = {**document, "payload": {**document["payload"], "config": imported_config}}
        config, layout, details = build_space_merge(
            local_document, current_config, current_layout,
            duplicate_policy or candidate.get("duplicate_policy", "skip"),
            same_source=bool(candidate.get("same_source")),
        )
        details["counts"] = _counts(config, layout)
    return CONFIG_SCHEMA(config), LAYOUT_SCHEMA(layout), details
