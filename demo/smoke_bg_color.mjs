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
await finish(browser, res);
