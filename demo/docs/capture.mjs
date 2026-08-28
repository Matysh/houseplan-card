#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualFingerprint } from '../../scripts/source-fingerprint.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from '../golden/harness.mjs';
import { launch } from '../serve.mjs';
import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from './screenshots.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'docs/images');
const BUNDLE = resolve(ROOT, 'dist/houseplan-card.js');
const DEMO_BUNDLE = resolve(ROOT, 'demo/srv/assets/houseplan-card.js');
const INTEGRATION_BUNDLE = resolve(ROOT, 'custom_components/houseplan/frontend/houseplan-card.js');
const SCRIPT = fileURLToPath(import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/**
 * Перепаковка кадра без потерь (#345).
 *
 * Замер на этом наборе: 2096 КБ превращаются в 1689 КБ, минус 19.4%, и все
 * десять кадров остаются ПИКСЕЛЬНО идентичными — декодированные RGBA совпадают
 * по sha256. Это выбор фильтров строки и уровня сжатия, а не квантование:
 * визуального решения здесь нет вовсе.
 *
 * Почему внутри съёмки, а не отдельным проходом по закоммиченным файлам.
 * Манифест хранит `imageSha256` каждого кадра, поэтому оптимизировать файлы в
 * репозитории руками нельзя — `check-docs` покраснеет; а если жать после
 * подсчёта хешей, следующая же съёмка вернёт неоптимизированные байты.
 *
 * Отсутствие инструмента не ошибка: локальная съёмка и без него полезна для
 * глаз, а приёмка всё равно идёт только из артефакта CI, где `oxipng` стоит
 * пином (`.github/workflows/docs-screenshots.yml`). Но молчать об этом нельзя —
 * байты кадра зависят от того, был ли инструмент, поэтому его версия попадает
 * в манифест рядом с версией браузера, по той же причине.
 */
const oxipngVersion = (() => {
  const probe = spawnSync('oxipng', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.log('oxipng не найден: кадры пишутся как есть, без перепаковки');
    return null;
  }
  return String(probe.stdout || '').trim().split('\n')[0];
})();

/** Пожать файл на месте и вернуть его новые байты. */
const shrinkPng = (path, before) => {
  if (!oxipngVersion) return before;
  const run = spawnSync('oxipng', ['-o', '4', '--strip', 'safe', '--quiet', path]);
  if (run.status !== 0) {
    throw new Error(`oxipng не смог обработать ${path}: код ${run.status}`
      + `${run.stderr ? ` · ${run.stderr}` : ''}`);
  }
  const after = readFileSync(path);
  console.log(`  ${(before.length / 1024).toFixed(0)} КБ -> ${(after.length / 1024).toFixed(0)} КБ`);
  return after;
};


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
copyFileSync(BUNDLE, DEMO_BUNDLE);
copyFileSync(BUNDLE, INTEGRATION_BUNDLE);

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
    const path = resolve(OUTPUT, scenario.file);
    writeFileSync(path, image);
    // Хеш считается ПОСЛЕ перепаковки: манифест обязан описывать те байты,
    // которые лежат на диске, иначе приёмка отвергнет свой же кандидат.
    const stored = shrinkPng(path, image);
    scenarios[scenario.id] = {
      file: scenario.file,
      viewport: scenario.viewport,
      theme: scenario.theme,
      language: scenario.language,
      sourceSha256: fingerprint,
      imageSha256: sha256(stored),
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
    // Чем жали — тоже часть доказательства: без инструмента байты другие.
    oxipng: oxipngVersion,
    sourceFingerprint: fingerprint,
    captureScriptSha256: sha256(readFileSync(SCRIPT)),
    command: 'npm run build && node demo/docs/capture.mjs',
    scenarios,
  };
  writeFileSync(resolve(OUTPUT, 'screenshots.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await browser.close();
}
