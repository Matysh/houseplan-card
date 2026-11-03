"""Recognise an exact copy of a stored space, never a client validation waiver."""
from __future__ import annotations

import copy
import re


COPY_KEYS = (
    "settings", "zero_wall_style", "cell_cm", "view_box", "plan_url", "plan_aspect",
    "plan_x", "plan_y", "plan_scale", "plan_scale_x", "plan_scale_y", "plan_angle",
    "plan_opacity",
)


def _base36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    result = ""
    while value:
        value, digit = divmod(value, 36)
        result = digits[digit] + result
    return result or "0"


def space_copy_candidate(config: dict, source_id: str, title: str, seed: str,
                         *, furniture: bool = False, decor: bool = False) -> dict:
    """Mirror the immutable roomless-copy projection in src/space-copy.ts.

    Identity is generated from a bounded seed; all geometry comes from the
    trusted source. Schema/size limits remain the writer's responsibility.
    """
    source = next(space for space in config["spaces"] if space["id"] == source_id)
    if not isinstance(source.get("wall_segments"), list) and int(config.get("model_version", 0)) < 8:
        from .graph_write import normalize_graph_config

        config = normalize_graph_config(config)
    spaces = config["spaces"]
    source_index = next(i for i, space in enumerate(spaces) if space["id"] == source_id)
    source = spaces[source_index]
    serial = 0

    def new_id(prefix):
        nonlocal serial
        identity = prefix + seed + _base36(serial)
        serial += 1
        return identity

    walls, partitions = {}, {}
    carriers = []
    for collection, prefix, mapping in (("wall_segments", "cw", walls), ("partitions", "cp", partitions)):
        for wall in source.get(collection, []):
            identity = new_id(prefix)
            mapping[wall["id"]] = identity
            carriers.append({**copy.deepcopy(wall), "id": identity})
    openings = []
    for opening in source.get("openings", []):
        host = opening["host"]
        mapping = walls if host["kind"] == "wall" else partitions
        item = {**copy.deepcopy(opening), "id": new_id("co"),
                "host": {**copy.deepcopy(host), "kind": "partition", "id": mapping[host["id"]]}}
        item.pop("contact", None)
        item.pop("lock", None)
        openings.append(item)
    decoration = [{**copy.deepcopy(item), "id": new_id("cd")}
                  for item in source.get("decor", [])
                  if (furniture if item.get("kind") == "furniture" else decor)]
    columns = [{**copy.deepcopy(item), "id": new_id("cc")} for item in source.get("wall_columns", [])]
    stairs = [{**copy.deepcopy(item), "id": new_id("cs")} for item in source.get("stairs", [])]
    target = {"id": "s" + seed, "title": title.strip(), "rooms": [], "wall_segments": [],
              "view_box": copy.deepcopy(source["view_box"])}
    for key in COPY_KEYS:
        if key in source:
            target[key] = copy.deepcopy(source[key])
    for key, rows in (("partitions", carriers), ("openings", openings), ("decor", decoration),
                      ("wall_columns", columns), ("stairs", stairs)):
        if rows:
            target[key] = rows
    if int(config.get("model_version", 0)) >= 11:
        from .plan_graph import project_graph_space

        graph = source["plan_graph"]
        nodes = {node["id"]: new_id("cn") for node in graph["nodes"]}
        copied_graph = {
            "version": 1,
            "nodes": [{"id": nodes[node["id"]], "p": copy.deepcopy(node["p"])} for node in graph["nodes"]],
            "edges": [{**copy.deepcopy(edge), "kind": "partition",
                       "id": (walls if edge["kind"] == "wall" else partitions)[edge["id"]],
                       "from": nodes[edge["from"]], "to": nodes[edge["to"]]} for edge in graph["edges"]],
            "rooms": [],
            "dependencies": [{**copy.deepcopy(item), "node": nodes[item["node"]],
                              "refs": [{"from": nodes[ref["from"]], "to": nodes[ref["to"]]}
                                       for ref in item["refs"]]} for item in graph["dependencies"]],
        }
        copied_graph["nodes"].sort(key=lambda item: item["id"])
        copied_graph["edges"].sort(key=lambda item: item["kind"] + ":" + item["id"])
        copied_graph["dependencies"].sort(key=lambda item: item["node"])
        target = project_graph_space(target, copied_graph)["space"]
    result = copy.deepcopy(config)
    result["spaces"].insert(source_index + 1, target)
    return result


def is_saved_space_copy(candidate: dict, previous: dict | None) -> bool:
    """Prove the whole write is one exact copy of its stored predecessor.

    No request flag is trusted. Altering the source, another space, metadata,
    markers or any copied coordinate makes this an ordinary strict write.
    The proof also handles the normal first-write migration to graph model11.
    """
    if not previous:
        return False
    old_spaces, spaces = previous.get("spaces", []), candidate.get("spaces", [])
    if len(spaces) != len(old_spaces) + 1:
        return False
    old_ids = {space["id"] for space in old_spaces}
    added = [i for i, space in enumerate(spaces) if space["id"] not in old_ids]
    if len(added) != 1 or added[0] == 0:
        return False
    index = added[0]
    target = spaces[index]
    identity = target.get("id", "")
    if not re.fullmatch(r"s[a-z0-9]{1,48}", identity):
        return False
    source_id = spaces[index - 1]["id"]
    try:
        from .graph_write import normalize_graph_config, preserve_legacy_structure
        from .room_appearance import normalize_room_appearance
        from .validation import CONFIG_SCHEMA

        # Presence determines the selected categories; a partial category can
        # never match the complete source projection below.
        decoration = target.get("decor", [])
        migrating = int(candidate.get("model_version", 0)) >= 11 and int(previous.get("model_version", 0)) < 11
        sources = [previous]
        if migrating:
            sources.append(normalize_graph_config(previous))
        for trusted in sources:
            expected = space_copy_candidate(
                trusted, source_id, target["title"], identity[1:],
                furniture=any(item.get("kind") == "furniture" for item in decoration),
                decor=any(item.get("kind") != "furniture" for item in decoration),
            )
            if migrating and int(expected.get("model_version", 0)) < 11:
                expected = normalize_graph_config(expected)
            checked = CONFIG_SCHEMA(expected)
            if int(expected.get("model_version", 0)) < 11:
                checked = preserve_legacy_structure(checked, expected)
            if candidate == normalize_room_appearance(checked):
                return True
        return False
    except (KeyError, ValueError, TypeError, StopIteration):
        return False
