import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #336. Воркфлоу — не текст, а контракт, и ломается он молча: висячая
// зависимость `needs` не роняет YAML, а просто навсегда пропускает job, и
// «зелёный Validate» начинает значить меньше, чем значил. Здесь закреплены
// свойства, которые нельзя увидеть в диффе строк.

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const read = (name) => readFileSync(new URL(name, `file://${WORKFLOWS}`), 'utf8');

/**
 * Разбор без yaml-зависимости: имена job — ключи на двух пробелах, значения
 * `needs` берутся строкой. Полноценный парсер здесь был бы лишней зависимостью
 * ради двух форм записи, которые в этом репозитории и используются.
 */
const jobsOf = (text) => {
  const body = text.slice(text.indexOf('\njobs:'));
  const names = [...body.matchAll(/^ {2}([a-zA-Z0-9_-]+):$/gm)].map((match) => match[1]);
  const needs = new Map();
  for (const name of names) {
    const start = body.indexOf(`\n  ${name}:\n`);
    const next = names
      .map((other) => body.indexOf(`\n  ${other}:\n`))
      .filter((index) => index > start);
    const chunk = body.slice(start, next.length ? Math.min(...next) : body.length);
    const line = chunk.match(/^ {4}needs:\s*(.+)$/m)?.[1] || '';
    needs.set(name, [...line.matchAll(/[a-zA-Z0-9_-]+/g)].map((match) => match[0]));
  }
  return { names, needs };
};

test('ни один воркфлоу не зависит от несуществующей job (#336)', () => {
  for (const file of readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'))) {
    const { names, needs } = jobsOf(read(file));
    assert.ok(names.length, `${file}: не нашлось ни одной job — проверьте разбор`);
    for (const [job, list] of needs) {
      for (const dependency of list) {
        assert.ok(names.includes(dependency),
          `${file}: job ${job} зависит от несуществующей ${dependency}`);
      }
    }
  }
});

test('бандл собирается один раз и приезжает браузерным job артефактом (#336)', () => {
  const workflow = read('validate.yml');
  // Сборка ровно в одном месте. Пять сборок одного и того же бандла — это
  // ~10 джобо-минут на каждом непереиспользованном прогоне.
  const builds = [...workflow.matchAll(/^ +run: npm run (build|bundle:sync)$/gm)];
  assert.equal(builds.length, 1, 'бандл должен собираться ровно в одной job');
  assert.equal(workflow.match(/name: card-bundle/g)?.length, 4,
    'один upload и три download артефакта бандла');
  // Каждая браузерная job раскладывает скачанный бандл по копиям: без этого
  // стенд читает вчерашний файл, а смок врёт согласованно (#236).
  assert.equal(workflow.match(/node scripts\/bundle-sync\.mjs/g)?.length, 3);
});

test('предполётные проверки не прячут друг друга (#336)', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(workflow.indexOf('  preflight:'), workflow.indexOf('  changes:'));
  for (const id of ['docs', 'workflow_sync', 'provenance', 'process_gate']) {
    assert.ok(preflight.includes(`id: ${id}`), `нет шага ${id}`);
    assert.ok(preflight.includes(`steps.${id}.outcome`), `вердикт не читает ${id}`);
  }
  // Слияние джоб не имеет права превратить четыре независимых сигнала в один
  // «первый упавший»: иначе автор узнаёт о втором нарушении следующим кругом.
  assert.equal(preflight.match(/continue-on-error: true/g)?.length, 4);
  assert.ok(preflight.includes('exit $fail'), 'вердикт обязан падать сам');
});

test('джобы с полной историей качают её без блобов (#345)', () => {
  const workflow = read('validate.yml');
  // Полный клон — 215 МБ .git, blobless — 26 МБ, история и теги в обоих полные
  // (замер в #345). Обе эти job читают сообщения коммитов и ИМЕНА изменённых
  // файлов; содержимое старых ревизий им не нужно ни на одном шаге.
  for (const job of ['preflight', 'changes']) {
    const start = workflow.indexOf(`  ${job}:`);
    assert.ok(start > 0, `нет job ${job}`);
    const chunk = workflow.slice(start, start + 1400);
    assert.match(chunk, /fetch-depth: 0, filter: 'blob:none'/,
      `${job} обязана качать историю без блобов`);
  }
  // Обратная сторона: --depth=1 сюда подставлять нельзя. Он того же размера, но
  // без merge-base, а на нём стоят процессный гейт, smoke-select и каждый
  // диапазон origin/dev..HEAD.
  assert.equal(workflow.includes('fetch-depth: 1'), false,
    'shallow-клон ломает merge-base: диапазоны и процессный гейт перестают работать');
});
