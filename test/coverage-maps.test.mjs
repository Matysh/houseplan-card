import test from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import terser from '@rollup/plugin-terser';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { editMappedSource, replacementEdits, replaceChunkSource, lineOffsets, positionAt } from '../scripts/coverage-maps.mjs';
import { cssTemplateMinifier } from '../scripts/css-template-minifier.mjs';
import { buildFingerprintPlugin } from '../scripts/bundle-manifest.mjs';

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
