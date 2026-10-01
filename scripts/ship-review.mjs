#!/usr/bin/env node
/**
 * Пакетное ревью задач `track:ship` перед бетой (#696, PROCESS.md §11.7).
 *
 *   node scripts/ship-review.mjs doc --tag=v1.79.0-beta.1
 *   node scripts/ship-review.mjs doc --tag=nightly --candidate=<sha>
 *   node scripts/ship-review.mjs mode --tag=<тег|nightly> [--candidate=<sha>]
 *   node scripts/ship-review.mjs prepare --tag=<тег|nightly> --candidate=<sha> --out=<dir> [--force=true] [--repo=owner/name]
 *   node scripts/ship-review.mjs check --tag=<тег> --candidate=<sha> [--repo=owner/name]
 *   node scripts/ship-review.mjs comment-high --mode=<nightly|beta> --high=<N> --doc=<путь> --issues=<NN,…> [--repo=owner/name]
 *
 * `ship` сливается без ревью модели (§5): правка в механических рамках и
 * зелёный лёгкий Validate. Прочитать её код обязан кто-то до того, как она
 * уйдёт пользователям, — это пакетное ревью всех ship-задач диапазона
 * «прошлый тег..кандидат беты» одной сессией модели.
 *
 * Какие задачи — ship, доказывает конвейер, а не метка: слияние без модели
 * оставляет в issue машинный маркер `<!-- hp:ship-merge material=<sha> -->`.
 * Метка `track:ship` на issue в диапазоне тоже включает задачу в пакет —
 * лишний разбор дешевле пропущенного. Состав диапазона — трейлеры `Issue: #NN`,
 * тот же построитель, что у `RELEASE-MEMBERSHIP.json` (#547).
 *
 * `check` — гейт публикации беты: каждая ship-задача диапазона покрыта
 * документами ревью той же базы (`shipCoverage`, #727) — последний документ,
 * где она есть, прочитал тот же патч-набор и не несёт High.
 *
 * Ночной режим (#727): `tag=nightly` — ночь после полного Validate читает
 * непокрытые ship-задачи головы `dev` и пишет
 * `docs/reviews/SHIP-REVIEW-<база>-dev-<sha12>.md`. Бета затем читает только
 * дельту — задачи без покрытия или изменившиеся после ревью.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { lastUsageIn, publishedUsageLine } from './model-usage.mjs';
import { issueTrailers, readCandidateHistory } from './release-membership.mjs';
import { parseDocName } from './reviews-index.mjs';

export const SHIP_REVIEW_DIR = 'docs/reviews';
/** #727: зарезервированное значение входа `tag` — ночной режим ship-ревью. */
export const NIGHTLY_TAG = 'nightly';
/** #727 К8: метка комментария о High ночного документа; одна на документ и задачу. */
export const SHIP_HIGH_MARKER_RE = /<!-- hp:ship-review-high doc=([^\s>]+) -->/g;
export const SHIP_MERGE_MARKER_RE = /<!-- hp:ship-merge material=([0-9a-f]{40}) -->/;
/** #707: риск по участкам, с которым ship слит (трек подтверждён владельцем или риск только visual). */
export const SHIP_RISK_MARKER_RE = /<!-- hp:ship-risk classes=([a-z,]+) -->/;
export const SHIP_REVIEW_ANCHOR = '<!-- hp-ship-review-anchors -->';
export const RELEASE_TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;
const SHA_RE = /^[0-9a-f]{40,64}$/;
const PATCH_ID_RE = /^[0-9a-f]{40,64}$/;
const TZ_LIMIT = 1500;

/** Путь документа пакетного ревью для тега беты или стабильного. */
export function shipReviewDocPath(tag) {
  if (!RELEASE_TAG_RE.test(String(tag))) throw new Error(`not a release tag: ${tag}`);
  return `${SHIP_REVIEW_DIR}/SHIP-REVIEW-${tag}.md`;
}

/**
 * #727 К2: режим по входу `tag`. `nightly` зарезервирован; кандидат в нём
 * обязателен — это голова `dev` прогона ночного Validate, а не «вершина сейчас».
 */
export function shipReviewMode({ tag, candidate = '' } = {}) {
  if (tag === NIGHTLY_TAG) {
    if (!String(candidate || '').trim()) {
      throw new Error('tag=nightly требует candidate — SHA головы dev, на которой шёл ночной полный Validate');
    }
    return 'nightly';
  }
  shipReviewDocPath(tag);
  return 'beta';
}

/** #727 К2: ночной документ — по базе (прошлый тег кандидата) и SHA кандидата. */
export function nightlyDocPath({ base, candidate }) {
  if (!RELEASE_TAG_RE.test(String(base || ''))) {
    throw new Error(`ночной документ без базы: у кандидата ${candidate} нет прошлого тега (${base || '—'})`);
  }
  if (!SHA_RE.test(String(candidate))) throw new Error(`invalid candidate SHA: ${candidate}`);
  return `${SHIP_REVIEW_DIR}/SHIP-REVIEW-${base}-dev-${candidate.slice(0, 12)}.md`;
}

/** Документ прогона: ночной — по базе и SHA, бета — по тегу. */
export function shipDocPath({ tag, candidate = '', base = null }) {
  return shipReviewMode({ tag, candidate }) === 'nightly' ? nightlyDocPath({ base, candidate }) : shipReviewDocPath(tag);
}

const docName = (path) => String(path).slice(String(path).lastIndexOf('/') + 1);
const docPath = (name) => `${SHIP_REVIEW_DIR}/${name}`;

/** Задача — ship, если конвейер слил её без модели или на ней стоит `track:ship`. */
export function isShipIssue({ labels = [], comments = [] } = {}) {
  const names = labels.map((label) => (typeof label === 'string' ? label : label?.name));
  return names.includes('track:ship') || comments.some((c) => SHIP_MERGE_MARKER_RE.test(String(c?.body ?? '')));
}

/**
 * Строка риска из последнего комментария слияния ship (#707): `{ classes, line }`
 * или null. Комментарии задач до #707 строки не несут — риск не записан.
 */
export function shipRiskFrom(comments = []) {
  const merges = (comments || []).map((c) => String(c?.body ?? '')).filter((body) => SHIP_MERGE_MARKER_RE.test(body));
  const body = merges.at(-1);
  const marker = body && SHIP_RISK_MARKER_RE.exec(body);
  if (!marker) return null;
  const classes = marker[1].split(',').filter(Boolean);
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.startsWith('Риск по участкам'))
    || `Риск по участкам: ${classes.join(', ')}`;
  return { classes, line };
}

/** Раздел `## ТЗ` тела issue — для ship это строка «что меняется и чем проверить». */
export function specSection(body = '') {
  const text = String(body);
  const start = text.search(/^#{1,3}\s*ТЗ(?![\p{L}\p{N}_])/mu);
  if (start < 0) return '';
  const rest = text.slice(start).split('\n');
  const out = [rest[0]];
  for (const line of rest.slice(1)) {
    if (/^#{1,3}\s/.test(line)) break;
    out.push(line);
  }
  const section = out.join('\n').trim();
  return section.length > TZ_LIMIT ? `${section.slice(0, TZ_LIMIT)}…` : section;
}

/**
 * Ship-задачи диапазона: номера из трейлеров коммитов, признак ship — из
 * данных issue. `issueData(number)` → `{ title, body, labels, comments }` или null.
 */
export function shipIssuesInRange({ commits = [], issueData }) {
  const byIssue = new Map();
  for (const commit of commits) {
    for (const number of issueTrailers(commit.message)) {
      if (!byIssue.has(number)) byIssue.set(number, []);
      byIssue.get(number).push({ sha: commit.sha, subject: String(commit.message).split('\n')[0] });
    }
  }
  const out = [];
  for (const [number, list] of [...byIssue].sort((a, b) => a[0] - b[0])) {
    const data = issueData(number);
    if (!data || !isShipIssue(data)) continue;
    const risk = shipRiskFrom(data.comments);
    out.push({ number, title: data.title || '', spec: specSection(data.body), ...(risk ? { risk } : {}), commits: list.reverse() });
  }
  return out;
}

/** #727 К1: трейлер `Release:` — кандидат беты, коммит бота `beta-derived`, приёмка эталонов. */
export function hasReleaseTrailer(message = '') {
  return String(message).split(/\r?\n/).some((line) => /^Release:\s*\S/.test(line.trim()));
}

/**
 * #727 К1: входит ли коммит задачи в её патч-набор. Не входят коммиты с
 * трейлером `Release:` (кандидат беты несёт `Issue:` всех задач линии) и
 * коммиты только в `docs/reviews/**` (индекс, документ ревью): без этого набор
 * ночи никогда не совпадёт с набором на кандидате.
 */
export function countsForPatchSet({ message = '', files = [] } = {}) {
  if (hasReleaseTrailer(message)) return false;
  return !(files.length && files.every((file) => String(file).startsWith(`${SHIP_REVIEW_DIR}/`)));
}

// Дифф для patch-id — с явными опциями: конфиг git владельца (`npm run
// release:prerelease` судит у него) не должен менять форму диффа и с ней набор.
const PATCH_DIFF = [
  '-c', 'core.quotePath=true', 'diff-tree', '--stdin', '-r', '--root', '-p', '--no-color', '--no-ext-diff',
  '--no-textconv', '--no-renames', '--no-relative', '--diff-algorithm=myers', '--indent-heuristic', '-U3',
  '--inter-hunk-context=0', '--src-prefix=a/', '--dst-prefix=b/',
];

/**
 * `git patch-id --stable` коммитов: Map sha → patch-id. Коммит без диффа
 * (пустой, слияние) patch-id не имеет и в Map не попадает.
 */
export function commitPatchIds(shas, { cwd } = {}) {
  const list = [...new Set(shas)];
  if (!list.length) return new Map();
  const diff = git(PATCH_DIFF, { cwd, input: `${list.join('\n')}\n` });
  const ids = git(['patch-id', '--stable'], { cwd, input: diff });
  const out = new Map();
  for (const line of ids.split('\n')) {
    const [pid, sha] = line.trim().split(/\s+/);
    if (pid && sha && list.includes(sha)) out.set(sha, pid);
  }
  return out;
}

/** Изменённые файлы коммитов: Map sha → [путь]. */
export function commitFiles(shas, { cwd } = {}) {
  const list = [...new Set(shas)];
  const out = new Map(list.map((sha) => [sha, []]));
  if (!list.length) return out;
  const text = git(['diff-tree', '--stdin', '-r', '--root', '--no-renames', '--name-only'], { cwd, input: `${list.join('\n')}\n` });
  let current = null;
  for (const line of text.split('\n')) {
    if (out.has(line)) { current = line; continue; }
    if (current && line) out.get(current).push(line);
  }
  return out;
}

/**
 * #727 К1: патч-набор каждой задачи — отсортированные `git patch-id --stable`
 * её коммитов диапазона (`readCandidateHistory`), без `Release:` и коммитов
 * только в `docs/reviews/**`. Порядок коммитов не важен.
 * @returns {Map<number, string[]>}
 */
export function issuePatchSets({ commits = [], numbers = [], cwd } = {}) {
  const wanted = new Set(numbers.map(Number));
  const sets = new Map([...wanted].map((number) => [number, new Set()]));
  const relevant = commits.filter((commit) => issueTrailers(commit.message).some((number) => wanted.has(number)));
  const files = commitFiles(relevant.map((commit) => commit.sha), { cwd });
  const counted = relevant.filter((commit) => countsForPatchSet({ message: commit.message, files: files.get(commit.sha) }));
  const ids = commitPatchIds(counted.map((commit) => commit.sha), { cwd });
  for (const commit of counted) {
    const pid = ids.get(commit.sha);
    if (!pid) continue;
    for (const number of issueTrailers(commit.message)) if (wanted.has(number)) sets.get(number).add(pid);
  }
  return new Map([...sets].sort((a, b) => a[0] - b[0]).map(([number, set]) => [number, [...set].sort()]));
}

/** `patches` машинного блока: `<NN>:<pid>+<pid>,…`, задачи и patch-id по порядку. */
export function formatPatches(patches) {
  const entries = [...(patches instanceof Map ? patches : new Map(Object.entries(patches || {})))]
    .map(([number, pids]) => [Number(number), [...new Set(pids || [])].sort()])
    .sort((a, b) => a[0] - b[0]);
  return entries.length ? entries.map(([number, pids]) => `${number}:${pids.join('+')}`).join(',') : '—';
}

/** Обратное к `formatPatches`: Map номер → отсортированные patch-id. Испорченная запись пропускается. */
export function parsePatches(text = '') {
  const out = new Map();
  const value = String(text ?? '').trim();
  if (!value || value === '—') return out;
  for (const entry of value.split(',')) {
    const match = /^([1-9]\d*):([0-9a-f+]*)$/.exec(entry.trim());
    if (!match) continue;
    const pids = match[2].split('+').filter(Boolean);
    if (pids.some((pid) => !PATCH_ID_RE.test(pid))) continue;
    out.set(Number(match[1]), [...new Set(pids)].sort());
  }
  return out;
}

function samePatchSet(recorded, current) {
  if (!Array.isArray(recorded) || !Array.isArray(current) || recorded.length !== current.length) return false;
  const [a, b] = [[...recorded].sort(), [...current].sort()];
  return a.every((pid, i) => pid === b[i]);
}

/**
 * #727 К3: покрытие ship-задач документами пакетного ревью той же базы.
 * `docs` — по возрастанию публикации (последний — позже всех), `{ name, text }`
 * или `{ name, block }`. `base` — тег базы диапазона; `undefined` — не фильтровать.
 *
 *  - `clean` — последний документ, где задача есть, записал тот же патч-набор, High 0;
 *  - `high`  — то же, но High > 0 (или числа High нет): High снимает покрытие со всех задач документа;
 *  - `stale` — последний документ записал другой патч-набор: код изменился после ревью;
 *  - `none`  — задачи нет ни в одном документе.
 * Документ без строки `patches` (до #727) покрывает по номеру.
 */
export function shipCoverage({ ship = [], docs = [], base } = {}) {
  const read = docs.map((doc) => ({ name: doc.name, block: doc.block ?? parseAnchorBlock(doc.text ?? '') }))
    .filter((doc) => doc.block && (base === undefined || (doc.block.base ?? null) === (base ?? null)));
  return ship.map((issue) => {
    const last = read.findLast((doc) => doc.block.issues.includes(issue.number));
    if (!last) return { number: issue.number, status: 'none', doc: null };
    const { block } = last;
    if (block.patches && !samePatchSet(block.patches.get(issue.number), issue.patches)) {
      return { number: issue.number, status: 'stale', doc: last.name };
    }
    return { number: issue.number, status: block.high === 0 ? 'clean' : 'high', doc: last.name };
  });
}

const NO_SHIP_NOTE = 'ship-задач в диапазоне нет — ревью не нужно';

/**
 * #727 К2, К5: что читать этому прогону. Без `force` — только `none` и
 * `stale`; `high` держит гейт до починки и `force=true`, `clean` уже прочитаны.
 * `force` читает все ship-задачи диапазона и на документы не смотрит.
 */
export function planShipReview({ tag, ship = [], docs = [], base = null, force = false } = {}) {
  const mode = tag === NIGHTLY_TAG ? 'nightly' : 'beta';
  if (force) return { mode, read: ship, covered: [], held: [], note: ship.length ? '' : NO_SHIP_NOTE };
  const coverage = shipCoverage({ ship, docs, base });
  const status = new Map(coverage.map((item) => [item.number, item]));
  const read = ship.filter((issue) => ['none', 'stale'].includes(status.get(issue.number).status));
  const covered = coverage.filter((item) => item.status === 'clean').map(({ number, doc }) => ({ number, doc }));
  const held = coverage.filter((item) => item.status === 'high').map(({ number, doc }) => ({ number, doc }));
  let note = '';
  if (!ship.length) note = NO_SHIP_NOTE;
  else if (!read.length && !held.length) note = `все ship-задачи покрыты: ${[...new Set(covered.map((item) => item.doc))].join(', ')} — модель не запускается`;
  else if (!read.length) {
    note = `читать нечего: ${held.map((item) => `#${item.number} — High в ${item.doc}`).join(', ')}`
      + ' — гейт беты стоит до починки и пересъёмки (force=true)';
  }
  return { mode, read, covered, held, note };
}

/** #727 К2: строка промпта о кандидате. */
export function reviewSubject(tag) {
  return tag === NIGHTLY_TAG
    ? 'Ночное пакетное ревью: кандидат — голова `dev` после ночного полного Validate.'
    : `Бета: ${tag}.`;
}

export function renderShipBrief({ tag, candidate, base, ship, runUrl = '', doc = null, covered = [], held = [] }) {
  const nightly = tag === NIGHTLY_TAG;
  const byDoc = (items) => items.map((item) => `#${item.number} — \`${docPath(item.doc)}\``).join(', ');
  const atNight = covered.filter((item) => parseDocName(item.doc)?.nightly);
  const before = covered.filter((item) => !parseDocName(item.doc)?.nightly);
  const lines = [
    nightly ? '# Вход ночного пакетного ревью ship' : `# Вход пакетного ревью ship ${tag}`,
    '',
    `- Кандидат: \`${candidate}\`${nightly ? ' — голова `dev` после ночного полного Validate' : ''}`,
    `- Диапазон: ${base ? `\`${base.tag}\` · \`${base.sha}\`` : 'нет прошлого тега — всё дерево'} .. кандидат`,
    ...(runUrl ? [`- Прогон: ${runUrl}`] : []),
    `- Документ: \`${doc || shipReviewDocPath(tag)}\``,
    ...(atNight.length ? [`- Прочитаны ночью: ${byDoc(atNight)} — не перечитывать`] : []),
    ...(before.length ? [`- Прочитаны прежним ревью: ${byDoc(before)} — не перечитывать`] : []),
    ...(held.length ? [`- High ждёт починки: ${byDoc(held)} — не перечитывать, их держит гейт беты (§11.7)`] : []),
    '',
    `## Задачи ship (${ship.length}) — слиты без ревью модели`,
    '',
  ];
  for (const issue of ship) {
    lines.push(`### #${issue.number} · ${issue.title}`, '');
    lines.push(issue.spec ? issue.spec : '(раздела «## ТЗ» в теле нет — ТЗ задачи не записано, это находка)', '');
    if (issue.risk?.line) lines.push(issue.risk.line, '');
    lines.push('Коммиты (`git show <sha>`):', '');
    for (const commit of issue.commits) lines.push(`- \`${commit.sha}\` ${commit.subject}`);
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/**
 * Машинный блок документа: его пишет публикация, читает `check`. #727: строки
 * `mode` и `patches` дописываются в конец, прежние строки не меняются.
 *
 * #737: `usage` — строка расхода модели (`model-usage.mjs`) сразу после
 * закрывающего ``` блока, а не строкой внутри: формат один на все документы
 * ревью, а содержимое блока, которое читают гейт беты и покрытие, не меняется.
 * Значение — выход недоверенной стадии: пусто — `reason=missing`, не по
 * формату — `reason=invalid`. Не передано (вызов до #737) — строки нет.
 */
export function anchorBlock({
  tag, candidate, base = null, issues = [], high = 0, medium = 0, low = 0, runUrl = '', mode = null, patches = null,
  usage = null,
}) {
  return [
    SHIP_REVIEW_ANCHOR,
    '### Материал пакетного ревью',
    '',
    '```',
    `tag ${tag}`,
    `candidate ${candidate}`,
    `base ${base || '—'}`,
    `issues ${issues.length ? issues.join(',') : '—'}`,
    `high ${high}`,
    `medium ${medium}`,
    `low ${low}`,
    `run ${runUrl || '—'}`,
    ...(mode ? [`mode ${mode}`] : []),
    ...(patches ? [`patches ${formatPatches(patches)}`] : []),
    '```',
    ...(usage != null ? [publishedUsageLine(usage)] : []),
    '',
  ].join('\n');
}

/**
 * Поля машинного блока. `base`, `mode` и `patches` появляются, только если
 * блок их несёт: документ до #727 без `patches` покрывает задачи по номеру.
 * #737: `usage` — разобранная строка расхода после последнего маркера блока,
 * если она есть (`{ input_tokens, …, num_turns }` либо `{ reason }`).
 */
export function parseAnchorBlock(text = '') {
  const at = String(text).lastIndexOf(SHIP_REVIEW_ANCHOR);
  if (at < 0) return null;
  const fence = /```\n([\s\S]*?)\n```/.exec(String(text).slice(at));
  if (!fence) return null;
  const fields = Object.fromEntries(fence[1].split('\n').map((line) => {
    const space = line.indexOf(' ');
    return space < 0 ? [line, ''] : [line.slice(0, space), line.slice(space + 1).trim()];
  }));
  const number = (value) => (/^\d+$/.test(String(value)) ? Number(value) : null);
  const given = (value) => value != null && value !== '' && value !== '—';
  const usage = lastUsageIn(String(text).slice(at));
  return {
    tag: fields.tag || null,
    candidate: fields.candidate || null,
    issues: String(fields.issues || '').split(',').map((s) => number(s.trim())).filter((n) => n != null),
    high: number(fields.high),
    medium: number(fields.medium),
    low: number(fields.low),
    ...(given(fields.base) ? { base: fields.base } : {}),
    ...(given(fields.mode) ? { mode: fields.mode } : {}),
    ...('patches' in fields ? { patches: parsePatches(fields.patches) } : {}),
    ...(usage ? { usage } : {}),
  };
}

/**
 * Причины не публиковать бету; пустой список — гейт пройден. Без ship-задач в
 * диапазоне документ не нужен: пакетному ревью нечего читать.
 *
 * #727 К4: судит покрытие (`shipCoverage`) документами той же базы `docs` —
 * ночными и документом тега. Все задачи `clean` — гейт пройден и без
 * документа тега. `docText` — прежний вызов: только документ тега.
 */
export function shipReviewProblems({ tag, ship = [], docText = null, docs = null, base } = {}) {
  if (!ship.length) return [];
  const doc = shipReviewDocPath(tag);
  const run = `gh workflow run ship-review.yml --ref dev -f tag=${tag}`;
  const range = docs ?? (docText ? [{ name: docName(doc), text: docText }] : []);
  const own = range.find((item) => item.name === docName(doc)) || null;
  const problems = [];
  if (own) {
    const block = parseAnchorBlock(own.text);
    if (!block) return [`${doc} без машинного блока ${SHIP_REVIEW_ANCHOR}: покрытие задач не доказано. Переснять: ${run} -f force=true`];
    if (block.tag !== tag) problems.push(`${doc} записан для тега ${block.tag}, а публикуется ${tag}`);
    if (base !== undefined && (block.base ?? null) !== (base ?? null)) {
      problems.push(`${doc} записан для базы ${block.base ?? '—'}, а диапазон кандидата — от ${base ?? '—'}`);
    }
  }
  // Документ тега уже в dev: ship-review.yml без force его не переснимает.
  const rerun = own ? `${run} -f force=true` : run;
  const coverage = shipCoverage({ ship, docs: range, base });
  const list = (numbers) => numbers.map((n) => `#${n}`).join(', ');
  const sameBase = range.filter((item) => base === undefined || (parseAnchorBlock(item.text)?.base ?? null) === (base ?? null));
  const missing = coverage.filter((item) => item.status === 'none').map((item) => item.number);
  if (missing.length) {
    problems.push(own || sameBase.length
      ? `${own ? doc : `ни один документ ревью базы ${base ?? '—'} (${sameBase.map((item) => item.name).join(', ')})`} не покрывает ship-задачи ${list(missing)} — они не прочитаны: слиты после ревью. Запустить: ${rerun}`
      : `${doc} нет ни в кандидате, ни в dev: ship-задачи ${list(missing)} слиты без ревью модели, и их код до беты не читал никто (PROCESS.md §11.7). Запустить: ${run}`);
  }
  for (const item of coverage.filter((entry) => entry.status === 'stale')) {
    problems.push(`ship-задача #${item.number} изменилась после ревью ${docPath(item.doc)}: в нём записан другой патч-набор, новый код не прочитан. Запустить: ${rerun}`);
  }
  for (const name of [...new Set(coverage.filter((item) => item.status === 'high').map((item) => item.doc))]) {
    const block = parseAnchorBlock(range.findLast((item) => item.name === name)?.text ?? '') ?? {};
    const where = `${docPath(name)} (задачи ${list(coverage.filter((item) => item.doc === name && item.status === 'high').map((item) => item.number))})`;
    if (block.high == null) problems.push(`${where}: в машинном блоке нет числа High`);
    else if (block.high > 0) problems.push(`${where}: High ${block.high} — бета ждёт починки: находка чинится отдельной задачей, затем ревью переснимается: ${run} -f force=true`);
  }
  return problems;
}

/** #727 К8: строка в задачу ночного документа с High. */
export function highCommentBody(doc) {
  const path = String(doc).includes('/') ? String(doc) : docPath(doc);
  return `Ночное пакетное ревью ship нашло High: \`${path}\`. Бета не выйдет, пока находка не починена отдельной задачей`
    + ` и ревью не переснято (§11.7) <!-- hp:ship-review-high doc=${docName(path)} -->`;
}

/** #727 К8: задачи, куда строка ещё не писалась — повтор на тот же документ не пишется. */
export function highCommentTargets({ doc, issues = [] }) {
  const name = docName(doc);
  return issues.filter((issue) => !(issue.comments || []).some((comment) => [...String(comment?.body ?? '')
    .matchAll(SHIP_HIGH_MARKER_RE)].some((match) => match[1] === name))).map((issue) => issue.number);
}

function git(args, { allowFailure = false, cwd, input } = {}) {
  const r = spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFailure) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.status === 0 ? r.stdout : null;
}

function gh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout;
}

function ghIssue(repo, number) {
  return JSON.parse(gh(['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,body,labels,comments']));
}

/**
 * #727 К3: документы пакетного ревью из кандидата и из `devRef`, по
 * возрастанию публикации. Публикация — коммит, положивший текущий текст
 * документа (`git log -1` по пути); порядок — его глубина в истории
 * (`rev-list --count`: в линейной `dev` потомок глубже предка). Документ,
 * который есть в обоих, берётся из `devRef`: документ могли переснять в `dev`
 * после Release-коммита. Ночные документы чужой базы
 * отсекаются по имени, остальные — `shipCoverage` по строке `base` блока.
 */
export function readRangeDocs({ candidate, base = undefined, devRef = 'origin/dev', cwd } = {}) {
  const found = new Map();
  for (const ref of [...new Set([candidate, devRef].filter(Boolean))]) {
    const listing = git(['ls-tree', '--name-only', ref, '--', `${SHIP_REVIEW_DIR}/`], { allowFailure: true, cwd });
    if (listing == null) continue;
    for (const path of listing.split('\n').filter(Boolean)) {
      const name = docName(path);
      const meta = parseDocName(name);
      if (meta?.stage !== 'ship') continue;
      if (meta.nightly && base !== undefined && meta.tag !== base) continue;
      const text = git(['show', `${ref}:${path}`], { allowFailure: true, cwd });
      const commit = git(['log', '-1', '--format=%H', ref, '--', path], { allowFailure: true, cwd })?.trim();
      if (text == null || !commit) continue;
      const order = Number(git(['rev-list', '--count', commit], { cwd }).trim());
      found.set(name, { name, text, ref, commit, order });
    }
  }
  return [...found.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function collect({ tag, candidate, repo }) {
  const mode = shipReviewMode({ tag, candidate });
  if (!SHA_RE.test(String(candidate))) throw new Error(`invalid candidate SHA: ${candidate}`);
  if (!repo) throw new Error('--repo (или GITHUB_REPOSITORY) обязателен');
  const { base, commits } = readCandidateHistory(candidate);
  const ship = shipIssuesInRange({ commits, issueData: (number) => ghIssue(repo, number) });
  const patches = issuePatchSets({ commits, numbers: ship.map((issue) => issue.number) });
  for (const issue of ship) issue.patches = patches.get(issue.number);
  return { mode, base, ship };
}

if (isMainModule(import.meta.url)) {
  try {
    const [command, ...rest] = process.argv.slice(2);
    const value = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
    const tag = value('tag');
    const repo = value('repo') || process.env.GITHUB_REPOSITORY || '';
    const devRef = value('dev-ref') || 'origin/dev';
    if (command === 'doc') {
      const candidate = value('candidate');
      const base = shipReviewMode({ tag, candidate }) === 'nightly' ? readCandidateHistory(candidate).base?.tag : null;
      console.log(shipDocPath({ tag, candidate, base }));
    } else if (command === 'mode') {
      console.log(shipReviewMode({ tag, candidate: value('candidate') }));
    } else if (command === 'prepare') {
      const candidate = value('candidate');
      const out = resolve(value('out') || '.');
      const force = value('force') === 'true';
      if (shipReviewMode({ tag, candidate }) === 'nightly'
        && git(['merge-base', '--is-ancestor', candidate, devRef], { allowFailure: true }) == null) {
        throw new Error(`candidate ${candidate} не предок ${devRef}: ночное ревью читает только код dev`);
      }
      const { mode, base, ship } = collect({ tag, candidate, repo });
      const doc = shipDocPath({ tag, candidate, base: base?.tag ?? null });
      const docs = force ? [] : readRangeDocs({ candidate, base: base?.tag ?? null, devRef });
      const plan = planShipReview({ tag, ship, docs, base: base?.tag ?? null, force });
      const patches = new Map(plan.read.map((issue) => [issue.number, issue.patches]));
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'ship-issues.json'), `${JSON.stringify({
        schema: 1, tag, mode, candidate, base, doc, issues: plan.read, covered: plan.covered, held: plan.held,
      }, null, 2)}\n`);
      writeFileSync(join(out, 'brief.md'), renderShipBrief({
        tag, candidate, base, ship: plan.read, runUrl: value('run-url'), doc, covered: plan.covered, held: plan.held,
      }));
      console.log(`mode=${mode}`);
      console.log(`doc=${doc}`);
      console.log(`base=${base ? base.tag : ''}`);
      console.log(`issues=${plan.read.map((issue) => issue.number).join(',')}`);
      console.log(`patches=${plan.read.length ? formatPatches(patches) : ''}`);
      console.log(`subject=${reviewSubject(tag)}`);
      if (plan.note) console.log(`note=${plan.note}`);
    } else if (command === 'check') {
      const candidate = value('candidate');
      if (tag === NIGHTLY_TAG) throw new Error('check судит публикацию беты: нужен её тег, а не nightly');
      const { base, ship } = collect({ tag, candidate, repo });
      const docs = readRangeDocs({ candidate, base: base?.tag ?? null, devRef });
      const problems = shipReviewProblems({ tag, ship, docs, base: base?.tag ?? null });
      if (!ship.length) console.log('ship-задач в диапазоне нет — пакетное ревью не требуется');
      else if (!problems.length) {
        const coverage = shipCoverage({ ship, docs, base: base?.tag ?? null });
        console.log(`пакетное ревью покрывает ship-задачи: ${coverage.map((item) => `#${item.number} — ${docPath(item.doc)}`).join(', ')}`);
      }
      for (const problem of problems) console.error(`::error::${problem}`);
      process.exit(problems.length ? 1 : 0);
    } else if (command === 'comment-high') {
      const doc = value('doc');
      const high = Number(value('high'));
      if (value('mode') !== 'nightly' || !(high > 0)) {
        console.log(`комментарий о High не нужен: режим ${value('mode') || '—'}, High ${value('high') || '—'}`);
      } else {
        if (!repo) throw new Error('--repo (или GITHUB_REPOSITORY) обязателен');
        const numbers = value('issues').split(',').filter(Boolean).map(Number);
        const issues = numbers.map((number) => ({
          number, comments: JSON.parse(gh(['issue', 'view', String(number), '--repo', repo, '--json', 'comments'])).comments,
        }));
        const targets = highCommentTargets({ doc, issues });
        for (const number of targets) gh(['issue', 'comment', String(number), '--repo', repo, '--body', highCommentBody(doc)]);
        console.log(targets.length ? `High ${high} в ${doc}: строка в ${targets.map((n) => `#${n}`).join(', ')}`
          : `High ${high} в ${doc}: строка во всех задачах документа уже есть`);
      }
    } else {
      throw new Error('usage: ship-review.mjs doc --tag=<tag> [--candidate=<sha>] | mode --tag=<tag> [--candidate=<sha>]'
        + ' | prepare --tag=<tag> --candidate=<sha> --out=<dir> [--force=true] [--repo=o/r] | check --tag=<tag> --candidate=<sha> [--repo=o/r]'
        + ' | comment-high --mode=<m> --high=<N> --doc=<path> --issues=<NN,…> [--repo=o/r]');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
