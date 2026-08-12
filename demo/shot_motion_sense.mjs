import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 820, height: 760 }, 2);
await page.evaluate(async () => {
  const c = window.__card;
  c._serverCfg.markers = (c._serverCfg.markers || []).filter((m) => m.binding !== 'device:d_motion');
  c._serverCfg.markers.push({ id: 'd_motion', binding: 'device:d_motion', display: 'icon_ripple' });
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  // the flash is keyed to a WITNESSED off→on transition (owner's rule
  // 2026-08-01: разовая вспышка в момент обнаружения) — cycle through off
  const set = async (state) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'binary_sensor.hall_motion': { entity_id: 'binary_sensor.hall_motion', state,
        attributes: { friendly_name: 'Motion', device_class: 'motion', linkquality: 64 } } } };
    await c.updateComplete;
  };
  await set('off');
  await set('on');
  // freeze the pulse at a visible frame for a deterministic capture
  const st = document.createElement('style');
  st.textContent = '.device-pulse.short.event i{animation-delay:-0.4s!important;animation-play-state:paused!important;}';
  (c.shadowRoot || c.renderRoot).appendChild(st);
});
await page.waitForTimeout(300);
const box = await page.evaluate(() => {
  const c = window.__card;
  const el = (c.shadowRoot || c.renderRoot).querySelector('.dev.activity-event');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const pad = 70;
await page.screenshot({ path: process.argv[2] || '/tmp/motion_sense.png',
  clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2 } });
await browser.close();
console.log('shot ok');
