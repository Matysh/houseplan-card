/** Explicit acquisition only. Starting the lab never downloads or contacts HA. */
import { createRequire } from 'node:module';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { DEFAULT_CACHE, parseOptions } from './config.mjs';
import { HA_LOCK, allowedHaPath, digest, runtimeManifest, verifyHaRuntime, within } from './ha-runtime.mjs';

const require = createRequire(import.meta.url);

function visit(node, action) {
  if (!node || typeof node !== 'object') return;
  action(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, action));
    else if (value && typeof value === 'object') visit(value, action);
  }
}

async function moduleIndex(root) {
  const { parseAst } = await import('rollup/parseAst');
  const modules = {};
  for (const file of readdirSync(root).filter(name => /^\d+\.[a-f0-9]+\.js$/.test(name)).sort()) {
    const code = readFileSync(join(root, file), 'utf8');
    const ast = parseAst(code);
    const declaration = ast.body.find(item => item.type === 'ExportNamedDeclaration'
      && item.declaration?.declarations?.some(item => item.id.name === '__webpack_modules__'));
    const object = declaration?.declaration.declarations.find(item => item.id.name === '__webpack_modules__')?.init;
    for (const property of object?.properties || []) {
      const id = String(property.key.value ?? property.key.name);
      if (modules[id] && modules[id].bytes <= code.length) continue;
      const loader = property.value.params?.[2]?.name, dependencies = new Set();
      visit(property.value.body, node => {
        if (node.type === 'CallExpression' && node.callee?.name === loader
            && node.arguments?.[0]?.type === 'Literal' && typeof node.arguments[0].value === 'number') {
          dependencies.add(String(node.arguments[0].value));
        }
      });
      modules[id] = { file, bytes: code.length, dependencies: [...dependencies] };
    }
  }
  return modules;
}

async function officialWheel(wheel) {
  let bytes;
  if (wheel) bytes = readFileSync(resolve(wheel));
  else {
    console.log(`Downloading official HA frontend ${HA_LOCK.version} (${HA_LOCK.bytes} bytes)`);
    const response = await fetch(HA_LOCK.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || Number(response.headers.get('content-length')) !== HA_LOCK.bytes) throw new Error('Unexpected official wheel response');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > HA_LOCK.bytes) throw new Error('Official wheel exceeds its pinned size');
      chunks.push(Buffer.from(chunk));
    }
    bytes = Buffer.concat(chunks);
  }
  if (bytes.length !== HA_LOCK.bytes || digest(bytes) !== HA_LOCK.sha256) throw new Error('Official wheel hash/size mismatch; no extraction performed');
  return bytes;
}

export async function prepareHa({ haCache = DEFAULT_CACHE, wheel } = {}) {
  const cache = resolve(haCache);
  if (existsSync(cache)) return verifyHaRuntime(cache);
  const bytes = await officialWheel(wheel);
  const { yauzl } = require('playwright-core/lib/utilsBundle');
  const parent = dirname(cache);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, '.houseplan-ui-lab-'));
  try {
    const files = [];
    await new Promise((done, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, archive) => {
      if (error) { reject(error); return; }
      archive.on('error', reject); archive.on('end', done);
      archive.on('entry', async entry => {
        try {
          const name = entry.fileName;
          if (!allowedHaPath(name)) { archive.readEntry(); return; }
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000, target = resolve(staging, name);
          if (name.includes('\\') || name.includes(':') || name.split('/').some(part => !part || part === '..' || part === '.')
              || (mode !== 0 && mode !== 0x8000) || !within(staging, target)) throw new Error('Unsafe official wheel entry');
          mkdirSync(dirname(target), { recursive: true });
          const input = await new Promise((accept, fail) => archive.openReadStream(entry, (error, stream) => error ? fail(error) : accept(stream)));
          await pipeline(input, createWriteStream(target, { flags: 'wx' }));
          files.push({ path: name, sha256: digest(readFileSync(target)) });
          archive.readEntry();
        } catch (error) { archive.close(); reject(error); }
      });
      archive.readEntry();
    }));
    const manifest = runtimeManifest({ files, modules: await moduleIndex(join(staging, 'hass_frontend/frontend_latest')) });
    const body = JSON.stringify(manifest);
    if (digest(body) !== HA_LOCK.manifestSha256) throw new Error('Rebuilt HA inventory differs from trusted pin; cache was not installed');
    writeFileSync(join(staging, 'manifest.json'), body, { flag: 'wx' });
    verifyHaRuntime(staging);
    // A cache is never repaired by overwriting unknown content; choose a fresh path.
    if (existsSync(cache)) throw new Error('HA cache appeared during preparation; nothing was overwritten');
    renameSync(staging, cache);
    return verifyHaRuntime(cache);
  } finally {
    // Only the fresh, owned mkdtemp child may be removed, never the chosen cache.
    if (within(parent, staging) && dirname(staging) === parent && existsSync(staging)) rmSync(staging, { recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2), { prepare: true });
    if (options.help) console.log('node demo/ui-lab/prepare-ha.mjs [--ha-cache DIR] [--wheel FILE]\nDownloads only the pinned official wheel. Existing invalid caches are not overwritten.');
    else { const runtime = await prepareHa(options); console.log(`Verified HA frontend ${runtime.manifest.version}. Start with npm run ui-lab${options.haCache ? ' -- --ha-cache "' + options.haCache + '"' : ''}`); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
