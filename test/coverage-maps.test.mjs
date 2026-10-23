import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';
import terser from '@rollup/plugin-terser';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { editMappedSource, replacementEdits, replaceChunkSource, lineOffsets, positionAt } from '../scripts/coverage-maps.mjs';
import { cssTemplateMinifier } from '../scripts/css-template-minifier.mjs';
import { buildFingerprintPlugin, entryFallbackPlugin, editorRuntimeRetryUrlPlugin, NAMESPACE_LOCALE_CHUNKS, VIEW_RUNTIME_RETRY_CHUNKS } from '../scripts/bundle-manifest.mjs';
import { patchImports } from '../scripts/fix-test-build.mjs';

const original = (mapped, token, occurrence = 0) => {
  let offset = -1;
  for (let n = 0; n <= occurrence; n++) offset = mapped.code.indexOf(token, offset + 1);
  assert.ok(offset >= 0, `missing sentinel ${token}`);
  const at = positionAt(offset, lineOffsets(mapped.code));
  return originalPositionFor(new TraceMap(mapped.map), { line: at.line + 1, column: at.column });
};
const expectAt = (mapped, source, token) => {
  const at = positionAt(source.indexOf(token), lineOffsets(source));
  const found = original(mapped, token);
  assert.equal(found.line, at.line + 1, token); assert.equal(found.column, at.column, token);
};

test('#1018 AC3 edits compose exact offsets across different lengths on one minified line; generated text stays unmapped', () => {
  const source = 'function before(){return 112233}const a="old";const b="old";function after(){return 445566}';
  const first = editMappedSource(source, replacementEdits(source, 'old', 'a-much-longer-generated-url', true).edits, { id: 'src/sentinel.ts' });
  const chunk = { fileName: 'chunk.js', ...first };
  replaceChunkSource(chunk, 'a-much-longer-generated-url', 'x', { all: true, coverage: true });
  expectAt(chunk, source, '112233'); expectAt(chunk, source, '445566');
  assert.equal(original(chunk, 'x').source, null);
  assert.throws(() => editMappedSource(source, [{ start: 5, end: 8, text: '' }, { start: 7, end: 9, text: '' }]), /Invalid/);
  const corrupt = { ...chunk, map: null };
  replaceChunkSource(corrupt, 'x', 'generated', { coverage: true });
  assert.equal(original(corrupt, 'generated').source, null, 'synthetic facade cannot gain an invented TS source');
});

test('#1018 AC3 actual fingerprint → CSS → Rollup → terser maps keep independent before/after sentinels', async () => {
  const id = '/src/coverage-sentinel.ts';
  const source = 'export function before(n){return n+114466}\n'
    + 'const css=p=>p[0];export const style=css` /* remove */ .a { color: red; padding: 0; } `;\n'
    + 'export const fingerprint="__HOUSEPLAN_SOURCE_FINGERPRINT__";\n'
    + 'export function after(n){return n+339977}';
  const bundle = await rollup({ input: id, plugins: [
    { name: 'sentinel-input', resolveId: value => value === id ? id : null, load: value => value === id ? source : null },
    buildFingerprintPlugin('f'.repeat(64), { coverage: true }), cssTemplateMinifier({ coverage: true }), terser(),
  ] });
  try {
    const { output } = await bundle.generate({ format: 'es', sourcemap: 'hidden' });
    const chunk = output.find(item => item.type === 'chunk');
    assert.equal(chunk.code.split('\n').filter(Boolean).length, 1, 'the final minified bytes are tested');
    expectAt(chunk, source, '114466'); expectAt(chunk, source, '339977');
    assert.equal(chunk.map.sourcesContent[0], source);
    assert.ok(!chunk.code.includes('remove'));
  } finally { await bundle.close(); }
});

test('#1018 AC3 real fallback rewrite preserves panel source after inserted catch code and leaves fallback generated', () => {
  const cardSource = 'export{Card}from"./houseplan-assets/main-12345678.js";';
  const panelSource = 'const headSentinel=123;import"./houseplan-assets/main-12345678.js";const tailSentinel=456;';
  const card = { type: 'chunk', isEntry: true, fileName: 'houseplan-card.js', facadeModuleId: '/src/houseplan-card.ts',
    imports: [], ...editMappedSource(cardSource, [], { id: 'generated-facade', generated: true }) };
  const panel = { type: 'chunk', isEntry: true, fileName: 'houseplan-panel.js', facadeModuleId: '/src/houseplan-panel.ts',
    imports: [], ...editMappedSource(panelSource, [], { id: '/src/houseplan-panel.ts' }) };
  const bundle = { [card.fileName]: card, [panel.fileName]: panel, [`${panel.fileName}.map`]: { type: 'asset', source: '' } };
  entryFallbackPlugin({ coverage: true }).generateBundle({}, bundle);
  expectAt(panel, panelSource, 'headSentinel'); expectAt(panel, panelSource, 'tailSentinel');
  assert.equal(original(panel, 'connectedCallback').source, null);
  assert.equal(original(card, 'connectedCallback').source, null);
  assert.deepEqual(JSON.parse(bundle[`${panel.fileName}.map`].source), JSON.parse(JSON.stringify(panel.map)));
});

test('#1018 AC3 fix-test-build composes extension insertions; normal import bytes remain identical', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-coverage-imports-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = 'const before=112233;import{a}from "./first";import{b}from "./second";const after=445566;';
  const path = join(dir, 'fixture.js');
  writeFileSync(path, input); writeFileSync(`${path}.map`, JSON.stringify(editMappedSource(input, [], { id: 'src/fixture.ts' }).map));
  patchImports(dir, { coverage: true });
  const mapped = { code: readFileSync(path, 'utf8'), map: JSON.parse(readFileSync(`${path}.map`, 'utf8')) };
  expectAt(mapped, input, '112233'); expectAt(mapped, input, '445566');
  assert.ok(mapped.code.includes('./first.js')); assert.ok(mapped.code.includes('./second.js'));
  writeFileSync(path, input); patchImports(dir, { coverage: false });
  assert.equal(readFileSync(path, 'utf8'), mapped.code);
});

test('#1018 AC3 actual raw retry URL plugin keeps sentinels before/after different-length URLs and map asset synchronized', () => {
  const names = ['EDITOR', 'ONBOARDING', 'ISO', 'DE', 'FR', 'FURNITURE_ART', 'PDF', 'MOON', 'LED', 'LED_FIELD', 'LED_EDITOR'];
  const modules = ['houseplan-editor-runtime', 'houseplan-onboarding-runtime', 'iso-scene-render', 'i18n/de', 'i18n/fr',
    'furniture-plan-art.generated', 'pdf/pdf-export', 'moon-runtime', 'led-strip-runtime', 'led-strip-field', 'led-strip-editor'];
  const source = 'const before=114466;' + names.map(name => `import("__HOUSEPLAN_${name}_RETRY_ASSET__");`).join('')
    + NAMESPACE_LOCALE_CHUNKS.map(entry => `import("${entry.token}?retry");`).join('')
    + VIEW_RUNTIME_RETRY_CHUNKS.map(entry => `import("${entry.token}");`).join('') + 'const after=339977;';
  const owner = { type: 'chunk', fileName: 'houseplan-assets/owner.js', modules: {},
    ...editMappedSource(source, [], { id: '/src/owner.ts' }) };
  const bundle = { [owner.fileName]: owner, [`${owner.fileName}.map`]: { type: 'asset', source: '' } };
  const targets = [...modules.map((module, n) => ({ module: `/src/${module}.ts`, name: names[n] })),
    ...NAMESPACE_LOCALE_CHUNKS.map((entry, n) => ({ module: entry.module, name: `locale${n}` })),
    ...VIEW_RUNTIME_RETRY_CHUNKS.map((entry, n) => ({ module: entry.module, name: `view${n}` }))];
  for (const target of targets) {
    const fileName = `houseplan-assets/${target.name}-different-length-HASH.js`;
    bundle[fileName] = { type: 'chunk', fileName, modules: { [`/repo${target.module}`]: {} }, code: '',
      exports: target.name === 'EDITOR' ? ['EDITOR_RUNTIME_FINGERPRINT', 'EDITOR_LANGUAGE_RUNTIME', 'HouseplanEditorRuntime'] : [] };
  }
  editorRuntimeRetryUrlPlugin({ coverage: true }).generateBundle({}, bundle);
  expectAt(owner, source, '114466'); expectAt(owner, source, '339977');
  assert.ok(!owner.code.includes('__HOUSEPLAN_')); assert.ok(owner.code.includes('?retry'));
  assert.equal(original(owner, 'EDITOR-different').source, null);
  assert.deepEqual(JSON.parse(bundle[`${owner.fileName}.map`].source), JSON.parse(JSON.stringify(owner.map)));
});
