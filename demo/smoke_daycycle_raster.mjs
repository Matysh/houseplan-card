// #1092 removes the decorative outline; keep the same paired panorama,
// raw traces and ratio ceiling as the #532/#863 observations. This now guards
// an unfiltered paper and the independent safe main-plan layer. Historical
// outline measurements remain in prior reports; elapsed RasterTask is not CPU.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { attestLaunchedBrowser } from '../scripts/browser-attestation.mjs';
import { PAN_STEPS, SAMPLE_ROUNDS, DAYCYCLE_FIXTURE, pairedMeasurementReport } from './helpers/daycycle-measurement.mjs';
import { installDaycycleObservation, observeDaycycleFrames } from './helpers/daycycle-observation.mjs';
import { daycycleEnvironment, beginDaycycleLayers, daycycleLayerNodes, daycycleTraceObservation } from './helpers/daycycle-diagnostics.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

requirePinnedBrowser('#863 daycycle raw paired evidence');
const { page, browser } = await launch({ width: 1400, height: 900 }, 1);
try {
const cdp = await page.context().newCDPSession(page);
const environment = await attestLaunchedBrowser(browser, { reason: '#863 measurement environment', log: () => {} });
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const materialSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const materialTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
const diagnosticEnvironment = await daycycleEnvironment(browser);
const materialClean = !execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--',
  'src', 'demo', 'scripts', 'package.json', 'package-lock.json', 'tsconfig.json', 'rollup.config.mjs'],
{ cwd: ROOT, encoding: 'utf8' }).trim();
let currentMode = null;

const setBackground = async (mode) => {
  await page.evaluate(async (mode) => {
    const card = window.__card;
    card._serverCfg.settings = { ...(card._serverCfg.settings || {}), bg_mode: mode };
    // Пространство со своим bg_mode переопределяет глобальный — снимаем, иначе
    // смок мерил бы не то, что переключил.
    for (const space of card._serverCfg.spaces) {
      space.settings = { ...(space.settings || {}) };
      delete space.settings.bg_mode;
    }
    card.hass = { ...card.hass, states: { ...card.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon',
      attributes: { azimuth: 180, elevation: 40, rising: false },
    } } };
    card._cfgRev = (card._cfgRev || 0) + 1;
    card.requestUpdate();
    await card.updateComplete;
  }, mode);
  // Переход окружения длится 1100 мс: ждём завершения анимации.
  await page.waitForTimeout(1400);
  await page.waitForFunction(mode => {
    const card = window.__card, root = card.shadowRoot;
    const stage = root.querySelector('.stage'), paper = root.querySelector('.hp-paperg');
    return !!paper && stage.classList.contains('daycycle') === (mode === 'daynight')
      && !root.querySelector('.hp-paper-outline-svg')
      && !card._cameraTransition.active
      && [paper, root.querySelector('.hp-paper-outline-svg')].filter(Boolean)
        .every(node => node.getAnimations().every(a => a.playState !== 'running'));
  }, mode, { timeout: 4000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  currentMode = mode;
};

const outlineStyle = () => page.evaluate(() => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const stage = root.querySelector('.stage');
  const outline = root.querySelector('.hp-paper-outline-svg');
  const paper = root.querySelector('.hp-paperg');
  const plan = root.querySelector('.plan-svg');
  if (!paper) return null;
  const style = outline ? getComputedStyle(outline) : null;
  return {
    daycycle: stage.classList.contains('daycycle'),
    safe: stage.classList.contains('hp-safe-daycycle-outline'),
    outlinePresent: !!outline,
    outlineVisibility: style?.visibility || 'hidden',
    filter: style?.filter || 'none',
    willChange: style?.willChange || 'auto',
    paperFilter: getComputedStyle(paper).filter,
    paperWillChange: getComputedStyle(paper).willChange,
    planWillChange: plan ? getComputedStyle(plan).willChange : 'auto',
  };
});

const stageBox = () => page.evaluate(() => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const rect = root.querySelector('.stage').getBoundingClientRect();
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
});

/** Одна панорама с зажатой кнопкой; возвращает суммарный RasterTask в мс. */
const measurePan = async (round, order) => {
  const readyStyle = await outlineStyle();
  const ready = { mode: currentMode, ok: readyStyle?.daycycle === (currentMode === 'daynight')
    && readyStyle?.outlinePresent === false, style: readyStyle };
  const box = await stageBox();
  const marker = `hp-daycycle-${currentMode}-${round}-${order}`;
  await page.evaluate(installDaycycleObservation, { marker });
  const layerNodes = await daycycleLayerNodes(cdp);
  const layerObservation = await beginDaycycleLayers(cdp);
  const startedAt = performance.now();
  const events = [];
  const collect = ({ value }) => events.push(...value);
  cdp.on('Tracing.dataCollected', collect);
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline', 'blink.user_timing'] },
    transferMode: 'ReportEvents',
  });
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Замкнутая восьмёрка возвращает камеру туда, где начала: static и daynight
  // всегда растеризуют один и тот же участок плана, а не постепенно уезжают
  // к краю синтетической сцены.
  for (let step = 1; step <= PAN_STEPS; step += 1) {
    const progress = step / PAN_STEPS;
    await page.mouse.move(
      cx + Math.sin(progress * Math.PI * 2) * 140,
      cy + Math.sin(progress * Math.PI * 4) * 90,
    );
    // Два кадра на шаг: первый ставит кадр в очередь, второй ждёт, пока он
    // действительно отрисуется. Иначе замер считает не работу, а очередь.
    await page.evaluate(observeDaycycleFrames, step);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await complete;
  cdp.off('Tracing.dataCollected', collect);
  let micros = 0, tasks = 0;
  const rasterTasks = [];
  for (const event of events) {
    if (event.name !== 'RasterTask' || event.ph !== 'X' || typeof event.dur !== 'number') continue;
    micros += event.dur;
    tasks += 1;
    rasterTasks.push({ ts: event.ts, dur: event.dur, pid: event.pid, tid: event.tid,
      tts: event.tts ?? null, tdur: event.tdur ?? null, args: event.args ?? null });
  }
  const endedAt = performance.now();
  const pageObservation = await page.evaluate(() => window.__hpDaycycleObservation.stop());
  const layers = await layerObservation.stop();
  return { mode: currentMode, round, order, steps: PAN_STEPS, ready,
    startedAt, endedAt, wallMs: endedAt - startedAt,
    ms: micros / 1000, tasks, rasterTasks,
    diagnostics: { ...daycycleTraceObservation(events, pageObservation, layers), layerNodes } };
};

const out = {};

// 1. Ни исходный, ни уже перемещённый план не создаёт старый контур.
await setBackground('daynight');
const dayStyle = await outlineStyle();
out.dayCycleClassOn = dayStyle?.daycycle === true;
out.dayCycleOutlineRemoved = dayStyle?.outlinePresent === false;
out.idlePaperUnfiltered = dayStyle?.paperFilter === 'none'
  && !/filter/.test(dayStyle?.paperWillChange || '');

await setBackground('static');
const staticStyle = await outlineStyle();
out.staticClassOff = staticStyle?.daycycle === false;
out.staticOutlineAbsent = staticStyle?.outlinePresent === false;
out.staticOutlineUnfiltered = (staticStyle?.filter || 'none') === 'none';
// Статичный фон не платит за чужую подсказку ни слоем, ни памятью.
out.staticOutlineNotPromoted = !/filter/.test(staticStyle?.willChange || '');

// 2. Отношение растеризации на настоящей панораме. Один CDP trace на общем
// GitHub runner иногда ловит короткий всплеск соседнего shard-а. Берём три
// чередующиеся пары и берём медиану их отношений: систематическая регрессия #532
// остаётся во всех трёх daynight-замерах, одиночный выброс — нет.
const staticSamples = [];
const dayCycleSamples = [];
let safeDayStyle = null;
for (let round = 0; round < SAMPLE_ROUNDS; round += 1) {
  staticSamples.push(await measurePan(round, round * 2));
  await setBackground('daynight');
  safeDayStyle = await outlineStyle();
  dayCycleSamples.push(await measurePan(round, round * 2 + 1));
  if (round < SAMPLE_ROUNDS - 1) await setBackground('static');
}
out.cameraKeepsSafePlanLayer = safeDayStyle?.safe === true;
out.dayCycleOutlineRemainsAbsent = safeDayStyle?.outlinePresent === false;
out.dayCycleOutlineNotPromoted = !/filter/.test(safeDayStyle?.willChange || '');
out.dayCyclePaperStaysUnfiltered = (safeDayStyle?.paperFilter || 'none') === 'none'
  && !/filter/.test(safeDayStyle?.paperWillChange || '');
// #689: the explicit scene layer is an opacity hint; a transform hint would
// freeze its raster scale after a zoom.
out.safePlanLayerIsExplicit = (safeDayStyle?.planWillChange || '') === 'opacity';

out.rasterTasksObserved = [...staticSamples, ...dayCycleSamples].every((sample) => sample.tasks > 0);
const report = pairedMeasurementReport({ materialSha, materialClean, environment,
  materialTree, diagnosticEnvironment, fixture: DAYCYCLE_FIXTURE, staticSamples, dayCycleSamples });
out.measurementValid = report.measurementValid;
out.rasterRatioWithinBudget = report.rasterRatioWithinBudget;
const ciName = [process.env.GITHUB_RUN_ID || 'ci', process.env.GITHUB_RUN_ATTEMPT || '0',
  process.env.GITHUB_JOB || 'job', process.pid].join('-').replace(/[^A-Za-z0-9_-]/g, '_');
const reportArg = process.argv.find(arg => arg.startsWith('--report='))?.slice(9)
  || (process.env.CI ? `artifacts/diagnostics/863/daycycle-${ciName}.json` : null);
if (reportArg) {
  if (!/^artifacts\/diagnostics\/863\/[A-Za-z0-9_-]+\.json$/.test(reportArg)) throw new Error('report must be an own artifacts/diagnostics/863 JSON path');
  const path = resolve(ROOT, reportArg); mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
// Full raw samples survive CI in the smoke log; --report also saves standalone JSON.
console.log(JSON.stringify(report));

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
} finally {
  await browser.close();
}
