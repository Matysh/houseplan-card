import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PassThrough, Writable } from 'node:stream';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReviewCheckServer, startReviewCheckServer, REVIEW_MCP_PROTOCOL } from '../scripts/review-check-server.mjs';
import { buildReviewCapabilities, REVIEW_MCP_NATIVE_TOOL_NAME } from '../scripts/review-capabilities.mjs';
import { reviewCheckEnvironment, readCheckExecutionEntries, verifyCheckExecutionFiles,
  checkTraceProblems } from '../scripts/review-approved-check.mjs';

const definition = { name: 'run_check', description: 'Fixed checks', inputSchema: { type: 'object',
  properties: { check_id: { type: 'string', enum: ['unit-one'] } }, required: ['check_id'], additionalProperties: false } };
const receipt = (checkId, overrides = {}) => ({ schema: 'houseplan-review-check-result/v1', receiptId: 'fixture-receipt',
  checkId, executed: true, status: 'passed', exitCode: 0, ...overrides });
const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture(execute = async ({ checkId }) => receipt(checkId)) {
  const sent = [], errors = [];
  const server = createReviewCheckServer({ definition, execute, send: value => sent.push(value), onError: value => errors.push(value) });
  server.receive(request(1, 'initialize', { protocolVersion: REVIEW_MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'data-test', version: '1' } }));
  server.receive({ jsonrpc: '2.0', method: 'notifications/initialized' });
  return { server, sent, errors };
}

test('#1065 MCP negotiates pinned protocol and exposes only the closed check tool', async () => {
  const { server, sent } = fixture();
  server.receive(request(2, 'tools/list'));
  assert.equal(sent[0].result.protocolVersion, REVIEW_MCP_PROTOCOL);
  assert.deepEqual(sent[1].result.tools, [definition]);
  server.receive(request(3, 'tools/call', { name: 'run_check', arguments: { check_id: 'unit-one' } }));
  await turn();
  assert.deepEqual(sent[2].result.structuredContent, receipt('unit-one'));
  assert.deepEqual(JSON.parse(sent[2].result.content[0].text), receipt('unit-one'));
  await server.close();
});

test('#1065 MCP rejects malformed/extra argv and unknown methods without dispatch', async () => {
  let executed = 0;
  const { server, sent } = fixture(async () => { executed++; return receipt('wrong'); });
  for (const arguments_ of [{ check_id: 'unit-one', command: 'not executed' }, { check_id: 7 }, {}, { check_id: '' }]) {
    server.receive(request(10 + sent.length, 'tools/call', { name: 'run_check', arguments: arguments_ }));
    assert.equal(sent.at(-1).error.code, -32602);
  }
  server.receive(request(30, 'tools/call', { name: 'exec', arguments: { check_id: 'unit-one' } }));
  server.receive(request(31, 'exec', {}));
  server.receive([{ jsonrpc: '2.0', id: 32, method: 'tools/list' }]);
  assert.equal(sent.at(-2).error.code, -32601);
  assert.equal(sent.at(-1).error.code, -32600);
  assert.equal(executed, 0);
  await server.close();
});

test('#1065 unknown check is an explicit unexecuted result, never fabricated PASS', async () => {
  const { server, sent } = fixture(async ({ checkId }) => receipt(checkId, { executed: false, status: 'unavailable', exitCode: null }));
  server.receive(request(2, 'tools/call', { name: 'run_check', arguments: { check_id: 'unknown' } }));
  await turn();
  assert.equal(sent.at(-1).result.isError, true);
  assert.equal(sent.at(-1).result.structuredContent.executed, false);
  await server.close();
});

test('#1065 checks serialize; cancelling a queued request cannot execute it', async () => {
  const started = [], release = [];
  const { server, sent } = fixture(({ checkId }) => new Promise(resolve => { started.push(checkId); release.push(() => resolve(receipt(checkId))); }));
  const call = (id, check_id) => server.receive(request(id, 'tools/call', { name: 'run_check', arguments: { check_id } }));
  call(2, 'first'); call(3, 'cancelled'); call(4, 'last');
  assert.deepEqual(started, ['first']);
  server.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 3 } });
  release.shift()(); await turn();
  assert.deepEqual(started, ['first', 'last']);
  release.shift()(); await turn();
  assert.equal(sent.some(value => value.id === 3), false, 'MCP cancellation does not produce a new response');
  await server.close();
});

test('#1065 active cancellation signals only that owned request and drains safely', async () => {
  const signals = [], started = [];
  const { server, sent } = fixture(({ checkId, signal }) => new Promise(resolve => {
    started.push(checkId); signals.push(signal);
    signal.addEventListener('abort', () => resolve(receipt(checkId, { status: 'cancelled', exitCode: null })), { once: true });
  }));
  server.receive(request(2, 'tools/call', { name: 'run_check', arguments: { check_id: 'first' } }));
  server.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 900 } });
  assert.equal(signals[0].aborted, false);
  server.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2 } });
  await turn();
  assert.equal(signals[0].aborted, true);
  assert.equal(sent.some(value => value.id === 2), false);
  assert.deepEqual(started, ['first']);
  await server.close();
});

test('#1065 executor errors fail without reflecting raw error or pretending execution succeeded', async () => {
  const { server, sent, errors } = fixture(async () => { throw new Error('SECRET sentinel child stderr'); });
  server.receive(request(2, 'tools/call', { name: 'run_check', arguments: { check_id: 'unit-one' } }));
  await turn();
  assert.equal(sent.at(-1).error.code, -32603);
  assert.equal(JSON.stringify(sent).includes('SECRET'), false);
  assert.deepEqual(errors, ['check-receipt-unavailable']);
  await server.close();
});

test('#1065 stdio is UTF-8 newline JSON-RPC, bounded and never dispatches incomplete frames', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-review-mcp-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const policyPath = join(root, 'policy.json'); writeFileSync(policyPath, '{}');
  const input = new PassThrough(), output = new PassThrough(), chunks = [];
  output.on('data', b => chunks.push(b.toString()));
  let executed = 0;
  const run = startReviewCheckServer({ policyPath, input, output }, { capabilities: {
    readReviewCapabilities: () => ({}), reviewCheckToolDefinition: () => definition,
  }, executor: { runApprovedCheck: async () => { executed++; return receipt('unexpected'); } } });
  const init = JSON.stringify(request(1, 'initialize', { protocolVersion: REVIEW_MCP_PROTOCOL,
    capabilities: {}, clientInfo: { name: 'данные', version: '1' } }));
  const bytes = Buffer.from(init + '\n'); input.write(bytes.subarray(0, 20)); input.write(bytes.subarray(20));
  input.write('{broken json}\n');
  input.end(JSON.stringify(request(2, 'tools/call', { name: 'run_check', arguments: { check_id: 'unit-one' } })));
  await run;
  const messages = chunks.join('').trim().split('\n').map(JSON.parse);
  assert.equal(messages[0].result.protocolVersion, REVIEW_MCP_PROTOCOL);
  assert.equal(messages.filter(v => v.error?.code === -32700).length, 2);
  assert.equal(executed, 0);
});

test('#1065 oversized stdio frames fail closed before parsing or dispatch', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-review-mcp-size-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const policyPath = join(root, 'policy.json'); writeFileSync(policyPath, '{}');
  const input = new PassThrough(); input.end('x'.repeat(100));
  await assert.rejects(startReviewCheckServer({ policyPath, input, output: new Writable({ write(_b, _e, done) { done(); } }), maxLineBytes: 32 },
    { capabilities: { readReviewCapabilities: () => ({}), reviewCheckToolDefinition: () => definition },
      executor: { runApprovedCheck: () => { throw new Error('must not dispatch'); } } }), /exceeded/);
});

test('#1065 stdio shutdown aborts and awaits its active owned check', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-review-mcp-close-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const policyPath = join(root, 'policy.json'); writeFileSync(policyPath, '{}');
  const input = new PassThrough(), output = new PassThrough(); output.resume();
  let started, stopped = false;
  const start = new Promise(resolve => { started = resolve; });
  const run = startReviewCheckServer({ policyPath, input, output }, {
    capabilities: { readReviewCapabilities: () => ({}), reviewCheckToolDefinition: () => definition },
    executor: { runApprovedCheck: ({ signal }) => new Promise(resolve => {
      started(); signal.addEventListener('abort', () => { stopped = true; resolve(receipt('owned', { exitCode: null })); }, { once: true });
    }) },
  });
  input.write(JSON.stringify(request(1, 'initialize', { protocolVersion: REVIEW_MCP_PROTOCOL,
    capabilities: {}, clientInfo: { name: 'fixture', version: '1' } })) + '\n');
  input.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  input.write(JSON.stringify(request(2, 'tools/call', { name: 'run_check', arguments: { check_id: 'owned' } })) + '\n');
  await start; input.end(); await run;
  assert.equal(stopped, true);
});

test('#1065 actual MCP server binds a fixed real Node check to the independent execution ledger', { timeout: 15000 }, async t => {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'hp-review-mcp-real-'));
  const root = join(dir, 'repo'); mkdirSync(root); mkdirSync(join(root, 'test'));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  writeFileSync(join(root, 'test/ordinary.test.mjs'),
    'import test from "node:test"; import assert from "node:assert/strict"; test("fixed ordinary input",()=>assert.equal(2+2,4));\n');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', ...args], { cwd: root, env: reviewCheckEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  for (const [key, value] of [['maintenance.auto', 'false'], ['gc.auto', '0'], ['receive.autogc', 'false']]) git('config', key, value);
  git('add', '.'); git('commit', '-qm', 'fixed ordinary test fixture');
  const policyPath = join(dir, 'policy.json');
  const policy = { schema: 2, root: realpathSync(root), sha: git('rev-parse', 'HEAD'), stage: 'code', kind: 'task',
    files: ['test/ordinary.test.mjs'], outputs: [join(dir, 'report.md')], checksJournal: policyPath + '.checks.jsonl' };
  policy.capabilities = buildReviewCapabilities(policy);
  writeFileSync(policyPath, JSON.stringify(policy)); writeFileSync(policy.checksJournal, '');
  const input = new PassThrough(), output = new PassThrough(), responses = [];
  let receiveResult;
  const result = new Promise(resolve => { receiveResult = resolve; });
  output.on('data', bytes => {
    for (const line of bytes.toString('utf8').trim().split('\n')) {
      const response = JSON.parse(line); responses.push(response);
      if (response.id === 4) receiveResult(response);
    }
  });
  const running = startReviewCheckServer({ policyPath, input, output });
  t.after(() => input.destroy());
  const send = message => input.write(JSON.stringify(message) + '\n');
  send(request(1, 'initialize', { protocolVersion: REVIEW_MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'ordinary-test', version: '1' } }));
  send({ jsonrpc: '2.0', method: 'notifications/initialized' }); send(request(2, 'tools/list'));
  const checkId = 'unit:test/ordinary.test.mjs';
  send(request(4, 'tools/call', { name: 'run_check', arguments: { check_id: checkId } }));
  const answer = await result; input.end(); await running;
  assert.equal(responses.find(row => row.id === 2).result.tools[0].name, 'run_check');
  assert.equal(answer.error, undefined); assert.equal(answer.result.isError, undefined);
  const actual = answer.result.structuredContent, ledger = readCheckExecutionEntries(policy);
  assert.equal(actual.status, 'passed'); assert.equal(actual.executed, true); assert.equal(actual.exitCode, 0);
  assert.deepEqual(ledger, [actual]);
  assert.deepEqual(JSON.parse(answer.result.content[0].text), actual);
  assert.deepEqual(verifyCheckExecutionFiles(ledger, policy, policyPath), []);
  assert.deepEqual(checkTraceProblems({ name: REVIEW_MCP_NATIVE_TOOL_NAME, input: { check_id: checkId } },
    { content: answer.result.content }, ledger, policy).problems, []);
  assert.match(readFileSync(actual.steps[0].stdoutPath, 'utf8'), /# pass 1/);
  assert.equal(git('status', '--porcelain'), '');
});
