import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, lstatSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Verified 2026-11-01 against the official model overview/versioning pages.
// Dateless 4.6+ IDs are pinned snapshots, not moving aliases. No model fallback.
export const REVIEW_MODEL = 'claude-opus-5-5';
export const MODEL_SOURCE = 'https://platform.claude.com/docs/en/models/opus-5-5/overview';
export const REVIEW_API_VERSION = '2026-10-21';
const MAX_OUTPUT = 2 * 1024 * 1024;

export function reviewRequired({ track = 'show', ownerAssigned = false, kind = 'code' } = {}) {
  if (!['ship', 'show', 'ask'].includes(track)) throw new Error('Unknown track');
  if (!['code', 'spec'].includes(kind)) throw new Error('Unknown review kind');
  if (track === 'ship' && ownerAssigned) return false;
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
    const body = text.slice(h.end, next?.start ?? text.length).replace(/<!--[^]*?-->/g, '').trim();
    if (!body || /^(?:TBD|TODO|—|-)$/i.test(body)) errors.push(`Пустой раздел: ${id}`);
  }
  if (!/\bAC\d+\b/i.test(text)) errors.push('Нет пронумерованного критерия AC1…ACn');
  return { applicable: true, ok: errors.length === 0, errors };
}

function git(repoRoot, args, { acceptNoMatch = false } = {}) {
  try {
    return execFileSync('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', ...args], {
      cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_OUTPUT, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
  } catch (error) {
    if (acceptNoMatch && error.status === 1) return '';
    throw new Error(`Read-only git ${args[0]} failed: ${String(error.stderr ?? error.message).slice(0, 1000)}`);
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

export function buildReviewContext({ repoRoot, base, head = 'HEAD', task, track = 'show', ownerAssigned = false, kind = 'code', receipts = [], previousReview = null }) {
  const root = realpathSync(repoRoot);
  const baseSha = resolveCommit(root, base);
  const headSha = resolveCommit(root, head);
  const context = { version: 1, repoRoot: root, base: baseSha, head: headSha, kind, track, ownerAssigned, task, receipts, previousReview };
  context.required = reviewRequired(context);
  context.changedFiles = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', baseSha, headSha, '--']).split('\0').filter(Boolean);
  context.diff = bounded(git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=4', baseSha, headSha, '--']));
  // Both snapshots remain available through read_file; no uncommitted work is included.
  context.material = { requirements: 'task', decisions: 'task.ownerDecisions when supplied', base: baseSha, head: headSha, sources: 'all regular tracked files via read_file', history: 'git_diff / git_show / git_log / git_blame' };
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
  tool('git_diff', 'Read base-to-head diff, optionally for one file.', { path: str }),
  tool('git_show', 'Read a historical regular file by full commit SHA.', { commit: str, path: str }, ['commit', 'path']),
  tool('git_log', 'Read up to 20 commits from head, optionally for one path.', { path: str }),
  tool('git_blame', 'Read authorship/history of up to 200 lines at head.', { path: str, start: { type: 'integer' }, count: { type: 'integer' } }, ['path']),
  tool('submit_review', 'Submit the final review. Only the host writes it, in its designated report directory. This ends review; no product files can be written.', {
    verdict: { type: 'string', enum: ['accept', 'changes_requested', 'incomplete'] },
    understanding: str, blockers: { type: 'array', items: str }, improvements: { type: 'array', items: str }, boundaries: str,
  }, ['verdict', 'understanding', 'blockers', 'improvements', 'boundaries']),
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

function validateReport(report) {
  if (!report || !['accept', 'changes_requested', 'incomplete'].includes(report.verdict)) throw new Error('Invalid review verdict');
  for (const key of ['understanding', 'boundaries']) if (typeof report[key] !== 'string' || !report[key].trim()) throw new Error(`Missing ${key}`);
  for (const key of ['blockers', 'improvements']) if (!Array.isArray(report[key]) || report[key].some(x => typeof x !== 'string' || !x.trim())) throw new Error(`Invalid ${key}`);
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

export function writeReviewReport({ context, report, reportDir, model = REVIEW_MODEL }) {
  validateReport(report);
  if (typeof reportDir !== 'string' || !path.isAbsolute(reportDir)) throw new Error('Host must provide an absolute report directory');
  const directory = path.resolve(reportDir);
  assertDirectoryNoSymlink(directory);
  mkdirSync(directory, { recursive: true });
  assertDirectoryNoSymlink(directory);
  // The model never controls a filename. Exclusive create cannot overwrite code or a symlink.
  const file = path.join(directory, `${context.kind}-${context.head.slice(0, 12)}-${Date.now()}.md`);
  const items = values => values.length ? values.map(s => `- ${s}`).join('\n') : 'Нет.';
  const body = `# Ревью: ${report.verdict}\n\nМодель: ${model}\nМатериал: ${context.base} → ${context.head}\nВид: ${context.kind}\n\n## Понимание решения\n\n${report.understanding}\n\n## Блокеры\n\n${items(report.blockers)}\n\n## Возможные улучшения\n\n${items(report.improvements)}\n\n## Границы анализа\n\n${report.boundaries}\n`;
  writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
  return file;
}

export function previewReview(context, { model = REVIEW_MODEL } = {}) {
  if (model !== REVIEW_MODEL) throw new Error(`Explicit model migration required; pinned model is ${REVIEW_MODEL}`);
  const system = readFileSync(new URL('../prompts/review.md', import.meta.url), 'utf8');
  const { repoRoot, ...packet } = context;
  return { required: context.required, model, system, packet, tools: REVIEW_TOOLS, network: false, writes: false };
}

export async function runReview({ context, reportDir, apiKey = process.env.ANTHROPIC_API_KEY, model = REVIEW_MODEL, fetchImpl = globalThis.fetch, maxTurns = 150, preview = false, onProgress = () => {} }) {
  if (!reviewRequired(context)) return { status: 'not-required', reason: context.kind === 'spec' ? 'This track has no individual spec review' : 'Owner ship has no individual review' };
  const prepared = previewReview(context, { model });
  if (preview) return prepared;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required. CLAUDE_CODE_OAUTH_TOKEN is not an API key. Preview needs neither.');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 150) throw new Error('maxTurns must be 1..150');
  const messages = [{ role: 'user', content: JSON.stringify(prepared.packet) }];
  let usage = { input_tokens: 0, output_tokens: 0 };
  for (let turn = 1; turn <= maxTurns; turn++) {
    onProgress({ phase: 'review', turn, maxTurns }); // Counts only; maxTurns is a bound, not percent complete.
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': REVIEW_API_VERSION },
      body: JSON.stringify({ model, max_tokens: 16384, output_config: { effort: 'high' }, system: prepared.system, tools: REVIEW_TOOLS, messages }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok) throw new Error(`Claude API HTTP ${response.status}; no fallback model or green result`);
    const result = await response.json();
    if (result.model && result.model !== model) throw new Error('Provider returned an unexpected model');
    if (!Array.isArray(result.content) || result.stop_reason !== 'tool_use') throw new Error(`Review incomplete (${result.stop_reason ?? 'missing stop reason'}); no submitted verdict`);
    usage.input_tokens += result.usage?.input_tokens ?? 0;
    usage.output_tokens += result.usage?.output_tokens ?? 0;
    const calls = result.content.filter(b => b.type === 'tool_use');
    if (!calls.length) throw new Error('Review returned no tool calls');
    // Reject unknown capabilities before processing any submission in the same response.
    for (const call of calls) if (!REVIEW_TOOLS.some(t => t.name === call.name)) throw new Error(`Unavailable review tool: ${call.name}`);
    const submissions = calls.filter(c => c.name === 'submit_review');
    if (submissions.length) {
      if (calls.length !== 1) throw new Error('Final review must be submitted on its own');
      const report = validateReport(submissions[0].input);
      const file = writeReviewReport({ context, report, reportDir, model });
      return { status: report.verdict, file, model, base: context.base, head: context.head, turns: turn, usage };
    }
    // Preserve provider thinking/signatures verbatim for the same model/conversation.
    messages.push({ role: 'assistant', content: result.content });
    const results = calls.map(call => {
      try { return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(executeReadTool(context, call.name, call.input)) }; }
      catch (error) { return { type: 'tool_result', tool_use_id: call.id, is_error: true, content: error.message }; }
    });
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Review turn limit reached; no final verdict');
}
