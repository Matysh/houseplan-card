/**
 * #330 §5: the performance contract of the junction limits (#329).
 *
 * Guards the CLASS of regression — a quadratic path returning — not runner
 * noise: budgets are 2-3x the measured post-fix numbers. Measures the exact
 * code the write barrier runs: the pure П1-П5 checks over a 576-atom plan
 * (the S2 reproduction grid of #330), for both mirrors. The python half runs
 * through a child process with the real custom_components module.
 *
 * Runs on test-build/ like benchmark:wall-model — no browser, no bundle.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  checkNodes, checkSegmentLengths, checkNodeDistances, checkRoomClearance,
  cmToUnits,
} from '../test-build/junction-limits.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';
import {
  innerContourForRoom, multiWallNodesForGeometry, wallBodiesGeometry,
} from '../test-build/wall-thickness.js';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CELL = 5;
const GRID_N = 12; // 576 contour atoms — the #330 S2 grid
const WARMUPS = 2;
const SAMPLES = 5;

const BUDGETS = {
  tsSegmentLengthsMs: 40,
  tsNodeDistancesMs: 40,
  tsFullCandidateMs: 100,
  pyWarmValidateMs: 250,
  pyColdValidateMs: 3500,
};

const u = (cm) => cmToUnits(cm, CELL, GRID_STEP_N);
const rooms = []; const walls = []; let k = 0;
for (let i = 0; i < GRID_N; i++) {
  for (let j = 0; j < GRID_N; j++) {
    const x0 = u(310) * i; const y0 = u(310) * j;
    const poly = [[x0, y0], [x0 + u(300), y0], [x0 + u(300), y0 + u(300)], [x0, y0 + u(300)]];
    rooms.push({ id: `r${i}-${j}`, name: `r${i}${j}`, area: null, poly });
    for (let e = 0; e < 4; e++) {
      walls.push({ key: `w${k++}`, a: poly[e], b: poly[(e + 1) % 4], cm: 15 });
    }
  }
}
const legacy = {
  spaces: [{
    id: 's', title: 's', cell_cm: CELL, view_box: [0, 0, 1, 1],
    rooms, walls, openings: [], room_drafts: [], partitions: [], wall_columns: [],
  }],
  markers: [], settings: {},
};
const { config: v9 } = commitWallSegmentModel(JSON.parse(JSON.stringify(legacy)));
const space = v9.spaces[0];
const segments = (space.wall_segments || []).map((item) => ({
  id: item.id, a: item.a, b: item.b, cm: Number(item.cm),
}));

/** The same П1-П5 set the card's write barrier computes for one candidate. */
const fullCandidate = () => {
  const violations = [
    ...checkNodes(segments),
    ...checkSegmentLengths(segments, CELL, GRID_STEP_N),
    ...checkNodeDistances(segments, CELL, GRID_STEP_N),
  ];
  // #330 §4.7: shared passes exactly as the card computes them.
  const sharedNodes = multiWallNodesForGeometry(
    space.rooms || [], space.walls || [], [], GRID_STEP_N, CELL, GRID_STEP_N, 1,
  );
  let sharedRoomGeometry;
  if (sharedNodes.nodes.length) {
    const geometry = wallBodiesGeometry(
      space.rooms || [], space.walls || [], [], [], GRID_STEP_N, CELL, GRID_STEP_N, 1,
    );
    sharedRoomGeometry = geometry?.status === 'ok' || geometry?.status === 'degraded-extra'
      ? geometry.roomGeom : undefined;
  }
  for (const room of space.rooms || []) {
    let inner = null;
    try {
      inner = innerContourForRoom(
        space.rooms || [], String(room.id), space.walls || [], [],
        GRID_STEP_N, CELL, GRID_STEP_N, 1, sharedRoomGeometry, sharedNodes,
      );
    } catch { inner = null; }
    violations.push(...checkRoomClearance(String(room.id), inner, CELL, GRID_STEP_N));
  }
  return violations.length;
};

const median = (fn) => {
  for (let i = 0; i < WARMUPS; i++) fn();
  const times = [];
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((left, right) => left - right);
  return times[Math.floor(times.length / 2)];
};

const tsSegmentLengthsMs = median(() => checkSegmentLengths(segments, CELL, GRID_STEP_N));
const tsNodeDistancesMs = median(() => checkNodeDistances(segments, CELL, GRID_STEP_N));
const tsFullCandidateMs = median(fullCandidate);

// Python mirror: cold (legacy both sides) and warm (v9 + baseline counts).
const pyScript = `
import importlib.util, sys, types, os, json, time
root = ${JSON.stringify(REPO_ROOT)}
pr = os.path.join(root, 'custom_components'); hr = os.path.join(pr, 'houseplan')
pkg = types.ModuleType('custom_components'); pkg.__path__ = [pr]; sys.modules['custom_components'] = pkg
p2 = types.ModuleType('custom_components.houseplan'); p2.__path__ = [hr]; sys.modules['custom_components.houseplan'] = p2
spec = importlib.util.spec_from_file_location('custom_components.houseplan.junction_limits', os.path.join(hr, 'junction_limits.py'))
jl = importlib.util.module_from_spec(spec); sys.modules[spec.name] = jl; spec.loader.exec_module(jl)
legacy = json.load(sys.stdin)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model
v9, _ = commit_wall_segment_model(json.loads(json.dumps(legacy)))
prev = json.loads(json.dumps(v9)); cand = json.loads(json.dumps(v9))
cand['spaces'][0]['rooms'][0]['name'] = 'x'
t0 = time.perf_counter()
jl.validate_junction_limits(json.loads(json.dumps(legacy)), json.loads(json.dumps(legacy)))
cold = 1000 * (time.perf_counter() - t0)
counts = jl.validate_junction_limits(json.loads(json.dumps(cand)), json.loads(json.dumps(prev)))
best = None
for _ in range(3):
    t0 = time.perf_counter()
    jl.validate_junction_limits(json.loads(json.dumps(cand)), None, baseline_counts=counts)
    warm = 1000 * (time.perf_counter() - t0)
    best = warm if best is None else min(best, warm)
print(json.dumps({'pyColdValidateMs': cold, 'pyWarmValidateMs': best}))
`;
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const pyRun = spawnSync(python, ['-c', pyScript], {
  input: JSON.stringify(legacy), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
if (pyRun.status !== 0) {
  console.error('python mirror failed:', (pyRun.stderr || '').slice(-2000));
  process.exit(1);
}
const py = JSON.parse(pyRun.stdout.trim().split('\n').pop());

const results = {
  tsSegmentLengthsMs, tsNodeDistancesMs, tsFullCandidateMs,
  pyWarmValidateMs: py.pyWarmValidateMs, pyColdValidateMs: py.pyColdValidateMs,
};
const pass = Object.entries(BUDGETS).every(([name, budget]) => results[name] <= budget);
console.log(JSON.stringify({
  issue: 330,
  fixture: { atoms: segments.length, grid: `${GRID_N}x${GRID_N}` },
  warmups: WARMUPS, samples: SAMPLES,
  results: Object.fromEntries(Object.entries(results).map(
    ([name, value]) => [name, Math.round(value * 10) / 10],
  )),
  budgets: BUDGETS,
  pass,
}, null, 2));
if (!pass) process.exitCode = 1;
