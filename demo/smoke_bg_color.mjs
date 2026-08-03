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
  const stageBg = async () => {
    c.requestUpdate();
    await c.updateComplete;
    return getComputedStyle(sr().querySelector('.stage')).backgroundColor;
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
  out.dialogHasBgRow = !!sr().querySelector('.dialog .colorrow input[type=color]');
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
  const editorBg = await stageBg();
  out.editorUnpainted = editorBg !== rgb('#0a2a4a');
  c._setMode('view');
  out.viewPaintedAgain = (await stageBg()) === rgb('#0a2a4a');

  // 9) kiosk instance respects the setting
  const k = document.createElement('houseplan-card');
  k.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  k.hass = c.hass;
  k.style.cssText = 'position:fixed;left:0;top:0;width:860px;height:860px;z-index:99';
  document.body.appendChild(k);
  await new Promise((r) => setTimeout(r, 300));
  // the kiosk instance re-reads the pristine demo config — inject the color
  // into ITS copy; what matters here is the kiosk rendering path
  k._serverCfg.settings = { ...(k._serverCfg.settings || {}), bg_color: '#0a2a4a' };
  k.hass = { ...c.hass };
  k.requestUpdate();
  await k.updateComplete;
  const kStage = (k.shadowRoot || k.renderRoot).querySelector('.stage');
  out.kioskApplies = !!kStage && getComputedStyle(kStage).backgroundColor === rgb('#0a2a4a');
  k.remove();

  // 10) the static space-card paints the same background
  await customElements.whenDefined('houseplan-space-card');
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.settings = { ...(cfg.settings || {}), bg_color: '#123456' };
  const hass2 = { ...c.hass, callWS: async (m) => {
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
// The scene bg_color must never bleed through the plan itself: an opaque
// rect.hp-paper sits under everything the plan draws and hugs the plan's
// extents (backdrop image rect / drawn-content bounds). The scene colour is
// visible ONLY around it. Verified computed AND by pixels against an acid
// background; the 'daynight' night dims the paper via brightness only.
const paper = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}), bg_color: '#ff00ff' };
  c._cfgRev = (c._cfgRev || 0) + 1;
  await upd();
  const m = c._spaceModel();
  const p = sr().querySelector('.stage svg rect.hp-paper');
  out.paperExists = !!p;
  if (p) {
    const a = (n) => Number(p.getAttribute(n));
    out.paperHugsImage = Math.abs(a('x') - m.bg.x) < 1e-6 && Math.abs(a('y') - m.bg.y) < 1e-6
      && Math.abs(a('width') - m.bg.w) < 1e-6 && Math.abs(a('height') - m.bg.h) < 1e-6;
    const cs = getComputedStyle(p);
    out.paperOpaque = cs.fillOpacity === '1' && cs.opacity === '1'
      && cs.fill !== 'none' && !/rgba\(.*,\s*0\)/.test(cs.fill);
  }
  // editors keep the paper too (their canvas ignores bg_color anyway)
  c._setMode('decor');
  await upd();
  out.editorKeepsPaper = !!sr().querySelector('.stage svg rect.hp-paper');
  c._setMode('view');
  await upd();
  // daynight night: the paper dims via the brightness filter ONLY, never alpha
  c._serverCfg.settings.bg_mode = 'daynight';
  c._serverCfg.settings.north_deg = 0;
  c._cfgRev++;
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'below_horizon',
    attributes: { azimuth: 180, elevation: -20 },
  } } };
  await upd();
  out.nightDimsByBrightness = (sr().querySelector('.zoomwrap').getAttribute('style') || '').includes('brightness(0.900');
  const pn = sr().querySelector('.stage svg rect.hp-paper');
  out.nightPaperStaysOpaque = !!pn && getComputedStyle(pn).fillOpacity === '1' && getComputedStyle(pn).opacity === '1';
  delete c._serverCfg.settings.bg_mode;
  delete c._serverCfg.settings.north_deg;
  c._cfgRev++;
  await upd();
  return out;
});
Object.assign(res, paper);

// ---- 12) drawn plan (no backdrop image): white paper + pixel proof ------
const drawn = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sp = c._serverCfg.spaces.find((s) => s.id === c._space);
  sp.plan_url = ''; // hand-drawn plan now
  c._cfgRev = (c._cfgRev || 0) + 1;
  c.requestUpdate();
  await c.updateComplete;
  const p = sr().querySelector('.stage.noplan svg rect.hp-paper');
  out.drawnPaperExists = !!p;
  out.drawnPaperWhite = !!p && getComputedStyle(p).fill === 'rgb(255, 255, 255)';
  if (p) {
    const pr = p.getBoundingClientRect();
    const st = sr().querySelector('.stage').getBoundingClientRect();
    out.rects = {
      paper: [pr.left, pr.top, pr.width, pr.height],
      stage: [st.left, st.top, st.width, st.height],
    };
    // the paper hugs the CONTENT — the scene colour stays visible around it
    out.bgVisibleAround = pr.left - st.left > 8 || (st.left + st.width) - (pr.left + pr.width) > 8
      || pr.top - st.top > 8 || (st.top + st.height) - (pr.top + pr.height) > 8;
  }
  return out;
});
const { rects } = drawn;
delete drawn.rects;
Object.assign(res, drawn);

// pixel proof: screenshot → canvas → not a single probe inside the paper
// carries the acid scene colour; right outside the paper it IS the acid colour
if (rects) {
  const shot = (await page.screenshot()).toString('base64');
  const px = await page.evaluate(async ({ shot, rects }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + shot;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const at = (x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const acid = ([r, g, b]) => r > 200 && b > 200 && g < 160; // #ff00ff admixture
    const [pl, pt, pw, ph] = rects.paper;
    const [sl, st, sw, sh] = rects.stage;
    const probes = [];
    for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9])
      for (const fy of [0.1, 0.3, 0.5, 0.7, 0.9]) probes.push(at(pl + pw * fx, pt + ph * fy));
    // a point in the stage but outside the paper (the widest gap side)
    const gaps = [
      [pl - sl, [(sl + pl) / 2, pt + ph / 2]],
      [sl + sw - pl - pw, [(pl + pw + sl + sw) / 2, pt + ph / 2]],
      [pt - st, [pl + pw / 2, (st + pt) / 2]],
      [st + sh - pt - ph, [pl + pw / 2, (pt + ph + st + sh) / 2]],
    ].sort((a, b) => b[0] - a[0]);
    return {
      noBleedInsidePlan: probes.every((q) => !acid(q)),
      acidAroundPlan: gaps[0][0] > 8 && acid(at(gaps[0][1][0], gaps[0][1][1])),
    };
  }, { shot, rects });
  Object.assign(res, px);
} else {
  res.noBleedInsidePlan = false;
  res.acidAroundPlan = false;
}

// ---- 13) the static space-card follows the same paper contract ----------
const stat = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  await customElements.whenDefined('houseplan-space-card');
  const mk = async (cfg) => {
    const hass2 = { ...c.hass, callWS: async (m) => {
      if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
      if (m.type === 'houseplan/layout/get') return { layout: {} };
      return c.hass.callWS(m);
    } };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const el = document.createElement('houseplan-space-card');
    el.setConfig({ type: 'custom:houseplan-space-card', space: c._space });
    el.hass = hass2;
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
  const drawnCfg = JSON.parse(JSON.stringify(base));
  drawnCfg.spaces.find((s) => s.id === c._space).plan_url = '';
  const b = await mk(drawnCfg);
  const pb = b.el.renderRoot.querySelector('.hp-static-stage svg rect.hp-paper');
  out.staticDrawnPaperExists = !!pb;
  b.host.remove();
  return out;
});
Object.assign(res, stat);
checkAll({ ...paper, ...drawn, ...stat, noBleedInsidePlan: res.noBleedInsidePlan, acidAroundPlan: res.acidAroundPlan });
await finish(browser, res);
