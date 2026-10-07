"""#803 mandatory executable parity, never an optional silent pytest skip."""
import json
import subprocess
from pathlib import Path

from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
MODULE = load_pure("custom_components.houseplan.wall_node_move", ROOT / "custom_components/houseplan/wall_node_move.py")
CASES = ROOT / "test/fixtures/803-wall-node-parity.json"
NODE = """
import {commitWallSegmentModel} from './test-build/wall-segment-model.js';
import {canonicalizeConfigGeometryInPlace} from './test-build/coordinate-canonicalization.js';
import {applyNodeMove,prepareNodeMove,structuralWallNodes} from './test-build/wall-node-move.js';
let input=''; for await(const piece of process.stdin) input+=piece;
const out=JSON.parse(input).map(c=>{
  const base=commitWallSegmentModel({spaces:[{id:'f',rooms:[],partitions:c.walls,openings:c.openings||[],future:{opaque:true}}],markers:[],settings:{}}).config;
  const space=base.spaces[0], nodes=structuralWallNodes(space);
  const node=nodes.find(n=>Math.hypot(n.point[0]-c.point[0],n.point[1]-c.point[1])<1e-8);
  const splits=Object.fromEntries(c.walls.map((w,i)=>['partition:'+w.id,'partition-00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')]));
  const result=applyNodeMove(prepareNodeMove(space,node,nodes,splits),c.target,c.axis);
  if(!result.ok) return {name:c.name,ok:false,reason:result.reason};
  const config=commitWallSegmentModel({...base,spaces:[result.space]}).config;
  canonicalizeConfigGeometryInPlace(config); return {name:c.name,ok:true,config};
}); console.log(JSON.stringify(out));
"""


def run():
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    # The complete unsupported matrix is independently exercised with whole
    # carriers and with every passing carrier atomized at the old junction.
    for case in cases[:]:
        if not case["name"].startswith("unsupported-"):
            continue
        atoms = []
        for wall in case["walls"]:
            if wall["a"] != [0, 0] and wall["b"] != [0, 0]:
                atoms.extend([{**wall, "b": [0, 0]}, {**wall, "id": wall["id"] + "-atom", "a": [0, 0]}])
            else:
                atoms.append(wall)
        cases.append({**case, "name": case["name"] + "-atoms", "walls": atoms})
    # Only X can split. Unused allocations are intentionally dropped to stay
    # within the protocol's two-ID limit and do not alter either runtime's proof.
    python = []
    for case in cases:
        base = MODULE.commit_wall_segment_model({"spaces": [{"id": "f", "rooms": [], "partitions": case["walls"],
            "openings": case.get("openings", []), "future": {"opaque": True}}], "markers": [], "settings": {}})[0]
        splits = {f'partition:{w["id"]}': f'partition-00000000-0000-4000-8000-{i + 1:012d}'
                  for i, w in enumerate(case["walls"]) if w["id"] == "v"}
        intent = {"point": case["point"], "target": case["target"], "axis": case["axis"], "split_ids": splits}
        try:
            config = MODULE.node_move_candidate(base, "f", intent)
            python.append({"name": case["name"], "ok": True, "config": config})
            assert MODULE.node_move_candidate(config, "f", intent, "undo", base["spaces"][0]) == base
        except MODULE.NodeMoveError as error:
            python.append({"name": case["name"], "ok": False, "reason": error.code.removeprefix("node_move_")})
        assert python[-1]["ok"] == case["ok"], case["name"]
        if case["name"].startswith("unsupported-"):
            assert python[-1]["reason"] == "unsupported_junction", case["name"]
    result = subprocess.run(["node", "--input-type=module", "--eval", NODE], cwd=ROOT,
        input=json.dumps(cases), text=True, capture_output=True, check=True)
    frontend = json.loads(result.stdout)
    assert frontend == python, json.dumps({"typescript": frontend, "python": python}, indent=2)
    print(f"wall-node parity: {len(cases)} scenarios; TS/Python candidates and refusal verdicts identical; inverses exact")


if __name__ == "__main__":
    run()
