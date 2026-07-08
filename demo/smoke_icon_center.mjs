// Asserts device icon badges sit exactly on their anchor point (no content-box/border drift).
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 1000 }, 2);
const bad = await page.evaluate(() => {
  const c = window.__card;
  c._space = 'f1'; c._resetZoom(); c.requestUpdate();
  const layer = c.renderRoot.querySelector('.devlayer');
  const lr = layer.getBoundingClientRect();
  const bad = [];
  for (const d of layer.querySelectorAll('.dev')) {
    const ax = lr.left + (parseFloat(d.style.left) / 100) * lr.width;
    const ay = lr.top + (parseFloat(d.style.top) / 100) * lr.height;
    const r = d.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const offX = cx - ax, offY = cy - ay;
    // glyph centred within the badge
    const icon = d.querySelector('ha-icon');
    const svg = icon?.shadowRoot?.querySelector('svg') || icon?.shadowRoot?.querySelector('ha-svg-icon')?.shadowRoot?.querySelector('svg');
    let gX = 0, gY = 0;
    if (svg) { const sr = svg.getBoundingClientRect(); gX = sr.left + sr.width / 2 - cx; gY = sr.top + sr.height / 2 - cy; }
    if (Math.abs(offX) > 0.6 || Math.abs(offY) > 0.6 || Math.abs(gX) > 0.6 || Math.abs(gY) > 0.6)
      bad.push({ icon: icon?.getAttribute('icon'), offX: +offX.toFixed(2), offY: +offY.toFixed(2), glyphX: +gX.toFixed(2), glyphY: +gY.toFixed(2) });
  }
  return bad;
});
await browser.close();
if (bad.length) { console.error('FAIL icon-center: badges off anchor', JSON.stringify(bad.slice(0, 5))); process.exit(1); }
console.log('OK icon-center: all device badges centred on their anchor');
