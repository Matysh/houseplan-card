/** #505: authentic, pinned HA assets for explicit diagnostics, never ordinary smokes. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync, createWriteStream, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';

export const HA_DIALOG_PIN = Object.freeze({
  version: '20260729.7', bytes: 124294469,
  sha256: 'ba01782297e9506d3185f99a74d829f3811df322623848af21bcc0b8ea834c12',
  // Deterministic manifest generated from that authenticated wheel, including
  // extracted-file hashes and the module index. Cache metadata is not trusted.
  cacheManifestSha256: '6fd75eb27f8a660c57d173d7b9b496d17f96e404c48adba7faeef1a3d391d831',
  url: 'https://files.pythonhosted.org/packages/22/84/f117626ac7db42d34341aa2795cd2bd2f84e7cc89ecdf0117bf4cfa2f1e6/home_assistant_frontend-20260729.7-py3-none-any.whl',
  app: 'app.d53ce8172fc8c85d.js', module: '25395', entry: 'o(91535);',
});
const require = createRequire(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const allowed = (name) => /^hass_frontend\/frontend_latest\/[^/]+\.js$/.test(name)
  || /^hass_frontend\/static\/.+\.(?:css|woff2?|svg|json)$/.test(name);

function visit(node, action) {
  if (!node || typeof node !== 'object') return;
  action(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, action));
    else if (value && typeof value === 'object') visit(value, action);
  }
}

function moduleIndex(assetRoot) {
  const modules = new Map();
  for (const file of readdirSync(assetRoot).filter((name) => /^\d+\.[a-f0-9]+\.js$/.test(name)).sort()) {
    const code = readFileSync(join(assetRoot, file), 'utf8');
    const ast = parseAst(code);
    const declaration = ast.body.find((item) => item.type === 'ExportNamedDeclaration'
      && item.declaration?.declarations?.some((item) => item.id.name === '__webpack_modules__'));
    const object = declaration?.declaration.declarations.find((item) => item.id.name === '__webpack_modules__')?.init;
    for (const property of object?.properties || []) {
      const id = String(property.key.value ?? property.key.name);
      if (modules.has(id) && modules.get(id).bytes <= code.length) continue;
      const loader = property.value.params?.[2]?.name;
      const dependencies = new Set();
      visit(property.value.body, (node) => {
        if (node.type === 'CallExpression' && node.callee?.name === loader
            && node.arguments?.[0]?.type === 'Literal' && typeof node.arguments[0].value === 'number') {
          dependencies.add(String(node.arguments[0].value));
        }
      });
      modules.set(id, { file, bytes: code.length, dependencies: [...dependencies] });
    }
  }
  if (!modules.has(HA_DIALOG_PIN.module)) throw new Error('Pinned authentic ha-dialog factory is absent');
  return Object.fromEntries(modules);
}

/** Downloads only this allowlisted wheel; verified local wheels may avoid the download. */
export async function prepareHaDialogAssets({
  cacheDir = join(tmpdir(), `houseplan-ha-dialog-${HA_DIALOG_PIN.version}`),
  wheelPath = process.env.HP_HA_DIALOG_WHEEL,
} = {}) {
  const pin = readFileSync(join(REPO, 'tests_backend/requirements.txt'), 'utf8')
    .match(/^home-assistant-frontend==([^\s]+)$/m)?.[1];
  if (pin !== HA_DIALOG_PIN.version) throw new Error(`HA frontend pin changed to ${pin}; update and re-verify the authentic fixture`);
  const cache = resolve(cacheDir);
  mkdirSync(cache, { recursive: true });
  const manifestPath = join(cache, 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifestBytes = readFileSync(manifestPath);
    if (digest(manifestBytes) !== HA_DIALOG_PIN.cacheManifestSha256) throw new Error('HA fixture cache manifest hash mismatch');
    const manifest = JSON.parse(manifestBytes);
    if (manifest.version !== pin || manifest.sha256 !== HA_DIALOG_PIN.sha256
        || !manifest.files?.length || !manifest.modules?.[HA_DIALOG_PIN.module]) throw new Error('Invalid HA fixture cache manifest');
    for (const file of manifest.files) {
      const target = resolve(cache, file.path);
      if (!allowed(file.path) || !target.startsWith(cache + sep)
          || !existsSync(target) || digest(readFileSync(target)) !== file.sha256) {
        throw new Error(`HA fixture cache integrity failed: ${file.path}; choose a new --ha-cache directory`);
      }
    }
    return { root: join(cache, 'hass_frontend'), manifest };
  }
  const savedWheel = join(cache, `home_assistant_frontend-${pin}.whl`);
  const local = wheelPath || (existsSync(savedWheel) ? savedWheel : null);
  let wheel;
  if (local) wheel = readFileSync(resolve(local));
  else {
    console.log(`Downloading official HA frontend ${pin} (${HA_DIALOG_PIN.bytes} bytes), only for this explicit diagnostic`);
    const response = await fetch(HA_DIALOG_PIN.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || Number(response.headers.get('content-length')) !== HA_DIALOG_PIN.bytes) throw new Error(`Unexpected wheel response: ${response.status}`);
    const parts = []; let size = 0;
    for await (const part of response.body) {
      size += part.length;
      if (size > HA_DIALOG_PIN.bytes) throw new Error('Wheel exceeds authenticated size');
      parts.push(Buffer.from(part));
    }
    wheel = Buffer.concat(parts);
  }
  if (wheel.length !== HA_DIALOG_PIN.bytes || digest(wheel) !== HA_DIALOG_PIN.sha256) throw new Error('Official wheel hash/size mismatch; refusing extraction');
  if (!local) writeFileSync(savedWheel, wheel, { flag: 'wx' });
  const { yauzl } = require('playwright-core/lib/utilsBundle');
  const files = [];
  await new Promise((done, reject) => {
    yauzl.fromBuffer(wheel, { lazyEntries: true, validateEntrySizes: true }, (error, archive) => {
      if (error) { reject(error); return; }
      archive.on('error', reject); archive.on('end', done);
      archive.on('entry', async (entry) => {
        try {
          const name = entry.fileName;
          if (!allowed(name)) { archive.readEntry(); return; }
          const target = resolve(cache, name);
          if (name.includes('\\') || name.split('/').includes('..') || !target.startsWith(cache + sep)
              || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error(`Unsafe wheel entry ${name}`);
          mkdirSync(dirname(target), { recursive: true });
          const stream = await new Promise((accept, fail) => archive.openReadStream(entry, (failure, input) => failure ? fail(failure) : accept(input)));
          await pipeline(stream, createWriteStream(target));
          files.push({ path: name, sha256: digest(readFileSync(target)) });
          archive.readEntry();
        } catch (failure) { archive.close(); reject(failure); }
      });
      archive.readEntry();
    });
  });
  const root = join(cache, 'hass_frontend');
  const manifest = { version: pin, sha256: HA_DIALOG_PIN.sha256, url: HA_DIALOG_PIN.url,
    files, modules: moduleIndex(join(root, 'frontend_latest')) };
  if (digest(JSON.stringify(manifest)) !== HA_DIALOG_PIN.cacheManifestSha256) throw new Error('Rebuilt HA manifest differs from verified pin; refusing this cache');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  return { root, manifest };
}
