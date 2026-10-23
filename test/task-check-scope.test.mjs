import test from 'node:test';
import assert from 'node:assert/strict';
import { taskCheckScope, toolingDependencyPaths } from '../scripts/task-check-scope.mjs';
import { profilePaths, profilesForFiles } from '../scripts/ci-profile-paths.mjs';

const sources = {
  'src/led-backlight.ts': 'export const led = 1;',
  'src/plan-optimizer.ts': 'export const optimizer = 1;',
  'src/logic.ts': 'export const logic = 1;',
  'src/junction-limits.ts': 'import "./space-geometry.ts";',
  'src/space-geometry.ts': 'export const geometry = 1;',
  'custom_components/houseplan/junction_limits.py': 'import math',
  'custom_components/houseplan/websocket_api.py': 'import json',
  'tests_backend/test_validation.py': 'read("scripts/config-schema.json")\nread("scripts/sh3d-convert/convert.mjs")',
  'tests_backend/requirements.txt': 'pytest==8.0.0',
  'scripts/config-schema.json': '{}',
  'scripts/sh3d-convert/convert.mjs': 'export const convert = 1;',
  'scripts/gate-reuse.mjs': 'export const protocol = 1;',
  'scripts/check-inputs.mjs': 'export const manifest = 1;',
  'scripts/ci-proof.mjs': 'export const proof = 1;',
  '.github/workflows/validate.yml': 'jobs: {}',
  'test/tooling.test.mjs': 'import "../scripts/check-inputs.mjs";',
  'docs/TESTING.md': '# Tests',
};
const options = {
  tracked: Object.keys(sources), read: file => sources[file] || '',
  profilePaths: {
    docs: ['docs/**', '*.md'], tooling: ['scripts/**', '.github/**', '.githooks/**', 'test/tooling.test.mjs'],
    product: ['**', '!scripts/**', '!.github/**', '!.githooks/**', '!test/tooling.test.mjs', '!docs/**', '!*.md',
      '!dist/**', '!custom_components/houseplan/frontend/**', '!demo/srv/assets/**'],
  },
};
const scope = (files, input = {}, opts = options) => taskCheckScope({ files, ...input }, opts);

test('ordinary frontend and documentation changes do not demand unrelated job families', () => {
  assert.deepEqual(scope(['src/led-backlight.ts']), {
    product: true, tooling: false, backend: false, geometry_parity: false, unknown: [],
  });
  assert.deepEqual(scope(['docs/TESTING.md']), {
    product: false, tooling: false, backend: false, geometry_parity: false, unknown: [],
  });
  assert.deepEqual(scope([]), scope(['docs/TESTING.md']));
});
test('backend selection retains Python, fixtures, requirements and cross-runtime inputs', () => {
  for (const file of ['custom_components/houseplan/websocket_api.py', 'tests_backend/test_validation.py',
    'tests_backend/requirements.txt', 'src/plan-optimizer.ts', 'src/logic.ts', 'scripts/config-schema.json',
    'scripts/sh3d-convert/convert.mjs']) {
    assert.equal(scope([file]).backend, true, file);
  }
});
test('parity follows mirror dependencies without selecting other frontend or backend files', () => {
  for (const file of ['src/junction-limits.ts', 'src/space-geometry.ts', 'custom_components/houseplan/junction_limits.py'])
    assert.equal(scope([file]).geometry_parity, true, file);
  assert.equal(scope(['custom_components/houseplan/websocket_api.py']).geometry_parity, false);
  assert.equal(scope(['src/led-backlight.ts']).geometry_parity, false);
});
test('orchestration-only edits select tooling, actual backend reads still select backend', () => {
  for (const file of ['scripts/check-inputs.mjs', 'scripts/gate-reuse.mjs', 'scripts/ci-proof.mjs', '.github/workflows/validate.yml']) {
    const selected = scope([file]);
    assert.equal(selected.tooling, true, file);
    assert.equal(selected.backend, false, file);
    assert.equal(selected.geometry_parity, false, file);
  }
  const actualRead = { ...options, read: file => file === 'tests_backend/test_validation.py'
    ? 'read("scripts/ci-proof.mjs")' : options.read(file) };
  assert.equal(scope(['scripts/ci-proof.mjs'], {}, actualRead).backend, true,
    'an actual test dependency wins over the orchestration-only exception');
});
test('new and deleted backend files retain their declared job family', () => {
  for (const file of ['custom_components/houseplan/new_module.py', 'tests_backend/test_deleted.py']) {
    const selected = scope([file]);
    assert.equal(selected.backend, true, file);
    assert.equal(selected.geometry_parity, false, file);
    assert.equal(scope([file], {}, { ...options, manifest: { backend: new Set(), geometry_parity: new Set() } }).backend,
      true, file + ': reused tracked manifest cannot erase a new/deleted declared input');
  }
  const newlyImported = { ...options, read: file => file === 'src/junction-limits.ts'
    ? 'import "./new-parity-helper.ts";' : options.read(file) };
  assert.equal(scope(['src/new-parity-helper.ts'], {}, newlyImported).geometry_parity, true);
});
test('unowned executable input widens unit groups, not unrelated browser/HA/parity jobs', () => {
  const selected = scope(['scripts/new-task-helper.mjs']);
  assert.equal(selected.product, true);
  assert.equal(selected.tooling, true);
  assert.equal(selected.backend, false);
  assert.equal(selected.geometry_parity, false);
  assert.deepEqual(selected.unknown, ['scripts/new-task-helper.mjs']);
  assert.equal('golden' in selected || 'performance_smoke' in selected || 'smoke' in selected, false);
});
test('full always includes all families and an unproven diff fails with a recovery action', () => {
  assert.deepEqual(scope([], { full: true }), {
    product: true, tooling: true, backend: true, geometry_parity: true, unknown: [],
  });
  assert.deepEqual(taskCheckScope({ full: true }), scope([], { full: true }));
  assert.throws(() => scope([], { unknown: true }), /resolve.*Git base.*retry/);
  assert.throws(() => taskCheckScope({}), /proven changed-file list/);
  assert.deepEqual(scope('src/led-backlight.ts\n'), scope(['src/led-backlight.ts']));
});
test('tracked bundle outputs do not demand runtime families', () => {
  const selected = scope(['custom_components/houseplan/frontend/houseplan-card.js', 'dist/houseplan-card.js']);
  assert.equal(selected.product, false);
  assert.equal(selected.backend, false);
  assert.equal(selected.geometry_parity, false);
  assert.deepEqual(selected.unknown, []);
});

test('tooling dependency triggers retain direct/transitive helpers and preserve product coverage', () => {
  const repository = {
    ...sources,
    'test/tooling.test.mjs': `import '../demo/helpers/direct.mjs';
      new URL('../demo/helpers/url-entry.mjs', import.meta.url);
      new URL('../demo/fixtures/values.json', import.meta.url);
      readFileSync(resolve(root, 'demo/fixtures/template.html'), 'utf8');
      readFileSync('custom_components/houseplan/frontend/houseplan-card.js', 'utf8');
      readFileSync('docs/reviews/INDEX.md', 'utf8');
      readFileSync('PROCESS.md', 'utf8');
      const fixture = "import '../src/led-backlight.ts';";
      const manifest = ['src/plan-optimizer.ts', 'demo/fixtures/unrelated.json'];`,
    'demo/helpers/direct.mjs': 'export { result } from "./nested.mjs";',
    'demo/helpers/nested.mjs': 'export const result = 1;',
    'demo/helpers/url-entry.mjs': 'import "./url-child.mjs";',
    'demo/helpers/url-child.mjs': 'export const result = 2;',
    'demo/fixtures/values.json': '{}',
    'demo/fixtures/template.html': '<html></html>',
    'demo/fixtures/unrelated.json': '{}',
    'custom_components/houseplan/frontend/houseplan-card.js': '// release snapshot',
    'docs/reviews/INDEX.md': '# Review index',
    'PROCESS.md': '# Process',
  };
  const readOptions = { tracked: Object.keys(repository), read: file => repository[file] || '' };
  const dependencies = toolingDependencyPaths(['test/tooling.test.mjs'], '.', readOptions);
  const paths = profilePaths(['test/tooling.test.mjs'], dependencies);
  for (const file of ['demo/helpers/direct.mjs', 'demo/helpers/nested.mjs', 'demo/helpers/url-entry.mjs',
    'demo/helpers/url-child.mjs', 'demo/fixtures/values.json', 'demo/fixtures/template.html']) {
    assert.ok(dependencies.includes(file), file);
    assert.deepEqual(profilesForFiles([file], paths), ['product', 'tooling'], file);
    assert.equal(scope([file], {}, { ...readOptions, profilePaths: paths }).tooling, true, file);
  }
  for (const file of ['src/led-backlight.ts', 'src/plan-optimizer.ts', 'demo/fixtures/unrelated.json']) {
    assert.equal(dependencies.includes(file), false, file + ': fixture strings are not executable edges');
    assert.deepEqual(profilesForFiles([file], paths), ['product'], file);
  }
  assert.deepEqual(profilesForFiles(['test/tooling.test.mjs'], paths), ['tooling']);
  assert.deepEqual(profilesForFiles(['custom_components/houseplan/frontend/houseplan-card.js'], paths), [],
    'generated release snapshots retain the non-input contract');
  for (const file of ['docs/reviews/INDEX.md', 'PROCESS.md']) {
    assert.equal(dependencies.includes(file), false, file);
    assert.deepEqual(profilesForFiles([file], paths), ['docs'],
      file + ': task documentation preflight does not repeat broad tooling contracts');
  }
});
