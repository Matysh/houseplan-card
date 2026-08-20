// Issue #213: dense fractional geometry plus painted-centroid proof at common DPRs.
import { launch, checkAll, finish } from './serve.mjs';

const dprs = [1, 1.25, 1.5, 2];
const paintedSizes = [24, 24.25, 31.75, 32, 47.25, 50.4, 55.75, 63.25, 79.75, 95.5, 111.75, 112];
const evidence = [];

for (const dpr of dprs) {
  const { page, browser } = await launch(
    { width: 980, height: 760 }, dpr, [], { colorScheme: 'light' },
  );
  await page.evaluate(async () => {
    const c = window.__card;
    c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode: false } };
    c._regSignature = '';
    c._maybeRebuildDevices();
    c._setMode('view');
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const root = c.shadowRoot || c.renderRoot;
    const marker = root.querySelector('.dev[data-id="d_light1"]');
    const layer = marker.closest('.devlayer');
    for (const node of layer.children) {
      if (node !== marker) node.style.display = 'none';
    }
    for (const node of layer.parentElement.children) {
      if (node !== layer) node.style.visibility = 'hidden';
    }
    marker.className = 'dev theme-light';
    marker.style.left = '50%';
    marker.style.top = '50%';
    marker.style.setProperty('--dev-scale', '1');
    marker.style.setProperty('--device-face-bg', 'rgb(0 255 0)');
    marker.style.setProperty('--device-face-fg', 'rgb(0 255 0)');
    marker.style.setProperty('--device-shell-stroke', 'rgb(255 0 0)');
    for (const extra of marker.querySelectorAll(
      '.device-pulse, .activity-dot, .newdot, .habadge, .lqi, .device-sections',
    )) extra.style.display = 'none';
    marker.querySelector('ha-icon').style.visibility = 'hidden';
    marker.querySelector('.device-core').style.transition = 'none';
    marker.querySelector('.device-core').style.boxShadow = 'none';
    const frame = marker.querySelector('.device-shell-frame');
    frame.style.transition = 'none';
    frame.style.boxShadow = 'none';
    frame.style.border = '0';
    // A solid diagnostic shell makes the alpha-weighted centroid stable even
    // when the production stroke is only one sparse physical pixel wide.
    frame.style.background = 'rgb(255 0 0)';
    root.querySelector('.stage').style.background = 'rgb(0 0 255)';
  });

  const dense = await page.evaluate(async () => {
    const root = window.__card.shadowRoot || window.__card.renderRoot;
    const marker = root.querySelector('.dev[data-id="d_light1"]');
    const core = marker.querySelector('.device-core');
    const frame = marker.querySelector('.device-shell-frame');
    let maxDx = 0;
    let maxDy = 0;
    let maxSizeError = 0;
    let samples = 0;
    for (let quarter = 24 * 4; quarter <= 112 * 4; quarter++) {
      const size = quarter / 4;
      marker.style.setProperty('--device-base-size', `${size}px`);
      // A style/layout read is intentional: this smoke enumerates browser
      // quantisation, production has no per-marker measurement loop.
      const a = core.getBoundingClientRect();
      const b = frame.getBoundingClientRect();
      maxDx = Math.max(maxDx, Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)));
      maxDy = Math.max(maxDy, Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)));
      maxSizeError = Math.max(maxSizeError, Math.abs(a.width - size), Math.abs(a.height - size));
      samples++;
    }
    return { samples, maxDx, maxDy, maxSizeError };
  });

  const painted = [];
  for (const size of paintedSizes) {
    const clip = await page.evaluate(async (nextSize) => {
      const root = window.__card.shadowRoot || window.__card.renderRoot;
      const marker = root.querySelector('.dev[data-id="d_light1"]');
      marker.style.setProperty('--device-base-size', `${nextSize}px`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const r = marker.querySelector('.device-core').getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Fixed integer clip bounds remove screenshot-crop quantisation from the
      // centroid comparison; all tested shells fit with a generous margin.
      return { x: Math.floor(cx - 85), y: Math.floor(cy - 85), width: 170, height: 170 };
    }, size);
    await page.evaluate(() => {
      const marker = (window.__card.shadowRoot || window.__card.renderRoot)
        .querySelector('.dev[data-id="d_light1"]');
      marker.querySelector('.device-core').style.visibility = 'hidden';
      marker.querySelector('.device-shell-frame').style.visibility = 'visible';
    });
    const shellPng = await page.screenshot({ type: 'png', clip });
    await page.evaluate(() => {
      const marker = (window.__card.shadowRoot || window.__card.renderRoot)
        .querySelector('.dev[data-id="d_light1"]');
      marker.querySelector('.device-core').style.visibility = 'visible';
      marker.querySelector('.device-shell-frame').style.visibility = 'hidden';
    });
    const corePng = await page.screenshot({ type: 'png', clip });
    await page.evaluate(() => {
      const marker = (window.__card.shadowRoot || window.__card.renderRoot)
        .querySelector('.dev[data-id="d_light1"]');
      marker.querySelector('.device-shell-frame').style.visibility = 'visible';
    });
    const centroid = await page.evaluate(async ({ shellBase64, coreBase64 }) => {
      const point = async (base64, channel) => {
        const raw = atob(base64);
        const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let weight = 0, weightedX = 0, weightedY = 0;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
          const i = (y * bitmap.width + x) * 4;
          const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
          const primary = channel === 'red' ? r : g;
          const other = channel === 'red' ? Math.max(g, b) : Math.max(r, b);
          const sample = Math.max(0, primary - other) * a / 255;
          weight += sample; weightedX += x * sample; weightedY += y * sample;
          if (sample > 0) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
        return {
          x: weightedX / weight, y: weightedY / weight, weight,
          boundsX: (minX + maxX) / 2, boundsY: (minY + maxY) / 2,
        };
      };
      // Capture each paint layer in isolation. Subtracting the large core from
      // a one-pixel annulus amplifies harmless edge AA into a false centroid.
      const red = await point(shellBase64, 'red');
      const green = await point(coreBase64, 'green');
      return {
        dx: Math.abs(red.x - green.x),
        dy: Math.abs(red.y - green.y),
        boundsDx: Math.abs(red.boundsX - green.boundsX),
        boundsDy: Math.abs(red.boundsY - green.boundsY),
        redWeight: red.weight,
        greenWeight: green.weight,
      };
    }, { shellBase64: shellPng.toString('base64'), coreBase64: corePng.toString('base64') });
    painted.push({ size, ...centroid });
  }

  const mutant = await page.evaluate(async () => {
    const root = window.__card.shadowRoot || window.__card.renderRoot;
    const marker = root.querySelector('.dev[data-id="d_light1"]');
    marker.style.setProperty('--device-base-size', '50.4px');
    const frame = marker.querySelector('.device-shell-frame');
    frame.style.transform = 'translateX(1px)';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const core = marker.querySelector('.device-core').getBoundingClientRect();
    const shell = frame.getBoundingClientRect();
    return Math.abs((core.left + core.width / 2) - (shell.left + shell.width / 2));
  });

  evidence.push({ dpr, dense, painted, mutant });
  await browser.close();
}

const result = {
  denseQuarterPixelMatrixCovers24To112: evidence.every((row) => row.dense.samples === 353),
  domCentresShareOneLayoutQuantum: evidence.every((row) =>
    row.dense.maxDx <= 0.02 && row.dense.maxDy <= 0.02 && row.dense.maxSizeError <= 0.02),
  paintedCentroidsStayWithinCalibratedHalfCssPixel: evidence.every((row) => row.painted.every((sample) =>
    sample.redWeight > 0 && sample.greenWeight > 0
      && sample.dx <= row.dpr / 2 + 0.1 && sample.dy <= row.dpr / 2 + 0.1)),
  paintedSupportStaysWithinOneRasterPixel: evidence.every((row) => row.painted.every((sample) =>
    sample.boundsDx <= 1.01 && sample.boundsDy <= 1.01)),
  onePixelNudgeMutantIsDetected: evidence.every((row) => row.mutant >= 0.98),
};

if (Object.values(result).some((value) => value !== true)) {
  console.error(`pixel alignment evidence: ${JSON.stringify(evidence, null, 2)}`);
}
checkAll(result);
await finish(null, result);
