// New setting "background color around the plan": global (config.settings.bg_color,
// gear dialog) with a per-space override (space dialog, empty = inherit), applied
// to the stage in view and kiosk modes and to the static space-card. Editors keep
// their own canvas; the open dialogs preview the pending color live.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const stageBg = async () => {
    c.requestUpdate();
    await c.updateComplete;
    return getComputedStyle(sr().querySelector('.stage')).backgroundColor;
  };
  const waitStageBg = async (accept) => {
    const deadline = performance.now() + 700;
    let value = await stageBg();
    while (!accept(value) && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      value = await stageBg();
    }
    return value;
  };
  const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

  const themeBg = await stageBg(); // theme default from the stylesheet
  const sp = c._serverCfg.spaces.find((s) => s.id === c._space);

  // 1) global setting colors the stage
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}), bg_color: '#224466' };
  out.globalApplies = (await stageBg()) === rgb('#224466');

  // 2) per-space override wins
  sp.settings = { ...(sp.settings || {}), bg_color: '#663311' };
  out.spaceOverrides = (await stageBg()) === rgb('#663311');

  // 3) clearing the space setting inherits the global again
  delete sp.settings.bg_color;
  out.clearInheritsGlobal = (await stageBg()) === rgb('#224466');

  // 4) clearing the global returns the theme default
  delete c._serverCfg.settings.bg_color;
  out.clearRestoresTheme = (await stageBg()) === themeBg;

  // 5) invalid stored value is ignored (renderer never trusts garbage)
  c._serverCfg.settings.bg_color = 'url(javascript:alert(1))';
  out.garbageIgnored = (await stageBg()) === themeBg;
  delete c._serverCfg.settings.bg_color;

  // 6) the settings dialog previews its pending color live + saves it
  let saved = null;
  const origWS = c.hass.callWS;
  c.hass.callWS = async (m) => {
    if (m.type === 'houseplan/config/set') { saved = m.config; return { rev: (c._cfgRev || 0) + 1 }; }
    return origWS.call(c.hass, m);
  };
  c._openSettingsDialog();
  await c.updateComplete;
  const settingsDialog = sr().querySelector('hp-dialog');
  const bgPicker = [...settingsDialog.querySelectorAll('hp-color-opacity')]
    .find((picker) => picker.label === c._t('gs.bg_color'));
  out.dialogHasBgRow = !!bgPicker && bgPicker.showOpacity === false
    && !settingsDialog.querySelector('input[type=color]');
  c._settingsDialog = { ...c._settingsDialog, bgColor: '#0a2a4a' };
  out.dialogPreviews = (await stageBg()) === rgb('#0a2a4a');
  await c._saveSettingsDialog();
  out.dialogSaves = saved?.settings?.bg_color === '#0a2a4a';
  out.savedApplies = (await stageBg()) === rgb('#0a2a4a');

  // 7) the space dialog previews and saves the override
  c._openSpaceDialog('edit', c._space);
  await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, bgColor: '#4a0a2a' };
  out.spaceDialogPreviews = (await stageBg()) === rgb('#4a0a2a');
  saved = null;
  await c._saveSpaceDialog();
  const savedSp = saved?.spaces?.find((s) => s.id === c._space);
  out.spaceDialogSaves = savedSp?.settings?.bg_color === '#4a0a2a';
  out.spaceSavedApplies = (await stageBg()) === rgb('#4a0a2a');

  // ...and clearing it in the dialog inherits the global again
  c._openSpaceDialog('edit', c._space);
  await c.updateComplete;
  out.spaceDialogPrefilled = c._spaceDialog.bgColor === '#4a0a2a';
  c._spaceDialog = { ...c._spaceDialog, bgColor: null };
  await c._saveSpaceDialog();
  // over the wire `undefined` keys vanish — check the JSON form, like the backend sees it
  const wire = JSON.parse(JSON.stringify(saved));
  const savedSp2 = wire?.spaces?.find((s) => s.id === c._space);
  out.spaceDialogClears = !('bg_color' in (savedSp2?.settings || {}));
  out.backToGlobal = (await stageBg()) === rgb('#0a2a4a');
  c.hass.callWS = origWS;

  // 8) editors keep their own canvas (inline bg only in view/kiosk)
  c._setMode('decor');
  await settleMode();
  const editorBg = await waitStageBg((value) => value !== rgb('#0a2a4a'));
  out.editorUnpainted = editorBg !== rgb('#0a2a4a');
  c._setMode('view');
  await settleMode();
  out.viewPaintedAgain = (await waitStageBg((value) => value === rgb('#0a2a4a'))) === rgb('#0a2a4a');

  // The environment, plan and zoom badge own explicit stacking levels. DOM
  // order alone let an opaque cross-fade layer cover the plan, while raising
  // only the plan hid the later percentage badge behind it.
  const previousBgMode = c._serverCfg.settings.bg_mode;
  c._serverCfg.settings.bg_mode = 'daynight';
  c._zoom = 2.5;
  c.requestUpdate(); await c.updateComplete;
  const zoomWrap = sr().querySelector('.zoomwrap');
  const zoomBadge = sr().querySelector('.zoombadge');
  const environment = sr().querySelector('.hp-day-cycle-env');
  out.dayCycleStaysBehindPlan = getComputedStyle(environment).zIndex === '0'
    && getComputedStyle(zoomWrap).zIndex === '1';
  out.zoomBadgeStaysAbovePlan = !!zoomBadge
    && getComputedStyle(zoomBadge).zIndex === '12';
  if (previousBgMode === undefined) delete c._serverCfg.settings.bg_mode;
  else c._serverCfg.settings.bg_mode = previousBgMode;
  c._zoom = 1;
  c.requestUpdate(); await c.updateComplete;

  // 9) kiosk instance respects the setting
  const k = document.createElement('houseplan-card');
  k.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  k.hass = c.hass;
  k.style.cssText = 'position:fixed;left:0;top:0;width:860px;height:860px;z-index:99';
  document.body.appendChild(k);
  await new Promise((r) => setTimeout(r, 300));
  // the kiosk instance re-reads the pristine demo config — inject the color
  // into ITS copy; what matters here is the kiosk rendering path
  k._serverCfg.settings = { ...(k._serverCfg.settings || {}), bg_color: '#0a2a4a', bg_mode: 'daynight' };
  k.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'above_horizon',
    attributes: { azimuth: 180, elevation: 42, rising: false },
  } } };
  k.requestUpdate();
  await k.updateComplete;
  const kStage = (k.shadowRoot || k.renderRoot).querySelector('.stage');
  out.kioskApplies = !!kStage && getComputedStyle(kStage).backgroundColor === rgb('#0a2a4a');
  out.kioskSharesDay = kStage?.classList.contains('phase-day')
    && kStage.querySelector('.hp-day-cycle-bg.active')?.dataset.dayCycleLayer === 'day';
  k.remove();

  // 10) the static space-card paints the same background
  await customElements.whenDefined('houseplan-space-card');
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.settings = { ...(cfg.settings || {}), bg_color: '#123456', bg_mode: 'daynight' };
  const hass2 = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'below_horizon',
    attributes: { azimuth: 95, elevation: -2, rising: true },
  } }, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {} };
    return origWS.call(c.hass, m);
  } };
  const scHost = document.createElement('div');
  document.body.appendChild(scHost);
  const sc = document.createElement('houseplan-space-card');
  sc.setConfig({ type: 'custom:houseplan-space-card', space: c._space });
  sc.hass = hass2;
  scHost.appendChild(sc);
  const t0 = Date.now();
  while (!sc.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 80));
  await sc.updateComplete;
  const st = sc.renderRoot.querySelector('.hp-static-stage');
  out.staticCardApplies = !!st && getComputedStyle(st).backgroundColor === rgb('#123456');
  out.staticCardSharesDawn = st?.classList.contains('phase-dawn')
    && st.querySelector('.hp-day-cycle-env')?.dataset.dayCycleSource === 'sun'
    && st.querySelector('.hp-day-cycle-bg.active')?.dataset.dayCycleLayer === 'dawn';
  out.staticCardLayersStayOrdered = getComputedStyle(st.querySelector('svg')).zIndex === '1'
    && getComputedStyle(st.querySelector('.devlayer')).zIndex === '2';
  // ...and the space override beats the global there too
  cfg.spaces.find((s) => s.id === c._space).settings = { bg_color: '#654321' };
  sc.hass = { ...hass2 };
  sc._cfg = null; // force a config re-read
  await new Promise((r) => setTimeout(r, 200));
  sc.requestUpdate(); await sc.updateComplete;
  const st2 = sc.renderRoot.querySelector('.hp-static-stage');
  out.staticCardSpaceWins = !!st2 && getComputedStyle(st2).backgroundColor === rgb('#654321');
  scHost.remove();

  // tidy: drop the color so later smokes on this page see the theme default
  delete c._serverCfg.settings.bg_color;
  const spx = c._serverCfg.spaces.find((s) => s.id === c._space);
  if (spx?.settings) delete spx.settings.bg_color;
  await stageBg();
  return out;
});
checkAll(res);

// ---- 11) opaque plan paper (owner 2026-08-03) --------------------------
// The scene bg_color must never bleed through the plan itself: opaque
// .hp-paper shapes sit under everything the plan draws. Since v1.58.0 the
// paper is the ROOM CONTOURS and ONLY them — one shape per room, never their
// bounding box (section 12), and never the backdrop image rect either
// (docs/BACKDROP.md §3). The demo's f1 IS an image plan, so this section now
// asserts the new rule on exactly the case that used to be the exception.
// The scene colour is visible ONLY around the paper. The four-phase
// environment changes only outside it and adds an alpha-aware outer outline.
const paper = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}), bg_color: '#ff00ff' };
  c._cfgRev = (c._cfgRev || 0) + 1;
  await upd();
  const m = c._spaceModel();
  const shapes = () => [...sr().querySelectorAll('.stage svg .hp-paper')];
  const p = shapes()[0];
  out.paperExists = !!p;
  out.imagePlanPapersTheRooms = shapes().length === m.rooms.length;
  // …and NOT the image: no paper rect the size of the backdrop any more
  out.noImageSizedPaper = ![...sr().querySelectorAll('.stage svg rect.hp-paper')].some((r) =>
    Math.abs(Number(r.getAttribute('width')) - m.bg.w) < 1e-6
    && Math.abs(Number(r.getAttribute('height')) - m.bg.h) < 1e-6);
  if (p) {
    const cs = getComputedStyle(p);
    out.paperOpaque = cs.fillOpacity === '1' && cs.opacity === '1'
      && cs.fill !== 'none' && !/rgba\(.*,\s*0\)/.test(cs.fill);
  }
  // …and the picture is drawn ON that paper: image after paper, before walls
  const svgEl = sr().querySelector('.stage svg');
  const layerRoot = [...svgEl.children].find((node) =>
    node.querySelector?.('.hp-paperg') && node.querySelector?.('.room')) || svgEl;
  const kids = [...layerRoot.children];
  const idxOf = (sel) => kids.findIndex((n) => n.matches(sel) || n.querySelector?.(sel));
  out.imageAbovePaper = idxOf('image') > idxOf('.hp-paper') && idxOf('image') >= 0;
  out.imageBelowRooms = idxOf('image') < idxOf('.room, .room-outline');
  // editors keep the paper too (their canvas ignores bg_color anyway)
  c._setMode('decor');
  await upd(); await settleMode();
  out.editorKeepsPaper = !!sr().querySelector('.stage svg .hp-paper');
  c._setMode('view');
  await upd(); await settleMode();
  // daynight night: the paper stays pixel-identical and opaque; only its
  // grouped outer outline and the environment may change.
  c._serverCfg.settings.bg_mode = 'daynight';
  c._serverCfg.settings.north_deg = 0;
  c._cfgRev++;
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'below_horizon',
    attributes: { azimuth: 180, elevation: -20, rising: false },
  } } };
  await upd();
  out.nightDoesNotDimPlan = !(sr().querySelector('.zoomwrap').getAttribute('style') || '').includes('brightness(0.');
  out.nightEnvironment = sr().querySelector('.hp-day-cycle-bg.active')?.dataset.dayCycleLayer === 'night';
  const pn = sr().querySelector('.stage svg .hp-paper');
  out.nightPaperStaysOpaque = !!pn && getComputedStyle(pn).fillOpacity === '1' && getComputedStyle(pn).opacity === '1';
  delete c._serverCfg.settings.bg_mode;
  delete c._serverCfg.settings.north_deg;
  c._cfgRev++;
  await upd();
  return out;
});
Object.assign(res, paper);

// ---- 12) drawn plan: the paper follows the ROOM CONTOURS ---------------
// Owner: «белая подложка должна быть по границам комнат» — an L-shaped house
// plus a detached building must NOT grow a white bounding rectangle. One
// paper shape per room, in exactly the room's own geometry; the acid scene
// colour shows in the L's pocket and between the buildings, right up to the
// exterior walls; inside the rooms it never shows. A live controller preview
// moves the paper together with the dragged wall.
const drawn = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  const sp = c._serverCfg.spaces.find((s) => s.id === c._space);
  sp.plan_url = ''; // hand-drawn plan now
  // binary-exact fractions -> exact render coords (0.125*1000 = 125 etc.)
  sp.rooms = [
    { id: 'rL', name: 'L', poly: [[0.125, 0.125], [0.625, 0.125], [0.625, 0.375], [0.375, 0.375], [0.375, 0.625], [0.125, 0.625]] },
    { id: 'rQ', name: 'Q', x: 0.75, y: 0.75, w: 0.1875, h: 0.1875 },
  ];
  sp.openings = [];
  sp.decor = [];
  c._devices = []; // no icons over the pixel probes below
  c._cfgRev = (c._cfgRev || 0) + 1;
  c._cfgEpoch++;
  await upd();
  const papers = () => [...sr().querySelectorAll('.stage.noplan svg .hp-paper')];
  let ps = papers();
  out.paperPerRoom = ps.length === sp.rooms.length;
  out.paperShapesMatchRooms = ps.length === 2
    && ps[0].tagName.toLowerCase() === 'polygon'
    && ps[0].getAttribute('points') === sp.rooms[0].poly.map((p) => (p[0] * 1000) + ',' + (p[1] * 1000)).join(' ')
    && ps[1].tagName.toLowerCase() === 'rect';
  out.drawnPaperWhite = ps.length > 0 && ps.every((p) => getComputedStyle(p).fill === 'rgb(255, 255, 255)');
  out.paperNoStroke = ps.length > 0 && ps.every((p) => {
    const cs = getComputedStyle(p);
    return cs.stroke === 'none' || cs.strokeOpacity === '0' || cs.strokeWidth === '0px';
  });
  // paper first, everything else on top of it (one .hp-paperg group wraps
  // all paper shapes so the day-cycle outline composites without seams)
  const noplanSvg = sr().querySelector('.stage.noplan svg');
  const noplanLayers = [...noplanSvg.children].find((node) => node.querySelector?.('.hp-paperg')) || noplanSvg;
  const first = [...noplanLayers.children].find((node) => node.tagName.toLowerCase() !== 'defs');
  out.paperUnderneath = !!first && first.classList.contains('hp-paperg')
    && !!first.firstElementChild && first.firstElementChild.classList.contains('hp-paper');
  // live resize preview: drag the L's right wall 0.625 -> 0.6875 — the paper
  // must move WITH the room, not lag behind until the drop
  const resizeRooms = c._rszRooms();
  const snapshot = c._rszSnapshot();
  c._resize.begin({
    pointerId: 912, start: [625, 250], roomId: 'rL',
    plan: {
      roomId: 'rL', edge: 1, a: [625, 125], b: [625, 375], n: [1, 0],
      roomIds: ['rL'], edgeByRoom: { rL: 1 }, topology: { rL: 6 },
      movingOpeningIds: [], sideOwnership: [],
    },
    options: { minDim: 1, eps: 0.01 }, rooms: resizeRooms, openings: [],
    snapshotIdentity: snapshot, before: JSON.parse(snapshot), wallUnionBefore: null,
  });
  c._resize.move({
    pointerId: 912, point: [687.5, 250], step: 0.5, snap: (point) => point,
    project: (_snapshot, polys) => {
      const pv = JSON.parse(JSON.stringify(sp));
      pv.rooms[0].poly = polys.rL.map(([x, y]) => [x / 1000, y / 1000]);
      return { ok: true, value: {
        preview: { space: c._space, sp: pv }, beforeWalls: [], afterWalls: [], artifact: null,
      } };
    },
    publish: (preview, artifact) => c._rszAcceptPreview(preview, artifact),
    measure: () => [],
  });
  await upd();
  out.previewMovesPaper = (papers()[0]?.getAttribute('points') || '').includes('687.5,125');
  c._rszCancelDrag();
  await upd();
  out.previewRestores = (papers()[0]?.getAttribute('points') || '').includes('625,125');
  // screen coords for the pixel probes (svg user units -> viewport px)
  const svgEl = sr().querySelector('.stage svg');
  const ctm = svgEl.getScreenCTM();
  const toScr = (x, y) => { const q = svgEl.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(ctm); return [r.x, r.y]; };
  out.probes = {
    pocket: toScr(500, 500),           // the L's notch — bg must show here
    gap: toScr(687, 300),              // between the two buildings
    inside: [toScr(250, 250), toScr(500, 250), toScr(250, 500), toScr(843.75, 843.75)],
  };
  return out;
});
const { probes } = drawn;
delete drawn.probes;
Object.assign(res, drawn);

// pixel proof: the acid scene colour IS in the L's pocket and between the
// buildings (where the old bounding-box paper drew a white square), and is
// NOT inside any room
if (probes) {
  const shot = (await page.screenshot()).toString('base64');
  const px = await page.evaluate(async ({ shot, probes }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + shot;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const at = ([x, y]) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const acid = ([r, g, b]) => r > 200 && b > 200 && g < 160; // #ff00ff admixture
    return {
      acidInPocket: acid(at(probes.pocket)),
      acidBetweenBuildings: acid(at(probes.gap)),
      noAcidInsideRooms: probes.inside.every((q) => !acid(at(q))),
    };
  }, { shot, probes });
  Object.assign(res, px);
} else {
  res.acidInPocket = false;
  res.acidBetweenBuildings = false;
  res.noAcidInsideRooms = false;
}

// ---- 13) the static space-card follows the same paper contract ----------
const stat = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  await customElements.whenDefined('houseplan-space-card');
  // NOTE: the config-store cache is module-level and already primed by the
  // earlier static-card sections (with the PRE-§12 rooms), so a mocked
  // callWS would never reach the card — inject the snapshot directly.
  const mk = async (cfg) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const el = document.createElement('houseplan-space-card');
    el.setConfig({ type: 'custom:houseplan-space-card', space: c._space });
    el._snap = { config: cfg, rev: 1, layout: {} };
    el._loadedOnce = true;
    el.hass = c.hass;
    host.appendChild(el);
    const t0 = Date.now();
    while (!el.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000)
      await new Promise((r) => setTimeout(r, 80));
    await el.updateComplete;
    return { el, host };
  };
  const base = JSON.parse(JSON.stringify(c._serverCfg));
  base.spaces.find((s) => s.id === c._space).plan_url = '/assets/f1.svg';
  base.settings = { ...(base.settings || {}), bg_color: '#ff00ff' };
  const a = await mk(base);
  const pa = a.el.renderRoot.querySelector('.hp-static-stage svg rect.hp-paper');
  out.staticPaperExists = !!pa;
  out.staticPaperOpaque = !!pa && getComputedStyle(pa).fillOpacity === '1'
    && getComputedStyle(pa).fill !== 'none';
  a.host.remove();
  // drawn plan: per-room paper shapes (the L + the detached rect from §12)
  const drawnCfg = JSON.parse(JSON.stringify(base));
  const dsp = drawnCfg.spaces.find((s) => s.id === c._space);
  dsp.plan_url = '';
  const b = await mk(drawnCfg);
  const pbs = [...b.el.renderRoot.querySelectorAll('.hp-static-stage svg .hp-paper')];
  out.staticDrawnPaperPerRoom = pbs.length === dsp.rooms.length;
  out.staticDrawnPaperShapes = pbs.length === 2
    && pbs[0].tagName.toLowerCase() === 'polygon'
    && pbs[1].tagName.toLowerCase() === 'rect';
  b.host.remove();
  return out;
});
Object.assign(res, stat);
checkAll({ ...paper, ...drawn, ...stat,
  acidInPocket: res.acidInPocket,
  acidBetweenBuildings: res.acidBetweenBuildings,
  noAcidInsideRooms: res.noAcidInsideRooms });
await finish(browser, res);
