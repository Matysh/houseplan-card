import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildFailureCertificate } from '../scripts/review-failure-diagnostics.mjs';
import { BRANCH, MATERIAL, NATIVE, OVERLAY, TOOLS, boundInputs, projectCertificate, regular, snapshotIssue } from '../scripts/1082-diagnostic-bootstrap.mjs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const workflow = parse(read('.github/workflows/1082-diagnostic-bootstrap.yml'));
const steps = workflow.jobs.diagnostic.steps;
const step = id => steps.find(row => row.id === id);
const secret = 'ghp_INERT_FIXTURE_SECRET_NEVER_PUBLISH_1082';
function fixture() {
  // Inert JSON only. Neither this fixture nor the projector executes a tool request.
  const call = { type: 'tool_use', id: secret, name: 'Edit', input: { file_path: secret, new_string: secret,
    old_string: secret, [secret]: secret, offset: 1, command: `node -e '${secret}'` } };
  return buildFailureCertificate({ messages: [{ type: 'assistant', message: { content: [call] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: secret, content: secret }] } },
    { type: 'result', subtype: 'success', is_error: false, permission_denials: [
      { tool_name: call.name, tool_use_id: call.id, tool_input: call.input }], structured_output: { summary: secret } }],
  entries: [], policy: { schema: 1, root: '/', files: [], kind: 'task', stage: 'code' } });
}
function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1082-bootstrap-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return dir;
}

test('one exact author push branch/path/attempt; no official triggers, writable token or retry loop', () => {
  assert.deepEqual(workflow.on, { push: { branches: [BRANCH], paths: ['.github/workflows/1082-diagnostic-bootstrap.yml'] } });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.match(workflow.jobs.diagnostic.if, /github\.run_attempt == 1/);
  assert.match(workflow.jobs.diagnostic.if, /refs\/heads\/issue\/1082-diagnostic-bootstrap/);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.diagnostic['runs-on'], 'ubuntu-24.04');
  assert.equal(steps.filter(row => row.id === 'review').length, 1);
  assert.equal(steps.filter(row => row.uses?.startsWith('actions/checkout@')).length, 2);
  const material = steps.find(row => row.with?.ref === MATERIAL);
  assert.equal(material.with.path, undefined, 'action and accepted hook must share the immutable root cwd');
  for (const row of steps.filter(row => row.uses?.startsWith('actions/checkout@'))) assert.equal(row.with['persist-credentials'], false);
});

test('native action/model/effort/turns/settings/allowedTools/schema equal original accepted task configuration', () => {
  const acceptedTask = parse(read('.github/workflows/_process.yml')).jobs.model_review.steps.find(row => row.id === 'review');
  const model = step('review');
  assert.equal(model.uses, acceptedTask.uses);
  assert.equal(model.with.claude_args, acceptedTask.with.claude_args);
  assert.equal(model.env.ANTHROPIC_MODEL, 'claude-sonnet-5');
  assert.equal(model.env.CLAUDE_CODE_EFFORT_LEVEL, 'high');
  assert.equal(model.with.github_token, '${{ github.token }}');
  assert.match(model.with.settings, /1082-bootstrap\/policy\.json\.settings\.json$/);
  assert.ok(steps.find(row => row.id === 'native').run.includes(NATIVE));
  for (const row of steps) {
    const encoded = JSON.stringify(row);
    if (row.id !== 'review') assert.ok(!encoded.includes('secrets.'), row.name);
    assert.ok(!encoded.includes('HP_PROCESS_TOKEN') && !encoded.includes('id-token') && !encoded.includes('create-github-app-token'));
  }
});

test('accepted prepare/audit unchanged; overlay and collection are after model and audit, failure stays failure', () => {
  const policy = step('policy'), audit = step('audit'), evidence = step('evidence');
  assert.match(policy.run, /1082-accepted-tools\/scripts\/review-execution-policy\.mjs/);
  assert.match(audit.run, /1082-accepted-tools\/scripts\/review-execution-policy\.mjs/);
  assert.match(audit.if, /^always\(\)/); assert.match(evidence.if, /^always\(\)/);
  assert.ok(steps.indexOf(audit) > steps.indexOf(step('review')));
  assert.ok(steps.indexOf(evidence) > steps.indexOf(audit));
  assert.ok(steps.indexOf(step('binding')) > steps.indexOf(policy));
  assert.ok(steps.indexOf(step('binding')) < steps.indexOf(step('review')));
  assert.equal(evidence.env.BEFORE_MODEL_DIGEST, '${{ steps.binding.outputs.digest }}');
  for (const row of [step('review'), audit, evidence]) assert.equal(row['continue-on-error'], undefined);
  assert.deepEqual(OVERLAY, ['review-failure-diagnostics.mjs', 'review-tool-metadata.mjs']);
  assert.notEqual(TOOLS, MATERIAL);
});

test('upload only exact bounded new certificate and provenance, never raw trace/settings/report or directory', () => {
  const uploads = steps.filter(row => row.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(uploads.length, 2);
  assert.deepEqual(uploads.map(row => row.with.path), [
    '${{ steps.evidence.outputs.certificate }}', '${{ steps.evidence.outputs.provenance }}']);
  for (const row of uploads) {
    assert.match(row.if, /^always\(\)/); assert.equal(row.with['retention-days'], 1);
    assert.equal(row.with['if-no-files-found'], 'error'); assert.ok(!row.with.path.includes('*'));
  }
  assert.match(step('review').with.prompt, /НЕ официальный/);
  assert.match(step('review').with.prompt, /Никаких Bash/);
  assert.match(step('review').with.prompt, /точные denied calls\/причины missing journal неизвестны/);
  assert.ok(!steps.some(row => /seal|integrate|review-result|gh issue|issue_write|add_issue_comment/.test(row.run ?? '')));
});

test('fixed projection keeps distinct missing-journal/forbidden facts and safe shape, no raw secret or authority', () => {
  const original = fixture(), projected = projectCertificate(original), encoded = JSON.stringify(projected);
  assert.equal(projected.diagnosticOnly, true); assert.equal(projected.verdictAuthority, false);
  assert.equal(projected.calls[0].tool, 'Edit');
  assert.deepEqual(projected.calls[0].problems, ['missing-journal', 'forbidden-request']);
  assert.equal(projected.calls[0].journal.count, 0);
  assert.equal(projected.calls[0].journal.metadata, null);
  assert.equal(projected.calls[0].journal.reasonAvailable, false);
  assert.equal(projected.summary.permissionDenials, 1);
  assert.ok(!encoded.includes(secret));
  assert.ok(!Object.hasOwn(projected, 'provenance'), 'provenance must be rebuilt from the actual run, not copied');
  assert.deepEqual(projected.calls[0].input.fields, [{ key: 'offset', type: 'number', value: 1 }]);
});

test('hostile extra keys, strings, pseudo vocabulary, count/number values cannot reach publication', () => {
  const original = fixture();
  original.summary.extra = secret; original.summary.permissionDenials = secret;
  original.calls[0].journal.metadata = { tool: secret, keys: [secret, 'offset'], orderedKeyDigests: [secret],
    fields: [{ key: 'offset', type: 'number', value: Infinity }, { key: secret, type: 'string', value: secret }],
    command: { binary: secret, flags: [secret, '--write'], argumentCount: secret } };
  original.calls[0].expected = { denied: secret, category: secret, reasonDigest: secret };
  original.calls[0].problems = [secret, 'missing-journal'];
  original.calls[0].input.fields.push({ key: 'timeout', type: 'number', value: 1e99 });
  original.limits = { secret }; original.limitations = [secret]; original.trace = secret;
  const p = projectCertificate(original), encoded = JSON.stringify(p);
  assert.ok(!encoded.includes(secret)); assert.equal(p.summary.permissionDenials, null);
  assert.equal(p.calls[0].journal.metadata.tool, 'unknown');
  assert.deepEqual(p.calls[0].journal.metadata.keys, ['offset']);
  assert.deepEqual(p.calls[0].journal.metadata.command.flags, ['--write']);
  assert.deepEqual(p.calls[0].input.fields.at(-1), { key: 'timeout', type: 'number' });
  assert.equal(p.calls[0].expected.denied, null);
  assert.equal(p.calls[0].expected.category, 'unknown');
  assert.deepEqual(p.calls[0].problems, ['missing-journal']);
});

test('wrong schema or authority flags refuse, arrays are capped and absent evidence stays unknown', () => {
  for (const value of [null, {}, { ...fixture(), schema: 'other' }, { ...fixture(), diagnosticOnly: false },
    { ...fixture(), verdictAuthority: true }]) assert.throws(() => projectCertificate(value), /schema/);
  const original = fixture(); original.calls = Array(600).fill(original.calls[0]);
  original.denials = Array(600).fill(original.denials[0]);
  const p = projectCertificate(original);
  assert.equal(p.calls.length, 256); assert.equal(p.denials.length, 64);
  assert.equal(p.omitted.calls, 344); assert.equal(p.omitted.denials, 536);
  assert.equal(p.limits.certificateBytes, 256 * 1024);
  assert.equal(p.inputs.trace.status, 'unknown');
});

test('FD bounded reads reject oversize, nonregular and symlink; exact maximum accepted', t => {
  const dir = temp(t), file = join(dir, 'ordinary.json'); writeFileSync(file, '1234');
  assert.equal(regular(file, 4).toString(), '1234'); assert.throws(() => regular(file, 3), /oversized/);
  assert.throws(() => regular(dir, 1024), /nonregular|EISDIR/);
  const link = join(dir, 'alias.json');
  try { symlinkSync(file, link); } catch (error) { if (error.code === 'EPERM') { t.diagnostic('Windows symlink unavailable; Linux will exercise this branch'); return; } throw error; }
  assert.throws(() => regular(link, 4), /symlink/);
});

test('authentic issue snapshot retains complete current contents and fails rather than truncates oversize', () => {
  const issue = { number: 1082, body: 'all three AC', title: 'fixture', html_url: 'https://github.com/Matysh/houseplan-card/issues/1082' };
  const comments = [{ id: 1, body: 'full relevant comment', html_url: issue.html_url + '#issuecomment-1',
    user: { login: 'fixture-author' }, created_at: '2026-10-25', updated_at: '2026-10-25' }];
  const result = snapshotIssue(issue, comments);
  assert.equal(result.body, issue.body); assert.equal(result.comments[0].body, comments[0].body);
  assert.equal(result.comments[0].author, comments[0].user.login);
  assert.throws(() => snapshotIssue({ ...issue, body: 'x'.repeat(256 * 1024) }, comments), /bound/);
  assert.throws(() => snapshotIssue({ ...issue, number: 1067 }, comments), /unexpected/);
});

test('pre-model binding captures policy/settings/context/diff; changed bytes change the binding without exposing values', t => {
  const dir = temp(t), names = ['context.json', 'diff.patch', 'policy.json', 'policy.json.settings.json'];
  for (const name of names) writeFileSync(join(dir, name), secret);
  const before = boundInputs(dir); assert.deepEqual(Object.keys(before), names);
  for (const digest of Object.values(before)) assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(before).includes(secret));
  writeFileSync(join(dir, 'policy.json.settings.json'), secret + 'changed');
  const after = boundInputs(dir);
  assert.notEqual(after['policy.json.settings.json'], before['policy.json.settings.json']);
  for (const name of names.slice(0, 3)) assert.equal(after[name], before[name]);
});
