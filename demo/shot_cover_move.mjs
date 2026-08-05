// Capture: a curtain on the move — the semantic transition ring around a
// NEUTRAL plate (owner 2026-08-03). The pulse is frozen at a visible frame so
// the shot is deterministic.
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 820, height: 760 }, 2);
await page.evaluate(async () => {
  const c = window.__card;
  c._serverCfg = { ...c._serverCfg, markers: [
    { id: 'm_gate', binding: 'device:d_gate', tap_action: 'cover', display: 'icon_ripple' },
    { id: 'm_mower', binding: 'device:d_mower', hidden: true },
  ] };
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'cover.gate': { entity_id: 'cover.gate', state: 'opening',
      attributes: { friendly_name: 'Curtain', device_class: 'curtain' } } } };
  c._setMode('view'); c._space = 'garden';
  c.requestUpdate();
  await c.updateComplete;
  const st = document.createElement('style');
  st.textContent = '.activity-ring.transition i:first-child{animation-delay:-1.1s!important;animation-play-state:paused!important;}';
  (c.shadowRoot || c.renderRoot).appendChild(st);
});
await page.waitForTimeout(400);
const box = await page.evaluate(() => {
  const c = window.__card;
  const r = (c.shadowRoot || c.renderRoot).querySelector('.dev.activity-transition').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const pad = 70;
await page.screenshot({ path: process.argv[2] || '/tmp/cover_move.png',
  clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2 } });
await browser.close();
console.log('shot ok');
