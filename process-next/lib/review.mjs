import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, lstatSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Verified 2026-11-01 against the official model overview/versioning pages.
// Dateless 4.6+ IDs are pinned snapshots, not moving aliases. No model fallback.
export const REVIEW_MODEL = 'claude-opus-5-5';
export const MODEL_SOURCE = 'https://platform.claude.com/docs/en/models/opus-5-5/overview';
// Raw Git buffering is separate from the bounded text exposed to the reviewer.
const MAX_OUTPUT = 2 * 1024 * 1024;
const MAX_DIFF_OUTPUT = 32 * 1024 * 1024;

export function reviewRequired({ track = 'show', ownerAssigned = false, kind = 'code' } = {}) {
  if (!['ship', 'show', 'ask'].includes(track)) throw new Error('Unknown track');
  if (!['code', 'spec', 'ship-batch'].includes(kind)) throw new Error('Unknown review kind');
  if (kind === 'ship-batch') return true;
  if (track === 'ship') return false;
  return kind === 'spec' ? track === 'ask' : true;
}

// Existing PROCESS.md §7.1. This author-side check is not substantive review.
const SECTIONS = [
  ['scenario', /сценарий|scenario/i], ['beforeAfter', /до\s*(?:и|\/|→|после).*после|before.*after|что человек увидит/i],
  ['problem', /проблем|problem/i], ['scope', /(?:^|\s)(?:scope|скоуп|объём|объем)(?:\s|$)/i],
  ['nonScope', /не[- ]?скоуп|non[- ]?scope|out.of.scope|не входит/i],
  ['behavior', /контракт.*поведен|behavior.*contract/i], ['ux', /\bUX\b/i],
  ['data', /модель данных|data model/i], ['migration', /миграци|migration/i],
  ['i18n', /i18n|локализаци/i], ['acceptance', /критерии.*приём|критерии.*прием|acceptance/i],
  ['tests', /план.*(?:авто)?тест|test plan/i], ['risks', /риск|risk/i],
  ['rollback', /откат|rollback/i], ['release', /release[- ]?артефакт|release artifact/i],
];

export function checkSpecFormat(text, { ownerShip = false } = {}) {
  if (ownerShip) return { applicable: false, ok: true, errors: [] };
  if (typeof text !== 'string') throw new Error('Spec text is required');
  const errors = [];
  const headings = [...text.matchAll(/^#{2,6}\s+(.+)$/gm)].map(m => ({ title: m[1].replace(/[*_`]/g, '').trim(), start: m.index, end: m.index + m[0].length }));
  if (!headings.some(h => /^ТЗ(?:\s|$)/i.test(h.title))) errors.push('Нет раздела ## ТЗ');
  for (const [id, pattern] of SECTIONS) {
    const h = headings.find(h => pattern.test(h.title));
    if (!h) { errors.push(`Нет раздела: ${id}`); continue; }
    const next = headings.find(n => n.start > h.start);
    const body = text.slice(h.end, next?.start ?? text.length).replace(/<!--[^]*?-->/g, '')
      // Disclosure markup is presentation, not content of a required section.
      .replace(/^\s*<\/?details\b[^>]*>\s*$/gm, '')
      .replace(/^\s*<summary\b[^>]*>[^\n]*<\/summary>\s*$/gm, '').trim();
    if (!body || /^(?:TBD|TODO|—|-)$/i.test(body)) errors.push(`Пустой раздел: ${id}`);
  }
  if (!/\bAC\d+\b/i.test(text)) errors.push('Нет пронумерованного критерия AC1…ACn');
  return { applicable: true, ok: errors.length === 0, errors };
}

function git(repoRoot, args, { acceptNoMatch = false } = {}) {
  try {
    return execFileSync('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', ...args], {
      cwd: repoRoot, encoding: 'utf8', maxBuffer: ['diff', 'diff-tree'].includes(args[0]) ? MAX_DIFF_OUTPUT : MAX_OUTPUT, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
  } catch (error) {
    if (acceptNoMatch && error.status === 1) return '';
    throw new Error(`Read-only git ${args[0]} failed: ${String(String(error.stderr ?? '').trim() || error.message || error.code).slice(0, 1000)}`);
  }
}

function resolveCommit(repoRoot, ref) {
  if (typeof ref !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(ref) || ref.startsWith('-')) throw new Error('Invalid commit ref');
  const sha = git(repoRoot, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Expected commit SHA');
  return sha;
}

function repoPath(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f\\:*?\[\]]/.test(value) || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Expected a literal repository-relative path');
  }
  return value;
}

function bounded(text, limit = 100_000) {
  return { text: text.slice(0, limit), truncated: text.length > limit, totalCharacters: text.length };
}

function revision(context, value = 'head') {
  if (value === 'base' && context.base === null) throw new Error('The first release has no base snapshot');
  if (value === 'head' || value === 'base') return context[value];
  if (!/^[a-f0-9]{40,64}$/.test(value)) throw new Error('Use base, head or a full commit SHA');
  return resolveCommit(context.repoRoot, value);
}

function blob(context, ref, file) {
  const p = repoPath(file);
  const entry = git(context.repoRoot, ['ls-tree', ref, '--', p]).trim();
  if (!/^100(?:644|755) blob /.test(entry)) throw new Error('Only regular tracked files may be read (no symlinks/submodules)');
  return git(context.repoRoot, ['show', `${ref}:${p}`]);
}

export const AUTHOR_CONTEXT_HEADING = 'Контекст исполнителя для ревью';

/** A freeform section of the existing task, not executable reviewer instructions.
 * Ignore headings inside fenced examples; preserve all matching sections rather than
 * silently choosing one of two conflicting author descriptions.
 */
export function extractAuthorContext(task) {
  const lines = String(task?.body ?? '').split(/\r?\n/), sections = [];
  let fence = null, selected = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    if (selected && heading[1].length <= selected.level) {
      sections.push({ ...selected, end: i }); selected = null;
    }
    if (!selected && heading[2].trim() === AUTHOR_CONTEXT_HEADING) selected = { start: i + 1, level: heading[1].length };
  }
  if (selected) sections.push({ ...selected, end: lines.length });
  const text = sections.map(section => lines.slice(section.start, section.end).join('\n').trim()).filter(Boolean).join('\n\n---\n\n');
  return { status: text ? 'provided' : 'not-provided', source: { kind: 'issue-body', issue: task?.issue ?? null,
    url: task?.url ?? null, heading: AUTHOR_CONTEXT_HEADING }, text };
}

export function buildReviewContext({ repoRoot, base, head = 'HEAD', task, track = 'show', ownerAssigned = false, kind = 'code', receipts = [], previousReview = null }) {
  if (kind === 'ship-batch') throw new Error('Use the frozen ship batch packet to build this review');
  const root = realpathSync(repoRoot);
  const baseSha = resolveCommit(root, base);
  const headSha = resolveCommit(root, head);
  const context = { version: 1, repoRoot: root, base: baseSha, head: headSha, kind, track, ownerAssigned, task,
    authorContext: extractAuthorContext(task), receipts, previousReview };
  context.required = reviewRequired(context);
  context.changedFiles = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', baseSha, headSha, '--']).split('\0').filter(Boolean);
  context.diff = bounded(git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=4', baseSha, headSha, '--']));
  // Both snapshots remain available through read_file; no uncommitted work is included.
  context.material = { requirements: 'task', decisions: 'task.ownerDecisions when supplied', base: baseSha, head: headSha, sources: 'all regular tracked files via read_file', history: 'git_diff / git_show / git_log / git_blame' };
  return context;
}

function selectedDiff(context, file) {
  const selectedPath = file ? repoPath(file) : null;
  return context.batch.changes.map(change => {
    if (selectedPath && !change.changedFiles.includes(selectedPath)) return '';
    const options = ['--no-ext-diff', '--no-textconv', '--no-renames', '--unified=5'];
    const args = change.parent ? ['diff', ...options, change.parent, change.commit, '--']
      : ['diff-tree', '--root', '--no-commit-id', '-r', '-p', ...options, change.commit, '--'];
    if (selectedPath) args.push(selectedPath);
    return `Задачи: ${change.issues.map(issue => `#${issue}`).join(', ')}\nКоммит: ${change.commit}\nРодитель: ${change.parent ?? 'нет (корневой коммит)'}\n${git(context.repoRoot, args)}`;
  }).filter(Boolean).join('\n\n');
}

/** Frozen requirements and exact implementation commits, rather than the entire
 * release diff: show/ask work is available as surrounding context at head only.
 */
export function buildShipReviewContext({ repoRoot, packet }) {
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  if (packet?.schema !== 1 || !sha(packet.head) || packet.base !== null && !sha(packet.base)
    || !Array.isArray(packet.tasks) || !Array.isArray(packet.pending) || !packet.pending.length)
    throw new Error('Ship review needs a frozen nonempty batch with exact base/head');
  const issues = new Set();
  for (const task of packet.tasks) {
    if (!Number.isSafeInteger(task.issue) || task.issue < 1 || issues.has(task.issue) || task.track !== 'ship'
      || typeof task.body !== 'string' || !Array.isArray(task.commits) || !task.commits.length || !task.commits.every(sha))
      throw new Error('Invalid frozen ship task');
    issues.add(task.issue);
  }
  if (new Set(packet.pending).size !== packet.pending.length || packet.pending.some(issue => !issues.has(issue)))
    throw new Error('Pending ship tasks must be a unique subset of the packet');
  const root = realpathSync(repoRoot), base = packet.base === null ? null : resolveCommit(root, packet.base), head = resolveCommit(root, packet.head);
  if (base) git(root, ['merge-base', '--is-ancestor', base, head]);
  const range = git(root, ['rev-list', '--reverse', '--topo-order', base ? `${base}..${head}` : head]).trim().split(/\s+/).filter(Boolean);
  const reachable = new Set(range), selected = new Map();
  for (const task of packet.tasks) {
    if (task.commits.some(commit => !reachable.has(commit))) throw new Error(`Ship task #${task.issue} has a commit outside the candidate range`);
    if (!packet.pending.includes(task.issue)) continue;
    for (const commit of new Set(task.commits)) selected.set(commit, [...(selected.get(commit) ?? []), task.issue]);
  }
  const changes = range.filter(commit => selected.has(commit)).map(commit => {
    const [, parent] = git(root, ['rev-list', '--parents', '-n', '1', commit]).trim().split(/\s+/);
    if (parent !== undefined && !sha(parent)) throw new Error('Ship implementation commit has an invalid parent');
    const args = parent ? ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', parent, commit, '--']
      : ['diff-tree', '--root', '--no-commit-id', '-r', '--name-only', '-z', commit, '--'];
    const changedFiles = git(root, args).split('\0').filter(Boolean);
    return { commit, parent: parent ?? null, issues: selected.get(commit), changedFiles };
  });
  const context = { version: 1, repoRoot: root, base, head, kind: 'ship-batch', track: 'ship', ownerAssigned: false, required: true,
    batch: { ...packet, tasks: packet.tasks.map(task => ({ ...task, authorContext: extractAuthorContext(task) })), changes },
    changedFiles: [...new Set(changes.flatMap(change => change.changedFiles))], receipts: [], previousReview: null };
  context.diff = bounded(selectedDiff(context));
  context.material = { requirements: 'batch.tasks: frozen issue bodies and executor context',
    scope: 'Only batch.pending tasks and their exact implementation commits; reused tasks are context, not a fresh review',
    base, head, sources: 'Candidate sources via read_file; original commit/parent snapshots via git_show',
    history: 'git_diff returns only the selected implementation diffs; git_log / git_blame remain available' };
  return context;
}

const str = { type: 'string' };
function tool(name, description, properties, required = []) {
  return { name, description, input_schema: { type: 'object', properties, required, additionalProperties: false } };
}
export const REVIEW_TOOLS = [
  tool('read_file', 'Read numbered lines of a regular tracked file at head/base/full commit SHA. Follow repository links with another call; never follows filesystem symlinks.', { path: str, ref: str, start: { type: 'integer' }, count: { type: 'integer' } }, ['path']),
  tool('list_files', 'List tracked files, optionally below a literal directory. Offset paginates the result.', { prefix: str, offset: { type: 'integer' } }),
  tool('search', 'Literal text search in the head snapshot. Use this for definitions and callers. No command or regular expression execution.', { text: str, path: str }, ['text']),
  tool('git_diff', 'Read the review diff, optionally for one file. In a ship batch this returns only pending tasks\' exact parent-to-commit diffs, not the whole release diff.', { path: str }),
  tool('git_show', 'Read a historical regular file by full commit SHA.', { commit: str, path: str }, ['commit', 'path']),
  tool('git_log', 'Read up to 20 commits from head, optionally for one path.', { path: str }),
  tool('git_blame', 'Read authorship/history of up to 200 lines at head.', { path: str, start: { type: 'integer' }, count: { type: 'integer' } }, ['path']),
  tool('submit_review', 'Submit the final review. Only the host writes it, in its designated report directory. This ends review; no product files can be written.', {
    verdict: { type: 'string', enum: ['accept', 'changes_requested', 'incomplete'] },
    summary: str, understanding: str,
    analysis: { type: 'array', items: { type: 'object', properties: { topic: str, assessment: str, evidence: str }, required: ['topic', 'assessment', 'evidence'], additionalProperties: false } },
    blockers: { type: 'array', items: str }, improvements: { type: 'array', items: str }, boundaries: str,
    outsideFindings: { type: 'array', items: { type: 'object', properties: { title: str, problem: str, evidence: str, suggestedFix: str, kind: { type: 'string', enum: ['bug', 'infra', 'tech-debt', 'docs'] } }, required: ['title', 'problem', 'evidence', 'suggestedFix'], additionalProperties: false } },
  }, ['verdict', 'summary', 'understanding', 'analysis', 'blockers', 'improvements', 'boundaries']),
];

function integer(value, fallback, max) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Expected integer 1..${max}`);
  return value;
}

export function executeReadTool(context, name, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid tool input');
  const root = context.repoRoot;
  switch (name) {
    case 'read_file': {
      const text = blob(context, revision(context, input.ref), input.path);
      const lines = text.split('\n');
      const start = integer(input.start, 1, 10_000_000), count = integer(input.count, 200, 500);
      return { ...bounded(lines.slice(start - 1, start - 1 + count).map((s, i) => `${start + i}: ${s}`).join('\n')), totalLines: lines.length, start, nextStart: start + count <= lines.length ? start + count : null };
    }
    case 'list_files': {
      const offset = input.offset ?? 0;
      if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid offset');
      const args = ['ls-tree', '-r', '--name-only', '-z', context.head, '--'];
      if (input.prefix) args.push(repoPath(input.prefix));
      const files = git(root, args).split('\0').filter(Boolean);
      return { files: files.slice(offset, offset + 500), total: files.length, nextOffset: offset + 500 < files.length ? offset + 500 : null };
    }
    case 'search': {
      if (typeof input.text !== 'string' || !input.text || input.text.length > 1000 || input.text.includes('\0')) throw new Error('Invalid search');
      const args = ['grep', '-n', '-I', '-F', '-e', input.text, context.head, '--'];
      if (input.path) args.push(repoPath(input.path));
      return bounded(git(root, args, { acceptNoMatch: true }));
    }
    case 'git_diff': {
      if (context.kind === 'ship-batch') return bounded(selectedDiff(context, input.path));
      const args = ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=5', context.base, context.head, '--'];
      if (input.path) args.push(repoPath(input.path));
      return bounded(git(root, args));
    }
    case 'git_show': return bounded(blob(context, revision(context, input.commit), input.path));
    case 'git_log': {
      const args = ['log', '-20', '--format=%H%n%ad %an%n%s%n%b', '--date=iso-strict', context.head, '--'];
      if (input.path) args.push(repoPath(input.path));
      return bounded(git(root, args));
    }
    case 'git_blame': {
      const p = repoPath(input.path);
      blob(context, context.head, p); // Reject symlink/submodule before invoking blame.
      const start = integer(input.start, 1, 10_000_000), count = integer(input.count, 100, 200);
      return bounded(git(root, ['blame', '--no-textconv', '-L', `${start},+${count}`, context.head, '--', p]));
    }
    default: throw new Error(`Tool is not available in analytical review: ${name}`);
  }
}

export function validateReport(report) {
  if (!report || !['accept', 'changes_requested', 'incomplete'].includes(report.verdict)) throw new Error('Invalid review verdict');
  for (const key of ['understanding', 'boundaries']) if (typeof report[key] !== 'string' || !report[key].trim()) throw new Error(`Missing ${key}`);
  for (const key of ['blockers', 'improvements']) if (!Array.isArray(report[key]) || report[key].some(x => typeof x !== 'string' || !x.trim())) throw new Error(`Invalid ${key}`);
  // Older saved reports remain readable. New submissions request these fields, without a quota.
  if (report.summary !== undefined && (typeof report.summary !== 'string' || !report.summary.trim())) throw new Error('Invalid summary');
  if (report.analysis !== undefined && (!Array.isArray(report.analysis) || report.analysis.some(item => !item || ['topic', 'assessment', 'evidence'].some(key => typeof item[key] !== 'string' || !item[key].trim())))) throw new Error('Invalid analysis');
  if (report.outsideFindings !== undefined && (!Array.isArray(report.outsideFindings) || report.outsideFindings.some(item => !item || ['title', 'problem', 'evidence', 'suggestedFix'].some(key => typeof item[key] !== 'string' || !item[key].trim())))) throw new Error('Invalid outside findings');
  if (report.outsideFindings?.some(item => item.kind !== undefined && !['bug', 'infra', 'tech-debt', 'docs'].includes(item.kind))) throw new Error('Invalid outside defect kind');
  if (report.verdict === 'accept' && report.blockers.length) throw new Error('An accepted review cannot contain blockers');
  if (report.verdict === 'changes_requested' && !report.blockers.length) throw new Error('Changes requested needs a concrete blocker');
  return report;
}

function assertDirectoryNoSymlink(directory) {
  let cursor = path.parse(directory).root;
  for (const part of path.relative(cursor, directory).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error('Report directory must not contain symlinks');
  }
}

export function renderReviewReport({ context, report, model = REVIEW_MODEL }) {
  validateReport(report);
  const items = values => values.length ? values.map(s => `- ${s}`).join('\n') : 'Нет.';
  const analysis = report.analysis?.length ? `\n## Разбор решения\n\n${report.analysis.map(item => `### ${item.topic}\n\n${item.assessment}\n\nОснование: ${item.evidence}`).join('\n\n')}\n` : '';
  const outside = report.outsideFindings?.length ? `\n## Отдельные дефекты вне задачи\n\n${report.outsideFindings.map(item => `### ${item.title}\n\n${item.problem}\n\nОснование: ${item.evidence}\n\nНаправление исправления: ${item.suggestedFix}`).join('\n\n')}\n` : '';
  const author = context.authorContext ?? extractAuthorContext(context.task);
  const fence = '`'.repeat(Math.max(3, ...[...author.text.matchAll(/`+/g)].map(match => match[0].length + 1)));
  const briefing = context.kind === 'ship-batch'
    ? `Замороженные требования и контекст исполнителей переданы отдельно для каждой задачи пакета.\n\nПроверены задачи: ${context.batch.pending.map(issue => `#${issue}`).join(', ')}.\n\nКоммиты: ${context.batch.changes.map(change => change.commit).join(', ')}.\n\nРанее принятое ревью сохранено для задач: ${(context.batch.reused ?? []).map(task => `#${task.issue}`).join(', ') || 'нет'}.`
    : author.status === 'provided'
    ? `Источник: описание задачи #${author.source.issue ?? '—'}, раздел «${AUTHOR_CONTEXT_HEADING}». Это сведения исполнителя, не выводы ревьюера.\n\n${fence}text\n${author.text}\n${fence}`
    : 'Отдельный контекст исполнителя не предоставлен. Ревью опирается на задачу, материал и доступные результаты проверок.';
  const title = context.kind === 'ship-batch' ? `Пакетное код-ревью ship перед ${context.batch.version}` : context.kind === 'spec' ? 'Ревью ТЗ' : 'Код-ревью';
  const verdict = { accept: 'принято', changes_requested: 'нужны исправления', incomplete: 'анализ не завершён' }[report.verdict];
  return `# ${title} — ${verdict}\n${report.summary ? `\n## Вывод\n\n${report.summary}\n` : ''}\n## Понимание решения\n\n${report.understanding}\n${analysis}\n## Блокеры\n\n${items(report.blockers)}\n\n## Возможные улучшения\n\n${items(report.improvements)}\n${outside}\n## Границы анализа\n\n${report.boundaries}\n\n<details>\n<summary>Материал ревью и контекст исполнителя</summary>\n\nМодель: ${model}\n\nМатериал: ${context.base} → ${context.head}\n\n## Переданный контекст исполнителя\n\n${briefing}\n\n</details>\n`;
}

export function writeReviewReport({ context, report, reportDir, model = REVIEW_MODEL }) {
  const body = renderReviewReport({ context, report, model });
  if (typeof reportDir !== 'string' || !path.isAbsolute(reportDir)) throw new Error('Host must provide an absolute report directory');
  const directory = path.resolve(reportDir);
  assertDirectoryNoSymlink(directory);
  mkdirSync(directory, { recursive: true });
  assertDirectoryNoSymlink(directory);
  // The model never controls a filename. Exclusive create cannot overwrite code or a symlink.
  const file = path.join(directory, `${context.kind}-${context.head.slice(0, 12)}-${Date.now()}.md`);
  writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
  return file;
}

export function previewReview(context, { model = REVIEW_MODEL } = {}) {
  if (model !== REVIEW_MODEL) throw new Error(`Explicit model migration required; pinned model is ${REVIEW_MODEL}`);
  const system = readFileSync(new URL('../prompts/review.md', import.meta.url), 'utf8')
    + (context.kind === 'ship-batch' ? '\n\n' + readFileSync(new URL('../prompts/ship-review.md', import.meta.url), 'utf8') : '');
  const { repoRoot, ...packet } = context;
  return { required: context.required, model, system, packet, tools: REVIEW_TOOLS, network: false, writes: false };
}

export async function runReview({ context, reportDir, model = REVIEW_MODEL, maxTurns = 150, preview = false,
  onProgress = () => {}, transport, env = process.env }) {
  if (!reviewRequired(context)) return { status: 'not-required', reason: 'This track has no individual review' };
  const prepared = previewReview(context, { model });
  if (preview) return prepared;
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 150) throw Error('maxTurns must be 1..150');
  const invoke = transport ?? (await import('./claude-review.mjs')).runClaudeReview;
  const result = await invoke({ context, prepared, model, maxTurns, onProgress, env });
  const report = validateReport(result.report);
  const file = writeReviewReport({ context, report, reportDir, model });
  return { status: report.verdict, file, report, model, base: context.base, head: context.head,
    turns: result.turns, usage: result.usage };
}
