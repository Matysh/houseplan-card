// Capture: one curtain in the four states an owner sees — closed, open,
// opening, closing (owner's contract 2026-08-04). The plate is the plain
// neutral badge in ALL of them; open/closed is told by the icon morph alone,
// and the two travelling ones add the breathing transition ring (frozen at a
// visible frame so the shot is deterministic).
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 520 }, 2);
const STATES = ['closed', 'open', 'opening', 'closing'];
await page.evaluate(async (STATES) => {
  const c = window.__card;
  const devices = {}; const entities = {}; const states = {};
  STATES.forEach((s, i) => {
    const id = 'd_cur' + i;
    devices[id] = { id, name: 'Curtain ' + s, model: 'Roller shade driver E1',
      area_id: 'garden', identifiers: [['demo', id]], entry_type: null, via_device_id: null };
    entities['cover.cur' + i] = { entity_id: 'cover.cur' + i, device_id: id, platform: 'demo' };
    states['cover.cur' + i] = { entity_id: 'cover.cur' + i, state: s,
      attributes: { friendly_name: 'Curtain ' + s, device_class: 'curtain' } };
  });
  c.hass = { ...c.hass,
    devices: { ...c.hass.devices, ...devices },
    entities: { ...c.hass.entities, ...entities },
    states: { ...c.hass.states, ...states } };
  c._serverCfg = { ...c._serverCfg, markers: [
    ...STATES.map((s, i) => ({ id: 'm_cur' + i, binding: 'device:d_cur' + i,
      tap_action: 'cover', display: 'icon_ripple' })),
    { id: 'm_mower', binding: 'device:d_mower', hidden: true },
    { id: 'm_gate', binding: 'device:d_gate', hidden: true },
  ] };
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  const layout = { ...c._layout };
  STATES.forEach((s, i) => {
    const d = c._devices.find((x) => x.bindingRef === 'd_cur' + i);
    if (d) layout[d.id] = { s: 'garden', x: 0.18 + i * 0.215, y: 0.5 };
  });
  c._layout = layout;
  c._setMode('view'); c._space = 'garden';
  c.requestUpdate();
  await c.updateComplete;
  const st = document.createElement('style');
  st.textContent = '.activity-ring.transition i:first-child{animation-delay:-1.1s!important;animation-play-state:paused!important;}';
  (c.shadowRoot || c.renderRoot).appendChild(st);
}, STATES);
await page.waitForTimeout(500);
// captions under each badge, so the four states are readable in the file
const box = await page.evaluate((STATES) => {
  const c = window.__card;
  const els = [...(c.shadowRoot || c.renderRoot).querySelectorAll('.devlayer .dev')]
    .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  els.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cap = document.createElement('div');
    cap.textContent = STATES[i];
    cap.style.cssText = `position:fixed;left:${r.x + r.width / 2}px;top:${r.y + r.height + 10}px;`
      + 'transform:translateX(-50%);font:600 13px system-ui,sans-serif;color:#1c2530;'
      + 'letter-spacing:.02em;z-index:9999;padding:2px 7px;border-radius:6px;'
      + 'background:rgba(255,255,255,0.88);white-space:nowrap;';
    document.body.appendChild(cap);
    minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.width);
    minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.height);
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}, STATES);
const pad = 55;
await page.screenshot({ path: process.argv[2] || '/tmp/cover_states.png',
  clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
    width: box.w + pad * 2, height: box.h + pad * 2 + 22 } });
await browser.close();
console.log('shot ok');
