import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 820, height: 760 }, 2);
await page.evaluate(async () => {
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.hall_motion': { entity_id: 'binary_sensor.hall_motion', state: 'on',
      attributes: { friendly_name: 'Motion', device_class: 'motion', linkquality: 64 } } } };
  await c.updateComplete;
  // freeze the pulse at a visible frame for a deterministic capture
  const st = document.createElement('style');
  st.textContent = '.dev.sense::after{animation-delay:-0.4s;animation-play-state:paused;}';
  (c.shadowRoot || c.renderRoot).appendChild(st);
});
await page.waitForTimeout(300);
const box = await page.evaluate(() => {
  const c = window.__card;
  const el = (c.shadowRoot || c.renderRoot).querySelector('.dev.sense');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const pad = 70;
await page.screenshot({ path: process.argv[2] || '/tmp/motion_sense.png',
  clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2 } });
await browser.close();
console.log('shot ok');
