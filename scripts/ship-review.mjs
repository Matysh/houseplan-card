#!/usr/bin/env node
/**
 * Пакетное ревью задач `track:ship` перед бетой (#696, PROCESS.md §11.7).
 *
 *   node scripts/ship-review.mjs doc --tag=v1.79.0-beta.1
 *   node scripts/ship-review.mjs prepare --tag=<тег> --candidate=<sha> --out=<dir> [--repo=owner/name]
 *   node scripts/ship-review.mjs check --tag=<тег> --candidate=<sha> [--repo=owner/name]
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
 * `check` — гейт публикации беты: если в диапазоне есть ship-задачи, документ
 * `docs/reviews/SHIP-REVIEW-<тег>.md` обязан быть в кандидате или в `dev`,
 * покрывать их все машинным блоком и не нести High.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { issueTrailers, readCandidateHistory } from './release-membership.mjs';

export const SHIP_REVIEW_DIR = 'docs/reviews';
export const SHIP_MERGE_MARKER_RE = /<!-- hp:ship-merge material=([0-9a-f]{40}) -->/;
/** #707: риск по участкам, с которым ship слит (трек подтверждён владельцем или риск только visual). */
export const SHIP_RISK_MARKER_RE = /<!-- hp:ship-risk classes=([a-z,]+) -->/;
export const SHIP_REVIEW_ANCHOR = '<!-- hp-ship-review-anchors -->';
export const RELEASE_TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;
const SHA_RE = /^[0-9a-f]{40,64}$/;
const TZ_LIMIT = 1500;

/** Путь документа пакетного ревью для тега беты или стабильного. */
export function shipReviewDocPath(tag) {
  if (!RELEASE_TAG_RE.test(String(tag))) throw new Error(`not a release tag: ${tag}`);
  return `${SHIP_REVIEW_DIR}/SHIP-REVIEW-${tag}.md`;
}

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

export function renderShipBrief({ tag, candidate, base, ship, runUrl = '' }) {
  const lines = [
    `# Вход пакетного ревью ship ${tag}`,
    '',
    `- Кандидат: \`${candidate}\``,
    `- Диапазон: ${base ? `\`${base.tag}\` · \`${base.sha}\`` : 'нет прошлого тега — всё дерево'} .. кандидат`,
    ...(runUrl ? [`- Прогон: ${runUrl}`] : []),
    `- Документ: \`${shipReviewDocPath(tag)}\``,
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

/** Машинный блок документа: его пишет публикация, читает `check`. */
export function anchorBlock({ tag, candidate, base = null, issues = [], high = 0, medium = 0, low = 0, runUrl = '' }) {
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
    '```',
    '',
  ].join('\n');
}

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
  return {
    tag: fields.tag || null,
    candidate: fields.candidate || null,
    issues: String(fields.issues || '').split(',').map((s) => number(s.trim())).filter((n) => n != null),
    high: number(fields.high),
    medium: number(fields.medium),
    low: number(fields.low),
  };
}

/**
 * Причины не публиковать бету; пустой список — гейт пройден. Без ship-задач в
 * диапазоне документ не нужен: пакетному ревью нечего читать.
 */
export function shipReviewProblems({ tag, ship = [], docText = null }) {
  if (!ship.length) return [];
  const doc = shipReviewDocPath(tag);
  const numbers = ship.map((issue) => issue.number);
  const run = `gh workflow run ship-review.yml --ref dev -f tag=${tag}`;
  if (!docText) {
    return [`${doc} нет ни в кандидате, ни в dev: ship-задачи ${numbers.map((n) => `#${n}`).join(', ')} слиты без ревью модели, и их код до беты не читал никто (PROCESS.md §11.7). Запустить: ${run}`];
  }
  const block = parseAnchorBlock(docText);
  if (!block) return [`${doc} без машинного блока ${SHIP_REVIEW_ANCHOR}: покрытие задач не доказано. Переснять: ${run} -f force=true`];
  const problems = [];
  if (block.tag !== tag) problems.push(`${doc} записан для тега ${block.tag}, а публикуется ${tag}`);
  const missing = numbers.filter((n) => !block.issues.includes(n));
  if (missing.length) {
    problems.push(`${doc} не покрывает ship-задачи ${missing.map((n) => `#${n}`).join(', ')} — они слиты после ревью. Переснять: ${run} -f force=true`);
  }
  if (block.high == null) problems.push(`${doc}: в машинном блоке нет числа High`);
  else if (block.high > 0) problems.push(`${doc}: High ${block.high} — бета ждёт починки: находка чинится отдельной задачей, затем ревью переснимается`);
  return problems;
}

function git(args, { allowFailure = false } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFailure) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.status === 0 ? r.stdout : null;
}

function ghIssue(repo, number) {
  const r = spawnSync('gh', ['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,body,labels,comments'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`gh issue view ${number}: ${(r.stderr || r.stdout || '').trim()}`);
  return JSON.parse(r.stdout);
}

/** Документ — из кандидата, иначе из `origin/dev`: ревью могло лечь в dev после Release-коммита. */
export function readShipDoc(tag, candidate) {
  const path = shipReviewDocPath(tag);
  return git(['show', `${candidate}:${path}`], { allowFailure: true })
    ?? git(['show', `origin/dev:${path}`], { allowFailure: true });
}

function collect({ tag, candidate, repo }) {
  shipReviewDocPath(tag);
  if (!SHA_RE.test(String(candidate))) throw new Error(`invalid candidate SHA: ${candidate}`);
  if (!repo) throw new Error('--repo (или GITHUB_REPOSITORY) обязателен');
  const { base, commits } = readCandidateHistory(candidate);
  const ship = shipIssuesInRange({ commits, issueData: (number) => ghIssue(repo, number) });
  return { base, ship };
}

if (isMainModule(import.meta.url)) {
  try {
    const [command, ...rest] = process.argv.slice(2);
    const value = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
    const tag = value('tag');
    const repo = value('repo') || process.env.GITHUB_REPOSITORY || '';
    if (command === 'doc') {
      console.log(shipReviewDocPath(tag));
    } else if (command === 'prepare') {
      const candidate = value('candidate');
      const out = resolve(value('out') || '.');
      const { base, ship } = collect({ tag, candidate, repo });
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'ship-issues.json'), `${JSON.stringify({ schema: 1, tag, candidate, base, issues: ship }, null, 2)}\n`);
      writeFileSync(join(out, 'brief.md'), renderShipBrief({ tag, candidate, base, ship, runUrl: value('run-url') }));
      console.log(`doc=${shipReviewDocPath(tag)}`);
      console.log(`base=${base ? base.tag : ''}`);
      console.log(`issues=${ship.map((issue) => issue.number).join(',')}`);
    } else if (command === 'check') {
      const candidate = value('candidate');
      const { ship } = collect({ tag, candidate, repo });
      const problems = shipReviewProblems({ tag, ship, docText: readShipDoc(tag, candidate) });
      if (!ship.length) console.log('ship-задач в диапазоне нет — пакетное ревью не требуется');
      else if (!problems.length) console.log(`пакетное ревью ${shipReviewDocPath(tag)} покрывает ship-задачи ${ship.map((i) => `#${i.number}`).join(', ')}`);
      for (const problem of problems) console.error(`::error::${problem}`);
      process.exit(problems.length ? 1 : 0);
    } else {
      throw new Error('usage: ship-review.mjs doc --tag=<tag> | prepare --tag=<tag> --candidate=<sha> --out=<dir> [--repo=o/r] | check --tag=<tag> --candidate=<sha> [--repo=o/r]');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
