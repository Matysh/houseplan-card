"""Bounded event-loop capture; never polls, writes or reads files (#942)."""

from __future__ import annotations

import copy
import time

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .radar_validation import radar_source_entity_ids
from .support_diagnostic_values import GeometryBudget, finite, point, sample_path
from .support_wire_schema import FAMILY, WireRejected, validate
from .vacuum_routes import adopt_legacy_run, effective_routes, is_entity_id_like

_STATES = frozenset(
    {
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
    }
)


def can_read(user, entity_id: str) -> bool:
    try:
        return bool(
            user and (user.is_admin or user.permissions.check_entity(entity_id, "read"))
        )
    except Exception:  # noqa: BLE001 - unknown permissions are never positive evidence
        return False


def scope_readable(user, scope) -> bool:
    return all(can_read(user, entity_id) for entity_id in scope)


def value_shape(value: object) -> str:
    """No value, unit, arbitrary state or attribute content crosses this edge."""
    if value is None:
        return "missing"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "numeric" if finite(value) else "missing"
    if isinstance(value, str):
        if value in ("unknown", "unavailable", ""):
            return "missing"
        if value in _STATES:
            return "known_enum"
        try:
            return "numeric" if finite(float(value)) else "missing"
        except ValueError:
            return "text"
    return "non_scalar"


def _family(raw) -> str:
    try:
        validate(raw, FAMILY)
        return raw
    except WireRejected:
        return "other" if raw else "unknown"


def capture_snapshot(
    hass, user, config: dict, client: dict | None
) -> tuple[dict, tuple[str, ...]]:
    """No await: references, statuses and bounded samples belong to one cut.

    The config/layout copy has already been captured under write_lock. HA state
    objects and path lists never escape this function into the executor.
    """
    now = time.time()
    entities = er.async_get(hass)
    devices = dr.async_get(hass)
    reasons: set[str] = set()
    scope: set[str] = set()
    denied: set[str] = set()
    attributes: dict[str, set[str]] = {}
    radar_sources: set[str] = set()
    marker_rows = [row for row in config.get("markers") or [] if isinstance(row, dict)]
    markers = {str(row.get("id")): row for row in marker_rows}
    bound_areas = {
        room.get("area")
        for space in config.get("spaces") or []
        if isinstance(space, dict)
        for room in space.get("rooms") or []
        if isinstance(room, dict) and room.get("area")
    }

    def add(raw):
        if not is_entity_id_like(raw):
            return
        if raw in scope or raw in denied:
            return
        if len(scope) + len(denied) >= 8192:
            reasons.add("collection_limit")
        elif can_read(user, raw):
            scope.add(raw)
        else:
            denied.add(raw)
            reasons.add("access_denied")

    def children(binding):
        if not isinstance(binding, str):
            return []
        if binding.startswith("entity:"):
            return [binding[7:]]
        if binding.startswith("device:") and entities is not None:
            rows = er.async_entries_for_device(entities, binding[7:])
            if len(rows) > 512:
                reasons.add("collection_limit")
            return [row.entity_id for row in rows[:512]]
        return []

    def binding(raw):
        for entity_id in children(raw):
            add(entity_id)

    def value_source(raw):
        if not isinstance(raw, dict):
            return
        entity_id = raw.get("entity_id")
        add(entity_id)
        attribute = raw.get("attribute")
        if isinstance(entity_id, str) and isinstance(attribute, str):
            attributes.setdefault(entity_id, set()).add(attribute)

    # Exact persisted references only: never an All cameras/source scan.
    for marker in marker_rows[:2000]:
        binding(marker.get("binding"))
        for key in ("light_entity", "toggle_entity", "tap_target"):
            add(marker.get(key))
        for raw in marker.get("controls") or []:
            if isinstance(raw, str) and raw.startswith("marker:"):
                target = markers.get(raw[7:])
                if target:
                    binding(target.get("binding"))
            else:
                add(raw)
        value_source(marker.get("value_source"))
        badge = marker.get("value_badge")
        if isinstance(badge, dict):
            value_source(badge.get("source"))
        for entity_id in radar_source_entity_ids(marker.get("radar")):
            add(entity_id)
            radar_sources.add(entity_id)
        vacuum = marker.get("vacuum")
        if isinstance(vacuum, dict):
            add(vacuum.get("source"))
            for route in (vacuum.get("map_routes") or [])[:64]:
                if isinstance(route, dict):
                    add(route.get("source"))
    for space in config.get("spaces") or []:
        if not isinstance(space, dict):
            continue
        for room in space.get("rooms") or []:
            settings = room.get("settings") if isinstance(room, dict) else None
            if isinstance(settings, dict):
                for key in ("temp_source", "hum_source"):
                    binding(settings.get(key))
        for opening in space.get("openings") or []:
            if isinstance(opening, dict):
                add(opening.get("contact"))
                add(opening.get("lock"))
        for decor in space.get("decor") or []:
            if isinstance(decor, dict) and decor.get("kind") == "text":
                add(decor.get("entity"))
    settings = config.get("settings") or {}
    panel = settings.get("summary_panel")
    if isinstance(panel, dict) and panel.get("version") == 1:
        for block in panel.get("blocks") or []:
            if not isinstance(block, dict):
                continue
            for row in block.get("values") or []:
                source = row.get("source") if isinstance(row, dict) else None
                if isinstance(source, dict) and source.get("type") == "entity":
                    add(source.get("entity_id"))

    filtered = copy.deepcopy(client) if client is not None else None
    observations: dict[str, dict] = {}
    if filtered is not None:
        filtered["devices"] = []
        for row in client["devices"]:
            marker = markers.get(row["id"])
            valid = bool(marker and marker.get("binding") == row["binding"])
            if marker is None and row["binding"].startswith("device:"):
                device_id = row["binding"][7:]
                device = devices.async_get(device_id) if devices else None
                valid = bool(
                    row["id"] == device_id and device and device.area_id in bound_areas
                )
            if marker is None and row["binding"].startswith("entity:"):
                eid = row["binding"][7:]
                registry = entities.async_get(eid) if entities else None
                device = (
                    devices.async_get(registry.device_id)
                    if devices and registry and registry.device_id
                    else None
                )
                area = getattr(registry, "area_id", None) or getattr(
                    device, "area_id", None
                )
                valid = (
                    row["id"] == "lg_" + eid
                    and eid.startswith("light.")
                    and area in bound_areas
                )
            if not valid:
                reasons.add("unknown_reference")
                continue
            own = children(row["binding"])
            for eid in own:
                add(eid)
            # No second registry/source algorithm: browser decisions remain
            # observations. We only establish their bounded, readable scope.
            refs = set(row.get("entities") or []) | set(row.get("sources") or [])
            if row.get("primary"):
                refs.add(row["primary"])
            for value in (row.get("face"), row.get("badge")):
                if isinstance(value, dict):
                    source = value.get("source")
                    if isinstance(source, dict) and source.get("entity_id"):
                        refs.add(source["entity_id"])
                    if isinstance(source, dict) and source.get("ref"):
                        refs.add(source["ref"])
            action = row.get("action") or {}
            refs.update(action.get("targets") or [])
            refs.update(
                item["ref"] for item in action.get("skipped") or [] if item.get("ref")
            )
            marker_refs = {ref for ref in refs if ref.startswith("marker:")}
            # Derived virtual values may depend on incoming controllers, not
            # just the target binding. With any denied dependency in this cut
            # we cannot prove that graph readable without another resolver:
            # conservatively omit the claim rather than export its state.
            if marker_refs and denied:
                reasons.add("access_denied")
                continue
            for ref in marker_refs:
                target = markers.get(ref[7:])
                if target is None:
                    reasons.add("unknown_reference")
                    valid = False
                else:
                    refs.update(children(target.get("binding")))
            refs -= marker_refs
            if not valid or not refs <= scope:
                reasons.add("access_denied" if refs & denied else "unknown_reference")
                continue
            for value in (row.get("face"), row.get("badge")):
                if isinstance(value, dict):
                    value_source(value.get("source"))
            observations[row["id"]] = row
            filtered["devices"].append(copy.deepcopy(row))
        filtered["vacuums"] = []
        for row in client["vacuums"]:
            refs = {item["source"] for item in row.get("candidates") or []}
            if row.get("source"):
                refs.add(row["source"])
            if row["marker"] not in observations or not refs <= scope:
                reasons.add("access_denied" if refs & denied else "unknown_reference")
                continue
            filtered["vacuums"].append(copy.deepcopy(row))
        if len(filtered["vacuums"]) != len(client["vacuums"]):
            reasons.add("unknown_reference")
        # Environment claims are untrusted too. Do not retain a value/shape
        # about a denied panel entity just because it has no entity_id field.
        environment = filtered["environment"]
        spaces = {space.get("id"): space for space in config.get("spaces") or []}
        if environment.get("space") not in (None, *spaces):
            environment.pop("space", None)
            reasons.add("unknown_reference")
        for key in ("rooms", "resources"):
            safe_rows = []
            for row in environment.get(key) or []:
                space = spaces.get(row.get("space"))
                valid = space is not None
                if valid and key == "rooms":
                    valid = any(
                        room.get("id") == row.get("room")
                        for room in space.get("rooms") or []
                    )
                if valid and row.get("kind") == "decor_image":
                    valid = any(
                        item.get("id") == row.get("decor")
                        and item.get("asset_id") == row.get("asset")
                        for item in space.get("decor") or []
                        if item.get("kind") == "image"
                    )
                if valid:
                    safe_rows.append(row)
                else:
                    reasons.add("unknown_reference")
            if key in environment:
                environment[key] = safe_rows
        panel_facts = environment.get("panel") or {}
        safe_values = []
        blocks = (
            {block.get("id"): block for block in (panel or {}).get("blocks") or []}
            if isinstance(panel, dict)
            else {}
        )
        for value in panel_facts.get("values") or []:
            block = blocks.get(value["block"])
            original = (
                next(
                    (
                        item
                        for item in block.get("values") or []
                        if item.get("id") == value["value"]
                    ),
                    None,
                )
                if block
                else None
            )
            if original is None:
                reasons.add("unknown_reference")
                continue
            source = original.get("source") or {}
            eid = source.get("entity_id") if source.get("type") == "entity" else None
            if eid and eid not in scope:
                reasons.add("access_denied" if eid in denied else "unknown_reference")
                continue
            safe_values.append(value)
        if "values" in panel_facts:
            panel_facts["values"] = safe_values

    def entity_facts():
        facts = []
        for eid in sorted(scope):
            state = hass.states.get(
                eid
            )  # ACL was checked before reading state/metadata
            row = entities.async_get(eid) if entities else None
            parent = (
                devices.async_get(row.device_id)
                if devices and row and row.device_id
                else None
            )
            exists = (
                bool(state is not None or row is not None)
                if entities is not None or state is not None
                else None
            )
            disabled = (
                bool(
                    getattr(row, "disabled_by", None)
                    or getattr(parent, "disabled_by", None)
                )
                if entities
                else None
            )
            availability = (
                "missing"
                if exists is False
                else "unverified"
                if exists is None
                else "unavailable"
                if state is None
                or state.state in ("unknown", "unavailable")
                or disabled
                else "available"
            )
            fact = {
                "id": eid,
                "exists": exists,
                "disabled": disabled,
                "availability": availability,
                "family": _family(getattr(row, "platform", None)),
                "integration": getattr(row, "platform", None),
            }
            if eid not in radar_sources:
                fact["shape"] = value_shape(state.state if state else None)
                fact["state"] = (
                    state.state
                    if state and state.state in _STATES
                    else "other"
                    if state
                    else "unknown"
                )
            if len(attributes.get(eid) or []) > 64:
                reasons.add("collection_limit")
            fact["attributes"] = [
                {
                    "id": key,
                    "present": bool(state and key in state.attributes),
                    "shape": value_shape(state.attributes.get(key) if state else None),
                }
                for key in sorted(attributes.get(eid) or [])[:64]
                if eid not in radar_sources
            ]
            facts.append(fact)
        return facts

    recorder = hass.data.get(DOMAIN, {}).get("trail_recorder")
    budget = GeometryBudget(scans=8192)
    vacuum_markers = {
        row["id"]: row for row in marker_rows if isinstance(row.get("vacuum"), dict)
    }
    if filtered:
        for row in filtered["vacuums"]:
            vacuum_markers.setdefault(
                row["marker"],
                {
                    "id": row["marker"],
                    "binding": observations[row["marker"]]["binding"],
                    "vacuum": {},
                },
            )
    vacuums = []
    for marker in list(vacuum_markers.values())[:32]:
        options = marker.get("vacuum") or {}
        vacuum_entity = next(
            (
                eid
                for eid in children(marker.get("binding"))
                if eid.startswith("vacuum.")
            ),
            None,
        )
        vacuum_state = (
            hass.states.get(vacuum_entity) if vacuum_entity in scope else None
        )
        activity = (
            "unknown"
            if vacuum_entity not in scope
            else "missing"
            if vacuum_state is None
            else "moving"
            if vacuum_state.state in ("cleaning", "returning", "on")
            else "unavailable"
            if vacuum_state.state == "unavailable"
            else "unknown"
            if vacuum_state.state == "unknown"
            else "stopped"
        )
        out = {
            "marker": marker["id"],
            "vacuum_entity": vacuum_entity,
            "activity": activity,
            "status": "available" if recorder else "runtime_unavailable",
            "sources": [],
        }
        if vacuum_entity in denied:
            out["status"] = "access_denied"
        routes = effective_routes(
            marker["id"], options, str(marker.get("space") or ""), options.get("source")
        )
        record = recorder.book.data.get(marker["id"], {}) if recorder else {}
        for slot in ("current", "previous"):
            run = record.get(slot)
            if not isinstance(run, dict):
                continue
            source = run.get("source")
            if not source:
                route = next(
                    (
                        route
                        for route in routes
                        if run.get("route_id") and route["id"] == run["route_id"]
                    ),
                    None,
                )
                if route is None:
                    adopted = adopt_legacy_run(run, routes, options.get("source"))
                    route = adopted.get("route")
                source = route.get("source") if route else None
            if not getattr(user, "is_admin", False) and (
                vacuum_entity not in scope or source not in scope
            ):
                out["status"] = "access_denied"
                reasons.add("access_denied")
                continue
            if source:
                if not can_read(user, source):
                    out["status"] = "access_denied"
                    reasons.add("access_denied")
                    continue
                add(source)
                if source not in scope:
                    out["status"] = "runtime_unavailable"
                    continue
            safe = {
                key: copy.deepcopy(run[key])
                for key in (
                    "map_id",
                    "source",
                    "route_id",
                    "path_format",
                    "started",
                    "ended",
                    "received_at",
                    "_generation",
                    "_job_id",
                    "revision",
                    "final_status",
                    "_gap_pending",
                )
                if key in run
                and isinstance(run[key], (str, int, float, bool, type(None)))
            }
            for key, keys in (
                ("quality", ("source", "reason", "raw_points", "stored_points")),
                ("provenance", ("provider", "schema")),
            ):
                if isinstance(run.get(key), dict):
                    safe[key] = {
                        name: run[key][name]
                        for name in keys
                        if name in run[key]
                        and isinstance(run[key][name], (str, int, float))
                    }
            last = run.get("_last_sample")
            if isinstance(last, list) and len(last) == 3:
                safe["_last_sample"] = [
                    0,
                    0,
                    last[2]
                    if isinstance(last[2], (str, int, float, type(None)))
                    else False,
                ]
            fmt = run.get("path_format", 1)
            if type(fmt) is int and fmt in (1, 2):
                safe["sample"] = sample_path(
                    run.get("paths") if fmt == 2 else run.get("points"), budget
                )
            else:
                out["status"] = "unsupported_version"
                reasons.add("unsupported_version")
            out[slot] = safe
        sources = {route["source"] for route in routes if route.get("source")}
        if options.get("source"):
            sources.add(options["source"])
        if filtered:
            observation = next(
                (row for row in filtered["vacuums"] if row["marker"] == marker["id"]),
                None,
            )
            if observation and observation.get("source"):
                sources.add(observation["source"])
        if len(sources) > 64:
            reasons.add("collection_limit")
        for source in sorted(sources)[:64]:
            if source not in scope:
                reasons.add(
                    "access_denied" if source in denied else "unknown_reference"
                )
                continue
            state = hass.states.get(source)
            attrs = state.attributes if state else {}
            source_row = entities.async_get(source) if entities else None
            # Use the recorder's actual nullish map identity rule. Malformed
            # arbitrary structures are not stringified into a report or log.
            from .trails import resolve_map_id

            map_fields = [
                attrs.get(key)
                for key in ("map_name", "current_map", "map_index", "selected_map")
            ]
            map_fields.append(
                vacuum_state.attributes.get("selected_map") if vacuum_state else None
            )
            first_map = next(
                (item for item in map_fields if item is not None), "default"
            )
            valid_map = isinstance(first_map, (str, int)) and not isinstance(
                first_map, bool
            )
            out["sources"].append(
                {
                    "source": source,
                    "map_id": resolve_map_id(
                        attrs, vacuum_state.attributes if vacuum_state else {}
                    )
                    if valid_map
                    else None,
                    "position": point(
                        attrs.get("vacuum_position") or attrs.get("robot_position")
                    ),
                    "input": sample_path(attrs.get("path"), budget),
                    "family": _family(getattr(source_row, "platform", None)),
                }
            )
        vacuums.append(out)
    if len(vacuum_markers) > 32 or len(marker_rows) > 2000:
        reasons.add("collection_limit")
    facts = entity_facts()
    return {
        "available": entities is not None,
        "trails_available": recorder is not None,
        "now": now,
        "entities": facts,
        "vacuums": vacuums,
        "client": filtered,
        "reasons": sorted(reasons),
        "total_vacuums": len(vacuum_markers),
        "total_devices": max(len(marker_rows), len(observations)),
    }, tuple(sorted(scope))
