"""Run the unmodified release backend validator without importing HA __init__."""
import importlib
import json
from pathlib import Path
import sys
import types

repo, results_file = map(Path, sys.argv[1:3])
package = types.ModuleType("houseplan_probe")
package.__path__ = [str(repo / "custom_components" / "houseplan")]
sys.modules[package.__name__] = package
limits = importlib.import_module("houseplan_probe.junction_limits")
data = json.loads(results_file.read_text(encoding="utf-8"))
before, after = data["originalConfig"], data["first"]["config"]
result = {"sourceCommit": data["sourceCommit"], "noHomeAssistantTransport": True}
for key, config in [("original", before), ("candidate", after)]:
    result[key] = limits.space_violation_counts(limits._migrated_spaces(config))
try:
    result["acceptedCounts"] = limits.validate_junction_limits(after, before)
    result["accepted"] = True
except limits.JunctionLimitError as error:
    result["accepted"] = False
    result["error"] = str(error)
    result["errorFields"] = vars(error)
out = results_file.with_name("junction-results.json")
out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
