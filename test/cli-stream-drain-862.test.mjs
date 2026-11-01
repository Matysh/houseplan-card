import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';


const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Resume independently of exit: waiting for exit before draining would deadlock
// a correctly backpressured CLI. A deadline belongs to this witness, not the CLI.
function runNode(args, { input = '', pause = 0, timeout = 15000, env = {}, brokenPipe = false, brokenStderr = false } = {}) {
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
    child.on('error', error => { clearTimeout(drain); clearTimeout(deadline); child.kill(); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(drain); clearTimeout(deadline);
      resolve({ code, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err),
        stdoutEnded, stderrEnded, exitSeen, ms: Date.now() - started });
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') { child.kill(); reject(error); } });
    if (pause) child.stdout.pause();
    if (brokenPipe) child.stdout.destroy();
    if (brokenStderr) child.stderr.destroy();
    child.stdin.end(input);
  });
}

const diff = count => Array.from({ length: count }, (_, n) => {
  const path = `src/cliTail${String(n).padStart(5, '0')}_${'x'.repeat(100)}.ts`;
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`;
}).join('');

test('#862 async completion cannot overwrite an earlier stdout/stderr write failure', { skip: process.platform === 'win32' }, async () => {
  for (const stream of ['stdout', 'stderr']) {
    const source = `import { guardCliOutput } from './scripts/cli-output.mjs';
      const finish = guardCliOutput();
      console.${stream === 'stdout' ? 'log' : 'error'}('x'.repeat(512000));
      await new Promise(resolve => setTimeout(resolve, 40)); finish(0);`;
    const actual = await runNode(['--input-type=module', '-e', source], {
      brokenPipe: stream === 'stdout', brokenStderr: stream === 'stderr',
    });
    assert.equal(actual.code, 1, stream);
    assert.equal(actual.signal, null, stream);
  }
});

test('#862 a large stderr report drains completely and retains a pre-existing failure code', async () => {
  const source = `import { guardCliOutput } from './scripts/cli-output.mjs';
    const finish = guardCliOutput(); console.error('x'.repeat(512000)); finish(2);`;
  const actual = await runNode(['--input-type=module', '-e', source]);
  assert.equal(actual.code, 2);
  assert.deepEqual(actual.stderr, Buffer.from(`${'x'.repeat(512000)}\n`));
  assert.equal(actual.stdout.length, 0);
  assert.ok(actual.stderrEnded && actual.exitSeen);
});

test('#862 witness deadline rejects a deliberately live handle and kills its child', async () => {
  await assert.rejects(runNode(['-e', 'setInterval(() => {}, 1000)'], { timeout: 500 }), /CLI timeout/);
});
