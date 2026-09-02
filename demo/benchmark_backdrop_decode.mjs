// #39: decode/downscale calibration matrix behind the backdrop guard
// thresholds (docs/specs/039-large-backdrops.md §Research). Not a CI gate —
// rerun by hand when recalibrating WARN_DECODED_BYTES / HARD_DIMENSION.
//   PLAYWRIGHT_BROWSERS_PATH=... node demo/benchmark_backdrop_decode.mjs
import { chromium } from 'playwright';
import { reportPageErrors, watchPage } from './serve.mjs';

const guardProbe = process.argv.includes('--guard-probe');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = watchPage(await (await browser.newContext()).newPage());
const session = await page.context().newCDPSession(page);
await page.goto('about:blank');
const metrics = async () => {
  const m = await session.send('Performance.getMetrics');
  const get = (n) => m.metrics.find((x) => x.name === n)?.value || 0;
  return { jsHeap: Math.round(get('JSHeapUsedSize') / 1048576) };
};
const cases = [
  { mp: 4, alpha: false }, { mp: 8, alpha: false }, { mp: 16, alpha: false },
  { mp: 32, alpha: false }, { mp: 32, alpha: true }, { mp: 64, alpha: false },
  { mp: 100, alpha: false }, { mp: 165, alpha: false },
];
for (const c of guardProbe ? [] : cases) {
  try {
    const r = await page.evaluate(async ({ mp, alpha }) => {
      const side = Math.round(Math.sqrt(mp * 1e6));
      const w = side, h = side;
      // сгенерировать PNG нужного размера
      const cv = new OffscreenCanvas(w, h);
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, alpha ? 'rgba(200,30,30,0.5)' : '#c81e1e');
      g.addColorStop(1, '#1e50c8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 200; i++) { ctx.fillStyle = `hsl(${i*7},60%,50%)`; ctx.fillRect((i*97)%w, (i*61)%h, 40, 40); }
      const blob = await cv.convertToBlob({ type: 'image/png' });
      // decode: createImageBitmap
      const t0 = performance.now();
      const bmp = await createImageBitmap(blob);
      const decodeMs = Math.round(performance.now() - t0);
      // downscale до 4096 по длинной стороне
      const target = 4096;
      const scale = Math.min(1, target / Math.max(bmp.width, bmp.height));
      const t1 = performance.now();
      const out = new OffscreenCanvas(Math.round(bmp.width*scale), Math.round(bmp.height*scale));
      out.getContext('2d').drawImage(bmp, 0, 0, out.width, out.height);
      const outBlob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      const downMs = Math.round(performance.now() - t1);
      bmp.close();
      return { w, h, fileMB: +(blob.size/1048576).toFixed(1), rgbaMB: Math.round(w*h*4/1048576),
        decodeMs, downMs, outMB: +(outBlob.size/1048576).toFixed(1) };
    }, c);
    const m = await metrics();
    console.log(JSON.stringify({ mp: c.mp, alpha: c.alpha, ...r, jsHeapMB: m.jsHeap }));
  } catch (e) {
    console.log(JSON.stringify({ mp: c.mp, alpha: c.alpha, FAIL: String(e).slice(0, 120) }));
  }
}
if (guardProbe) {
  await page.evaluate(() => {
    setTimeout(() => { throw new Error('houseplan backdrop guard probe'); }, 0);
  });
}
if (await reportPageErrors()) {
  await browser.close();
  process.exit(1);
}
await browser.close();
