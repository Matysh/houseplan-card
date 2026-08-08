#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../serve.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from './harness.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from './matrix.mjs';
import { assertGoldenInvocation, goldenRunFailed } from './policy.mjs';

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

let baselineManifest = null;
const baselineManifestPath = resolve(baselineRoot, 'manifest.json');
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

const manifestValid = !!baselineManifest
  && !baselineManifest.invalid
  && baselineManifest.matrixVersion === GOLDEN_MATRIX_VERSION
  && baselineManifest.chromium === chromium
  && GOLDEN_SCENARIOS.every((scenario) => typeof baselineManifest.scenarios?.[scenario.id] === 'string');
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
