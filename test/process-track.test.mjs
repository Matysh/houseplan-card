import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPARE_FILES_CAP, RISK_CLASSES, RISK_NOTE_LINE_LIMIT, SHIP_SRC_LINE_LIMIT, SHOW_CRITERIA, classifyRisk, cycleLimit, decideTrack,
  explicitTracks, guardLimit, hasTrackLabel, parseNameStatus, parseNumstat, rebaseBeforeReview, resolveTrack, reviewRoute, riskClassLine,
  riskNote, routeComment, routeNote, routeSummary, shipLimitViolations, trackFromLabels, trackOrigin,
} from '../scripts/process-track.mjs';
import { reviewCounters, reviewRoundsFromFiles, withMaterialAnchors } from '../scripts/review-doc-guard.mjs';
import { sectionText } from '../scripts/md-anchors.mjs';
import { classify as classifyPath } from '../scripts/change-classes.mjs';
// Пути монолитов — данные для классификатора, а не чтение их текста (#624).
import { CARD_FILE, RUNTIME_FILE } from '../scripts/monolith-metrics.mjs';
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
  // #707: один вызов скрипта решает трек, рамки ship и риск; bash только исполняет.
  assert.equal((trackStep.match(/process-track\.mjs/g) || []).length, 1, 'скрипт трека вызывается один раз');
  assert.match(trackStep, /node "\$tools\/scripts\/process-track\.mjs" stage --stage="\$STAGE" --labels="\$LABELS" \\\n\s+--branch="\$BRANCH" --base=origin\/dev --head=HEAD --comments="\$comments" --owner="\$OWNER"/);
  assert.match(trackStep, /if printf '%s\\n' "\$out" \| grep -qx 'raise=true'; then\n\s+gh issue comment "\$NUM" --repo "\$\{\{ github\.repository \}\}" --body-file "\$RUNNER_TEMP\/track\/raise\.md"/,
    'комментарий повышения — из файла скрипта, только по его флагу');
  assert.match(trackStep, /--add-label track:show --remove-label track:ship/, 'выход за рамки повышает трек');
  assert.doesNotMatch(trackStep, /ship=true|track=show|>> "\$GITHUB_OUTPUT"/, 'выходы шага пишет скрипт, а не bash');
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
  // #707: `full` пишет в GITHUB_OUTPUT скрипт трека — из меток и только из них.
  assert.match(readFileSync(SCRIPT, 'utf8'), /`full=\$\{decision\.full\}`/);
});

// ---------- #707: риск по изменённым участкам, основание трека, одно правило ----------

/** Дифф `git diff --unified=0` из строк: `add`/`del` — пары [номер, текст]. */
function diffOf(files) {
  return `${files.map(({ path, oldPath = path, add = [], del = [] }) => {
    const out = [`diff --git a/${oldPath} b/${path}`, `--- a/${oldPath}`, `+++ b/${path}`];
    for (const [line, text] of del) out.push(`@@ -${line} +${line - 1},0 @@`, `-${text}`);
    for (const [line, text] of add) out.push(`@@ -${line - 1},0 +${line} @@`, `+${text}`);
    return out.join('\n');
  }).join('\n')}\n`;
}
const only = (risk) => ({ classes: risk.classes, evidence: risk.evidence });

test('#707 AC1: классификатор риска — точные классы и доказательства путь:строка', () => {
  const card = CARD_FILE;
  // (а) токен в монолите — touch; удаление такой строки — тоже touch.
  assert.deepEqual(only(classifyRisk(diffOf([{ path: card, add: [[12, "    this.addEventListener('pointerdown', onDown);"]] }]))),
    { classes: ['touch'], evidence: { touch: [`${card}:12 · токен pointerdown`] } });
  assert.deepEqual(only(classifyRisk(diffOf([{ path: card, del: [[40, "    el.removeEventListener('pointerdown', onDown);"]] }]))),
    { classes: ['touch'], evidence: { touch: [`${card}:40 (удалена) · токен pointerdown`] } });
  // (б) строка-комментарий в участке geometry — ничего; код там же — geometry по участку.
  const wall = 'src/wall-merge.ts';
  for (const comment of ['// pointerdown snapToGrid thickness', '/* merge */', ' * @param wall', ' */', '<!-- x -->', '   ']) {
    assert.deepEqual(classifyRisk(diffOf([{ path: wall, add: [[5, comment]] }])).classes, [], JSON.stringify(comment));
  }
  assert.deepEqual(only(classifyRisk(diffOf([{ path: wall, add: [[5, '  const merged = a + b;']] }]))),
    { classes: ['geometry'], evidence: { geometry: [`${wall}:5 · участок wall-*`] } });
  // (в) snapshot — не geometry; snapToGrid — geometry по токену даже в монолите.
  assert.deepEqual(classifyRisk(diffOf([{ path: card, add: [[3, '    const snapshot = this._snapshot();']] }])).classes, []);
  assert.deepEqual(only(classifyRisk(diffOf([{ path: card, add: [[3, '    const p = snapToGrid(pt, 5);']] }]))),
    { classes: ['geometry'], evidence: { geometry: [`${card}:3 · токен snapToGrid`] } });
  // (г) новый ключ i18n — ux; смена только значения — ничего.
  assert.deepEqual(only(classifyRisk(diffOf([{ path: 'src/i18n/en.json', add: [[9, '  "save_plan": "Save plan",']] }]))),
    { classes: ['ux'], evidence: { ux: ['src/i18n/en.json:9 · новый ключ "save_plan"'] } });
  assert.deepEqual(classifyRisk(diffOf([{ path: 'src/i18n/en.json', del: [[9, '  "save_plan": "Save",']], add: [[9, '  "save_plan": "Save plan",']] }])).classes, []);
  // (д) callService в участке devices — devices по участку и токену.
  assert.deepEqual(only(classifyRisk(diffOf([{ path: 'src/device-toggle.ts', add: [[3, "  hass.callService('light', 'toggle', data);"]] }]))),
    { classes: ['devices'], evidence: { devices: ['src/device-toggle.ts:3 · участок device-toggle, токен callService'] } });
  // (е) те же токены вне класса A — ничего.
  for (const path of ['test/touch.test.mjs', 'scripts/tool.mjs', 'docs/TOUCH-SUPPORT.md', 'demo/smoke_x.mjs']) {
    assert.deepEqual(classifyRisk(diffOf([{ path, add: [[1, "on('pointerdown', () => hass.callService(snapToGrid(requestAnimationFrame)))"]] }])).classes, [], path);
  }
  // (ж) декларация стиля интерфейса — visual/ui, ship не повышает.
  const ui = classifyRisk(diffOf([{ path: 'src/styles/plan.styles.ts', add: [[7, '    gap: 4px;']] }]));
  assert.deepEqual(ui.classes, ['visual']);
  assert.deepEqual(ui.raising, []);
  assert.deepEqual(ui.visual, { render: false, ui: true });
  assert.deepEqual(ui.evidence.visual, ['src/styles/plan.styles.ts:7 · участок src/styles/** (ui)']);
  // (з) путь отрисовки плана — visual/render и perf.
  const render = classifyRisk(diffOf([{ path: 'src/render/paper-scene.ts', add: [[3, '  const scale = 2;']] }]));
  assert.deepEqual(only(render), {
    classes: ['perf', 'visual'],
    evidence: { perf: ['src/render/paper-scene.ts:3 · участок src/render/**'], visual: ['src/render/paper-scene.ts:3 · участок src/render/** (render)'] },
  });
  assert.deepEqual(render.visual, { render: true, ui: false });
  assert.deepEqual(render.raising, ['perf']);
  // (и) чистое переименование — ханков нет, риска нет.
  const rename = 'diff --git a/src/wall-merge.ts b/src/wall-merge-core.ts\nsimilarity index 100%\nrename from src/wall-merge.ts\nrename to src/wall-merge-core.ts\n';
  assert.deepEqual(classifyRisk(rename).classes, []);
  // Двоичный файл ханков не даёт — его ловят рамки ship.
  assert.deepEqual(classifyRisk('diff --git a/src/render/icon.png b/src/render/icon.png\nindex 1..2 100644\nBinary files a/src/render/icon.png and b/src/render/icon.png differ\n').classes, []);
  // (к) переводы интеграции — ux; strings.json класса «?» не судится.
  const key = '  "zone_name": "Zone",';
  assert.deepEqual(only(classifyRisk(diffOf([{ path: 'custom_components/houseplan/translations/en.json', add: [[4, key]] }]))),
    { classes: ['ux'], evidence: { ux: ['custom_components/houseplan/translations/en.json:4 · новый ключ "zone_name"'] } });
  assert.deepEqual(classifyRisk(diffOf([{ path: 'custom_components/houseplan/strings.json', add: [[4, key]] }])).classes, []);
});

test('#707 AC1: каждая строка таблицы риска — положительный и отрицательный случай', () => {
  const cls = (path, add, del = []) => classifyRisk(diffOf([{ path, add, del }])).classes;
  const card = CARD_FILE;
  const cases = [
    // [класс, положительный участок, положительный токен, отрицательный]
    ['geometry', ['src/opening-placement.ts', 'x = 1;'], [card, 'const t = wallThickness;'], [card, 'const s = snapshotOf(x);']],
    ['geometry', ['custom_components/houseplan/junction_limits.py', 'x = 1'], ['src/logic.ts', 'canonicalizePoint(p);'], ['custom_components/houseplan/junction_limits.py', '# junction comment']],
    ['touch', ['src/pointer-modality.ts', 'x = 1;'], [card, "style: 'touch-action: none'"], ['src/logic.ts', 'const pointerUpdate = 1;']],
    ['migration', ['src/config-store.ts', 'x = 1;'], [card, 'migrateLegacy(cfg);'], ['scripts/migrate.mjs', 'migrateLegacy(cfg);']],
    ['migration', ['custom_components/houseplan/store.py', 'x = 1'], ['custom_components/houseplan/plans.py', 'STORAGE_VERSION = 3'], ['custom_components/houseplan/store.py', '   ']],
    ['devices', ['src/vacuum-routes.ts', 'x = 1;'], [card, "hass.callService('a', 'b');"], ['docs/x.md', "hass.callService('a', 'b');"]],
    ['devices', ['custom_components/houseplan/auth.py', 'x = 1'], ['custom_components/houseplan/plans.py', 'require_admin(user)'], ['custom_components/houseplan/plans.py', 'user = 1']],
    ['perf', ['src/glow-scene.ts', 'x = 1;'], [card, 'const r = el.getBoundingClientRect();'], [card, '// getBoundingClientRect']],
    ['perf', ['src/boot-soft-layout.ts', 'x = 1;'], ['src/logic.ts', '  filter: blur(2px);'], ['src/logic.ts', 'list.filter((x) => x);']],
    ['ux', null, [card, "customElements.define('hp-x', X);"], [card, "customElements.get('hp-x');"]],
    ['visual', ['src/iso-walls.ts', 'x = 1;'], [card, '<path stroke-width="2" d="M0 0">'], [card, 'const strokeWidthPx = 2;']],
    ['visual', ['src/summary-panel-style.ts', 'x = 1;'], ['src/furniture-plan-art.generated.ts', 'x = 1;'], [card, 'const styles = 1;']],
  ];
  for (const [name, area, token, negative] of cases) {
    if (area) assert.ok(cls(area[0], [[1, area[1]]]).includes(name), `${name}: участок ${area[0]}`);
    assert.ok(cls(token[0], [[1, token[1]]]).includes(name), `${name}: ${token[0]} «${token[1]}»`);
    assert.ok(!cls(negative[0], [[1, negative[1]]]).includes(name), `${name}: не должно — ${negative[0]} «${negative[1]}»`);
  }
  // ux: удалённый customElements.define и удалённый ключ риска не дают.
  assert.deepEqual(cls(card, [], [[3, "customElements.define('hp-x', X);"]]), []);
  assert.deepEqual(cls('src/i18n/settings/ru.json', [], [[3, '  "a": "b",']]), []);
  assert.deepEqual(cls('src/i18n/settings/ru.json', [[3, '  "a": "b",']]), ['ux'], 'src/i18n/**/*.json');
  // монолит участком не судится: нейтральная строка — без классов.
  assert.deepEqual(cls(RUNTIME_FILE, [[3, 'const a = 1;']]), []);
  // текст перевода со словом токена — не геометрия.
  assert.deepEqual(cls('src/i18n/en.json', [[3, '  "wall_thickness": "Wall thickness",']], [[3, '  "wall_thickness": "Thickness",']]), []);
});

test('#707 AC1: большой дифф — классифицируются все ханки, печатается не больше пяти', () => {
  const add = Array.from({ length: 12 }, (_, i) => [i + 1, `  el.addEventListener('pointermove', f${i});`]);
  const risk = classifyRisk(diffOf([{ path: CARD_FILE, add }]));
  assert.equal(risk.counts.touch, 12);
  assert.equal(risk.evidence.touch.length, 5);
  assert.match(riskClassLine(risk, 'touch'), /; и ещё 7$/);
});

// ---------- #755: строки модулей и типов, участки уже, заменённая строка ----------

/** Дифф одного файла из ханков: заголовок `@@ … @@ <контекст>` и строки `-`/`+` как есть. */
function hunksOf(path, hunks) {
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${hunks.map(([head, ...rows]) => [head, ...rows].join('\n')).join('\n')}\n`;
}
const ISO = 'src/iso-scene-render.ts';

test('#755 AC1: строки импорта и только типов TypeScript риска не дают, кроме участка migration', () => {
  // Ханк #741: удалённый член интерфейса под заголовком интерфейса — классов нет.
  const member = '-  stageSize?: { width: number; height: number } | null;';
  assert.deepEqual(classifyRisk(hunksOf(ISO, [['@@ -651 +650,0 @@ export interface IsoOverlayFitEnvelopeInput {', member]])).classes, []);
  assert.deepEqual(classifyRisk(hunksOf(ISO, [['@@ -134 +133,0 @@ export type IsoOverlayRenderEntry = {', '-  groundRadius: number;']])).classes, []);
  // То же тело под заголовком класса — код, участок iso-scene-render: perf.
  const inClass = classifyRisk(hunksOf(ISO, [['@@ -651 +650,0 @@ export class X {', member]]));
  assert.deepEqual(inClass.raising, ['perf']);
  assert.deepEqual(inClass.evidence.perf, [`${ISO}:651 (удалена) · участок iso-scene-render`]);
  // Под закрытой однострочной декларацией строка с отступом — снова код.
  assert.deepEqual(classifyRisk(hunksOf(ISO, [["@@ -9,0 +10 @@ export type Mode = 'a' | 'b';", '+  run(x);']])).raising, ['perf']);

  // Оператор импорта, член многострочного `import {`, его закрывающая строка, реэкспорт.
  const modules = [
    ["@@ -9 +8,0 @@ import { nothing, svg, type TemplateResult } from 'lit';", "-import { guard } from 'lit/directives/guard.js';"],
    ['@@ -16 +16 @@ import {', '-  cachedStairRenderGeometry, stairList,', '+  cachedStairMarkup, cachedStairRenderGeometry, stairList,'],
    ['@@ -20 +20 @@ import {', "-} from './stairs';", "+} from './stairs-model';"],
    ['@@ -30,0 +31,2 @@ import { x } from "./x";', "+export { computeIsoSunBeams } from './iso-sun';", "+export * from './iso-tiles';"],
    ['@@ -40,0 +42,2 @@ import { x } from "./x";', "+import type { Rect } from './geometry';", "+export type { Rect } from './geometry';"],
  ];
  for (const hunk of modules) assert.deepEqual(classifyRisk(hunksOf(ISO, [hunk])).classes, [], hunk.join(' ⏎ '));
  // Импорт с токеном в монолите — тоже нет; тот же токен в коде монолита — migration (таблица #707).
  assert.deepEqual(classifyRisk(diffOf([{ path: CARD_FILE, add: [[3, "import { migrateX } from './m';"]] }])).classes, []);
  assert.deepEqual(classifyRisk(diffOf([{ path: CARD_FILE, add: [[3, 'migrateX(cfg);']] }])).classes, ['migration']);
  // Динамический импорт и `import.meta` — код.
  assert.deepEqual(classifyRisk(diffOf([{ path: ISO, add: [[3, "import('./iso-sun').then(run);"]] }])).raising, ['perf']);
  assert.deepEqual(classifyRisk(diffOf([{ path: ISO, add: [[3, 'import.meta.hot?.accept();']] }])).raising, ['perf']);

  // Целиком добавленный интерфейс: заголовок ханка — прошлая декларация, голова внутри ханка.
  const wholeType = ['@@ -330,0 +331,5 @@ export function cachedStairRenderGeometry(',
    '+/** Attribute strings. */', '+export interface StairMarkup {', '+  outline: string;', '+  treads: string;', '+}'];
  assert.deepEqual(classifyRisk(hunksOf(ISO, [wholeType])).classes, []);
  // Блок типа закрыт — следующая строка кода того же ханка судится.
  const typeThenCode = ['@@ -1,0 +2,4 @@ export const a = 1;', '+type Box = {', '+  w: number;', '+};', '+export const box = measure();'];
  assert.deepEqual(classifyRisk(hunksOf(ISO, [typeThenCode])).evidence.perf, [`${ISO}:5 · участок iso-scene-render`]);

  // Дифф с контекстом: следующий блок ханка берёт контекст из строки контекста, как git.
  const withContext = ['@@ -10,5 +10,5 @@ export interface A {', '-  a: number;', '+  a: string;', ' }',
    ' export function f() {', '-  run(1);', '+  run(2);'];
  assert.deepEqual(classifyRisk(hunksOf(ISO, [withContext])).evidence.perf, [`${ISO}:13 · участок iso-scene-render`]);

  // К3: участок migration — типы конфига и импорты судятся, как раньше (#588, #649).
  const marker = classifyRisk(hunksOf('src/types.ts', [['@@ -199 +199 @@ export interface Marker {',
    "-  display?: 'badge' | 'ripple';", "+  display?: 'badge' | 'ripple' | 'value';"]]));
  assert.deepEqual(only(marker), { classes: ['migration'], evidence: { migration: ['src/types.ts:199 · участок types'] } });
  assert.deepEqual(classifyRisk(hunksOf('src/types.ts', [['@@ -304,0 +305 @@ export interface ServerConfig {', '+  volumetric_view?: boolean;']])).classes, ['migration']);
  assert.deepEqual(classifyRisk(diffOf([{ path: 'src/config-store.ts', add: [[2, "import { normalize } from './n';"]] }])).classes, ['migration']);
  // Только `.ts`: строка Python с `import` и `type` судится, как раньше.
  assert.deepEqual(classifyRisk(diffOf([{ path: 'custom_components/houseplan/auth.py', add: [[2, 'import hass']] }])).classes, ['devices']);
});

test('#772: сохраняемые типы лестниц вне types.ts дают migration и повышают ship', () => {
  const path = 'src/stairs.ts';
  const variants = [
    ['@@ -45 +45 @@ interface StairCommon {', '-  fill_color?: string;', '+  fill_color: string;'],
    ['@@ -67 +67 @@ export interface StraightStair extends StairCommon {', '-  width: number;', '+  width?: number;'],
    ['@@ -74 +74 @@ export interface SpiralStair extends StairCommon {', '-  radius: number;', '+  radius?: number;'],
    ['@@ -33 +33 @@', "-export type StraightStairDirection = 'forward' | 'backward';", "+export type StraightStairDirection = 'up' | 'down';"],
    ['@@ -34 +34 @@', "-export type SpiralStairDirection = 'clockwise' | 'counterclockwise';", "+export type SpiralStairDirection = 'cw' | 'ccw';"],
    ['@@ -77 +77 @@', '-export type Stair = StraightStair | SpiralStair;', '+export type Stair = StraightStair;'],
    ['@@ -37,0 +38,3 @@', '+interface StairCommon {', '+  color: string;', '+}'],
    ['@@ -37,3 +37,0 @@', '-interface StairCommon {', '-  color: string;', '-}'],
  ];
  for (const hunk of variants) {
    const diff = hunksOf(path, [hunk]);
    const result = decideTrack({ stage: 'code', branch: 'issue/772-probe', labels: ['track:ship'],
      files: [path], numstat: [{ path, added: 3, deleted: 3 }], nameStatus: [{ path, status: 'M' }], diff });
    assert.deepEqual(result.violations, [], 'правка укладывается в механические рамки');
    assert.ok(result.risk.classes.includes('migration'), hunk.join('\n'));
    assert.match(result.risk.evidence.migration[0], /src\/stairs\.ts:\d+.*сохраняемый тип/);
    assert.equal(result.track, 'show');
    assert.equal(result.ship, false);
    assert.equal(result.raise, true);
  }
  // Имя сохраняемого типа в импорте или в другом модуле не делает его декларацией.
  const safe = [
    [path, ['@@ -1 +1 @@', "-import { StairCommon } from './x';", "+import type { StairCommon } from './x';"]],
    [path, ['@@ -1 +1 @@ import {', '-  StairCommon,', '+  StairCommon, Stair,']],
    [path, ['@@ -1 +1 @@ export interface StairVisualStyle {', '-  color: string;', '+  color?: string;']],
    [path, ['@@ -1 +1 @@ type CachedRenderGeometry = {', '-  fingerprint: string;', '+  fingerprint?: string;']],
    ['src/iso-scene-render.ts', ['@@ -1 +1 @@ interface StairCommon {', '-  color: string;', '+  color?: string;']],
  ];
  for (const [file, hunk] of safe) {
    const result = decideTrack({ stage: 'code', branch: 'issue/772-probe', labels: ['track:ship'],
      files: [file], numstat: [{ path: file, added: 1, deleted: 1 }], nameStatus: [{ path: file, status: 'M' }],
      diff: hunksOf(file, [hunk]) });
    assert.deepEqual(result.risk.classes, [], hunk.join('\n'));
    assert.equal(result.ship, true);
  }
});

test('#755 AC2: участки stairs и config — модель лестницы и запись конфига, а не всё по префиксу', () => {
  const cls = (path, text = '  const a = b + c;') => classifyRisk(diffOf([{ path, add: [[5, text]] }])).classes;
  assert.deepEqual(cls('src/stairs-view.ts'), ['visual'], 'отрисовка лестницы — visual:render, не geometry');
  assert.deepEqual(cls('src/stairs-editor.ts'), [], 'нейтральная строка редактора лестницы');
  assert.deepEqual(cls('src/stairs-editor.ts', "  el.addEventListener('pointerdown', onDown);"), ['touch'], 'указатель редактора — токен touch');
  for (const path of ['src/stairs.ts', 'src/stairs-box.ts', 'src/stairs-editor-model.ts']) assert.deepEqual(cls(path), ['geometry'], path);
  assert.deepEqual(cls('src/config-fingerprint-pass.ts'), [], 'мемо отпечатка о схеме не знает');
  for (const path of ['src/config-store.ts', 'src/config-adoption.ts', 'src/config-reload-authority.ts', 'src/config-write-conflict.ts']) {
    assert.deepEqual(cls(path), ['migration'], path);
  }
});

test('#755: заменённая строка — одно доказательство, удалённая без пары остаётся «(удалена)»', () => {
  const view = 'src/stairs-view.ts';
  const replaced = classifyRisk(hunksOf(view, [['@@ -89,2 +89 @@ export function renderStairs(',
    '-  const cls = "a";', '-  const old = 1;', '+  const cls = "b";']]));
  assert.deepEqual(replaced.evidence.visual, [
    `${view}:90 (удалена) · участок stairs-view (render)`,
    `${view}:89 · участок stairs-view (render)`,
  ]);
  assert.equal(replaced.counts.visual, 2);
  // Пара сводит и правила: удалённый токен дописывается к новой строке.
  const tokens = classifyRisk(hunksOf(CARD_FILE, [['@@ -12 +12 @@ export class HouseplanCard extends LitElement {',
    "-    el.addEventListener('pointerdown', f);", "+    el.addEventListener('pointerup', f);"]]));
  assert.deepEqual(tokens.evidence.touch, [`${CARD_FILE}:12 · токен pointerup, токен pointerdown`]);
  // Новая строка класса не даёт — удалённая остаётся своим доказательством.
  const gone = classifyRisk(hunksOf(CARD_FILE, [['@@ -12 +12 @@ export class HouseplanCard extends LitElement {',
    "-    el.addEventListener('pointerdown', f);", '+    el.focus();']]));
  assert.deepEqual(gone.evidence.touch, [`${CARD_FILE}:12 (удалена) · токен pointerdown`]);
  // Разные ханки не пара, даже с одним номером строки (таблица #707 строит именно такие).
  assert.equal(classifyRisk(diffOf([{ path: view, del: [[9, 'x = 1;']], add: [[9, 'x = 2;']] }])).counts.visual, 2);
});

test('#707 AC2: происхождение трека — строка владельца, предложение, прежние метки', () => {
  const c = (author, body, createdAt) => ({ author, body, createdAt });
  const owner = 'Matysh';
  const ship = ['track:ship', 'S7-code-review'];
  const confirmed = trackOrigin({ labels: ship, owner, comments: [c(owner, 'Решение.\nТрек: ship — решение владельца', '2026-09-30T08:00:00Z')] });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.basis, 'метка, подтверждённая владельцем (2026-09-30)');
  for (const line of ['трек: SHIP – Решение Владельца', 'Трек: ship - решение владельца', '  Трек:ship—решение владельца']) {
    assert.equal(trackOrigin({ labels: ship, owner, comments: [c('matysh', line, '1')] }).confirmed, true, line);
  }
  const proposal = 'метка без подтверждения — предложение';
  assert.equal(trackOrigin({ labels: ship, owner, comments: [c('claude[bot]', 'Трек: ship — решение владельца', '1')] }).basis, proposal, 'чужой автор');
  assert.equal(trackOrigin({ labels: ship, owner, comments: [c(owner, 'Трек: show — решение владельца', '1')] }).basis, proposal, 'другой трек');
  assert.equal(trackOrigin({ labels: ship, owner, comments: [c(owner, 'как сказано: Трек: ship — решение владельца', '1')] }).basis, proposal, 'не в начале строки');
  assert.equal(trackOrigin({ labels: ship, owner, comments: [c(owner, '> Трек: ship — решение владельца', '1')] }).basis, proposal, 'цитата не подтверждение');
  // Более поздняя строка владельца отменяет раннюю — по времени, а не по порядку массива.
  const later = [c(owner, 'Трек: show — решение владельца', '2026-09-30T09:00:00Z'), c(owner, 'Трек: ship — решение владельца', '2026-09-29T09:00:00Z')];
  assert.equal(trackOrigin({ labels: ship, owner, comments: later }).confirmed, false);
  assert.equal(trackOrigin({ labels: ['track:show'], owner, comments: later }).confirmed, true);
  // Комментарии недоступны — происхождение не установлено.
  const unknown = trackOrigin({ labels: ship, owner, comments: null });
  assert.equal(unknown.confirmed, false);
  assert.equal(unknown.basis, 'метка, происхождение не установлено (комментарии недоступны)');
  // Несколько трековых меток — строжайшая и предупреждение.
  const two = trackOrigin({ labels: ['track:ship', 'track:ask'], owner, comments: [] });
  assert.equal(two.track, 'ask');
  assert.match(two.warning, /несколько трековых меток \(track:ask, track:ship\) — дефект разметки, действует строжайшая track:ask/);
  assert.equal(trackFromLabels(['track:ship', 'track:show']), 'show');
  assert.equal(trackOrigin({ labels: ['small'], owner, comments: [] }).basis, 'прежняя метка small → show (§5.1)');
  assert.equal(trackOrigin({ labels: ['small'], owner, comments: [] }).track, 'show');
  assert.equal(trackOrigin({ labels: [], infrastructure: true }).basis, 'метки нет: инфраструктура → show');
  assert.equal(trackOrigin({ labels: ['bug'] }).basis, 'метки нет: продукт → ask');
});

const RISKY = diffOf([{ path: 'src/pointer-modality.ts', add: [[7, "  if (e.pointerType === 'touch') return;"]] }]);
const VISUAL = diffOf([{ path: 'src/styles/plan.styles.ts', add: [[7, '    gap: 4px;']] }]);
const small = { numstat: [{ added: 1, deleted: 0, path: 'src/pointer-modality.ts' }], nameStatus: [{ status: 'M', path: 'src/pointer-modality.ts' }] };
const ownerSays = (track) => [{ author: 'Matysh', body: `Трек: ${track} — решение владельца`, createdAt: '2026-09-30T08:00:00Z' }];
const s7 = (over = {}) => decideTrack({
  stage: 'code', branch: 'issue/7-x', labels: ['track:ship', 'S7-code-review'], files: ['src/pointer-modality.ts'],
  ...small, diff: RISKY, comments: [], owner: 'Matysh', runUrl: 'https://run/1', ...over,
});

test('#707 AC3: решение по ship на S7 — рамки, риск и подтверждение владельца', () => {
  // Рамки соблюдены, риск есть, подтверждения нет — show комментарием с классами и способом подтвердить ship.
  const raised = s7();
  assert.equal(raised.raise, true);
  assert.equal(raised.track, 'show');
  assert.equal(raised.ship, false);
  assert.match(raised.comment, /^\*\*Трек повышен: `track:ship` → `track:show`\.\*\*/);
  assert.match(raised.comment, /- touch: src\/pointer-modality\.ts:7 · участок pointer-modality, токен pointerType/);
  assert.match(raised.comment, /Понизить трек может только владелец; подтвердить ship — строкой `Трек: ship — решение владельца` в комментарии и снова `S7-code-review`/);
  assert.match(raised.comment, /\[Прогон\]\(https:\/\/run\/1\)/);
  assert.doesNotMatch(raised.comment, /механические рамки/, 'рамки не нарушены — их не называет');
  // Сам комментарий конвейера (он идёт от учётной записи владельца) подтверждением не служит.
  assert.equal(trackOrigin({ labels: ['track:ship'], owner: 'Matysh', comments: [{ author: 'Matysh', body: raised.comment, createdAt: '2' }] }).confirmed, false);
  // Подтверждено владельцем — ship, строка риска для hp:ship-merge.
  const kept = s7({ comments: ownerSays('ship') });
  assert.equal(kept.raise, false);
  assert.equal(kept.ship, true);
  assert.equal(kept.track, 'ship');
  assert.equal(kept.note, '', 'модель на ship не зовётся — заметка не нужна');
  assert.match(kept.shipRisk, /^Риск по участкам \(трек подтверждён владельцем, не повышен\): touch: src\/pointer-modality\.ts:7/);
  assert.match(kept.shipRisk, /\n<!-- hp:ship-risk classes=touch -->$/);
  // Риск только visual — ship без повышения.
  const visual = s7({ diff: VISUAL, files: ['src/styles/plan.styles.ts'] });
  assert.equal(visual.raise, false);
  assert.equal(visual.ship, true);
  assert.equal(visual.full, false, 'визуальный риск полного набора не заказывает');
  // Нарушение рамок — show при любом подтверждении; оба перечня одним комментарием.
  const over = { numstat: [{ added: 40, deleted: 0, path: 'src/pointer-modality.ts' }], nameStatus: small.nameStatus };
  for (const comments of [[], ownerSays('ship')]) {
    const both = s7({ ...over, comments });
    assert.equal(both.raise, true);
    assert.equal(both.track, 'show');
    assert.match(both.comment, /механические рамки ship \(PROCESS\.md §5\): дифф src\/\*\* — 40 строк при рамке 30\./);
    assert.match(both.comment, /- touch: src\/pointer-modality\.ts:7/);
    assert.match(both.comment, /Понизить трек обратно может только владелец\./);
    assert.equal((both.comment.match(/Трек повышен/g) || []).length, 1, 'один комментарий');
  }
  // Повторный S7 после повышения: метка уже show — второго комментария нет.
  assert.equal(s7({ labels: ['track:show', 'S7-code-review'] }).raise, false);
  // Этап spec, нет ветки, инфраструктурный дифф — риск пуст, поведение прежнее.
  for (const quiet of [s7({ stage: 'spec' }), s7({ branch: '' }), s7({ labels: ['S7-code-review'], files: ['scripts/x.mjs'], diff: diffOf([{ path: 'scripts/x.mjs', add: [[1, 'pointerdown']] }]) })]) {
    assert.deepEqual(quiet.risk.classes, []);
    assert.equal(quiet.raise, false);
    assert.equal(quiet.note, '');
  }
  assert.equal(s7({ stage: 'spec' }).ship, false, 'ship сливается только на код-ревью');
  // Полный набор — только по меткам.
  assert.equal(s7({ labels: ['track:show', 'ci:golden'] }).full, true);
});

test('#707 AC5: заметка риска ревьюеру show/ask', () => {
  const risk = classifyRisk(RISKY);
  const showNote = riskNote({ track: 'show', risk });
  assert.match(showNote, /Трек show держится на «решать нечего» \(PROCESS\.md §5\)/);
  // #726: вместо Medium «решать есть что — нужен track:ask» — маршрут вердикта.
  assert.match(showNote, /не нашёл — `route: reclassify` с названным критерием §5 \(#726\)/);
  assert.doesNotMatch(showNote, /Medium/);
  assert.match(showNote, /- touch: src\/pointer-modality\.ts:7 · участок pointer-modality, токен pointerType/);
  const confirmedNote = riskNote({ track: 'show', confirmed: true, risk });
  assert.match(confirmedNote, /трек не повышать: не нашёл — `route: reclassify` с критерием, и конвейер задаст вопрос владельцу, вариант по умолчанию «повысить до ask»/);
  assert.doesNotMatch(confirmedNote, /Medium/);
  assert.match(riskNote({ track: 'ask', risk }), /Трек ask: сверь, что каждый класс ниже покрыт AC ТЗ/);
  const render = classifyRisk(diffOf([{ path: 'src/render/paper-scene.ts', add: [[3, '  const scale = 2;']] }]));
  assert.match(riskNote({ track: 'show', risk: render }), /Визуальный риск в пути отрисовки плана без ci:golden — если задача меняет вид, нужен ci:golden/);
  assert.doesNotMatch(riskNote({ track: 'show', risk: render, labels: ['ci:golden'] }), /ci:golden —/);
  assert.equal(riskNote({ track: 'show', risk: classifyRisk(VISUAL) }), '', 'visual/ui — ни вопроса трека, ни golden');
  assert.equal(riskNote({ track: 'show', risk: classifyRisk('') }), '');
  const everything = classifyRisk(diffOf(RISK_CLASSES.map((_, i) => ({
    path: CARD_FILE,
    add: Array.from({ length: 9 }, (__, j) => [i * 100 + j + 1, "on('pointerdown', () => snapToGrid(requestAnimationFrame(callService(migrate(x))))); <path stroke='1'/> customElements.define('x', X)"]),
  }))));
  const lines = riskNote({ track: 'show', risk: everything }).split('\n');
  assert.ok(lines.length <= RISK_NOTE_LINE_LIMIT, `${lines.length} строк`);
  assert.equal(RISK_NOTE_LINE_LIMIT, 25);
});

/** Прежний bash guard — эталон, против которого сверяется единое правило (AC6). */
function oldGuardLimit(labels, { branch = true, compareOk = true, files = [] } = {}) {
  const has = (label) => labels.includes(label);
  let small = has('small') || has('track:show') || has('track:ship');
  let trivial = has('trivial');
  if (has('track:ask')) { small = false; trivial = false; }
  let limit = small || trivial ? 2 : 4;
  if (branch && !['track:ship', 'track:show', 'track:ask', 'small', 'trivial'].some(has)
      && compareOk && files.length > 0 && files.length < 300 && files.every((f) => classifyPath(f) !== 'A')) limit = 2;
  return limit;
}

test('#707 AC6: трек и лимит — одно правило; прежний guard воспроизведён везде, кроме нескольких трековых меток', () => {
  const infra = ['scripts/a.mjs', '.github/workflows/b.yml'];
  const product = ['src/a.ts', 'scripts/a.mjs'];
  const many = Array.from({ length: 300 }, (_, i) => `scripts/f${i}.mjs`);
  const labelSets = [[], ['infra'], ['bug', 'P2'], ['ci:golden'], ['small'], ['trivial'], ['track:ship'], ['track:show'], ['track:ask'],
    ['track:ask', 'small'], ['track:ask', 'trivial'], ['track:show', 'small'], ['track:ship', 'trivial']];
  const multi = [['track:ship', 'track:ask'], ['track:ship', 'track:show'], ['track:show', 'track:ask'], ['track:ship', 'track:show', 'track:ask']];
  const worlds = [
    { name: 'инфраструктура', files: infra }, { name: 'продукт', files: product }, { name: 'пусто', files: [] },
    { name: '300 файлов', files: many }, { name: 'compare отказал', files: infra, compareOk: false }, { name: 'нет ветки', files: [], branch: false },
  ];
  for (const labels of [...labelSets, ...multi]) {
    for (const world of worlds) {
      const files = world.compareOk === false || world.branch === false ? [] : world.files;
      const got = guardLimit({ labels, files });
      assert.equal(got.limit, cycleLimit(resolveTrack({ labels, files, filesCapped: files.length >= COMPARE_FILES_CAP }).track));
      assert.equal(got.limit, oldGuardLimit(labels, world), `${labels.join(',') || 'без меток'} · ${world.name}`);
    }
  }
  for (const labels of multi) assert.equal(guardLimit({ labels, files: infra }).track, explicitTracks(labels)[0], `строжайшая: ${labels}`);
  assert.deepEqual(guardLimit({ labels: [], files: many }), { track: 'ask', limit: 4, infrastructure: false }, '300 файлов и больше — ask/4');
  assert.deepEqual(guardLimit({ labels: [], files: infra }), { track: 'show', limit: 2, infrastructure: true }, 'инфраструктура без метки — лимит 2');
  assert.equal(cycleLimit('ask'), 4);
  assert.equal(cycleLimit('show'), 2);
  assert.equal(cycleLimit('ship'), 2);
});

test('#707 AC6: guard берёт трек и лимит из process-track.mjs и не держит своей логики трека', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const guard = workflow.slice(workflow.indexOf('\n  guard:'), workflow.indexOf('\n  prepare:'));
  assert.match(guard, /track_out=\$\(node scripts\/process-track\.mjs limit --labels="\$labels" --files="\$changed"\)/);
  assert.match(guard, /new_limit=\$\(printf '%s\\n' "\$track_out" \| sed -n 's\/\^limit=\/\/p'\)/);
  for (const own of [/SMALL/, /TRIVIAL/, /has track:show/, /has track:ship/, /has track:ask/, /limit=2/, /classify\(/, /files\.length < 300/]) {
    assert.doesNotMatch(guard, own, `в guard осталась своя логика трека: ${own}`);
  }
});

test('#707: ребейз до ревью — функция и условие шага «Привести ветку к dev» совпадают', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const step = workflow.slice(workflow.indexOf('      - name: Привести ветку к dev\n'), workflow.indexOf('      - name: Зафиксировать SHA материала ревью\n'));
  const condition = /\n\s+if ((?:\[ "\$TRACK" = "\w+" \](?: \|\| )?)+); then\n\s+if git merge-tree --write-tree origin\/dev HEAD >\/dev\/null 2>&1; then/.exec(step);
  assert.ok(condition, 'условие show/ship перед merge-tree найдено');
  const skipOnClean = new Set([...condition[1].matchAll(/"\$TRACK" = "(\w+)"/g)].map((m) => m[1]));
  for (const track of ['ship', 'show', 'ask']) {
    assert.equal(!skipOnClean.has(track), rebaseBeforeReview(track, true), `${track}: чистое слияние`);
    assert.equal(rebaseBeforeReview(track, false), true, `${track}: конфликт — ребейз`);
    assert.equal(rebaseBeforeReview(track, null), true, `${track}: чистота не проверена — как в шаге, ребейз`);
  }
});

// ---------- #707 AC4: шаг трека, guard и комментарий слияния на настоящем bash ----------

const SCRIPTS_DIR = dirname(SCRIPT);
const CONTEXT = { repository: 'o/r', server_url: 'https://github.com', run_id: '42', repository_owner: 'o' };

/**
 * Тело `run: |` шага так, как его прочтёт YAML: блок кончается на первой
 * непустой строке с отступом меньше отступа тела (PROCESS.md §10.4 п.4), и
 * обрезанный скрипт тест увидит, а не пропустит. Выражения `github.*` —
 * подставлены, как это делает раннер.
 */
function stepRun(workflow, marker) {
  const start = workflow.indexOf(marker);
  assert.ok(start >= 0, `шаг «${marker.trim()}»`);
  const lines = workflow.slice(start).split('\n');
  const from = lines.findIndex((line) => /^\s+run: \|$/.test(line));
  assert.ok(from > 0, 'у шага есть run: |');
  const indent = lines[from].indexOf('run:') + 2;
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && line.length - line.trimStart().length < indent) break;
    body.push(line.slice(indent));
  }
  const text = body.join('\n')
    .replace(/\$\{\{ github\.(\w+) \}\}/g, (_, key) => CONTEXT[key])
    .replace(/\$\{\{ needs\.guard\.outputs\.cycle \}\}/g, '1');
  assert.doesNotMatch(text, /\$\{\{/, 'все выражения подставлены');
  return text;
}
const TRACK_STEP = '      - name: "Трек задачи и рамки ship (#696)"\n';
const GUARD_STEP = '      - id: decide\n';
const DECIDE_STEP = '      - name: Решение по вердикту\n';
const TOOLS_STEP = '      - name: Скрипты конвейера — из dev (#749)\n';
const PUBLISH_STEP = '      - name: Опубликовать документ ревью\n';

test('#707 AC4: изменённые run шага трека, guard и решения по вердикту проходят bash -n', async (t) => {
  if (process.platform === 'win32' || spawnSync('bash', ['--version']).status !== 0) { t.skip('bash недоступен'); return; }
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  // #726: шаг решения и публикация документа тоже изменены.
  for (const marker of [TRACK_STEP, GUARD_STEP, DECIDE_STEP, PUBLISH_STEP]) {
    const r = spawnSync('bash', ['-n', '-c', stepRun(workflow, marker)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${marker.trim()}: ${r.stderr}`);
    assert.equal(r.stderr, '', `${marker.trim()}: bash предупреждает (незакрытый heredoc?): ${r.stderr}`);
  }
  // Свидетель умеет падать: heredoc без закрывающей строки — предупреждение bash.
  const broken = spawnSync('bash', ['-n', '-c', 'cat > /dev/null <<EOF\nтекст\n'], { encoding: 'utf8' });
  assert.notEqual(broken.stderr, '');
});

test('#707 AC4: шаг трека в _process.yml — один вызов, комментарии, флаг повышения, риск до промпта и до hp:ship-merge', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const run = stepRun(workflow, TRACK_STEP);
  assert.equal((run.match(/process-track\.mjs/g) || []).length, 1, 'один вызов скрипта');
  assert.match(run, /gh issue view "\$NUM" --repo "o\/r" --json comments > "\$comments"/, 'JSON комментариев — скрипту');
  assert.match(run, /--comments="\$comments" --owner="\$OWNER"/);
  const step = workflow.slice(workflow.indexOf(TRACK_STEP), workflow.indexOf('      - name: Привести ветку к dev\n'));
  assert.match(step, /OWNER: \$\{\{ github\.repository_owner \}\}/, 'владелец — владелец репозитория');
  assert.equal((run.match(/gh issue edit/g) || []).length, 1, 'метки меняются в одном месте');
  assert.ok(run.indexOf('gh issue edit') > run.indexOf("grep -qx 'raise=true'"), 'метки — только по флагу повышения');
  // Выходы prepare: заметка — в промпт Review, строка риска — в комментарий слияния.
  const prepare = workflow.slice(workflow.indexOf('\n  prepare:'), workflow.indexOf('    steps:', workflow.indexOf('\n  prepare:')));
  assert.match(prepare, /risk_note: \$\{\{ steps\.track\.outputs\.risk_note \}\}/);
  assert.match(prepare, /ship_risk: \$\{\{ steps\.track\.outputs\.ship_risk \}\}/);
  const prompt = workflow.slice(workflow.indexOf('          prompt: |\n'), workflow.indexOf('          claude_args: |'));
  assert.match(prompt, /\n\s+\$\{\{ needs\.prepare\.outputs\.risk_note \}\}\n/, 'risk_note доходит до промпта Review');
  const decide = workflow.slice(workflow.indexOf(DECIDE_STEP), workflow.indexOf('      - name: dev ушёл вперёд'));
  assert.match(decide, /SHIP_RISK: \$\{\{ needs\.prepare\.outputs\.ship_risk \}\}/);
  assert.match(decide, /\n\s+\$\{SHIP_RISK\}\n\n\s+<!-- hp:ship-merge material=\$MATERIAL -->\n/, 'строка риска — в комментарии слияния, маркер прежний');
  // `full` — только из меток: гейт берёт его у шага трека, скрипт — у resolveTrack.
  const gate = workflow.slice(workflow.indexOf('      - name: Validate на материале\n'), workflow.indexOf('      - name: Validate идёт — раунд продолжит событие\n'));
  assert.match(gate, /FULL: \$\{\{ steps\.track\.outputs\.full \}\}/);
  assert.equal(decideTrack({ stage: 'code', branch: 'b', labels: ['track:show'], diff: RISKY }).full, false, 'риск полного набора не заказывает');
});

/** Замыкание относительных импортов модуля — то, что шаг получит архивом scripts/ из dev. */
function importClosure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, 'utf8');
  for (const m of text.matchAll(/^(?:import|export)[^'"]*from ['"](\.{1,2}\/[^'"]+)['"]/gm)) importClosure(join(dirname(entry), m[1]), seen);
  return seen;
}

// Окружение git без GIT_* родителя и без глобального конфига.
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
};
const hasTools = () => process.platform !== 'win32'
  && ['bash', 'tar', 'git'].every((tool) => spawnSync(tool, ['--version']).status === 0);

function parseOutput(text) {
  const out = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const heredoc = /^([\w-]+)<<(.+)$/.exec(lines[i]);
    if (heredoc) {
      const end = lines.indexOf(heredoc[2], i + 1);
      assert.ok(end > i, `закрывающий разделитель ${heredoc[2]}`);
      out[heredoc[1]] = lines.slice(i + 1, end).join('\n');
      i = end;
      continue;
    }
    const kv = /^([\w-]+)=(.*)$/.exec(lines[i]);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

/** Песочница: bare origin с dev (scripts/ и src/), ветка задачи, подменённый gh. */
function trackSandbox(t, { change, base = () => {} }) {
  const root = mkdtempSync(join(tmpdir(), 'hp-707-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const fake = join(root, 'fake');
  const bin = join(root, 'bin');
  const temp = join(root, 'runner');
  for (const dir of [fake, bin, temp]) mkdirSync(dir);
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, 'scripts'));
  for (const file of importClosure(SCRIPT)) {
    assert.ok(file.startsWith(SCRIPTS_DIR), `${file} вне scripts/`);
    writeFileSync(join(work, 'scripts', file.slice(SCRIPTS_DIR.length + 1)), readFileSync(file));
  }
  // #749: снимок скриптов integrate берёт из dev и validate.yml.
  mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(work, '.github', 'workflows', 'validate.yml'), readFileSync(join(dirname(WORKFLOW), 'validate.yml')));
  mkdirSync(join(work, 'src', 'styles'), { recursive: true });
  writeFileSync(join(work, 'src', 'pointer-modality.ts'), 'export const a = 1;\nexport const b = 2;\n');
  writeFileSync(join(work, 'src', 'styles', 'plan.styles.ts'), 'export const css = `\n  .x { color: red; }\n`;\n');
  base(work);
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'base');
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', '-b', 'issue/7-x');
  change(work);
  git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'task');
  git(work, 'push', '-q', 'origin', 'issue/7-x');
  git(work, 'checkout', '-q', '--detach', 'issue/7-x');
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env bash',
    'printf \'%s\\n\' "$*" >> "$FAKE_DIR/gh-calls"',
    // #726: `--json labels` — текущие метки для шага решения по вердикту (как их отдал бы --jq).
    'if [ "$1 $2" = "issue view" ] && [[ " $* " == *" labels "* ]]; then',
    '  if [ -f "$FAKE_DIR/labels" ]; then cat "$FAKE_DIR/labels"; exit 0; fi; echo "gh: API недоступен" >&2; exit 1',
    'fi',
    'case "$1 $2" in',
    '  "issue view") if [ -f "$FAKE_DIR/comments.json" ]; then cat "$FAKE_DIR/comments.json"; exit 0; fi; echo "gh: API недоступен" >&2; exit 1 ;;',
    '  "issue comment") while [ $# -gt 0 ]; do if [ "$1" = "--body-file" ]; then cp "$2" "$FAKE_DIR/comment.md"; fi; shift; done ;;',
    '  "issue edit") ;;',
    '  *) echo "unexpected gh $*" >&2; exit 97 ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o755 });
  const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
  let tools = '';
  return {
    work, fake,
    run(script, env) {
      for (const name of ['gh-calls', 'comment.md']) rmSync(join(fake, name), { force: true });
      writeFileSync(join(temp, 'output'), '');
      const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
        cwd: work, encoding: 'utf8',
        env: {
          ...GIT_ENV, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp, FAKE_DIR: fake, GH_TOKEN: 'x', NUM: '7',
          GITHUB_OUTPUT: join(temp, 'output'), GITHUB_STEP_SUMMARY: join(temp, 'summary'), ...(tools ? { TOOLS: tools } : {}), ...env,
        },
      });
      return {
        status: r.status, stdout: r.stdout, stderr: r.stderr,
        output: parseOutput(read(join(temp, 'output'))), summary: read(join(temp, 'summary')),
        calls: read(join(fake, 'gh-calls')).split('\n').filter(Boolean), comment: read(join(fake, 'comment.md')),
      };
    },
    comments(list) {
      if (list === null) rmSync(join(fake, 'comments.json'), { force: true });
      else writeFileSync(join(fake, 'comments.json'), JSON.stringify({ comments: list }));
    },
    labels(list) {
      if (list === null) rmSync(join(fake, 'labels'), { force: true });
      else writeFileSync(join(fake, 'labels'), `${list.join(',')}\n`);
    },
    /** #749: шаг снимка job integrate как есть; его каталог дальше идёт шагам как TOOLS. */
    snapshot() {
      const r = this.run(stepRun(readFileSync(WORKFLOW, 'utf8'), TOOLS_STEP), {});
      assert.equal(r.status, 0, `снимок скриптов dev: ${r.stderr}`);
      assert.ok(r.output.dir && existsSync(join(r.output.dir, 'scripts', 'process-track.mjs')), 'снимок несёт скрипт трека');
      tools = r.output.dir;
      return tools;
    },
  };
}

const touchChange = (work) => writeFileSync(join(work, 'src', 'pointer-modality.ts'),
  "export const a = 1;\nexport const b = 2;\nexport const touch = (e) => e.pointerType === 'touch';\n");
const trackEnv = (labels, stage = 'code') => ({ STAGE: stage, LABELS: labels, BRANCH: 'issue/7-x', OWNER: 'Matysh' });

test('#707 AC4: шаг трека на настоящем bash — ship с риском без подтверждения повышается до show', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const { readFileSync: read } = await import('node:fs');
  const box = trackSandbox(t, { change: touchChange });
  const run = stepRun(read(WORKFLOW, 'utf8'), TRACK_STEP);
  box.comments([{ author: { login: 'claude[bot]' }, body: 'Трек: ship — решение владельца', createdAt: '2026-09-30T08:00:00Z' }]);
  const r = box.run(run, trackEnv('track:ship,S7-code-review'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^raise=true$/m);
  assert.deepEqual(r.calls, [
    'issue view 7 --repo o/r --json comments',
    `issue comment 7 --repo o/r --body-file ${join(dirname(box.work), 'runner', 'track', 'raise.md')}`,
    'issue edit 7 --repo o/r --add-label track:show --remove-label track:ship',
  ]);
  assert.match(r.comment, /Трек повышен: `track:ship` → `track:show`/);
  assert.match(r.comment, /- touch: src\/pointer-modality\.ts:3 · участок pointer-modality, токен pointerType/);
  assert.match(r.comment, /\[Прогон\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/42\)/);
  assert.equal(r.output.track, 'show');
  assert.equal(r.output.ship, 'false');
  assert.equal(r.output.mutants, 'false');
  assert.equal(r.output.full, 'false');
  assert.equal(r.output.risk, 'touch');
  assert.match(r.output.risk_note, /Трек show держится на «решать нечего»/);
  assert.equal(r.output.ship_risk, undefined);
  assert.match(r.summary, /трек \*\*show\*\* · основание: повышен конвейером с ship \(риск touch\); было: метка без подтверждения — предложение · риск по участкам: touch/);
});

test('#707 AC4: шаг трека на настоящем bash — ship, подтверждённый владельцем, остаётся; строка риска доходит до hp:ship-merge', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const { readFileSync: read } = await import('node:fs');
  const workflow = read(WORKFLOW, 'utf8');
  const box = trackSandbox(t, { change: touchChange });
  box.comments([{ author: { login: 'Matysh' }, body: 'Трек: ship — решение владельца', createdAt: '2026-09-30T08:00:00Z' }]);
  const r = box.run(stepRun(workflow, TRACK_STEP), trackEnv('track:ship,S7-code-review'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^raise=false$/m);
  assert.deepEqual(r.calls, ['issue view 7 --repo o/r --json comments'], 'ни комментария, ни смены меток');
  assert.equal(r.output.track, 'ship');
  assert.equal(r.output.ship, 'true');
  assert.equal(r.output.risk_note, undefined, 'модель на ship не зовётся');
  assert.match(r.output.ship_risk, /^Риск по участкам \(трек подтверждён владельцем, не повышен\): touch: src\/pointer-modality\.ts:3/);
  assert.match(r.output.basis, /^метка, подтверждённая владельцем \(2026-09-30\)$/);

  // Комментарий слияния ship: шаг «Решение по вердикту» как есть, с этой строкой риска.
  const { SHIP_MERGE_MARKER_RE, shipRiskFrom } = await import('../scripts/ship-review.mjs');
  const material = 'a'.repeat(40);
  const decide = stepRun(workflow, DECIDE_STEP).replaceAll('/tmp/ship-merge.md', join(box.fake, 'ship-merge.md'));
  const merged = box.run(decide, { OUT: '', STAGE: 'code', REUSE: 'false', SHIP: 'true', SHIP_RISK: r.output.ship_risk, MATERIAL: material, VALIDATE_URL: 'https://v' });
  assert.equal(merged.status, 0, merged.stderr);
  assert.equal(merged.output.green, 'true');
  assert.equal(SHIP_MERGE_MARKER_RE.exec(merged.comment)?.[1], material, 'маркер слияния по-прежнему находится');
  assert.deepEqual(shipRiskFrom([{ body: merged.comment }]), {
    classes: ['touch'], line: r.output.ship_risk.split('\n')[0],
  });
  // Без риска комментарий прежний: маркер есть, строки риска нет.
  const plain = box.run(decide, { OUT: '', STAGE: 'code', REUSE: 'false', SHIP: 'true', SHIP_RISK: '', MATERIAL: material, VALIDATE_URL: '' });
  assert.equal(SHIP_MERGE_MARKER_RE.exec(plain.comment)?.[1], material);
  assert.equal(shipRiskFrom([{ body: plain.comment }]), null);
});

// #755 AC3: дифф вида #741 — удалённый член интерфейса в участке perf — ship не
// повышает; то же тело в классе повышает (свидетель, что риск судится).
const ISO_BASE = (head) => (work) => writeFileSync(join(work, 'src', 'iso-scene-render.ts'),
  `export const before = 1;\n\n${head}\n  rooms: readonly string[];\n  stageSize?: { width: number; height: number } | null;\n}\n`);
const dropStageSize = (work) => {
  const file = join(work, 'src', 'iso-scene-render.ts');
  writeFileSync(file, readFileSync(file, 'utf8').replace('  stageSize?: { width: number; height: number } | null;\n', ''));
};

test('#755 AC3: шаг трека на настоящем bash — ship с удалённым членом интерфейса не повышается', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const { readFileSync: read } = await import('node:fs');
  const run = stepRun(read(WORKFLOW, 'utf8'), TRACK_STEP);
  const bot = [{ author: { login: 'claude[bot]' }, body: 'Трек: ship — решение владельца', createdAt: '2026-10-01T05:00:00Z' }];

  const box = trackSandbox(t, { base: ISO_BASE('export interface IsoOverlayFitEnvelopeInput {'), change: dropStageSize });
  box.comments(bot);
  const r = box.run(run, trackEnv('track:ship,S7-code-review'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^raise=false$/m);
  assert.deepEqual(r.calls, ['issue view 7 --repo o/r --json comments'], 'ни комментария повышения, ни смены меток');
  assert.equal(r.output.track, 'ship');
  assert.equal(r.output.ship, 'true');
  assert.equal(r.output.risk, '');

  const inClass = trackSandbox(t, { base: ISO_BASE('export class IsoOverlayFitEnvelope {'), change: dropStageSize });
  inClass.comments(bot);
  const raised = inClass.run(run, trackEnv('track:ship,S7-code-review'));
  assert.equal(raised.status, 0, raised.stderr);
  assert.match(raised.stdout, /^raise=true$/m);
  assert.equal(raised.output.track, 'show');
  assert.match(raised.comment, /- perf: src\/iso-scene-render\.ts:5 \(удалена\) · участок iso-scene-render/);
});

test('#707 AC4: шаг трека на настоящем bash — комментарии недоступны, этап spec, show', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const { readFileSync: read } = await import('node:fs');
  const run = stepRun(read(WORKFLOW, 'utf8'), TRACK_STEP);
  const box = trackSandbox(t, { change: touchChange });
  box.comments(null);
  const unknown = box.run(run, trackEnv('track:ship,S7-code-review'));
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.match(unknown.stdout, /^raise=true$/m, 'без комментариев подтверждения нет');
  assert.match(unknown.output.basis, /происхождение не установлено \(комментарии недоступны\)/);
  box.comments([]);
  const spec = box.run(run, trackEnv('track:ship,S4-spec-review', 'spec'));
  assert.equal(spec.status, 0, spec.stderr);
  assert.deepEqual({ track: spec.output.track, ship: spec.output.ship, raise: /^raise=true$/m.test(spec.stdout), risk: spec.output.risk },
    { track: 'ship', ship: 'false', raise: false, risk: '' }, 'этап spec — прежнее поведение, риск пуст');
  const show = box.run(run, trackEnv('track:show,S7-code-review'));
  assert.equal(show.status, 0, show.stderr);
  assert.equal(show.output.track, 'show');
  assert.equal(show.calls.length, 1, 'show не трогает меток');
  assert.match(show.output.risk_note, /- touch: src\/pointer-modality\.ts:3/);
});

// ---------- #726: маршрут вердикта — reclassify, вопрос владельцу, немедленный review-4 ----------

const SHOW = { stage: 'code', track: 'show', limit: 2 };
const pick = (d) => ({ to: d.to, addLabels: d.addLabels, removeLabels: d.removeLabels, kind: d.kind });

test('#726 AC2: таблица маршрутов — каждая строка даёт точные to, метки и kind', () => {
  const at = (over) => reviewRoute({ ...SHOW, verdict: 'yellow', high: 0, spent: 0, ...over });
  // green, High 0 — как сейчас: вперёд, меток нет.
  assert.deepEqual(pick(at({ verdict: 'green' })), { to: 'S8-merged', addLabels: [], removeLabels: [], kind: 'green' });
  assert.deepEqual(pick(reviewRoute({ stage: 'spec', track: 'ask', verdict: 'green', high: 0, spent: 0, limit: 4 })),
    { to: 'S5-ready', addLabels: [], removeLabels: [], kind: 'green' });
  assert.equal(at({ verdict: 'green', high: 1 }).kind, 'fix', 'зелёный с High — не зелёный');
  // code, show, не зелёный, reclassify, критерий из таблицы, не confirmed — ask и S3.
  for (const verdict of ['yellow', 'red']) {
    assert.deepEqual(pick(at({ verdict, route: 'reclassify', criterion: 'undocumented' })),
      { to: 'S3-spec', addLabels: ['track:ask'], removeLabels: ['track:show'], kind: 'reclassify' }, verdict);
  }
  for (const id of Object.keys(SHOW_CRITERIA)) assert.equal(at({ route: 'reclassify', criterion: id }).kind, 'reclassify', id);
  assert.deepEqual(Object.keys(SHOW_CRITERIA), ['complexity', 'surfaces', 'migration', 'ux-contract', 'perf-touch', 'undocumented']);
  assert.equal(at({ route: 'reclassify', criterion: 'migration', verdict: 'red', high: 2 }).kind, 'reclassify', 'High > 0 — маршрут тот же');
  // то же, confirmed — трек не меняется, blocked и вопрос владельцу.
  const owner = at({ route: 'reclassify', criterion: 'undocumented', confirmed: true });
  assert.deepEqual(pick(owner), { to: 'S6-in-progress', addLabels: ['blocked'], removeLabels: [], kind: 'owner-question' });
  assert.equal(owner.track, 'show', 'подтверждённый show не повышается');
  // не зелёный, fix — как сейчас.
  assert.deepEqual(pick(at({ route: 'fix' })), { to: 'S6-in-progress', addLabels: [], removeLabels: [], kind: 'fix' });
  assert.deepEqual(pick(reviewRoute({ stage: 'spec', track: 'ask', verdict: 'red', spent: 0, limit: 4 })),
    { to: 'S3-spec', addLabels: [], removeLabels: [], kind: 'fix' });
  // reclassify на ask, на spec, без критерия из таблицы — как fix с note.
  const ask = reviewRoute({ stage: 'code', track: 'ask', verdict: 'yellow', route: 'reclassify', criterion: 'undocumented', spent: 0, limit: 4 });
  assert.deepEqual(pick(ask), { to: 'S6-in-progress', addLabels: [], removeLabels: [], kind: 'fix' });
  assert.equal(ask.track, 'ask');
  assert.match(ask.note, /^маршрут reclassify не применён: трек `ask`/);
  const spec = reviewRoute({ stage: 'spec', track: 'show', verdict: 'yellow', route: 'reclassify', criterion: 'undocumented', spent: 0, limit: 2 });
  assert.deepEqual(pick(spec), { to: 'S3-spec', addLabels: [], removeLabels: [], kind: 'fix' });
  assert.match(spec.note, /^маршрут reclassify не применён: этап `spec`/);
  for (const criterion of ['', undefined, null]) {
    const none = at({ route: 'reclassify', criterion });
    assert.deepEqual(pick(none), { to: 'S6-in-progress', addLabels: [], removeLabels: [], kind: 'fix' }, String(criterion));
    assert.equal(none.note, 'маршрут reclassify не применён: критерий §5 не назван');
  }
  for (const criterion of ['vibes', 'UNDOCUMENTED', 'constructor', '__proto__', 42, { id: 'undocumented' }]) {
    const odd = at({ route: 'reclassify', criterion });
    assert.equal(odd.kind, 'fix', JSON.stringify(criterion));
    assert.equal(odd.track, 'show', 'трек не меняется');
    assert.match(odd.note, /^маршрут reclassify не применён: критерий `[^`]*` не из списка §5 \(complexity, surfaces, migration, ux-contract, perf-touch, undocumented\)$/);
  }
  assert.equal(at({ route: 'reclassify', criterion: 'vibes' }).note.includes('`vibes`'), true);
  // Текущие метки известны: снимается только стоящее, стоящее не ставится второй раз.
  const infra = at({ route: 'reclassify', criterion: 'surfaces', labels: ['S7-code-review', 'infra'] });
  assert.deepEqual([infra.addLabels, infra.removeLabels], [['track:ask'], []], 'инфраструктура без трековой метки — снимать нечего');
  assert.deepEqual(at({ route: 'reclassify', criterion: 'surfaces', confirmed: true, labels: ['track:show', 'blocked'] }).addLabels, [],
    'blocked уже стоит — метка одна');
});

test('#726 AC3: вердикт, исчерпавший бюджет, сразу ставит review-4; статус двигается по таблице', () => {
  const at = (over) => reviewRoute({ verdict: 'yellow', high: 0, route: 'fix', ...over });
  const row = (d) => ({ to: d.to, exhausted: d.exhausted, review4: d.addLabels.includes('review-4'), budget: `${d.spentAfter}/${d.limitAfter}` });
  assert.deepEqual(row(at({ ...SHOW, spent: 1 })), { to: 'S6-in-progress', exhausted: true, review4: true, budget: '2/2' }, 'show, spent 1, fix');
  assert.deepEqual(row(at({ ...SHOW, spent: 1, route: 'reclassify', criterion: 'undocumented' })),
    { to: 'S3-spec', exhausted: false, review4: false, budget: '2/4' }, 'show, spent 1, reclassify — лимит ask');
  assert.deepEqual(row(at({ stage: 'code', track: 'ask', spent: 3, limit: 4 })), { to: 'S6-in-progress', exhausted: true, review4: true, budget: '4/4' });
  assert.deepEqual(row(at({ stage: 'spec', track: 'ask', spent: 3, limit: 4 })), { to: 'S3-spec', exhausted: true, review4: true, budget: '4/4' });
  assert.deepEqual(row(at({ stage: 'code', track: 'ask', spent: 2, limit: 4 })), { to: 'S6-in-progress', exhausted: false, review4: false, budget: '3/4' });
  assert.deepEqual(row(at({ stage: 'code', track: 'ask', spent: 3, limit: 4, verdict: 'green' })),
    { to: 'S8-merged', exhausted: false, review4: false, budget: '3/4' }, 'зелёный цикла не образует');
  assert.deepEqual(row(at({ stage: 'code', track: 'ask', spent: 3, limit: 4, verdict: 'red' })).review4, true, 'красный — тоже цикл');
  // Вопрос владельцу на show при spent 1 — и вопрос, и review-4: лимит show не меняется.
  assert.deepEqual(at({ ...SHOW, spent: 1, route: 'reclassify', criterion: 'undocumented', confirmed: true }).addLabels, ['blocked', 'review-4']);
  // Входы guard не прочитаны — значения guard по умолчанию: 0 циклов, лимит трека.
  assert.equal(at({ stage: 'code', track: 'show', spent: '', limit: '' }).spentAfter, 1);
  assert.equal(at({ stage: 'code', track: 'show', spent: 'x', limit: undefined }).limitAfter, 2);
});

test('#726 AC4: бюджет код-ревью один на все треки — SPEC в счёт не входит, у ask лимит 4, r4 ставит review-4', () => {
  const doc = (round, route, criterion, colour = 'жёлтый') => withMaterialAnchors(`# REVIEW-7-r${round}\n\nВердикт: ${colour} · заход r${round} · High: 0 · Medium: 1\n`,
    { sha: 'a'.repeat(40), tree: 'b'.repeat(40), branch: 'issue/7-x', verdict: colour === 'зелёный' ? 'green' : 'yellow', high: 0, route, criterion });
  const tree = {
    'CODE-REVIEW-7-r1.md': doc(1, 'fix'), // show
    'CODE-REVIEW-7-r2.md': doc(2, 'reclassify', 'undocumented'),
    // Ревью ТЗ после reclassify — три захода, два блокирующих: свой этап и свой бюджет.
    'SPEC-REVIEW-7-r1.md': doc(1, 'fix'),
    'SPEC-REVIEW-7-r2.md': doc(2, 'fix'),
    'SPEC-REVIEW-7-r3.md': doc(3, 'fix', '', 'зелёный'),
  };
  // Счёт guard: те же функции, что у `review-doc-guard.mjs --counters`.
  const counters = (marker, files) => {
    const { rounds } = reviewRoundsFromFiles(Object.keys(files), marker, '7');
    return reviewCounters({ rounds, docs: rounds.map((r) => ({ name: `${marker}-7-r${r}.md`, text: files[`${marker}-7-r${r}.md`] })) });
  };
  // r2 на show: reclassify при одном прошлом цикле — ask, лимит 4, без review-4.
  const r2 = reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1, route: 'reclassify', criterion: 'undocumented' });
  assert.deepEqual([r2.kind, r2.exhausted, r2.spentAfter, r2.limitAfter], ['reclassify', false, 2, 4]);
  // Заход r3 после ревью ТЗ: трек ask, лимит 4, счёт кода — прежние 2.
  const code = counters('CODE-REVIEW', tree);
  assert.deepEqual([code.spent, code.attempt], [2, 3]);
  const { track, limit } = guardLimit({ labels: ['track:ask', 'S7-code-review'], files: ['src/a.ts'] });
  assert.deepEqual([track, limit], ['ask', cycleLimit('ask')]);
  assert.ok(code.spent < limit, 'guard пускает r3 (`spent -ge limit` ложно)');
  assert.deepEqual([counters('SPEC-REVIEW', tree).spent, counters('SPEC-REVIEW', tree).attempt], [2, 4], 'у ревью ТЗ свой бюджет');
  assert.deepEqual([counters('CODE-REVIEW', { ...tree, 'SPEC-REVIEW-7-r4.md': doc(4, 'fix') }).spent, counters('CODE-REVIEW', { ...tree, 'SPEC-REVIEW-7-r4.md': doc(4, 'fix') }).attempt], [2, 3],
    'SPEC-документы ни бюджет кода не тратят, ни номер захода не сдвигают');
  // Жёлтый r3 — без review-4; жёлтый r4 — review-4 сразу.
  const r3 = reviewRoute({ stage: 'code', track, verdict: 'yellow', spent: code.spent, limit });
  assert.deepEqual([r3.exhausted, r3.spentAfter], [false, 3]);
  const after3 = counters('CODE-REVIEW', { ...tree, 'CODE-REVIEW-7-r3.md': doc(3, 'fix') });
  assert.deepEqual([after3.spent, after3.attempt], [3, 4]);
  const r4 = reviewRoute({ stage: 'code', track, verdict: 'yellow', spent: after3.spent, limit });
  assert.deepEqual([r4.exhausted, r4.addLabels, r4.to, r4.spentAfter], [true, ['review-4'], 'S6-in-progress', 4]);
});

test('#726 К3: комментарии маршрута — первая строка, критерий словами, документы путями, бюджет, hp:route', () => {
  const docs = [{ name: 'CODE-REVIEW-7-r2.md', text: '' }, { name: 'CODE-REVIEW-7-r1.md', text: '' }];
  const raised = routeComment({
    decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1, route: 'reclassify', criterion: 'undocumented' }),
    num: '7', cycle: '2', branch: 'issue/7-x', spent: 1, docs, blocking: ['CODE-REVIEW-7-r1.md'], runUrl: 'https://run/1',
  });
  assert.equal(raised.split('\n')[0], '**Ревью show: решать есть что — трек повышен до `track:ask`.**');
  assert.ok(raised.includes(`**${SHOW_CRITERIA.undocumented}** (\`undocumented\`)`), 'критерий словами');
  assert.match(raised, /Документы код-ревью ветки `issue\/7-x`:\n- `docs\/reviews\/CODE-REVIEW-7-r1\.md`\n- `docs\/reviews\/CODE-REVIEW-7-r2\.md`\n/);
  assert.ok(raised.includes('код остаётся в ветке; полное ТЗ по §7.1 — в теле issue под `## ТЗ`; коммиты класса A — после `S5`'));
  assert.match(raised, /Бюджет код-ревью: 2\/4/);
  assert.match(raised, /\[Прогон\]\(https:\/\/run\/1\)\.\n\n<!-- hp:route reclassify criterion=undocumented -->\n$/);
  assert.doesNotMatch(raised, /Лимит циклов/);

  const question = routeComment({
    decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 0, route: 'reclassify', criterion: 'perf-touch', confirmed: true }),
    num: '7', cycle: '1', branch: 'issue/7-x', spent: 0, docs: [{ name: 'CODE-REVIEW-7-r1.md', text: '' }],
  });
  assert.equal(question.split('\n')[0], '**Ревью show: решать есть что — вопрос владельцу.**');
  assert.match(question, /- \*\*Что неясно:\*\* выполнен ли критерий §5 «нет влияния на производительность и на touch-контракт» \(`perf-touch`\)\. Ревью считает, что нет: вердикт — `docs\/reviews\/CODE-REVIEW-7-r1\.md`/);
  assert.match(question, /\n- \*\*Что изменится от ответа:\*\* [^\n]+\n- \*\*Вариант по умолчанию:\*\* повысить до `track:ask`\.\n/, 'одним блоком по §7.1');
  assert.match(question, /Как ответить: повысить — метка `track:ask` \(и строка `Трек: ask — решение владельца`\) и снять `blocked`[^;]*; оставить `show` — снять `blocked`, автор чинит по вердикту\./);
  assert.match(question, /<!-- hp:route owner-question criterion=perf-touch -->\n$/);
  assert.doesNotMatch(question, /review-4|Лимит циклов/);
  // Конвейер пишет от учётной записи владельца: его комментарии трек не подтверждают.
  for (const body of [raised, question]) {
    assert.equal(trackOrigin({ labels: ['track:ask'], owner: 'Matysh', comments: [{ author: 'Matysh', body, createdAt: '2' }] }).confirmed, false);
  }

  // Исчерпание: прежний префикс первой строкой, счёт, перечень, варианты §4 и четвёртый на show.
  const r = (n) => ({ name: `CODE-REVIEW-7-r${n}.md`, text: '' });
  const exhausted = routeComment({
    decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1 }), num: '7', cycle: '3', branch: 'issue/7-x', spent: 1,
    docs: [r(1), r(2), r(3)], blocking: ['CODE-REVIEW-7-r2.md', 'CODE-REVIEW-7-r3.md'],
  });
  assert.match(exhausted, /^Лимит циклов ревью исчерпан: блокирующих циклов 2 из 2 на этапе `code` — последний израсходовал этот вердикт \(заход r3\)\. Задача возвращена в `S6-in-progress` и получила `review-4`/);
  assert.match(exhausted, /зелёные бюджет не тратят:\n- `docs\/reviews\/CODE-REVIEW-7-r2\.md`\n- `docs\/reviews\/CODE-REVIEW-7-r3\.md` — этот заход\n/, 'зелёный r1 не учтён');
  assert.match(exhausted, /1\. \*\*разделить\*\*[^\n]+\n2\. \*\*отклонить\*\*[^\n]+\n3\. \*\*арбитраж владельца\*\*[^\n]+;\n4\. \*\*повысить до `ask`\*\*: лимит станет 4, `review-4` снимает владелец\.\n/);
  assert.doesNotMatch(exhausted, /hp:route/);
  const onAsk = routeComment({ decision: reviewRoute({ stage: 'code', track: 'ask', verdict: 'red', spent: 3, limit: 4 }), num: '7', cycle: '5', spent: 3, blocking: ['CODE-REVIEW-7-r2.md'] });
  assert.match(onAsk, /^Лимит циклов ревью исчерпан: блокирующих циклов 4 из 4/);
  assert.match(onAsk, /- `docs\/reviews\/CODE-REVIEW-7-r2\.md`\n- ещё 2 — по комментариям с вердиктом \(страховка счёта, #454\)\n- `docs\/reviews\/CODE-REVIEW-7-r5\.md` — этот заход/,
    'счёт по комментариям виден в перечне');
  assert.doesNotMatch(onAsk, /повысить до/, 'на ask четвёртого варианта нет');
  // Исчерпание с вопросом владельцу — один комментарий, исчерпание первым.
  const both = routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1, route: 'reclassify', criterion: 'surfaces', confirmed: true }), num: '7', cycle: '2', spent: 1 });
  assert.match(both, /^Лимит циклов ревью исчерпан[\s\S]+\n\n\*\*Ревью show: решать есть что — вопрос владельцу\.\*\*\n[\s\S]+<!-- hp:route owner-question criterion=surfaces -->\n$/);

  // fix с note — строка «маршрут reclassify не применён: <причина>»; без note и зелёный — комментария нет.
  const note = routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 0, route: 'reclassify', criterion: 'vibes' }), num: '7', cycle: '1', spent: 0 });
  assert.match(note, /^Маршрут reclassify не применён: критерий `vibes` не из списка §5 [^\n]+\. Вердикт возвращает задачу автору как `fix`: `S6-in-progress`\.\n$/);
  const noteExhausted = routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1, route: 'reclassify' }), num: '7', cycle: '2', spent: 1 });
  assert.match(noteExhausted, /^Лимит циклов ревью исчерпан[\s\S]+\n\nМаршрут reclassify не применён: критерий §5 не назван\./, 'note — в том же комментарии');
  assert.equal(routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 0 }), num: '7', cycle: '1' }), '');
  assert.equal(routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'green', spent: 1 }), num: '7', cycle: '2' }), '');
  // Недоверенный criterion в текст конвейера не протекает.
  const evil = routeComment({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 0, route: 'reclassify', criterion: 'q` --> <b>' }), num: '7', cycle: '1' });
  assert.match(evil, /критерий `q\?\?--\?\?\?b\?` не из списка/);
  assert.doesNotMatch(evil, /q`|-->|<b>/);
  // Сводка прогона: маршрут и бюджет после вердикта.
  assert.equal(routeSummary({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1, route: 'reclassify', criterion: 'undocumented' }) }),
    '- маршрут вердикта **reclassify** (критерий `undocumented`) → `S3-spec` · блокирующих циклов этапа code: 2/4\n');
  assert.match(routeSummary({ decision: reviewRoute({ ...SHOW, verdict: 'yellow', spent: 1 }) }), /\*\*fix\*\* → `S6-in-progress` · блокирующих циклов этапа code: 2\/2 · `review-4`/);
});

test('#726 К1: критерии маршрута — пункты «Подсказки аналитику» §5 дословно', () => {
  const canon = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'PROCESS.md'), 'utf8');
  const norm = (text) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').toLowerCase();
  const section = norm(sectionText(canon, '5-треки-ship-show-ask--метка-владельца'));
  for (const [id, text] of Object.entries(SHOW_CRITERIA)) {
    assert.ok(section.includes(norm(text)), `${id}: «${text}» нет в PROCESS.md §5`);
    assert.ok(section.includes(`\`${id}\``), `${id}: идентификатор не назван в §5`);
  }
});

test('#726 AC5: схема вердикта, заметка маршрута в промпте, публикация передаёт маршрут', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const schema = JSON.parse(/--json-schema '([^']+)'/.exec(workflow)[1]);
  assert.deepEqual(schema.properties.route, { type: 'string', enum: ['fix', 'reclassify'] });
  assert.deepEqual(schema.properties.criterion, { type: 'string' });
  assert.ok(schema.required.includes('route'), 'route обязателен');
  assert.ok(!schema.required.includes('criterion'), 'criterion необязателен');
  const prompt = workflow.slice(workflow.indexOf('          prompt: |\n'), workflow.indexOf('          claude_args: |'));
  assert.match(prompt, /\n\s+\$\{\{ needs\.prepare\.outputs\.route_note \}\}\n/, 'заметка маршрута доходит до промпта');
  const prepare = workflow.slice(workflow.indexOf('\n  prepare:'), workflow.indexOf('    steps:', workflow.indexOf('\n  prepare:')));
  assert.match(prepare, /route_note: \$\{\{ steps\.track\.outputs\.route_note \}\}/);
  assert.match(prepare, /confirmed: \$\{\{ steps\.track\.outputs\.confirmed \}\}/);
  // Текст заметки: на show/code — поля и список критериев, на прочих — route: fix.
  const show = routeNote({ stage: 'code', track: 'show' });
  assert.match(show, /`route: reclassify` и `criterion` — если задача не проходит критерий §5 из списка ниже; иначе `route: fix`\. `reclassify` — не зелёный вердикт/);
  for (const [id, text] of Object.entries(SHOW_CRITERIA)) assert.ok(show.includes(`\n- \`${id}\` — ${text}`), id);
  assert.match(routeNote({ stage: 'code', track: 'show', confirmed: true }), /подтверждён владельцем — конвейер его не повысит, а поставит `blocked`/);
  for (const other of [{ stage: 'code', track: 'ask' }, { stage: 'spec', track: 'show' }, { stage: 'spec', track: 'ask' }, { stage: 'code', track: 'ship' }]) {
    assert.equal(routeNote(other), '**Маршрут вердикта (#726):** `route: fix`.', JSON.stringify(other));
  }
  assert.equal(s7({ comments: ownerSays('ship') }).routeNote, '', 'ship в рамках модель не зовёт');
  // Публикация: маршрут и критерий — в якорь документа.
  const publish = stepRun(workflow, PUBLISH_STEP);
  assert.match(publish, /route=\$\(printf '%s' "\$OUT" \| jq -r '\.route \/\/ empty' 2>\/dev\/null \|\| true\)/);
  assert.match(publish, /criterion=\$\(printf '%s' "\$OUT" \| jq -r '\.criterion \/\/ empty' 2>\/dev\/null \|\| true\)/);
  assert.match(publish, /--verdict="\$verdict" --high="\$high" \\\n\s+--route="\$route" --criterion="\$criterion"\n/);
});

test('#726 AC5: шаг решения — один вызов process-track.mjs route, метки только по его выходу, ship и reuse его не зовут', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const run = stepRun(workflow, DECIDE_STEP);
  assert.equal((run.match(/process-track\.mjs/g) || []).length, 1, 'один вызов скрипта');
  assert.match(run, /route=\$\(node "\$TOOLS\/scripts\/process-track\.mjs" route --stage="\$STAGE" --track="\$TRACK" \\\n\s+--confirmed="\$CONFIRMED" --labels="\$labels" --verdict="\$RUNNER_TEMP\/route-verdict\.json"/);
  // #749: скрипт — из снимка dev на всю job, своего извлечения у шага нет.
  assert.doesNotMatch(run, /git archive/, 'скрипт — из снимка dev');
  assert.equal((run.match(/gh issue edit/g) || []).length, 1, 'метки меняются в одном месте');
  assert.match(run, /if \[ -n "\$add" \]; then edit\+=\(--add-label "\$add"\); fi\n\s+if \[ -n "\$remove" \]; then edit\+=\(--remove-label "\$remove"\); fi/);
  assert.match(run, /add=\$\(field add_labels\); remove=\$\(field remove_labels\); comment=\$\(field comment\)/);
  assert.match(run, /--body-file "\$comment"/, 'тело комментария — файл скрипта');
  assert.doesNotMatch(run, /--add-label (?:review-4|blocked|track:)/, 'ни одной метки, вписанной в bash');
  // Ветки ship и reuse — до вызова скрипта, без него.
  const call = run.indexOf('process-track.mjs');
  assert.ok(run.indexOf('elif [ "$REUSE" = "true" ]; then') < call && run.indexOf('if [ "$SHIP" = "true" ] && [ "$REUSE" != "true" ]; then') < call);
  assert.equal((run.match(/green_forward$/gm) || []).length, 2, 'ship и reuse — прежнее зелёное решение');
  const step = workflow.slice(workflow.indexOf(DECIDE_STEP), workflow.indexOf('      - name: dev ушёл вперёд'));
  for (const env of ['TRACK: ${{ needs.prepare.outputs.track }}', 'CONFIRMED: ${{ needs.prepare.outputs.confirmed }}',
    'SPENT: ${{ needs.guard.outputs.spent }}', 'LIMIT: ${{ needs.guard.outputs.limit }}', 'CYCLE: ${{ needs.guard.outputs.cycle }}',
    'BRANCH: ${{ needs.prepare.outputs.branch }}', 'LABELS: ${{ needs.guard.outputs.labels }}', 'TOOLS: ${{ steps.tools.outputs.dir }}']) {
    assert.ok(step.includes(`          ${env}\n`), env);
  }
  // Многострочного текста в новой ветке нет: heredoc — только прежний комментарий слияния ship.
  assert.equal((run.match(/<<EOF/g) || []).length, 1);
});

const reviewDocText = (round, colour) => `# CODE-REVIEW-7-r${round}\n\nВердикт: ${colour} · заход r${round} · High: 0 · Medium: 1\n`;
/** Ветка материала после публикации: документы ревью этой задачи и чужой SPEC. */
const docsChange = (rounds) => (work) => {
  mkdirSync(join(work, 'docs', 'reviews'), { recursive: true });
  for (const [round, colour] of rounds) writeFileSync(join(work, 'docs', 'reviews', `CODE-REVIEW-7-r${round}.md`), reviewDocText(round, colour));
  writeFileSync(join(work, 'docs', 'reviews', 'SPEC-REVIEW-7-r1.md'), '# SPEC-REVIEW-7-r1\n\nВердикт: жёлтый · High: 0\n');
  writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-70-r1.md'), reviewDocText(1, 'жёлтый'));
};
const verdictOut = (over = {}) => JSON.stringify({ verdict: 'yellow', high: 0, medium: 1, summary: 's', ...over });
const decideEnv = (over = {}) => ({
  OUT: verdictOut(), STAGE: 'code', REUSE: 'false', SHIP: 'false', SHIP_RISK: '', MATERIAL: 'a'.repeat(40), VALIDATE_URL: '',
  TRACK: 'show', CONFIRMED: 'false', LABELS: 'track:show,S7-code-review', SPENT: '1', LIMIT: '2', CYCLE: '2', BRANCH: 'issue/7-x', ...over,
});
const routeLines = (stdout) => Object.fromEntries(stdout.split('\n').map((line) => /^([a-z_]+)=(.*)$/.exec(line)).filter(Boolean).map((m) => [m[1], m[2]]));
const LABELS_VIEW = 'issue view 7 --repo o/r --json labels --jq [.labels[].name] | join(",")';

test('#726 AC5: шаг решения на настоящем bash — reclassify: ask, S3-spec, комментарий с hp:route и перечнем CODE-REVIEW', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const box = trackSandbox(t, { change: docsChange([[1, 'жёлтый'], [2, 'жёлтый']]) });
  box.snapshot();
  const run = stepRun(readFileSync(WORKFLOW, 'utf8'), DECIDE_STEP);
  box.labels(['track:show', 'S7-code-review', 'P2']);
  const r = box.run(run, decideEnv({ OUT: verdictOut({ route: 'reclassify', criterion: 'undocumented' }) }));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const route = routeLines(r.stdout);
  const commentPath = join(dirname(box.work), 'runner', 'route', 'comment.md');
  assert.deepEqual(r.calls, [
    LABELS_VIEW,
    `issue comment 7 --repo o/r --body-file ${commentPath}`,
    `issue edit 7 --repo o/r --add-label ${route.add_labels} --remove-label ${route.remove_labels}`,
  ]);
  assert.deepEqual([route.add_labels, route.remove_labels, route.kind], ['track:ask', 'track:show', 'reclassify'], 'метки — по выходу скрипта');
  assert.deepEqual({ green: r.output.green, from: r.output.from, to: r.output.to }, { green: 'false', from: 'S7-code-review', to: 'S3-spec' });
  assert.equal(r.comment.split('\n')[0], '**Ревью show: решать есть что — трек повышен до `track:ask`.**');
  assert.match(r.comment, /- `docs\/reviews\/CODE-REVIEW-7-r1\.md`\n- `docs\/reviews\/CODE-REVIEW-7-r2\.md`\n/);
  assert.doesNotMatch(r.comment, /CODE-REVIEW-70|SPEC-REVIEW/, 'только документы код-ревью этой задачи');
  assert.match(r.comment, /Бюджет код-ревью: 2\/4/);
  assert.match(r.comment, /\[Прогон\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/42\)/);
  assert.match(r.comment, /<!-- hp:route reclassify criterion=undocumented -->\n$/);
  assert.match(r.summary, /^- маршрут вердикта \*\*reclassify\*\* \(критерий `undocumented`\) → `S3-spec` · блокирующих циклов этапа code: 2\/4$/m);
  // Метки не прочитаны — берутся метки guard.
  box.labels(null);
  const fallback = box.run(run, decideEnv({ OUT: verdictOut({ route: 'reclassify', criterion: 'undocumented' }) }));
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.equal(fallback.calls.at(-1), 'issue edit 7 --repo o/r --add-label track:ask --remove-label track:show');
});

test('#726 AC5: шаг решения на настоящем bash — исчерпание, вопрос владельцу, fix, зелёный и сбой скрипта', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const box = trackSandbox(t, { change: docsChange([[1, 'жёлтый'], [2, 'жёлтый']]) });
  box.snapshot();
  const run = stepRun(readFileSync(WORKFLOW, 'utf8'), DECIDE_STEP);
  box.labels(['track:show', 'S7-code-review']);
  const commentPath = join(dirname(box.work), 'runner', 'route', 'comment.md');
  // show, spent 1, fix — review-4 этим же вердиктом, возврат в S6.
  const exhausted = box.run(run, decideEnv());
  assert.equal(exhausted.status, 0, exhausted.stderr + exhausted.stdout);
  assert.deepEqual(exhausted.calls, [LABELS_VIEW, `issue comment 7 --repo o/r --body-file ${commentPath}`, 'issue edit 7 --repo o/r --add-label review-4']);
  assert.match(exhausted.comment, /^Лимит циклов ревью исчерпан: блокирующих циклов 2 из 2 на этапе `code`/);
  assert.match(exhausted.comment, /- `docs\/reviews\/CODE-REVIEW-7-r1\.md`\n- `docs\/reviews\/CODE-REVIEW-7-r2\.md` — этот заход\n/);
  assert.equal(exhausted.output.to, 'S6-in-progress');
  assert.match(exhausted.summary, /· `review-4`$/m);
  // Подтверждённый show: blocked и вопрос владельцу; blocked уже стоит — метка не ставится второй раз.
  box.comments([]);
  const question = box.run(run, decideEnv({ CONFIRMED: 'true', SPENT: '0', CYCLE: '1', OUT: verdictOut({ route: 'reclassify', criterion: 'surfaces' }) }));
  assert.equal(question.status, 0, question.stderr);
  assert.deepEqual(question.calls.slice(1), [`issue comment 7 --repo o/r --body-file ${commentPath}`, 'issue edit 7 --repo o/r --add-label blocked']);
  assert.equal(question.comment.split('\n')[0], '**Ревью show: решать есть что — вопрос владельцу.**');
  assert.equal(question.output.to, 'S6-in-progress');
  box.labels(['track:show', 'S7-code-review', 'blocked']);
  const again = box.run(run, decideEnv({ CONFIRMED: 'true', SPENT: '0', CYCLE: '1', OUT: verdictOut({ route: 'reclassify', criterion: 'surfaces' }) }));
  assert.deepEqual(again.calls.slice(1), [`issue comment 7 --repo o/r --body-file ${commentPath}`], 'комментарий один, меток не трогает');
  // Обычный fix без исчерпания — ни комментария, ни меток; статус — S6.
  box.labels(['track:show', 'S7-code-review']);
  const fix = box.run(run, decideEnv({ SPENT: '0', CYCLE: '1' }));
  assert.equal(fix.status, 0, fix.stderr);
  assert.deepEqual(fix.calls, [LABELS_VIEW]);
  assert.deepEqual({ green: fix.output.green, to: fix.output.to }, { green: 'false', to: 'S6-in-progress' });
  // Зелёный — вперёд, как раньше.
  const green = box.run(run, decideEnv({ SPENT: '1', OUT: verdictOut({ verdict: 'green', medium: 0, route: 'fix' }) }));
  assert.equal(green.status, 0, green.stderr);
  assert.deepEqual(green.calls, [LABELS_VIEW]);
  assert.deepEqual({ green: green.output.green, from: green.output.from, to: green.output.to }, { green: 'true', from: 'S7-code-review', to: 'S8-merged' });
  // Противоречивый вердикт — шаг падает до комментария и меток: метка не меняется, зовётся владелец.
  const broken = box.run(run, decideEnv({ OUT: verdictOut({ verdict: 'green', route: 'reclassify', criterion: 'undocumented' }) }));
  assert.notEqual(broken.status, 0);
  assert.deepEqual(broken.calls, [LABELS_VIEW]);
  assert.equal(broken.output.green, undefined, 'исхода нет');
  assert.match(broken.stderr, /reclassify при зелёном вердикте/);
});

test('#726 AC5: шаг трека на настоящем bash — confirmed и заметка маршрута для промпта', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const box = trackSandbox(t, { change: touchChange });
  const run = stepRun(readFileSync(WORKFLOW, 'utf8'), TRACK_STEP);
  box.comments([]);
  const show = box.run(run, trackEnv('track:show,S7-code-review'));
  assert.equal(show.status, 0, show.stderr);
  assert.equal(show.output.confirmed, 'false');
  assert.equal(show.output.route_note, routeNote({ stage: 'code', track: 'show' }));
  box.comments([{ author: { login: 'Matysh' }, body: 'Трек: show — решение владельца', createdAt: '2026-09-30T08:00:00Z' }]);
  const confirmed = box.run(run, trackEnv('track:show,S7-code-review'));
  assert.equal(confirmed.output.confirmed, 'true');
  assert.match(confirmed.output.route_note, /поставит `blocked`/);
  const ask = box.run(run, trackEnv('track:ask,S7-code-review'));
  assert.equal(ask.output.route_note, '**Маршрут вердикта (#726):** `route: fix`.');
  const spec = box.run(run, trackEnv('track:show,S4-spec-review', 'spec'));
  assert.equal(spec.output.route_note, '**Маршрут вердикта (#726):** `route: fix`.');
});
