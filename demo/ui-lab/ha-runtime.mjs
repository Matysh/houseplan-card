/** Authentic HA components, never HA auth/app/core. Cache metadata is not trusted. */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

export const HA_LOCK = Object.freeze(JSON.parse(readFileSync(new URL('./ha-lock.json', import.meta.url))));
export const digest = value => createHash('sha256').update(value).digest('hex');
export const allowedHaPath = name => /^hass_frontend\/frontend_latest\/[\w.-]+\.js$/.test(name)
  || /^hass_frontend\/static\/[\w.@/-]+\.(?:css|woff2?|svg|json|png)$/.test(name);

export function within(root, target) {
  const part = relative(root, target);
  return part !== '' && !part.startsWith('..') && !isAbsolute(part);
}

/** Resolve both roots and files: junctions/symlinks cannot escape the chosen root. */
export function safeFile(root, name) {
  if (!name || name.includes('\\') || name.includes(':') || name.includes('\0')
      || name.split('/').some(part => !part || part === '.' || part === '..')) return null;
  try {
    const realRoot = realpathSync(root), target = realpathSync(resolve(realRoot, name));
    return within(realRoot, target) && statSync(target).isFile() ? target : null;
  } catch { return null; }
}

/** Stable canonical inventory: independent of ZIP directory and JS property ordering. */
export function runtimeManifest({ files, modules }, lock = HA_LOCK) {
  return {
    version: lock.version, wheelSha256: lock.sha256, app: lock.app,
    files: files.map(({ path, sha256 }) => ({ path, sha256 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    modules: Object.fromEntries(Object.keys(modules).sort().map(id => [id, {
      file: modules[id].file, bytes: modules[id].bytes,
      dependencies: [...modules[id].dependencies].sort(),
    }])),
  };
}

export function verifyHaRuntime(cacheDir, lock = HA_LOCK) {
  const help = 'Run npm run ui-lab:prepare (or choose a fresh --ha-cache directory).';
  const manifestFile = safeFile(cacheDir, 'manifest.json');
  if (!manifestFile) throw new Error(`UI Lab HA runtime is missing. ${help}`);
  const bytes = readFileSync(manifestFile);
  if (digest(bytes) !== lock.manifestSha256) throw new Error(`UI Lab HA manifest integrity mismatch. ${help}`);
  const manifest = JSON.parse(bytes);
  if (manifest.version !== lock.version || manifest.wheelSha256 !== lock.sha256 || manifest.app !== lock.app
      || !manifest.files?.length || Object.values(lock.modules).some(id => !manifest.modules?.[id])) {
    throw new Error(`UI Lab HA runtime metadata is invalid. ${help}`);
  }
  const files = new Map();
  for (const item of manifest.files) {
    const file = allowedHaPath(item.path) && safeFile(cacheDir, item.path);
    if (!file || digest(readFileSync(file)) !== item.sha256 || files.has(item.path)) {
      throw new Error(`UI Lab HA asset integrity mismatch. ${help}`);
    }
    files.set(item.path, item.sha256);
  }
  const app = readFileSync(safeFile(cacheDir, `hass_frontend/frontend_latest/${lock.app}`), 'utf8');
  if (app.split(lock.entry).length !== 2) throw new Error('UI Lab HA loader entry does not match the pinned frontend');
  return { cacheDir, manifest, files, lock };
}
