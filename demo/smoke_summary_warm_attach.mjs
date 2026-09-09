// #506: a card instance created on a page whose summary chunk is already
// loaded must own its summary runtime BEFORE the first render. Otherwise the
// first header measurement sees no summary controls, the controls arrive a
// beat later, the stage shrinks and the deferred refit opens a `stage-resize`
// continuity candidate with three render passes on top of the first HA tick
// (Full Performance: blend stateUpdate1 50 → 130 ms, overlay 217 → 809 ms).
//
// Three instances on one 780×669 page with a long title (the soft-layout
// fixture of test/boot-soft-layout.test.mjs):
//   c1 — cold page (launchPanelCold): the chunk is imported once, lazily;
//   c2 — warm replacement of c1 (same config key, warm memo): AC4;
//   c3 — a cold-key instance (new title) on the warm page: AC4 second half;
// then AC5: one geometry-neutral HA tick on c3 costs one performUpdate and no
// stage-resize; then AC6: a real container resize DOES open stage-resize.
// FAILS on the build before #506 (runtime attached via import().then()).
import { launchPanelCold, check, finish } from './serve.mjs';

const LONG_TITLE = 'A deliberately long House Plan title that wraps the header onto a second line at 780 px';

// A page without any card yet: the summary chunk is provably cold for c1.
const { page, browser } = await launchPanelCold({ width: 780, height: 669 });
await page.evaluate(() => import('/assets/houseplan-card.js'));
await page.waitForFunction(() => !!customElements.get('houseplan-card'));

const res = await page.evaluate(async ({ longTitle }) => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const Card = customElements.get('houseplan-card');
  Card._warmBootReset?.();
  localStorage.removeItem('houseplan_card_nav_v1');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:780px;height:669px;z-index:99;background:#000';
  document.body.appendChild(wrap);
  const sr = (c) => c.shadowRoot || c.renderRoot;
  const candidates = (c) => {
    const seen = [];
    const original = c._continuity.beginCandidate.bind(c._continuity);
    c._continuity.beginCandidate = (reason, recovery) => { seen.push(reason); return original(reason, recovery); };
    return seen;
  };
  const mk = (title) => {
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card', title });
    c.hass = window.__mkHass();
    wrap.appendChild(c);
    return c;
  };
  const settle = async (c) => {
    const t0 = performance.now();
    while ((c._booting || !c._loadOk || !(c._devices?.length > 0)) && performance.now() - t0 < 4000) await sleep(30);
    await c.updateComplete;
    await sleep(350);
  };
  const controls = (c) => sr(c).querySelectorAll('.summary-control').length;
  /** Per-frame header/stage sizes for ~600 ms after mount. */
  const sample = async (c) => {
    const frames = [];
    const t1 = performance.now();
    await new Promise((done) => {
      const step = () => {
        const stage = sr(c).querySelector('.stage');
        if (stage) frames.push({ t: Math.round(performance.now() - t1), hdrH: c._hdrH, stageH: stage.clientHeight, summary: !!c._summary });
        if (performance.now() - t1 < 600) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    return frames;
  };

  // ---- c1: the cold page pays the import once ----
  const c1 = mk(longTitle);
  out.coldHasNoRuntimeSynchronously = !c1._summary; // the lazy boundary is intact
  await settle(c1);
  out.coldRuntimeArrived = !!c1._summary;
  const finalHdr = c1._hdrH;
  const finalStage = sr(c1).querySelector('.stage').clientHeight;
  out.coldHeaderWraps = finalHdr > 60 ? true : `hdrH=${finalHdr}`;
  c1.remove();
  await sleep(30);

  // ---- c2: warm replacement (same key) — AC4 ----
  const c2 = mk(longTitle);
  out.warmReplacementRuntimeBeforeFirstRender = !!c2._summary && !c2.hasUpdated;
  const seen2 = candidates(c2);
  const frames2 = await sample(c2);
  await settle(c2);
  out.warmReplacementFramesSampled = frames2.length > 10;
  const bad2 = frames2.filter((f) => Math.abs(f.hdrH - finalHdr) > 1 || Math.abs(f.stageH - finalStage) > 2);
  out.warmReplacementHeaderStableFromFirstFrame = bad2.length === 0
    ? true : `final=${finalHdr}/${finalStage}; frame=${JSON.stringify(bad2[0])}`;
  out.warmReplacementNoStageResize = !seen2.includes('stage-resize') ? true : JSON.stringify(seen2);
  out.warmReplacementDistinctRuntime = c2._summary !== c1._summary;
  c2.remove();
  await sleep(30);

  // ---- c3: cold key on a warm page (the benchmark's per-sample card) — AC4 ----
  const c3 = mk(`${longTitle} #${Date.now()}`);
  out.coldKeyRuntimeBeforeFirstRender = !!c3._summary && !c3.hasUpdated;
  const seen3 = candidates(c3);
  const frames3 = await sample(c3);
  await settle(c3);
  out.coldKeyFramesSampled = frames3.length > 10;
  const hdr3 = c3._hdrH;
  const stage3 = sr(c3).querySelector('.stage').clientHeight;
  // The first frame that has a stage already has the final header and stage.
  const settled3 = frames3.filter((f) => f.stageH > 0);
  const bad3 = settled3.filter((f) => Math.abs(f.hdrH - hdr3) > 1 || Math.abs(f.stageH - stage3) > 2);
  out.coldKeyHeaderStableFromFirstFrame = bad3.length === 0
    ? true : `final=${hdr3}/${stage3}; frame=${JSON.stringify(bad3[0])} of ${settled3.length}`;
  out.coldKeyNoStageResize = !seen3.includes('stage-resize') ? true : JSON.stringify(seen3);
  out.coldKeyControlsRendered = controls(c3) > 0 ? true : 'no summary controls in the header';

  // ---- AC5: a geometry-neutral HA tick after startup costs one render ----
  seen3.length = 0;
  let renders = 0;
  const originalUpdate = c3.performUpdate.bind(c3);
  c3.performUpdate = () => { renders++; return originalUpdate(); };
  const hass = window.__mkHass();
  const ceiling = hass.states['light.ceiling'];
  c3.hass = { ...hass, states: { ...hass.states, 'light.ceiling': {
    ...ceiling, attributes: { ...ceiling.attributes, brightness: 200 },
  } } };
  await c3.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await sleep(120);
  out.firstTickSingleRender = renders === 1 ? true : `performUpdate ×${renders}`;
  out.firstTickNoStageResize = !seen3.includes('stage-resize') ? true : JSON.stringify(seen3);

  window.__c3 = c3;
  window.__seen3 = seen3;
  return out;
}, { longTitle: LONG_TITLE });
for (const [k, v] of Object.entries(res)) check(k, v);

// ---- AC6: a real viewport resize still owns the stage (positive witness) ----
await page.setViewportSize({ width: 780, height: 600 });
const rez = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c3 = window.__c3;
  const seen3 = window.__seen3;
  seen3.length = 0;
  await sleep(400);
  out.realResizeOpensStageResize = seen3.includes('stage-resize') ? true : JSON.stringify(seen3);
  const stage = (c3.shadowRoot || c3.renderRoot).querySelector('.stage').clientHeight;
  out.realResizeStageFollows = Math.abs(stage - (600 - c3._hdrH)) < 4 ? true : `stage=${stage} hdr=${c3._hdrH}`;
  c3.remove();
  document.querySelectorAll('div[style*="z-index:99"]').forEach((el) => el.remove());
  return out;
});
for (const [k, v] of Object.entries(rez)) check(k, v);
await finish(browser, { ...res, ...rez });
