/** Diagnostic same-graph build: adapter and actual card share one Lit/locale
 * runtime. Not the distributable standalone entry/manifest (#1423). */
import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { resolve } from 'node:path';
import config from '../../rollup.config.mjs';

export async function buildStandalonePresentationProbe(directory) {
  const out = resolve(directory);
  const skipped = new Set(['houseplan-clean-bundle-output', 'houseplan-bundle-manifest']);
  const plugins = config.plugins.filter(plugin => !skipped.has(plugin.name)).map(plugin =>
    plugin.name === 'typescript' ? typescript({ compilerOptions: { outDir: resolve(out, '.ts') } }) : plugin);
  const build = await rollup({ input: { ...config.input, 'standalone-presentation': 'src/standalone-presentation.ts' }, plugins });
  try { await build.write({ ...config.output, dir: out }); }
  finally { await build.close(); }
}
