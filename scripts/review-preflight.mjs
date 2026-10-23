#!/usr/bin/env node
/** Format/identity checks only. PASS never approves a claim or authorizes merge. */
import { execFileSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './change-classes.mjs';
import { issueBodyDigest } from './review-doc-guard.mjs';
import { readMergeEntry } from './release-ledger.mjs';
import { validateCommitMessage } from './validate-commit-provenance.mjs';
import { moveStatusLabel } from './status-label.mjs';
import { labelTrack, parseNumstat } from './process-track.mjs';
import { sourceReplacementWarnings } from './source-replacement.mjs';
import { HANDOFF_FIELDS, handoffDigest, handoffSnapshot, parseHandoff, selectHandoff, validHandoffProvenance } from './review-handoff.mjs';

export const PREFLIGHT_SCHEMA = 'houseplan-review-preflight/v2';
const objectId = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const tracks = ['ask', 'show', 'ship'];
const stages = ['spec', 'code'];
const plain = (text) => String(text || '').replace(/```[^\n]*\n[\s\S]*?```/g, '').replace(/^\s*>.*$/gm, '');
const sections = [
  ['scenario', /сценарий|scenario/iu],
  ['before-after', /до и после|до\/после|что человек увидит|before.{0,12}after/iu],
  ['problem', /проблема|problem/iu],
  ['scope', /скоуп|границ|scope/iu],
  ['non-scope', /не[- ]скоуп|не входит|out.of.scope/iu],
  ['contract', /контракт|поведение|contract|behavio/iu],
  ['ux', /\bUX\b|доступность/iu],
  ['data-migration', /модель данных|миграци|data|migration/iu],
  ['i18n', /i18n|локализаци/iu],
  ['acceptance', /при[её]мк|\bAC\b|acceptance/iu],
  ['tests', /автотест|план.{0,15}тест|test/iu],
  ['risks', /риск|risk/iu],
  ['rollback', /откат|rollback/iu],
  ['release', /release|релизн.{0,15}артефакт/iu],
];

export function specFormatErrors(body, track, infrastructure = false) {
  if (infrastructure) return []; // Voluntary infrastructure specs change no route.
  const text = plain(body);
  const at = text.search(/^##\s+ТЗ\s*$/mi);
  if (at < 0) return [{ field: 'body.spec', message: 'Missing ## ТЗ' }];
  const spec = text.slice(at);
  if (track === 'ship') return spec.replace(/^##\s+ТЗ\s*$/mi, '').trim()
    ? [] : [{ field: 'body.spec', message: 'Ship needs its change/check sentence' }];
  const errors = [];
  const headers = [...spec.matchAll(/^#{2,6}\s+(.+)$/gm)].map((m) => m[1]);
  if (track === 'ask') for (const [name, pattern] of sections) {
    if (!headers.some((header) => pattern.test(header)))
      errors.push({ field: 'body.spec.' + name, message: 'Missing required section: ' + name });
  }
  // The first AC token identifies the row; later tokens may be cross-references.
  const rows = [...spec.matchAll(/^.*?\bAC([1-9]\d*)\b.*$/gm)];
  const ids = [...new Set(rows.map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (!ids.length || ids.some((id, i) => id !== i + 1))
    errors.push({ field: 'body.spec.AC', message: 'Numbered contiguous AC1..ACn required' });
  if (track === 'show' && ids.length > 3)
    errors.push({ field: 'body.spec.AC', message: 'Show allows at most three AC' });
  for (const id of ids) {
    // Any acceptance occurrence may provide the evidence; references in earlier prose do not hide it.
    const evidence = rows.filter((row) => Number(row[1]) === id).some((row) => {
      const next = spec.slice(row.index).search(/\n[^\n]*\bAC[1-9]\d*\b/);
      const block = spec.slice(row.index, row.index + (next < 0 ? 1800 : Math.min(next, 1800)));
      return /unit|backend|smoke|смоу?к|golden|ревью кода|чтени[ею]|node --test|pytest/iu.test(block);
    });
    if (!evidence) errors.push({ field: 'body.spec.AC' + id, message: 'Name the evidence method' });
  }
  return errors;
}

export function checkReviewInput(input, { ledgerReader = readMergeEntry, readObject } = {}) {
  const errors = [];
  const error = (field, message) => errors.push({ field, message });
  if (!stages.includes(input.stage)) error('stage', 'Expected spec or code');
  if (!tracks.includes(input.track)) error('track', 'Expected ask, show or ship');
  if (input.currentTrack !== undefined && input.currentTrack !== input.track) error('track', 'Issue track changed');
  if (!Number.isSafeInteger(input.issue) || input.issue < 1) error('issue', 'Positive issue required');
  if (input.requestActive === false) error('issue.review-request', 'Review request was withdrawn or blocked');
  if (typeof input.body !== 'string' || input.body.length > 256 * 1024) error('body', 'Bounded readable body required');
  const digest = issueBodyDigest(input.body || '');
  if (input.bodyDigest !== digest) error('bodyDigest', 'Issue body changed or has no exact snapshot');
  for (const [name, current] of input.stage === 'code' ? [['sha', input.currentSha], ['tree', input.currentTree]] : []) {
    if (!objectId.test(input[name] || '') || input[name] !== current)
      error(name, 'Immutable material identity does not match ' + name);
  }
  errors.push(...specFormatErrors(input.body, input.track, input.infrastructure));
  if (input.stage === 'code') {
    if (!Array.isArray(input.files) || !input.files.length) error('files', 'Readable nonempty task diff required');
    if (input.infrastructure && input.files?.some((path) => classify(path) === 'A'))
      error('infrastructure', 'Product file in infrastructure material');
    try { ledgerReader(input.sha, input.issue); }
    catch (failure) { error('ledger', failure.message); }
    if (!Array.isArray(input.commits) || !input.commits.length) error('commits', 'Readable task commits required');
    for (const commit of input.commits || []) {
      for (const message of validateCommitMessage(commit.message, commit.files, { deletedFiles: commit.deletedFiles })) error('commit.' + commit.sha, message);
    }
    const parsed = parseHandoff(input.handoff);
    const handoff = parsed.text;
    for (const [field] of HANDOFF_FIELDS)
      if (!parsed.fields.includes(field)) error('handoff.' + field, 'Missing handoff field: ' + field);
    if (input.handoffError) error('handoff.provenance', input.handoffError);
    if (!validHandoffProvenance(input.handoffProvenance)
      || input.handoffProvenance.digest !== handoffDigest(input.handoff))
      error('handoff.provenance', 'Missing/stale selected handoff identity or text digest');
    if (input.expectedHandoff !== undefined && input.expectedHandoff !== handoffSnapshot(input.handoffProvenance ?? null))
      error('handoff.stale', 'Selected handoff changed after preparation; collect fresh material');
    // Local linked reports can be checked exactly. Remote links are not claimed reachable.
    for (const match of handoff.matchAll(/\]\((docs\/[A-Za-z0-9_./-]+)\)/g)) {
      if (match[1].split('/').includes('..')) error('handoff.link', 'Unsafe relative report path');
      else if (readObject) try { readObject(input.sha + ':' + match[1]); }
      catch { error('handoff.link', 'Missing material artifact: ' + match[1]); }
    }
  }
  const warnings = input.stage === 'code' ? sourceReplacementWarnings(input.commits, input.handoff) : [];
  return { schema: PREFLIGHT_SCHEMA, ok: errors.length === 0, semanticApproval: false, warnings,
    identity: { issue: input.issue, stage: input.stage, track: input.track,
      infrastructure: input.infrastructure, sha: input.sha, tree: input.tree, bodyDigest: digest,
      handoff: input.stage === 'code' ? input.handoffProvenance ?? null : null }, errors };
}

export function collectReviewInput(options, { git, api }) {
  const snapshot = api('repos/' + options.repo + '/issues/' + options.issue);
  const currentSha = git(['rev-parse', 'HEAD']);
  const currentTree = git(['rev-parse', 'HEAD^{tree}']);
  const base = git(['merge-base', options.base || 'origin/dev', currentSha]);
  const files = git(['diff', '--name-only', base, currentSha]).split('\n').filter(Boolean);
  const infrastructure = options.stage === 'code' && files.length > 0 && files.every((file) => classify(file) !== 'A');
  const commits = options.stage === 'code' ? git(['rev-list', '--no-merges', base + '..' + currentSha])
    .split('\n').filter(Boolean).map((sha) => ({ sha,
      message: git(['show', '-s', '--format=%B', sha]),
      sourceFiles: parseNumstat(git(['show', '--no-renames', '--numstat', '--format=', sha])),
      files: git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).split('\n').filter(Boolean),
      deletedFiles: git(['diff-tree', '--no-commit-id', '--name-only', '--diff-filter=D', '-r', sha]).split('\n').filter(Boolean) })) : [];
  const pages = options.stage === 'code' ? api('repos/' + options.repo + '/issues/' + options.issue + '/comments', true) : [];
  const selected = selectHandoff(pages);
  const handoff = selected.body;
  const labels = snapshot.labels.map((row) => typeof row === 'string' ? row : row.name);
  const expected = options.stage === 'spec' ? 'S4-spec-review' : 'S7-code-review';
  const requestActive = snapshot.state === 'open' && labels.includes(expected)
    && labels.filter((label) => /^S[1-8]-/.test(label)).length === 1
    && !labels.includes('blocked') && !labels.includes('review-4');
  return { ...options, body: snapshot.body || '', currentSha, currentTree, files, infrastructure, commits, handoff,
    handoffProvenance: selected.provenance, handoffError: selected.error,
    requestActive, currentTrack: labelTrack({ labels, infrastructure }) };
}

export function preflightApplies(result, identity) {
  return result?.schema === PREFLIGHT_SCHEMA && result.ok === true && result.semanticApproval === false
    && (identity.stage !== 'code' || (validHandoffProvenance(result.identity?.handoff) && validHandoffProvenance(identity.handoff)))
    && ['issue', 'stage', 'track', 'infrastructure', 'sha', 'tree', 'bodyDigest']
      .every((field) => result.identity?.[field] === identity[field])
    && handoffSnapshot(result.identity?.handoff ?? null) === handoffSnapshot(identity.handoff ?? null);
}

export function preflightComment(result) {
  return 'Механическая подготовка ревью не пройдена; модель не вызывалась, цикл не израсходован.\n\n'
    + (result.identity.handoff ? `Выбран хендофф #${result.identity.handoff.id}: ${result.identity.handoff.url} (updated ${result.identity.handoff.updatedAt}).\n\n` : '')
    + result.errors.map(({ field, message }) => '- ' + field + ': ' + message).join('\n')
    + '\n\nИсправьте указанные поля и повторно примените review-метку. Форматный PASS не является вердиктом ревью.';
}

export function rejectPreflight(result, { current, move, comment }) {
  if (result.ok) return false;
  const from = result.identity.stage === 'spec' ? 'S4-spec-review' : 'S7-code-review';
  const to = result.identity.stage === 'spec' ? 'S3-spec' : 'S6-in-progress';
  const labels = current.labels.map((row) => typeof row === 'string' ? row : row.name);
  if (current.state !== 'open' || !labels.includes(from) || labels.filter((label) => /^S[1-8]-/.test(label)).length !== 1
    || labels.includes('blocked') || labels.includes('review-4')) return false;
  move(from, to);
  comment(preflightComment(result));
  return true;
}

if (isMainModule(import.meta.url)) {
  const value = (key) => process.argv.find((arg) => arg.startsWith('--' + key + '='))?.slice(key.length + 3);
  const started = performance.now();
  try {
    const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
    const api = (endpoint, paginated = false) => JSON.parse(execFileSync('gh', [
      'api', endpoint, ...(paginated ? ['--paginate', '--slurp'] : []),
    ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    const options = { issue: Number(value('issue')), repo: value('repo'), stage: value('stage'), track: value('track'),
      sha: value('sha'), tree: value('tree'), bodyDigest: value('body-digest'), base: value('base'),
      expectedHandoff: value('handoff-snapshot') };
    const input = collectReviewInput(options, { git, api });
    const result = checkReviewInput(input, { ledgerReader: (sha, issue) => readMergeEntry(sha, issue, git),
      readObject: (object) => git(['show', object]) });
    result.elapsedMs = Math.round(performance.now() - started);
    if (value('output')) writeFileSync(value('output'), JSON.stringify(result, null, 2) + '\n');
    if (value('comment')) writeFileSync(value('comment'), preflightComment(result));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'ok=' + result.ok + '\n'
      + 'handoff_snapshot=' + handoffSnapshot(result.identity.handoff) + '\n');
    if (value('return') === 'true' && !result.ok) rejectPreflight(result, {
      current: api('repos/' + options.repo + '/issues/' + options.issue),
      move: (from, to) => moveStatusLabel({ repo: options.repo, issue: options.issue, from, to }),
      comment: (body) => execFileSync('gh', ['api', '--method', 'POST',
        'repos/' + options.repo + '/issues/' + options.issue + '/comments', '--input', '-'],
      { input: JSON.stringify({ body }), encoding: 'utf8' }),
    });
    for (const warning of result.warnings) console.warn('Предупреждение: ' + warning);
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error('review preflight setup: ' + error.message);
    process.exitCode = 2; // No result/ok output: no permission to invoke model.
  }
}
