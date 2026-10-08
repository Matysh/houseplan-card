// #277: warm Resize-layer render cost on the supported large-house ceiling.
// The deterministic snapshot-call assertion catches the original regression
// even when runner timing noise happens to keep the p95 below its budget.
// #821: the snapshot is counted on the object whose _renderResizeLayer really
// calls it. The card only delegates Resize rendering to the editor runtime,
// which calls its own _rszSnapshot, so a counter on the card saw 0 calls and
// the benchmark failed without measuring anything. Zero is never evidence.
import { makeLargeHouseFixture, LARGE_HOUSE_COUNTS } from './fixtures/large-house.mjs';
import { launch } from './serve.mjs';

const WARMUPS = 3;
const SAMPLES = 20;
const RENDER_P95_MS = 25;
const fixture = makeLargeHouseFixture();
const config = { ...fixture.config, spaces: [fixture.config.spaces[0]] };
const { page, browser } = await launch();

const result = await page.evaluate(async ({ config, warmups, samples }) => {
  const card = window.__card;
  card._serverCfg = structuredClone(config);
  card._space = config.spaces[0].id;
  card._modelCache = null;
  card._cfgEpoch++;
  card._setMode('plan');
  card._tool = 'resize';
  card.requestUpdate();
  await card.updateComplete;

  const view = card._viewOr(card._baseVb());
  // The owner of the Resize render path: the lazily loaded editor runtime,
  // which the card's _renderResizeLayer delegates to.
  const owner = card._editorRuntime;
  if (!owner || typeof owner._renderResizeLayer !== 'function'
    || typeof owner._rszSnapshot !== 'function') {
    throw new Error('#821: the editor runtime that renders the Resize layer is not loaded');
  }
  const ownSnapshot = Object.getOwnPropertyDescriptor(owner, '_rszSnapshot');
  const originalSnapshot = owner._rszSnapshot;
  let snapshotCalls = 0;
  owner._rszSnapshot = function countedSnapshot(...args) {
    snapshotCalls++;
    return originalSnapshot.apply(this, args);
  };

  for (let index = 0; index < warmups; index++) card._renderResizeLayer(view);
  const warmupSnapshotCalls = snapshotCalls;
  snapshotCalls = 0;
  const times = [];
  for (let index = 0; index < samples; index++) {
    const started = performance.now();
    card._renderResizeLayer(view);
    times.push(performance.now() - started);
  }
  if (ownSnapshot) Object.defineProperty(owner, '_rszSnapshot', ownSnapshot);
  else delete owner._rszSnapshot;
  return {
    times,
    snapshotCalls,
    warmupSnapshotCalls,
    roomCount: card._rszRooms().length,
    handleCount: card._rszRooms().reduce((sum, room) => sum + room.poly.length, 0),
  };
}, { config, warmups: WARMUPS, samples: SAMPLES });

await browser.close();
const quantile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};
const render = {
  min: Math.min(...result.times),
  median: quantile(result.times, 0.5),
  p95: quantile(result.times, 0.95),
  max: Math.max(...result.times),
};
const failures = [];
if (result.snapshotCalls === 0) {
  failures.push('snapshot counter saw no calls: the wrapped _rszSnapshot is not on the Resize '
    + 'render path, so zero proves nothing about caching (#821)');
} else if (result.snapshotCalls !== SAMPLES) {
  failures.push(`expected exactly one geometry snapshot per rendered frame, got `
    + `${result.snapshotCalls} in ${SAMPLES} frames`);
}
if (result.roomCount !== 20) failures.push(`expected 20 rooms, got ${result.roomCount}`);
if (result.handleCount !== 80) failures.push(`expected 80 handles, got ${result.handleCount}`);
if (render.p95 > RENDER_P95_MS) failures.push(`render p95 ${render.p95} ms exceeds ${RENDER_P95_MS} ms`);
const pass = failures.length === 0;
console.log(JSON.stringify({
  issue: 277,
  fixture: LARGE_HOUSE_COUNTS,
  warmups: WARMUPS,
  samples: SAMPLES,
  roomCount: result.roomCount,
  handleCount: result.handleCount,
  snapshotOwner: 'editor-runtime',
  warmupSnapshotCalls: result.warmupSnapshotCalls,
  snapshotCalls: result.snapshotCalls,
  snapshotCallsPerFrame: result.snapshotCalls / SAMPLES,
  render,
  budgets: { renderP95Ms: RENDER_P95_MS, maxSnapshotCallsPerFrame: 1 },
  failures,
  pass,
}, null, 2));
if (!pass) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
}
