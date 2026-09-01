import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #407. Счётчик исключений внутри карточки живёт в demo/serve.mjs, и до этой
// задачи его читала одна функция — finish(). Шесть смоков её не вызывали вовсе:
// у каждого была своя развязка, и ни одна не спрашивала про исключения. То есть
// необработанное исключение во время этих шести проходило незамеченным всегда —
// в лог печаталось `EXC`, а прогон оставался зелёным.
//
// Проверка статическая и грубая: она не доказывает, что вердикт вынесен
// правильно, а доказывает, что его вообще запрашивают. Этого достаточно, потому
// что пропуск здесь молчаливый — а молчаливый пропуск и есть то, что стоит
// ловить механизмом.

const DEMO = fileURLToPath(new URL('../demo/', import.meta.url));
const smokes = () => readdirSync(DEMO)
  .filter((name) => name.startsWith('smoke_') && name.endsWith('.mjs'));
const read = (name) => readFileSync(new URL(name, `file://${DEMO}`), 'utf8');

test('каждый смок спрашивает вердикт по исключениям в карточке (#407)', () => {
  const silent = smokes().filter((name) => {
    const text = read(name);
    return !/\bfinish\s*\(/.test(text) && !/\breportPageErrors\s*\(/.test(text);
  });
  assert.deepEqual(silent, [],
    'смок обязан либо вызвать finish(), либо спросить reportPageErrors():'
    + ' иначе исключение внутри карточки во время него не увидит никто,'
    + ' а `EXC` в логе прогон зелёным быть не мешает (#407)');
});

test('вердикт по исключениям запрашивается после прогона, а не до (#407)', () => {
  // Вызов раньше самих действий бессмысленен: счётчик к тому моменту нулевой.
  // Проверяется дешёвым признаком — вердикт не может быть первым обращением к
  // странице в файле.
  for (const name of smokes()) {
    const text = read(name);
    const verdict = Math.max(text.search(/\breportPageErrors\s*\(/), text.search(/\bawait finish\s*\(/));
    if (verdict < 0) continue;
    const firstAction = text.search(/\b(page|card)\.|\blaunch\s*\(/);
    if (firstAction < 0) continue;
    assert.ok(verdict > firstAction,
      `${name}: вердикт по исключениям запрашивается прежде, чем что-то произошло`);
  }
});

test('вердикт не только выставляет код, но и останавливает смок (#407)', () => {
  // Первый заход этой задачи выставлял только process.exitCode, и отрицательный
  // прогон напечатал «FAILED: 1 uncaught exception» и следом «OK deep-link: …».
  // Код возврата был верным, а вывод — противоречивым; читают же вывод.
  for (const name of smokes()) {
    const text = read(name);
    if (!/\breportPageErrors\s*\(/.test(text)) continue;
    assert.match(text, /if \(await reportPageErrors\(\)\)\s*(process\.exit\(1\)|throw )/,
      `${name}: вердикт по исключениям обязан останавливать смок, а не только`
      + ' помечать его — иначе после «FAILED» печатается строка успеха');
  }
});

test('serve.mjs остаётся единственным владельцем счётчика (#407)', () => {
  // Смок, который завёл бы свой счётчик и свою проверку, вернул бы ровно ту
  // ситуацию, которую задача чинит: у smoke_entry_stale собственный pageErrors
  // существует законно (он и есть предмет проверки), но вердикт всё равно
  // выносит finish().
  const serve = readFileSync(new URL('../demo/serve.mjs', import.meta.url), 'utf8');
  assert.match(serve, /export async function reportPageErrors\(\)/,
    'вердикт стал асинхронным в #404: он ждёт доставки событий страницей');
  assert.equal((serve.match(/_pageErrors\+\+/g) || []).length, 1,
    'счётчик инкрементируется в одном месте — внутри watchPage (#404)');
  const entryStale = read('smoke_entry_stale.mjs');
  assert.match(entryStale, /await finish\(/, 'smoke_entry_stale обязан выносить вердикт');
});
