// The content frame is PRESENTATION (docs/CANVAS.md §4) — audit dev@2c947f4.
//
// DEV-2C947-01: a hidden device is not drawn, but it still stretched the
// frame — hiding a marker that had wandered into the yard left the visible
// house a dot in the corner (the full card AND the static
// houseplan-space-card, which drew `devs` but framed `spaceDevs`).
//
// DEV-2C947-02: inside an editor the frame only grows (a frame that shrank
// mid-drag would move the ground under the pointer); that union was memoised
// without the mode, so it survived the way back into View.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);
const out = {};
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Load a config/layout into the card AND into the demo's WS stub, so the
// static card (which fetches its own copy) sees exactly the same house.
const load = (cfg, layout, space) => page.evaluate(async ([c2, l2, sp]) => {
  const c = window.__card;
  const srvCfg = (await c.hass.callWS({ type: 'houseplan/config/get' })).config;
  const srvLay = (await c.hass.callWS({ type: 'houseplan/layout/get' })).layout;
  for (const k of Object.keys(srvCfg)) delete srvCfg[k];
  Object.assign(srvCfg, JSON.parse(JSON.stringify(c2)));
  for (const k of Object.keys(srvLay)) delete srvLay[k];
  Object.assign(srvLay, JSON.parse(JSON.stringify(l2)));
  c._serverCfg = srvCfg;
  c._layout = JSON.parse(JSON.stringify(l2));
  c._modelCache = null;
  c._frame = null;
  c._showFar = false;
  c._space = sp;
  c._cfgEpoch++;
  c._regSignature = '';
  c._maybeRebuildDevices?.();
  c._defPos = c._defaultPositions();
  c._view = null;
  c._zoom = 1;
  c.requestUpdate();
  await c.updateComplete;
  c._resetZoom();
  await c.updateComplete;
}, [cfg, layout, space]);

// ---------------------------------------------------------------- 01: hidden
// The auditor's probe, verbatim: ONE visible room and ONE marker parked 90
// canvases away. Two content items is below MIN_VOTERS, so the outlier vote
// never runs and the far position is guaranteed to stay in the core — the
// frame either sees the marker or it does not.
const oneRoom = (hidden) => ({
  spaces: [{
    id: 'h1', title: 'Hidden', view_box: [0, 0, 1, 1], plan_url: null, plan_aspect: null,
    rooms: [{ id: 'r1', name: 'Room', area: 'zx_room',
      poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
  }],
  // a made-up area: no auto device of the demo house lands in this space, so
  // the only content is the room and the one marker below
  markers: [{ id: 'm_far', binding: 'device:d_motion', area: 'zx_room', hidden }],
  settings: { filter_seeded: true },
});
const FAR_POS = { m_far: { s: 'h1', x: 90, y: 0.5 } };

await load(oneRoom(false), FAR_POS, 'h1');
await raf();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const b = c._baseVb();
  return {
    // premise: while it IS drawn, the marker is content and the frame holds it
    visibleMarkerIsDrawn: sr.querySelectorAll('.devlayer .dev').length === 1,
    visibleMarkerWidensTheFrame: b[2] > 50000,
  };
}));

await load(oneRoom(true), FAR_POS, 'h1');
await raf();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const o = {};
  const b = c._baseVb();
  o.hiddenMarkerNotDrawn = sr.querySelectorAll('.devlayer .dev').length === 0;
  o.hiddenMarkerStillBuilt = !!c._devices.find((d) => d.id === 'm_far' && d.hidden === true);
  // the room is 100..900 render units, padded by 5 % of the longer side
  o.frameIsTheVisibleRoom = Math.round(b[0]) === 60 && Math.round(b[2]) === 880
    && Math.round(b[1]) === 60 && Math.round(b[3]) === 880;
  // and the room fills the screen instead of being a dot 112x too small
  const st = sr.querySelector('.stage').getBoundingClientRect();
  const poly = sr.querySelector('polygon.room').getBoundingClientRect();
  o.roomFillsTheStage = poly.width > st.width * 0.7;
  return o;
}));

// the same house on the STATIC card (space-render.ts drew `devs` but framed
// `spaceDevs` — the identical split)
Object.assign(out, await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const o = {};
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:400px';
  document.body.appendChild(host);
  const el = document.createElement('houseplan-space-card');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'h1' });
  el.hass = window.__card.hass;
  host.appendChild(el);
  const t0 = Date.now();
  while (!el.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 80));
  }
  await el.updateComplete;
  const svg = el.renderRoot.querySelector('.hp-static-stage svg');
  const vb = (svg?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  o.staticCardHidesTheMarker = el.renderRoot.querySelectorAll('.devlayer .dev').length === 0;
  o.staticFrameIsTheVisibleRoom = vb.length === 4
    && Math.round(vb[0]) === 60 && Math.round(vb[2]) === 880;
  host.remove();
  return o;
}));

// ------------------------------------------------------- 02: editor -> view
const oneRoomAt = (x0) => ({
  spaces: [{
    id: 'e1', title: 'Editor', view_box: [0, 0, 1, 1], plan_url: null, plan_aspect: null,
    rooms: [{ id: 'r1', name: 'Room', area: 'zx_room',
      poly: [[x0, 0.1], [x0 + 0.8, 0.1], [x0 + 0.8, 0.9], [x0, 0.9]] }],
  }],
  markers: [], settings: { filter_seeded: true },
});

await load(oneRoomAt(0.1), {}, 'e1');
await raf();
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const round = () => c._baseVb().map((n) => Math.round(n));
  o.viewFrameBefore = JSON.stringify(round()) === JSON.stringify([60, 60, 880, 880]);
  // move the only room 5 canvases to the right, inside the Plan editor
  c._setMode('plan');
  await c.updateComplete;
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].rooms[0].poly = [[5.1, 0.1], [5.9, 0.1], [5.9, 0.9], [5.1, 0.9]];
  c._serverCfg = cfg;
  c._modelCache = null;
  c._cfgEpoch++;
  c.requestUpdate();
  await c.updateComplete;
  const inEditor = round();
  // inside the editor the frame is the UNION — that is deliberate: it bounds
  // pan and defines zoom 1, and it must not shrink under a live gesture
  o.editorFrameOnlyGrows = inEditor[2] > 5000;
  c._setMode('view');
  await c.updateComplete;
  const back = round();
  o.viewFrameFollowsTheRoomAgain = JSON.stringify(back) === JSON.stringify([5060, 60, 880, 880]);
  if (!o.viewFrameFollowsTheRoomAgain) console.log('frame after exit', back, 'editor', inEditor);
  // and back into an editor it starts from the CURRENT geometry, not the old union
  c._setMode('plan');
  await c.updateComplete;
  o.reenteringTheEditorDoesNotResurrectTheUnion =
    JSON.stringify(round()) === JSON.stringify([5060, 60, 880, 880]);
  c._setMode('view');
  await c.updateComplete;
  return o;
}));

checkAll(out);
await finish(browser, out);
