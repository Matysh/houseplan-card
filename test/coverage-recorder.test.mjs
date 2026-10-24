import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { identifyScript, digestBytes, walkFiles } from '../scripts/coverage-identity.mjs';
import { replacementEdits } from '../scripts/coverage-maps.mjs';

test('retry queries are deduplicated only after actual bytes match', () => {
  const index = { files: [{ path: 'dist/card.js', jsHash: digestBytes('candidate') }] };
  assert.equal(identifyScript(index, { url: 'https://demo/card.js?retry=2', source: 'candidate' }).status, 'verified');
  assert.equal(identifyScript(index, { url: 'https://demo/card.js', source: 'foreign' }).status, 'unknown');
  assert.equal(identifyScript(index, { url: 'https://demo/card.js' }).status, 'unknown');
});
test('mapped replacement uses native substitution semantics', () => {
  for (const replacement of ['$10', '$01', '$99', '$0', '$&-$`-$\'-$1-$$']) {
    assert.equal(replacementEdits('abc', /(b)/, replacement).code, 'abc'.replace(/(b)/, replacement));
  }
});
test('opt-in preload captures actual Node source and flushes native coverage on exit without a browser', { timeout: 60000 }, () => {
  const root = process.cwd(), dir = mkdtempSync(resolve(tmpdir(), 'hp-coverage-'));
  try {
    mkdirSync(resolve(dir, 'test-build'));
    writeFileSync(resolve(dir, 'test-build/probe.js'), 'export function probe(flag) { return flag ? 41 : 42; }\n');
    // The real browser/navigation/retry contract runs in the selected browser
    // job as smoke_coverage_recorder, rather than requiring Chromium in #982's
    // no-browser tooling partition. This unit retains actual Node recording.
    const entry = `import { probe } from './test-build/probe.js';
      if(probe(true)!==41 || probe(false)!==42)throw Error('probe');`;
    writeFileSync(resolve(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(resolve(dir, 'probe.mjs'), entry);
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(resolve(root, 'scripts/coverage-preload.mjs')).href, 'probe.mjs'], {
      cwd: dir, encoding: 'utf8', timeout: 50000,
      env: { ...process.env, HP_DIAGNOSTIC_COVERAGE: '1', HP_COVERAGE_DIR: resolve(dir, 'raw'),
        HP_COVERAGE_CASE: 'fixture', NODE_V8_COVERAGE: resolve(dir, 'raw') },
    });
    assert.equal(result.status, 0, result.stderr);
    const files = walkFiles(resolve(dir, 'raw'));
    const meta = JSON.parse(readFileSync(files.find(p => /recorder-/.test(p)), 'utf8'));
    assert.deepEqual(meta.issues, []); assert.deepEqual(meta.pages, []);
    assert.deepEqual(meta.browsers, []); assert.equal(meta.exitCode, 0);
    assert.ok(meta.ended >= meta.started);
    const sources = JSON.parse(readFileSync(files.find(p => /node-sources-/.test(p)), 'utf8')).sources;
    assert.ok(Object.values(sources).some(s => s.source.includes('export function probe(')));
    const native = files.filter(p => /coverage-\d+-\d+-\d+\.json$/.test(p)).flatMap(p => JSON.parse(readFileSync(p, 'utf8')).result);
    const script = native.find(s => s.url.endsWith('/test-build/probe.js'));
    assert.ok(script); assert.equal(sources[script.scriptId].source, 'export function probe(flag) { return flag ? 41 : 42; }\n');
  } finally {
    // mkdtemp's verified, absolute fixture directory is the only removal target.
    assert.ok(dir.startsWith(resolve(tmpdir(), 'hp-coverage-'))); rmSync(dir, { recursive: true, force: true });
  }
});
