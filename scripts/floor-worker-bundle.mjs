import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import { minify } from 'terser';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { coverageMapsEnabled, coverageTypeScriptOptions, replaceChunkSource, rollupMap } from './coverage-maps.mjs';

/** Isolated worker graph: do not let shared main-thread render chunks pull
 * Lit/DOM initialization into a module worker. Algorithms remain the same TS
 * modules; only their unused rendering exports are tree-shaken here. */
export function floorWorkerBundlePlugin(fingerprint) {
  const coverage = coverageMapsEnabled();
  let fileName;
  return {
    name: 'houseplan-floor-worker',
    async renderStart(outputOptions) {
      // The source map is relative to the emitted Worker, not to cwd. Wait
      // for the owner's output directory; prebuilt chunks can be emitted here.
      const outputDirectory = outputOptions.dir || (outputOptions.file ? dirname(outputOptions.file) : process.cwd());
      const workerDirectory = join(outputDirectory, 'houseplan-assets');
      const build = await rollup({ input: 'src/floor-cache-worker.ts',
        treeshake: { moduleSideEffects: false },
        plugins: [resolve(), json(), typescript({ compilerOptions: { outDir: join(workerDirectory, '.worker-ts'), incremental: false,
          ...(coverage ? coverageTypeScriptOptions() : {}) } })] });
      try {
        const { output } = await build.generate({ dir: workerDirectory, format: 'es', inlineDynamicImports: true,
          sourcemap: coverage ? 'hidden' : false });
        const chunks = output.filter(item => item.type === 'chunk');
        if (chunks.length !== 1) throw new Error('floor worker must be one isolated module');
        const chunk = chunks[0];
        replaceChunkSource(chunk, '__HOUSEPLAN_SOURCE_FINGERPRINT__', fingerprint, { all: true, coverage });
        const { code, map } = await minify(chunk.code,
          { module: true, format: { comments: false },
            ...(coverage ? { sourceMap: { content: chunk.map, asObject: true, includeSources: true } } : {}) });
        if (!code) throw new Error('floor worker minification failed');
        const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
        fileName = `houseplan-assets/floor-worker-${hash}.js`;
        // Prebuilt chunks bypass Rollup's normal map-asset emission. Keep both
        // the composed final map and its asset for the diagnostic inventory.
        const finalMap = coverage ? rollupMap({ ...map, file: fileName }) : null;
        this.emitFile({ type: 'prebuilt-chunk', fileName, code, exports: [], ...(coverage ? { map: finalMap } : {}) });
        if (coverage) this.emitFile({ type: 'asset', fileName: `${fileName}.map`, source: JSON.stringify(finalMap) });
      } finally { await build.close(); }
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code.includes('__FLOOR_WORKER_ASSET__')) continue;
        // Owners and worker are both under houseplan-assets, except entry
        // facade variants. Keep the relationship in the manifest as a lazy
        // edge, so installer, encoding and orphan cleanup all inventory it.
        const path = chunk.fileName.includes('/') ? `./${fileName.split('/').pop()}` : `./${fileName}`;
        replaceChunkSource(chunk, '__FLOOR_WORKER_ASSET__', path, { all: true, coverage, bundle });
        if (!chunk.dynamicImports.includes(fileName)) chunk.dynamicImports.push(fileName);
      }
    },
  };
}
