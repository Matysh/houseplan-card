"""Production geometry validation for an ordinary synthetic room write; no HA I/O."""
import json
import sys
import types
from pathlib import Path

root = Path(__file__).resolve().parents[2]
for name, path in (("custom_components", root / "custom_components"),
                   ("custom_components.houseplan", root / "custom_components" / "houseplan")):
    module = types.ModuleType(name)
    module.__path__ = [str(path)]
    sys.modules[name] = module

from custom_components.houseplan.graph_write import prepare_graph_candidate
from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA, validate_opening_passages, validate_partition_opening_hosts,
    validate_wall_model_transition,
)

payload = json.load(sys.stdin)
previous, message = payload["previous"], payload["message"]
try:
    # Same structural/host policy as ordinary config/set. This is not Optimize
    # and grants neither broad rehosting nor a frontend-only proof override.
    candidate = prepare_graph_candidate(message["config"], previous, message.get("graph_change"),
                                        schema_will_validate=True)
    validate_wall_model_transition(candidate, previous)
    candidate = CONFIG_SCHEMA(candidate)
    validate_opening_passages(candidate, previous)
    validate_partition_opening_hosts(candidate, previous, allow_room_wall_promotion=True)
    validate_junction_limits(candidate, previous)
    result = {"ok": True, "config": candidate}
except Exception as error:
    result = {"ok": False, "error": {"type": type(error).__name__, "message": str(error)}}
json.dump(result, sys.stdout, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
