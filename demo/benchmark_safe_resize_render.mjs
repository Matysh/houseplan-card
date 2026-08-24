// #277: warm Resize-layer render cost on the supported large-house ceiling.
// The deterministic snapshot-call assertion catches the original regression
// even when runner timing noise happens to keep the p95 below its budget.
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
  const originalSnapshot = card._rszSnapshot.bind(card);
  let snapshotCalls = 0;
  card._rszSnapshot = () => {
    snapshotCalls++;
    return originalSnapshot();
  };

  for (let index = 0; index < warmups; index++) card._renderResizeLayer(view);
  snapshotCalls = 0;
  const times = [];
  for (let index = 0; index < samples; index++) {
    const started = performance.now();
    card._renderResizeLayer(view);
    times.push(performance.now() - started);
  }
  card._rszSnapshot = originalSnapshot;
  return {
    times,
    snapshotCalls,
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
const pass = result.snapshotCalls === SAMPLES
  && result.roomCount === 20
  && result.handleCount === 80
  && render.p95 <= RENDER_P95_MS;
console.log(JSON.stringify({
  issue: 277,
  fixture: LARGE_HOUSE_COUNTS,
  warmups: WARMUPS,
  samples: SAMPLES,
  roomCount: result.roomCount,
  handleCount: result.handleCount,
  snapshotCalls: result.snapshotCalls,
  snapshotCallsPerFrame: result.snapshotCalls / SAMPLES,
  render,
  budgets: { renderP95Ms: RENDER_P95_MS, maxSnapshotCallsPerFrame: 1 },
  pass,
}, null, 2));
if (!pass) process.exitCode = 1;
