import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  assert.match(empty, /node scripts\/classify-changes\.mjs --all >> "\$GITHUB_OUTPUT"/,
    'без базы классификация обязана раскрываться в полный прогон');
});

test('перф-смок добавляет профиль ровно при своём выходе changes (#473 AC3)', () => {
  const workflow = read('validate.yml');
  const changes = workflow.slice(workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'));
  assert.match(changes, /perf_iso: \$\{\{ steps\.classify\.outputs\.perf_iso \}\}/);
  assert.match(changes, /perf_interaction: \$\{\{ steps\.classify\.outputs\.perf_interaction \}\}/);
  // Выходы пишет скрипт, а не inline-shell: решение проверяется unit-тестом
  // (AC8); #492 §5.2 — тот же вывод читается и для summary неизвестных входов.
  assert.match(changes, /printf '%s\\n' "\$files" \| node scripts\/classify-changes\.mjs > \/tmp\/classify\.out/);
  assert.match(changes, /tee -a "\$GITHUB_OUTPUT" < \/tmp\/classify\.out/);
  assert.match(changes, /unknown_inputs: \$\{\{ steps\.classify\.outputs\.unknown_inputs \}\}/);
  assert.match(changes, /sed -n 's\/\^unknown_inputs=\/\/p' \/tmp\/classify\.out/);
  assert.match(changes, /Неизвестные входы \(#492\)/);
  // Все три fallback-а «без классификации» идут через тот же скрипт с --all:
  // новый выход не может выпасть из fallback-а.
  const fallbacks = changes.split('node scripts/classify-changes.mjs --all >> "$GITHUB_OUTPUT"').length - 1;
  assert.equal(fallbacks, 3, 'fallback-и классификатора раскрываются через --all');
  assert.ok(!changes.includes("printf 'frontend=true"), 'ручной список выходов в fallback-е запрещён');

  const start = workflow.indexOf('\n  performance_smoke:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  backend:\n', start));
  assert.match(job, /needs: \[changes, frontend, reuse\]/);
  const iso = job.slice(job.indexOf('Изометрический профиль по диффу'), job.indexOf('Профиль взаимодействия по диффу'));
  assert.match(iso, /if: needs\.changes\.outputs\.perf_iso == 'true'/);
  assert.match(iso, /--profile=large-house-isometric-v1 --samples=3 --warmups=1/);
  assert.match(iso, /--absolute-only --budgets=demo\/performance\/budgets-isometric-smoke\.json/);
  const interaction = job.slice(job.indexOf('Профиль взаимодействия по диффу'), job.indexOf('#330 AC7'));
  assert.match(interaction, /if: needs\.changes\.outputs\.perf_interaction == 'true'/);
  assert.match(interaction, /--profile=large-house-interaction-v1 --samples=3 --warmups=1/);
  assert.match(interaction, /--absolute-only --budgets=demo\/performance\/budgets-interaction-smoke\.json/);
  // Glow-профили остаются безусловными.
  const glow = job.slice(job.indexOf('Capture the heaviest Glow state'), job.indexOf('Enforce absolute smoke ceilings'));
  assert.ok(!/\n\s+if:/.test(glow), 'glow-профили гоняются всегда');
});

test('ключ reuse перф-смока различает наборы профилей (#473 AC5)', () => {
  const workflow = read('validate.yml');
  const reuse = workflow.slice(workflow.indexOf('\n  reuse:\n'), workflow.indexOf('\n  hacs:\n'));
  assert.match(reuse, /needs: changes/);
  assert.match(reuse, /PERF_ISO: \$\{\{ needs\.changes\.outputs\.perf_iso \}\}/);
  assert.match(reuse, /PERF_INTERACTION: \$\{\{ needs\.changes\.outputs\.perf_interaction \}\}/);
  assert.match(reuse, /\[ "\$PERF_ISO" = "true" \] && set="\$set-iso"/);
  assert.match(reuse, /\[ "\$PERF_INTERACTION" = "true" \] && set="\$set-interaction"/);
  assert.match(reuse, /performance_smoke_set: \$\{\{ steps\.keys\.outputs\.performance_smoke_set \}\}/);
  // Набор входит и в маркер-lookup, и в маркер-save: расхождение ключей
  // означало бы, что маркер пишется под именем, которого никто не ищет.
  const lookup = 'reuse-performance_smoke-${{ steps.keys.outputs.performance_smoke }}-${{ steps.keys.outputs.performance_smoke_set }}';
  const save = 'reuse-performance_smoke-${{ needs.reuse.outputs.performance_smoke_key }}-${{ needs.reuse.outputs.performance_smoke_set }}';
  assert.ok(reuse.includes(lookup), 'lookup-ключ без набора профилей');
  assert.ok(workflow.includes(save), 'save-ключ без набора профилей');
  assert.ok(!workflow.includes('reuse-performance_smoke-${{ needs.reuse.outputs.performance_smoke_key }}\n'),
    'старый save-ключ без набора остался');
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

/** Ставит ли workflow python-зависимости — по собственному содержимому.
 *
 *  #399: раньше проверка перебирала два имени и молча пропускала файл, где
 *  не нашлось ни имени пакета, ни пути к пинам. Обе зацепки исчезают разом
 *  при возврате к `pip install pytest …`, то есть гейт выключался ровно тем
 *  изменением, ради которого заведён. Признак теперь положительный: есть
 *  установка python-пакетов — файл обязан ставить их из файла пинов. */
const installsPythonDeps = (workflow) => /(?:^|\s)(?:python -m )?pip\s+install\s/.test(workflow);

/** Нарушения пин-контракта в КАТАЛОГЕ workflow-файлов (#399).
 *
 *  Каталог — параметр, а не константа: только так тест может исполнить ту же
 *  функцию на подставном каталоге и доказать, что она ловит третий файл.
 *  Проверка предиката на строковых литералах этого не доказывает — сам обход
 *  при этом не исполняется и может остаться списком имён (замечание r1).
 */
export function pinViolations(directory) {
  const files = readdirSync(directory).filter((name) => name.endsWith('.yml'));
  const problems = [];
  let installers = 0;
  for (const file of files) {
    const workflow = readFileSync(new URL(file, `file://${directory}`), 'utf8');
    if (!installsPythonDeps(workflow)) continue;
    installers += 1;
    if (!/pip install -r tests_backend\/requirements\.txt/.test(workflow)) {
      problems.push(`${file}: ставит python-зависимости мимо файла пинов`);
    }
    if (/pip install pytest /.test(workflow)) {
      problems.push(`${file}: остался установ без версий`);
    }
  }
  return { problems, installers, scanned: files.length };
}

test('HA-харнесс ставится по точным версиям, а не по воле резолвера (#392, #399)', () => {
  // Плавающие версии означают, что «зелёный backend» значит разное в разные
  // дни: по SHA коммита нельзя сказать, чем его проверяли. Ровно так харнесс
  // полгода тихо проверял интеграцию против февральского Home Assistant.
  const { problems, installers, scanned } = pinViolations(WORKFLOWS);
  assert.deepEqual(problems, []);
  assert.ok(scanned >= 2, 'каталог workflows обязан читаться');
  // Факт выводится проверкой, а не задаётся ей.
  assert.ok(installers > 0,
    'ни один workflow не ставит python-зависимости — либо каталог прочитан'
    + ' неверно, либо бэкенд-гейт исчез; и то и другое стоит увидеть');
});

test('#399 AC5: тот же код ловит третий workflow в подставном каталоге', () => {
  // Доказательство исполнением, а не рассуждением: строится настоящий
  // каталог из трёх файлов, и вызывается ТА ЖЕ функция. Если обход вернётся
  // к списку имён, третий файл в него не попадёт и тест покраснеет — что и
  // отличает эту проверку от прежней, гонявшей предикат на литералах.
  const directory = mkdtempSync(join(tmpdir(), 'hp-workflows-'));
  try {
    writeFileSync(join(directory, 'validate.yml'),
      'jobs:\n  backend:\n    steps:\n      - run: pip install -r tests_backend/requirements.txt\n');
    writeFileSync(join(directory, 'docs.yml'),
      'jobs:\n  build:\n    steps:\n      - run: npm ci\n');
    writeFileSync(join(directory, 'zz-rogue.yml'),
      'jobs:\n  backend:\n    steps:\n      - run: pip install pytest voluptuous homeassistant\n');
    const { problems, installers, scanned } = pinViolations(`${directory}/`);
    assert.equal(scanned, 3, 'просмотрены все файлы каталога, а не два имени');
    assert.equal(installers, 2, 'файл без установки python-пакетов не в счёте');
    assert.deepEqual(problems, [
      'zz-rogue.yml: ставит python-зависимости мимо файла пинов',
      'zz-rogue.yml: остался установ без версий',
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// #479: тяжёлые job идут только по выходу `heavy`, а релизные гейты требуют
// трейлер `Release:` — иначе зелёный Validate мог означать прогон без них.
test('смоки, golden и performance_smoke условны по heavy (#479)', () => {
  const text = read('validate.yml');
  for (const job of ['smoke', 'smoke_done', 'golden', 'performance_smoke']) {
    const start = text.indexOf(`\n  ${job}:\n`);
    assert.ok(start > 0, `job ${job} есть`);
    const chunk = text.slice(start, start + 600);
    assert.match(chunk, /needs: \[changes,/, `${job}: зависит от changes`);
    assert.match(chunk, /if: needs\.changes\.outputs\.heavy == 'true' &&/, `${job}: условие heavy`);
  }
  assert.match(text, /heavy: \$\{\{ steps\.heavy\.outputs\.heavy \}\}/);
  assert.match(text, /classify-changes\.mjs --heavy/);
  assert.match(text, /workflow_dispatch:\n\s+inputs:\n\s+full:/);
  // preflight: режим скриншотов считает тот же скрипт.
  assert.match(text, /check-docs\.mjs --external --screenshots=\$mode/);
});

test('ночной прогон — dispatch Validate на dev с full=true (#479)', () => {
  const text = read('nightly.yml');
  assert.match(text, /schedule:\n\s+- cron:/);
  assert.match(text, /gh workflow run validate\.yml --repo "\$REPO" --ref dev -f full=true/);
  assert.match(text, /actions: write/);
});

test('релизные гейты требуют трейлер Release: и свежие скриншоты (#479)', () => {
  const trailer = /grep -Eq '\^Release:\[\[:space:\]\]\*v\?\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+'/;
  assert.match(read('publish-prerelease.yml'), trailer);
  assert.match(read('release.yml'), trailer);
  assert.match(read('publish-prerelease.yml'), /check-docs\.mjs --screenshots=strict/);
});

test('мутанты по диффу гоняются по запросу с базы диапазона (#475 AC4, #510 AC1)', () => {
  const workflow = read('validate.yml');
  const start = workflow.indexOf('\n  changed_mutants:\n');
  assert.ok(start > 0, 'нет job changed_mutants');
  const job = workflow.slice(start, workflow.indexOf('\n  frontend:\n', start));
  // Триггер — и фронтенд, и бэкенд: бэкенд-мутанты патчат .py и охраняются
  // pytest, а дифф только по ним даёт backend=true без frontend=true (ревью r1).
  // #510: job идёт ровно тогда, когда мутанты запрошены — dispatch mutants/full,
  // PR, ночь, кандидат беты; обычный push обходится дешёвыми гейтами. Отбор по
  // файлам живёт внутри job (`--changed`): при запросе она обязана исполниться,
  // иначе гейт ревью не отличит «нечего гонять» от «не запрашивали» (ревью ТЗ r1).
  assert.match(job, /\n    if: needs\.changes\.outputs\.mutants_requested == 'true'\n/);
  assert.match(workflow, /mutants_requested: \$\{\{ steps\.heavy\.outputs\.mutants_requested \}\}/);
  assert.match(workflow, /MUTANTS_INPUT: \$\{\{ inputs\.mutants \}\}/);
  assert.match(workflow, /\n      mutants:\n        description: [^\n]*\n        type: boolean\n        default: false\n/, 'вход workflow_dispatch mutants, по умолчанию выключен');
  // Третий дизъюнкт (ТЗ §2, ревью r1): правка одного реестра мутантов — тоже
  // вход гейта, классификатор обязан выдавать `mutants` по этому файлу.
  assert.match(workflow, /mutants: \$\{\{ steps\.classify\.outputs\.mutants \}\}/);
  // Сам шаблон и fallback `--all` проверяет test/classify-changes.test.mjs
  // (после #473 классификация живёт в scripts/classify-changes.mjs).
  // База диапазона — та же, что у остальных гейтов ветки (#387/#388).
  assert.match(job, /PROVEN_BASE: \$\{\{ needs\.changes\.outputs\.range_base \}\}/);
  assert.match(job, /git merge-base origin\/dev "\$HEAD_SHA"/);
  // #480: один широкий релизный диапазон отобрал 129 свидетелей и упёрся в
  // 30-минутный timeout. Тот же набор теперь делится существующим
  // детерминированным shardMutants без пропусков и пересечений.
  assert.match(job, /fail-fast: false/);
  // #518: шесть шардов вместо трёх — job-минуты те же, стена раунда ревью вдвое короче.
  assert.match(job, /shard: \[1, 2, 3, 4, 5, 6\]/);
  assert.match(job, /SHARD: \$\{\{ matrix\.shard \}\}/);
  assert.match(job, /node scripts\/mutation-gate\.mjs --changed="\$base\.\.\$HEAD_SHA" --shard="\$SHARD\/6"/);
  assert.match(job, /node scripts\/mutation-gate\.mjs --changed="\$BASE\.\.\$HEAD_SHA" --shard="\$SHARD\/6"/);
  // pytest-гарды исполнимы: Python и зависимости ставятся, как в mutation-gate.yml.
  assert.match(job, /pip install -r tests_backend\/requirements\.txt/);
  // Блокирующая job: свидетель, разучившийся краснеть, — отказ, а не предупреждение.
  assert.ok(!job.includes('continue-on-error'), 'job обязана красить прогон');
});

test('#518: пустой план шарда не ставит окружение, job остаётся исполненной', () => {
  const workflow = read('validate.yml');
  const start = workflow.indexOf('\n  changed_mutants:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  frontend:\n', start));
  // План считается на голом образе: git и node уже есть, npm ci/python/Chromium — нет.
  const plan = job.slice(job.indexOf('name: План шарда'), job.indexOf("- if: steps.plan.outputs.count != '0'"));
  assert.ok(!/npm ci|playwright install|pip install/.test(plan), 'план обязан обходиться без установки окружения');
  assert.match(plan, /--plan-only/);
  assert.match(plan, /count=\$\{count:-0\}/, 'непрочитанный план считается пустым, а не срывает шаг');
  // Дорогие шаги — под условием, но сама job исполняется: доказательство
  // гейта ревью (#510 provesMutants) требует УСПЕШНОЙ job, а не пропущенной.
  for (const step of ['run: npm ci', 'actions/setup-python@v7', 'pip install -r tests_backend/requirements.txt',
    'name: Затронутые мутанты ловятся']) {
    const at = job.indexOf(step);
    assert.ok(at > 0, `нет шага ${step}`);
    const from = job.lastIndexOf('\n      - ', at);
    const to = job.indexOf('\n      - ', at + step.length);
    const block = job.slice(from, to < 0 ? job.length : to);
    assert.match(block, /if: steps\.plan\.outputs\.count != '0'/, `шаг ${step} обязан быть под условием плана`);
  }
  assert.ok(!/\n    if: [^\n]*steps\.plan/.test(job), 'условие плана — на шагах, не на job');
  const save = job.slice(job.indexOf('name: Сохранить журнал свидетелей'));
  assert.match(save, /if: always\(\)/);
});

test('ручной/ночной полный прогон не делит concurrency с push (#479)', () => {
  const text = read('validate.yml');
  assert.match(text, /group: validate-\$\{\{ github\.event_name == 'workflow_dispatch' && 'dispatch-' \|\| '' \}\}/);
});

test('журнал свидетелей changed_mutants: rerun продолжает предыдущую попытку, save работает при любом исходе (#481 AC5, #499)', () => {
  const workflow = read('validate.yml');
  const start = workflow.indexOf('\n  changed_mutants:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  frontend:\n', start));
  const restore = job.slice(job.indexOf('actions/cache/restore@v6'), job.indexOf('name: План шарда'));
  assert.match(restore, /key: mutation-ledger-\$\{\{ matrix\.shard \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(restore, /mutation-ledger-\$\{\{ matrix\.shard \}\}-\$\{\{ github\.run_id \}\}-/, 'rerun обязан восстановить предыдущую попытку того же run');
  assert.match(restore, /^\s+mutation-ledger-\$\{\{ matrix\.shard \}\}-\s*$/m, 'новый run обязан найти последний журнал шарда');
  assert.match(job, /--changed="\$base\.\.\$HEAD_SHA" --shard="\$SHARD\/6" \\\n\s+--ledger="artifacts\/mutation-ledger\/shard-\$SHARD\.json" --plan-only/);
  assert.match(job, /--changed="\$BASE\.\.\$HEAD_SHA" --shard="\$SHARD\/6" \\\n\s+--ledger="artifacts\/mutation-ledger\/shard-\$SHARD\.json"/);
  // #518: журнал обязан восстанавливаться ДО плана, иначе план не увидит
  // уже пойманных и шард заплатит за окружение впустую.
  assert.ok(job.indexOf('actions/cache/restore@v6') < job.indexOf('name: План шарда'), 'restore журнала идёт до плана');
  const save = job.slice(job.indexOf('name: Сохранить журнал свидетелей'));
  assert.match(save, /if: always\(\)/, 'красный или отменённый шард обязан сохранить уже пойманное');
  assert.match(save, /actions\/cache\/save@v6/);
  assert.match(save, /key: mutation-ledger-\$\{\{ matrix\.shard \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.ok(job.indexOf('name: Сохранить журнал свидетелей') > job.indexOf('--ledger='), 'save идёт после шага прогона');
});

test('#541: Validate всегда публикует proof точной попытки, а reuse раскрывает источник', () => {
  const workflow = read('validate.yml');
  assert.doesNotMatch(workflow, /with:\s*\{[^\n]*\$\{\{/,
    'GitHub does not parse an unquoted expression inside a YAML flow mapping');
  const proofAt = workflow.indexOf('\n  proof:\n');
  assert.ok(proofAt > 0, 'финальная proof job существует');
  const proof = workflow.slice(proofAt);
  assert.match(proof, /if: always\(\)/, 'proof создаётся и на красном прогоне');
  for (const dependency of [
    'preflight', 'changes', 'reuse', 'hacs', 'hassfest', 'changed_mutants',
    'frontend', 'smoke', 'smoke_done', 'golden', 'performance_smoke', 'backend',
  ]) assert.match(proof, new RegExp(`needs: \\[[^\\n]*\\b${dependency}\\b`), dependency);
  assert.match(proof, /CANDIDATE_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(proof, /CANDIDATE_TREE: \$\{\{ steps\.candidate\.outputs\.tree \}\}/);
  assert.match(proof, /CI_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.match(proof, /CI_RUN_ATTEMPT: \$\{\{ github\.run_attempt \}\}/);
  assert.match(proof, /REQUEST_FULL: \$\{\{ inputs\.full \}\}/);
  assert.match(proof, /REQUEST_MUTANTS: \$\{\{ inputs\.mutants \}\}/);
  assert.match(proof, /NEEDS_JSON: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(proof, /name: ci-proof-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);

  const reuse = workflow.slice(workflow.indexOf('\n  reuse:\n'), workflow.indexOf('\n  hacs:\n'));
  for (const id of ['smoke', 'golden', 'performance_smoke', 'backend']) {
    assert.match(reuse, new RegExp(`${id}_source_run:`), `${id}: source run output`);
    assert.match(reuse, new RegExp(`${id}_source_attempt:`), `${id}: source attempt output`);
    assert.match(reuse, new RegExp(`${id}_source_sha:`), `${id}: source SHA output`);
  }
  assert.equal((reuse.match(/node scripts\/ci-proof\.mjs --marker=\.reuse-marker/g) || []).length, 4);
  assert.equal(reuse.includes('lookup-only: true'), false,
    'marker contents must be restored and verified, not reduced to a cache-hit bit');
});
