// Стоимость растеризации дневного цикла — свидетель #532.
//
// Владелец: «в Firefox план тормозит; со статичным цветом фона тормоза
// пропадают». Профиль подтвердил: наш JS спал 89 % времени, а в GPU-процессе
// на кадр уезжало 23 МБ текстур. Виновником оказалась не сцена плана, а
// тройной drop-shadow внешнего контура: группа .hp-paperg несёт одни бумажные
// силуэты и при ховере и панораме не меняется, но фильтр жил в общем слое
// плана — и каждая перерисовка плана заново прогоняла три прохода размытия по
// габариту всего листа. Лечится одной подсказкой will-change: filter, которая
// уводит отфильтрованную бумагу в свой композиционный слой.
//
// Смок проверяет две вещи, и вторая — не время, а ОТНОШЕНИЕ: абсолютные
// миллисекунды зависят от машины и раннера, отношение «дневной цикл к
// статичному фону» — нет. Оба замера идут в одном процессе, на одной странице,
// подряд, поэтому делят между собой и прогрев, и загрузку машины.
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
  const group = root.querySelector('.hp-paperg');
  if (!group) return null;
  const style = getComputedStyle(group);
  return {
    daycycle: stage.classList.contains('daycycle'),
    filter: style.filter,
    willChange: style.willChange,
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
  for (let step = 0; step < PAN_STEPS; step += 1) {
    await page.mouse.move(cx + Math.sin(step / 6) * 140, cy + Math.cos(step / 9) * 90);
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

const out = {};

// 1. Подсказка стоит там и только там, где стоит фильтр.
await setBackground('daynight');
const dayStyle = await outlineStyle();
out.dayCycleClassOn = dayStyle?.daycycle === true;
out.dayCycleOutlineFiltered = /drop-shadow/.test(dayStyle?.filter || '');
out.dayCycleOutlinePromoted = /filter/.test(dayStyle?.willChange || '');

await setBackground('static');
const staticStyle = await outlineStyle();
out.staticClassOff = staticStyle?.daycycle === false;
out.staticOutlineUnfiltered = (staticStyle?.filter || 'none') === 'none';
// Статичный фон не платит за чужую подсказку ни слоем, ни памятью.
out.staticOutlineNotPromoted = !/filter/.test(staticStyle?.willChange || '');

// 2. Отношение растеризации на настоящей панораме.
const staticPan = await measurePan();
await setBackground('daynight');
const dayPan = await measurePan();

out.rasterTasksObserved = staticPan.tasks > 0 && dayPan.tasks > 0;
const ratio = staticPan.ms > 0 ? dayPan.ms / staticPan.ms : Infinity;
out.rasterRatioWithinBudget = ratio <= RATIO_CEILING;

console.log(JSON.stringify({
  staticPanMs: Number(staticPan.ms.toFixed(1)), staticPanTasks: staticPan.tasks,
  dayCyclePanMs: Number(dayPan.ms.toFixed(1)), dayCyclePanTasks: dayPan.tasks,
  ratio: Number(ratio.toFixed(2)), ceiling: RATIO_CEILING,
}, null, 1));

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
