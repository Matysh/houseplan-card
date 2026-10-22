import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { unitGroups, groupsAffectedBy } from '../scripts/unit-groups.mjs';
import { requiredUnitGroups } from '../scripts/gate-small.mjs';
import { execFileSync } from 'node:child_process';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'hp-unit-partition-982-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
  }
  return root;
}

test('#982 import closure changes the partition in both directions without an allowlist', t => {
  const root = fixture(t, {
    'test/case.test.mjs': "import '../scripts/subject.mjs';",
    'scripts/subject.mjs': 'export const result = 1;',
    'src/product.ts': 'export const result = 2;',
  });
  assert.deepEqual(unitGroups(root).tooling, ['test/case.test.mjs']);
  writeFileSync(join(root, 'scripts/subject.mjs'), "import '../src/product.ts';");
  assert.deepEqual(unitGroups(root).product, ['test/case.test.mjs']);
  assert.deepEqual(unitGroups(root).tooling, []);
  writeFileSync(join(root, 'scripts/subject.mjs'), 'export const result = 1;');
  assert.deepEqual(unitGroups(root).tooling, ['test/case.test.mjs']);
});

test('#982 no repository inputs, unreadable imports, and empty fixtures refuse classification', t => {
  const root = fixture(t, { 'test/case.test.mjs': "import assert from 'node:assert/strict'; assert.equal(1,1);" });
  assert.throws(() => unitGroups(root), /unclassified.*case.test.mjs/);
  writeFileSync(join(root, 'test/case.test.mjs'), "import '../scripts/missing.mjs';");
  assert.throws(() => unitGroups(root), /unclassified/);
});

test('#982 actual source reads and cache-busted imports require product build; fixture strings do not', t => {
  const root = fixture(t, {
    'test/read.test.mjs': "import {readFileSync} from 'node:fs'; readFileSync(new URL('../src/product.ts', import.meta.url));",
    'test/dynamic.test.mjs': 'import(new URL(`../test-build/product.js?case=${Date.now()}`, import.meta.url));',
    'test/tool.test.mjs': "import '../scripts/subject.mjs'; const fixture = \"import '../src/product.ts'; new URL('../src/product.ts', import.meta.url);\";",
    'test/opaque.test.mjs': "import '../scripts/subject.mjs'; import(runtimePath);",
    'scripts/subject.mjs': 'export const result = 1;',
    'src/product.ts': 'export const result = 2;',
  });
  const g = unitGroups(root);
  assert.deepEqual(g.product, ['test/dynamic.test.mjs', 'test/opaque.test.mjs', 'test/read.test.mjs']);
  assert.deepEqual(g.tooling, ['test/tool.test.mjs']);
});

test('#982 canonical mutation-registry leaf contains patch data, not imports of the real product', t => {
  const root = fixture(t, {
    'test/registry.test.mjs': "import '../scripts/mutation-registry.mjs';",
    'scripts/mutation-registry.mjs': "export const patches = [{ find: \"new URL('../src/product.ts', import.meta.url)\" }];",
    'src/product.ts': 'export const value = 1;',
  });
  const g = unitGroups(root);
  assert.deepEqual(g.product, []);
  assert.deepEqual(g.tooling, ['test/registry.test.mjs']);
  assert.ok(g.dependencies['test/registry.test.mjs'].includes('scripts/mutation-registry.mjs'));
  assert.ok(!g.dependencies['test/registry.test.mjs'].includes('src/product.ts'));
});

test('#1016 untracked compiled-output readers need the producer, including transitive tools', t => {
  const root = fixture(t, {
    'test/budget.test.mjs': "import '../scripts/wrapper.mjs';",
    'scripts/wrapper.mjs': "import './budget.mjs';",
    'scripts/budget.mjs': "import {readFileSync} from 'node:fs'; readFileSync('dist/houseplan-assets.json');",
    'test/metadata.test.mjs': "import '../scripts/metadata.mjs';",
    'scripts/metadata.mjs': 'export const outputs=["dist/**", "test-build/**", "readFileSync(\'dist/data.json\')"];',
  });
  // There is deliberately no dist or test-build, tracked or on disk.
  for (const code of [
    "import {readFileSync} from 'node:fs'; readFileSync('dist/houseplan-assets.json');",
    "import fs from 'node:fs'; fs.readFileSync('./dist/chunk.js');",
    "import {readFileSync} from 'node:fs'; readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url));",
    "import {readFileSync} from 'node:fs'; readFileSync(new URL('../test-build/model.js', import.meta.url));",
  ]) {
    writeFileSync(join(root, 'scripts/budget.mjs'), code);
    const g = unitGroups(root);
    assert.deepEqual(g.product, ['test/budget.test.mjs']);
    assert.deepEqual(g.tooling, ['test/metadata.test.mjs']);
    assert.ok(g.ownership['test/budget.test.mjs'].code.includes('scripts/budget.mjs'));
  }
});

test('#982 a tool inspects source as data; importing that source or a test-owned read needs the producer', t => {
  const root = fixture(t, {
    'test/tool.test.mjs': "import '../scripts/subject.mjs';",
    'test/source.test.mjs': "import {readFileSync} from 'node:fs'; readFileSync(new URL('../src/product.ts', import.meta.url));",
    'test/mixed.test.mjs': "import '../scripts/subject.mjs'; import {readFileSync} from 'node:fs'; readFileSync(new URL('../src/product.ts', import.meta.url));",
    'scripts/subject.mjs': "import {readFileSync} from 'node:fs'; export const text=readFileSync(new URL('../src/product.ts', import.meta.url));",
    'src/product.ts': 'export const value = 1;',
  });
  let g = unitGroups(root);
  assert.deepEqual(g.tooling, ['test/mixed.test.mjs', 'test/tool.test.mjs']);
  assert.deepEqual(g.product, ['test/source.test.mjs']);
  writeFileSync(join(root, 'scripts/subject.mjs'), "import '../src/product.ts';");
  g = unitGroups(root);
  assert.deepEqual(g.tooling, []);
  assert.deepEqual(g.product, ['test/mixed.test.mjs', 'test/source.test.mjs', 'test/tool.test.mjs']);
});

test('#982 computed CLI tables follow their actual runtime imports before choosing a no-build job', t => {
  const root = fixture(t, {
    'test/cli.test.mjs': "import {spawn} from 'node:child_process'; const cases=['production-cli']; for(const name of cases) spawn(process.execPath,[`scripts/${name}.mjs`]);",
    'scripts/production-cli.mjs': "import '../test-build/product.js';",
    'src/product.ts': 'export const value = 1;',
  });
  assert.deepEqual(unitGroups(root).product, ['test/cli.test.mjs']);
  assert.deepEqual(unitGroups(root).tooling, []);
});

test('#982 every real unit belongs to the required union, including new files', () => {
  const g = unitGroups();
  assert.deepEqual([...new Set([...g.product, ...g.tooling])].sort(), g.tests);
  assert.equal(g.product.length + g.tooling.length, g.tests.length);
  assert.ok(g.product.length && g.tooling.length);
  assert.ok(g.tooling.includes('test/unit-groups.test.mjs'));
  assert.ok(g.product.includes('test/device-issues.test.mjs'));
  assert.ok(g.product.includes('test/wall-node-bundle.test.mjs'), 'real bundle budget must never run in the no-build tooling lane');
  assert.deepEqual(groupsAffectedBy(['src/device-issues.ts'], g), ['product']);
  assert.deepEqual(groupsAffectedBy(['scripts/task-packet.mjs'], g), ['tooling']);
  assert.deepEqual(groupsAffectedBy(['docs/DEVELOPMENT.md'], g), []);
  assert.deepEqual(groupsAffectedBy(['unmapped-input.xyz'], g), ['product', 'tooling']);
  assert.deepEqual(groupsAffectedBy(['package-lock.json'], g), ['product', 'tooling']);
  // Selector input is data, not an invocation of the production CLI.
  const modelTool = ['scripts', 'model-invariants.mjs'].join('/');
  assert.ok(groupsAffectedBy([modelTool], g).includes('product'));
  const productTools = [...new Set(g.product.flatMap(t => g.dependencies[t]))].filter(p => p.startsWith('scripts/'));
  assert.ok(productTools.length > 0);
  for (const tool of productTools) assert.ok(groupsAffectedBy([tool], g).includes('product'), `lost product consumer: ${tool}`);
  assert.deepEqual(groupsAffectedBy(['scripts/new-unowned.mjs'], g), ['product', 'tooling']);
});

test('#982 required local gate observes the real git diff and untracked tests; unknown range fails closed', t => {
  const root = fixture(t, {
    'test/tool.test.mjs': "import '../scripts/subject.mjs';",
    'test/product.test.mjs': "import '../src/product.ts';",
    'scripts/subject.mjs': 'export const result = 1;',
    'src/product.ts': 'export const result = 2;',
  });
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { stdio: 'pipe' });
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), []);
  writeFileSync(join(root, 'src/product.ts'), 'export const result = 3;');
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['product']);
  writeFileSync(join(root, 'src/product.ts'), 'export const result = 2;');
  writeFileSync(join(root, 'scripts/subject.mjs'), 'export const result = 3;');
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['tooling']);
  writeFileSync(join(root, 'test/new.test.mjs'), "import '../src/product.ts';");
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['product', 'tooling']);
  assert.deepEqual(requiredUnitGroups(root, 'missing-base'), ['product', 'tooling']);
});

test('#982 r1: the real local diff includes product tests importing a tool, including transitive shared tools', t => {
  const root = fixture(t, {
    'test/tool.test.mjs': "import '../scripts/shared.mjs';",
    'test/product.test.mjs': "import '../src/product.ts'; import '../scripts/helper.mjs';",
    'scripts/helper.mjs': "import './shared.mjs'; export const value = 1;",
    'scripts/shared.mjs': 'export const result = 1;',
    'src/product.ts': 'export const result = 2;',
  });
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { stdio: 'pipe' });
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');
  writeFileSync(join(root, 'scripts/shared.mjs'), 'export const result = 3;');
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['product', 'tooling']);
  writeFileSync(join(root, 'scripts/shared.mjs'), 'export const result = 1;');
  writeFileSync(join(root, 'scripts/helper.mjs'), "import './shared.mjs'; export const value = 2;");
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['product']);
  writeFileSync(join(root, 'scripts/new-unowned.mjs'), 'export const value = 4;');
  assert.deepEqual(requiredUnitGroups(root, 'HEAD'), ['product', 'tooling']);
});
