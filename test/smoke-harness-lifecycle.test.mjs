import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// #776: execute the public harness API in an isolated process. Fake pages own
// delivery order, not the verdict: no Chromium, timer races or source matching.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVE_URL = new URL('../demo/serve.mjs', import.meta.url).href;
const PRELUDE = `
  import assert from 'node:assert/strict';
  import { EventEmitter } from 'node:events';
  import { check, finish, reportPageErrors, watchPage } from ${JSON.stringify(SERVE_URL)};
  const makePage = (evaluate = async () => 0) => {
    const page = new EventEmitter();
    page.evaluate = evaluate;
    return watchPage(page);
  };
`;

function runHarness(body, expectedExit) {
  const complete = 'HARNESS_SCENARIO_COMPLETED';
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval',
    PRELUDE + body + `\nconsole.log(${JSON.stringify(complete)});`], {
    cwd: ROOT, encoding: 'utf8', timeout: 15_000,
  });
  const output = `${child.stdout || ''}${child.stderr || ''}`;
  assert.equal(child.error, undefined, `harness subprocess failed to run: ${child.error}\n${output}`);
  assert.equal(child.signal, null, `harness subprocess was interrupted: ${child.signal}\n${output}`);
  // An assertion inside a negative case also exits 1: require normal completion
  // so it cannot impersonate the guard's expected nonzero exit.
  assert.match(child.stdout, new RegExp(`^${complete}\\r?$`, 'm'), output);
  assert.equal(child.status, expectedExit, output);
  return output.replace(new RegExp(`^${complete}\\r?\\n`, 'm'), '');
}

function hasExceptionVerdict(output, count) {
  assert.match(output, new RegExp(`^(?:  - |FAILED: )${count} uncaught exception\\(s\\) inside the card\\r?$`, 'm'));
  assert.doesNotMatch(output, /^OK\r?$/m, 'an exception verdict must not also claim success');
}

test('#776 finish includes a pageerror delivered during awaited browser close', () => {
  const output = runHarness(`
    const page = makePage();
    const browser = { close: async () => {
      await Promise.resolve();
      page.emit('pageerror', new Error('guard-tail-rejection'));
      page.emit('close');
    } };
    await finish(browser, { probe: 'async close delivery' });
  `, 1);
  assert.match(output, /EXC Error: guard-tail-rejection/);
  hasExceptionVerdict(output, 1);
});

test('#776 finish counts every watched page across round-trip and close exactly once', () => {
  const calls = ['drain:first', 'drain:second', 'close'];
  const output = runHarness(`
    const calls = [];
    const first = makePage(async () => {
      calls.push('drain:first');
      first.emit('pageerror', new Error('first-page-drain'));
    });
    const second = makePage(async () => {
      calls.push('drain:second');
      second.emit('pageerror', new Error('second-page-drain'));
    });
    await finish({ close: async () => {
      calls.push('close');
      await Promise.resolve();
      second.emit('pageerror', new Error('second-page-close'));
      first.emit('close');
      second.emit('close');
    } });
    assert.deepEqual(calls, ${JSON.stringify(calls)});
  `, 1);
  hasExceptionVerdict(output, 3);
  assert.equal((output.match(/uncaught exception\(s\) inside the card/g) || []).length, 1);
});

test('#776 clean finish drains registered pages before closing and keeps exit zero', () => {
  const output = runHarness(`
    const calls = [];
    const page = makePage(async () => { calls.push('drain'); });
    await finish({ close: async () => {
      await Promise.resolve();
      calls.push('close');
      page.emit('close');
    } }, { probe: 'clean' });
    assert.deepEqual(calls, ['drain', 'close']);
  `, 0);
  assert.match(output, /^OK\r?$/m);
  assert.doesNotMatch(output, /FAILED|EXC/);
});

test('#776 closed pages leave the registry and finish accepts no browser', () => {
  const output = runHarness(`
    let reads = 0;
    const page = makePage(async () => { reads++; });
    page.emit('close');
    await finish(undefined, { probe: 'already closed' });
    assert.equal(reads, 0);
  `, 0);
  assert.match(output, /^OK\r?$/m);
  assert.doesNotMatch(output, /FAILED|EXC/);
});

test('#776 a closing-page round-trip rejection does not fabricate a card exception', () => {
  const output = runHarness(`
    let reads = 0;
    const page = makePage(async () => {
      reads++;
      page.emit('close');
      throw new Error('page closed while round-trip was pending');
    });
    await finish();
    assert.equal(reads, 1);
  `, 0);
  assert.match(output, /^OK\r?$/m);
  assert.doesNotMatch(output, /FAILED|EXC/);
});

test('#776 finish without a browser still reports errors delivered by its round-trip', () => {
  const output = runHarness(`
    const page = makePage(async () => {
      await Promise.resolve();
      page.emit('pageerror', new Error('round-trip-without-browser'));
    });
    await finish();
  `, 1);
  hasExceptionVerdict(output, 1);
});

test('#776 finish preserves ordinary assertion failures through clean async close', () => {
  const output = runHarness(`
    const page = makePage();
    check('retained-assertion', false);
    await finish({ close: async () => {
      await Promise.resolve();
      page.emit('close');
    } });
  `, 1);
  assert.match(output, /retained-assertion: expected true, got false/);
  assert.doesNotMatch(output, /uncaught exception|^OK\r?$/m);
});

test('#776 reportPageErrors independently awaits delivery and returns the failure verdict', () => {
  const output = runHarness(`
    const page = makePage(async () => {
      await Promise.resolve();
      page.emit('pageerror', new Error('reporter-drain'));
    });
    assert.equal(await reportPageErrors(), true);
    page.emit('close');
  `, 1);
  hasExceptionVerdict(output, 1);
});

test('#776 reportPageErrors independently keeps a clean closed page quiet', () => {
  const output = runHarness(`
    let reads = 0;
    const page = makePage(async () => { reads++; });
    assert.equal(await reportPageErrors(), false);
    page.emit('close');
    assert.equal(await reportPageErrors(), false);
    assert.equal(reads, 1);
  `, 0);
  assert.equal(output, '');
});
