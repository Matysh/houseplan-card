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
const SLACK = 250;

// Потолки. Меняются только вручную и только вместе с объяснением в ревью:
// потолок, который вычисляется от текущего размера, потолком не является.
const CAPS = {
  'src/houseplan-card.ts': 13659,
  // #478 removed the persisted room-draft editor branch. Keep that reduction.
  'src/houseplan-editor-runtime.ts': 14000,
};

/**
 * Храповик: наверх не пускает, вниз — требует зафиксировать выигрыш.
 *
 * Вторая половина важнее первой. Без неё вынос двух тысяч строк ничего не
 * изменит: потолок останется прежним, и через полгода ядро дорастёт до него
 * обратно — молча и «в рамках бюджета».
 */
export function coreBudgetViolations(sizes, caps, slack = SLACK) {
  const problems = [];
  for (const [file, cap] of Object.entries(caps)) {
    const lines = sizes[file];
    if (typeof lines !== 'number') {
      problems.push({ file, kind: 'missing', text: `${file}: файл не измерен` });
      continue;
    }
    if (lines > cap) {
      problems.push({
        file, kind: 'grew', over: lines - cap,
        text: `${file}: ${lines} строк при потолке ${cap} — выросло на ${lines - cap}.`
          + ' Вынесите столько же в отдельный модуль либо поднимите потолок'
          + ' отдельным решением, объяснив его в ревью.',
      });
    } else if (lines < cap - slack) {
      problems.push({
        file, kind: 'shrank', under: cap - lines,
        text: `${file}: ${lines} строк при потолке ${cap} — на ${cap - lines} меньше.`
          + ' Опустите потолок: незафиксированный выигрыш ядро отыграет обратно.',
      });
    }
  }
  return problems;
}

const measure = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').length;

test('ядра не выросли выше потолка и не опустились ниже него молча', () => {
  const sizes = Object.fromEntries(Object.keys(CAPS).map((file) => [file, measure(file)]));
  const problems = coreBudgetViolations(sizes, CAPS);
  assert.deepEqual(problems.map((p) => p.text), [], problems.map((p) => p.text).join('\n'));
});

test('рост выше потолка становится нарушением с числом', () => {
  const [problem] = coreBudgetViolations({ 'a.ts': 1300 }, { 'a.ts': 1000 });
  assert.equal(problem.kind, 'grew');
  assert.equal(problem.over, 300);
  assert.match(problem.text, /выросло на 300/);
});

test('заметное уменьшение требует опустить потолок', () => {
  const [problem] = coreBudgetViolations({ 'a.ts': 700 }, { 'a.ts': 1000 });
  assert.equal(problem.kind, 'shrank');
  assert.equal(problem.under, 300);
  assert.match(problem.text, /Опустите потолок/);
});

test('изменение в пределах люфта не трогает никого', () => {
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1000 }, { 'a.ts': 1000 }), []);
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 800 }, { 'a.ts': 1000 }), []);
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 751 }, { 'a.ts': 1000 }), []);
});

test('границы включительно: ровно потолок и ровно люфт нарушением не считаются', () => {
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 1000 }, { 'a.ts': 1000 }), []);
  assert.deepEqual(coreBudgetViolations({ 'a.ts': 750 }, { 'a.ts': 1000 }), []);
  assert.equal(coreBudgetViolations({ 'a.ts': 1001 }, { 'a.ts': 1000 })[0].kind, 'grew');
  assert.equal(coreBudgetViolations({ 'a.ts': 749 }, { 'a.ts': 1000 })[0].kind, 'shrank');
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
