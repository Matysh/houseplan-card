import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildFailureCertificate, collectFailureCertificate, FAILURE_LIMITS, readDiagnosticInput } from '../scripts/review-failure-diagnostics.mjs';
import { traceProblems, toolProblem } from '../scripts/review-execution-policy.mjs';
import { literalArgv } from '../scripts/review-execution-policy.mjs';
import { reviewDecisionMetadata, reviewToolMetadata } from '../scripts/review-tool-metadata.mjs';
import { REQUIRED_FILES } from '../scripts/review-result-gate.mjs';
import { CALL_DIGEST_ALGORITHM, LEGACY_CALL_DIGEST_ALGORITHM, callDigest } from '../scripts/review-call-digest.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const secret = 'ghp_SYNTHETIC_CREDENTIAL_NEVER_PUBLISH_1082';
const policy = () => ({ schema: 1, root: ROOT, files: [], stage: 'code', kind: 'task', cliVersion: '2.1.295', sha: 'a'.repeat(40),
  callDigestAlgorithm: CALL_DIGEST_ALGORITHM });
const provenance = { run: '123', attempt: '2', issue: '1082', stage: 'code', kind: 'task', materialSha: 'a'.repeat(40), toolsSha: 'b'.repeat(40) };
function fixture() {
  // Command strings are inert DATA. Neither the collector nor these tests dispatches them.
  const call = { type: 'tool_use', id: 'toolu_synthetic', name: 'Bash', input: { command: `node -e '${secret}'`, description: secret } };
  const messages = [{ type: 'assistant', message: { content: [call] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: call.id, content: secret }] } },
    { type: 'result', subtype: 'success', is_error: false, summary: secret,
      permission_denials: [{ tool_name: call.name, tool_use_id: call.id, tool_input: call.input }] }];
  const entries = [{ id: call.id, callDigestAlgorithm: CALL_DIGEST_ALGORITHM, input: callDigest(call.name, call.input), denied: true }];
  return { call, messages, entries, policy: policy(), provenance };
}
const cert = row => buildFailureCertificate(row ?? fixture());
function temp(t) { const dir = mkdtempSync(join(tmpdir(), 'hp-review-failure-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }

test('#1082 AC1: forbidden request, missing/mismatched decision and unmatched records remain distinct diagnostics', () => {
  const f = fixture(), normal = cert(f);
  assert.equal(normal.diagnosticOnly, true); assert.equal(normal.verdictAuthority, false);
  assert.equal(normal.calls[0].expected.category, 'untracked-node-entry');
  assert.equal(normal.calls[0].journal.inputDigestMatches, true);
  assert.deepEqual(normal.calls[0].problems, ['forbidden-request']);
  const missing = cert({ ...f, entries: [] });
  assert.ok(missing.calls[0].problems.includes('missing-journal'));
  const mismatched = cert({ ...f, entries: [{ ...f.entries[0], input: 'foreign', denied: false }, { id: 'orphan' }] });
  assert.ok(mismatched.calls[0].problems.includes('input-digest-mismatch'));
  assert.ok(mismatched.calls[0].problems.includes('decision-mismatch'));
  assert.equal(mismatched.summary.orphanJournalRows, 1);
  const duplicate = cert({ ...f, entries: [...f.entries, ...f.entries] });
  assert.ok(duplicate.calls[0].problems.includes('duplicate-journal'));
  const noResult = cert({ ...f, messages: [f.messages[0], f.messages[2]] });
  assert.ok(noResult.calls[0].problems.includes('missing-result'));
  assert.equal(normal.summary.permissionDenials, 1);
});

test('#1082 AC2: known values never escape through argv, keys, IDs, Write, results, prompts or MCP names/config', () => {
  const f = fixture();
  f.messages[0].message.content.push({ type: 'tool_use', id: secret, name: secret,
    input: { [secret]: secret, content: secret, file_path: `/tmp/${secret}`, prompt: secret, mcp: { token: secret } } });
  f.messages.unshift({ type: 'system', prompt: secret, mcpServers: { secret } });
  f.policy.secret = secret;
  const output = cert(f), text = JSON.stringify(output);
  for (const value of [secret, 'toolu_synthetic', f.call.input.command, 'mcpServers', '/tmp/']) assert.ok(!text.includes(value), value);
  assert.equal(output.calls[1].tool, 'other');
  assert.equal(output.calls[1].input.otherKeyCount, 2);
  assert.equal(output.calls[0].input.command.binary, 'node');
  assert.deepEqual(output.calls[0].input.command.flags, ['-e']);
  assert.equal(output.calls[0].input.command.argumentCount, 2);
  assert.equal(output.calls[1].toolUseIdDigest, hash(secret));
  assert.equal(output.calls[0].input.digest, hash(f.call.input), 'full input retained only as digest');
});

test('#1082 AC2: unknown tool and input metadata cannot turn attacker-controlled strings into artifact fields', () => {
  const f = fixture(); f.call.name = `mcp__${secret}`; f.call.id = secret;
  f.call.input = { [secret]: 'value', command: `echo ${secret} && cat /tmp/${secret}` };
  const result = cert(f), text = JSON.stringify(result);
  assert.equal(result.calls[0].tool, 'other');
  assert.equal(result.calls[0].input.command.literal, false);
  assert.equal(result.calls[0].input.command.binary, 'unknown');
  assert.ok(!text.includes(secret));
  assert.equal(result.calls[0].expected.category, 'tool-not-allowlisted');
  f.call.name = 'Bash';
  assert.equal(cert(f).calls[0].expected.category, 'nonliteral-or-background');
});

test('#1082 AC1/2: absent policy/trace, oversized, malformed and non-array inputs stay explicitly unavailable', t => {
  const dir = temp(t), bad = join(dir, 'bad.json');
  writeFileSync(bad, `{${secret}`);
  assert.equal(readDiagnosticInput(bad, 1000).status, 'invalid-json');
  assert.equal(readDiagnosticInput(bad, 1).status, 'oversize');
  assert.equal(readDiagnosticInput('', 1).status, 'missing');
  assert.equal(readDiagnosticInput(join(dir, 'absent'), 1).status, 'unreadable-or-missing');
  const output = collectFailureCertificate({ policyPath: bad, tracePath: bad, provenance, output: join(dir, 'out', 'certificate.json') });
  const result = JSON.parse(readFileSync(output));
  assert.equal(result.inputs.trace.status, 'invalid-json');
  assert.equal(result.summary.terminalResult, false);
  assert.ok(!readFileSync(output, 'utf8').includes(secret));
  writeFileSync(bad, '{}');
  const wrong = collectFailureCertificate({ policyPath: bad, tracePath: bad, provenance, output: join(dir, 'out', 'certificate.json') });
  assert.equal(JSON.parse(readFileSync(wrong)).inputs.trace.shape, 'wrong');
  const unavailable = cert({ ...fixture(), policy: null });
  assert.equal(unavailable.calls[0].expected.denied, null);
  assert.ok(!unavailable.calls[0].problems.includes('forbidden-request'), 'missing evidence is not a proven forbidden request');
  const malformed = fixture(); malformed.call.id = undefined;
  const malformedResult = cert({ ...malformed, entries: [null, false, {}, { id: secret, input: secret, denied: secret }] });
  assert.equal(malformedResult.summary.malformedJournalRows, 4);
  assert.ok(malformedResult.calls[0].problems.includes('malformed-tool'));
  assert.ok(!JSON.stringify(malformedResult).includes(secret));
});

test('#1082 AC2: fixed size/call limits report omitted evidence and preserve original inputs', () => {
  const f = fixture(); const original = structuredClone(f.messages);
  f.messages[0].message.content = Array.from({ length: FAILURE_LIMITS.calls + 20 }, (_, i) => ({ ...f.call, id: `toolu_${i}` }));
  const result = cert(f);
  assert.ok(result.calls.length <= FAILURE_LIMITS.calls);
  assert.ok(result.omitted.calls >= 20);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= FAILURE_LIMITS.certificateBytes);
  const before = structuredClone(f.messages); cert(f); assert.deepEqual(f.messages, before);
  assert.equal(original[0].message.content[0].input.command, f.call.input.command);
});

test('#1082 AC2: journal overflow is explicit; malformed journal never leaks its line', t => {
  const dir = temp(t), path = join(dir, 'journal');
  writeFileSync(path, Array.from({ length: FAILURE_LIMITS.journalRows + 1 }, () => '{}').join('\n'));
  const result = readDiagnosticInput(path, FAILURE_LIMITS.journalBytes, { jsonl: true });
  assert.equal(result.status, 'truncated'); assert.equal(result.omitted, 1);
  writeFileSync(path, `{}\n${secret}`);
  const bad = readDiagnosticInput(path, FAILURE_LIMITS.journalBytes, { jsonl: true });
  assert.equal(bad.status, 'invalid-json'); assert.ok(!JSON.stringify(bad).includes(secret));
});

test('#1082 AC3: collecting ordinary DATA never repairs or grants admission to the original audit', () => {
  const f = fixture();
  const before = traceProblems(f.messages, f.entries, f.policy);
  assert.ok(before.includes('review requested a forbidden tool call'));
  const rejection = toolProblem({ tool_name: f.call.name, tool_input: f.call.input }, f.policy);
  cert(f);
  assert.deepEqual(traceProblems(f.messages, f.entries, f.policy), before);
  assert.equal(toolProblem({ tool_name: f.call.name, tool_input: f.call.input }, f.policy), rejection);
  assert.deepEqual(REQUIRED_FILES, ['manifest.sha256', 'prepared.json', 'review-document.md', 'verdict.json']);
});

test('#1082 metadata channel observation grants no tool/journal exemption and leaks no payload', () => {
  const f = fixture(), before = traceProblems(f.messages, f.entries, f.policy);
  f.messages[0].message.content.push({ type: 'server_tool_use', id: secret, name: secret, input: { query: secret } },
    { type: 'tool_reference', tool_name: 'ToolSearch', input: { content: secret } });
  const result = cert(f);
  assert.equal(result.summary.metadataBlocks, 2);
  assert.deepEqual(result.metadataChannels.map(row => row.type), ['server_tool_use', 'tool_reference']);
  assert.equal(result.metadataChannels[0].tool, 'other');
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(traceProblems(f.messages, f.entries, f.policy), before);
});

test('#1082 actual hook shape preserves raw order differences while canonical equality rejects semantic changes', () => {
  for (const [actual, typeChanged] of [[{ file_path: secret, offset: 1, limit: 10 }, true],
    [{ limit: 10, offset: '1', file_path: secret }, false]]) {
    const input = { file_path: secret, offset: '1', limit: 10 };
    const call = { type: 'tool_use', id: 'toolu_read', name: 'Read', input };
    const messages = [{ type: 'assistant', message: { content: [call] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: call.id, content: secret }] } },
      { type: 'result', subtype: 'success', is_error: false }];
    const entries = [{ id: call.id, callDigestAlgorithm: CALL_DIGEST_ALGORITHM, input: callDigest(call.name, actual), denied: false,
      diagnostic: reviewToolMetadata(call.name, actual, { files: [], literalArgv }), diagnosticDecision: reviewDecisionMetadata(null) }];
    const before = traceProblems(messages, entries, policy());
    assert.equal(before.includes('tool call has no matching policy decision'), typeChanged);
    const result = cert({ messages, entries, policy: policy(), provenance });
    const row = result.calls[0];
    assert.equal(row.journal.inputDigestMatches, !typeChanged);
    assert.equal(row.problems.includes('input-digest-mismatch'), typeChanged);
    assert.equal(row.input.digestAlgorithm, LEGACY_CALL_DIGEST_ALGORITHM);
    assert.equal(row.callDigest.algorithm.algorithm, CALL_DIGEST_ALGORITHM);
    assert.equal(row.journal.metadataAgreesWithTrace, false);
    assert.equal(row.journal.decisionAgreesWithTrace, true);
    assert.equal(row.journal.reasonAvailable, true);
    assert.deepEqual(row.journal.metadata.fields, reviewToolMetadata('Read', actual).fields);
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.deepEqual(traceProblems(messages, entries, policy()), before, 'collection never repairs admission or changes its result');
  }
});

test('#1065 legacy diagnostic hashes stay legacy and recorded ToolSearch refusals never become new-policy allows', () => {
  const f = fixture(); delete f.policy.callDigestAlgorithm;
  f.call.name = 'ToolSearch'; f.call.input = { query: secret };
  f.entries = [{ id: f.call.id, input: hash({ name: f.call.name, input: f.call.input }), denied: true,
    diagnosticDecision: reviewDecisionMetadata('tool is not permitted by the review execution boundary') }];
  for (const explicit of [false, true]) {
    if (explicit) { f.policy.callDigestAlgorithm = LEGACY_CALL_DIGEST_ALGORITHM; f.entries[0].callDigestAlgorithm = LEGACY_CALL_DIGEST_ALGORITHM; }
    const result = cert(f), row = result.calls[0];
    assert.equal(row.journal.inputDigestMatches, true);
    assert.equal(row.journal.denied, true); assert.ok(row.problems.includes('forbidden-request'));
    assert.equal(row.expected.denied, null); assert.equal(row.expected.semantics, 'legacy-not-re-evaluated');
    assert.equal(row.journal.decisionAgreesWithTrace, null);
    assert.equal(row.journal.callDigestAlgorithm.algorithm, LEGACY_CALL_DIGEST_ALGORITHM);
    assert.equal(row.journal.callDigestAlgorithm.source, explicit ? 'explicit' : 'implicit-legacy');
    assert.equal(result.verdictAuthority, false); assert.ok(!JSON.stringify(result).includes(secret));
    assert.ok(traceProblems(f.messages, f.entries, f.policy).includes('unsupported call digest algorithm'));
  }
});

test('#1065 old key-order mismatch remains a historical mismatch; new algorithm is never applied retroactively', () => {
  const f = fixture(); delete f.policy.callDigestAlgorithm;
  f.call.name = 'Read'; f.call.input = { file_path: secret, offset: 1 };
  const actual = { offset: 1, file_path: secret };
  assert.equal(callDigest('Read', actual), callDigest('Read', f.call.input));
  f.entries = [{ id: f.call.id, input: hash({ name: 'Read', input: actual }), denied: false }];
  const row = cert(f).calls[0];
  assert.equal(row.journal.inputDigestMatches, false); assert.ok(row.problems.includes('input-digest-mismatch'));
  assert.equal(row.callDigest.algorithm.algorithm, LEGACY_CALL_DIGEST_ALGORITHM);
  assert.equal(row.expected.denied, null);
});

test('#1065 unknown/mixed/missing marker comparisons stay unavailable without leaking raw marker values', () => {
  for (const marker of [undefined, LEGACY_CALL_DIGEST_ALGORITHM, secret]) {
    const f = fixture(); f.entries[0].callDigestAlgorithm = marker;
    const row = cert(f).calls[0];
    assert.equal(row.journal.inputDigestMatches, null);
    assert.ok(row.problems.includes('call-digest-algorithm-unavailable'));
    assert.ok(!JSON.stringify(row).includes(secret));
  }
  const f = fixture(); f.policy.callDigestAlgorithm = secret;
  const result = cert(f);
  assert.equal(result.provenance.callDigestAlgorithm.algorithm, 'unknown');
  assert.equal(result.calls[0].expected.denied, null);
  assert.equal(result.calls[0].journal.inputDigestMatches, null);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('#1082 untrusted journal diagnostic extras/values are reprojected through finite vocabulary', () => {
  const f = fixture();
  f.entries[0].diagnostic = { ...reviewToolMetadata(f.call.name, f.call.input, { literalArgv }),
    raw: secret, tool: secret, keys: [secret, 'command'], fields: [{ key: 'offset', type: 'string', value: secret }],
    command: { literal: true, binary: secret, flags: [secret, '-e'], raw: secret } };
  f.entries[0].diagnosticDecision = { category: secret, reasonDigest: secret };
  const result = cert(f);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(result.calls[0].journal.metadata.tool, 'other');
  assert.equal(result.calls[0].journal.reasonAvailable, false);
  assert.deepEqual(result.calls[0].journal.metadata.fields, [{ key: 'offset', type: 'string' }]);
});

test('#1082 AC1: real collector CLI saves only a diagnostic certificate for an absent model trace', t => {
  const dir = temp(t), output = join(dir, 'outputs');
  const env = { ...process.env, REVIEW_DIAGNOSTIC_POLICY: join(dir, 'missing-policy'),
    REVIEW_EXECUTION_FILE: '', REVIEW_DIAGNOSTIC_TRACE_FALLBACK: join(dir, 'missing-trace'),
    REVIEW_DIAGNOSTIC_OUTPUT: join(dir, 'private', 'certificate.json'), GITHUB_OUTPUT: output,
    GITHUB_RUN_ID: '12', GITHUB_RUN_ATTEMPT: '3', REVIEW_DIAGNOSTIC_KIND: 'task', REVIEW_DIAGNOSTIC_STAGE: 'spec',
    REVIEW_DIAGNOSTIC_ISSUE: '1082', REVIEW_DIAGNOSTIC_SHA: 'a'.repeat(40), REVIEW_DIAGNOSTIC_TOOLS_SHA: 'b'.repeat(40) };
  const run = spawnSync(process.execPath, ['scripts/review-failure-diagnostics.mjs'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const path = readFileSync(output, 'utf8').trim().slice('certificate='.length);
  const result = JSON.parse(readFileSync(path));
  assert.equal(result.provenance.stage, 'spec'); assert.equal(result.provenance.attempt, '3');
  assert.equal(result.inputs.trace.status, 'unreadable-or-missing');
  assert.equal(result.verdictAuthority, false);
  assert.deepEqual(readdirSync(join(dir, 'private')), [path.split(/[\\/]/).at(-1)]);
});

for (const [file, tools] of [['_process.yml', 'preflight-tools'], ['_ship-review.yml', 'review-policy-tools'], ['release-review.yml', 'review-policy-tools']]) {
  test(`#1082 AC1/3: ${file} collects/uploads both failure paths independently of success-only sealing`, () => {
    const text = readFileSync(join(ROOT, '.github/workflows', file), 'utf8');
    const steps = parse(text).jobs.model_review.steps;
    const collect = steps.find(step => step.id === 'failure_diagnostics');
    const upload = steps.find(step => step.name === 'Сохранить диагностику отказа, не вердикт (#1082)');
    const audit = steps.find(step => step.id === 'execution_boundary');
    const seal = steps.find(step => step.name === 'Запечатать результат модели');
    for (const step of [collect, upload]) {
      assert.equal(step.if, "always() && (steps.review.outcome == 'failure' || steps.execution_boundary.outcome == 'failure')");
    }
    assert.equal(audit.id, 'execution_boundary');
    assert.equal(collect.run, `node "$RUNNER_TEMP/${tools}/scripts/review-failure-diagnostics.mjs"`);
    assert.equal(upload.with.path, '${{ steps.failure_diagnostics.outputs.certificate }}');
    assert.equal(String(upload.with['retention-days']), '1');
    assert.equal(upload.with['if-no-files-found'], 'error');
    assert.ok(!upload.with.name.includes('review-result'));
    assert.equal(seal.if ?? '', '', 'success-only sealing remains success-only');
  });
}
