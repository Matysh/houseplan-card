import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import { minify } from 'terser';
import { createHash } from 'node:crypto';

/** Isolated worker graph: do not let shared main-thread render chunks pull
 * Lit/DOM initialization into a module worker. Algorithms remain the same TS
 * modules; only their unused rendering exports are tree-shaken here. */
export function floorWorkerBundlePlugin(fingerprint) {
  let fileName;
  return {
    name: 'houseplan-floor-worker',
    async buildStart() {
      const build = await rollup({ input: 'src/floor-cache-worker.ts',
        treeshake: { moduleSideEffects: false },
        plugins: [resolve(), json(), typescript({ compilerOptions: { outDir: 'dist/.worker-ts', incremental: false } })] });
      try {
        const { output } = await build.generate({ format: 'es', inlineDynamicImports: true });
        if (output.length !== 1 || output[0].type !== 'chunk') throw new Error('floor worker must be one isolated module');
        const { code } = await minify(output[0].code.replaceAll('__HOUSEPLAN_SOURCE_FINGERPRINT__', fingerprint),
          { module: true, format: { comments: false } });
        if (!code) throw new Error('floor worker minification failed');
        const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
        fileName = `houseplan-assets/floor-worker-${hash}.js`;
        this.emitFile({ type: 'prebuilt-chunk', fileName, code, exports: [] });
      } finally { await build.close(); }
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code.includes('__FLOOR_WORKER_ASSET__')) continue;
        // Owners and worker are both under houseplan-assets, except entry
        // facade variants. Keep the relationship in the manifest as a lazy
        // edge, so installer, encoding and orphan cleanup all inventory it.
        const path = chunk.fileName.includes('/') ? `./${fileName.split('/').pop()}` : `./${fileName}`;
        chunk.code = chunk.code.replaceAll('__FLOOR_WORKER_ASSET__', path);
        if (!chunk.dynamicImports.includes(fileName)) chunk.dynamicImports.push(fileName);
      }
    },
  };
}
