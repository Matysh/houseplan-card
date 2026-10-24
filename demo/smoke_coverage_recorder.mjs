// #1018: actual Chromium coverage lifecycle belongs to the selected browser
// lane. Its Node-only counterpart remains in the no-browser tooling units.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { walkFiles } from '../scripts/coverage-identity.mjs';

const root = process.cwd(), dir = mkdtempSync(resolve(tmpdir(), 'hp-coverage-browser-'));
try {
  mkdirSync(resolve(dir, 'test-build'));
  writeFileSync(resolve(dir, 'test-build/probe.js'), 'export function probe(flag) { return flag ? 41 : 42; }\n');
  // Resolve the pinned package from the checkout while keeping fixture output
  // isolated from the candidate's real dist/test-build.
  const playwright = pathToFileURL(resolve(root, 'node_modules/playwright/index.mjs')).href;
  const harness = pathToFileURL(resolve(root, 'demo/serve.mjs')).href;
  const entry = `import { chromium } from ${JSON.stringify(playwright)};
    import { watchPage, reportPageErrors } from ${JSON.stringify(harness)};
    import { probe } from './test-build/probe.js';
    if(probe(true)!==41)throw Error('probe');
    const browser=await chromium.launch({headless:true});
    const context=await browser.newContext();const one=watchPage(await context.newPage());
    await one.goto('data:text/html,<script>function before(){return 1}before()</script>');
    await one.goto('data:text/html,<script>function after(){return 2}after()</script>');
    const two=watchPage(await browser.newPage());await two.setContent('<script>function second(){return 3}second()</script>');
    await two.route('http://probe.local/test-build/probe.js*',route=>route.fulfill({contentType:'text/javascript',
      headers:{'access-control-allow-origin':'*'},body:'export function probe(flag) { return flag ? 41 : 42; }\\n'}));
    await two.evaluate(async()=>{for(const query of ['first=1','retry=2']){
      const module=await import('http://probe.local/test-build/probe.js?'+query);if(module.probe(true)!==41)throw Error('retry');}});
    await one.close();await browser.close();
    if (await reportPageErrors()) throw new Error('uncaught browser exception');`;
  writeFileSync(resolve(dir, 'package.json'), '{"type":"module"}');
  writeFileSync(resolve(dir, 'probe.mjs'), entry);
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(resolve(root, 'scripts/coverage-preload.mjs')).href, 'probe.mjs'], {
    cwd: dir, encoding: 'utf8', timeout: 50000,
    env: { ...process.env, HP_DIAGNOSTIC_COVERAGE: '1', HP_COVERAGE_DIR: resolve(dir, 'raw'),
      HP_COVERAGE_CASE: 'browser-fixture', NODE_V8_COVERAGE: resolve(dir, 'raw') },
  });
  assert.equal(result.status, 0, `${result.stdout || ''}\n${result.stderr || ''}`);
  assert.equal(result.signal, null);
  assert.equal(result.error, undefined);
  const files = walkFiles(resolve(dir, 'raw'));
  const meta = JSON.parse(readFileSync(files.find(p => /recorder-/.test(p)), 'utf8'));
  assert.deepEqual(meta.issues, []); assert.equal(meta.pages.length, 2);
  assert.ok(meta.pages.every(p => p.early && p.saved));
  assert.equal(meta.browsers.length, 1); assert.equal(meta.browsers[0].attestation.ok, true);
  assert.equal(meta.exitCode, 0); assert.ok(meta.ended >= meta.started);
  const browser = files.filter(p => basename(p).startsWith('browser-'))
    .flatMap(p => JSON.parse(readFileSync(p, 'utf8')).entries);
  for (const name of ['before', 'after', 'second']) assert.ok(browser.some(e => e.source.includes(`function ${name}()`)), name);
  const retries = browser.filter(e => e.url.startsWith('http://probe.local/test-build/probe.js?'));
  assert.equal(retries.length, 2); assert.equal(retries[0].source, retries[1].source);
  const sources = JSON.parse(readFileSync(files.find(p => /node-sources-/.test(p)), 'utf8')).sources;
  assert.ok(Object.values(sources).some(s => s.source.includes('export function probe(')));
  const native = files.filter(p => /coverage-\d+-\d+-\d+\.json$/.test(p)).flatMap(p => JSON.parse(readFileSync(p, 'utf8')).result);
  const script = native.find(s => s.url.endsWith('/test-build/probe.js'));
  assert.ok(script); assert.equal(sources[script.scriptId].source, 'export function probe(flag) { return flag ? 41 : 42; }\n');
  const checkNames = ['child exits successfully', 'no recorder issues', 'both direct pages registered before content',
    'pages saved before close', 'launched Chromium attested', 'before/after navigation and second-page source retained',
    'both query retries retain identical actual bytes', 'actual Node source retained', 'native Node coverage bound to exact source',
    'recorder finalized at exit'];
  console.log(JSON.stringify({ checkNames, checks: Object.fromEntries(checkNames.map(name => [name, true])),
    browser: meta.browsers[0].attestation }, null, 2));
} finally {
  // Only the resolved absolute directory returned by mkdtemp is removable.
  assert.ok(dir.startsWith(resolve(tmpdir(), 'hp-coverage-browser-')));
  rmSync(dir, { recursive: true, force: true });
}
