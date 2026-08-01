import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 820, height: 760 }, 2);
await page.evaluate(async () => {
  const c = window.__card;
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
  st.textContent = '.dev.senseflash::after{animation-delay:-0.4s;animation-play-state:paused;}';
  (c.shadowRoot || c.renderRoot).appendChild(st);
});
await page.waitForTimeout(300);
const box = await page.evaluate(() => {
  const c = window.__card;
  const el = (c.shadowRoot || c.renderRoot).querySelector('.dev.senseflash');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const pad = 70;
await page.screenshot({ path: process.argv[2] || '/tmp/motion_sense.png',
  clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2 } });
await browser.close();
console.log('shot ok');
