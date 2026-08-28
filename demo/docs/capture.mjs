#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// #337: a clean CI checkout has no ignored demo bundle. Materialize the whole
// manifest-owned tree before launching Chromium; copying only the stable entry
// leaves every content-hashed import at 404.
import '../../scripts/bundle-sync.mjs';
import { visualFingerprint } from '../../scripts/source-fingerprint.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from '../golden/harness.mjs';
import { launch } from '../serve.mjs';
import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from './screenshots.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'docs/images');
const SCRIPT = fileURLToPath(import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');


const roomCardClip = (page) => page.evaluate(() => {
  const card = window.__goldenCard;
  const roomCards = [...(card?.renderRoot?.querySelectorAll('.roomlabel') || [])];
  const target = roomCards.find((item) => item.querySelector('.rlm')) || roomCards[0];
  if (!target) throw new Error('documentation room card is missing');
  const rect = target.getBoundingClientRect();
  const marginX = 80;
  const marginY = 70;
  return {
    x: Math.max(0, rect.left - marginX),
    y: Math.max(0, rect.top - marginY),
    width: Math.min(innerWidth, rect.right + marginX) - Math.max(0, rect.left - marginX),
    height: Math.min(innerHeight, rect.bottom + marginY) - Math.max(0, rect.top - marginY),
  };
});

/**
 * Documentation-only presentation state. Keep these mutations out of the
 * golden harness: changing that release fixture would invalidate every visual
 * baseline even though the production component and golden matrix are intact.
 */
const applyDocumentationState = (page, scenario) => page.evaluate(async (current) => {
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const card = window.__goldenCard;
  if (!card) throw new Error(`documentation card is missing: ${current.id}`);

  if (current.title) {
    card.setConfig({ ...card._config, title: current.title });
  }

  if (current.roomMetrics) {
    const space = card._serverCfg?.spaces?.find((item) => item.id === current.space);
    if (!space) throw new Error(`documentation room metrics space is missing: ${current.space}`);
    space.settings = {
      ...(space.settings || {}),
      label_temp: true,
      label_hum: true,
      label_lqi: true,
      label_light: true,
    };
    card._cfgEpoch += 1;
    card._modelCache = null;
  }

  if (current.fixture === 'empty') {
    card._serverCfg = { ...(card._serverCfg || {}), spaces: [] };
    card._cfgEpoch += 1;
    card._modelCache = null;
    card._space = '';
    card._onboardingShown = true;
    card.hass = { ...card.hass, floors: {} };
    card._openSpaceDialog('create');
  }

  if (current.dialog === 'device-info') {
    const device = card._devices.find((item) => item.id === current.deviceId);
    if (!device) throw new Error(`documentation device is missing: ${current.deviceId}`);
    card._infoCard = device;
  }

  card.requestUpdate();
  await card.updateComplete;
  await frame();

  if (current.devicePresentationPreview) {
    const dialog = card.renderRoot.querySelector('hp-dialog');
    const body = dialog?.querySelector('.body');
    const preview = dialog?.querySelector('hp-device-preview');
    await preview?.updateComplete;
    if (!body || !preview)
      throw new Error('documentation device presentation preview is missing');
    const bodyRect = body.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    body.scrollTop += previewRect.top - bodyRect.top - 180;
    await frame();
    const visibleBody = body.getBoundingClientRect();
    const visiblePreview = preview.getBoundingClientRect();
    if (visiblePreview.top < visibleBody.top - 1 || visiblePreview.bottom > visibleBody.bottom + 1)
      throw new Error('documentation viewport does not show the device presentation preview');
  }

  return { dialog: !!card.renderRoot.querySelector('hp-dialog') };
}, scenario);

mkdirSync(OUTPUT, { recursive: true });

const { page, browser } = await launch();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));

try {
  // Свежесть бандла проверяется строго, вместе с версией: картинки обязаны
  // приехать из бандла, собранного из ЭТОГО дерева. А в манифест пишется
  // версионно-нечувствительный отпечаток (#245) — номер версии на скриншотах
  // не виден, и требовать из-за него пересъёмки нечестно.
  await assertFreshDemoBundle(page, ROOT);
  const fingerprint = visualFingerprint(ROOT);
  const scenarios = {};
  for (const scenario of DOC_SCREENSHOTS) {
    await prepareGoldenScenario(page, scenario);
    const runtime = await applyDocumentationState(page, scenario);
    if (scenario.expectDialog && !runtime.dialog)
      throw new Error(`documentation scenario did not open its dialog: ${scenario.id}`);
    const clip = scenario.capture === 'room-card'
      ? await roomCardClip(page)
      : await goldenClip(page, scenario.capture);
    const image = await page.screenshot({
      ...(clip ? { clip } : {}), animations: 'disabled', caret: 'hide', scale: 'css',
    });
    writeFileSync(resolve(OUTPUT, scenario.file), image);
    scenarios[scenario.id] = {
      file: scenario.file,
      viewport: scenario.viewport,
      theme: scenario.theme,
      language: scenario.language,
      sourceSha256: fingerprint,
      imageSha256: sha256(image),
    };
    console.log(`captured ${scenario.id} -> docs/images/${scenario.file}`);
  }
  if (browserErrors.length) throw new Error(`browser errors: ${browserErrors.join(' | ')}`);
  const manifest = {
    version: DOC_SCREENSHOT_VERSION,
    fixture: 'synthetic-only',
    // Кто снимал. Смена браузера переписывает все картинки без содержательных
    // изменений (#246), поэтому окружение съёмки — часть доказательства.
    chromium: browser.version(),
    sourceFingerprint: fingerprint,
    captureScriptSha256: sha256(readFileSync(SCRIPT)),
    command: 'npm run build && node demo/docs/capture.mjs',
    scenarios,
  };
  writeFileSync(resolve(OUTPUT, 'screenshots.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
}
