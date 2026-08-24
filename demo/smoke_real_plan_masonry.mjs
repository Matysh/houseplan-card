// Кладка реального плана не должна прерываться (#285).
//
// Зачем это отдельно от golden и от синтетических фикстур. Восемь задач подряд
// (#271, #272, #275, #276, #277, #278, #279, #280) прошли ТЗ, ревью, golden и
// смоки — и разрыв кладки на реальном плане владельца остался. У всех восьми
// критерии приёмки стояли на синтетике: «cell-5 mixed-depth T», «прямоугольный
// T с тремя равными полутолщинами». На ней фиксы работают.
//
// Здесь проверяется другое: берётся геометрия настоящего этажа и спрашивается
// единственное — есть ли кладка там, где по модели она обязана быть. Ответ даёт
// сам продукт через `isPointInFill` на пути стены, поэтому проверка не зависит
// ни от разрешения, ни от порогов пиксельного сравнения, которые этот класс
// дефектов пропускают.
//
// В фикстуре намеренно нет проёмов: тогда правило не требует никакой
// бухгалтерии — КАЖДАЯ точка на осевой линии ребра комнаты обязана лежать
// внутри кладки.
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const FIXTURE = new URL('../test/fixtures/real-plan-second-floor.json', import.meta.url);
const { space } = JSON.parse(readFileSync(FIXTURE, 'utf8'));

/**
 * Признанный долг beta.9, ведётся в #284 вместе с #271/#275.
 *
 * Четыре разрыва — это две стены, посчитанные с двух сторон каждой общей пары:
 * «Элина | Холл» и «Холл | Кабинет» в исходных названиях.
 *
 * 45.25 шага на разрыв — не случайное число. В узле сходятся наружная стена
 * 30 см, выступ 30 см и луч длиной ВСЕГО 5 шагов. Для 30 см полутолщина 15
 * шагов, `MITRE_LIMIT = 4`, радиус коридора 4 × 15 = 60 шагов, и из соседней
 * стены 20 см вырезается 60 − 15 = 45. Совпадение с измерением показывает, что
 * съедает кладку именно коридор стыка.
 *
 * Числа проверяются точно. Станет лучше — тест потребует их обновить и тем
 * самым докажет улучшение; станет хуже — поймает регрессию.
 */
const KNOWN_GAP_COUNT = 4;
const KNOWN_GAP_STEPS = 181;

const { page, browser } = await launch();
const out = {};

const measured = await page.evaluate(async (space) => {
  const card = window.__card;
  card._serverCfg = { spaces: [space], markers: [], settings: {} };
  card._cfgEpoch = (card._cfgEpoch || 0) + 1;
  card._modelCache = null;
  card._space = space.id;
  card._setMode?.('view');
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((done) => setTimeout(done, 250));
  card._fitAll?.();
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((done) => setTimeout(done, 250));

  const root = card.shadowRoot || card.renderRoot;
  const wall = root.querySelector('[data-hp="wall"]');
  if (!wall?.isPointInFill) return { error: 'wall path not found' };

  const NORM = 1000;
  const height = card._spaceH || NORM;
  const at = (x, y) => new DOMPoint(x * NORM, y * height);
  const STEP = 1 / 240;
  // Шаг выборки — четверть шага решётки: мельче любого осмысленного разрыва и
  // достаточно грубо, чтобы прогон оставался быстрым.
  const SAMPLE = STEP / 4;

  const gaps = [];
  let sampled = 0;
  let missing = 0;
  for (const room of space.rooms) {
    const poly = room.poly;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const count = Math.max(2, Math.round(length / SAMPLE));
      let runStart = null;
      for (let k = 0; k <= count; k++) {
        const t = k / count;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        sampled++;
        const solid = wall.isPointInFill(at(x, y));
        if (!solid) {
          missing++;
          if (runStart === null) runStart = t;
        } else if (runStart !== null) {
          gaps.push({ room: room.id, edge: i, steps: (t - runStart) * length / STEP });
          runStart = null;
        }
      }
      if (runStart !== null) {
        gaps.push({ room: room.id, edge: i, steps: (1 - runStart) * length / STEP });
      }
    }
  }
  const worst = gaps.slice().sort((x, y) => y.steps - x.steps).slice(0, 5);
  return {
    sampled,
    missing,
    gapCount: gaps.length,
    totalGapSteps: gaps.reduce((sum, g) => sum + g.steps, 0),
    worst,
  };
}, space);

console.log(JSON.stringify(measured, null, 2));
out.wallPathFound = !measured.error;
out.sampledEnough = measured.sampled > 5000;
out.gapCountMatchesKnownDebt = measured.gapCount === KNOWN_GAP_COUNT;
out.gapLengthMatchesKnownDebt = Math.abs(measured.totalGapSteps - KNOWN_GAP_STEPS) < 1;
if (!out.gapCountMatchesKnownDebt || !out.gapLengthMatchesKnownDebt) {
  console.log(`Долг изменился: было ${KNOWN_GAP_COUNT} разрывов на ${KNOWN_GAP_STEPS} шага,`
    + ` стало ${measured.gapCount} на ${measured.totalGapSteps.toFixed(2)}.`
    + ' Меньше — обновите числа и приложите прогон; больше — это регрессия.');
}
checkAll(out);
await finish(browser, out);
