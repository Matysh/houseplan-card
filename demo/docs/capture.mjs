#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../../scripts/source-fingerprint.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from '../golden/harness.mjs';
import { launch } from '../serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'docs/images');
const BUNDLE = resolve(ROOT, 'dist/houseplan-card.js');
const DEMO_BUNDLE = resolve(ROOT, 'demo/srv/assets/houseplan-card.js');
const INTEGRATION_BUNDLE = resolve(ROOT, 'custom_components/houseplan/frontend/houseplan-card.js');
const SCRIPT = fileURLToPath(import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const DOC_SCREENSHOT_VERSION = 1;
export const DOC_SCREENSHOTS = Object.freeze([
  {
    id: 'view-desktop', file: '01-view-desktop.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'view-touch', file: '02-view-touch.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true, kiosk: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 390, height: 760 }, capture: 'page',
  },
  {
    id: 'space-create', file: '03-space-create.png', fixture: 'empty', noFloors: true,
    title: 'House Plan', language: 'en', theme: 'dark',
    viewport: { width: 900, height: 850 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'room-contour-close', file: '04-room-contour-close.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'plan',
    wallJunctionPreview: {
      path: [[0.18, 0.18], [0.40, 0.18], [0.40, 0.40], [0.18, 0.40]],
      pointer: [0.18, 0.18], cms: [440, 440, 440], cm: 15,
    },
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'plan-context-tray', file: '05-plan-context-tray.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'plan', editorTray: 'plan-selection',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'device-editor', file: '06-device-editor.png', fixture: 'visual',
    space: 'golden-lighting', dialog: 'device', deviceId: 'golden-light-two',
    deviceName: 'Living-room ceiling light',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 1100 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'device-display-preview', file: '06-device-display-preview.png', fixture: 'visual',
    space: 'golden-lighting', dialog: 'device', deviceId: 'golden-light-two',
    deviceName: 'Living-room ceiling light', devicePresentationPreview: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 1100 }, capture: 'page', expectDialog: true,
  },
  {
    id: 'background-editor', file: '07-background-editor.png', fixture: 'visual',
    space: 'golden-geometry', mode: 'decor', editorTray: 'decor-selection',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'page',
  },
  {
    id: 'room-card', file: '08-room-card.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', roomMetrics: true,
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1180, height: 900 }, capture: 'room-card',
  },
  {
    id: 'device-info', file: '09-device-info.png', fixture: 'visual',
    space: 'golden-lighting', mode: 'view', dialog: 'device-info',
    deviceId: 'golden-light-two', deviceName: 'Living-room ceiling light',
    title: 'House Plan — synthetic home', language: 'en', theme: 'dark',
    viewport: { width: 1000, height: 900 }, capture: 'page', expectDialog: true,
  },
]);

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

mkdirSync(OUTPUT, { recursive: true });
copyFileSync(BUNDLE, DEMO_BUNDLE);
copyFileSync(BUNDLE, INTEGRATION_BUNDLE);

const { page, browser } = await launch();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));

try {
  const fingerprint = await assertFreshDemoBundle(page, ROOT);
  const scenarios = {};
  for (const scenario of DOC_SCREENSHOTS) {
    const runtime = await prepareGoldenScenario(page, scenario);
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
    sourceFingerprint: fingerprint,
    captureScriptSha256: sha256(readFileSync(SCRIPT)),
    command: 'npm run docs:capture',
    scenarios,
  };
  writeFileSync(resolve(OUTPUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
}
