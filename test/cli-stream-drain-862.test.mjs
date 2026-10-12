import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectSmokes } from '../scripts/smoke-select.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Resume independently of exit: waiting for exit before draining would deadlock
// a correctly backpressured CLI. A deadline belongs to this witness, not the CLI.
function runNode(args, { input = '', pause = 0, timeout = 15000, env = {}, brokenPipe = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env } });
    const out = [], err = [];
    let stdoutEnded = false, stderrEnded = false, exitSeen = false, bytes = 0;
    const started = Date.now();
    const drain = setTimeout(() => child.stdout.resume(), pause);
    const deadline = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CLI timeout after ${timeout}ms`));
    }, timeout);
    const collect = (chunks, chunk) => {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) { child.kill('SIGKILL'); reject(new Error('unexpected unbounded output')); }
      chunks.push(chunk);
    };
    child.stdout.on('data', chunk => collect(out, chunk));
    child.stderr.on('data', chunk => collect(err, chunk));
    child.stdout.on('end', () => { stdoutEnded = true; });
    child.stderr.on('end', () => { stderrEnded = true; });
    child.on('exit', () => { exitSeen = true; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(drain); clearTimeout(deadline);
      resolve({ code, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err),
        stdoutEnded, stderrEnded, exitSeen, ms: Date.now() - started });
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    if (pause) child.stdout.pause();
    if (brokenPipe) child.stdout.destroy();
    child.stdin.end(input);
  });
}

const diff = count => Array.from({ length: count }, (_, n) => {
  const path = `src/cliTail${String(n).padStart(5, '0')}_${'x'.repeat(100)}.ts`;
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;
}).join('');

test('#862 real smoke-select delivers complete JSON to fast and finitely slow readers', async () => {
  for (const [count, pause] of [[1, 0], [1500, 0], [1500, 750]]) {
    const input = diff(count);
    const expected = Buffer.from(`${JSON.stringify(selectSmokes(input), null, 2)}\n`);
    if (count > 1) assert.ok(expected.length > 300000, 'larger than a POSIX pipe');
    const actual = await runNode(['scripts/smoke-select.mjs', '--diff', '-', '--json'], { input, pause });
    assert.equal(actual.code, 0);
    assert.equal(actual.signal, null);
    assert.ok(actual.exitSeen && actual.stdoutEnded && actual.stderrEnded, 'exit and both EOFs observed');
    assert.equal(actual.stderr.length, 0);
    assert.equal(actual.stdout.length, expected.length, `${count} files / ${pause}ms reader delay`);
    assert.deepEqual(actual.stdout, expected);
    assert.deepEqual(JSON.parse(actual.stdout), JSON.parse(expected));
  }
});

test('#862 error entry points keep codes, complete stderr and no success stdout', async () => {
  const cases = [
    ['smoke-select', [], 2, /^использование:.*<файл\|->\n$/s],
    ['model-invariants', [], 2, /^использование:.*\[--json\]\n$/s],
    ['mutation-nightly-reuse', [], 2, /^usage:.*--event=\n$/s],
    ['docs-accept', ['--identical', '--reviewed'], 2, /^отказ:.*приёмка артефакта\n$/s],
    ['process-gate', ['--range', 'hp862-no-such-ref..HEAD'], 2, /^git log .*hp862-no-such-ref.*\n$/s],
    ['no-new-any', ['--base', 'hp862-no-such-ref'], 2, /^git diff .*hp862-no-such-ref.*\n$/s],
    ['no-new-private-writes', ['--base', 'hp862-no-such-ref'], 2, /^git diff .*hp862-no-such-ref.*\n$/s],
    ['capture-determinism', [], 1, /::error::environment failure \(browser-attestation\).*\n$/s],
  ];
  for (const [name, args, code, diagnostic] of cases) {
    const env = name === 'capture-determinism' ? { PLAYWRIGHT_BROWSERS_PATH: `${ROOT}/artifacts/hp862-no-browser` } : {};
    const actual = await runNode([`scripts/${name}.mjs`, ...args], { env });
    assert.equal(actual.code, code, name);
    assert.equal(actual.stdout.length, 0, name);
    assert.match(actual.stderr.toString(), diagnostic, name);
    assert.ok(actual.stderrEnded && actual.exitSeen, name);
  }
});

// Windows closes anonymous pipe handles differently; POSIX EPIPE is the
// acceptance surface for this case, not a fabricated native Windows oracle.
test('#862 a closed output pipe does not turn a failed write into success', { skip: process.platform === 'win32' }, async () => {
  const actual = await runNode(['scripts/smoke-select.mjs', '--diff', '-', '--json'], {
    input: diff(1500), brokenPipe: true,
  });
  assert.notEqual(actual.code, 0);
  assert.match(actual.stderr.toString(), /EPIPE|ERR_STREAM_DESTROYED/);
});

test('#862 witness deadline rejects a deliberately live handle and kills its child', async () => {
  await assert.rejects(runNode(['-e', 'setInterval(() => {}, 1000)'], { timeout: 500 }), /CLI timeout/);
});
