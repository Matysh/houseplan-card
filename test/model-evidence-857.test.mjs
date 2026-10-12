import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { modelDetailsFromMessages, formatModelDetails, parseModelDetails, completeOutcomeAllowed, modelSummary } from '../scripts/model-usage-details.mjs';
import { failureDecision, recoverFailedReview } from '../scripts/model-review-failure.mjs';
import { reviewContext } from '../scripts/review-context.mjs';
import { issueBodyDigest, ANCHOR_MARKER } from '../scripts/review-doc-guard.mjs';
import { modelObservations, tokenUsage } from '../scripts/process-metrics.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const root = new URL('..', import.meta.url);
const sha = 'a'.repeat(40), tree = 'b'.repeat(40), body = 'immutable issue body';
const sdk = { type: 'result', subtype: 'success', num_turns: 7, duration_ms: 123,
  total_cost_usd: 0.4, modelUsage: { 'actual-one': { inputTokens: 10, outputTokens: 20,
    cacheReadInputTokens: 30, cacheCreationInputTokens: 40, costUSD: 0.4 },
  'actual-two': { inputTokens: 2 } } };
const details = formatModelDetails(modelDetailsFromMessages([sdk]));
const prepared = { schema: 1, stage: 'code', issue: 857, material_sha: sha,
  material_tree: tree, material_issue_body: issueBodyDigest(body) };
const request = { id: 'epoch-1', label: 'S7-code-review', at: '2026-10-12T00:00:00Z' };
const state = () => ({ issue: { number: 857, state: 'open', body, labels: [request.label] }, request,
  runs: [{ id: 101, issue: 857, label: request.label, createdAt: '2026-10-12T00:00:01Z' }], headSha: sha });
const options = { stage: 'code', runId: 101, materialSha: sha, bodyDigest: issueBodyDigest(body),
  repo: 'Matysh/houseplan-card', usage: '', details };

test('#857 actual SDK dimensions preserve identities, nulls and aggregate compatibility', () => {
  const d = parseModelDetails(details);
  assert.deepEqual(d.models.map(m => m.id), ['actual-one', 'actual-two']);
  assert.equal(d.models[0].cache_read_input_tokens, 30);
  assert.equal(d.models[1].output_tokens, null);
  assert.equal(d.providerCostUsdEstimate, 0.4);
  assert.match(modelSummary(details), /not OAuth charge\/quota/);
  const aggregate = '<!-- hp:usage input_tokens=12 output_tokens=20 cache_creation_input_tokens=40 cache_read_input_tokens=30 num_turns=7 -->';
  const doc = { path: 'docs/reviews/CODE-REVIEW-857-r1.md', text: `${details}\n${ANCHOR_MARKER}\n${details}\n${aggregate}` };
  assert.equal(modelObservations([doc, doc]).length, 1);
  assert.equal(tokenUsage([doc]).totals.input_tokens, 12, 'dimensions are not summed into aggregate');
  assert.equal(modelObservations([{ ...doc, text: details }]).length, 0, 'prose is not an anchor');
  assert.equal(parseModelDetails(details.replace(' -->', '! -->')), null);
  assert.equal(parseModelDetails(formatModelDetails({ ...d, secret: 'ghs_private' })).reason, 'invalid');
  const missing = modelDetailsFromMessages([{ type: 'system', model: 'invented' }, { type: 'result', subtype: 'success' }]);
  assert.deepEqual(missing.models, []); assert.equal(missing.turns, null);
  assert.equal(modelDetailsFromMessages([{ type: 'user', content: 'secret' }]).reason, 'no-result');
  assert.equal(modelDetailsFromMessages([sdk, { type: 'result', subtype: 'error_max_turns' }]).outcome, 'exhausted');
});

test('#857 interrupted SDK result refuses a complete verdict, even with unreadable model ids', () => {
  for (const subtype of ['error_max_turns', 'error_max_budget_usd', 'error_during_execution']) {
    const line = formatModelDetails(modelDetailsFromMessages([{ ...sdk, subtype, is_error: true,
      modelUsage: { 'ghs_private': {} } }]));
    assert.equal(completeOutcomeAllowed(line), false);
    assert.ok(!line.includes('ghs_private'));
    const cli = spawnSync(process.execPath, ['scripts/model-usage-details.mjs', `--require-complete-line=${line}`], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
  }
  assert.equal(completeOutcomeAllowed(details), true);
});

test('#857 static-first context keeps mandatory canon and every risky changed file', () => {
  const paths = ['scripts/model-review-failure.mjs', '.github/workflows/_process.yml', 'src/example.ts'];
  const c = reviewContext({ prepared, body, changedFiles: paths });
  assert.equal(c.requiredRole, 'canon');
  assert.ok(c.files.includes('PROCESS.md')); assert.ok(c.files.includes('AGENTS.md'));
  assert.deepEqual(c.fullHunkReads, paths); assert.equal(c.body, body);
  for (const input of [{ body: body + ' stale' }, { prepared: { ...prepared, material_sha: 'HEAD' } },
    { changedFiles: ['../secrets'] }, { body: 'x'.repeat(256 * 1024 + 1) }])
    assert.throws(() => reviewContext({ prepared, body, ...input }));
});

test('#857 current failed epoch returns to author; stale or changed request cannot mutate', () => {
  assert.equal(failureDecision(options, state()).to, 'S6-in-progress');
  const mutations = [];
  assert.equal(recoverFailedReview(options, { state, move: (...v) => mutations.push(v), comment: v => mutations.push(v) }).action, 'return');
  assert.deepEqual(mutations[0], ['S7-code-review', 'S6-in-progress']);
  assert.match(mutations[1], /цикл не израсходован/);
  for (const alter of [s => s.issue.labels.push('blocked'), s => s.issue.labels.push('S6-in-progress'),
    s => { s.issue.state = 'closed'; }, s => { s.issue.body += 'new'; }, s => { s.headSha = tree; },
    s => { s.request = { ...s.request, at: '2026-10-12T00:02:00Z', id: 'new' }; },
    s => s.runs.push({ ...s.runs[0], id: 102, createdAt: '2026-10-12T00:00:02Z' })]) {
    const s = state(); alter(s); assert.equal(failureDecision(options, s).action, 'noop');
  }
  let calls = 0;
  const outcome = recoverFailedReview(options, { state: () => { const s = state(); if (calls++) s.request = { ...request, id: 'new' }; return s; },
    move: () => assert.fail('stale epoch mutation'), comment: () => assert.fail('stale epoch comment') });
  assert.equal(outcome.action, 'noop');
  const s = state(); s.request = { ...request, label: 'S4-spec-review' }; s.issue.labels = [s.request.label]; s.runs[0].label = s.request.label;
  assert.equal(failureDecision({ ...options, stage: 'spec' }, s).to, 'S3-spec');
});

test('#857 real ship seal step cannot publish green for interrupted output', t => {
  const workflow = readFileSync(new URL('.github/workflows/_ship-review.yml', root), 'utf8');
  const step = findStep(workflow, { name: 'Запечатать результат модели' });
  const dir = mkdtempSync(join(tmpdir(), 'hp-857-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'));
  for (const file of ['model-usage-details.mjs', 'model-usage.mjs', 'spawn-portable.mjs'])
    copyFileSync(new URL(`scripts/${file}`, root), join(dir, 'scripts', file));
  const source = join(dir, 'review.md'); writeFileSync(source, 'Full otherwise-green review');
  const execute = line => runStep(step, step.run, { cwd: dir, env: { ...process.env, SOURCE: source,
    OUT: JSON.stringify({ high: 0, medium: 0, low: 0, summary: 'green' }), RUNNER_TEMP: dir, USAGE_DETAILS: line } });
  const interrupted = formatModelDetails(modelDetailsFromMessages([{ ...sdk, subtype: 'error_max_turns' }]));
  assert.notEqual(execute(interrupted).status, 0);
  assert.equal(execute(details).status, 0);
  for (const file of ['_process.yml', '_ship-review.yml']) {
    const text = readFileSync(new URL(`.github/workflows/${file}`, root), 'utf8');
    assert.match(text, /--max-turns 150/); assert.doesNotMatch(text, /--model\s/);
  }
});
