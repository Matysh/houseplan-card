#!/usr/bin/env node
// Слияние точного кандидата (#492 §4).
//
// До этой задачи шаг «Слить ветку в dev» ревью-конвейера после зелёного
// вердикта делал `git rebase origin/dev` и сразу `push HEAD:dev`. Если `dev`
// продвинулся за время ревью (28 августа — четыре раза за день), в `dev`
// уезжало дерево, которого не видел никто: ни ревью (материал другой), ни
// Validate (на этот SHA он не бежал). Чистый ребейз не доказывает
// совместимость: соседняя правка в `dev` меняет поведение без единого
// конфликта (эксперимент аудита: 20 → 40).
//
// Правило теперь: в `dev` попадает только SHA, для которого есть зелёный
// Validate, и попадает атомарно — `--force-with-lease` на ту вершину `dev`,
// поверх которой кандидат собран. Движение `dev` во время проверки не
// перезаписывает чужое: lease отклоняется, кандидат собирается заново, не
// более трёх раз. Дифф, изменившийся при ребейзе (patch-id), — не предмет
// этого шага: вердикт к нему не применим, задача возвращается на ревью.
//
// Решение (`decideMerge`) отделено от git и gh (`ops`), чтобы таблица
// случаев §8.4 была юнит-тестом, а не верой в shell.

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';

export const MAX_ATTEMPTS = 3;
export const VALIDATE_APPEAR_MS = 3 * 60 * 1000;
export const VALIDATE_TOTAL_MS = 45 * 60 * 1000;

/**
 * Чистое решение по состоянию одной попытки. Возвращает действие и, где
 * применимо, статусную метку, к которой ведёт это действие.
 *
 * @param {object} s
 * @param {boolean} s.fresh          вершина ветки = материал (+ документ ревью), #312
 * @param {boolean} s.devMoved       dev не равен базе материала
 * @param {boolean} s.conflict       ребейз на dev упал
 * @param {boolean} s.patchIdEqual   дифф после ребейза совпадает с проверенным
 * @param {'green'|'red'|'missing'|null} s.validate  результат Validate на кандидате
 * @param {boolean} s.leaseRejected  push в dev отклонён: dev двинулся снова
 * @param {number}  s.attempt        номер попытки, с 1
 */
export function decideMerge(s) {
  if (!s.fresh) return { action: 'reject-stale', to: 'S6-in-progress' };
  if (s.conflict) return { action: 'conflict', to: 'S6-in-progress' };
  if (!s.devMoved) {
    if (s.leaseRejected) return { action: 'retry' };
    return { action: 'fast-forward', to: 'S8-merged' };
  }
  if (!s.patchIdEqual) return { action: 'rereview', to: 'S7-code-review' };
  if (s.validate === null || s.validate === undefined) return { action: 'validate' };
  if (s.validate === 'missing') return { action: 'validation-missing', to: 'S6-in-progress' };
  if (s.validate === 'red') return { action: 'validation-red', to: 'S6-in-progress' };
  if (s.leaseRejected) {
    if ((s.attempt ?? 1) >= (s.maxAttempts ?? MAX_ATTEMPTS)) return { action: 'give-up', to: 'S6-in-progress' };
    return { action: 'retry' };
  }
  return { action: 'push', to: 'S8-merged' };
}

/** Тексты комментариев в issue — один на исход. */
export function commentFor(action, ctx) {
  const short = (sha) => String(sha || '').slice(0, 8);
  switch (action) {
    case 'reject-stale':
      return `**Слияние отменено: ветка изменилась после проверенного материала (#312).**\n\n`
        + `Ревью выполнялось на \`${short(ctx.material)}\`, а вершина ветки сейчас \`${short(ctx.actual)}\` — в ней есть коммиты, которых вердикт не покрывает. Зелёный вердикт остаётся в силе только для проверенного SHA.\n\n`
        + `Задача переведена в \`S6-in-progress\`. Дальше: убедиться, что вершина ветки — именно то, что должно ехать в dev, и вернуть метку \`S7-code-review\`. Если вершина отличается от проверенного материала только коммитами публикации документов ревью, новый заход применит зелёный вердикт повторно без вызова модели (#499).`;
    case 'conflict':
      return `**Код-ревью зелёное — вердикт выше в силе, переделывать работу не нужно.** Не удалось только слияние: ветка \`${ctx.branch}\` конфликтует с \`dev\`.\n\n`
        + `Задача переведена в \`S6-in-progress\`, потому что работа вернулась к автору. Осталась не правка кода, а ребейз:\n\n`
        + `1. \`git fetch origin\`, затем \`git rebase origin/dev\` в ветке задачи, разрешить конфликт;\n2. запушить ветку;\n3. вернуть метку \`S7-code-review\`.\n\n`
        + `Повторный прогон ревью — не формальность: после ребейза на новый \`dev\` это другой код, и принимать его без проверки нельзя. Цикл считается по этапу, лимит на код-ревью тратится отдельно от ревью ТЗ.`;
    case 'rereview':
      return `**Дифф изменился при ребейзе на \`dev@${short(ctx.devNow)}\` — вердикт к нему не применим (§7.2, #492).**\n\n`
        + `Материал ревью \`${short(ctx.material)}\` и кандидат \`${short(ctx.candidate)}\` дают разные patch-id: соседние правки в \`dev\` изменили содержимое патча. Кандидат опубликован в ветку; задача возвращена в \`S7-code-review\` — новый заход ревью читает актуальный код.`;
    case 'validation-red':
      return `**Кандидат после ребейза на \`dev@${short(ctx.devNow)}\` красный (#492).**\n\n`
        + `Вердикт ревью на \`${short(ctx.material)}\` в силе, но точный кандидат \`${short(ctx.candidate)}\` не прошёл Validate: ${ctx.runUrl || 'прогон не найден'}. Задача переведена в \`S6-in-progress\`: разобраться с прогоном на ветке, затем вернуть \`S7-code-review\`.`;
    case 'validation-missing':
      return `**Validate на кандидате \`${short(ctx.candidate)}\` не появился за ${Math.round(VALIDATE_APPEAR_MS / 60000)} мин (#492).**\n\n`
        + `Кандидат опубликован в ветку, но прогон не стартовал — проверьте токен конвейера и очередь Actions. Слияние без проверки не выполняется; задача в \`S6-in-progress\`, после зелёного Validate на этом SHA вернуть \`S7-code-review\`.`;
    case 'give-up':
      return `**\`dev\` движется быстрее слияния: ${ctx.attempt} попытки собрать и проверить кандидата, каждый раз \`dev\` уходил до push (#492).**\n\n`
        + `Последний проверенный кандидат \`${short(ctx.candidate)}\` опубликован в ветку. Задача в \`S6-in-progress\`; вернуть \`S7-code-review\`, когда \`dev\` успокоится.`;
    case 'push':
    case 'fast-forward':
      return `материал \`${short(ctx.material)}\` · dev@\`${short(ctx.devNow)}\` → кандидат \`${short(ctx.candidate)}\``
        + (action === 'push' ? ` · Validate ${ctx.runUrl} зелёный` : ' · dev не двигался')
        + ' · слито';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Исполнение: git + gh через `ops`, чтобы тест подменял их целиком.

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
};

export function realOps({ repo, token, workflow = 'validate.yml', sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, exec = sh }) {
  const pushUrl = `https://x-access-token:${token}@github.com/${repo}`;
  const git = (...args) => exec('git', args);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: ${r.stderr || r.stdout}`); return r.stdout; };
  return {
    fetch: (...refs) => must(git('fetch', '-q', 'origin', ...refs), 'git fetch'),
    revParse: (ref) => must(git('rev-parse', ref), `rev-parse ${ref}`),
    mergeBase: (a, b) => must(git('merge-base', a, b), 'merge-base'),
    diffNames: (from, to, pathspec = []) => must(git('diff', '--name-only', from, to, '--', ...pathspec), 'diff').split('\n').filter(Boolean),
    patchId: (from, to) => {
      const diff = must(git('diff', '--full-index', from, to), 'diff');
      const r = spawnSync('git', ['patch-id', '--stable'], { input: diff, encoding: 'utf8' });
      return (r.stdout || '').trim().split(' ')[0] || 'empty';
    },
    rebaseOnto: (branchTip, onto) => {
      must(git('checkout', '-q', '-B', 'merge-into-dev', branchTip), 'checkout');
      const r = spawnSync('git', ['-c', 'user.name=claude[bot]', '-c', 'user.email=209825114+claude[bot]@users.noreply.github.com', 'rebase', onto], { encoding: 'utf8' });
      if (r.status !== 0) { spawnSync('git', ['rebase', '--abort']); return null; }
      return must(git('rev-parse', 'HEAD'), 'rev-parse HEAD');
    },
    pushWithLease: (sha, ref, expected) => {
      const r = git('push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, pushUrl, `${sha}:refs/heads/${ref}`);
      if (r.status === 0) return true;
      if (/stale info|rejected|fetch first|lease/i.test(r.stderr)) return false;
      throw new Error(`git push ${ref}: ${r.stderr}`);
    },
    // Мутанты по диффу бегут только по запросу (#510): кандидат после ребейза —
    // новое дерево, поэтому слияние запускает Validate с мутантами само и ждёт
    // именно этот dispatch-прогон; push-прогон на том же SHA их не содержит.
    dispatchValidate: (ref) => {
      const r = exec('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', ref, '-f', 'full=false', '-f', 'mutants=true']);
      if (r.status !== 0) throw new Error(`gh workflow run ${workflow}: ${r.stderr || r.stdout}`);
    },
    waitValidate: async (sha, { event = 'workflow_dispatch' } = {}) => {
      const started = now();
      let runId = null;
      while (now() - started < VALIDATE_TOTAL_MS) {
        const r = exec('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--commit', sha, '--json', 'databaseId,status,conclusion,url,event', '--limit', '10']);
        const all = r.status === 0 && r.stdout ? JSON.parse(r.stdout) : [];
        // Отменённый прогон ничего не доказывает (#511): его заменил следующий
        // dispatch на той же ветке — ждём его, а не красим кандидата.
        const runs = all.filter((x) => (!event || x.event === event) && x.conclusion !== 'cancelled');
        const run = runs.find((x) => x.databaseId === runId) || runs[0];
        if (run) {
          runId = run.databaseId;
          if (run.status === 'completed') return { result: run.conclusion === 'success' ? 'green' : 'red', url: run.url };
        } else if (now() - started > VALIDATE_APPEAR_MS) {
          return { result: 'missing', url: null };
        }
        await sleep(20_000);
      }
      return { result: 'red', url: runId ? `run ${runId} (timeout)` : null };
    },
    comment: (issue, body) => {
      const r = spawnSync('gh', ['issue', 'comment', String(issue), '--repo', repo, '--body-file', '-'], { input: body, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`gh issue comment: ${r.stderr}`);
    },
    log: (line) => console.log(line),
  };
}

/**
 * Слияние по алгоритму §4.2. Возвращает { merged, to, action, candidate }.
 */
export async function mergeCandidate({ branch, material, issue, ops, maxAttempts = MAX_ATTEMPTS }) {
  ops.fetch('dev', branch);
  const actual = ops.revParse(`origin/${branch}`);
  const reviewedFresh = actual === material
    || (safe(() => ops.revParse(`${actual}^`)) === material
      && ops.diffNames(material, actual, ['.', ':!docs/reviews']).length === 0);
  const ctx = { branch, material, actual, issue };
  const finish = (decision, extra = {}) => {
    const body = commentFor(decision.action, { ...ctx, ...extra, attempt: extra.attempt });
    if (body) ops.comment(issue, body);
    const merged = decision.action === 'push' || decision.action === 'fast-forward';
    ops.log(`решение: ${decision.action} → ${decision.to || '(метка по вердикту)'}`);
    return { merged, to: decision.to, action: decision.action, candidate: extra.candidate || actual };
  };

  if (!reviewedFresh) return finish(decideMerge({ fresh: false }));

  let tip = actual;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    ops.fetch('dev');
    const devNow = ops.revParse('origin/dev');
    const materialBase = ops.mergeBase(material, 'origin/dev');
    const devMoved = devNow !== materialBase;
    ops.log(`попытка ${attempt}: dev@${devNow.slice(0, 8)}, база материала ${materialBase.slice(0, 8)}, dev ${devMoved ? 'двигался' : 'на месте'}`);

    if (!devMoved) {
      const pushed = ops.pushWithLease(tip, 'dev', devNow);
      const decision = decideMerge({ fresh: true, devMoved: false, leaseRejected: !pushed });
      if (decision.action === 'retry') continue;
      return finish(decision, { candidate: tip, devNow });
    }

    const candidate = ops.rebaseOnto(tip, 'origin/dev');
    if (!candidate) return finish(decideMerge({ fresh: true, devMoved: true, conflict: true }), { devNow });

    const patchIdEqual = ops.patchId(materialBase, material) === ops.patchId(devNow, candidate);
    // кандидат публикуется в ветку в любом случае: он и есть то, что должно
    // ехать в dev, и Validate стартует именно от этого push
    if (!ops.pushWithLease(candidate, branch, tip)) {
      // ветку задачи подвинули, пока шло ревью или ребейз — это #312, не наш случай
      return finish(decideMerge({ fresh: false }), { candidate, devNow });
    }
    tip = candidate;
    if (!patchIdEqual) return finish(decideMerge({ fresh: true, devMoved: true, patchIdEqual: false }), { candidate, devNow });

    // мутанты по диффу — по запросу (#510): dispatch на ветке, где теперь стоит кандидат
    ops.dispatchValidate(branch);
    ops.log(`Validate с мутантами на кандидате ${candidate.slice(0, 8)} — ждём`);
    const { result, url } = await ops.waitValidate(candidate, { event: 'workflow_dispatch' });
    let decision = decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: result, attempt, maxAttempts });
    if (decision.action !== 'push') return finish(decision, { candidate, devNow, runUrl: url });

    const pushed = ops.pushWithLease(candidate, 'dev', devNow);
    decision = decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: result, leaseRejected: !pushed, attempt, maxAttempts });
    if (decision.action === 'retry') { ops.log('dev двинулся снова — ещё попытка'); continue; }
    return finish(decision, { candidate, devNow, runUrl: url, attempt });
  }
  return finish(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: maxAttempts, maxAttempts }), { candidate: tip, attempt: maxAttempts });
}

const safe = (fn) => { try { return fn(); } catch { return null; } };

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

if (isMainModule(import.meta.url)) { // #496: переносимо для Windows
  const branch = arg('branch');
  const material = arg('material');
  const issue = arg('issue');
  const repo = arg('repo') || process.env.GITHUB_REPOSITORY;
  const token = process.env.HP_PROCESS_TOKEN || process.env.TOKEN;
  if (!branch || !material || !issue || !repo || !token) {
    console.error('usage: merge-candidate.mjs --branch=<issue branch> --material=<sha> --issue=<n> [--repo=owner/name]; HP_PROCESS_TOKEN in env');
    process.exit(2);
  }
  const ops = realOps({ repo, token });
  mergeCandidate({ branch, material, issue, ops }).then((r) => {
    const out = `merged=${r.merged}\nto=${r.to || ''}\naction=${r.action}\ncandidate=${r.candidate}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
    process.stdout.write(out);
  }, (err) => {
    // Инвариант конвейера: после прогона метка меняется всегда. Сбой самого
    // слияния — не повод оставить задачу висеть в S7: S6 и внятный комментарий.
    console.error(err);
    try {
      ops.comment(issue, `**Слияние не выполнено: сбой шага слияния (#492).**\n\n\`\`\`\n${String(err && err.message || err).slice(0, 1500)}\n\`\`\`\n\nВердикт ревью в силе. Задача в \`S6-in-progress\`; после разбора сбоя вернуть \`S7-code-review\`.`);
    } catch (e) { console.error(e); }
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'merged=false\nto=S6-in-progress\naction=error\n');
    process.exit(0);
  });
}
