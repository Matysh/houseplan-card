#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../serve.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from './harness.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from './matrix.mjs';
import {
  assertGoldenInvocation,
  GOLDEN_BASELINE_MANIFEST,
  goldenRunFailed,
  goldenScenarioSetsMatch,
} from './policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7) || 'capture';
const scenarioFilter = process.argv.find((arg) => arg.startsWith('--scenario='))?.slice(11) || '';
assertGoldenInvocation(mode, scenarioFilter);
const scenarios = scenarioFilter
  ? GOLDEN_SCENARIOS.filter((scenario) => scenario.id === scenarioFilter)
  : GOLDEN_SCENARIOS;
if (!scenarios.length) throw new Error(`unknown golden scenario: ${scenarioFilter}`);

const artifactRoot = resolve(ROOT, 'artifacts/golden');
const actualRoot = resolve(artifactRoot, 'actual');
const diffRoot = resolve(artifactRoot, 'diff');
const baselineRoot = resolve(ROOT, 'demo/golden/baselines');
mkdirSync(actualRoot, { recursive: true });
mkdirSync(diffRoot, { recursive: true });

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function comparePng(page, actual, baseline, threshold) {
  return page.evaluate(async ({ actual64, baseline64, threshold }) => {
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const [actualImage, baselineImage] = await Promise.all([decode(actual64), decode(baseline64)]);
    if (actualImage.width !== baselineImage.width || actualImage.height !== baselineImage.height) {
      return {
        dimensionsMatch: false,
        actualSize: [actualImage.width, actualImage.height],
        baselineSize: [baselineImage.width, baselineImage.height],
        differingPixels: null,
        diffRatio: 1,
        maxObservedDelta: 255,
        passed: false,
        diffPngBase64: null,
      };
    }
    const width = actualImage.width;
    const height = actualImage.height;
    const canvas = document.createElement('canvas');
    const baselineCanvas = document.createElement('canvas');
    const diffCanvas = document.createElement('canvas');
    for (const item of [canvas, baselineCanvas, diffCanvas]) {
      item.width = width;
      item.height = height;
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const baselineContext = baselineCanvas.getContext('2d', { willReadFrequently: true });
    const diffContext = diffCanvas.getContext('2d');
    context.drawImage(actualImage, 0, 0);
    baselineContext.drawImage(baselineImage, 0, 0);
    const actualData = context.getImageData(0, 0, width, height).data;
    const baselineData = baselineContext.getImageData(0, 0, width, height).data;
    const diff = diffContext.createImageData(width, height);
    let differingPixels = 0;
    let maxObservedDelta = 0;
    for (let offset = 0; offset < actualData.length; offset += 4) {
      let delta = 0;
      for (let channel = 0; channel < 4; channel++)
        delta = Math.max(delta, Math.abs(actualData[offset + channel] - baselineData[offset + channel]));
      maxObservedDelta = Math.max(maxObservedDelta, delta);
      if (delta > threshold.maxChannelDelta) {
        differingPixels++;
        diff.data[offset] = 255;
        diff.data[offset + 1] = 0;
        diff.data[offset + 2] = 180;
        diff.data[offset + 3] = 255;
      } else {
        const gray = Math.round((actualData[offset] + actualData[offset + 1] + actualData[offset + 2]) / 9);
        diff.data[offset] = gray;
        diff.data[offset + 1] = gray;
        diff.data[offset + 2] = gray;
        diff.data[offset + 3] = 90;
      }
    }
    diffContext.putImageData(diff, 0, 0);
    const diffRatio = differingPixels / (width * height);
    return {
      dimensionsMatch: true,
      actualSize: [width, height],
      baselineSize: [width, height],
      differingPixels,
      diffRatio,
      maxObservedDelta,
      passed: diffRatio <= threshold.maxDiffRatio,
      diffPngBase64: differingPixels
        ? diffCanvas.toDataURL('image/png').slice('data:image/png;base64,'.length)
        : null,
    };
  }, {
    actual64: actual.toString('base64'),
    baseline64: baseline.toString('base64'),
    threshold,
  });
}

/** Capture the identical visual frame with only the rendered sun-ray SVG
 * hidden. Comparing this control frame with the reviewed golden proves that
 * the layer changes real browser pixels, not merely that its DOM exists. */
async function captureWithoutSunRays(page, screenshotOptions) {
  const layerState = await page.evaluate(async () => {
    const layer = window.__goldenCard?.renderRoot?.querySelector('.sunlayer');
    if (!layer) throw new Error('semantic golden sun layer is missing');
    const shapes = layer.querySelectorAll('path, polygon').length;
    if (!shapes) throw new Error('semantic golden sun layer has no painted shapes');
    const previous = layer.style.visibility;
    layer.style.visibility = 'hidden';
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return { previous, shapes };
  });
  try {
    return { png: await page.screenshot(screenshotOptions), shapes: layerState.shapes };
  } finally {
    await page.evaluate(async (previous) => {
      const layer = window.__goldenCard?.renderRoot?.querySelector('.sunlayer');
      if (layer) layer.style.visibility = previous;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, layerState.previous);
  }
}

/** Capture a control frame with only the transient opening symbol hidden.
 * Comparing it with the actual frame proves the preview paints browser pixels;
 * the smoke test separately locks its DOM order above the wall body. */
async function captureWithoutOpeningPreview(page, screenshotOptions) {
  const layerState = await page.evaluate(async () => {
    const card = window.__goldenCard;
    const parts = [...(card?.renderRoot?.querySelectorAll(
      '.opening-preview, .opening-preview-dot',
    ) || [])];
    if (!parts.length) throw new Error('semantic golden opening preview is missing');
    const previous = parts.map((part) => part.style.visibility);
    for (const part of parts) part.style.visibility = 'hidden';
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return { previous, count: parts.length };
  });
  try {
    return { png: await page.screenshot(screenshotOptions), parts: layerState.count };
  } finally {
    await page.evaluate(async (previous) => {
      const card = window.__goldenCard;
      const parts = [...(card?.renderRoot?.querySelectorAll(
        '.opening-preview, .opening-preview-dot',
      ) || [])];
      parts.forEach((part, index) => { part.style.visibility = previous[index] || ''; });
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, layerState.previous);
  }
}

async function countChangedPixels(page, actual, control, spec) {
  return page.evaluate(async ({ actual64, control64, minChannelDelta }) => {
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const [actualImage, controlImage] = await Promise.all([decode(actual64), decode(control64)]);
    if (actualImage.width !== controlImage.width || actualImage.height !== controlImage.height)
      throw new Error('semantic golden control frame has different dimensions');
    const canvas = document.createElement('canvas');
    const controlCanvas = document.createElement('canvas');
    canvas.width = controlCanvas.width = actualImage.width;
    canvas.height = controlCanvas.height = actualImage.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const controlContext = controlCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(actualImage, 0, 0);
    controlContext.drawImage(controlImage, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const controlPixels = controlContext.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    let maxDelta = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const delta = Math.max(
        Math.abs(pixels[offset] - controlPixels[offset]),
        Math.abs(pixels[offset + 1] - controlPixels[offset + 1]),
        Math.abs(pixels[offset + 2] - controlPixels[offset + 2]),
      );
      maxDelta = Math.max(maxDelta, delta);
      if (delta >= minChannelDelta) changed++;
    }
    return { changed, maxDelta, size: [canvas.width, canvas.height] };
  }, {
    actual64: actual.toString('base64'),
    control64: control.toString('base64'),
    minChannelDelta: spec.minChannelDelta,
  });
}

/** Count preview pixels which are actually painted over the physical wall
 * fill. A global changed-pixel threshold can pass even when the complete
 * symbol is accidentally hidden below masonry because its swing arc remains
 * outside the body. */
async function countOpeningPreviewPixelsInsideWall(
  page, actual, control, clip, minChannelDelta,
) {
  return page.evaluate(async ({ actual64, control64, clipRect, minDelta }) => {
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const [actualImage, controlImage] = await Promise.all([decode(actual64), decode(control64)]);
    const canvas = document.createElement('canvas');
    const controlCanvas = document.createElement('canvas');
    canvas.width = controlCanvas.width = actualImage.width;
    canvas.height = controlCanvas.height = actualImage.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const controlContext = controlCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(actualImage, 0, 0);
    controlContext.drawImage(controlImage, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const controls = controlContext.getImageData(0, 0, canvas.width, canvas.height).data;
    const card = window.__goldenCard;
    const preview = card?.renderRoot?.querySelector('.opening-preview');
    const walls = [...(card?.renderRoot?.querySelectorAll('.wallbody-fill') || [])]
      .map((wall) => {
        const matrix = wall.getScreenCTM?.();
        return matrix ? { wall, rect: wall.getBoundingClientRect(), inverse: matrix.inverse() } : null;
      })
      .filter(Boolean);
    if (!preview || !walls.length) return { changed: 0, sampled: 0 };
    const previewRect = preview.getBoundingClientRect();
    const candidates = walls.filter(({ rect }) => rect.right >= previewRect.left
      && rect.left <= previewRect.right && rect.bottom >= previewRect.top
      && rect.top <= previewRect.bottom);
    if (!candidates.length) return { changed: 0, sampled: 0 };
    const left = Math.ceil(previewRect.left);
    const top = Math.ceil(previewRect.top);
    const right = Math.floor(previewRect.right);
    const bottom = Math.floor(previewRect.bottom);
    const originX = clipRect?.x || 0;
    const originY = clipRect?.y || 0;
    let changed = 0;
    let sampled = 0;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const screenPoint = new DOMPoint(x + 0.5, y + 0.5);
        const insideWall = candidates.some(({ wall, rect, inverse }) => {
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
          return wall.isPointInFill(screenPoint.matrixTransform(inverse));
        });
        if (!insideWall) continue;
        const px = Math.round(x - originX);
        const py = Math.round(y - originY);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        sampled += 1;
        const offset = (py * canvas.width + px) * 4;
        const delta = Math.max(
          Math.abs(pixels[offset] - controls[offset]),
          Math.abs(pixels[offset + 1] - controls[offset + 1]),
          Math.abs(pixels[offset + 2] - controls[offset + 2]),
          Math.abs(pixels[offset + 3] - controls[offset + 3]),
        );
        if (delta >= minDelta) changed += 1;
      }
    }
    return { changed, sampled };
  }, {
    actual64: actual.toString('base64'),
    control64: control.toString('base64'),
    clipRect: clip || null,
    minDelta: minChannelDelta,
  });
}

/** Assert scenario semantics against the actual capture, not only its data.
 *  This protects a reviewed-but-empty baseline from becoming the reference. */
async function countWarmPixels(page, png, region) {
  return page.evaluate(async ({ png64, region }) => {
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const left = Math.max(0, Math.min(image.width, Math.floor(region.x * image.width)));
    const top = Math.max(0, Math.min(image.height, Math.floor(region.y * image.height)));
    const right = Math.max(left, Math.min(image.width, Math.ceil((region.x + region.w) * image.width)));
    const bottom = Math.max(top, Math.min(image.height, Math.ceil((region.y + region.h) * image.height)));
    const pixels = context.getImageData(left, top, right - left, bottom - top).data;
    let warm = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] - pixels[offset + 2] > region.minRedBlueDelta) warm++;
    }
    return { warm, bounds: [left, top, right, bottom] };
  }, { png64: png.toString('base64'), region });
}

/** Semantic guard for #231. Sample named plan points from the actual browser
 * capture; the decor node merely existing in DOM is insufficient when an
 * opaque floor layer is painted after it. */
async function inspectDecorPixels(page, png, clip, spec) {
  return page.evaluate(async ({ png64, clip, spec }) => {
    const card = window.__goldenCard;
    const svg = card?.renderRoot?.querySelector('.stage .zoomwrap > svg');
    const decor = card?.renderRoot?.querySelector('.decorlayer');
    const matrix = svg?.getScreenCTM?.();
    if (!svg || !decor || !matrix) throw new Error('semantic golden decor layer is missing');
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const cssWidth = clip?.width || document.documentElement.clientWidth;
    const cssHeight = clip?.height || document.documentElement.clientHeight;
    const scaleX = image.width / Math.max(1, cssWidth);
    const scaleY = image.height / Math.max(1, cssHeight);
    const originX = clip?.x || 0, originY = clip?.y || 0;
    const expected = String(spec.color || '').match(/^#([0-9a-f]{6})$/i)?.[1];
    if (!expected) throw new Error(`semantic golden decor color is invalid: ${spec.color}`);
    const rgb = [0, 2, 4].map((offset) => parseInt(expected.slice(offset, offset + 2), 16));
    const radius = Math.max(0, Math.round(spec.radius || 0));
    return spec.points.map((probe) => {
      const point = svg.createSVGPoint();
      point.x = Number(probe.x) * 1000; point.y = Number(probe.y) * 1000;
      const screen = point.matrixTransform(matrix);
      const cx = Math.round((screen.x - originX) * scaleX);
      const cy = Math.round((screen.y - originY) * scaleY);
      let matching = 0, sampled = 0;
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
          const offset = (y * image.width + x) * 4;
          const distance = Math.max(
            Math.abs(pixels[offset] - rgb[0]),
            Math.abs(pixels[offset + 1] - rgb[1]),
            Math.abs(pixels[offset + 2] - rgb[2]),
          );
          if (pixels[offset + 3] > 240 && distance <= 48) matching++;
          sampled++;
        }
      }
      return {
        id: probe.id, matching, sampled,
        fraction: sampled ? matching / sampled : 0,
        pixel: [cx, cy],
      };
    });
  }, { png64: png.toString('base64'), clip, spec });
}

/** Semantic guard for issue #68: the reviewed bubble must contain rendered
 * glyph pixels, not just an empty surface or a stale open-state flag. */
async function countHelpTextPixels(page, png, clip, spec) {
  return page.evaluate(async ({ png64, clip, spec }) => {
    const card = window.__goldenCard;
    const help = card?.renderRoot?.querySelector(`hp-help[data-help-key="${spec.key}"]`);
    const surface = help?.renderRoot?.querySelector('.tooltip:popover-open')
      || card?.renderRoot?.querySelector('hp-dialog')?.renderRoot
        ?.querySelector('[data-hp-overlay="help"]')?.shadowRoot?.querySelector('.tooltip');
    if (!surface) throw new Error(`semantic golden help missing: ${spec.key}`);
    const bounds = surface.getBoundingClientRect();
    const match = getComputedStyle(surface).color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!match || match.length !== 3) throw new Error(`semantic golden help has invalid text color: ${spec.key}`);
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const originX = clip?.x || 0, originY = clip?.y || 0;
    const left = Math.max(0, Math.ceil(bounds.left - originX) + 5);
    const top = Math.max(0, Math.ceil(bounds.top - originY) + 5);
    const right = Math.min(image.width - 1, Math.floor(bounds.right - originX) - 5);
    const bottom = Math.min(image.height - 1, Math.floor(bounds.bottom - originY) - 5);
    let textPixels = 0;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const offset = (y * image.width + x) * 4;
        const distance = Math.abs(pixels[offset] - match[0])
          + Math.abs(pixels[offset + 1] - match[1])
          + Math.abs(pixels[offset + 2] - match[2]);
        if (pixels[offset + 3] > 240 && distance <= 90) textPixels++;
      }
    }
    return { textPixels, bounds: [left, top, right, bottom] };
  }, { png64: png.toString('base64'), clip, spec });
}

/** Detect one-pixel SVG seams inside a room-coloured opening tunnel. Sample a
 * narrow strip around local y=0: this crosses the join between both tunnel
 * half-faces at any opening angle while excluding legitimate outer-profile
 * steps where adjacent wall intervals have different physical thicknesses. */
async function inspectTunnelContinuity(page, png, clip, spec) {
  return page.evaluate(async ({ png64, clip, spec }) => {
    const card = window.__goldenCard;
    const tunnel = card?.renderRoot?.querySelector(
      `.opening-tunnels[data-layer="data"] [data-hp="opening-tunnel"][data-id="${spec.openingId}"]`,
    );
    if (!tunnel) throw new Error(`semantic golden tunnel missing: ${spec.openingId}`);
    const rect = tunnel.getBoundingClientRect();
    const matrix = tunnel.getScreenCTM();
    if (!matrix) throw new Error(`semantic golden tunnel has no screen transform: ${spec.openingId}`);
    const inverse = matrix.inverse();
    const localBounds = tunnel.getBBox();
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const originX = clip?.x || 0, originY = clip?.y || 0;
    // Screenshots may be captured at DPR > 1. DOMRect/clip are CSS pixels,
    // image coordinates are device pixels, so derive the scale instead of
    // silently sampling the wrong strip at high DPI.
    const cssWidth = clip?.width || document.documentElement.clientWidth;
    const cssHeight = clip?.height || document.documentElement.clientHeight;
    const scaleX = image.width / Math.max(1, cssWidth);
    const scaleY = image.height / Math.max(1, cssHeight);
    const insetX = Math.max(1, Math.round(spec.insetPx * scaleX));
    const insetY = Math.max(1, Math.round(spec.insetPx * scaleY));
    const left = Math.max(0, Math.ceil((rect.left - originX) * scaleX) + insetX);
    const top = Math.max(0, Math.ceil((rect.top - originY) * scaleY) + insetY);
    const right = Math.min(image.width - 1, Math.floor((rect.right - originX) * scaleX) - insetX);
    const bottom = Math.min(image.height - 1, Math.floor((rect.bottom - originY) * scaleY) - insetY);
    if (right - left < 3 || bottom - top < 3)
      throw new Error(`semantic golden tunnel is too small: ${left},${top},${right},${bottom}`);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rgb = (x, y) => {
      const offset = (y * image.width + x) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    };
    let maxJump = 0, maxPair = null, samplePairs = 0;
    const compare = (a, b, x, y, direction) => {
      const jump = Math.max(
        Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      if (jump > maxJump) {
        maxJump = jump;
        maxPair = { x, y, direction, a, b };
      }
      samplePairs++;
    };
    const localXScale = Math.max(1e-6, Math.hypot(matrix.a, matrix.b));
    const localYScale = Math.max(1e-6, Math.hypot(matrix.c, matrix.d));
    const endInset = Math.max(1, spec.insetPx) / localXScale;
    const axisBand = Math.max(1.5, spec.axisBandPx || 2.5) / localYScale;
    const insideAxisBand = (x, y) => {
      const cssX = originX + (x + 0.5) / scaleX;
      const cssY = originY + (y + 0.5) / scaleY;
      const local = new DOMPoint(cssX, cssY).matrixTransform(inverse);
      return local.x >= localBounds.x + endInset
        && local.x <= localBounds.x + localBounds.width - endInset
        && Math.abs(local.y) <= axisBand;
    };
    for (let y = top; y <= bottom; y++) {
      for (let x = left + 1; x <= right; x++) {
        if (insideAxisBand(x - 1, y) && insideAxisBand(x, y))
          compare(rgb(x - 1, y), rgb(x, y), x, y, 'horizontal');
      }
    }
    for (let x = left; x <= right; x++) {
      for (let y = top + 1; y <= bottom; y++) {
        if (insideAxisBand(x, y - 1) && insideAxisBand(x, y))
          compare(rgb(x, y - 1), rgb(x, y), x, y, 'vertical');
      }
    }
    if (!samplePairs) throw new Error(`semantic golden tunnel axis strip is empty: ${spec.openingId}`);
    return {
      maxJump, maxPair, samplePairs, bounds: [left, top, right, bottom],
      scale: [scaleX, scaleY],
    };
  }, { png64: png.toString('base64'), clip, spec });
}

let baselineManifest = null;
const baselineManifestPath = resolve(baselineRoot, GOLDEN_BASELINE_MANIFEST);
if (existsSync(baselineManifestPath)) {
  try { baselineManifest = JSON.parse(readFileSync(baselineManifestPath, 'utf8')); }
  catch { baselineManifest = { invalid: true }; }
}

const browserArgs = ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'];
const browserContext = { locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark', reducedMotion: 'reduce' };
const { page, browser } = await launch(
  { width: 1000, height: 900 },
  1,
  browserArgs,
  browserContext,
);
const chromium = await browser.version();
const results = [];
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
let buildFingerprint = null;
try {
  buildFingerprint = await assertFreshDemoBundle(page, ROOT);
  for (const scenario of scenarios) {
    const result = {
      id: scenario.id,
      threshold: scenario.threshold,
      status: 'error',
      actualSha256: null,
    };
    try {
      pageErrors.length = 0;
      result.runtime = await prepareGoldenScenario(page, scenario);
      if (pageErrors.length) throw new Error(`browser exception: ${pageErrors.join(' | ')}`);
      if (scenario.openingGeometry) {
        result.openingGeometry = await page.evaluate((expected) => {
          const card = window.__goldenCard;
          const opening = card?.renderRoot?.querySelector(
            `.opening[data-id="${CSS.escape(expected.id)}"]`,
          );
          if (!opening) return null;
          const transform = opening.getAttribute('transform') || '';
          const angle = Number(transform.match(/rotate\(([-+0-9.eE]+)\)/)?.[1]);
          const painted = [...opening.querySelectorAll('.op-leaf, .op-arc, .op-glass')]
            .map((part) => part.getBoundingClientRect())
            .filter((rect) => rect.width > 0 || rect.height > 0);
          const bounds = painted.length ? {
            width: Math.max(...painted.map((rect) => rect.right))
              - Math.min(...painted.map((rect) => rect.left)),
            height: Math.max(...painted.map((rect) => rect.bottom))
              - Math.min(...painted.map((rect) => rect.top)),
          } : { width: 0, height: 0 };
          return {
            type: opening.getAttribute('data-kind'), angle,
            width: bounds.width, height: bounds.height,
            visibleParts: opening.querySelectorAll('.op-leaf, .op-arc, .op-glass').length,
          };
        }, scenario.openingGeometry);
        const expected = scenario.openingGeometry;
        const actualOpening = result.openingGeometry;
        if (!actualOpening || actualOpening.type !== expected.type
            || Math.abs(actualOpening.angle - expected.angle) > 0.001
            || actualOpening.width <= 0 || actualOpening.height <= 0
            || actualOpening.visibleParts <= 0) {
          throw new Error(
            `semantic golden opening geometry failed for ${expected.id}: `
            + JSON.stringify(actualOpening),
          );
        }
      }
      const clip = await goldenClip(page, scenario.capture);
      const screenshotOptions = {
        ...(clip ? { clip } : {}),
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      };
      const actual = await page.screenshot(screenshotOptions);
      const actualPath = resolve(actualRoot, `${scenario.id}.png`);
      writeFileSync(actualPath, actual);
      result.actualSha256 = sha256(actual);
      result.actual = actualPath;
      if (scenario.sunRayPixels) {
        const control = await captureWithoutSunRays(page, screenshotOptions);
        const sample = await countChangedPixels(page, actual, control.png, scenario.sunRayPixels);
        result.sunRayShapes = control.shapes;
        result.sunRayChangedPixels = sample.changed;
        result.sunRayMaxChannelDelta = sample.maxDelta;
        if (sample.changed < scenario.sunRayPixels.minPixels) {
          throw new Error(
            `semantic golden assertion failed: sun rays paint ${sample.changed} pixels, expected at least `
            + `${scenario.sunRayPixels.minPixels}`,
          );
        }
      }
      if (scenario.openingPreviewPixels) {
        const control = await captureWithoutOpeningPreview(page, screenshotOptions);
        const sample = await countChangedPixels(
          page, actual, control.png, scenario.openingPreviewPixels,
        );
        result.openingPreviewParts = control.parts;
        result.openingPreviewChangedPixels = sample.changed;
        result.openingPreviewMaxChannelDelta = sample.maxDelta;
        const insideWall = await countOpeningPreviewPixelsInsideWall(
          page, actual, control.png, clip, scenario.openingPreviewPixels.minChannelDelta,
        );
        result.openingPreviewPixelsInsideWall = insideWall.changed;
        result.openingPreviewWallSamples = insideWall.sampled;
        if (control.parts < 2) {
          throw new Error(
            `semantic golden assertion failed: opening preview is incomplete (${control.parts} parts)`,
          );
        }
        if (sample.changed < scenario.openingPreviewPixels.minPixels) {
          throw new Error(
            `semantic golden assertion failed: opening preview paints ${sample.changed} pixels, `
            + `expected at least ${scenario.openingPreviewPixels.minPixels}`,
          );
        }
        if (insideWall.changed < scenario.openingPreviewPixels.minInsideWallPixels) {
          throw new Error(
            `semantic golden assertion failed: opening preview paints ${insideWall.changed} pixels `
            + `inside the wall body, expected at least `
            + `${scenario.openingPreviewPixels.minInsideWallPixels}`,
          );
        }
      }
      if (scenario.warmPixelRegion) {
        const sample = await countWarmPixels(page, actual, scenario.warmPixelRegion);
        result.warmPixels = sample.warm;
        result.warmPixelBounds = sample.bounds;
        if (sample.warm < scenario.warmPixelRegion.minPixels) {
          throw new Error(
            `semantic golden assertion failed: ${sample.warm} warm pixels, expected at least `
            + `${scenario.warmPixelRegion.minPixels}`,
          );
        }
      }
      if (scenario.decorPixelProbes) {
        const samples = await inspectDecorPixels(page, actual, clip, scenario.decorPixelProbes);
        result.decorPixelProbes = samples;
        const failed = samples.filter((sample) =>
          sample.fraction < scenario.decorPixelProbes.minMatchingFraction);
        if (failed.length) {
          throw new Error(
            `semantic golden assertion failed: decor is hidden/tinted at `
            + failed.map((sample) => `${sample.id} (${sample.matching}/${sample.sampled})`).join(', '),
          );
        }
      }
      if (scenario.helpTextRegion) {
        const sample = await countHelpTextPixels(page, actual, clip, scenario.helpTextRegion);
        result.helpTextPixels = sample.textPixels;
        result.helpPixelBounds = sample.bounds;
        if (sample.textPixels < scenario.helpTextRegion.minPixels) {
          throw new Error(
            `semantic golden assertion failed: help ${scenario.helpTextRegion.key} contains `
            + `${sample.textPixels} text pixels, expected at least ${scenario.helpTextRegion.minPixels}`,
          );
        }
      }
      if (scenario.tunnelContinuity) {
        const sample = await inspectTunnelContinuity(
          page, actual, clip, scenario.tunnelContinuity,
        );
        result.tunnelMaxChannelJump = sample.maxJump;
        result.tunnelMaxJumpPair = sample.maxPair;
        result.tunnelSamplePairs = sample.samplePairs;
        result.tunnelPixelBounds = sample.bounds;
        result.tunnelImageScale = sample.scale;
        if (sample.maxJump > scenario.tunnelContinuity.maxChannelJump) {
          throw new Error(
            `semantic golden assertion failed: opening ${scenario.tunnelContinuity.openingId} `
            + `has a ${sample.maxJump}-channel local jump, expected at most `
            + `${scenario.tunnelContinuity.maxChannelJump}`,
          );
        }
        if (scenario.tunnelContinuity.dpr2) {
          // A CSS-pixel capture cannot prove that half-device-pixel joins are
          // clean. Run the same semantic assertion once at DPR 2 without
          // adding a second reviewed baseline to the matrix.
          const highDpi = await launch(
            scenario.viewport, 2, browserArgs, browserContext,
          );
          try {
            await assertFreshDemoBundle(highDpi.page, ROOT);
            await prepareGoldenScenario(highDpi.page, scenario);
            const highDpiClip = await goldenClip(highDpi.page, scenario.capture);
            const highDpiPng = await highDpi.page.screenshot({
              ...(highDpiClip ? { clip: highDpiClip } : {}),
              animations: 'disabled', caret: 'hide', scale: 'device',
            });
            const highDpiSample = await inspectTunnelContinuity(
              highDpi.page, highDpiPng, highDpiClip, scenario.tunnelContinuity,
            );
            result.tunnelDpr2MaxChannelJump = highDpiSample.maxJump;
            result.tunnelDpr2SamplePairs = highDpiSample.samplePairs;
            result.tunnelDpr2PixelBounds = highDpiSample.bounds;
            if (highDpiSample.maxJump > scenario.tunnelContinuity.maxChannelJump) {
              throw new Error(
                `semantic golden assertion failed at DPR 2: opening ${scenario.tunnelContinuity.openingId} `
                + `has a ${highDpiSample.maxJump}-channel local jump, expected at most `
                + `${scenario.tunnelContinuity.maxChannelJump}`,
              );
            }
          } finally {
            await highDpi.browser.close();
          }
        }
      }
      const baselinePath = resolve(baselineRoot, `${scenario.id}.png`);
      result.baseline = baselinePath;
      if (!existsSync(baselinePath)) {
        result.status = 'missing-baseline';
      } else {
        const baseline = readFileSync(baselinePath);
        const expectedBaselineSha256 = baselineManifest?.scenarios?.[scenario.id];
        result.baselineSha256 = sha256(baseline);
        if (!expectedBaselineSha256 || result.baselineSha256 !== expectedBaselineSha256) {
          result.status = 'invalid-baseline';
          result.error = expectedBaselineSha256
            ? 'baseline PNG does not match its reviewed manifest hash'
            : 'baseline PNG is not listed in the reviewed manifest';
          results.push(result);
          console.log(`${result.status.padEnd(17)} ${scenario.id}`);
          continue;
        }
        const comparison = await comparePng(page, actual, baseline, scenario.threshold);
        Object.assign(result, comparison);
        result.status = comparison.passed ? 'passed' : 'different';
        if (comparison.diffPngBase64) {
          const diffPath = resolve(diffRoot, `${scenario.id}.png`);
          writeFileSync(diffPath, Buffer.from(comparison.diffPngBase64, 'base64'));
          result.diff = diffPath;
        }
        delete result.diffPngBase64;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    } finally {
      // Tab-divider goldens deliberately hold the real pointer through the
      // screenshot. Always release it before the shared page is reused, even
      // when semantic validation or capture failed.
      if (scenario.tabDrag) {
        try { await page.mouse.up(); } catch { /* the browser may already be closing */ }
      }
    }
    results.push(result);
    console.log(`${result.status.padEnd(17)} ${scenario.id}`);
  }
} finally {
  await browser.close();
}

const expectedScenarioIds = GOLDEN_SCENARIOS.map((scenario) => scenario.id);
const indexedScenarioIds = Object.keys(baselineManifest?.scenarios || {});
const baselineScenarioIds = readdirSync(baselineRoot)
  .filter((name) => name.endsWith('.png'))
  .map((name) => name.slice(0, -'.png'.length));
const manifestValid = !!baselineManifest
  && !baselineManifest.invalid
  && baselineManifest.matrixVersion === GOLDEN_MATRIX_VERSION
  && baselineManifest.chromium === chromium
  && expectedScenarioIds.every((id) => typeof baselineManifest.scenarios?.[id] === 'string')
  && goldenScenarioSetsMatch(expectedScenarioIds, indexedScenarioIds, baselineScenarioIds);
const report = {
  schema: 1,
  mode,
  generatedAt: new Date().toISOString(),
  matrixVersion: GOLDEN_MATRIX_VERSION,
  buildFingerprint,
  chromium,
  baselineManifest: baselineManifest ? {
    present: true,
    valid: manifestValid,
    matrixVersion: baselineManifest.matrixVersion ?? null,
    chromium: baselineManifest.chromium ?? null,
  } : { present: false, valid: false, matrixVersion: null, chromium: null },
  results,
};
writeFileSync(resolve(artifactRoot, 'golden-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (goldenRunFailed(mode, manifestValid, results)) process.exitCode = 1;
