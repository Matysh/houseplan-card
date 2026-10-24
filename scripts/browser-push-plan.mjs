// #1044: bounded task evidence on every track; completeness belongs to release.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { selectSmokes, requiredSmokeIds, VISUAL_MINIMUM } from './smoke-select.mjs';
import { fingerprintCorpus, postCaptureInputs } from './source-fingerprint.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { readTaskVisualIntent, readPendingVisualIntents } from './task-visual-intent.mjs';
import { readTaskIntent } from './task-intent.mjs';

export function goldenConnections(scenarios = GOLDEN_SCENARIOS) {
  return {
    ...Object.fromEntries(scenarios.map(s => [`demo/golden/baselines/${s.id}.png`, [s.id]])),
    'demo/fixtures/device-issues.mjs': scenarios.filter(s => s.deviceIssues).map(s => s.id),
    'demo/golden/device-battery.mjs': scenarios.filter(s => s.batteryBoard).map(s => s.id),
  };
}

export function browserPushPlan({ files, diffText, labels = [], render = false, issue,
  root = process.cwd(), corpus = fingerprintCorpus(root), scenarios = GOLDEN_SCENARIOS,
  links = goldenConnections(scenarios), smokeSelection = selectSmokes(diffText, { root }),
  visualIntent = readTaskVisualIntent({ root, issue }), pendingVisual = null,
  declaredSmokes = visualIntent?.smokes ?? readTaskIntent({ root, issue })?.smokes ?? [] }) {
  if (labels.includes('ci:full')) return fullBrowserPlan(true, true);
  const sceneSet = new Set(scenarios.map(s => s.id));
  const relevant = new Set([...corpus, 'demo/golden/baselines/baselines-index.json']);
  const postCapture = new Set(postCaptureInputs());
  const goldenFiles = files.filter(f => relevant.has(f) || /^(?:src|assets)\//.test(f)
    || /^demo\/golden\/baselines\//.test(f)
    || /^demo\/(?:fixtures|golden)\/.*\.mjs$/.test(f) && !postCapture.has(f));
  const goldenDemand = labels.includes('ci:golden') || render || Boolean(visualIntent?.golden.length);
  let golden = { mode: 'none', ids: [], reason: goldenDemand ? 'no golden inputs changed' : 'no golden demand' };
  if (goldenDemand && (goldenFiles.length || visualIntent?.golden.length)) {
    const unknown = goldenFiles.filter(f => !Array.isArray(links[f]) || !links[f].length
      || links[f].some(id => !sceneSet.has(id)));
    const declared = visualIntent?.golden || [];
    if (unknown.length && !declared.length) throw Error('Task visual scope is not declared for '
      + unknown.join(', ') + '. Add visual.golden scene IDs and reasons to this issue release-ledger entry '
      + '(baselineIndex: node scripts/task-visual-intent.mjs --baseline-index). Full regression runs before beta.');
    const mapped = goldenFiles.flatMap(f => (links[f] || []).filter(id => sceneSet.has(id)));
    const changedScenes = [...diffText.matchAll(/^\+[^+].*?\bid:\s*['"]([^'"]+)['"]/gm)]
      .map(match => match[1]).filter(id => sceneSet.has(id));
    const ids = [...new Set([...mapped, ...declared.map(item => item.id), ...changedScenes])].sort();
    for (const id of ids) if (!sceneSet.has(id)) throw Error(`Unknown declared golden scene: ${id}`);
    const pending = pendingVisual || readPendingVisualIntents({ root });
    const intent = [...pending.golden, ...declared.map(item => ({ ...item, issue: visualIntent.issue || issue }))]
      .filter((item, index, values) => ids.includes(item.id)
        && values.findIndex(other => other.id === item.id && other.issue === item.issue) === index);
    golden = { mode: 'selected', ids, intent, reason: declared.length ? 'task visual intent and connected scenes' : 'declared golden connections',
      ...(unknown.length ? { unresolved: unknown } : {}) };
  }
  const allSmokes = new Set(readdirSync(join(root, 'demo')).filter(f => /^smoke_.*\.mjs$/.test(f)));
  const selected = requiredSmokeIds(smokeSelection);
  const changedSmokes = files.filter(f => /^demo\/smoke_[\w-]+\.mjs$/.test(f))
    .map(f => f.slice(5)).filter(id => allSmokes.has(id));
  const unknownSource = files.some(f => /^src\//.test(f)) && (smokeSelection.unproven || !smokeSelection.noExecutableDiff && !selected.length);
  const harnessChanged = files.some(f => /^demo\//.test(f) && !/^demo\/smoke_/.test(f)
    && !/^demo\/(golden|docs|stand)\//.test(f));
  const fallback = unknownSource || harnessChanged ? VISUAL_MINIMUM : [];
  const ids = [...new Set([...selected, ...changedSmokes, ...declaredSmokes, ...fallback])].sort();
  for (const id of ids) if (!allSmokes.has(id)) throw Error(`Unknown selected smoke: ${id}; update the task smoke connection`);
  const smoke = ids.length ? { mode: 'selected', ids,
    reason: fallback.length ? 'connected smokes and bounded visual minimum' : 'smoke-select, changed entries and task intent',
    ...(smokeSelection.deferred?.reasons.length ? { deferred: { ...smokeSelection.deferred,
      smokes: smokeSelection.deferred.smokes.filter(id => !ids.includes(id)) } } : {}) }
    : { mode: 'none', ids: [], reason: 'no related browser smoke' };
  return { schema: 1, scope: 'task', labels: [...labels].sort(), files: [...files].sort(), golden, smoke };
}

export { browserPlanExecution } from './browser-plan-proof.mjs';

export function fullBrowserPlan(full, golden) {
  return { schema: 1, scope: 'full', files: [], labels: [],
    smoke: { mode: full ? 'full' : 'none', ids: [], reason: full ? 'explicit full matrix' : 'no full request' },
    golden: { mode: golden ? 'full' : 'none', ids: [], reason: golden ? 'complete golden matrix' : 'no golden request' } };
}
