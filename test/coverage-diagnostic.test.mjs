import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { patchImports } from '../scripts/fix-test-build.mjs';
import { lineOffsets, positionAt } from '../scripts/coverage-maps.mjs';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { editMappedSource } from '../scripts/coverage-maps.mjs';
import { indexGeneratedFiles, digestBytes } from '../scripts/coverage-identity.mjs';
import { buildCoverageReport, diagnosticCompleteness } from '../scripts/coverage-report.mjs';
import { historicalCandidates } from '../scripts/parallel-path-audit.mjs';
import { runInvocation } from '../scripts/coverage-diagnostic.mjs';
import { coverageInventory } from '../scripts/coverage-inventory.mjs';
import { unitGroups } from '../scripts/unit-groups.mjs';
import { readdirSync } from 'node:fs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import YAML from 'yaml';

const fixture = t => {
  const dir = mkdtempSync(resolve(tmpdir(), 'hp-diagnostic-'));
  t.after(() => { assert.ok(dir.startsWith(resolve(tmpdir(), 'hp-diagnostic-'))); rmSync(dir, { recursive: true, force: true }); });
  return dir;
};
test('computed scope is the entire existing product unit, smoke and golden inventories', () => {
  const inventory = coverageInventory();
  assert.deepEqual(inventory.cases.filter(c => c.family === 'unit').map(c => c.script), unitGroups().product);
  assert.deepEqual(inventory.cases.filter(c => c.family === 'smoke').map(c => c.script),
    readdirSync('demo').filter(p => /^smoke_.*\.mjs$/.test(p)).sort().map(p => `demo/${p}`));
  assert.deepEqual(inventory.cases.filter(c => c.family === 'golden').map(c => c.variant), GOLDEN_SCENARIOS);
  const canonicalSeconds = Number(readFileSync(inventory.smokeTimeout.source, 'utf8')
    .match(/timeout --kill-after=\d+s (\d+)s node "\$f"/)[1]);
  assert.equal(inventory.smokeTimeout.milliseconds, canonicalSeconds * 1000);
  assert.ok(inventory.cases.filter(c => c.family === 'smoke').every(c => c.timeoutMs === canonicalSeconds * 1000));
});
test('mapped V8 merger preserves family columns, actual retry identity, native branches and unknown incomplete zeros', t => {
  const root = fixture(t), artifactDir = resolve(root, 'artifacts'), text = 'export function yes(flag){return flag ? 1 : 2;}\n';
  for (const dir of ['src', 'test-build', 'artifacts/cases/0']) mkdirSync(resolve(root, dir), { recursive: true });
  writeFileSync(resolve(root, 'src/probe.ts'), text); writeFileSync(resolve(root, 'test-build/probe.js'), text);
  writeFileSync(resolve(root, 'test-build/probe.js.map'), JSON.stringify(editMappedSource(text, [], { id: '../src/probe.ts' }).map));
  const index = indexGeneratedFiles({ root, paths: ['test-build/probe.js'], artifactDir, identity: { sha: 'a'.repeat(40) } });
  assert.equal(index.valid, true);
  const raw = { entries: [{ url: pathToFileURL(resolve(root, 'test-build/probe.js')).href + '?retry=2', source: text,
    functions: [{ functionName: 'yes', isBlockCoverage: true, ranges: [{ startOffset: 7, endOffset: text.length - 1, count: 1 },
      { startOffset: text.indexOf('2;'), endOffset: text.indexOf('2;') + 1, count: 0 }] }] }] };
  const file = (path, value) => writeFileSync(resolve(artifactDir, 'cases/0', path), JSON.stringify(value));
  file('browser-1-0-1-1.json', raw); file('recorder-1-0.json', { ended: 1, exitCode: 0, issues: [],
    pages: [{ early: true, saved: true, raw: ['browser-1-0-1-1.json'] }] });
  const inventory = { digest: 'fixture', cases: [{ id: 'smoke:probe' }] };
  const invocation = () => [{ id: 'smoke:probe', family: 'smoke', status: 'completed', directory: 'cases/0', issues: [] }];
  const report = buildCoverageReport({ root, artifactDir, inventory, invocations: invocation(), index });
  assert.equal(report.completeness.complete, true);
  assert.equal(report.functions[0].smoke, 'observed'); assert.equal(report.functions[0].unit, 'unknown');
  assert.ok(report.observedScripts.some(s => s.status === 'verified' && s.family === 'smoke'));
  assert.equal(report.invocations[0].pages.length, 1);
  assert.equal(report.nativeMappedRanges.find(r => r.kind === 'branch').smoke.status, 'zero-observed');
  const missing = { ...inventory, cases: [...inventory.cases, { id: 'missing' }] };
  const partial = buildCoverageReport({ root, artifactDir, inventory: missing, invocations: invocation(), index });
  assert.equal(partial.completeness.complete, false);
  assert.equal(partial.functions[0].smoke, 'observed');
  assert.equal(partial.nativeMappedRanges.find(r => r.kind === 'branch').smoke.status, 'unknown');
  file('recorder-1-0.json', { ended: 1, exitCode: 0, issues: [], pages: [{ early: false, saved: false }] });
  assert.equal(buildCoverageReport({ root, artifactDir, inventory, invocations: invocation(), index }).completeness.complete, false);
  file('recorder-1-0.json', { ended: 1, exitCode: 0, issues: [], pages: [{ early: true, saved: true, raw: ['browser-1-0-1-1.json'] }] });
  raw.entries[0].source += '//foreign'; file('browser-1-0-1-1.json', raw);
  const foreign = buildCoverageReport({ root, artifactDir, inventory, invocations: invocation(), index });
  assert.equal(foreign.completeness.complete, false); assert.equal(foreign.functions[0].smoke, 'unknown');
  raw.entries[0].source = text; file('browser-1-0-1-1.json', raw);
  file('node-sources-101-2.json', { pid: 101, threadId: 2, sources: { 4: { source: text } } });
  file('coverage-101-123-2.json', { result: [{ ...raw.entries[0], scriptId: '4' }] });
  const node = buildCoverageReport({ root, artifactDir, inventory, invocations: invocation().map(c => ({ ...c, family: 'unit' })), index });
  assert.equal(node.functions[0].unit, 'observed');
  writeFileSync(resolve(root, 'src/probe.ts'), text + '// changed after capture');
  const stale = buildCoverageReport({ root, artifactDir, inventory, invocations: invocation(), index });
  assert.equal(stale.completeness.complete, false); assert.equal(stale.functions[0].smoke, 'unknown');
  writeFileSync(resolve(root, 'test-build/probe.js.map'), '{}');
  assert.equal(indexGeneratedFiles({ root, paths: ['test-build/probe.js'], identity: {} }).valid, false);
});
test('failed, skipped, duplicated and absent invocations cannot produce complete coverage', () => {
  const expected = { cases: [{ id: 'one' }] }, index = { issues: [] };
  for (const invocations of [[], [{ id: 'one', status: 'failed' }], [{ id: 'one', status: 'skipped' }],
    [{ id: 'one', status: 'completed' }, { id: 'one', status: 'completed' }]]) {
    assert.equal(diagnosticCompleteness(expected, invocations, index).complete, false);
  }
});
test('timeout keeps raw partial artifact and reports timeout rather than product pass', async t => {
  const root = fixture(t), directory = resolve(root, 'case'); mkdirSync(directory);
  const result = await runInvocation({ root, directory, args: ['-e', "require('node:fs').writeFileSync('partial.json','{}');setInterval(()=>{},1000)"],
    env: { ...process.env, HP_DIAGNOSTIC_COVERAGE: '0', NODE_V8_COVERAGE: '' }, timeoutMs: 200, id: 'timeout', family: 'unit', script: '-e' });
  assert.equal(result.status, 'timeout'); assert.equal(readFileSync(resolve(root, 'partial.json'), 'utf8'), '{}');
});
test('Git inventory counts formula on source only, includes seeds outside formula, and separates stable cycles', t => {
  const root = fixture(t), git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['config', 'user.email', 'fixture@example.test']); git(['config', 'user.name', 'Fixture']);
  mkdirSync(resolve(root, 'src/i18n'), { recursive: true });
  const commit = (subject, source) => { writeFileSync(resolve(root, 'src/code.ts'), source); git(['add', '.']); git(['-c', 'core.hooksPath=', 'commit', '-m', subject]); return git(['rev-parse', 'HEAD']); };
  const base = commit('initial', 'one\n'); git(['tag', 'base']);
  const seed = commit('refactor: seed', 'two\n');
  const first = commit('fix: additive guard', 'two\nthree\nfour\nfive\n'); git(['tag', 'stable-one']);
  writeFileSync(resolve(root, 'src/i18n/en.ts'), 'x\n'.repeat(30));
  commit('fix: translations only', 'two\nthree\nfour\nfive\n'); git(['tag', 'stable-two']);
  const last = commit('fix: unreleased guard', 'two\nthree\nfour\nfive\nsix\n');
  const audit = historicalCandidates({ root, base: 'base', stable: ['stable-one', 'stable-two'], candidate: last, seeds: [seed] });
  assert.deepEqual(audit.rows.map(r => r.sha).sort(), [seed, first, last].sort());
  assert.equal(audit.rows.find(r => r.sha === first).cycle, 'stable-one');
  assert.equal(audit.rows.find(r => r.sha === last).cycle, 'unreleased');
  assert.ok(audit.rows.every(r => r.review.decision === 'needs-witness'));
});
test('nightly job uses exact immutable intent with read permissions and unconditional diagnostic upload; no proof wiring', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/_nightly.yml', 'utf8'));
  const job = workflow.jobs['diagnostic-coverage'];
  assert.equal(job['continue-on-error'], true);
  assert.deepEqual(job.permissions, { contents: 'read' }); assert.ok(job['timeout-minutes'] <= 135);
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/upload-artifact'))['timeout-minutes'], 15);
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/checkout')).with.ref, '${{ needs.dispatch.outputs.candidate }}');
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/upload-artifact')).if, 'always()');
  assert.match(job.steps.find(s => s.env?.CANDIDATE).run, /coverage-diagnostic\.mjs --sha=/);
  for (const path of ['scripts/ci-proof-registry.mjs', 'scripts/release-evidence.mjs', 'scripts/mutation-gate.mjs']) {
    try { assert.doesNotMatch(readFileSync(path, 'utf8'), /diagnostic-coverage|coverage-diagnostic/); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
});

test('#1018 AC3 fix-test-build composes extension insertions; normal import bytes remain identical', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-coverage-imports-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = 'const before=112233;import{a}from "./first";import{b}from "./second";const after=445566;';
  const path = join(dir, 'fixture.js');
  writeFileSync(path, input); writeFileSync(`${path}.map`, JSON.stringify(editMappedSource(input, [], { id: 'src/fixture.ts' }).map));
  patchImports(dir, { coverage: true });
  const mapped = { code: readFileSync(path, 'utf8'), map: JSON.parse(readFileSync(`${path}.map`, 'utf8')) };
  for (const token of ['112233', '445566']) {
    const at = positionAt(mapped.code.indexOf(token), lineOffsets(mapped.code));
    const expected = positionAt(input.indexOf(token), lineOffsets(input));
    const found = originalPositionFor(new TraceMap(mapped.map), {line: at.line + 1, column: at.column});
    assert.equal(found.line, expected.line + 1); assert.equal(found.column, expected.column);
  }
  assert.ok(mapped.code.includes('./first.js')); assert.ok(mapped.code.includes('./second.js'));
  writeFileSync(path, input); patchImports(dir, { coverage: false });
  assert.equal(readFileSync(path, 'utf8'), mapped.code);
});
