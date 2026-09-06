// #474: lazy designer furniture artwork. The runtime mirrors LanguageRuntime /
// EditorRuntimeLoader: pending → ready | fallback, fallback is settled, the
// second attempt goes through a nonce URL, a foreign build is terminal, and
// the editor hands the artwork over synchronously.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FurnitureArtRuntime, configNeedsFurnitureArt, furnitureArtBootPending,
  ensureFurnitureArtFor, composeUnsub,
} from '../test-build/furniture-art-runtime.js';
import { resolveFurniturePlacement } from '../test-build/furniture-placement.js';
import { furnitureGraphic, furnitureArtIsLazy, furnitureSymbol } from '../test-build/furniture.js';

const ART = Object.freeze({ sofa: { d: 'M0 0h1', viewW: 180, viewH: 90 } });
const FP = 'build-A';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const host = () => {
  const h = { isConnected: true, updates: 0, requestUpdate() { this.updates++; } };
  return h;
};

const runtime = (loads, extra = {}) => {
  const attempts = [];
  return {
    attempts,
    runtime: new FurnitureArtRuntime({
      expectedFingerprint: FP,
      warn: () => {},
      load: async (attempt) => {
        attempts.push(attempt);
        const step = loads[attempts.length - 1];
        if (step instanceof Error) throw step;
        return step;
      },
      ...extra,
    }),
  };
};

test('pending until ensure; a successful load installs the artwork and re-renders hosts', async () => {
  const { runtime: r, attempts } = runtime([{ GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: FP }]);
  const h = host();
  assert.equal(r.state(), 'pending');
  assert.equal(r.art('sofa', h), undefined);
  await r.ensure();
  assert.equal(r.state(), 'ready');
  assert.deepEqual(r.art('sofa'), ART.sofa);
  assert.equal(h.updates, 1, 'the host that rendered while pending is re-rendered once');
  await r.ensure();
  assert.equal(attempts.length, 1, 'ensure is idempotent once settled');
});

test('two failed attempts settle into fallback: state is terminal-free, ensure resolves, hosts re-render', async () => {
  const failed = [];
  const { runtime: r, attempts } = runtime(
    [new Error('net'), new Error('net again')],
    { loadFailed: (terminal) => failed.push(terminal) },
  );
  const h = host();
  r.art('sofa', h);
  await r.ensure();
  assert.equal(r.state(), 'fallback');
  assert.deepEqual(attempts, [0, 1], 'exactly one retry, through attempt 1');
  assert.equal(r.terminal, false);
  assert.deepEqual(failed, [false]);
  assert.equal(h.updates, 1, 'fallback re-renders the waiting host so it stops waiting');
  assert.equal(r.art('sofa'), undefined);
  await r.ensure();
  assert.equal(attempts.length, 2, 'fallback is settled: no background retries');
});

test('a foreign build fingerprint is terminal: no second import, fallback, loadFailed(true)', async () => {
  const failed = [];
  const { runtime: r, attempts } = runtime(
    [{ GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: 'build-B' }],
    { loadFailed: (terminal) => failed.push(terminal) },
  );
  await r.ensure();
  assert.equal(r.state(), 'fallback');
  assert.equal(r.terminal, true);
  assert.deepEqual(attempts, [0], 'a fingerprint mismatch does not retry — only a refresh helps');
  assert.deepEqual(failed, [true]);
});

test('the first attempt failing and the second succeeding is ready, not fallback', async () => {
  const { runtime: r, attempts } = runtime([new Error('cached failure'), { GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: FP }]);
  await r.ensure();
  assert.equal(r.state(), 'ready');
  assert.deepEqual(attempts, [0, 1]);
});

test('adopt is synchronous, rejects a foreign fingerprint and is a no-op once ready', () => {
  const warnings = [];
  const { runtime: r } = runtime([], { warn: (message) => warnings.push(message) });
  const h = host();
  r.art('sofa', h);
  assert.equal(r.adopt(ART, 'build-B'), false);
  assert.equal(r.state(), 'pending');
  assert.equal(warnings.length, 1);
  assert.equal(r.adopt(ART, FP), true);
  assert.equal(r.state(), 'ready');
  assert.equal(h.updates, 1);
  assert.equal(r.adopt({ other: { d: 'M0 0', viewW: 1, viewH: 1 } }, FP), true, 'repeated adopt is a no-op');
  assert.equal(r.art('other'), undefined);
});

test('adopt during an in-flight load wins and the load result is not re-installed', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const r = new FurnitureArtRuntime({
    expectedFingerprint: FP, warn: () => {},
    load: async () => { await gate; return { GENERATED_FURNITURE_ART: { late: { d: 'M0 0', viewW: 1, viewH: 1 } }, FURNITURE_ART_FINGERPRINT: FP }; },
  });
  const pending = r.ensure();
  r.adopt(ART, FP);
  release();
  await pending;
  assert.equal(r.state(), 'ready');
  assert.deepEqual(r.art('sofa'), ART.sofa);
  assert.equal(r.art('late'), undefined);
});

test('onSettled fires once when the runtime leaves pending, and immediately when already settled', async () => {
  const { runtime: r } = runtime([{ GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: FP }]);
  const calls = [];
  r.onSettled(() => calls.push('a'));
  await r.ensure();
  assert.deepEqual(calls, ['a']);
  r.onSettled(() => calls.push('b'));
  await tick();
  assert.deepEqual(calls, ['a', 'b']);
});

test('only a single in-flight load exists, however many callers ensure()', async () => {
  const { runtime: r, attempts } = runtime([{ GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: FP }]);
  await Promise.all([r.ensure(), r.ensure(), r.ensure()]);
  assert.equal(attempts.length, 1);
});

// ------------------------------------------------------------ config helpers

const isDesigner = (symbol) => symbol === 'sofa';

test('configNeedsFurnitureArt: only designer furniture counts; legacy, other decor and empty plans do not', () => {
  assert.equal(configNeedsFurnitureArt(null, isDesigner), false);
  assert.equal(configNeedsFurnitureArt({ spaces: [] }, isDesigner), false);
  assert.equal(configNeedsFurnitureArt({ spaces: [{ decor: [{ kind: 'rect' }] }] }, isDesigner), false);
  assert.equal(configNeedsFurnitureArt({ spaces: [{ decor: [{ kind: 'furniture', symbol: 'fridge' }] }] }, isDesigner), false);
  assert.equal(configNeedsFurnitureArt({ spaces: [null, { decor: null }, { decor: [{ kind: 'furniture', symbol: 'sofa' }] }] }, isDesigner), true);
});

test('boot gate waits only while pending AND the plan needs artwork; fallback counts as settled', async () => {
  const withSofa = { spaces: [{ decor: [{ kind: 'furniture', symbol: 'sofa' }] }] };
  const { runtime: pendingRuntime } = runtime([]);
  assert.equal(furnitureArtBootPending(pendingRuntime, withSofa, isDesigner), true);
  assert.equal(furnitureArtBootPending(pendingRuntime, { spaces: [] }, isDesigner), false, 'a plan without furniture never waits');
  const { runtime: failed } = runtime([new Error('x'), new Error('y')]);
  await failed.ensure();
  assert.equal(furnitureArtBootPending(failed, withSofa, isDesigner), false, 'fallback lifts the veil');
  const { runtime: ready } = runtime([]);
  ready.adopt(ART, FP);
  assert.equal(furnitureArtBootPending(ready, withSofa, isDesigner), false);
});

test('ensureFurnitureArtFor starts the load and registers the host only when the plan needs artwork', async () => {
  const { runtime: r, attempts } = runtime([{ GENERATED_FURNITURE_ART: ART, FURNITURE_ART_FINGERPRINT: FP }]);
  const h = host();
  ensureFurnitureArtFor(r, { spaces: [] }, isDesigner, h);
  await tick();
  assert.equal(attempts.length, 0, 'no furniture — no request');
  ensureFurnitureArtFor(r, { spaces: [{ decor: [{ kind: 'furniture', symbol: 'sofa' }] }] }, isDesigner, h);
  await r.ensure();
  assert.equal(attempts.length, 1);
  assert.equal(h.updates, 1, 'the host registered at intake is re-rendered once the artwork lands');
});

test('composeUnsub calls every handle once', () => {
  const calls = [];
  composeUnsub(() => calls.push(1), () => calls.push(2))();
  assert.deepEqual(calls, [1, 2]);
});

// ------------------------------------------------------- library integration

test('the wall magnet places a designer piece while its artwork is still pending (AC6)', () => {
  // The real page runtime is untouched here: nothing adopted, nothing ensured.
  assert.equal(furnitureArtIsLazy('sofa'), true);
  assert.ok(furnitureSymbol('sofa'), 'catalogue is eager');
  const placement = resolveFurniturePlacement({
    symbol: 'sofa', widthCm: 180, depthCm: 90, point: [0.5, 0.5],
    canvasW: 1000, canvasH: 1000, cellCm: 5, gridPitch: 20, walls: [], wallReach: 0, free: true,
  });
  assert.ok(placement, 'placement needs the catalogue, not the artwork');
  assert.equal(resolveFurniturePlacement({
    symbol: 'no_such_symbol', widthCm: 10, depthCm: 10, point: [0.5, 0.5],
    canvasW: 1000, canvasH: 1000, cellCm: 5, gridPitch: 20, walls: [], wallReach: 0, free: true,
  }), null, 'an unknown symbol is still refused');
});

test('furnitureGraphic: legacy art is eager, designer art is undefined until the page runtime settles', () => {
  assert.ok(furnitureGraphic('fridge')?.d, 'legacy primitive art needs no chunk');
  assert.equal(furnitureArtIsLazy('fridge'), false);
  assert.equal(furnitureGraphic('no_such_symbol'), null, 'unknown id is data, not a crash');
});
