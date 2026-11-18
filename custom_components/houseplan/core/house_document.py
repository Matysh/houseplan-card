"""Whole-house plan-only projection and append-only scoped identity mapping.

This is a new envelope, not a full backup or a permissive second serializer.
The single-space privacy projection and structural validators remain owners.
"""
from __future__ import annotations

import copy
import json
import re
from datetime import UTC, datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import voluptuous as vol

from .backup_archive import image_refs, strict_json
from .constants import DEFAULT_CONFIG, MAX_EXPORT_BYTES
from .furniture_workstation import (
    has_workstations,
    remap_workstation_items,
    repair_workstations,
)
from .import_export import (
    FORMAT,
    PLAN_MODEL_VERSION,
    ImportFailure,
    _appearance_config,
    _fresh,
    _json_copy,
    _plan_only_room_label_layout,
    _project_plan_only_space,
    _stored_model_version,
    _unique_title,
    canonical_import_root,
    source_fingerprint,
)
from .input_policy import checkpoint
from .plan_graph import project_graph_space
from .validation import (
    CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    MAX_CONFIG_BYTES,
    MAX_LAYOUT,
    MAX_SPACES,
)
from .wall_segment_model import WallSegmentMigrationError, commit_wall_segment_model

EXPORT_VERSION = 4
REQUIRED_API = {"house_transfer_api": 1}
COLLECTIONS = (("rooms", "room"), ("partitions", "partition"), ("wall_segments", "wall"),
               ("wall_columns", "column"), ("openings", "opening"), ("decor", "decor"),
               ("stairs", "stair"), ("led_strips", "led"))
_ENVELOPE = frozenset({"format", "export_version", "kind", "created_at", "source_fingerprint",
                       "card_version", "integration_version", "model_version", "required_api",
                       "payload", "transfer", "build"})
_CREDENTIAL_QUERY = frozenset({"authsig", "token", "access_token", "api_key", "apikey", "api-key",
                              "signature", "sig", "authorization", "password", "secret", "auth", "jwt",
                              "key", "accesskey", "accesstoken", "authtoken", "clientsecret", "credential",
                              "credentials", "securitytoken", "sessiontoken", "passwd"})


def _portable_url(value):
    try:
        parsed = urlsplit(value)
    except ValueError as error:
        raise fail() from error
    def credential(key):
        normalized = re.sub(r"[^a-z0-9]", "", key.lower())
        return normalized in _CREDENTIAL_QUERY or normalized.startswith(("xamz", "xgoog"))

    query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if not credential(key)]
    return urlunsplit(parsed._replace(netloc=parsed.netloc.rsplit("@", 1)[-1], query=urlencode(query)))


def sanitize_image_urls(document):
    for ref in image_refs(document["payload"]["config"]):
        if ref.kind == "plan":
            ref.target[ref.key] = _portable_url(str(ref.target[ref.key]))


def fail(code="invalid_format"):
    return ImportFailure(code)


def _owners(spaces):
    if not isinstance(spaces, list) or not spaces or len(spaces) > MAX_SPACES:
        raise fail("space_limit" if isinstance(spaces, list) and len(spaces) > MAX_SPACES else "invalid_config")
    ids = []
    for space in spaces:
        if not isinstance(space, dict) or not isinstance(space.get("id"), str):
            raise fail("invalid_config")
        ids.append(space["id"])
        for collection, _namespace in COLLECTIONS:
            seen = set()
            values = space.get(collection) or []
            if not isinstance(values, list):
                raise fail("invalid_config")
            for item in values:
                if not isinstance(item, dict) or not isinstance(item.get("id"), str) or item["id"] in seen:
                    raise fail("invalid_config")
                seen.add(item["id"])
    if len(ids) != len(set(ids)):
        raise fail("invalid_config")


def _checked(config):
    try:
        return _appearance_config(config)
    except (ValueError, TypeError, KeyError, vol.Invalid) as error:
        raise fail("invalid_config") from error


def _privacy(config, layout):
    if not isinstance(config, dict) or set(config) - {"spaces", "markers", "settings"}:
        raise fail()
    if config.get("markers") != [] or config.get("settings", {}) != {}:
        raise fail()
    _owners(config.get("spaces"))
    actual = _checked({"model_version": PLAN_MODEL_VERSION, **_json_copy(config)})
    expected = _checked({"model_version": PLAN_MODEL_VERSION,
        "spaces": [_project_plan_only_space(space) for space in config["spaces"]], "markers": []})
    if actual != expected:
        raise fail()
    try:
        checked_layout = LAYOUT_SCHEMA(_json_copy(layout))
    except (ValueError, TypeError, vol.Invalid) as error:
        raise fail("invalid_config") from error
    projected_layout = {}
    for space in actual["spaces"]:
        projected_layout.update(_plan_only_room_label_layout(checked_layout, space))
    if checked_layout != projected_layout:
        raise fail()
    actual.pop("model_version", None)
    return actual, checked_layout


def export_document(identity, config_data, layout_data, card_version="", build=None):
    source = _json_copy(config_data.get("config") or DEFAULT_CONFIG)
    version = _stored_model_version(source)
    if version > PLAN_MODEL_VERSION:
        raise fail("future_model")
    _owners(source.get("spaces"))
    general = source.get("settings") or {}
    projected = []
    for space in source["spaces"]:
        item = _project_plan_only_space(space)
        settings = item.setdefault("settings", {})
        for field in ("bg_mode", "bg_color", "north_deg", "sun_rays"):
            if settings.get(field) is None and general.get(field) is not None:
                settings[field] = _json_copy(general[field])
        settings.setdefault("bg_mode", "static")
        if settings.get("bg_mode") is None:
            settings["bg_mode"] = "static"
        if settings.get("sun_rays") is None:
            settings["sun_rays"] = False
        projected.append(item)
    try:
        # Materialize the two existing colour fields using the same source
        # inheritance owner, then discard all global settings from the payload.
        normalized, _ = commit_wall_segment_model({"model_version": version, "spaces": projected,
                                                   "markers": [], "settings": general})
        normalized = _checked(normalized)
        normalized["settings"] = {}
        normalized.pop("model_version", None)
        room_layout = {}
        for space in normalized["spaces"]:
            room_layout.update(_plan_only_room_label_layout(layout_data.get("layout") or {}, space))
        config, layout = _privacy(normalized, room_layout)
    except (WallSegmentMigrationError, vol.Invalid, KeyError, TypeError) as error:
        raise fail("invalid_config") from error
    stamp = datetime.now(UTC)
    document = {"format": FORMAT, "export_version": EXPORT_VERSION, "kind": "house",
        "created_at": stamp.isoformat().replace("+00:00", "Z"),
        "source_fingerprint": source_fingerprint(identity.instance_id), "card_version": card_version,
        "integration_version": identity.integration_version, "model_version": PLAN_MODEL_VERSION,
        "required_api": {**REQUIRED_API, **({"furniture_workstation_api": 1} if has_workstations(config) else {})},
        "payload": {"config": config, "layout": layout},
        "transfer": {"plan_only": True}, **({"build": dict(build)} if build else {})}
    sanitize_image_urls(document)
    parse_document(json.dumps(document, ensure_ascii=False, allow_nan=False).encode())
    return document, f"houseplan-house-{stamp.strftime('%Y-%m-%d_%H-%M-%S')}.zip"


def parse_document(raw, *, workstation_repairs=None):
    document = strict_json(raw, MAX_EXPORT_BYTES)
    if set(document) - _ENVELOPE or document.get("format") != FORMAT or document.get("kind") != "house":
        raise fail()
    version = document.get("export_version")
    if type(version) is not int or version != EXPORT_VERSION:
        raise fail("unsupported-transfer" if type(version) is int and version > EXPORT_VERSION else "invalid_format")
    model = document.get("model_version")
    if type(model) is not int or model != PLAN_MODEL_VERSION:
        raise fail("future_model" if type(model) is int and model > PLAN_MODEL_VERSION else "invalid_config")
    required = document.get("required_api")
    if (not isinstance(required, dict) or "house_transfer_api" not in required
            or any(type(value) is not int for value in required.values())):
        raise fail()
    if (set(required) - {"house_transfer_api", "furniture_workstation_api"}
            or required["house_transfer_api"] != 1
            or required.get("furniture_workstation_api", 1) != 1):
        raise fail("unsupported-transfer")
    if document.get("transfer") != {"plan_only": True} or type(document["transfer"].get("plan_only")) is not bool:
        raise fail()
    for key in ("created_at", "source_fingerprint", "card_version", "integration_version"):
        if not isinstance(document.get(key), str) or len(document[key]) > 256:
            raise fail()
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", document["source_fingerprint"]):
        raise fail()
    try:
        created = datetime.fromisoformat(document["created_at"])
        if created.utcoffset() is None:
            raise ValueError
    except ValueError as error:
        raise fail() from error
    if "build" in document:
        build = document["build"]
        if (not isinstance(build, dict) or set(build) != {"channel", "source"}
                or build.get("channel") != "dev" or not isinstance(build.get("source"), str)
                or not re.fullmatch(r"[0-9a-f]{40}", build["source"])):
            raise fail()
    payload = document.get("payload")
    if not isinstance(payload, dict) or set(payload) != {"config", "layout"}:
        raise fail()
    incoming = _json_copy(payload["config"])
    if isinstance(incoming, dict) and has_workstations(incoming) and "furniture_workstation_api" not in required:
        raise fail("unsupported-transfer")
    repaired = repair_workstations(incoming)
    config, layout = _privacy(incoming, payload["layout"])
    if workstation_repairs is not None:
        workstation_repairs.update(repaired)
    for ref in image_refs(config):
        if ref.kind == "plan" and _portable_url(str(ref.target[ref.key])) != ref.target[ref.key]:
            raise fail()
    document["payload"] = {"config": config, "layout": layout}
    return document


def _mint(namespace, old, used):
    root, _depth, _bounded = canonical_import_root(namespace, old)
    return _fresh(namespace, root, used)


def build_merge(document, current_config, current_layout):
    """Prepare every map first, then remap one detached incoming house.

    Never invoke the one-space importer: it has deliberate target-orphan repair
    and cross-floor neutralization that are not additive whole-house semantics.
    """
    incoming = _json_copy(document["payload"]["config"])
    spaces = incoming["spaces"]
    _owners(spaces)
    target = _json_copy(current_config)
    layout = _json_copy(current_layout)
    existing = target.setdefault("spaces", [])
    if not existing:
        target["model_version"] = PLAN_MODEL_VERSION
    if len(existing) + len(spaces) > MAX_SPACES:
        raise fail("space_limit")
    used = {str(item["id"]) for space in [*existing, *spaces]
            for collection in [[space], *(space.get(name) or [] for name, _ in COLLECTIONS)]
            for item in collection if isinstance(item, dict) and "id" in item}
    used.update(str(marker.get("id")) for marker in target.get("markers") or [])
    # Unresolved target references/layout owners must not accidentally become
    # resolved by a freshly minted ID. Include unknown retained fields too,
    # without rewriting or trying to interpret them as one-space repair maps.
    pending = [target, layout]
    while pending:
        checkpoint()
        value = pending.pop()
        if isinstance(value, dict):
            used.update(str(key) for key in value)
            used.update(key[3:] for key in value if isinstance(key, str) and key.startswith("rl_"))
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)
        elif isinstance(value, str):
            used.add(value)
    space_map = {space["id"]: _mint("space", space["id"], used) for space in spaces}
    maps = {}
    for space in spaces:
        checkpoint()
        scoped = {namespace: {item["id"]: _mint(namespace, item["id"], used)
                               for item in space.get(collection) or []} for collection, namespace in COLLECTIONS}
        graph = space.get("plan_graph")
        scoped["node"] = {node["id"]: _mint("node", node["id"], used) for node in (graph or {}).get("nodes", [])}
        maps[space["id"]] = scoped
    names, warnings = [], []
    for space in spaces:
        old_sid = space["id"]
        scoped = maps[old_sid]
        for collection, namespace in COLLECTIONS:
            for item in space.get(collection) or []:
                item["id"] = scoped[namespace][item["id"]]
        if "decor" in space:
            space["decor"] = remap_workstation_items(space["decor"], scoped["decor"])
        for room in space.get("rooms") or []:
            if room.get("open_to"):
                try:
                    room["open_to"] = [scoped["room"][value] for value in room["open_to"]]
                except KeyError as error:
                    raise fail("invalid_config") from error
            if room.get("wall_ids"):
                room["wall_ids"] = [scoped["wall"].get(value, value) for value in room["wall_ids"]]
        for opening in space.get("openings") or []:
            host = opening.get("host")
            if isinstance(host, dict) and host.get("kind") in {"wall", "partition"}:
                try:
                    host["id"] = scoped[host["kind"]][host["id"]]
                except KeyError as error:
                    raise fail("invalid_config") from error
        graph = space.get("plan_graph")
        if graph:
            for node in graph["nodes"]:
                node["id"] = scoped["node"][node["id"]]
            for edge in graph["edges"]:
                edge["id"] = scoped[edge["kind"]][edge["id"]]
                edge["from"], edge["to"] = scoped["node"][edge["from"]], scoped["node"][edge["to"]]
            for room in graph["rooms"]:
                room["room"] = scoped["room"][room["room"]]
                for ref in room["edges"]:
                    ref["id"] = scoped[ref["kind"]][ref["id"]]
            for dependency in graph["dependencies"]:
                dependency["node"] = scoped["node"][dependency["node"]]
                for ref in dependency["refs"]:
                    ref["from"], ref["to"] = scoped["node"][ref["from"]], scoped["node"][ref["to"]]
            graph["nodes"].sort(key=lambda node: node["id"])
            graph["edges"].sort(key=lambda edge: (edge["kind"], edge["id"]))
            graph["rooms"].sort(key=lambda room: room["room"])
            graph["dependencies"].sort(key=lambda dependency: dependency["node"])
            space.update(project_graph_space(space, graph)["space"])
        for stair in space.get("stairs") or []:
            destination = stair.get("target_space_id")
            if destination is not None:
                stair["target_space_id"] = space_map.get(destination)
                if destination not in space_map:
                    warnings.append({"code": "dangling_stair", "space_id": old_sid, "target": destination})
        space["id"] = space_map[old_sid]
        title = str(space.get("title") or old_sid)
        space["title"] = _unique_title(title, existing)
        names.append({"source_id": old_sid, "space_id": space["id"], "source_title": title, "title": space["title"]})
        existing.append(space)
    for key, position in document["payload"]["layout"].items():
        sid, room_id = position["s"], key[3:]
        room = maps[sid]["room"][room_id]
        layout["rl_" + room] = {**copy.deepcopy(position), "s": space_map[sid]}
    if len(layout) > MAX_LAYOUT or len(json.dumps(target, ensure_ascii=False).encode()) > MAX_CONFIG_BYTES:
        raise fail("too_large")
    # Validate incoming structures independently; do not normalize or repair any
    # existing space/marker/settings/layout entry as a side effect of append.
    checked = CONFIG_SCHEMA({"model_version": PLAN_MODEL_VERSION, "spaces": spaces, "markers": [], "settings": {}})
    target["spaces"][-len(spaces):] = checked["spaces"]
    return target, layout, {"spaces": names, "warnings": warnings, "id_maps": maps, "space_map": space_map}
