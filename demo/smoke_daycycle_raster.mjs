// Стоимость растеризации дневного цикла — свидетель #532.
//
// Владелец: «в Firefox план тормозит; со статичным цветом фона тормоза
// пропадают». Профиль подтвердил: наш JS спал 89 % времени, а в GPU-процессе
// на кадр уезжало 23 МБ текстур. Виновником оказалась не сцена плана, а
// тройной drop-shadow внешнего контура. После #582 alpha-силуэт живёт в
// отдельном stage-sized SVG: это по-прежнему собственный промотированный слой,
// но уже не координатно огромная внутренняя .hp-paperg.
//
// Смок проверяет две вещи, и вторая — не время, а ОТНОШЕНИЕ: абсолютные
// миллисекунды зависят от машины и раннера. Три пары замеров идут в одном
// процессе, на одной странице и чередуют static/daynight; медиана парных
// отношений отбрасывает единичный шум соседних mutation-шардов, не ослабляя
// бюджет.
//
// Замер аналитики на панораме демо-стенда: 7.9 без подсказки, 0.26 с ней.
// Порог 2.0 стоит примерно посередине по логарифму и даёт запас в обе стороны.
//
// Движок здесь Chromium — он же движок CI и golden. Приговор по Gecko даёт
// профиль Firefox с машины владельца: подсказка это совет движку, и Gecko
// вправе отклонить её по бюджету памяти (layout.css.will-change.budget).
// Смок нужен не вместо того профиля, а чтобы правку нельзя было молча снять.
import { launch, check, finish } from './serve.mjs';

const PAN_STEPS = 60;
const SAMPLE_ROUNDS = 3;
const RATIO_CEILING = 2.0;

const { page, browser } = await launch({ width: 1400, height: 900 }, 1);
const cdp = await page.context().newCDPSession(page);

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
  // Переход фильтра длится 1100 мс: замер до его конца мерил бы анимацию.
  await page.waitForTimeout(1400);
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
const measurePan = async () => {
  const box = await stageBox();
  const events = [];
  const collect = ({ value }) => events.push(...value);
  cdp.on('Tracing.dataCollected', collect);
  await cdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline'] },
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
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await complete;
  cdp.off('Tracing.dataCollected', collect);
  let micros = 0, tasks = 0;
  for (const event of events) {
    if (event.name !== 'RasterTask' || event.ph !== 'X' || typeof event.dur !== 'number') continue;
    micros += event.dur;
    tasks += 1;
  }
  return { ms: micros / 1000, tasks };
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const out = {};

// 1. Подсказка стоит там и только там, где стоит фильтр.
await setBackground('daynight');
const dayStyle = await outlineStyle();
out.dayCycleClassOn = dayStyle?.daycycle === true;
out.dayCycleOutlinePresent = dayStyle?.outlinePresent === true;
out.idleUsesHistoricalPaperFilter = dayStyle?.safe === false
  && dayStyle?.outlineVisibility === 'hidden'
  && /drop-shadow/.test(dayStyle?.paperFilter || '')
  && /filter/.test(dayStyle?.paperWillChange || '');

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
  staticSamples.push(await measurePan());
  await setBackground('daynight');
  safeDayStyle = await outlineStyle();
  dayCycleSamples.push(await measurePan());
  if (round < SAMPLE_ROUNDS - 1) await setBackground('static');
}
out.cameraUsesSafeOutline = safeDayStyle?.safe === true
  && safeDayStyle?.outlineVisibility === 'visible';
out.dayCycleOutlineFiltered = /drop-shadow/.test(safeDayStyle?.filter || '');
out.dayCycleOutlinePromoted = /filter/.test(safeDayStyle?.willChange || '');
out.dayCyclePaperStaysUnfiltered = (safeDayStyle?.paperFilter || 'none') === 'none'
  && !/filter/.test(safeDayStyle?.paperWillChange || '');
out.safePlanLayerIsExplicit = /transform/.test(safeDayStyle?.planWillChange || '');

out.rasterTasksObserved = [...staticSamples, ...dayCycleSamples].every((sample) => sample.tasks > 0);
const staticMedianMs = median(staticSamples.map((sample) => sample.ms));
const dayCycleMedianMs = median(dayCycleSamples.map((sample) => sample.ms));
const pairedRatios = dayCycleSamples.map((sample, index) => (
  staticSamples[index].ms > 0 ? sample.ms / staticSamples[index].ms : Infinity
));
const ratio = median(pairedRatios);
out.rasterRatioWithinBudget = ratio <= RATIO_CEILING;

console.log(JSON.stringify({
  staticSamples: staticSamples.map((sample) => ({
    ms: Number(sample.ms.toFixed(1)), tasks: sample.tasks,
  })),
  dayCycleSamples: dayCycleSamples.map((sample) => ({
    ms: Number(sample.ms.toFixed(1)), tasks: sample.tasks,
  })),
  staticMedianMs: Number(staticMedianMs.toFixed(1)),
  dayCycleMedianMs: Number(dayCycleMedianMs.toFixed(1)),
  pairedRatios: pairedRatios.map((value) => Number(value.toFixed(2))),
  ratio: Number(ratio.toFixed(2)), ceiling: RATIO_CEILING,
}, null, 1));

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
