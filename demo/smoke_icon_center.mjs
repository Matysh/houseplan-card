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
    const offX = r.left + r.width / 2 - ax, offY = r.top + r.height / 2 - ay;
    if (Math.abs(offX) > 0.6 || Math.abs(offY) > 0.6)
      bad.push({ icon: d.querySelector('ha-icon')?.getAttribute('icon'), offX: +offX.toFixed(2), offY: +offY.toFixed(2) });
  }
  return bad;
});
await browser.close();
if (bad.length) { console.error('FAIL icon-center: badges off anchor', JSON.stringify(bad.slice(0, 5))); process.exit(1); }
console.log('OK icon-center: all device badges centred on their anchor');
