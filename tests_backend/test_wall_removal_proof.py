"""The same native exact graph corpus must give the same TS/Python verdicts."""
import json
from pathlib import Path
import subprocess

from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
proof = load_pure("custom_components.houseplan.wall_removal_proof",
                  ROOT / "custom_components/houseplan/wall_removal_proof.py")


def native_cases(name=None):
    script = "import {wallRemovalCase,wallRemovalProofCases} from './test/helpers/wall-removal-cases.mjs';" \
             "process.stdout.write(JSON.stringify(process.argv[1]?wallRemovalCase(process.argv[1]):wallRemovalProofCases()));"
    result = subprocess.run(["node", "--input-type=module", "--eval", script, *([name] if name else [])],
                            cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def test_shared_native_exact_material_corpus():
    for case in native_cases():
        assert proof.graph_only_removes_wall_material(case["before"], case["after"]) == case["expected"], case["name"]
