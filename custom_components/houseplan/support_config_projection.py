"""Additional, closed config projection for support package 2 (#942).

The legacy serializer is frozen. This module augments its NEW diagnostic copy,
never the stored config. No provider responses, source values or file URLs.
"""

from __future__ import annotations

from typing import Any

from .support_diagnostic_values import DiagnosticIds, finite


def _scalars(
    source: object,
    *,
    numbers: tuple[str, ...] = (),
    booleans: tuple[str, ...] = (),
    enums: dict[str, set] | None = None,
) -> dict:
    if not isinstance(source, dict):
        return {}
    out: dict[str, Any] = {}
    for key in numbers + booleans + tuple(enums or {}):
        if key not in source:
            continue
        value = source[key]
        if value is None:
            out[key] = None
        elif key in numbers and finite(value):
            out[key] = value
        elif key in booleans and isinstance(value, bool):
            out[key] = value
        elif (
            key in (enums or {})
            and isinstance(value, (str, int))
            and not isinstance(value, bool)
            and value in enums[key]
        ):
            out[key] = value
    return out


def _refs(out: dict, source: dict, ids: DiagnosticIds, fields: dict[str, str]) -> None:
    for key, kind in fields.items():
        if key in source:
            out[key] = ids.get(kind, source[key])


def _value_source(value: object, ids: DiagnosticIds) -> dict | None:
    if not isinstance(value, dict):
        return None
    kind = value.get("kind")
    if kind == "derived_lqi":
        return {"kind": kind}
    if kind == "derived_marker_state":
        raw = value.get("ref")
        if not isinstance(raw, str):
            return None
        return {
            "kind": kind,
            "ref": "marker:" + ids.get("marker", raw.removeprefix("marker:")),
        }
    if kind not in {"entity_state", "entity_attribute"}:
        return None
    out = {"kind": kind}
    _refs(out, value, ids, {"entity_id": "entity"})
    if kind == "entity_attribute":
        _refs(out, value, ids, {"attribute": "attribute"})
    return out


def _matrix(value: object) -> object:
    if value is None:
        return None
    if (
        isinstance(value, (list, tuple))
        and len(value) == 6
        and all(finite(n) for n in value)
    ):
        # A singular matrix remains singular. This diagnostic never repairs it.
        return list(value)
    return {"status": "invalid"}


def _vacuum(value: object, ids: DiagnosticIds) -> dict | None:
    if not isinstance(value, dict):
        return None
    out = _scalars(
        value,
        booleans=("live", "trail", "room_highlight", "new_run_after_dock"),
        enums={"trail_mode": {"never", "cleaning", "always"}},
    )
    _refs(out, value, ids, {"source": "entity"})
    if "calibration" in value:
        raw = value["calibration"]
        out["calibration"] = (
            {ids.get("map", key): _matrix(matrix) for key, matrix in raw.items()}
            if isinstance(raw, dict)
            else None
        )
    if "segment_map" in value:
        raw = value["segment_map"]
        out["segment_map"] = (
            {
                ids.get("segment", key): ids.get("room", room)
                for key, room in raw.items()
            }
            if isinstance(raw, dict)
            else None
        )
    if "map_routes" in value:
        raw = value["map_routes"]
        out["map_routes"] = None
        if isinstance(raw, list):
            out["map_routes"] = []
            for route in raw:
                if not isinstance(route, dict):
                    continue
                projected: dict[str, Any] = {}
                _refs(
                    projected,
                    route,
                    ids,
                    {
                        "id": "route",
                        "source": "entity",
                        "map_id": "map",
                        "space": "space",
                    },
                )
                if "calibration" in route:
                    projected["calibration"] = _matrix(route["calibration"])
                out["map_routes"].append(projected)
    return out


def _radar(value: object, ids: DiagnosticIds) -> dict | None:
    if not isinstance(value, dict):
        return None
    if value.get("version") != 1 or isinstance(value.get("version"), bool):
        return {"status": "unsupported_version"}
    out = {
        "version": 1,
        **_scalars(
            value,
            booleans=("enabled", "show_live"),
            enums={
                "profile": {
                    "esphome_ld2450_v1",
                    "cartesian_v1",
                    "polar_v1",
                    "range_v1",
                    "zones_v1",
                    "presence_v1",
                },
            },
        ),
    }
    _refs(out, value, ids, {"room_id": "room"})
    if isinstance(value.get("allowed_room_ids"), list):
        out["allowed_room_ids"] = [
            ids.get("room", item) for item in value["allowed_room_ids"]
        ]
    sources = value.get("sources")
    if isinstance(sources, dict):
        safe: dict[str, Any] = {}
        _refs(
            safe,
            sources,
            ids,
            {
                key: "entity"
                for key in ("occupancy_entity", "count_entity", "availability_entity")
            },
        )
        for group in ("slots", "ranges", "zones"):
            if not isinstance(sources.get(group), list):
                continue
            safe[group] = []
            for row in sources[group]:
                if not isinstance(row, dict):
                    continue
                projected = _scalars(
                    row,
                    booleans=("swap_xy", "angle_clockwise"),
                    enums={
                        "unit": {"mm", "cm", "m", "in", "ft"},
                        "x_sign": {-1, 1},
                        "y_sign": {-1, 1},
                        "angle_unit": {"degrees", "radians"},
                        "angle_zero": {"forward", "right"},
                        "kind": {"occupancy", "count"},
                    },
                )
                _refs(
                    projected,
                    row,
                    ids,
                    {
                        "id": "radar-slot",
                        **{
                            key: "entity"
                            for key in (
                                "x_entity",
                                "y_entity",
                                "distance_entity",
                                "angle_entity",
                                "entity_id",
                                "presence_entity",
                            )
                        },
                    },
                )
                safe[group].append(projected)
        out["sources"] = safe
    mount = value.get("mount")
    if isinstance(mount, dict):
        out["mount"] = _scalars(
            mount, numbers=("x", "y", "heading_deg", "range_cm", "fov_deg")
        )
        _refs(out["mount"], mount, ids, {"installation_id": "installation"})
    calibration = value.get("calibration")
    if isinstance(calibration, dict):
        safe = _scalars(
            calibration,
            numbers=("cell_cm", "rms_cm"),
            booleans=("mirror",),
            enums={"method": {"manual", "two_point", "not_required"}},
        )
        if isinstance(calibration.get("refs"), list):
            safe["refs"] = [
                {
                    key: _scalars(row[key], numbers=("x", "y"))
                    for key in ("plan", "local_cm")
                    if isinstance(row.get(key), dict)
                }
                for row in calibration["refs"]
                if isinstance(row, dict)
            ]
        out["calibration"] = safe
    return out


def _summary(value: object, ids: DiagnosticIds) -> dict | None:
    if not isinstance(value, dict):
        return None
    if value.get("version") != 1 or isinstance(value.get("version"), bool):
        return {"status": "unsupported_version"}
    out: dict[str, Any] = {
        "version": 1,
        "title": "[redacted text]",
        **_scalars(value, booleans=("show_on_mobile",)),
    }
    out["blocks"] = []
    for block in value.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        safe: dict[str, Any] = {
            "id": ids.get("summary-block", block.get("id")),
            "title": "[redacted text]",
            "values": [],
            **_scalars(block, booleans=("visible",)),
        }
        scope = block.get("scope")
        if isinstance(scope, dict) and scope.get("type") in {"all", "space"}:
            safe["scope"] = {"type": scope["type"]}
            _refs(safe["scope"], scope, ids, {"space_id": "space"})
        for row in block.get("values") or []:
            if not isinstance(row, dict):
                continue
            item = {
                "id": ids.get("summary-value", row.get("id")),
                "label": "[redacted text]",
            }
            source = row.get("source")
            if isinstance(source, dict):
                if source.get("type") == "entity":
                    item["source"] = {
                        "type": "entity",
                        "entity_id": ids.get("entity", source.get("entity_id")),
                    }
                elif source.get("type") == "system" and source.get("key") in {
                    "device_count",
                    "total_area",
                    "datetime",
                }:
                    item["source"] = {"type": "system", "key": source["key"]}
            safe["values"].append(item)
        out["blocks"].append(safe)
    return out


def extend_config_projection(config: dict, projected: dict, ids: DiagnosticIds) -> None:
    """Augment only matching projected records; unknown future data stays inert."""
    settings = config.get("settings") or {}
    safe_settings = projected["settings"]
    safe_settings.update(
        _scalars(
            settings, booleans=("filter_seeded", "group_lights", "show_room_tooltip")
        )
    )
    if "summary_panel" in settings:
        safe_settings["summary_panel"] = _summary(settings["summary_panel"], ids)
    if "external_screens" in settings:
        screens = settings["external_screens"]
        if isinstance(screens, dict) and type(screens.get("version")) is int and screens["version"] == 1:
            rows = []
            for row in screens.get("screens", []):
                if not isinstance(row, dict):
                    continue
                safe = _scalars(row, numbers=("id", "rotation", "cycle", "idle", "icon_scale", "font_scale"), booleans=("controls",))
                for key in ("summary", "hidden_devices"):
                    if row.get(key) in ("local", "show", "hide"):
                        safe[key] = row[key]
                safe["space"] = ids.get("space", row["space"]) if row.get("space") else None
                rows.append(safe)
            safe_settings["external_screens"] = {"version": 1, "next_id": screens.get("next_id"), "screens": rows}
        else:
            safe_settings["external_screens"] = {"status": "unsupported_version"}
    if isinstance(settings.get("exclude_integrations"), list):
        safe_settings["exclude_integrations"] = [
            ids.get("integration", item) for item in settings["exclude_integrations"]
        ]
    if isinstance(settings.get("radar"), dict):
        safe_settings["radar"] = _scalars(settings["radar"], booleans=("show_live",))

    markers = {
        ids.get("marker", item.get("id")): item
        for item in config.get("markers") or []
        if isinstance(item, dict)
    }
    for safe in projected["markers"]:
        source = markers.get(safe["id"], {})
        _refs(
            safe,
            source,
            ids,
            {
                "area": "area",
                "space": "space",
                "room_id": "room",
                "light_entity": "entity",
                "toggle_entity": "entity",
                "more_info_entity": "entity",
                "tap_target": "entity",
            },
        )
        if "controls" in source:
            safe["controls"] = (
                [
                    ("marker:" + ids.get("marker", item[7:]))
                    if isinstance(item, str) and item.startswith("marker:")
                    else ids.get("entity", item)
                    for item in source["controls"]
                ]
                if isinstance(source["controls"], list)
                else None
            )
        for key in ("vacuum", "radar", "value_source"):
            if key in source:
                safe[key] = {
                    "vacuum": _vacuum,
                    "radar": _radar,
                    "value_source": _value_source,
                }[key](source[key], ids)
        if "value_badge" in source:
            badge = source["value_badge"]
            safe["value_badge"] = None
            if isinstance(badge, dict):
                safe["value_badge"] = _scalars(
                    badge,
                    booleans=("enabled",),
                    enums={"position": {"right", "bottom", "left", "top"}},
                )
                if "source" in badge:
                    safe["value_badge"]["source"] = _value_source(badge["source"], ids)

    spaces = {
        ids.get("space", item.get("id")): item
        for item in config.get("spaces") or []
        if isinstance(item, dict)
    }
    for safe in projected["spaces"]:
        source = spaces.get(safe["id"], {})
        rooms = {
            ids.get("room", item.get("id")): item
            for item in source.get("rooms") or []
            if isinstance(item, dict)
        }
        for room in safe["rooms"]:
            original = rooms.get(room["id"], {})
            _refs(room, original, ids, {"area": "area"})
            settings = original.get("settings")
            if isinstance(settings, dict):
                room.setdefault("settings", {}).update(
                    _scalars(settings, numbers=("temp_min", "temp_max"))
                )
                for key in ("temp_source", "hum_source", "co2_source"):
                    if key in settings and settings[key] is None:
                        room["settings"][key] = None
        if "led_strips" in source:
            safe["led_strips"] = []
            for strip in source.get("led_strips") or []:
                if not isinstance(strip, dict):
                    continue
                row = {
                    "id": ids.get("led", strip.get("id")),
                    "marker": ids.get("marker", strip.get("marker")),
                    "points": [
                        [p[0], p[1]]
                        for p in strip.get("points") or []
                        if isinstance(p, (list, tuple))
                        and len(p) == 2
                        and all(finite(n) for n in p)
                    ],
                    **_scalars(strip, booleans=("active",)),
                }
                safe["led_strips"].append(row)
        decor = {
            ids.get("decor", item.get("id")): item
            for item in source.get("decor") or []
            if isinstance(item, dict)
        }
        for row in safe["decor"]:
            original = decor.get(row["id"], {})
            if row.get("kind") == "image":
                _refs(row, original, ids, {"asset_id": "asset"})
                row["has_resource"] = bool(original.get("asset_id"))
            if row.get("kind") == "text":
                _refs(row, original, ids, {"attr": "attribute"})
