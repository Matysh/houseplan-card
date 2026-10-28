import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { buildNativeReviewInvocation, createNativeReviewCollector, nativeReviewResult, runNativeReview,
  prepareNativeReviewPrompt, writeNativeReviewOutputs, verifyNativeReviewBinary, NATIVE_REVIEW_VERSION,
  NATIVE_REVIEW_SHA256, readBoundedReviewBytes } from '../scripts/review-native-runner.mjs';

const tools = ['Read', 'Grep', 'Glob', 'Write', 'ToolSearch'];
const capabilities = { readReviewCapabilities: () => ({ nativeTools: tools, serverName: 'houseplan_review' }) };
const terminal = overrides => ({ type: 'result', subtype: 'success', is_error: false, num_turns: 3,
  session_id: 'fixture-session', permission_denials: [], structured_output: { summary: 'transport DATA only', verdict: 'green' },
  usage: { input_tokens: 7 }, modelUsage: { fixture: { inputTokens: 7 } }, duration_ms: 11, total_cost_usd: 0, ...overrides });
const messages = () => [{ type: 'system', subtype: 'init', session_id: 'fixture-session' },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'call1', name: 'Read', input: { file_path: 'fixture' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'call1', content: 'ordinary fixture content' }] } }, terminal()];
function fixture(t, script) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-review-native-')), material = join(dir, 'material'); mkdirSync(material);
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const config = { cliPath: process.execPath, policyPath: join(dir, 'policy.json'), promptPath: join(dir, 'prompt.txt'),
    jsonSchema: JSON.stringify({ type: 'object' }), kind: 'task', maxTurns: 150, executionDir: join(dir, 'output') };
  const policy = { schema: 2, sha: 'a'.repeat(40), cliVersion: NATIVE_REVIEW_VERSION,
    cliSha256: NATIVE_REVIEW_SHA256, root: material, kind: 'task' };
  writeFileSync(config.policyPath, JSON.stringify(policy)); writeFileSync(config.policyPath + '.settings.json', '{}');
  writeFileSync(config.promptPath, 'Inert transport fixture.');
  const childPath = join(dir, 'child.cjs'); writeFileSync(childPath, script);
  const calls = [];
  const dependencies = { platform: 'linux', capabilities, verifyBinary: path => assert.equal(path, process.execPath),
    spawnNative: (file, args, options) => { calls.push({ file, args, options }); return spawn(process.execPath, [childPath], options); } };
  return { config, policy, dependencies, calls, dir };
}

// SIGKILL dispatch, pipe closure and the kernel's exit state are asynchronous.
// Observe the owned fixture within the original whole-operation deadline;
// neither a live process nor a new grace period is accepted.
async function assertOwnedProcessStopped(pid, deadline, readState = ownedPid => {
  try { return readFileSync(`/proc/${ownedPid}/stat`, 'utf8').split(') ')[1].split(' ')[0]; }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}) {
  for (;;) {
    const state = readState(pid);
    const remaining = deadline - performance.now();
    assert.ok(remaining >= 0, `owned descendant remains running at the deadline: ${state}`);
    if (state === '' || state === 'Z') return;
    await delay(Math.min(10, remaining));
  }
}

test('#1115 owned-process observation refuses a live process at the existing deadline', async () => {
  for (const state of ['R', 'S', 'D', 'T'])
    await assert.rejects(assertOwnedProcessStopped(123, performance.now(), () => state),
      /owned descendant remains running/);
  for (const state of ['', 'Z'])
    await assertOwnedProcessStopped(123, performance.now() + 1000, () => state);
});

test('#1115 owned-process observation waits for exit without renewing the deadline', async () => {
  const states = ['R', 'S', 'Z'];
  let reads = 0;
  await assertOwnedProcessStopped(123, performance.now() + 1000, () => states[reads++]);
  assert.equal(reads, 3);
  await assert.rejects(assertOwnedProcessStopped(123, performance.now() - 1, () => 'Z'),
    /at the deadline/);
});

test('#1065 native argv preserves empty setting sources, fixed catalog, one strict MCP and budgets', t => {
  const { config, policy } = fixture(t, '');
  const call = buildNativeReviewInvocation(config, policy);
  assert.equal(call.args[call.args.indexOf('--setting-sources') + 1], '');
  assert.equal(call.args[call.args.indexOf('--tools') + 1], tools.join(','));
  assert.equal(call.args.includes('--strict-mcp-config'), true);
  assert.equal(call.args.includes('--dangerously-skip-permissions'), false);
  assert.equal(call.args[call.args.indexOf('--max-turns') + 1], '150');
  assert.deepEqual(Object.keys(call.mcp.mcpServers), ['houseplan_review']);
  assert.equal(call.mcp.mcpServers.houseplan_review.args.at(-1), config.policyPath);
  assert.throws(() => buildNativeReviewInvocation(config, policy, { tools: [...tools, 'Bash'] }), /configuration/);
  assert.throws(() => buildNativeReviewInvocation({ ...config, maxTurns: 151 }, policy), /configuration/);
  const release = buildNativeReviewInvocation({ ...config, kind: 'release', maxTurns: 200 }, { ...policy, kind: 'release' });
  assert.equal(release.args[release.args.indexOf('--max-turns') + 1], '200');
  assert.throws(() => buildNativeReviewInvocation({ ...config, kind: 'release', maxTurns: 201 }, { ...policy, kind: 'release' }), /configuration/);
  assert.throws(() => buildNativeReviewInvocation({ ...config, kind: 'ship', maxTurns: 151 }, { ...policy, kind: 'ship' }), /configuration/);
});

test('#1065 bounded FD input stops at max+1 even if data keeps growing after fstat', () => {
  let consumed = 0;
  const growing = (_fd, buffer, offset, count) => { consumed += count; buffer.fill(97, offset, offset + count); return count; };
  assert.throws(() => readBoundedReviewBytes(0, 10, growing), /bound/);
  assert.equal(consumed, 11);
  let reads = 0;
  assert.equal(readBoundedReviewBytes(0, 10, (_fd, buffer) => {
    if (reads++) return 0;
    buffer.write('safe'); return 4;
  }).toString(), 'safe');
});

test('#1065 streaming collector preserves complete native events, unicode and raw input key ordering', () => {
  const data = messages(); data[1].message.content[0].input = { z: 'данные', a: [1, 2] };
  const bytes = Buffer.from(data.map(v => JSON.stringify(v)).join('\n') + '\n');
  const collect = createNativeReviewCollector();
  for (let i = 0; i < bytes.length; i += 7) collect.add(bytes.subarray(i, i + 7));
  collect.end();
  assert.equal(collect.problem, null); assert.deepEqual(collect.messages, data);
  assert.deepEqual(Object.keys(collect.messages[1].message.content[0].input), ['z', 'a']);
  assert.deepEqual(nativeReviewResult(collect.messages, 150), data.at(-1));
});

test('#1065 malformed, invalid UTF-8, truncated and oversized stream DATA fail closed', () => {
  for (const data of [Buffer.from('{not json}\n'), Buffer.from('{"type":"result"'), Buffer.from([0xff, 0x0a])]) {
    const collector = createNativeReviewCollector(); collector.add(data); collector.end(); assert.ok(collector.problem);
  }
  const collector = createNativeReviewCollector({ maxBytes: 16, maxLineBytes: 8 });
  collector.add(Buffer.from('x'.repeat(17))); collector.end(); assert.ok(collector.problem);
});

test('#1065 missing/duplicate/result-before-tail/error/denied/over-budget terminals cannot pass', () => {
  for (const data of [[], [terminal(), terminal()], [terminal(), { type: 'assistant' }],
    [terminal({ is_error: true })], [terminal({ subtype: 'error_max_turns' })],
    [terminal({ permission_denials: [{ tool_name: 'Bash' }] })], [terminal({ permission_denials: undefined })],
    [terminal({ num_turns: 151 })], [terminal({ structured_output: undefined })]]) {
    assert.throws(() => nativeReviewResult(data, 150));
  }
});

test('#1065 ordinary safe child transport retains all events privately and returns exact output fields', async t => {
  const data = messages(), script = `process.stdin.resume(); process.stdin.on('end',()=>{process.stderr.write('PRIVATE child diagnostic'); process.stdout.write(${JSON.stringify(data.map(v => JSON.stringify(v)).join('\n') + '\n')});});`;
  const { config, dependencies, calls } = fixture(t, script);
  const result = await runNativeReview(config, dependencies);
  assert.equal(result.success, true); assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].args[calls[0].args.indexOf('--setting-sources') + 1], '');
  assert.deepEqual(JSON.parse(readFileSync(result.outputs.execution_file, 'utf8')), data);
  assert.deepEqual(JSON.parse(result.outputs.structured_output), data.at(-1).structured_output);
  assert.equal(readFileSync(join(config.executionDir, 'native-stderr.log'), 'utf8'), 'PRIVATE child diagnostic');
  assert.equal(readFileSync(join(config.executionDir, 'native-raw.jsonl'), 'utf8'), data.map(v => JSON.stringify(v)).join('\n') + '\n');
  const out = join(config.executionDir, 'workflow-output'); writeNativeReviewOutputs(result.outputs, out);
  assert.match(readFileSync(out, 'utf8'), /execution_file=/);
  assert.throws(() => writeNativeReviewOutputs({ execution_file: 'x\nforged=yes' }, out));
});

test('#1065 real child nonzero exit keeps evidence but withholds structured success', async t => {
  const data = messages();
  const { config, dependencies } = fixture(t, `process.stdout.write(${JSON.stringify(data.map(v => JSON.stringify(v)).join('\n') + '\n')}); process.exitCode=3;`);
  const result = await runNativeReview(config, dependencies);
  assert.equal(result.success, false); assert.equal(result.outputs.structured_output, undefined);
  assert.deepEqual(JSON.parse(readFileSync(result.outputs.execution_file, 'utf8')), data);
});

test('#1065 real owned child timeout is bounded and never yields an accepted terminal', async t => {
  const { config, dependencies } = fixture(t, 'process.stdin.resume(); setInterval(()=>{},1000);');
  const result = await runNativeReview(config, { ...dependencies, timeoutMs: 150, terminateGraceMs: 100 });
  assert.equal(result.success, false); assert.equal(result.status, 'native-timeout');
  assert.equal(result.outputs.structured_output, undefined);
});

test('#1065 ABI mismatch is rejected before native process spawn', async t => {
  const { config, dependencies, calls } = fixture(t, '');
  await assert.rejects(runNativeReview(config, { ...dependencies, verifyBinary: verifyNativeReviewBinary }), /identity mismatch/);
  assert.equal(calls.length, 0);
});

test('#1065 prompt preparation is exclusive UTF-8 outside material; no shell interpolation', t => {
  const { dir, policy } = fixture(t, ''); const path = join(dir, 'prepared', 'prompt.txt');
  const text = 'Данные ${notExecuted} `notExecuted`\nSecond line';
  prepareNativeReviewPrompt(path, text, policy.root); assert.equal(readFileSync(path, 'utf8'), text);
  assert.throws(() => prepareNativeReviewPrompt(path, 'replace', policy.root), /EEXIST/);
  assert.throws(() => prepareNativeReviewPrompt(join(policy.root, 'canonical.md'), text, policy.root), /outside/);
  assert.throws(() => prepareNativeReviewPrompt(join(policy.root, '..looks-external', 'prompt.txt'), text, policy.root), /outside/);
});

test('#1065 manifest validation and stale output refuse before spawning a native process', async t => {
  const { config, dependencies, calls } = fixture(t, '');
  await assert.rejects(runNativeReview(config, { ...dependencies,
    capabilities: { readReviewCapabilities() { throw new Error('caps invalid'); } } }), /caps invalid/);
  assert.equal(calls.length, 0);
  mkdirSync(config.executionDir); writeFileSync(join(config.executionDir, 'native-mcp.json'), 'old evidence');
  await assert.rejects(runNativeReview(config, dependencies), /EEXIST/);
  assert.equal(calls.length, 0);
  assert.equal(readFileSync(join(config.executionDir, 'native-mcp.json'), 'utf8'), 'old evidence');
});

test('#1065 malformed real-child stream keeps private prefix evidence but cannot export structured success', async t => {
  const { config, dependencies } = fixture(t, `process.stdout.write('{"type":"assistant"}\\n{"type":');`);
  const result = await runNativeReview(config, dependencies);
  assert.equal(result.success, false); assert.equal(result.outputs.structured_output, undefined);
  assert.deepEqual(JSON.parse(readFileSync(result.outputs.execution_file, 'utf8')), [{ type: 'assistant' }]);
  assert.equal(readFileSync(join(config.executionDir, 'native-raw.jsonl'), 'utf8'), '{"type":"assistant"}\n{"type":');
});

test('#1065 adapter refuses malformed tail even when the retained array contains a successful terminal', async t => {
  const data = messages();
  const raw = data.map(value => JSON.stringify(value)).join('\n') + '\n{"type":';
  const { config, dependencies } = fixture(t, `process.stdout.write(${JSON.stringify(raw)});`);
  const result = await runNativeReview(config, dependencies);
  const retained = JSON.parse(readFileSync(result.outputs.execution_file, 'utf8'));
  assert.deepEqual(nativeReviewResult(retained, 150), data.at(-1), 'partial array alone does not attest transport completion');
  const adapter = JSON.parse(readFileSync(join(config.executionDir, 'native-adapter.json'), 'utf8'));
  assert.notEqual(adapter.status, 'success');
  assert.equal(adapter.executionFile, result.outputs.execution_file);
  assert.equal(adapter.messages, retained.length);
  assert.equal(result.success, false); assert.equal(result.outputs.structured_output, undefined);
});

test('#1065 exited native leader cannot leave an owned pipe-holder beyond bounded finalization',
  { skip: process.platform !== 'linux', timeout: 10000 }, async t => {
    const { config, dependencies, calls, dir } = fixture(t, '');
    const descendantPath = join(dir, 'pipe-holder.cjs'), pidPath = join(dir, 'owned-descendant.pid');
    writeFileSync(descendantPath, 'process.on("SIGTERM",()=>{}); process.send("ready"); setInterval(()=>{},1000);\n');
    const raw = messages().map(value => JSON.stringify(value)).join('\n') + '\n';
    writeFileSync(join(dir, 'child.cjs'), `const {spawn}=require('node:child_process'); const fs=require('node:fs');
const child=spawn(process.execPath,[${JSON.stringify(descendantPath)}],{stdio:['ignore',1,2,'ipc']});
child.once('message',()=>{fs.writeFileSync(${JSON.stringify(pidPath)},String(child.pid));process.stdout.write(${JSON.stringify(raw)});process.exit(0);});\n`);
    let leader;
    const deadline = performance.now() + 2000;
    const running = runNativeReview(config, { ...dependencies, spawnNative: (...args) => {
      leader = dependencies.spawnNative(...args); return leader;
    }, timeoutMs: 1000, terminateGraceMs: 50, stdioGraceMs: 50 });
    let timer;
    try {
      const result = await Promise.race([running, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('owned pipe-holder outlived bounded runner finalization')),
          Math.max(0, deadline - performance.now()));
      })]);
      assert.equal(calls[0].options.detached, true);
      assert.equal(result.success, false); assert.equal(result.outputs.structured_output, undefined);
      assert.equal(leader.exitCode, 0);
      assert.equal(result.status, 'native-stdio-timeout');
      assert.deepEqual(JSON.parse(readFileSync(result.outputs.execution_file, 'utf8')), messages());
      const pid = Number(readFileSync(pidPath, 'utf8'));
      await assertOwnedProcessStopped(pid, deadline);
    } finally {
      clearTimeout(timer);
      // Only the PID created by this fixed fixture is a cleanup target.
      if (existsSync(pidPath)) {
        const pid = Number(readFileSync(pidPath, 'utf8'));
        if (Number.isSafeInteger(pid) && pid > 1) try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
      await running;
    }
  });

test('#1065 inert pipe without close has a bounded failed finalizer and no process target', async t => {
  const { config, dependencies } = fixture(t, '');
  const child = new EventEmitter();
  Object.assign(child, { pid: undefined, exitCode: 0, signalCode: null,
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    unref() { this.unreferenced = true; } });
  const result = await runNativeReview(config, { ...dependencies, terminateGraceMs: 10, stdioGraceMs: 10,
    spawnNative: () => { setImmediate(() => {
      child.stdout.write(messages().map(value => JSON.stringify(value)).join('\n') + '\n');
      child.emit('exit', 0, null);
    }); return child; } });
  assert.equal(result.success, false); assert.equal(result.status, 'native-stdio-timeout');
  assert.equal(child.unreferenced, true);
  assert.equal(child.stdout.destroyed, true); assert.equal(child.stderr.destroyed, true);
});
