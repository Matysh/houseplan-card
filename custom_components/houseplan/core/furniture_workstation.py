"""Optional desk/computer links; geometry remains ordinary two-dimensional decor."""
from __future__ import annotations

import math

import voluptuous as vol

API_VERSION = 1
ROLE = "workstation"
TOWER = "workstation_tower_id"
DESKS = frozenset({"desk", "desk_corner"})
MAX_EXAMPLES = 24


def has_workstations(config: dict) -> bool:
    return any(ROLE in item or TOWER in item
               for space in config.get("spaces", []) if isinstance(space, dict)
               for item in space.get("decor", []) if isinstance(item, dict))


def validate_workstation_shape(item: dict) -> dict:
    if ROLE not in item and TOWER not in item:
        return item
    if item.get("kind") != "furniture":
        raise vol.Invalid("Workstation fields belong to furniture")
    role = item.get(ROLE)
    if role == "mounted" and item.get("symbol") in DESKS:
        reference = item.get(TOWER)
        if isinstance(reference, str) and 0 < len(reference) <= 512:
            return item
    elif role == "tower" and item.get("symbol") == "computer" and TOWER not in item:
        return item
    raise vol.Invalid("Invalid workstation role, furniture symbol or tower reference")


def validate_workstation_space(space: dict) -> dict:
    items = {item.get("id"): item for item in space.get("decor", [])}
    claimed = set()
    for item in items.values():
        if item.get(ROLE) != "mounted":
            continue
        tower_id = item[TOWER]
        tower = items.get(tower_id)
        if (not tower or tower.get("kind") != "furniture" or tower.get("symbol") != "computer"
                or tower.get(ROLE) != "tower" or tower_id in claimed):
            raise vol.Invalid("Workstation must own one computer tower in the same space")
        claimed.add(tower_id)
    if any(item.get(ROLE) == "tower" and item.get("id") not in claimed for item in items.values()):
        raise vol.Invalid("Computer tower must belong to one workstation")
    return space


def standalone_workstation(item: dict) -> dict:
    """Reassemble around the independently moved tower, never around its desk."""
    if item.get("kind") != "furniture" or ROLE not in item and TOWER not in item:
        return item
    result = dict(item)
    if item.get("symbol") == "computer" and item.get(ROLE) == "tower":
        values = [item.get(key, 0) for key in ("x", "y", "w", "h", "angle")]
        if all(type(value) in (float, int) and math.isfinite(value) for value in values):
            x, y, width, _height, angle = values
            full_width = width * 4
            offset = (-1 if item.get("flip_h") else 1) * full_width * .375
            dx, dy = offset * math.cos(math.radians(angle)), offset * math.sin(math.radians(angle))
            restored_x, restored_y = x + width / 2 - dx - full_width / 2, y - dy
            # An invalid optional link must not turn otherwise readable decor
            # into a size/coordinate refusal while repairing an import.
            if (0 < full_width <= 5000 and abs(restored_x) <= 5000 and abs(restored_y) <= 5000):
                result.update(w=full_width, x=restored_x, y=restored_y)
    result.pop(ROLE, None)
    result.pop(TOWER, None)
    return result


def remap_workstation_items(items: list[dict], identities: dict[str, str]) -> list[dict]:
    """Input rows already own new IDs; references still name the source IDs."""
    by_id = {item.get("id"): item for item in items}
    claimed = set()
    result = []
    for item in items:
        if item.get("kind") == "furniture" and item.get(ROLE) == "mounted":
            target = identities.get(item.get(TOWER, ""))
            tower = by_id.get(target)
            if (not tower or tower.get("kind") != "furniture" or tower.get("symbol") != "computer"
                    or tower.get(ROLE) != "tower" or target in claimed):
                item = standalone_workstation(item)
            else:
                claimed.add(target)
                item = {**item, TOWER: target}
        result.append(item)
    return [standalone_workstation(item) if item.get(ROLE) == "tower" and item.get("id") not in claimed
            else item for item in result]


def empty_repair_report() -> dict:
    return {"detached": 0, "examples": []}


def merge_repair_reports(*reports) -> dict:
    result = empty_repair_report()
    for report in reports:
        if report:
            result["detached"] += int(report.get("detached", 0))
            result["examples"].extend(report.get("examples", []))
    result["examples"] = result["examples"][:MAX_EXAMPLES]
    return result


def repair_workstations(config: dict) -> dict:
    """Repair only optional links on a detached import; never guess another owner."""
    report = empty_repair_report()
    spaces = config.get("spaces", []) if isinstance(config, dict) else []
    if not isinstance(spaces, list):
        return report
    for space in spaces:
        if not isinstance(space, dict) or not isinstance(space.get("decor", []), list):
            continue
        items = space.get("decor", [])
        by_id = {item.get("id"): item for item in items if isinstance(item, dict) and isinstance(item.get("id"), str)}
        invalid = {}
        claims = {}
        for item in items:
            if not isinstance(item, dict) or ROLE not in item and TOWER not in item:
                continue
            try:
                validate_workstation_shape(item)
            except vol.Invalid:
                invalid[id(item)] = "invalid_fields"
                continue
            if item.get(ROLE) == "mounted":
                tower = by_id.get(item[TOWER])
                if (not tower or tower.get("kind") != "furniture" or tower.get("symbol") != "computer"
                        or tower.get(ROLE) != "tower" or TOWER in tower):
                    invalid[id(item)] = "missing_tower"
                else:
                    claims.setdefault(item[TOWER], []).append(item)
        owned = set()
        for tower_id, desks in claims.items():
            if len(desks) == 1:
                owned.add(tower_id)
            else:
                invalid.update((id(item), "ambiguous_tower") for item in desks)
        for item in items:
            if isinstance(item, dict) and item.get(ROLE) == "tower" and item.get("id") not in owned:
                invalid[id(item)] = "missing_desk"
        repaired = []
        for item in items:
            if id(item) in invalid:
                report["detached"] += 1
                if len(report["examples"]) < MAX_EXAMPLES:
                    report["examples"].append({"space_id": space.get("id"), "decor_id": item.get("id"),
                                               "reason": invalid[id(item)]})
                item = standalone_workstation(item) if item.get("kind") == "furniture" else {
                    key: value for key, value in item.items() if key not in {ROLE, TOWER}}
            repaired.append(item)
        if invalid:
            space["decor"] = repaired
    return report


class WorkstationWriterRequired(vol.Invalid):
    code = "furniture_workstation_client_outdated"


def guard_workstation_write(candidate: dict, previous: dict | None, writer=None) -> None:
    """Old clients may change coordinates/styles, never discard a new relationship."""
    if type(writer) is int and writer == API_VERSION:
        return

    def rows(config):
        result, extended = {}, set()
        for space in config.get("spaces", []) if isinstance(config, dict) else []:
            if not isinstance(space, dict) or not isinstance(space.get("id"), str):
                continue
            for item in space.get("decor", []) if isinstance(space.get("decor"), list) else []:
                if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                    continue
                key = (space["id"], item["id"])
                result.setdefault(key, []).append({field: item[field] for field in ("kind", "symbol", ROLE, TOWER)
                                                   if field in item})
                if ROLE in item or TOWER in item:
                    extended.add(key)
        return result, extended

    old, old_extended = rows(previous)
    new, new_extended = rows(candidate)
    from .partition_promotion import _same_json_fields

    for identity in old_extended | new_extended:
        if not _same_json_fields(old.get(identity), new.get(identity)):
            raise WorkstationWriterRequired("Update House Plan and reload before editing a workstation relationship")
