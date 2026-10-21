// #983: a selected push is progress evidence, never a full-matrix receipt.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { selectSmokes } from './smoke-select.mjs';
import { fingerprintCorpus, postCaptureInputs } from './source-fingerprint.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';

export function goldenConnections(scenarios = GOLDEN_SCENARIOS) {
  return {
    ...Object.fromEntries(scenarios.map(s => [`demo/golden/baselines/${s.id}.png`, [s.id]])),
    'demo/fixtures/device-issues.mjs': scenarios.filter(s => s.deviceIssues).map(s => s.id),
    'demo/golden/device-battery.mjs': scenarios.filter(s => s.batteryBoard).map(s => s.id),
  };
}

export function browserPushPlan({ files, diffText, labels = [], render = false,
  root = process.cwd(), corpus = fingerprintCorpus(root), scenarios = GOLDEN_SCENARIOS,
  links = goldenConnections(scenarios), smokeSelection = selectSmokes(diffText, { root }) }) {
  const allScenes = scenarios.map(s => s.id).sort();
  const sceneSet = new Set(allScenes);
  const relevant = new Set([...corpus, 'demo/golden/baselines/baselines-index.json']);
  const postCapture = new Set(postCaptureInputs());
  const goldenFiles = files.filter(f => relevant.has(f) || /^(?:src|assets)\//.test(f)
    || /^demo\/golden\/baselines\//.test(f)
    || /^demo\/(?:fixtures|golden)\/.*\.mjs$/.test(f) && !postCapture.has(f));
  const goldenDemand = labels.includes('ci:golden') || labels.includes('ci:full') || render;
  let golden = { mode: 'none', ids: [], reason: goldenDemand ? 'no golden inputs changed' : 'no golden demand' };
  if (goldenDemand && goldenFiles.length) {
    const unknown = goldenFiles.filter(f => !Array.isArray(links[f]) || !links[f].length
      || links[f].some(id => !sceneSet.has(id)));
    golden = unknown.length
      ? { mode: 'full', ids: allScenes, reason: 'unproven golden connection', fallback: unknown }
      : { mode: 'selected', ids: [...new Set(goldenFiles.flatMap(f => links[f]))].sort(), reason: 'declared golden connections' };
  }
  let smoke = { mode: 'none', ids: [], reason: labels.includes('ci:full') ? 'no smoke inputs changed' : 'no full demand' };
  if (labels.includes('ci:full')) {
    const allSmokes = readdirSync(join(root, 'demo')).filter(f => /^smoke_.*\.mjs$/.test(f)).sort();
    const selected = [...new Set([...(smokeSelection.direct || []), ...(smokeSelection.registered || [])]
      .map(item => typeof item === 'string' ? item : item.smoke).filter(Boolean))].sort();
    const changedSmokes = files.filter(f => /^demo\/smoke_[\w-]+\.mjs$/.test(f)).map(f => f.slice(5));
    const ids = [...new Set([...selected, ...changedSmokes])].sort();
    const unknownSource = files.some(f => /^src\//.test(f)) && (smokeSelection.unproven || !ids.length);
    const unknownEntry = ids.some(id => !allSmokes.includes(id));
    const harnessChanged = files.some(f => /^demo\//.test(f) && !/^demo\/smoke_/.test(f)
      && !/^demo\/(golden|docs|stand)\//.test(f));
    smoke = unknownSource || unknownEntry || harnessChanged
      ? { mode: 'full', ids: allSmokes,
        reason: unknownSource ? 'unproven source connection' : unknownEntry ? 'removed or unknown smoke entry' : 'shared browser harness changed' }
      : ids.length ? { mode: 'selected', ids, reason: 'smoke-select and changed smoke entries' } : smoke;
  }
  if (smoke.mode === 'full') golden = { mode: 'full', ids: allScenes, reason: 'full matrix after conservative smoke fallback' };
  return { schema: 1, scope: 'push', labels: [...labels].sort(), files: [...files].sort(), golden, smoke };
}

export { browserPlanExecution } from './browser-plan-proof.mjs';

export function fullBrowserPlan(full, golden) {
  return { schema: 1, scope: 'full', files: [], labels: [],
    smoke: { mode: full ? 'full' : 'none', ids: [], reason: full ? 'explicit full matrix' : 'no full request' },
    golden: { mode: golden ? 'full' : 'none', ids: [], reason: golden ? 'complete golden matrix' : 'no golden request' } };
}
