#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// #337: a clean CI checkout has no ignored demo bundle. Materialize the whole
// manifest-owned tree before launching Chromium; copying only the stable entry
// leaves every content-hashed import at 404.
import '../../scripts/bundle-sync.mjs';
import { wholePixelClip } from './clip.mjs';
import { visualFingerprint } from '../../scripts/source-fingerprint.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { goldenClip, prepareGoldenScenario } from '../golden/harness.mjs';
import { launch } from '../serve.mjs';
import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from './screenshots.mjs';
import { DETERMINISTIC_ARGS } from './browser-args.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'docs/images');
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
  const settleCamera = async () => {
    const started = performance.now();
    do { await frame(); }
    while (card._cameraTransition?.active && performance.now() - started < 1200);
    if (card._cameraTransition?.active)
      throw new Error(`documentation camera did not settle: ${current.id}`);
    // One quiet pair proves that the settled reactive frame reached layout.
    await frame();
  };

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

  await settleCamera();
  return { dialog: !!card.renderRoot.querySelector('hp-dialog') };
}, scenario);

mkdirSync(OUTPUT, { recursive: true });

// Растеризация закрепляется теми же тремя флагами, что у golden
// (`demo/golden/run.mjs`), и по той же причине — только golden их имел с самого
// начала, а съёмка документации запускалась без единого (#410).
//
// Измерено на dev SHA 184e0098: два прогона канонического workflow на одном и
// том же коммите, одном Chromium 151.0.7922.34 и одном oxipng 10.2.0 дали три
// разошедшихся кадра из десяти (06-device-editor, 08-room-card,
// 09-device-info). Дельта — единицы уровней в RGB на сглаженных границах, alpha
// не менялась: подпись субпиксельного сглаживания, а не изменения продукта.
//
// Аргументы запуска и объяснение каждого — в `browser-args.mjs`: константы
// живут отдельно, чтобы тест мог их прочитать, не поднимая браузер (#424).
// `reducedMotion: 'reduce'` добавлен к `animations: 'disabled'` у самого
// скриншота: первое гасит анимации в CSS, второе — уже начатые переходы на
// момент съёмки.
/**
 * Режим замера стабильности (#410): `node demo/docs/capture.mjs --stability=3`.
 *
 * Отвечает на вопрос, который иначе решается гаданием: плавает ли кадр ВНУТРИ
 * одного состояния страницы или разница копится между подготовками сценария.
 * Для каждого сценария делается N снимков подряд без единой правки состояния, и
 * они сравниваются попиксельно прямо в странице — тем же приёмом, что у golden
 * (`createImageBitmap` + canvas), чтобы не тащить декодер PNG в зависимости.
 *
 * Ничего не пишет на диск и манифест не трогает: это измерение, а не съёмка.
 */
const unstable = [];
const stabilityArg = process.argv.find((arg) => arg.startsWith('--stability'));
const STABILITY_SHOTS = stabilityArg
  ? Math.max(2, Number(stabilityArg.split('=')[1] || 3))
  : 0;

const comparePairs = (target, shots) => target.evaluate(async (base64Shots) => {
  const decode = async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  };
  const read = (bitmap) => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  };
  const frames = await Promise.all(base64Shots.map(async (shot) => {
    const bitmap = await decode(shot);
    return { data: read(bitmap), width: bitmap.width, height: bitmap.height };
  }));
  const first = frames[0];
  return frames.slice(1).map((frame, index) => {
    if (frame.width !== first.width || frame.height !== first.height) {
      return { pair: `1↔${index + 2}`, sizeMismatch: true };
    }
    let pixels = 0;
    let maxDelta = 0;
    let alphaTouched = 0;
    const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    for (let at = 0; at < first.data.length; at += 4) {
      const dr = Math.abs(first.data[at] - frame.data[at]);
      const dg = Math.abs(first.data[at + 1] - frame.data[at + 1]);
      const db = Math.abs(first.data[at + 2] - frame.data[at + 2]);
      const da = Math.abs(first.data[at + 3] - frame.data[at + 3]);
      if (!dr && !dg && !db && !da) continue;
      pixels += 1;
      maxDelta = Math.max(maxDelta, dr, dg, db);
      if (da) alphaTouched += 1;
      const pixel = at / 4;
      const x = pixel % first.width;
      const y = Math.floor(pixel / first.width);
      box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y);
    }
    return {
      pair: `1↔${index + 2}`,
      size: [first.width, first.height],
      pixels,
      maxDelta,
      alphaTouched,
      box: pixels ? box : null,
    };
  });
}, shots.map((shot) => shot.toString('base64')));

const { page, browser } = await launch(
  undefined, undefined, DETERMINISTIC_ARGS, { reducedMotion: 'reduce' },
);
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
    const rawClip = scenario.capture === 'room-card'
      ? await roomCardClip(page)
      : await goldenClip(page, scenario.capture);
    // Обрезка выравнивается по целым пикселям (#410); почему именно так —
    // в `wholePixelClip`. Замер тогда показал, где искать: три снимка подряд в
    // одном состоянии совпадают побайтово у всех десяти сценариев, а между
    // прогонами плавают два. Значит дело не в рендере, а в том, что приходит на
    // вход съёмке — и проверяется это между прогонами (#422).
    const clip = wholePixelClip(rawClip);
    if (STABILITY_SHOTS && rawClip) {
      console.log(`${scenario.id} обрезка: сырая`
        + ` ${rawClip.x},${rawClip.y} ${rawClip.width}x${rawClip.height}`
        + ` → целая ${clip.x},${clip.y} ${clip.width}x${clip.height}`);
    }
    // Два кадра ожидания перед съёмкой — как в golden. `animations: 'disabled'`
    // гасит анимации, но не гарантирует, что уже запланированный ре-рендер
    // успел лечь в композитор до захвата.
    await page.evaluate(() => new Promise((done) => {
      requestAnimationFrame(() => requestAnimationFrame(done));
    }));
    const shotOptions = {
      ...(clip ? { clip } : {}), animations: 'disabled', caret: 'hide', scale: 'css',
    };
    if (STABILITY_SHOTS) {
      const shots = [];
      for (let attempt = 0; attempt < STABILITY_SHOTS; attempt += 1) {
        await page.evaluate(() => new Promise((done) => {
          requestAnimationFrame(() => requestAnimationFrame(done));
        }));
        shots.push(await page.screenshot(shotOptions));
      }
      for (const result of await comparePairs(page, shots)) {
        console.log(`${scenario.id} ${result.pair}: пикселей ${result.pixels}`
          + `, максимум ${result.maxDelta}, alpha ${result.alphaTouched}`
          + (result.box ? `, bbox ${result.box.x0},${result.box.y0}`
            + `..${result.box.x1},${result.box.y1}` : '')
          + `, кадр ${result.size ? result.size.join('x') : '?'}`);
        if (result.pixels || result.sizeMismatch) unstable.push(`${scenario.id} ${result.pair}`);
      }
      continue;
    }
    const image = await page.screenshot(shotOptions);
    const imagePath = resolve(OUTPUT, scenario.file);
    writeFileSync(imagePath, image);
    // Хеш считается ПОСЛЕ перепаковки: манифест обязан описывать те байты,
    // которые лежат на диске, иначе приёмка отвергнет свой же кандидат.
    const stored = shrinkPng(imagePath, image);
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
  if (STABILITY_SHOTS) {
    console.log(`\nзамер стабильности: ${STABILITY_SHOTS} снимка на сценарий, манифест не тронут`);
    if (unstable.length) {
      // Режим — не только диагностика, но и гейт: если кадр снова начнёт зависеть
      // от времени, это должно останавливать съёмку, а не печататься в лог.
      throw new Error(`кадр плавает внутри одного состояния страницы: ${unstable.join(', ')}`);
    }
    console.log('кадр не плавает ни в одном сценарии');
  } else {
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
  }
} finally {
  await browser.close();
}
