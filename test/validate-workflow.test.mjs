import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOB_RULES } from '../scripts/ci-proof.mjs';
import { validateJobs } from '../scripts/workflow-jobs.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';
import { posixCommand, shellPath } from './helpers/posix-shell.mjs';

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
  const needs = new Map(), chunks = new Map();
  for (const name of names) {
    const start = body.indexOf(`\n  ${name}:\n`);
    const next = names
      .map((other) => body.indexOf(`\n  ${other}:\n`))
      .filter((index) => index > start);
    const chunk = body.slice(start, next.length ? Math.min(...next) : body.length);
    chunks.set(name, chunk);
    const line = chunk.match(/^ {4}needs:\s*(.+)$/m)?.[1] || '';
    needs.set(name, [...line.matchAll(/[a-zA-Z0-9_-]+/g)].map((match) => match[0]));
  }
  return { names, needs, chunks };
};

test('#1064 full shards have a finite 35-minute budget, independent of selected execution', () => {
  for (const file of ['validate.yml', 'validate-product.yml']) {
    const { chunks } = jobsOf(read(file));
    assert.match(chunks.get('smoke'), /^    timeout-minutes: 35$/m, file);
    assert.match(chunks.get('browser_selected'), /^    timeout-minutes: 50$/m, file);
    assert.match(chunks.get('smoke'), /fail-fast: false\n\s+matrix:\n\s+shard: \[1, 2, 3\]/, file);
    assert.match(chunks.get('smoke'), /timeout --kill-after=10s 180s node "\$f"/, file);
  }
});

test('#1064 actual full-shard shell partitions every scenario and retains failure/empty guards', (t) => {
  if (spawnSync(posixCommand('bash'), ['--version']).status !== 0) { t.skip('bash unavailable'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-full-shard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'demo'));
  const names = Array.from({ length: 7 }, (_, index) => `smoke_1064_${index}`);
  for (const [index, name] of names.entries()) {
    writeFileSync(join(root, 'demo', `${name}.mjs`), `process.exit(${index === 0 ? 7 : 0});\n`);
  }
  const step = findStep(read('validate.yml'), { name: 'Smoke suite (шард ${{ matrix.shard }} из 3)' });
  const run = shard => runStep(step, undefined, { cwd: root,
    env: { ...process.env, SHARD: String(shard), SHARDS: '3' } });
  const visited = [];
  for (const shard of [1, 2, 3]) {
    const result = run(shard);
    assert.equal(result.status, shard === 1 ? 1 : 0, result.stderr + result.stdout);
    const observed = [...result.stdout.matchAll(/^(?:ok\s+|FAIL )(smoke_1064_\d+)$/gm)].map(match => match[1]);
    assert.deepEqual(observed, names.filter((_, index) => index % 3 + 1 === shard),
      'the failed first child must not suppress later children or move them to another shard');
    visited.push(...observed);
  }
  assert.deepEqual(visited.sort(), names, 'the same full corpus is covered exactly once');
  for (const name of names.slice(1)) rmSync(join(root, 'demo', `${name}.mjs`));
  const empty = run(2);
  assert.notEqual(empty.status, 0, empty.stderr + empty.stdout);
  assert.match(empty.stdout, /прогнано 0 из 1\nшард пуст/);
});

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

test('one cold producer and verified bundle distribution precede all consumers (#336/#981)', () => {
  const workflow = read('validate.yml'), { chunks } = jobsOf(workflow);
  assert.equal([...workflow.matchAll(/^ +run: npm run build$/gm)].length, 1);
  const frontend = chunks.get('frontend'), bundle = chunks.get('bundle');
  assert.match(frontend, /name: producer-card-bundle\n\s+path: dist\//);
  assert.match(frontend, /name: producer-test-build\n\s+include-hidden-files: true\n\s+path: test-build\//);
  assert.match(bundle, /needs: \[changes, reuse, frontend\]/);
  assert.match(bundle, /if: always\(\).*needs\.frontend\.result == 'success'.*needs\.frontend\.result == 'skipped'/);
  assert.match(bundle, /ci-registry-build\.mjs/);
  assert.match(bundle, /with: \{ fetch-depth: 0, filter: 'blob:none' \}/, 'bundle-policy inspects the actual parent diff');
  for (const id of ['dev_build', 'browser_selected', 'smoke', 'golden', 'performance_smoke', 'product_guards']) {
    const chunk = chunks.get(id);
    assert.match(chunk, /needs:.*bundle/, id + ' waits for authenticated artifacts');
    const clear = chunk.indexOf(".rmSync('dist'");
    const download = chunk.indexOf('name: card-bundle');
    assert.ok(clear > 0 && download > clear, id + ' removes stale hashed assets before download');
  }
  assert.match(bundle, /name: card-test-build\n\s+include-hidden-files: true\n\s+path: test-build\//);
  for (const id of ['smoke', 'browser_selected', 'product_guards']) assert.match(chunks.get(id), /name: card-test-build/);
  assert.equal(workflow.match(/node scripts\/bundle-sync\.mjs/g)?.length, 5, 'four full/selected workers and one candidate smoke');
});

test('a reused frontend cannot suppress fresh guards, missing browser proofs or dev publication (#981)', () => {
  for (const file of ['validate.yml', 'validate-product.yml']) {
    const { chunks } = jobsOf(read(file));
    const needs = { frontend: { result: 'skipped' }, bundle: { result: 'success' },
      product_guards: { result: 'success' }, smoke: { result: 'success' },
      changes: { result: 'success', outputs: { heavy: 'true', golden: 'true', browser_subset: 'true' } },
      reuse: { result: 'success', outputs: { smoke: 'false', golden: 'false', performance_smoke: 'false' } } };
    const github = { event_name: 'push', ref: 'refs/heads/dev' };
    const eligible = id => {
      const expression = chunks.get(id).match(/^    if: (.+)$/m)?.[1] || 'true';
      // GHA adds implicit success() unless the condition has a status check;
      // a skipped ancestor makes that implicit success false even after bundle.
      const implicitSuccess = Object.values(needs).every(row => row.result === 'success');
      if (!/\b(?:always|success|failure|cancelled)\(/.test(expression) && !implicitSuccess) return false;
      return Function('needs', 'github', 'always', 'success', 'return (' + expression + ')')(
        needs, github, () => true, () => implicitSuccess);
    };
    const consumers = ['product_guards', 'browser_selected', 'smoke', 'golden', 'performance_smoke', 'dev_build', 'smoke_done'];
    for (const id of consumers) assert.equal(eligible(id), true, file + '/' + id + ': skipped producer, green assembled bundle');
    needs.bundle.result = 'failure';
    for (const id of consumers.filter(id => id !== 'smoke_done')) assert.equal(eligible(id), false, file + '/' + id + ': red bundle');
    needs.bundle.result = 'success';
    needs.product_guards.result = 'failure';
    assert.equal(eligible('dev_build'), false, 'stand publication retains fresh guard authority');
    needs.product_guards.result = 'success';
    needs.smoke.result = 'failure';
    assert.equal(eligible('smoke_done'), false, 'one failed direct shard cannot become PASS');
    needs.smoke.result = 'success';
    for (const id of ['smoke', 'golden', 'performance_smoke']) {
      needs.reuse.outputs[id] = 'true';
      assert.equal(eligible(id), false, file + '/' + id + ': authenticated producer suppresses the full worker');
    }
  }
});

test('fresh dist precedes pure units and filesystem/budget consumers (#663/#981)', () => {
  const { chunks } = jobsOf(read('validate.yml')), frontend = chunks.get('frontend'), guards = chunks.get('product_guards');
  assert.ok(frontend.indexOf('- name: Build') < frontend.indexOf('- name: Pure product units'));
  assert.match(frontend, /frontend-units.mjs --group=reusable/);
  assert.doesNotMatch(frontend, /frontend-units.mjs --group=fresh/);
  assert.match(guards, /needs: \[changes, bundle\]/);
  assert.match(guards, /frontend-units.mjs --group=fresh --suite=product/);
  assert.match(guards, /bundle-budget.mjs/);
  assert.match(guards, /no-new-any.mjs/);
});

test('#657 копии бандла сверяются только на релизном коммите, стенд dev — из артефакта', () => {
  const workflow = read('validate.yml');
  const frontend = workflow.slice(workflow.indexOf('\n  frontend:\n'), workflow.indexOf('\n  dev_build:\n'));
  const bundle = jobsOf(workflow).chunks.get('bundle');
  assert.match(bundle, /node scripts\/bundle-policy\.mjs --verify/,
    'fresh packaging retains release-only committed mirror policy');
  assert.doesNotMatch(frontend, /bundle-tree\.mjs dist custom_components/,
    'безусловная сверка красила бы каждую задачу, не коммитящую бандл');
  const devBuild = workflow.slice(workflow.indexOf('\n  dev_build:\n'), workflow.indexOf('\n  smoke:\n'));
  assert.match(devBuild, /if: always\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev'/);
  assert.match(devBuild, /needs: \[bundle, product_guards\]/);
  assert.match(devBuild, /contents: write/);
  assert.match(devBuild, /name: card-bundle\n\s+path: dist/);
  assert.match(devBuild, /node scripts\/dev-build\.mjs --sha "\$GITHUB_SHA" --dist dist/);
  assert.match(devBuild, /continue-on-error: true/, 'сбой публикации для стенда не красит проверку кода');
  const proof = workflow.slice(workflow.indexOf('\n  proof:\n'));
  assert.doesNotMatch(proof.split('\n').find((line) => /needs:/.test(line)) || '', /dev_build/,
    'стенд — не вход доказательства');
});

test('#835 вебхук своей инсталляции: только при изменении интеграции, без утечки адреса', () => {
  const workflow = read('validate.yml');
  const devBuild = workflow.slice(workflow.indexOf('\n  dev_build:\n'), workflow.indexOf('\n  smoke:\n'));
  assert.match(devBuild, /name: Опубликовать в dev-build\n\s+id: publish\n/);
  const hook = devBuild.slice(devBuild.indexOf('name: Разбудить свою инсталляцию HA'));
  assert.match(hook, /^name: Разбудить свою инсталляцию HA\n\s+if: steps\.publish\.outputs\.changed == 'true'\n/,
    'push только документации (тот же integrationTree) установку не будит');
  assert.match(hook, /HP_HA_DEV_WEBHOOK: \$\{\{ secrets\.HP_HA_DEV_WEBHOOK \}\}/);
  assert.match(hook, /if \[ -z "\$HP_HA_DEV_WEBHOOK" \]; then[\s\S]*?exit 0/, 'без секрета шаг — no-op');
  assert.doesNotMatch(hook, /echo[^\n]*\$HP_HA_DEV_WEBHOOK|set -x|--verbose|-v /, 'адрес вебхука не печатается');
  assert.match(hook, /curl --silent --fail/, 'текст ошибки curl с адресом не попадает в лог');
});

test('предполётные проверки не прячут друг друга (#336)', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(
    workflow.indexOf('\n  preflight:\n'), workflow.indexOf('\n  changes:\n'),
  );
  // #556 добавил пятый сигнал — пины сторонних Actions. Число берётся из
  // списка, а не из магической константы: иначе каждая новая проверка красит
  // тест, который про другое.
  // #635 добавил шестой — свежесть индекса ревью (судится только на push в dev,
  // skipped в вердикте не считается отказом).
  const checks = ['docs', 'reviews_index', 'workflow_sync', 'provenance', 'process_gate', 'action_pins'];
  for (const id of checks) {
    assert.ok(preflight.includes(`id: ${id}`), `нет шага ${id}`);
    assert.ok(preflight.includes(`steps.${id}.outcome`), `вердикт не читает ${id}`);
  }
  // Слияние джоб не имеет права превратить независимые сигналы в один
  // «первый упавший»: иначе автор узнаёт о втором нарушении следующим кругом.
  assert.equal(preflight.match(/continue-on-error: true/g)?.length, checks.length);
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
    // #898, решение владельца 14.10.2026: запас меньше 10 % → +10 % (1800 → 1980).
    const chunk = jobsOf(workflow).chunks.get(job);
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
  // #629: тот же шаг и та же база судят записи смоков в приватное состояние.
  assert.match(frontend, /node scripts\/no-new-private-writes\.mjs --base "\$base" --head "\$HEAD_SHA"/,
    'гейт приватных записей обязан вызываться с той же базой, что no-new-any');
  assert.match(frontend, /exit "\$status"/, 'падение первого гейта не должно прятать второй');
  // Гейт diff-aware, поэтому без истории он бессмысленен: на глубине 1
  // merge-base не считается и диапазон выродится в «всё».
  assert.match(frontend, /fetch-depth: 0, filter: 'blob:none'/);
});

test('golden failure retains actual evidence and cannot create a reusable success marker (#386/#981)', () => {
  const workflow = read('validate.yml'), golden = jobsOf(workflow).chunks.get('golden');
  assert.match(golden, /run: node scripts\/golden-regression\.mjs/);
  assert.match(golden, /REF_NAME: \$\{\{ github\.ref_name \}\}/);
  assert.match(golden, /CANDIDATE_INPUT: \$\{\{ inputs\.candidate \}\}/);
  assert.match(golden, /HEAD_MESSAGE: \$\{\{ github\.event\.head_commit\.message \}\}/,
    'the wrapper receives strict candidate/release context, not only the branch');
  assert.match(golden, /pending_visual: \$\{\{ steps\.golden\.outputs\.pending_visual \}\}/,
    'pending visual diagnostics must reach proof and registry authority checks');
  assert.match(golden, /if: failure\(\) \|\| steps\.golden\.outputs\.has_baselines == 'false' \|\| steps\.golden\.outputs\.pending_visual == 'true'/,
    'both failures and expected pending differences retain their complete capture evidence');
  assert.doesNotMatch(golden, /\.reuse-marker|\.fail-marker|fail_note|gate-reuse\.mjs --note/);
  assert.match(golden, /ci-registry-cli\.mjs --stamp-job=golden/);
  const proof = jobsOf(workflow).chunks.get('proof');
  assert.match(proof, /if: always\(\)/);
  assert.match(proof, /REGISTRY_PLAN:/);
  assert.match(proof, /ci-registry-cli\.mjs --publish-proof=/);
});

test('task classification uses its complete diff; integration uses verified green coverage (#1060)', () => {
  const workflow = read('validate.yml');
  const changes = workflow.slice(
    workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'),
  );
  // `github.event.before` — источник ложного «уже проверено»: прогон
  // предыдущего пуша штатно отменяется следующим. Классификация читать его
  // больше не имеет права. В процессном гейте он законен: там проверяются
  // трейлеры именно отправленных коммитов, а не объём проверок.
  assert.equal(/base="\$BEFORE_SHA"/.test(changes), false,
    'диапазон не имеет права опираться на голову предыдущего пуша (#387)');
  const classify = findStep(workflow, { id: 'classify' });
  assert.doesNotMatch(classify.run, /\$BEFORE_SHA/,
    'rewriting a previous push cannot silently expand task validation to every family');
  assert.match(classify.run, /refs\/heads\/issue\/\*\)[\s\S]*base=\$\(git merge-base origin\/dev "\$HEAD_SHA"\)/);
  assert.match(classify.run, /base="\$GREEN_BASE"/);
  assert.match(changes, /node scripts\/classify-base\.mjs --head=/);
  assert.match(changes, /actions: read/, 'чтение прогонов требует прав');
  // У PR диапазон задан событием, считать его нечем и незачем.
  assert.match(changes, /if: github\.event_name != 'pull_request'/);
  assert.match(changes, /--mode=integration --repo="\$REPO"/);
  assert.match(changes, /GREEN_BASE: \$\{\{ steps\.base\.outputs\.base \}\}/);
  assert.doesNotMatch(changes, /GREEN_BASE:[^\n]*range_base/, 'judged range is not green product coverage');
  assert.match(classify.run, /git merge-base --is-ancestor "\$base" "\$HEAD_SHA"/);
  const empty = classify.run.slice(classify.run.indexOf('if [ -z "$base" ] ||'));
  assert.match(empty, /::error::Classification needs a proven ancestor:[\s\S]*exit 1/);
  assert.doesNotMatch(empty, /--all/, 'unknown task ancestry still fails; only integration absence widens coverage');
  assert.match(classify.run, /No verified green coverage:[\s\S]*classify-changes\.mjs --all/);
});

test('#619/#1044: dev and main retain a proven base without forcing every check family', () => {
  const workflow = read('validate.yml');
  const changes = workflow.slice(
    workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'),
  );
  const integrationRefs = /\[ "\$REF" = "refs\/heads\/dev" \] \|\| \[ "\$REF" = "refs\/heads\/main" \]/g;
  assert.equal(changes.match(integrationRefs)?.length, 2,
    'base discovery and the unproven coverage fallback recognize both integration branches');
  assert.doesNotMatch(changes, /dev\/main: без фильтров, всё true/);

  const frontend = workflow.slice(
    workflow.indexOf('\n  frontend:\n'), workflow.indexOf('\n  smoke:\n'),
  );
  assert.match(frontend, integrationRefs,
    'no-new-any на main обязан судить диапазон от доказанного предка, а не HEAD..HEAD');
});

test('#1060 classifier shell preserves task scope and widens unproven integration coverage', (t) => {
  if (spawnSync(posixCommand('bash'), ['--version']).status !== 0) { t.skip('bash unavailable'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-classify-task-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Workflow fixture');
  git('config', 'user.email', 'workflow@example.invalid');
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'docs'));
  // The real shell chooses the Git range. This sink observes its classifier
  // invocation without coupling the range test to every classifier dependency.
  writeFileSync(join(root, 'scripts/classify-changes.mjs'), `
    import { readFileSync, writeFileSync } from 'node:fs';
    writeFileSync(process.env.CLASSIFY_CALL, JSON.stringify({
      args: process.argv.slice(2), files: process.argv.includes('--all') ? [] : readFileSync(0, 'utf8').trim().split('\\n').filter(Boolean),
    }));
    console.log('unknown_inputs=');
  `);
  writeFileSync(join(root, 'src/card.ts'), 'original\n');
  writeFileSync(join(root, 'docs/task.md'), 'original\n');
  git('add', '.'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/dev', base);
  writeFileSync(join(root, 'src/card.ts'), 'task implementation\n');
  git('add', '.'); git('commit', '-qm', 'implementation');
  const previousGreen = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'docs/task.md'), 'task evidence\n');
  git('add', '.'); git('commit', '-qm', 'evidence');
  const head = git('rev-parse', 'HEAD'), step = findStep(read('validate.yml'), { id: 'classify' });
  let sequence = 0;
  const run = (env = {}) => {
    const call = join(root, `call-${sequence++}.json`);
    const result = runStep(step, undefined, { cwd: root, env: { ...process.env,
      REF: 'refs/heads/issue/1044-task', HEAD_SHA: head, GREEN_BASE: previousGreen,
      EVENT_NAME: 'push', FULL: 'false', BEFORE_SHA: 'f'.repeat(40), BASE_SHA: '',
      CLASSIFY_CALL: shellPath(call), GITHUB_OUTPUT: shellPath(join(root, 'outputs')),
      GITHUB_STEP_SUMMARY: shellPath(join(root, 'summary')), ...env,
    } });
    return { ...result, call: existsSync(call) ? JSON.parse(readFileSync(call, 'utf8')) : null };
  };
  for (const green of [previousGreen, '']) {
    const result = run({ GREEN_BASE: green });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.call, { args: [], files: ['docs/task.md', 'src/card.ts'] },
      'all task changes remain selected even when the previous push disappeared or a recent push was green');
  }
  for (const ref of ['refs/heads/dev', 'refs/heads/main']) {
    const result = run({ REF: ref });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.call, { args: [], files: ['docs/task.md'] }, 'integration uses the proven range');
    const unknown = run({ REF: ref, GREEN_BASE: '' });
    assert.equal(unknown.status, 0, unknown.stderr);
    assert.deepEqual(unknown.call, { args: ['--all'], files: [] });
    assert.match(unknown.stdout, /No verified green coverage/);
  }
  git('update-ref', '-d', 'refs/remotes/origin/dev');
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.equal(missing.call, null);
  assert.match(missing.stdout, /fetch origin\/dev.*full=true/);
  const full = run({ FULL: 'true', GREEN_BASE: '' });
  assert.equal(full.status, 0, full.stderr);
  assert.deepEqual(full.call, { args: ['--all'], files: [] }, 'an explicit full request retains all-family authority');
});

test('перф-смок добавляет профиль ровно при своём выходе changes (#473 AC3)', () => {
  const workflow = read('validate.yml');
  const changes = workflow.slice(workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'));
  assert.match(changes, /perf_iso: \$\{\{ steps\.classify\.outputs\.perf_iso == 'true' \|\| inputs\.full \}\}/);
  assert.match(changes, /perf_interaction: \$\{\{ steps\.classify\.outputs\.perf_interaction == 'true' \|\| inputs\.full \}\}/);
  // Выходы пишет скрипт, а не inline-shell: решение проверяется unit-тестом
  // (AC8); #492 §5.2 — тот же вывод читается и для summary неизвестных входов.
  assert.match(changes, /printf '%s\\n' "\$files" \| node scripts\/classify-changes\.mjs > \/tmp\/classify\.out/);
  assert.match(changes, /tee -a "\$GITHUB_OUTPUT" < \/tmp\/classify\.out/);
  assert.match(changes, /unknown_inputs: \$\{\{ steps\.classify\.outputs\.unknown_inputs \}\}/);
  assert.match(changes, /sed -n 's\/\^unknown_inputs=\/\/p' \/tmp\/classify\.out/);
  assert.match(changes, /Неизвестные входы \(#492\)/);
  // Explicit full and an absent integration green base widen families. Neither
  // a failed judged base nor unproven task ancestry silently narrows coverage.
  const fallbacks = changes.split('node scripts/classify-changes.mjs --all >> "$GITHUB_OUTPUT"').length - 1;
  assert.equal(fallbacks, 2, 'full intent and absent integration coverage both use the canonical family selector');
  assert.ok(!changes.includes("printf 'frontend=true"), 'ручной список выходов в fallback-е запрещён');

  const start = workflow.indexOf('\n  performance_smoke:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  geometry_parity:\n', start));
  assert.match(job, /needs: \[changes, bundle, reuse\]/);
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

test('#548: TS/Python parity — отдельная clean-runner job без тихого skip', () => {
  const workflow = read('validate.yml');
  const start = workflow.indexOf('\n  geometry_parity:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  backend:\n', start));
  assert.ok(start > 0, 'нет job geometry_parity');
  assert.match(job, /needs: \[changes, reuse\]/);
  assert.match(job, /if: needs\.changes\.outputs\.geometry_parity == 'true'/);
  assert.match(job, /node-version-file: \.nvmrc/);
  // #1032: bootstrap разрешает minor один раз; producer ставит ту же точную patch.
  assert.match(job, /python-version: \$\{\{ needs\.reuse\.outputs\.python_version \}\}/);
  assert.match(job, /CI_PYTHON_VERSION: \$\{\{ needs\.reuse\.outputs\.python_version \}\}/);
  assert.doesNotMatch(job, /python-version-file:/);
  assert.match(job, /npx --no-install tsc -p tsconfig\.junction-parity\.json/);
  assert.match(job, /python tests_backend\/junction_parity\.py --build-dir=test-build\/junction-parity/);
  assert.match(job, /ci-registry-cli\.mjs --stamp-job=geometry_parity/);
  assert.ok(!/pytest\.skip|continue-on-error:[^\n]*\n[^]*junction_parity\.py/.test(job),
    'паритет не может становиться зелёным через skip/continue-on-error');

  const changes = workflow.slice(workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'));
  assert.match(changes, /geometry_parity: \$\{\{ steps\.classify\.outputs\.geometry_parity == 'true' \|\| steps\.heavy\.outputs\.heavy == 'true' \}\}/);
  const reuse = workflow.slice(workflow.indexOf('\n  reuse:\n'), workflow.indexOf('\n  hacs:\n'));
  assert.match(reuse, /geometry_parity_key: \$\{\{ steps\.probe\.outputs\.geometry_parity_key \}\}/);
  assert.match(reuse, /node scripts\/ci-registry-cli\.mjs/);

  const oldPytestHome = readFileSync(
    new URL('../tests_backend/test_junction_limits.py', import.meta.url), 'utf8',
  );
  assert.doesNotMatch(oldPytestHome, /pytest\.skip\([^\n]*test-build/,
    'старый optional parity pytest не должен возвращаться рядом с обязательной job');
});

test('registry lookup receives the exact required performance set (#473 AC5/#981)', () => {
  const reuse = jobsOf(read('validate.yml')).chunks.get('reuse');
  assert.match(reuse, /needs: changes/);
  assert.match(reuse, /PERF_ISO: \$\{\{ needs\.changes\.outputs\.perf_iso \}\}/);
  assert.match(reuse, /PERF_INTERACTION: \$\{\{ needs\.changes\.outputs\.perf_interaction \}\}/);
  assert.match(reuse, /performance_smoke_key: \$\{\{ steps\.probe\.outputs\.performance_smoke_key \}\}/);
  assert.match(reuse, /node scripts\/ci-registry-cli\.mjs/);
  assert.doesNotMatch(reuse, /actions\/cache|check-proof-transfer|\.reuse-marker/);
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
  // Считать базу имеет смысл только на пуше в интеграционную ветку: на ветках
  // диапазон и так шире, а у PR он задан событием. #703: `main` — тоже, иначе
  // stable-промоушен судит бета-линию от прошлого stable (`event.before`).
  assert.match(preflight,
    /if: github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/dev' \|\| github\.ref == 'refs\/heads\/main'\)/);

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

test('#703 AC3: на пуше в main база диапазона видит прогоны dev, а не только прошлый stable', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(
    workflow.indexOf('\n  preflight:\n'), workflow.indexOf('\n  changes:\n'),
  );
  const changes = workflow.slice(
    workflow.indexOf('\n  changes:\n'), workflow.indexOf('\n  reuse:\n'),
  );
  // Preflight: прогоны обеих интеграционных веток в один вызов CLI.
  assert.match(preflight, /for branch in dev main; do/);
  assert.match(preflight, /-f branch="\$branch"/);
  assert.match(preflight, /--runs=\/tmp\/validate-runs-dev\.json --runs=\/tmp\/validate-runs-main\.json/);
  // changes: к прогонам своей ветки добавляются прогоны другой интеграционной.
  const range = changes.slice(changes.indexOf('if [ "$REF" = "refs/heads/dev" ] || [ "$REF" = "refs/heads/main" ]'));
  assert.match(range, /other=dev; \[ "\$BRANCH" = "dev" \] && other=main/);
  assert.match(range, /-f branch="\$other" -f status=completed/);
  assert.match(range, /--runs=\/tmp\/validate-runs\.json --runs=\/tmp\/validate-runs-other\.json/);
  // Теги релиза — граница материала. `actions/checkout` по умолчанию качает с
  // `--no-tags` даже при `fetch-depth: 0` (r1 ревью #703): без `fetch-tags`
  // `releaseTaggedShas()` в CI всегда пуст.
  for (const job of [preflight, changes]) {
    assert.match(job, /with: \{ fetch-depth: 0, filter: 'blob:none', fetch-tags: true \}/);
  }
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
test('#954 full smoke/performance stay on heavy; golden has an independent demand', () => {
  const text = read('validate.yml');
  for (const job of ['smoke', 'smoke_done', 'golden', 'performance_smoke']) {
    const start = text.indexOf(`\n  ${job}:\n`);
    assert.ok(start > 0, `job ${job} есть`);
    const chunk = text.slice(start, start + 600);
    assert.match(chunk, /needs: \[changes,/, `${job}: зависит от changes`);
    const output = job === 'golden' ? 'golden' : 'heavy';
    assert.match(chunk, new RegExp(`if: .*needs\\.changes\\.outputs\\.${output} == 'true' &&`), `${job}: requested check`);
  }
  assert.match(text, /heavy: \$\{\{ steps\.heavy\.outputs\.heavy \}\}/);
  assert.match(text, /classify-changes\.mjs --heavy/);
  assert.match(text, /workflow_dispatch:\n\s+inputs:\n\s+full:/);
  // preflight: режим скриншотов считает тот же скрипт.
  assert.match(text, /check-docs\.mjs "\$external" --screenshots=\$mode/);
});

test('ночной прогон — dispatch Validate на dev с full=true (#479)', () => {
  const text = read('_nightly.yml');
  // #623: расписание — у тонкого вызывающего `nightly.yml`, тело — в `_nightly.yml`.
  assert.match(read('nightly.yml'), /schedule:\n\s+- cron:/);
  assert.match(text, /workflow-pending\.mjs --kind=night/);
  assert.match(readFileSync(new URL('../scripts/workflow-pending.mjs', import.meta.url), 'utf8'),
    /'validate\.yml', '--repo', repo, '--ref', 'dev', '-f', 'full=true'/);
  assert.doesNotMatch(text, /gh run watch|sleep 10/);
  assert.match(text, /workflow-continuation-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(text, /actions: write/);
});

test('релизные гейты требуют трейлер Release: и свежие скриншоты (#479)', () => {
  const trailer = /grep -Eq '\^Release:\[\[:space:\]\]\*v\?\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+'/;
  assert.match(read('publish-prerelease.yml'), trailer);
  assert.match(read('release.yml'), trailer);
  assert.match(read('publish-prerelease.yml'), /check-docs\.mjs --screenshots=strict/);
});

test('#854: development mutant interface is compatible but cannot execute or report caught evidence', () => {
  const workflow = read('validate.yml');
  const start = workflow.indexOf('\n  changed_mutants:\n');
  const job = workflow.slice(start, workflow.indexOf('\n  frontend:\n', start));
  assert.match(job, /if: needs\.changes\.outputs\.mutants_requested == 'true'/);
  assert.match(workflow, /mutants_requested: \$\{\{ steps\.heavy\.outputs\.mutants_requested \}\}/);
  assert.match(workflow, /MUTANTS_INPUT: \$\{\{ inputs\.mutants \}\}/);
  assert.match(job, /Development mutation execution retired/);
  assert.doesNotMatch(job, /mutation-gate\.mjs|npm ci|playwright install|pip install|actions\/cache/);
  assert.match(job, /exit 1/);
  assert.match(read('_mutation-gate.yml'), /mutation-gate\.mjs --shard=[^\n]+ --execute-nightly/);
});

test('#954 only issue dispatch coalesces with push; protected nightly/full concurrency remains separate', () => {
  const text = read('validate.yml');
  assert.match(text, /github\.event_name == 'workflow_dispatch' && !startsWith\(github\.ref, 'refs\/heads\/issue\/'\) && 'dispatch-'/);
  assert.match(text, /cancel-in-progress: \$\{\{ github\.event_name != 'workflow_dispatch' \|\| !startsWith\(github\.ref, 'refs\/heads\/issue\/'\) \}\}/,
    'explicit issue dispatch must queue, not cancel the active producer');
});

// #854: retired development ledger/cache contract removed; nightly evidence tests remain.

test('#541: Validate всегда публикует proof точной попытки, а reuse раскрывает источник', () => {
  const workflow = read('validate.yml');
  const preflightName = workflow.match(/\n  preflight:\n    name: "([^"]+)"/)?.[1];
  assert.equal(preflightName, JOB_RULES.preflight[0].name, '#622: имя — контракт ci-proof, не своя копия');
  assert.ok(Buffer.byteLength(preflightName, 'utf8') <= 100,
    'GitHub Jobs API truncates job names longer than 100 UTF-8 bytes');
  assert.doesNotMatch(workflow, /with:\s*\{[^\n]*\$\{\{/,
    'GitHub does not parse an unquoted expression inside a YAML flow mapping');
  const proofAt = workflow.indexOf('\n  proof:\n');
  assert.ok(proofAt > 0, 'финальная proof job существует');
  const proof = workflow.slice(proofAt);
  assert.match(proof, /if: always\(\)/, 'proof создаётся и на красном прогоне');
  for (const dependency of [
    'preflight', 'changes', 'reuse', 'hacs', 'hassfest', 'changed_mutants',
    'frontend', 'smoke', 'smoke_done', 'golden', 'performance_smoke', 'geometry_parity', 'backend',
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
  for (const id of ['frontend', 'smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend']) {
    assert.match(reuse, new RegExp(`${id}_source_run:`), `${id}: source run output`);
    assert.match(reuse, new RegExp(`${id}_source_attempt:`), `${id}: source attempt output`);
    assert.match(reuse, new RegExp(`${id}_source_sha:`), `${id}: source SHA output`);
  }
  assert.match(reuse, /node scripts\/ci-registry-cli\.mjs/);
  assert.match(reuse, /plan: \$\{\{ steps\.probe\.outputs\.plan \}\}/);
  assert.doesNotMatch(reuse, /check-proof-transfer|\.reuse-marker|actions\/cache/);
  assert.equal(reuse.includes('lookup-only: true'), false,
    'marker contents must be restored and verified, not reduced to a cache-hit bit');
});

test('#700: на ветке задачи зеркало workflow и внешние ссылки — предупреждение, на dev — красный и issue', () => {
  const workflow = read('validate.yml');
  const preflight = workflow.slice(workflow.indexOf('\n  preflight:\n'), workflow.indexOf('\n  changes:\n'));
  const docs = preflight.slice(preflight.indexOf('id: docs'), preflight.indexOf('id: reviews_index'));
  assert.match(docs, /case "\$REF" in refs\/heads\/issue\/\*\) external=--external=warn ;; esac/);
  assert.match(docs, /REF: \$\{\{ github\.ref \}\}/);
  const verdict = preflight.slice(preflight.indexOf('- name: Вердикт предполётных проверок'));
  assert.match(verdict, /case "\$REF" in refs\/heads\/issue\/\*\) task_branch=true ;; esac/);
  assert.match(verdict, /if \[ "\$task_branch" = "true" \]; then\n\s+advise "тонкие вызывающие workflow в main и dev" "\$WORKFLOW_SYNC"\n\s+else\n\s+check "тонкие вызывающие workflow в main и dev"/);
  assert.doesNotMatch(verdict.slice(verdict.indexOf('advise() {'), verdict.indexOf('task_branch=false')), /fail=1/,
    'предупреждение не красит вердикт');
  const issue = preflight.slice(preflight.indexOf('- name: "Расхождение зеркала на dev — issue владельцу"'));
  assert.match(issue, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev' && steps\.workflow_sync\.outcome == 'failure'/);
  assert.match(issue, /gh issue list --repo "\$REPO" --state open --search/, 'одно issue, а не одно на каждый push');
  // r1 #700: несчитанный список — не повод заводить новое.
  assert.match(issue, /if ! existing=\$\(gh issue list [\s\S]*?\); then\n\s+echo "::warning::[^"]*"\n\s+exit 0\n\s+fi/);
  assert.doesNotMatch(issue.slice(0, issue.indexOf('gh issue create')), /\|\| true\)/, 'сбой чтения не глушится в пустой ответ');
  assert.match(preflight, /permissions:\n\s+contents: read\n\s+actions: read\n\s+issues: write/);
});

test('#700: check-docs --external=warn сводит внешние отказы в предупреждения', () => {
  const source = read('../../scripts/check-docs.mjs');
  assert.match(source, /const EXTERNAL_WARN = process\.argv\.includes\('--external=warn'\);/);
  assert.match(source, /const externalErrors = EXTERNAL_WARN \? warnings : errors;/);
  assert.equal((source.match(/externalErrors\.push\(/g) || []).length, 2, 'оба вида внешнего отказа');
});
