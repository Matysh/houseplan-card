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
  assert.equal(workflow.match(/name: card-test-build/g)?.length, 2,
    'один upload и один download тестового дерева для smoke job');
  assert.match(workflow, /name: card-test-build\n\s+path: test-build\//,
    'frontend обязана публиковать созданное npm test дерево test-build');
  assert.match(workflow, /name: card-test-build\n\s+path: test-build(?:\n|\r)/,
    'smoke job обязана восстанавливать test-build в ожидаемый import path');
  // Каждая браузерная job раскладывает скачанный бандл по копиям: без этого
  // стенд читает вчерашний файл, а смок врёт согласованно (#236).
  assert.equal(workflow.match(/node scripts\/bundle-sync\.mjs/g)?.length, 3);
});

test('предполётные проверки не прячут друг друга (#336)', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(
    workflow.indexOf('\n  preflight:\n'), workflow.indexOf('\n  changes:\n'),
  );
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
  for (const job of ['preflight', 'changes', 'frontend']) {
    // '  frontend:' встречается внутри `      frontend: ${{ ... }}` в outputs
    // job `changes`, поэтому имя job ищется только с начала строки.
    const start = workflow.indexOf(`\n  ${job}:\n`);
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

test('гейт «новый код не добавляет any» вызывается в frontend (#342)', () => {
  const workflow = read('validate.yml');
  const frontend = workflow.slice(
    workflow.indexOf('\n  frontend:\n'), workflow.indexOf('\n  smoke:\n'),
  );
  assert.match(frontend, /node scripts\/no-new-any\.mjs --base/,
    'гейт обязан вызываться, иначе долг типизации снова начнёт расти');
  // Гейт diff-aware, поэтому без истории он бессмысленен: на глубине 1
  // merge-base не считается и диапазон выродится в «всё».
  assert.match(frontend, /fetch-depth: 0, filter: 'blob:none'/);
});

test('упавшая golden называет первопричину, а не свидетеля (#386)', () => {
  const workflow = read('validate.yml');
  const golden = workflow.slice(
    workflow.indexOf('\n  golden:\n'), workflow.indexOf('\n  performance_smoke:\n'),
  );
  const KEY = 'fail-golden-${{ needs.reuse.outputs.golden_key }}';
  // Ключ маркера падения обязан совпадать с ключом переиспользования: только
  // это доказывает, что входы у двух падений действительно одни и те же.
  assert.equal(golden.split(KEY).length - 1, 2, 'ключ маркера падения нужен и на restore, и на save');
  assert.equal(golden.includes('reuse-golden-${{ needs.reuse.outputs.golden_key }}'), true,
    'маркер успеха остаётся на своём ключе');

  // Восстановление обязано стоять ДО прогона: после падения различить виновника
  // и свидетеля уже нечем.
  const restore = golden.indexOf('cache/restore@v6');
  const verify = golden.indexOf('npm run golden:verify');
  assert.ok(restore > 0 && verify > restore, 'маркер падения восстанавливается до прогона');

  // Объяснение печатается только при падении и не подменяет вердикт.
  const note = golden.slice(golden.indexOf('id: fail_note'));
  assert.match(note, /^\s+if: failure\(\)$/m, 'шаг объяснения только при падении');
  assert.match(note, /gate-reuse\.mjs --job=golden --note/);
  assert.equal(note.includes('continue-on-error: true\n        run: node scripts/gate-reuse'), false,
    'объяснение не имеет права молча проглатывать свою ошибку до вердикта');

  // Запись первопричины — только на первом падении: иначе SHA съедет на
  // свидетеля и смысл сообщения перевернётся.
  assert.match(golden, /if: failure\(\) && steps\.fail_note\.outputs\.first == 'true'/);
});

test('классификация опирается на завершённый прогон, а не на предыдущий пуш (#387)', () => {
  const workflow = read('validate.yml');
  const changes = workflow.slice(
    workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'),
  );
  // `github.event.before` — источник ложного «уже проверено»: прогон
  // предыдущего пуша штатно отменяется следующим. Классификация читать его
  // больше не имеет права. В процессном гейте он законен: там проверяются
  // трейлеры именно отправленных коммитов, а не объём проверок.
  // `before` остаётся ровно одной проверкой — жив он или переписан (#347).
  // Базой диапазона он больше не служит: его прогон штатно отменяется.
  assert.equal(/base="\$BEFORE_SHA"/.test(changes), false,
    'диапазон не имеет права опираться на голову предыдущего пуша (#387)');
  assert.match(changes, /git cat-file -e "\$BEFORE_SHA"/,
    'защита от force-push остаётся на месте (#347)');
  assert.match(changes, /node scripts\/classify-base\.mjs --head=/);
  assert.match(changes, /actions: read/, 'чтение прогонов требует прав');
  // У PR диапазон задан событием, считать его нечем и незачем.
  assert.match(changes, /if: github\.event_name != 'pull_request'/);
  // На dev классификации нет вовсе — там всё true; шаг там считает базу
  // диапазона для другого потребителя (#388), и это разные выходы.
  assert.match(changes, /dev: без фильтров, всё true/);
  assert.match(changes, /--name=range_base/);
  // Пустая база означает «доказательства нет» и обязана вести к полному
  // прогону, а не к пустому диффу, который выглядел бы как «ничего не менялось».
  const empty = changes.slice(changes.indexOf('if [ -z "$base" ]'));
  assert.match(empty, /frontend=true\\nbackend=true\\nintegration=true/,
    'без базы классификация обязана раскрываться в полный прогон');
});

test('гейты диапазона судят от доказанного предка, а не от предыдущего пуша (#388)', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(
    workflow.indexOf('\n  preflight:\n'), workflow.indexOf('\n  changes:\n'),
  );
  // Оба гейта, судящие сам диапазон коммитов, обязаны читать доказанную базу.
  // Раздельные env у них исторические — важно, что обновлены ОБА.
  assert.equal(
    preflight.match(/BEFORE_SHA: \$\{\{ steps\.range\.outputs\.base \|\| github\.event\.before \}\}/g)?.length,
    2, 'провенанс и процессный гейт читают доказанную базу');
  assert.match(preflight, /--mode=range/);
  // `completed`, а не `success`: нужен факт суда над коммитом, а не
  // оправдательный вердикт. Запрос за success уводил базу на десятки коммитов
  // назад, пока backend на dev был красным по своей причине (#388).
  assert.match(preflight, /-f status=completed/);
  assert.equal(/-f status=success/.test(preflight), false);
  assert.match(preflight, /actions: read/, 'чтение прогонов требует прав');
  assert.match(preflight, /issues: read/, 'проверка 8 читает issue');
  // Считать базу имеет смысл только на пуше в dev: на ветках диапазон и так
  // шире, а у PR он задан событием.
  assert.match(preflight, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev'/);

  // Гейт «новый any» берёт ту же базу, но через выход job changes: свой запрос
  // к API из frontend потребовал бы отдельных прав.
  const frontend = workflow.slice(
    workflow.indexOf('\n  frontend:\n'), workflow.indexOf('\n  smoke:\n'),
  );
  assert.match(frontend, /PROVEN_BASE: \$\{\{ needs\.changes\.outputs\.range_base \}\}/);
  assert.match(frontend, /base="\$\{PROVEN_BASE:-\$BEFORE_SHA\}"/);
  // Ветки и PR не трогаем: там merge-base с dev даёт диапазон ШИРЕ, и подмена
  // его зелёным предком ослабила бы гейт.
  assert.match(frontend, /\[ "\$REF" = "refs\/heads\/dev" \]/);
  assert.match(frontend, /git merge-base origin\/dev "\$HEAD_SHA"/);
});

test('HA-харнесс ставится по точным версиям, а не по воле резолвера (#392)', () => {
  // Плавающие версии означают, что «зелёный backend» значит разное в разные
  // дни: по SHA коммита нельзя сказать, чем его проверяли. Ровно так харнесс
  // полгода тихо проверял интеграцию против февральского Home Assistant.
  for (const file of ['validate.yml', 'mutation-gate.yml']) {
    const workflow = read(file);
    if (!/pytest-homeassistant-custom-component|tests_backend\/requirements\.txt/.test(workflow)) continue;
    assert.match(workflow, /pip install -r tests_backend\/requirements\.txt/,
      `${file}: зависимости харнесса ставятся мимо файла пинов`);
    assert.equal(/pip install pytest /.test(workflow), false,
      `${file}: остался установ без версий`);
  }
});
