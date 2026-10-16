#!/usr/bin/env node
/** Reproducible offline page; dependencies are bundled, never loaded from a CDN. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { syncGeometryRuntime } from './build-runtime.mjs';
import { isMainModule } from '../spawn-portable.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARKER = '/* <!--BUNDLE--> */';
export async function buildPage() {
  const shell = readFileSync(join(HERE, 'page/shell.html'), 'utf8').replace(/\r\n/g, '\n');
  if (!shell.includes(MARKER)) throw new Error('Missing converter bundle marker');
  const bundle = await rollup({ input: join(HERE, 'page/app.mjs'), plugins: [nodeResolve({ browser: true }),
    terser({ compress: false, mangle: false, format: { beautify: false, comments: false } })],
    onwarn(warning, warn) { if (warning.code === 'UNRESOLVED_IMPORT') throw new Error(warning.message); warn(warning); } });
  try {
    const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true });
    if (output.length !== 1 || output[0].type !== 'chunk' || output[0].imports.length)
      throw new Error('Converter page must be a single offline module');
    const code = output[0].code.replace(/<\/script/gi, '<\\/script');
    const license = readFileSync(join(HERE, '../../node_modules/yaml/LICENSE'), 'utf8').replace(/\r\n/g, '\n');
    return shell.replace(MARKER, () => `/* Bundled yaml, ISC license:\n${license}\n*/\n${code}\nmount();`);
  } finally { await bundle.close(); }
}
if (isMainModule(import.meta.url)) {
  const check = process.argv.includes('--check');
  await syncGeometryRuntime(check);
  const page = await buildPage(), target = join(HERE, 'dist/index.html');
  if (check) {
    if (readFileSync(target, 'utf8') !== page) throw new Error('Stale converter page: node scripts/sh3d-convert/build-page.mjs');
    console.log('ok: offline converter matches its sources and canonical runtime');
  } else {
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, page);
    console.log(`converter page: ${Buffer.byteLength(page)} bytes`);
  }
}
