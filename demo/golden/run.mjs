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

/** Detect one-pixel SVG seams inside a room-coloured opening tunnel. The
 * opening symbol is hidden by the scenario, so both centre lines should be a
 * locally constant translucent surface. Sampling both axes catches the wall
 * centre split as well as boundaries between atomic wall-profile pieces. */
async function inspectTunnelContinuity(page, png, clip, spec) {
  return page.evaluate(async ({ png64, clip, spec }) => {
    const card = window.__goldenCard;
    const tunnel = card?.renderRoot?.querySelector(
      `.opening-tunnels[data-layer="data"] [data-hp="opening-tunnel"][data-id="${spec.openingId}"]`,
    );
    if (!tunnel) throw new Error(`semantic golden tunnel missing: ${spec.openingId}`);
    const rect = tunnel.getBoundingClientRect();
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const originX = clip?.x || 0, originY = clip?.y || 0;
    const left = Math.max(0, Math.ceil(rect.left - originX) + spec.insetPx);
    const top = Math.max(0, Math.ceil(rect.top - originY) + spec.insetPx);
    const right = Math.min(image.width - 1, Math.floor(rect.right - originX) - spec.insetPx);
    const bottom = Math.min(image.height - 1, Math.floor(rect.bottom - originY) - spec.insetPx);
    if (right - left < 3 || bottom - top < 3)
      throw new Error(`semantic golden tunnel is too small: ${left},${top},${right},${bottom}`);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rgb = (x, y) => {
      const offset = (y * image.width + x) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    };
    let maxJump = 0, samplePairs = 0;
    const compare = (a, b) => {
      maxJump = Math.max(maxJump,
        Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      samplePairs++;
    };
    const centreX = Math.round((left + right) / 2);
    const centreY = Math.round((top + bottom) / 2);
    for (let x = left + 1; x <= right; x++) compare(rgb(x - 1, centreY), rgb(x, centreY));
    for (let y = top + 1; y <= bottom; y++) compare(rgb(centreX, y - 1), rgb(centreX, y));
    return { maxJump, samplePairs, bounds: [left, top, right, bottom] };
  }, { png64: png.toString('base64'), clip, spec });
}

let baselineManifest = null;
const baselineManifestPath = resolve(baselineRoot, GOLDEN_BASELINE_MANIFEST);
if (existsSync(baselineManifestPath)) {
  try { baselineManifest = JSON.parse(readFileSync(baselineManifestPath, 'utf8')); }
  catch { baselineManifest = { invalid: true }; }
}

const { page, browser } = await launch(
  { width: 1000, height: 900 },
  1,
  ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
  { locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark', reducedMotion: 'reduce' },
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
      const clip = await goldenClip(page, scenario.capture);
      const actual = await page.screenshot({
        ...(clip ? { clip } : {}),
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      const actualPath = resolve(actualRoot, `${scenario.id}.png`);
      writeFileSync(actualPath, actual);
      result.actualSha256 = sha256(actual);
      result.actual = actualPath;
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
        result.tunnelSamplePairs = sample.samplePairs;
        result.tunnelPixelBounds = sample.bounds;
        if (sample.maxJump > scenario.tunnelContinuity.maxChannelJump) {
          throw new Error(
            `semantic golden assertion failed: opening ${scenario.tunnelContinuity.openingId} `
            + `has a ${sample.maxJump}-channel local jump, expected at most `
            + `${scenario.tunnelContinuity.maxChannelJump}`,
          );
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
