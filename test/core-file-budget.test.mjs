import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #425, заменяет #34. Декомпозиция фронтенда идёт попутно и продолжит идти, но
// два ядра всё равно прибавляют по 500–1000 строк за релиз: новое уезжает в
// новые модули, а из старых ничего не уходит. Проект «разложить всё по
// каталогам» не начался за 25 дней и не начнётся; вместо него — потолок,
// который делает рост осознанным.
//
// Правило простое: хочешь добавить в ядро — вынеси столько же. Число в дифе,
// решение в ревью.

// Мера — `split('\n').length`, то есть строки плюс завершающий перевод.
// Та же функция и для потолков, и для измерения: две разные меры разошлись бы
// на единицу, и гейт краснел бы на пустом месте (проверено при написании).
//
// #699 (решение владельца 2026-09-28): полоса вместо точки. Потолок —
// факт на последней бете; задача может вырасти над ним не больше чем на
// CORE_BAND строк, и уменьшение её не красит. Потолки опускает до факта
// релиз-менеджер раз в бету (`node scripts/ratchets.mjs tighten`): пока их
// правила каждая задача, два параллельных ядра конфликтовали на этих числах, а
// задача упиралась в потолок, потому что перед ней влили чужую (#689 после #691).
export const CORE_BAND = 50;

// Потолки. Меняются только вручную и только вместе с объяснением в ревью:
// потолок, который вычисляется от текущего размера, потолком не является.
// С #699 число — факт последней беты: его ставит `ratchets.mjs tighten` на
// кандидате, а строки ниже — история решений, а не расчёт текущего числа.
const CAPS = {
  // #485 adds the View-side subscription/render integration seams; the live
  // model and rendering themselves remain in dedicated modules.
  // #500 moved config/layout identity and the adoption sequence into
  // src/config-adoption.ts; the ratchet keeps that win.
  // 2026-09-11, #534: +1 for `import { keyed }`. The line buys back the 80 ms
  // that #525 put on every space switch, and there is nothing to move out —
  // the render itself did not grow by a character.
  // 2026-09-14, #564: the geometry/index/latch/DOM ownership implementation is
  // isolated in device-hit-owner.ts. These 81 lines are the remaining card
  // lifecycle invalidations and the presentation/action integration seams.
  // 2026-09-23, #624: сняты 112 мёртвых делегатов и полей, которых не читает
  // ни карточка, ни харнесс (реализация живёт в рантайме и зовётся оттуда),
  // 190 неиспользуемых импортов и 9 мёртвых констант — 784 строки. Потолок
  // опущен на выигрыш, запас над фактом три строки.
  // 2026-09-24, #642: диалог «Оптимизировать планы» уехал в
  // src/optimize-plans-dialog.ts — ушли пять делегатов, две стрелки-заглушки,
  // поле фолбэка буфера обмена, дедуп dev-лога и литерал типа состояния,
  // 62 строки. Потолок опущен на выигрыш, запас прежний.
  // 2026-09-27, #676: +2 — вызов черновика лестницы в pointerdown сцены и
  // рамка лестницы в верхнем оверлее (выше тел стен). Всё остальное слоя —
  // жесты, рамка, магнит, диалог — живёт в stairs-editor.ts и stairs-box.ts.
  'src/houseplan-card.ts': 13043,
  // #478 removed the persisted room-draft editor branch. Keep that reduction.
  // #485 keeps its large setup surface in editors/radar-section.ts; these are
  // only the dialog state/save seam and the thin lazy-render adapter.
  // 2026-09-18, #592: разметка четырёх диалогов настроек уехала в
  // src/editors/{marker,space-settings,general-settings,room-settings}-dialog.ts
  // — 1290 строк. Потолок опущен ровно на эту величину (14100 → 12810), запас
  // над фактом остался прежним, три строки: выигрыш зафиксирован, иначе ядро
  // отыграет его обратно первой же правкой диалога.
  // 2026-09-23, #624: снесены мёртвые копии объявлений карточки (warm-boot,
  // LS_*, GLOW_*, debounce, navigate, lruRead — 31 объявление и 6 типов) и
  // 196 неиспользуемых импортов — 400 строк. Потолок опущен на выигрыш.
  // 2026-09-24, #642: диалог «Оптимизировать планы» (превью, запуск,
  // диагностика preflight, разметка) уехал в src/optimize-plans-dialog.ts за
  // узкий порт из 18 членов — 362 строки. Потолок опущен на выигрыш.
  'src/houseplan-editor-runtime.ts': 12024,
};

/**
 * Храповик с полосой (#699): выше `cap + band` не пускает; выигрыш фиксирует
 * бета, а не задача.
 *
 * Вторая половина храповика не исчезла, а переехала: без неё вынос двух тысяч
 * строк ничего не изменит — потолок останется прежним, и ядро дорастёт до него
 * обратно молча. Поэтому `tighten` на каждой бете опускает потолок до факта.
 */
export function coreBudgetViolations(sizes, caps, band = CORE_BAND) {
  const problems = [];
  for (const [file, cap] of Object.entries(caps)) {
    const lines = sizes[file];
    if (typeof lines !== 'number') {
      problems.push({ file, kind: 'missing', text: `${file}: файл не измерен` });
      continue;
    }
    if (lines > cap + band) {
      problems.push({
        file, kind: 'grew', over: lines - cap,
        text: `${file}: ${lines} строк при потолке беты ${cap} — выросло на ${lines - cap}, больше полосы ${band}.`
          + ' Вынесите столько же в отдельный модуль либо поднимите потолок'
          + ' отдельным решением, объяснив его в ревью.',
      });
    }
  }
  return problems;
}

const measure = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').length;

test('ядра не выросли выше потолка беты больше чем на полосу (#699)', () => {
  const sizes = Object.fromEntries(Object.keys(CAPS).map((file) => [file, measure(file)]));
  const problems = coreBudgetViolations(sizes, CAPS);
  assert.deepEqual(problems.map((p) => p.text), [], problems.map((p) => p.text).join('\n'));
});

test('рост выше полосы становится нарушением с числом', () => {
  const [problem] = coreBudgetViolations({ 'a.ts': 1300 }, { 'a.ts': 1000 });
  assert.equal(problem.kind, 'grew');
  assert.equal(problem.over, 300);
  assert.match(problem.text, /выросло на 300, больше полосы 50/);
});

test('#699 уменьшение задачу не красит — потолок опускает бета', () => {
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 700 }, { 'a.ts': 1000 }), []);
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1 }, { 'a.ts': 1000 }), []);
});

test('#699 рост в пределах полосы задачу не красит', () => {
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1000 }, { 'a.ts': 1000 }), []);
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1049 }, { 'a.ts': 1000 }), []);
});

test('#699 границы включительно: ровно потолок плюс полоса нарушением не считается', () => {
  assert.equal(CORE_BAND, 50, 'полоса ядра — решение владельца 2026-09-28');
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1050 }, { 'a.ts': 1000 }), []);
  assert.equal(coreBudgetViolations({ 'a.ts': 1051 }, { 'a.ts': 1000 })[0].kind, 'grew');
});

test('потолки заданы для двух ядер и ни для чего больше', () => {
  assert.deepEqual(Object.keys(CAPS).sort(),
    ['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']);
});

test('потолки — числа в этом файле, а не вычисление от текущего размера', () => {
  // AC4. Потолок, который считается от того, что сейчас на диске, разрешает
  // любой рост и запрещает только уменьшение — то есть работает наоборот.
  const source = readFileSync(new URL('./core-file-budget.test.mjs', import.meta.url), 'utf8');
  const caps = source.slice(source.indexOf('const CAPS'), source.indexOf('};', source.indexOf('const CAPS')));
  assert.match(caps, /'src\/houseplan-card\.ts': \d+/);
  assert.doesNotMatch(caps, /measure|readFileSync|process\.env/);
  for (const problem of coreBudgetViolations({ 'a.ts': 10 }, { 'a.ts': 10 })) {
    assert.fail(`функция обязана принимать потолки аргументом: ${problem.text}`);
  }
});
