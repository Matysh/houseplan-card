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
const pageBenchmarkIsGuarded = (text) => (
  /watchPage\(await [\s\S]*?\.newPage\(\)\)/.test(text)
  && /if \(await reportPageErrors\(\)\)\s*\{?[\s\S]*?process\.exit\(1\)/.test(text)
);

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

test('#421 dedicated guard probe reaches reportPageErrors without finish', () => {
  const probe = readFileSync(
    new URL('../demo/guard/guard_report_page_errors.mjs', import.meta.url), 'utf8',
  );
  assert.match(probe, /await reportPageErrors\(\)/,
    'отрицательная проба обязана пройти через отдельный verdict path');
  assert.doesNotMatch(probe, /\bawait\s+finish\s*\(/,
    'finish() замаскирует сломанный round-trip внутри reportPageErrors()');
});

test('#423 каждый page-benchmark обязан иметь вердикт и динамическую пробу (#430)', () => {
  // Что здесь проверяется, а что — нет.
  //
  // Этот тест — ОБНАРУЖЕНИЕ: он находит benchmark, открывающий страницу
  // Playwright, и требует от него формы гарда и наличия отрицательной пробы.
  // Поведение гарда в рантайме он не доказывает и не может: браузера в job
  // «Фронтенд» нет. Доказывает запуск — `demo/guard/verify-guard.mjs`.
  //
  // До #430 здесь стояли две «отрицательные проверки»: результат
  // `pageBenchmarkIsGuarded(source.replace('watchPage(', '('))` обязан быть
  // false. Но сама функция буквально ищет подстроку `watchPage(` — вырезав её,
  // мы спрашивали регулярку, находит ли она то, что мы только что удалили.
  // Доказано было, что регулярка не пуста. Ровно тот вид проверки, против
  // которого заведён мутационный гейт, и он же — единственная находка аудита
  // v1.71.0-beta.1, где тест был циклическим, а не просто слабым.
  const benchmarks = readdirSync(DEMO)
    .filter((name) => name.startsWith('benchmark_') && name.endsWith('.mjs'))
    .filter((name) => /\.newPage\(/.test(read(name)));
  assert.deepEqual(benchmarks, ['benchmark_backdrop_decode.mjs']);
  const verifier = readFileSync(
    new URL('../demo/guard/verify-guard.mjs', import.meta.url), 'utf8',
  );
  for (const name of benchmarks) {
    const source = read(name);
    assert.equal(pageBenchmarkIsGuarded(source), true, `${name}: missing pageerror guard`);
    assert.match(source, /process\.argv\.includes\('--guard-probe'\)/,
      `${name}: нужен режим отрицательной пробы — без него гард не проверить запуском`);
    assert.match(source, /setTimeout\(\(\) => \{ throw new Error\(/,
      `${name}: проба обязана бросать исключение ВНУТРИ страницы, в хвосте замера`);
    assert.ok(
      new RegExp(`file: '\\.\\./${name}',\\s*\n\\s*args: \\['--guard-probe'\\]`).test(verifier),
      `${name}: нет записи в demo/guard/verify-guard.mjs — проба существует и не вызывается,`
      + ' а это ровно то состояние, в котором #423 прожил до #430',
    );
  }
});
