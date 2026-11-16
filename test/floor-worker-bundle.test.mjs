import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { rollup } from 'rollup';
import terser from '@rollup/plugin-terser';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { floorWorkerBundlePlugin } from '../scripts/floor-worker-bundle.mjs';
import { diagnosticMapAssetsPlugin, hashMapRecipe, lineOffsets, positionAt } from '../scripts/coverage-maps.mjs';
import { digestBytes, indexGeneratedFiles } from '../scripts/coverage-identity.mjs';

const source = 'export const before=112233;\nexport const worker="__FLOOR_WORKER_ASSET__";\nexport const after=445566;';
const mappedAt = (chunk, token) => {
  const offset = chunk.code.indexOf(token);
  assert.ok(offset >= 0, `missing ${token}`);
  const at = positionAt(offset, lineOffsets(chunk.code));
  return originalPositionFor(new TraceMap(chunk.map), { line: at.line + 1, column: at.column });
};

for (const diagnostic of [true, false]) {
  test(`#1456 isolated worker ${diagnostic ? 'diagnostic maps follow final bytes' : 'normal build stays map-free'}`, async () => {
    const previous = process.env.HP_DIAGNOSTIC_COVERAGE;
    process.env.HP_DIAGNOSTIC_COVERAGE = diagnostic ? '1' : '0';
    const directory = mkdtempSync(join(tmpdir(), 'hp-worker-maps-'));
    let build;
    try {
      build = await rollup({ input: '/worker-sentinel.js', plugins: [
        { name: 'sentinel', resolveId: id => id === '/worker-sentinel.js' ? id : null,
          load: id => id === '/worker-sentinel.js' ? source : null },
        floorWorkerBundlePlugin('f'.repeat(64)), terser(),
        ...(diagnostic ? [diagnosticMapAssetsPlugin()] : []),
      ] });
      const { output } = await build.generate({ dir: join(directory, 'dist'),
        format: 'es', sourcemap: diagnostic ? 'hidden' : false });
      const worker = output.find(item => item.type === 'chunk' && item.fileName.includes('floor-worker-'));
      const owner = output.find(item => item.type === 'chunk' && item !== worker);
      assert.ok(worker); assert.ok(owner);
      assert.deepEqual(worker.imports, [], 'worker remains an isolated graph');
      assert.ok(owner.dynamicImports.includes(worker.fileName));
      assert.ok(!owner.code.includes('__FLOOR_WORKER_ASSET__'));
      assert.ok(!worker.code.includes('__HOUSEPLAN_SOURCE_FINGERPRINT__'));
      assert.ok(!worker.code.includes('sourceMappingURL'));
      if (!diagnostic) {
        assert.equal(worker.map, null);
        assert.equal(output.filter(item => item.fileName.endsWith('.map')).length, 0);
        return;
      }
      for (const chunk of [worker, owner]) {
        const asset = output.find(item => item.fileName === `${chunk.fileName}.map`);
        assert.ok(asset, `map asset for ${chunk.fileName}`);
        assert.equal(JSON.parse(asset.source).x_houseplan_coverage_recipe, hashMapRecipe);
        assert.ok(chunk.map.sourcesContent.some(Boolean));
      }
      for (const token of ['112233', '445566']) {
        const expected = positionAt(source.indexOf(token), lineOffsets(source));
        const actual = mappedAt(owner, token);
        assert.equal(actual.line, expected.line + 1);
        assert.equal(actual.column, expected.column);
      }
      assert.equal(mappedAt(owner, worker.fileName).source, null, 'generated URL is not attributed to TS');
      const token = 'floor-cache:compute-failed';
      const actual = mappedAt(worker, token);
      assert.match(actual.source, /(?:^|\/)src\/floor-cache-worker\.ts$/);
      const original = readFileSync('src/floor-cache-worker.ts', 'utf8');
      assert.equal(actual.line, positionAt(original.indexOf(token), lineOffsets(original)).line + 1);
      // Use the real coverage reader, from the map's actual output location,
      // not TraceMap without a base URL (which accepts a wrong sources base).
      const path = `dist/${worker.fileName}`;
      const destination = join(directory, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, worker.code);
      writeFileSync(`${destination}.map`, output.find(item => item.fileName === `${worker.fileName}.map`).source);
      const manifest = Buffer.from(JSON.stringify({ files: [{ path: worker.fileName, sha256: digestBytes(worker.code) }] }));
      const index = indexGeneratedFiles({ root: process.cwd(), buildRoot: directory,
        paths: [path], identity: { fixture: true }, manifest });
      assert.deepEqual(index.issues, []);
      for (const source of ['src/floor-cache-worker.ts', 'src/floor-cache-compute.ts']) {
        assert.ok(index.files[0].sources.some(item => item.path === source && item.product),
          `coverage must retain ${source} as a verified product source`);
      }
    } finally {
      if (build) await build.close();
      rmSync(directory, { recursive: true, force: true });
      if (previous === undefined) delete process.env.HP_DIAGNOSTIC_COVERAGE;
      else process.env.HP_DIAGNOSTIC_COVERAGE = previous;
    }
  });
}
