import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHIP_SRC_LINE_LIMIT, hasTrackLabel, parseNameStatus, parseNumstat, resolveTrack, shipLimitViolations, trackFromLabels,
} from '../scripts/process-track.mjs';
import { trackFromLabels as packetTrack } from '../scripts/task-packet.mjs';

// #696: конвейер ревью решает цену захода по треку; трек и рамки ship —
// механические, потому что по ним задача сливается без ревью модели.

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'process-track.mjs');

test('пакет задачи и конвейер читают трек одной функцией (#696)', () => {
  assert.equal(packetTrack, trackFromLabels);
});

test('явная трековая метка главнее признака инфраструктуры (#696)', () => {
  const infra = ['scripts/x.mjs', '.github/workflows/y.yml'];
  assert.deepEqual(resolveTrack({ labels: ['track:ask'], files: infra }), { track: 'ask', mutants: false, full: false, infrastructure: true });
  assert.deepEqual(resolveTrack({ labels: ['track:ship'], files: ['src/a.ts'] }), { track: 'ship', mutants: false, full: false, infrastructure: false });
  assert.equal(resolveTrack({ labels: ['small'], files: ['src/a.ts'] }).track, 'show');
});

test('без трековой метки инфраструктура — show, продуктовая задача — ask (#696)', () => {
  assert.equal(resolveTrack({ labels: ['infra'], files: ['scripts/x.mjs'] }).track, 'show');
  assert.equal(resolveTrack({ labels: ['bug'], files: ['scripts/x.mjs', 'src/a.ts'] }).track, 'ask');
  assert.equal(resolveTrack({ labels: [], files: [] }).track, 'ask', 'пустой дифф не доказывает инфраструктуру');
  assert.equal(hasTrackLabel(['bug', 'P2']), false);
  assert.equal(hasTrackLabel(['trivial']), true);
});

test('#709: мутантов в разработке нет ни на одном треке и ни по какой метке', () => {
  for (const labels of [['track:ship'], ['track:show'], ['track:ask'], ['track:show', 'ci:mutants'], ['ci:mutants'], []]) {
    assert.equal(resolveTrack({ labels, files: ['src/a.ts'] }).mutants, false, labels.join(',') || 'без меток');
  }
});

test('рамки ship: строки src/** считаются вместе, граница включительна (#696)', () => {
  const at = (added, deleted, path = 'src/a.ts') => ({ added, deleted, path });
  assert.deepEqual(shipLimitViolations({ numstat: [at(20, 10)] }), []);
  assert.equal(SHIP_SRC_LINE_LIMIT, 30);
  const over = shipLimitViolations({ numstat: [at(20, 5), at(4, 2, 'src/b.ts')] });
  assert.equal(over.length, 1);
  assert.match(over[0], /31 строк/);
  assert.deepEqual(shipLimitViolations({ numstat: [at(500, 0, 'scripts/x.mjs'), at(200, 0, 'test/x.test.mjs')] }), [],
    'тесты и скрипты рамку src не расходуют');
});

test('рамки ship: новые файлы, двоичные, i18n, конфиг и Python (#696)', () => {
  const v = shipLimitViolations({
    numstat: [
      { added: null, deleted: null, path: 'src/icon.png' },
      { added: 1, deleted: 0, path: 'src/i18n/ru.json' },
      { added: 1, deleted: 0, path: 'src/types.ts' },
      { added: 1, deleted: 0, path: 'src/config-editor.ts' },
      { added: 1, deleted: 0, path: 'custom_components/houseplan/__init__.py' },
      { added: 1, deleted: 0, path: 'custom_components/houseplan/translations/en.json' },
    ],
    nameStatus: [{ status: 'A', path: 'src/new-thing.ts' }, { status: 'M', path: 'src/types.ts' }],
  });
  assert.equal(v.length, 5, v.join('\n'));
  assert.ok(v.some((s) => s.startsWith('двоичные') && s.includes('src/icon.png')));
  assert.ok(v.some((s) => s.startsWith('новые файлы') && s.includes('src/new-thing.ts')));
  assert.ok(v.some((s) => s.startsWith('ключи i18n') && s.includes('src/i18n/ru.json') && s.includes('translations/en.json')));
  assert.ok(v.some((s) => s.startsWith('поля конфига') && s.includes('src/types.ts') && s.includes('src/config-editor.ts')));
  assert.ok(v.some((s) => s.startsWith('Python')));
  assert.deepEqual(shipLimitViolations({ nameStatus: [{ status: 'A', path: 'test/new.test.mjs' }] }), [],
    'новый тест вне src рамки не нарушает');
});

test('разбор numstat и name-status: двоичный файл и переименование (#696)', () => {
  assert.deepEqual(parseNumstat('3\t1\tsrc/a.ts\n-\t-\tsrc/i.png\n'), [
    { added: 3, deleted: 1, path: 'src/a.ts' }, { added: null, deleted: null, path: 'src/i.png' },
  ]);
  assert.deepEqual(parseNameStatus('M\tsrc/a.ts\nR100\tsrc/old.ts\tsrc/new.ts\n'), [
    { status: 'M', path: 'src/a.ts' }, { status: 'R100', path: 'src/new.ts' },
  ]);
});

test('CLI ship-limits и resolve читают реальный дифф (#696)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-track-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'a\n');
  git('add', '.'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(dir, 'src', 'a.ts'), 'a\nb\n');
  git('commit', '-q', '-am', 'small');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } });
  let r = run('ship-limits', `--base=${base}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ship=true$/m);
  r = run('resolve', '--labels=track:show', `--base=${base}`);
  assert.match(r.stdout, /^track=show$/m);
  assert.match(r.stdout, /^mutants=false$/m);
  writeFileSync(join(dir, 'src', 'b.ts'), 'x\n');
  git('add', '.'); git('commit', '-q', '-m', 'new file');
  r = run('ship-limits', `--base=${base}`);
  assert.match(r.stdout, /^ship=false$/m);
  assert.match(r.stdout, /новые файлы в src\/\*\*: src\/b\.ts/);
  r = run('ship-limits');
  assert.notEqual(r.status, 0, 'без базы рамки не проверяются');
});

// ---------- конвейер читает трек (#696) ----------

const WORKFLOW = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', '_process.yml');

test('конвейер: трек снимается до ребейза, мутанты и ship идут из него (#696)', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const at = (marker) => { const i = workflow.indexOf(marker); assert.ok(i > 0, `нет «${marker}»`); return i; };
  const branch = at('      - name: Перейти на ветку задачи\n');
  const track = at('      - name: "Трек задачи и рамки ship (#696)"\n');
  const rebase = at('      - name: Привести ветку к dev\n');
  const gate = at('      - name: Validate на материале\n');
  assert.ok(branch < track && track < rebase && rebase < gate, 'трек — после выбора ветки и до ребейза');
  const trackStep = workflow.slice(track, rebase);
  assert.match(trackStep, /LABELS: \$\{\{ needs\.guard\.outputs\.labels \}\}/, 'метки — текущие, из guard');
  assert.match(trackStep, /git archive origin\/dev scripts \| tar -x -C "\$tools"/, 'скрипт — из dev: ветка show/ship не ребейзится');
  assert.match(trackStep, /node "\$tools\/scripts\/process-track\.mjs" resolve --labels="\$LABELS" --base=origin\/dev/);
  assert.match(trackStep, /node "\$tools\/scripts\/process-track\.mjs" ship-limits --base=origin\/dev --head=HEAD/);
  assert.match(trackStep, /grep -qx 'ship=true'; then\n\s+ship=true/, 'ship — только в рамках');
  assert.match(trackStep, /--add-label track:show --remove-label track:ship/, 'выход за рамки повышает трек');
  assert.match(workflow, /labels=\$\(printf '%s\\n' "\$current" \| paste -sd, -\)/, 'guard отдаёт текущие метки');
  const rebaseStep = workflow.slice(rebase, at('      - name: Зафиксировать SHA материала ревью\n'));
  assert.match(rebaseStep, /if \[ "\$TRACK" = "show" \] \|\| \[ "\$TRACK" = "ship" \]; then\n\s+if git merge-tree --write-tree origin\/dev HEAD/,
    'show/ship не ребейзятся при чистом слиянии');
  const gateStep = workflow.slice(gate, at('      - name: Validate идёт — раунд продолжит событие\n'));
  assert.match(gateStep, /--mutants="\$\{MUTANTS:-false\}"/, 'по умолчанию — без мутантов (#709)');
  assert.match(gateStep, /MUTANTS: \$\{\{ steps\.track\.outputs\.mutants \}\}/);
});

test('конвейер: ship в рамках сливается без модели, с маркером для пакетного ревью (#696)', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const modelJob = workflow.slice(workflow.indexOf('\n  model_review:'), workflow.indexOf('\n  integrate:'));
  assert.match(modelJob, /if: needs\.prepare\.outputs\.proceed == 'true' && needs\.prepare\.outputs\.reuse != 'true' && needs\.prepare\.outputs\.ship != 'true'/);
  const integrate = workflow.slice(workflow.indexOf('\n  integrate:'));
  for (const step of ['Получить результат модели', 'Опубликовать документ ревью', '"Материал раунда воспроизводим (#413)"']) {
    const i = integrate.indexOf(`- name: ${step}`);
    assert.ok(i > 0, step);
    assert.match(integrate.slice(i, i + 400), /needs\.prepare\.outputs\.ship != 'true'/, `${step} пропускается на ship`);
  }
  const decide = integrate.slice(integrate.indexOf('- name: Решение по вердикту'), integrate.indexOf('- name: dev ушёл вперёд'));
  assert.match(decide, /if \[ "\$SHIP" = "true" \] && \[ "\$REUSE" != "true" \]; then[\s\S]*verdict=green; high=0/);
  assert.match(decide, /<!-- hp:ship-merge material=\$MATERIAL -->/, 'маркер для ship-review.mjs');
  assert.doesNotMatch(decide.slice(decide.indexOf('SHIP" = "true'), decide.indexOf('elif [ "$REUSE"')), /Вердикт:/,
    'слияние без ревью не называет себя вердиктом ревью');
  const merge = integrate.slice(integrate.indexOf('- name: Слить ветку в dev'), integrate.indexOf('- name: Переставить метку'));
  assert.match(merge, /--mutants="\$\{MUTANTS:-false\}"/);
  const env = modelJob.slice(modelJob.indexOf('- name: Что ревьюеру нужно из окружения'), modelJob.indexOf('- name: Установить Claude Code'));
  assert.match(env, /if \[ "\$STAGE" = "spec" \]; then deps=false; browser=false; fi/, 'ревью ТЗ не ставит окружение');
  assert.match(env, /if: steps\.env_needs\.outputs\.deps == 'true'\n\s+run: npm ci/);
  assert.match(env, /if: steps\.env_needs\.outputs\.browser == 'true' && steps\.pw\.outputs\.cache-hit != 'true'/);
});

test('#697: полный набор на ветке задачи — только по меткам ci:full и ci:golden', () => {
  assert.equal(resolveTrack({ labels: ['track:show'], files: ['src/a.ts'] }).full, false);
  assert.equal(resolveTrack({ labels: ['track:show', 'ci:golden'], files: ['src/a.ts'] }).full, true);
  assert.equal(resolveTrack({ labels: ['track:ask', 'ci:full'], files: ['src/a.ts'] }).full, true);
  assert.equal(resolveTrack({ labels: ['ci:mutants'], files: ['src/a.ts'] }).full, false, 'мутанты полного набора не заказывают');
});

test('#697: конвейер передаёт полный набор гейту материала', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const gate = workflow.slice(workflow.indexOf('      - name: Validate на материале\n'), workflow.indexOf('      - name: Validate идёт — раунд продолжит событие\n'));
  assert.match(gate, /FULL: \$\{\{ steps\.track\.outputs\.full \}\}/);
  assert.match(gate, /--full="\$\{FULL:-false\}"/);
  assert.match(workflow, /full=\$\(printf '%s\\n' "\$out" \| sed -n 's\/\^full=\/\/p'\)/);
});
