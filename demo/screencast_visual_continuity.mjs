// #73 stable-release pixel gate. Unlike a loop of Playwright screenshots,
// CDP screencast observes compositor-presented frames and can therefore catch
// the single black/empty frame that motivated the visual-continuity contract.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });
const session = await page.context().newCDPSession(page);
const frames = [];
let stopped = false;

session.on('Page.screencastFrame', (event) => {
  if (frames.length < 120) frames.push(event.data);
  void session.send('Page.screencastFrameAck', { sessionId: event.sessionId });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const stage = await page.locator('houseplan-card').evaluate((card) => {
    const node = (card.shadowRoot || card.renderRoot).querySelector('.stage');
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  await session.send('Page.startScreencast', {
    format: 'png', everyNthFrame: 1, maxWidth: 820, maxHeight: 760,
  });
  await wait(120);
  await page.evaluate(() => window.__card._pageVisibility({
    kind: 'visible', token: 73, at: Date.now(), hiddenFor: 20_000, long: true,
  }));
  // A harmless real paint gives the compositor enough damage to emit the
  // candidate sequence even when the fresh server response equals the stale
  // frame pixel-for-pixel.
  await page.mouse.move(stage.x + stage.width * 0.42, stage.y + stage.height * 0.52);
  await wait(850);
  await page.mouse.move(2, 2);
  await wait(180);
  await session.send('Page.stopScreencast');
  stopped = true;

  const metrics = await page.evaluate(async ({ encoded, crop }) => {
    const decode = (data) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/png;base64,${data}`;
    });
    const out = [];
    for (const data of encoded) {
      const image = await decode(data);
      const scaleX = image.width / innerWidth;
      const scaleY = image.height / innerHeight;
      const x = Math.max(0, Math.floor(crop.x * scaleX));
      const y = Math.max(0, Math.floor(crop.y * scaleY));
      const width = Math.max(1, Math.min(image.width - x, Math.floor(crop.width * scaleX)));
      const height = Math.max(1, Math.min(image.height - y, Math.floor(crop.height * scaleY)));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let count = 0;
      let sum = 0;
      let sum2 = 0;
      let dark = 0;
      for (let row = 0; row < height; row += 4) {
        for (let column = 0; column < width; column += 4) {
          const offset = (row * width + column) * 4;
          const luma = pixels[offset] * 0.2126
            + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
          count++;
          sum += luma;
          sum2 += luma * luma;
          if (luma < 18) dark++;
        }
      }
      const mean = sum / Math.max(1, count);
      out.push({
        mean,
        variance: sum2 / Math.max(1, count) - mean * mean,
        darkRatio: dark / Math.max(1, count),
      });
    }
    return out;
  }, { encoded: frames, crop: stage });

  const baseline = metrics[0] || { mean: 0, variance: 0, darkRatio: 1 };
  const forbidden = metrics.filter((frame) => (
    frame.variance < Math.max(12, baseline.variance * 0.08)
    || frame.mean < Math.max(4, baseline.mean * 0.35)
    || (baseline.darkRatio < 0.85 && frame.darkRatio > 0.96)
  ));

  mkdirSync('artifacts/continuity-screencast', { recursive: true });
  frames.forEach((data, index) => writeFileSync(
    `artifacts/continuity-screencast/frame-${String(index).padStart(3, '0')}.png`,
    Buffer.from(data, 'base64'),
  ));
  writeFileSync('artifacts/continuity-screencast/metrics.json', JSON.stringify({
    stage, frames: metrics, forbidden: forbidden.length,
  }, null, 2));

  const result = {
    capturedPresentedFrames: frames.length >= 2,
    baselineContainsPlanDetail: baseline.variance >= 12 && baseline.mean >= 4,
    noEmptyOrBlackPresentedFrame: forbidden.length === 0,
  };
  for (const [name, value] of Object.entries(result)) check(name, value);
  await finish(browser, result);
} finally {
  if (!stopped) await session.send('Page.stopScreencast').catch(() => undefined);
  await browser.close().catch(() => undefined);
}
