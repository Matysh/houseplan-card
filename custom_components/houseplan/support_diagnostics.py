"""Read-only, allowlisted runtime projection for support package 2 (#942)."""

from __future__ import annotations

import copy
from typing import Any

from .support_diagnostic_values import (
    DiagnosticIds,
    GeometryBudget,
    finite,
    relative_time,
)
from .support_wire_schema import (
    ENTITY_FACT,
    FAMILY,
    QUALITY_REASON,
    RUN,
    VAC_SERVER,
    WireRejected,
    anonymize_client,
    canonical_bytes,
    validate,
    validate_client,
)


def _known(value, rule, fallback):
    try:
        validate(value, rule)
        return value
    except WireRejected:
        return fallback


def _sample(value: dict, budget: GeometryBudget) -> dict:
    """Second cap joins server and client samples WITHOUT changing their ranges."""
    result = {
        key: value[key]
        for key in (
            "status",
            "raw_points",
            "valid_points",
            "invalid_points",
            "kept_points",
            "total_fragments",
            "scan_limited",
            "truncated",
        )
    }
    fragments = []
    kept = 0
    for row in value["fragments"]:
        if budget.fragments <= 0 or budget.points <= 0:
            break
        points = row["points"][: budget.points]
        if not points:
            continue
        fragments.append(
            {
                "fragment": row["fragment"],
                "start": row["start"],
                "end": row["start"] + len(points),
                "points": copy.deepcopy(points),
            }
        )
        kept += len(points)
        budget.points -= len(points)
        budget.fragments -= 1
    result.update(
        fragments=fragments,
        kept_points=kept,
        truncated=value["truncated"] or kept < value["kept_points"],
    )
    return result


def _entity(value: dict, ids: DiagnosticIds) -> dict:
    out = {"id": ids.get("entity", value["id"])}
    for key in ("exists", "disabled", "availability", "shape", "state"):
        if key in value:
            validate(value[key], ENTITY_FACT.fields[key])
            out[key] = value[key]
    out["family"] = _known(value.get("family"), FAMILY, "unknown")
    if "integration" in value:
        out["integration"] = ids.get("integration", value["integration"])
    if "attributes" in value:
        out["attributes"] = []
        for row in value["attributes"][:64]:
            safe = {"id": ids.get("attribute", row["id"])}
            for key in ("present", "shape"):
                safe[key] = row[key]
            out["attributes"].append(safe)
    validate(out, ENTITY_FACT)
    return out


def _run(
    value: object, ids: DiagnosticIds, now: float, budget: GeometryBudget
) -> dict | None:
    if not isinstance(value, dict):
        return None
    out: dict[str, Any] = {}
    for key, kind in {
        "map_id": "map",
        "source": "entity",
        "route_id": "route",
        "_generation": "run",
        "_job_id": "job",
    }.items():
        if key in value:
            out[{"_generation": "generation", "_job_id": "job"}.get(key, key)] = (
                ids.get(kind, value[key])
            )
    out["format"] = value.get("path_format", 1)
    for key, target in {
        "started": "started",
        "ended": "ended",
        "received_at": "received",
    }.items():
        out[target] = (
            relative_time(value[key], now) if key in value else {"state": "missing"}
        )
    sample_at = value.get("_last_sample")
    out["last_sample"] = (
        relative_time(sample_at[2], now)
        if isinstance(sample_at, list) and len(sample_at) == 3
        else {"state": "missing"}
    )
    out["revision_present"] = bool(value.get("revision"))
    if isinstance(value.get("_gap_pending"), bool):
        out["gap_pending"] = value["_gap_pending"]
    out["final"] = _known(value.get("final_status"), RUN.fields["final"], "unknown")
    quality = value.get("quality")
    if isinstance(quality, dict):
        out["quality"] = {
            "source": _known(
                quality.get("source"), RUN.fields["quality"].fields["source"], "unknown"
            ),
            "reason": _known(quality.get("reason"), QUALITY_REASON, "unknown"),
        }
        for key in ("raw_points", "stored_points"):
            if type(quality.get(key)) is int and quality[key] >= 0:
                out["quality"][key] = quality[key]
        out["last_good_retained"] = bool(
            quality.get("source") == "native"
            and quality.get("reason") != "ok"
            and (value.get("sample") or {}).get("raw_points", 0)
        )
    provenance = value.get("provenance")
    if isinstance(provenance, dict):
        rules = RUN.fields["provenance"].fields
        out["provenance"] = {
            "provider": _known(
                provenance.get("provider"), rules["provider"], "unknown"
            ),
            "schema": _known(provenance.get("schema"), rules["schema"], "unknown"),
            "final_capability": "unconfirmed",
        }
    if isinstance(value.get("sample"), dict):
        out["sample"] = _sample(value["sample"], budget)
    validate(out, RUN)
    return out


def build_diagnostics(
    config: dict,
    *,
    ids: DiagnosticIds,
    config_rev: int,
    layout_rev: int,
    client: dict | None = None,
    server: dict | None = None,
) -> dict:
    """The server adapter supplies a private owned snapshot, never live HA here."""
    server = server or {}
    if client is not None:
        validate_client(client)
    matches = bool(
        client is not None
        and client["config_rev"] == config_rev
        and client["layout_rev"] == layout_rev
    )
    pending = bool(
        client
        and (
            client["environment"].get("write_pending")
            or client["environment"].get("accepted") is False
        )
    )
    client_status = (
        "missing"
        if client is None
        else "revision_mismatch"
        if not matches
        else "pending"
        if pending
        else "matched"
    )
    accepted = client if client_status == "matched" else None
    # The HA capture adapter filters/rechecks references and read ACLs. A pure
    # caller without that adapter cannot claim it captured server facts.
    if "client" in server:
        accepted = server["client"] if client_status == "matched" else None
    anonymous = anonymize_client(accepted, ids) if accepted is not None else None
    budget = GeometryBudget()
    snapshot: dict[str, Any] = {
        "config_rev": config_rev,
        "layout_rev": layout_rev,
        "client_status": client_status,
        "parts": [
            {"part": "config", "status": "available", "age_s": 0},
            {
                "part": "states",
                "status": "available" if server.get("available") else "unavailable",
                "age_s": 0,
            },
            {
                "part": "trails",
                "status": "available"
                if server.get("trails_available")
                else "unavailable",
                "age_s": 0,
            },
            {
                "part": "frontend",
                "status": "available" if accepted else "unavailable",
                "age_s": 0,
            },
        ],
    }
    if client is not None:
        snapshot.update(
            client_config_rev=client["config_rev"],
            client_layout_rev=client["layout_rev"],
        )
        if finite(client.get("age_ms")):
            snapshot["client_age_ms"] = client["age_ms"]
    vacuums = []
    for raw in (server.get("vacuums") or [])[:32]:
        out = {
            "marker": ids.get("marker", raw["marker"]),
            "vacuum_entity": ids.get("entity", raw.get("vacuum_entity")),
            "status": raw["status"],
            "activity": raw["activity"],
            "sources": [],
        }
        for slot in ("current", "previous"):
            if slot in raw:
                out[slot] = _run(raw[slot], ids, server.get("now", 0), budget)
        for source in (raw.get("sources") or [])[:64]:
            row = {
                "source": ids.get("entity", source["source"]),
                "map_id": ids.get("map", source.get("map_id")),
                "family": _known(source.get("family"), FAMILY, "unknown"),
                "version": "unknown",
            }
            if "position" in source:
                row["position"] = source["position"]
            if "input" in source:
                row["input"] = _sample(source["input"], budget)
            out["sources"].append(row)
        if anonymous:
            observation = next(
                (row for row in anonymous["vacuums"] if row["marker"] == out["marker"]),
                None,
            )
            if observation is not None:
                observation = copy.deepcopy(observation)
                if "local" in observation:
                    observation["local"] = _sample(observation["local"], budget)
                out["client"] = observation
        validate(out, VAC_SERVER)
        vacuums.append(out)
    # Even with an old/unavailable recorder, a verified client observation is
    # valuable, but never relabel it as a server run or a full backend snapshot.
    known_vacs = {row["marker"] for row in vacuums}
    if anonymous:
        for observation in anonymous["vacuums"]:
            if observation["marker"] in known_vacs or len(vacuums) >= 32:
                continue
            observation = copy.deepcopy(observation)
            if "local" in observation:
                observation["local"] = _sample(observation["local"], budget)
            vacuums.append(
                {
                    "marker": observation["marker"],
                    "status": "runtime_unavailable",
                    "activity": "unknown",
                    "client": observation,
                }
            )
    reasons = set(server.get("reasons") or [])
    if client_status != "matched":
        reasons.add(
            "revision_mismatch"
            if client_status in ("revision_mismatch", "pending")
            else "missing_client"
        )
    if anonymous and accepted.get("limited"):
        reasons.add("input_limit")
    if budget.points == 0 or budget.fragments == 0:
        reasons.add("geometry_limit")

    def sample_incomplete(node):
        if isinstance(node, list):
            return any(sample_incomplete(item) for item in node)
        if isinstance(node, dict):
            return (
                "kept_points" in node
                and (node.get("truncated") or node.get("scan_limited"))
            ) or any(sample_incomplete(item) for item in node.values())
        return False

    if sample_incomplete(vacuums):
        reasons.add("geometry_limit")
    unsupported = any(
        isinstance(row.get("radar"), dict) and row["radar"].get("version") != 1
        for row in config.get("markers") or []
        if isinstance(row, dict)
    )
    panel = (config.get("settings") or {}).get("summary_panel")
    unsupported = unsupported or (isinstance(panel, dict) and panel.get("version") != 1)
    config_vacs = sum(
        isinstance(row.get("vacuum"), dict)
        for row in config.get("markers") or []
        if isinstance(row, dict)
    )
    total_vacs = max(config_vacs, len(vacuums), int(server.get("total_vacuums", 0)))
    total_devices = max(
        len(config.get("markers") or []),
        len(anonymous["devices"]) if anonymous else 0,
        int(server.get("total_devices", 0)),
    )
    coverage = []
    for category, observed, total in (
        ("config", 1, 1),
        ("devices", len(anonymous["devices"]) if anonymous else 0, total_devices),
        ("vacuums", len(vacuums), total_vacs),
        ("environment", 1 if anonymous else 0, 1),
    ):
        missing = set() if category == "config" else set(reasons)
        if category == "config" and unsupported:
            missing.add("unsupported_version")
        if category == "devices" and not server.get("available"):
            missing.add("registry_unavailable")
        if category == "vacuums" and any(
            row["status"] != "available" for row in vacuums
        ):
            missing.add("runtime_not_loaded")
        if category == "vacuums" and any(
            source.get("input", {}).get("status") == "unavailable"
            for vacuum in vacuums
            for source in vacuum.get("sources") or []
        ):
            missing.add("runtime_not_loaded")
        if category == "environment" and anonymous:
            environment = anonymous["environment"]
            if any(
                row["status"] == "unobserved"
                for row in environment.get("resources") or []
            ):
                missing.add("resource_unobserved")
            if environment.get("panel", {}).get("status") == "runtime_not_loaded":
                missing.add("runtime_not_loaded")
        if category in ("devices", "vacuums") and observed < total:
            missing.add("runtime_not_loaded")
        if category == "vacuums" and total == 0:
            missing.clear()
        status = (
            "not_applicable"
            if category == "vacuums" and total == 0
            else "partial"
            if missing and observed
            else "unavailable"
            if missing
            else "complete"
        )
        coverage.append(
            {
                "category": category,
                "status": status,
                "reasons": sorted(missing),
                "observed": observed,
                "total": total,
            }
        )
    result = {
        "schema": 1,
        "snapshot": snapshot,
        "coverage": coverage,
        "devices": {
            "total_entities": len(server.get("entities") or []),
            "entities": [
                _entity(row, ids) for row in (server.get("entities") or [])[:8192]
            ],
            "client": anonymous["devices"] if anonymous else [],
        },
        "vacuums": vacuums,
        "environment": anonymous["environment"] if anonymous else {},
    }

    # The complete config is outside this cap and is never pruned. Under byte
    # pressure first remove sampled geometry, then bounded runtime collections;
    # retain vacuum identity, ownership, counters and timestamps throughout.
    def mark(category, reason):
        row = next(row for row in coverage if row["category"] == category)
        row["status"] = "partial" if row["observed"] else "unavailable"
        row["reasons"] = sorted(set(row["reasons"]) | {reason})

    def clear_samples(node):
        if isinstance(node, list):
            for item in node:
                clear_samples(item)
        elif isinstance(node, dict):
            if "kept_points" in node and "fragments" in node:
                node.update(fragments=[], kept_points=0, truncated=True)
            else:
                for item in node.values():
                    clear_samples(item)

    cleared = False
    while True:
        try:
            canonical_bytes(result, 2 * 1024 * 1024)
            break
        except WireRejected as error:
            if str(error) != "support_package_too_large":
                raise
        if not cleared:
            clear_samples(vacuums)
            mark("vacuums", "geometry_limit")
            cleared = True
        elif result["devices"]["entities"]:
            rows = result["devices"]["entities"]
            del rows[len(rows) // 2 :]
            mark("devices", "collection_limit")
        elif result["devices"]["client"]:
            rows = result["devices"]["client"]
            del rows[len(rows) // 2 :]
            next(row for row in coverage if row["category"] == "devices")[
                "observed"
            ] = len(rows)
            mark("devices", "collection_limit")
        else:
            raise WireRejected("support_package_too_large")
    return result
