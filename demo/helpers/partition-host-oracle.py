"""Browser fixture calls the production same-wall proof, not a permissive mock.

This stdlib bridge is not a replacement for schema/HA WS tests. Those tests
exercise the complete writer, CAS and durable store with the same synthetic seed.
"""
import importlib
import json
import sys
import types
from pathlib import Path

for name, path in (
    ("custom_components", Path(__file__).resolve().parents[2] / "custom_components"),
    ("custom_components.houseplan", Path(__file__).resolve().parents[2] / "custom_components/houseplan"),
):
    namespace = types.ModuleType(name)
    namespace.__path__ = [str(path)]
    sys.modules[name] = namespace
proof = importlib.import_module("custom_components.houseplan.partition_promotion").same_partition_wall_promotion

payload = json.load(sys.stdin)
old_spaces = {space["id"]: space for space in payload["previous"]["spaces"]}
accepted = True
for space in payload["config"]["spaces"]:
    old_space = old_spaces.get(space["id"], {})
    old_openings = {opening["id"]: opening for opening in old_space.get("openings", [])}
    for opening in space.get("openings", []):
        old = old_openings.get(opening["id"], {})
        host, old_host = opening.get("host", {}), old.get("host", {})
        if old_host.get("kind") != "partition" or host == old_host:
            continue
        old_partition = next((wall for wall in old_space.get("partitions", []) if wall["id"] == old_host["id"]), None)
        wall = next((wall for wall in space.get("wall_segments", []) if wall["id"] == host.get("id")), None)
        accepted &= (
            space.get("cell_cm", 5) == old_space.get("cell_cm", 5)
            and not any(wall["id"] == host.get("id") for wall in space.get("partitions", []))
            and any(host.get("id") in room.get("wall_ids", []) for room in space.get("rooms", []))
            and proof(old, opening, old_partition, wall)
        )
print(json.dumps({"ok": accepted, "code": None if accepted else "invalid_partition_opening_host"}))
