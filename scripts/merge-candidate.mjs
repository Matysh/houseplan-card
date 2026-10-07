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
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import {
  CI_PROOF_POLICIES, evaluateCiProof, githubCandidateTree, loadGithubProofContext,
} from './ci-proof.mjs';
import { rebaseRegenerating } from './rebase-generated.mjs';
// Личность конвейера — одна на ребейз и на коммит индекса (#643).
import { CONVEYOR_IDENTITY } from './reviews-index.mjs';
import { commitCandidateReviewsIndex } from './candidate-reviews-index.mjs';
import { normalizeBrowserGuardCounts } from './mutation-browser-inventory.mjs';
import { BROWSER_GUARD_INVENTORY } from './mutation-browser-policy.mjs';

export const MAX_ATTEMPTS = 3;
/** Пути вне patch-id кандидата (#698): документы ревью и то, что ребейз сливает сам. */
export const PATCH_ID_EXCLUDES = Object.freeze([
  ':!docs/reviews', ':!docs/CHANGELOG.md', ':!docs/CHANGELOG.ru.md', ':!scripts/monolith-baseline.json',
]);
export const VALIDATE_APPEAR_MS = 3 * 60 * 1000;
export const VALIDATE_TOTAL_MS = 45 * 60 * 1000;

// ---------------------------------------------------------------------------
// Разбор отказа push (#705).
//
// До #705 любой отказ, где встречалось слово `rejected`, считался устаревшим
// lease: `! [remote rejected]` — отказ самого GitHub, например коммиту,
// меняющему `.github/workflows/`, от токена без права на workflow, —
// превращался в «ветка изменилась после проверенного материала (#312)», а
// stderr не печатался (#700: runs 36484993494, 36487044060). Исходов три:
// lease устарел (прежнее поведение), отказ по праву на workflow, прочий отказ
// GitHub. Всё, что не отказ (сеть, аутентификация), — по-прежнему сбой шага.

export const PUSH_REFUSAL = Object.freeze({
  stale: 'stale', workflow: 'workflow', remote: 'remote-rejected', unknown: 'unknown',
});

/**
 * Тексты GitHub, которые он кладёт в причину `! [remote rejected] … (…)`:
 * - classic и fine-grained PAT: `refusing to allow a Personal Access Token to create or update workflow `.github/workflows/x.yml` without `workflow` scope`;
 * - OAuth App (GCM, gh): `refusing to allow an OAuth App to create or update workflow `…` without `workflow` scope`;
 * - GitHub App и GITHUB_TOKEN: `refusing to allow a GitHub App to create or update workflow `…` without `workflows` permission`;
 * - прежние формы: `refusing to allow a bot to create or update workflow `…``,
 *   `refusing to allow an integration to create or update .github/workflows/x.yml`.
 */
const WORKFLOW_REFUSAL = /refusing to allow an? [^\n()]*? to create or update (?:workflow\b|[`'"]?\.github\/workflows\/)/i;
const WORKFLOW_FILE = /\.github\/workflows\/[^\s`'"()]+/g;
const REMOTE_REJECTED = /^\s*!\s*\[remote rejected\][^\n]*$/im;
const LOCAL_REJECTED = /^\s*!\s*\[rejected\][^\n]*$/im;
/**
 * Гонка lease на стороне сервера: ссылка сдвинулась между объявлением и
 * записью. По смыслу — тот же устаревший lease, что `(stale info)`.
 */
const SERVER_LEASE_RACE = /cannot lock ref [^\n]*but expected|incorrect old value provided/i;
/** Сколько ответа git везти в комментарий и журнал. */
export const PUSH_STDERR_LIMIT = 1500;

/**
 * Вырезает учётные данные из текста, который уходит в журнал или в issue:
 * userinfo в URL (`https://x-access-token:…@`), токены GitHub (`ghp_`, `gho_`,
 * `ghu_`, `ghs_`, `ghr_`, `github_pat_`), заголовок Authorization и, если
 * известны, сами значения секретов.
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (secret && String(secret).length >= 4) out = out.split(String(secret)).join('***');
  }
  return out
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1***@')
    .replace(/(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})/g, '***')
    .replace(/(authorization:\s*(?:basic|bearer|token)\s+)\S+/gi, '$1***');
}

/**
 * Исход отказа push по stderr git. `stderr` результата — уже без секретов и
 * не длиннее PUSH_STDERR_LIMIT: его печатают в журнал и в комментарий.
 *
 * @returns {{ kind: 'stale'|'workflow'|'remote-rejected'|'unknown', reason: string, files: string[], stderr: string }}
 */
export function classifyPushRefusal(stderr, { secrets = [] } = {}) {
  const text = redactSecrets(stderr, secrets).trim();
  const clipped = text.length > PUSH_STDERR_LIMIT ? `${text.slice(0, PUSH_STDERR_LIMIT)}\n…` : text;
  const reasonOf = (line) => (line.match(/\(([^\n]*)\)\s*$/) || [])[1] || '';
  const out = (kind, reason = '', files = []) => ({ kind, reason, files, stderr: clipped });
  if (WORKFLOW_REFUSAL.test(text)) {
    const line = text.split('\n').find((l) => WORKFLOW_REFUSAL.test(l)) || '';
    return out(PUSH_REFUSAL.workflow, reasonOf(line) || line.trim(), [...new Set(text.match(WORKFLOW_FILE) || [])]);
  }
  const remote = text.match(REMOTE_REJECTED);
  if (remote) {
    const reason = reasonOf(remote[0]);
    return out(SERVER_LEASE_RACE.test(reason) ? PUSH_REFUSAL.stale : PUSH_REFUSAL.remote, reason);
  }
  // Отказ самого git по lease: `(stale info)`, `(fetch first)`, `(non-fast-forward)`.
  const local = text.match(LOCAL_REJECTED);
  if (local) return out(PUSH_REFUSAL.stale, reasonOf(local[0]));
  if (/\((?:stale info|fetch first)\)/i.test(text)) return out(PUSH_REFUSAL.stale, 'stale info');
  return out(PUSH_REFUSAL.unknown);
}

/** Отказ GitHub, который шаг слияния превращает в свой исход, а не в сбой. */
export class PushRefusal extends Error {
  constructor(ref, refusal, sha = '') {
    super(`git push ${ref}: ${refusal.kind}${refusal.reason ? ` (${refusal.reason})` : ''}`);
    this.name = 'PushRefusal';
    this.ref = ref;
    this.sha = sha;
    this.refusal = refusal;
  }
}

/** Ответ GitHub в комментарии: уже без секретов, в блоке кода. */
function refusalExcerpt(ctx) {
  const stderr = String(ctx.refusal?.stderr || '').replace(/```/g, "'''");
  return (stderr ? `Ответ GitHub:\n\n\`\`\`\n${stderr}\n\`\`\`` : 'GitHub не прислал текста отказа.')
    + (ctx.pipelineUrl ? `\n\n[Прогон конвейера](${ctx.pipelineUrl}).` : '');
}

/**
 * Чистое решение по состоянию одной попытки. Возвращает действие и, где
 * применимо, статусную метку, к которой ведёт это действие.
 *
 * @param {object} s
 * @param {boolean} s.fresh          вершина ветки = материал (+ документ ревью), #312
 * @param {boolean} s.devMoved       dev не равен базе материала
 * @param {boolean} s.conflict       ребейз на dev упал
 * @param {boolean} s.patchIdEqual   дифф после ребейза совпадает с проверенным
 * @param {'green'|'failed'|'missing'|'pending'|'cancelled'|'stale'|null} s.validate результат общего CI proof
 * @param {boolean} s.leaseRejected  push в dev отклонён: dev двинулся снова
 * @param {'workflow'|'remote-rejected'|null} s.refused  push отклонил сам GitHub (#705)
 * @param {number}  s.attempt        номер попытки, с 1
 */
export function decideMerge(s) {
  if (!s.fresh) return { action: 'reject-stale', to: 'S6-in-progress' };
  // #705: отказ GitHub — не устаревший lease. Ветку никто не двигал, и
  // «ветка изменилась после материала» (#312) была бы неправдой.
  if (s.refused === PUSH_REFUSAL.workflow) return { action: 'push-refused-workflow', to: 'S6-in-progress' };
  if (s.refused) return { action: 'push-refused', to: 'S6-in-progress' };
  if (s.conflict) return { action: 'conflict', to: 'S6-in-progress' };
  if (!s.devMoved) {
    if (s.leaseRejected) return { action: 'retry' };
    return { action: 'fast-forward', to: 'S8-merged' };
  }
  if (!s.patchIdEqual) return { action: 'rereview', to: 'S7-code-review' };
  if (s.validate === null || s.validate === undefined) return { action: 'validate' };
  if (['missing', 'pending', 'cancelled', 'stale'].includes(s.validate)) return { action: 'validation-missing', to: 'S6-in-progress' };
  if (s.validate === 'failed') return { action: 'validation-red', to: 'S6-in-progress' };
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
      return `**Дифф изменился при ребейзе на \`dev@${short(ctx.devNow)}\` — вердикт к нему не применим (§2.10, #492).**\n\n`
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
    case 'push-refused-workflow': {
      const rebase = ctx.stage === 'rebase';
      const files = (ctx.refusal?.files || []).map((f) => `\`${f}\``).join(', ');
      return `**${rebase ? 'Ревью не запускалось' : 'Слияние не выполнено'}: кандидат меняет workflow-файл, токен конвейера не может его опубликовать: ребейз и push делает автор, либо владелец выдаёт право (#705).**\n\n`
        + `GitHub отклонил push \`${short(ctx.candidate)}\` в \`${ctx.ref || ctx.branch}\`${files ? ` (${files})` : ''}: без права на workflow он не принимает коммит, который создаёт или меняет файл в \`.github/workflows/\`, если точно такого файла нет в другой ветке. `
        + `Это отказ GitHub по праву токена, а не расхождение ветки с проверенным материалом (#312).\n\n`
        + (rebase
          ? 'Код никто не читал, вердикта нет, цикл ревью не израсходован. '
          : 'Код-ревью зелёное — вердикт в силе, переделывать работу не нужно. ')
        + `Задача переведена в \`S6-in-progress\`. Дальше — одно из двух:\n\n`
        + `1. ребейз и push делает автор: \`git fetch origin\`, \`git rebase origin/dev\` в ветке \`${ctx.branch}\`, push своими учётными данными с правом на workflow; затем вернуть \`S7-code-review\`;\n`
        + `2. либо владелец выдаёт токену конвейера \`HP_PROCESS_TOKEN\` право на workflow (classic PAT — scope \`workflow\`, fine-grained — Workflows: read and write) и возвращает \`S7-code-review\`.\n\n`
        + refusalExcerpt(ctx);
    }
    case 'push-refused':
      return `**${ctx.stage === 'rebase' ? 'Ревью не запускалось' : 'Слияние не выполнено'}: GitHub отклонил push в \`${ctx.ref || ctx.branch}\` (#705).**\n\n`
        + `Причина, которую назвал GitHub: ${ctx.refusal?.reason ? `\`${ctx.refusal.reason}\`` : 'не указана'}. Это отказ самого GitHub (правило ветки, хук, сбой сервера), а не ветка, изменившаяся после проверенного материала (#312). `
        + (ctx.stage === 'rebase' ? 'Код никто не читал, цикл ревью не израсходован. ' : 'Вердикт ревью в силе. ')
        + `Задача в \`S6-in-progress\`; устранить причину и вернуть \`S7-code-review\`.\n\n`
        + refusalExcerpt(ctx);
    case 'push':
    case 'fast-forward':
      return `материал \`${short(ctx.material)}\` · dev@\`${short(ctx.devNow)}\` → кандидат \`${short(ctx.candidate)}\``
        + (action === 'push' ? ` · Validate ${ctx.runUrl} зелёный` : ' · dev не двигался')
        + ' · слито'
        + (ctx.branchDeleted === true ? ` · ветка \`${ctx.branch}\` удалена` : '')
        + (ctx.branchDeleted === false ? ` · ветка \`${ctx.branch}\` оставлена: её вершина сдвинулась после слияния` : '');
    // Сбой самого шага (`action=error`): `ctx.error` — уже без секретов и не длиннее 1500 знаков.
    case 'error':
      return `**Слияние не выполнено: сбой шага слияния (#492).**\n\n\`\`\`\n${ctx.error ?? ''}\n\`\`\`\n\n`
        + 'Вердикт ревью в силе. Задача в `S6-in-progress`; после разбора сбоя вернуть `S7-code-review`.';
    default:
      return '';
  }
}

/**
 * #752: признаки исходов — заголовок каждого комментария `commentFor`, кроме
 * успешного слияния. `stage` — где исход случается: `merge` — слияние после
 * зелёного вердикта, `rebase` — страж ребейза до ревью (`describePushRefusal`,
 * `_process.yml`). Отчёт процесса (`process-metrics.mjs`) узнаёт по ним
 * причину возврата; переименование заголовка без признака краснит тест на
 * самих шаблонах, а не даёт молча `unknown`.
 */
export const OUTCOME_SIGNS = Object.freeze([
  { action: 'reject-stale', stage: 'merge', re: /^\*\*Слияние отменено: ветка изменилась после проверенного материала/m },
  { action: 'conflict', stage: 'merge', re: /^\*\*Код-ревью зелёное — вердикт выше в силе, переделывать работу не нужно\.\*\* Не удалось только слияние/m },
  { action: 'rereview', stage: 'merge', re: /^\*\*Дифф изменился при ребейзе на `dev@[^`]*` — вердикт к нему не применим/m },
  { action: 'validation-red', stage: 'merge', re: /^\*\*Кандидат после ребейза на `dev@[^`]*` красный/m },
  { action: 'validation-missing', stage: 'merge', re: /^\*\*Validate на кандидате `[^`]*` не появился за \d+ мин/m },
  { action: 'give-up', stage: 'merge', re: /^\*\*`dev` движется быстрее слияния:/m },
  { action: 'push-refused-workflow', stage: 'merge', re: /^\*\*Слияние не выполнено: кандидат меняет workflow-файл/m },
  { action: 'push-refused-workflow', stage: 'rebase', re: /^\*\*Ревью не запускалось: кандидат меняет workflow-файл/m },
  { action: 'push-refused', stage: 'merge', re: /^\*\*Слияние не выполнено: GitHub отклонил push /m },
  { action: 'push-refused', stage: 'rebase', re: /^\*\*Ревью не запускалось: GitHub отклонил push /m },
  { action: 'error', stage: 'merge', re: /^\*\*Слияние не выполнено: сбой шага слияния/m },
].map((sign) => Object.freeze(sign)));

/** Исход по тексту комментария: признак `OUTCOME_SIGNS` или `null`. */
export const outcomeOf = (body) => OUTCOME_SIGNS.find((sign) => sign.re.test(String(body ?? ''))) || null;

// ---------------------------------------------------------------------------
// Исполнение: git + gh через `ops`, чтобы тест подменял их целиком.

/**
 * #596: сколько вывода готов принять один вызов. Умолчание `spawnSync` — 1 МиБ,
 * а `git diff` кандидата несёт три копии бандла: у #594 это 7,1 МБ. Процесс
 * убивался по ENOBUFS, `status` становился `null`, и `status ?? 1` выдавало это
 * за «git вернул 1» — с УСЕЧЁННЫМ stdout в сообщении об ошибке. Разбор уходил
 * в сторону: огрызок диффа выглядит осмысленным.
 */
export const MAX_COMMAND_OUTPUT_BYTES = 256 * 1024 * 1024;

/**
 * Запуск с двумя гарантиями: вывод не обрезается молча, а сбой самого запуска
 * не выдаёт себя за ненулевой код возврата. `r.error` (ENOBUFS, ENOENT, таймаут)
 * уезжает в `stderr` результата, откуда его печатает `must()`.
 */
export const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: MAX_COMMAND_OUTPUT_BYTES, ...opts });
  const failure = r.error ? `${cmd} не выполнился: ${r.error.code || r.error.message}` : '';
  const stderr = [failure, (r.stderr || '').trim()].filter(Boolean).join('\n');
  return { status: failure ? 1 : (r.status ?? 1), stdout: (r.stdout || '').trim(), stderr };
};

// #811: сравниваем нормализованные blob-стороны, а не вырезаем Markdown из
// patch-id целиком. Только цифры счётчиков производны; причины, ID, текст и
// знаменатель Total по-прежнему входят в патч. Нулевой контекст не добавляет
// в сравнение соседний ID, внесённый другой задачей рядом с нашим.
function browserGuardPatchDiff(from, to) {
  const run = (args, opts = {}, statuses = [0]) => {
    const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: MAX_COMMAND_OUTPUT_BYTES, ...opts });
    if (r.error || !statuses.includes(r.status)) {
      throw new Error(`inventory diff: ${r.error?.message || r.stderr || `git exited ${r.status}`}`);
    }
    return r.stdout;
  };
  const blob = (rev) => {
    const entry = run(['ls-tree', '-z', rev, '--', BROWSER_GUARD_INVENTORY]);
    if (!entry) return null; // Файл ещё не существовал в старом дереве.
    const match = /^(100644|100755) blob ([a-f0-9]+)\t([^\0]+)\0$/.exec(entry);
    if (!match || match[3] !== BROWSER_GUARD_INVENTORY) throw new Error('inventory diff: expected a regular inventory blob');
    const text = run(['cat-file', 'blob', match[2]]); // Не trim(): сохраняем байты Markdown.
    return { mode: match[1] === '100755' ? 0o755 : 0o644, text: normalizeBrowserGuardCounts(text) };
  };
  const before = blob(from);
  const after = blob(to);
  if (!before && !after) return '';
  const work = mkdtempSync(join(tmpdir(), 'hp-inventory-patch-'));
  try {
    for (const [side, value] of [['left', before], ['right', after]]) {
      const path = join(work, side, BROWSER_GUARD_INVENTORY);
      mkdirSync(dirname(path), { recursive: true });
      if (value) {
        writeFileSync(path, value.text);
        chmodSync(path, value.mode);
      }
    }
    const diff = run(['diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv',
      '--full-index', '--unified=0', '--src-prefix=a/', '--dst-prefix=b/', '--', 'left', 'right'],
    { cwd: work }, [0, 1]);
    // Убираем только временные имена сторон из заголовков, не из текста.
    return diff.split('\n').map((line) => /^(?:diff --git |--- |\+\+\+ )/.test(line)
      ? line.replace(/\b([ab])\/(?:left|right)\//g, '$1/') : line).join('\n');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function realOps({
  repo, token, issue = '', workflow = 'validate.yml', sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now, exec = sh,
  candidateTree = (sha) => githubCandidateTree({ repo, sha, token }),
  proofContext = (run) => loadGithubProofContext({ repo, run, token }),
  mutants = true,
  log = (line) => console.log(line),
}) {
  const pushUrl = `https://x-access-token:${token}@github.com/${repo}`;
  const git = (...args) => exec('git', args);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: ${r.stderr || r.stdout}`); return r.stdout; };
  // #705: ответ git на отказ — в журнал, без токена и URL с учётными данными.
  const refusedPush = (ref, stderr) => {
    const refusal = classifyPushRefusal(stderr, { secrets: [token] });
    log(`git push ${ref} отклонён — ${refusal.kind}${refusal.reason ? ` (${refusal.reason})` : ''}:\n${refusal.stderr || '(stderr пуст)'}`);
    return refusal;
  };
  return {
    fetch: (...refs) => must(git('fetch', '-q', 'origin', ...refs), 'git fetch'),
    revParse: (ref) => must(git('rev-parse', ref), `rev-parse ${ref}`),
    mergeBase: (a, b) => must(git('merge-base', a, b), 'merge-base'),
    diffNames: (from, to, pathspec = []) => must(git('diff', '--name-only', from, to, '--', ...pathspec), 'diff').split('\n').filter(Boolean),
    // Документы ревью — не часть патча (#516): кандидат несёт свой
    // CODE-REVIEW-N-rK.md, материал — нет, и без pathspec их patch-id
    // расходились на каждом сдвиге dev; `reviewedFresh` судит так же.
    // #698: вердикт судит работу задачи. Ченджлоги объединяет `merge=union`,
    // базу метрик монолита ребейз берёт из dev: строки соседей рядом с записью
    // задачи меняют контекст диффа, но не то, что читал ревьюер.
    patchId: (from, to) => {
      const ordinaryDiff = must(git('diff', '--full-index', from, to, '--', '.', ...PATCH_ID_EXCLUDES,
        `:!${BROWSER_GUARD_INVENTORY}`), 'diff');
      const diff = `${ordinaryDiff}\n${browserGuardPatchDiff(from, to)}`;
      const r = spawnSync('git', ['patch-id', '--stable'], {
        input: diff, encoding: 'utf8', maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
      });
      if (r.error || r.status !== 0) throw new Error(`patch-id: ${r.error?.message || r.stderr || `git exited ${r.status}`}`);
      return (r.stdout || '').trim().split(' ')[0] || 'empty';
    },
    rebaseOnto: (branchTip, onto) => {
      must(git('checkout', '-q', '-B', 'merge-into-dev', branchTip), 'checkout');
      // #643: doc-коммит ветки конфликтует с документами других задач в dev
      // только в генерируемом INDEX.md — это решается пересборкой индекса, а
      // не возвратом зелёной задачи в S6. Любой другой конфликт — отказ, как
      // был; ребейз при отказе уже отменён помощником.
      const r = rebaseRegenerating({ onto, gitPrefix: CONVEYOR_IDENTITY });
      if (!r.ok) {
        console.log(`ребейз на ${onto} отменён: ${r.conflicts.join(', ') || r.reason}`);
        return null;
      }
      return must(git('rev-parse', 'HEAD'), 'rev-parse HEAD');
    },
    // #657 (1б) r1 H1: документ ревью ветки задачи больше не несёт индекс —
    // его пересобирают только коммиты, идущие в dev. Оба пути слияния
    // вызывают это после доказательства применимости зелёного вердикта. Без
    // этого шага в dev уехал бы устаревший INDEX.md — красный `reviews_index`
    // на голове dev. Коммит индекса — doc-коммит конвейера поверх материала,
    // слияние остаётся fast-forward.
    freshIndex: (tip) => {
      must(git('checkout', '-q', '-B', 'merge-into-dev', tip), 'checkout');
      commitCandidateReviewsIndex({ issue });
      return must(git('rev-parse', 'HEAD'), 'rev-parse HEAD');
    },
    // #702: ветка задачи удаляется после слияния — только если её вершина всё
    // ещё та, что влита (lease): коммит, прилетевший после, не теряется.
    // #705: отказ GitHub вершину ветки не доказывает — только устаревший lease
    // оставляет ветку «сдвинутой»; прочее уходит в журнал ошибкой удаления.
    deleteBranch: (ref, expected) => {
      const r = git('push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, pushUrl, `:refs/heads/${ref}`);
      if (r.status === 0) return true;
      const refusal = refusedPush(`:${ref}`, r.stderr);
      if (refusal.kind === PUSH_REFUSAL.stale) return false;
      throw new Error(`git push :${ref}: ${refusal.kind}\n${refusal.stderr}`);
    },
    // true — ушло; false — lease устарел (прежний исход); отказ GitHub —
    // PushRefusal со своим исходом (#705); прочий сбой — ошибка шага.
    pushWithLease: (sha, ref, expected) => {
      const r = git('push', '-q', `--force-with-lease=refs/heads/${ref}:${expected}`, pushUrl, `${sha}:refs/heads/${ref}`);
      if (r.status === 0) return true;
      const refusal = refusedPush(ref, r.stderr);
      if (refusal.kind === PUSH_REFUSAL.stale) return false;
      if (refusal.kind === PUSH_REFUSAL.unknown) throw new Error(`git push ${ref}: ${refusal.stderr}`);
      throw new PushRefusal(ref, refusal, sha);
    },
    // Мутанты по диффу бегут только по запросу (#510): кандидат после ребейза —
    // новое дерево, поэтому слияние запускает Validate с мутантами само и ждёт
    // именно этот dispatch-прогон; push-прогон на том же SHA их не содержит.
    dispatchValidate: (ref, { mutants: withMutants = mutants } = {}) => {
      const r = exec('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', ref, '-f', 'full=false', '-f', `mutants=${withMutants ? 'true' : 'false'}`]);
      if (r.status !== 0) throw new Error(`gh workflow run ${workflow}: ${r.stderr || r.stdout}`);
    },
    waitValidate: async (sha, { event = 'workflow_dispatch' } = {}) => {
      const started = now();
      let runId = null;
      const ignored = new Set();
      const tree = await candidateTree(sha);
      while (now() - started < VALIDATE_TOTAL_MS) {
        const r = exec('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--commit', sha, '--json', 'databaseId,status,conclusion,url,event,headSha,attempt,startedAt,createdAt', '--limit', '10']);
        const all = r.status === 0 && r.stdout ? JSON.parse(r.stdout) : [];
        const runs = all.filter((x) => (!event || x.event === event) && !ignored.has(x.databaseId));
        const run = runs.find((x) => x.databaseId === runId) || runs[0];
        if (run) {
          runId = run.databaseId;
          if (run.status === 'completed') {
            let context;
            try { context = await proofContext(run); }
            catch { context = { proof: null, jobs: [], reuseRuns: new Map() }; }
            const verdict = evaluateCiProof({
              run, ...context, candidate: { sha, tree }, policy: mutants ? CI_PROOF_POLICIES.merge : CI_PROOF_POLICIES.mergeLight,
            });
            if (verdict.status === 'green' || verdict.status === 'failed')
              return { result: verdict.status, url: verdict.url, note: verdict.note };
            ignored.add(run.databaseId);
            runId = null;
            continue;
          }
        } else if (now() - started > VALIDATE_APPEAR_MS) {
          return { result: 'missing', url: null };
        }
        await sleep(20_000);
      }
      return { result: 'failed', url: runId ? `run ${runId} (timeout)` : null };
    },
    comment: (issue, body) => {
      const r = spawnSync('gh', ['issue', 'comment', String(issue), '--repo', repo, '--body-file', '-'], { input: body, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`gh issue comment: ${r.stderr}`);
    },
    log,
  };
}

/**
 * Слияние по алгоритму §4.2. Возвращает { merged, to, action, candidate }.
 *
 * #705: push, отклонённый самим GitHub (право на workflow, правило ветки), —
 * свой исход с комментарием и `S6-in-progress`, а не «ветка изменилась» (#312)
 * и не сбой шага. Устаревший lease по-прежнему решает `decideMerge` внутри попыток.
 */
export async function mergeCandidate(args) {
  try {
    return await mergeAttempts(args);
  } catch (error) {
    const refusal = error && error.refusal;
    if (!refusal || refusal.kind === PUSH_REFUSAL.stale || refusal.kind === PUSH_REFUSAL.unknown) throw error;
    const { branch, material, issue, ops, pipelineUrl } = args;
    const decision = decideMerge({ fresh: true, refused: refusal.kind });
    ops.comment(issue, commentFor(decision.action, {
      branch, material, issue, ref: error.ref, candidate: error.sha, refusal, stage: 'merge', pipelineUrl,
    }));
    ops.log(`решение: ${decision.action} → ${decision.to}`);
    return { merged: false, to: decision.to, action: decision.action, candidate: error.sha || material };
  }
}

async function mergeAttempts({ branch, material, issue, ops, maxAttempts = MAX_ATTEMPTS, mutants = true }) {
  ops.fetch('dev', branch);
  const actual = ops.revParse(`origin/${branch}`);
  const reviewedFresh = actual === material
    || (safe(() => ops.revParse(`${actual}^`)) === material
      && ops.diffNames(material, actual, ['.', ':!docs/reviews']).length === 0);
  const ctx = { branch, material, actual, issue };
  const finish = (decision, extra = {}) => {
    const merged = decision.action === 'push' || decision.action === 'fast-forward';
    // #702: влитая ветка больше не нужна — 368 таких висели на origin, и агент,
    // искавший ветку по номеру, мог взять устаревшую. `branchTip` — вершина,
    // которую слияние видело последней: кандидат, опубликованный в ветку, либо
    // материал при fast-forward. Сбой удаления слияние не отменяет.
    let branchDeleted = null;
    if (merged && extra.branchTip) {
      try { branchDeleted = ops.deleteBranch(branch, extra.branchTip); }
      catch (error) { ops.log(`ветка ${branch} не удалена: ${error.message}`); }
    }
    const body = commentFor(decision.action, { ...ctx, ...extra, attempt: extra.attempt, branchDeleted });
    if (body) ops.comment(issue, body);
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
      const target = ops.freshIndex(tip);
      const pushed = ops.pushWithLease(target, 'dev', devNow);
      const decision = decideMerge({ fresh: true, devMoved: false, leaseRejected: !pushed });
      if (decision.action === 'retry') continue;
      return finish(decision, { candidate: target, devNow, branchTip: tip });
    }

    let candidate = ops.rebaseOnto(tip, 'origin/dev');
    if (!candidate) return finish(decideMerge({ fresh: true, devMoved: true, conflict: true }), { devNow });

    const patchIdEqual = ops.patchId(materialBase, material) === ops.patchId(devNow, candidate);
    // #811: the candidate's generator is code, not merely data. Run it only
    // while the green verdict still applies; a changed diff first needs a
    // new review. The index commit is included in the exact Validate SHA.
    if (patchIdEqual) candidate = ops.freshIndex(candidate);
    // кандидат публикуется в ветку в любом случае: он и есть то, что должно
    // ехать в dev, и Validate стартует именно от этого push
    if (!ops.pushWithLease(candidate, branch, tip)) {
      // ветку задачи подвинули, пока шло ревью или ребейз — это #312, не наш случай
      return finish(decideMerge({ fresh: false }), { candidate, devNow });
    }
    tip = candidate;
    if (!patchIdEqual) return finish(decideMerge({ fresh: true, devMoved: true, patchIdEqual: false }), { candidate, devNow });

    // мутанты по диффу — по запросу (#510): dispatch на ветке, где теперь стоит
    // кандидат.
    //
    // #696: на треках show/ship мутантов нет, и лёгкий Validate на кандидате
    // уже запустил сам push выше — второй, dispatch-прогон, повторил бы его
    // целиком. Ждётся push-прогон; dispatch — только если его нет: push, в
    // котором сдвинулись одни docs/reviews/**, Validate не запускает
    // (paths-ignore), а отменённый concurrency прогон заменить некому.
    let result;
    let url;
    if (mutants) {
      ops.dispatchValidate(branch);
      ops.log(`Validate с мутантами на кандидате ${candidate.slice(0, 8)} — ждём`);
      ({ result, url } = await ops.waitValidate(candidate, { event: 'workflow_dispatch' }));
    } else {
      ops.log(`лёгкий Validate на кандидате ${candidate.slice(0, 8)} — ждём push-прогон`);
      ({ result, url } = await ops.waitValidate(candidate, { event: 'push' }));
      if (result === 'missing') {
        ops.log('push-прогона на кандидате нет — лёгкий dispatch');
        ops.dispatchValidate(branch);
        ({ result, url } = await ops.waitValidate(candidate, { event: 'workflow_dispatch' }));
      }
    }
    let decision = decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: result, attempt, maxAttempts });
    if (decision.action !== 'push') return finish(decision, { candidate, devNow, runUrl: url });

    const pushed = ops.pushWithLease(candidate, 'dev', devNow);
    decision = decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: result, leaseRejected: !pushed, attempt, maxAttempts });
    if (decision.action === 'retry') { ops.log('dev двинулся снова — ещё попытка'); continue; }
    return finish(decision, { candidate, devNow, runUrl: url, attempt, branchTip: candidate });
  }
  return finish(decideMerge({ fresh: true, devMoved: true, patchIdEqual: true, validate: 'green', leaseRejected: true, attempt: maxAttempts, maxAttempts }), { candidate: tip, attempt: maxAttempts });
}

const safe = (fn) => { try { return fn(); } catch { return null; } };

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/**
 * #705: отказ push для шага workflow — стража ребейза в `_process.yml`. Тот же
 * разбор, что у слияния: исход, ответ git без секретов и, для отказа GitHub,
 * текст комментария в issue.
 */
export function describePushRefusal(stderr, { ref, branch, candidate, stage = 'rebase', pipelineUrl, secrets = [] } = {}) {
  const refusal = classifyPushRefusal(stderr, { secrets });
  const action = refusal.kind === PUSH_REFUSAL.workflow ? 'push-refused-workflow'
    : refusal.kind === PUSH_REFUSAL.remote ? 'push-refused' : '';
  const comment = action ? commentFor(action, { ref, branch, candidate, refusal, stage, pipelineUrl }) : '';
  return { refusal, comment };
}

/**
 * #723: шаги публикации — документ ревью в ветку задачи (`_process.yml`) и
 * документ ревью релиза в `dev` (`release-review.yml`) — любой отказ push
 * считали сдвигом ветки и повторяли. Повтор лечит только устаревший lease;
 * отказ GitHub шаг останавливает, а причина и ответ git (уже без секретов)
 * ложатся в сводку шага. Текст — здесь, а не многострочной строкой в `run:`.
 * #730: так же — пакетное ревью ship (`_ship-review.yml`), коммит производных
 * артефактов беты (`_beta-derived.yml`) и страж ребейза (`_process.yml`).
 */
const PUBLISHED = Object.freeze({
  'review-doc': 'Документ ревью',
  'release-review': 'Документ независимого ревью релиза',
  'ship-review': 'Документ пакетного ревью ship',
  'beta-derived': 'Коммит производных артефактов беты',
  rebase: 'Ребейз ветки на dev',
});

export function refusalSummary(refusal, { ref = '', stage = '' } = {}) {
  const what = PUBLISHED[stage] || 'Коммит';
  const why = refusal.kind === PUSH_REFUSAL.workflow
    ? 'GitHub отклонил push по праву на workflow: у токена конвейера нет права создавать и менять `.github/workflows/`'
    : refusal.kind === PUSH_REFUSAL.remote
      ? 'GitHub отклонил push сам (правило ветки, хук, сбой сервера)'
      : 'git push не удался, и это не отказ по lease (сеть, аутентификация)';
  // #730 r1: при отказе по праву на workflow ребейз — штатный выход, только
  // делает его автор (PROCESS.md §10.4). «Ребейз не поможет» говорило обратное.
  const nextStep = refusal.kind === PUSH_REFUSAL.workflow
    ? `Это не сдвиг \`${ref}\`: повтор этого шага не поможет, шаг остановлен без повторов. Кандидат меняет workflow-файл, токен конвейера не может его опубликовать: ребейз и push делает автор, либо владелец выдаёт право.`
    : `Это не сдвиг \`${ref}\`: повтор и ребейз не помогут, шаг остановлен без повторов.`;
  // Ответ GitHub не должен открыть или закрыть блок кода сводки.
  const unfence = (text) => String(text || '').replace(/```/g, "'''");
  const files = (refusal.files || []).map((file) => `\`${file}\``).join(', ');
  const stderr = unfence(refusal.stderr);
  return [
    `### git push в \`${ref}\` отклонён: ${refusal.kind} (#723)`,
    '',
    `${what} не опубликован в \`${ref}\`. ${why}. ${nextStep}`,
    ...(refusal.reason ? ['', `Причина, которую назвал GitHub: «${unfence(refusal.reason)}».${files ? ` Файлы: ${files}.` : ''}`] : []),
    '',
    stderr ? `Ответ git:\n\n\`\`\`\n${stderr}\n\`\`\`` : 'git не прислал текста отказа.',
    '',
  ].join('\n');
}

/**
 * `--push-refusal=<файл со stderr git push>`: в stdout — одно слово исхода
 * (`stale`, `workflow`, `remote-rejected`, `unknown`), в stderr — ответ git
 * без секретов (журнал), с `--comment=<файл>` — комментарий для issue, с
 * `--summary=<файл>` (#723) — сводка шага об отказе, который повтор не лечит
 * (для `stale` не пишется: шаг повторяет).
 */
function pushRefusalMain() {
  const secrets = [process.env.TOKEN, process.env.HP_PROCESS_TOKEN, process.env.GH_TOKEN].filter(Boolean);
  const ref = arg('ref') || arg('branch');
  const stage = arg('stage') || 'rebase';
  const { refusal, comment } = describePushRefusal(readFileSync(arg('push-refusal'), 'utf8'), {
    ref, branch: arg('branch'), candidate: arg('candidate'), stage, pipelineUrl: arg('run-url'), secrets,
  });
  console.error(`git push отклонён — ${refusal.kind}${refusal.reason ? ` (${refusal.reason})` : ''}:\n${refusal.stderr || '(stderr пуст)'}`);
  if (arg('comment') && comment) writeFileSync(arg('comment'), `${comment}\n`);
  if (arg('summary') && refusal.kind !== PUSH_REFUSAL.stale) appendFileSync(arg('summary'), refusalSummary(refusal, { ref, stage }));
  process.stdout.write(`${refusal.kind}\n`);
}

if (isMainModule(import.meta.url) && arg('push-refusal')) pushRefusalMain();
else if (isMainModule(import.meta.url)) { // #496: переносимо для Windows
  const branch = arg('branch');
  const material = arg('material');
  const issue = arg('issue');
  const repo = arg('repo') || process.env.GITHUB_REPOSITORY;
  const token = process.env.HP_PROCESS_TOKEN || process.env.TOKEN;
  if (!branch || !material || !issue || !repo || !token) {
    console.error('usage: merge-candidate.mjs --branch=<issue branch> --material=<sha> --issue=<n> [--repo=owner/name] [--mutants=false]; HP_PROCESS_TOKEN in env');
    process.exit(2);
  }
  // #696: `--mutants=false` — треки show/ship сливаются по лёгкому Validate.
  const mutants = arg('mutants') !== 'false';
  const ops = realOps({ repo, token, issue, mutants });
  const pipelineUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
  mergeCandidate({ branch, material, issue, ops, mutants, pipelineUrl }).then((r) => {
    const out = `merged=${r.merged}\nto=${r.to || ''}\naction=${r.action}\ncandidate=${r.candidate}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out);
    process.stdout.write(out);
  }, (err) => {
    // Инвариант конвейера: после прогона метка меняется всегда. Сбой самого
    // слияния — не повод оставить задачу висеть в S7: S6 и внятный комментарий.
    // #705: текст сбоя уходит в issue — без токена и URL с учётными данными.
    console.error(redactSecrets(err && err.stack || err, [token]));
    try {
      ops.comment(issue, commentFor('error', { error: redactSecrets(String(err && err.message || err), [token]).slice(0, 1500) }));
    } catch (e) { console.error(e); }
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'merged=false\nto=S6-in-progress\naction=error\n');
    process.exit(0);
  });
}
