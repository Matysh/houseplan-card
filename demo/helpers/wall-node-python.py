"""Pure production CPU path of node_move; no running HA or user storage."""
import json
import sys
import types
from pathlib import Path

root = Path(__file__).resolve().parents[2]
# Match the pure-backend harness: import submodules without HA's __init__.
for name, path in (("custom_components", root / "custom_components"),
                   ("custom_components.houseplan", root / "custom_components" / "houseplan")):
    module = types.ModuleType(name)
    module.__path__ = [str(path)]
    sys.modules[name] = module

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA, validate_opening_passages, validate_partition_opening_hosts,
    validate_wall_model_transition,
)
from custom_components.houseplan.wall_node_move import node_move_candidate, node_move_host_baseline
from custom_components.houseplan.graph_validation_scope import graph_validation_scope

message = json.load(sys.stdin)
previous = message["config"]
args = (previous, message["space_id"], message["intent"], message["direction"], message.get("before_space"))
with graph_validation_scope():
    candidate = node_move_candidate(*args)
    validate_wall_model_transition(candidate, previous)
    candidate = CONFIG_SCHEMA(candidate)
    validate_opening_passages(candidate, previous)
    proved_baseline = node_move_host_baseline(previous, candidate, *args[1:])
    validate_partition_opening_hosts(candidate, proved_baseline)
    validate_junction_limits(candidate, previous)
json.dump(candidate, sys.stdout, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
