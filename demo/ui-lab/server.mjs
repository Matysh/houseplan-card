/** Loopback-only, read-only UI workbench. No HA proxy or server-side writes. */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseOptions, resolveOptions } from './config.mjs';
import { HA_LOCK, digest, safeFile, verifyHaRuntime } from './ha-runtime.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const labFiles = new Set(['index.html', 'app.mjs', 'mock-ha.mjs', 'session.mjs', 'ha-bootstrap.mjs', 'theme.css', 'lab.css']);
const overrides = new Set(['houseplan-card.css', 'houseplan-panel.css', 'hp-dialog.css', 'ha-dialog.css']);
const csp = "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'";
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': csp };
const fileReply = (root, name) => {
  const file = safeFile(root, name);
  return file ? { body: readFileSync(file), type: mime[extname(name)] || 'application/octet-stream' } : null;
};
const jsonReply = value => ({ body: Buffer.from(JSON.stringify(value)), type: mime['.json'] });
const emptyCss = () => ({ body: Buffer.from('/* No local override configured. */\n'), type: mime['.css'] });

function productFiles(repoRoot) {
  const dist = resolve(repoRoot, 'dist');
  try {
    const manifestFile = safeFile(dist, 'houseplan-assets.json');
    const manifest = JSON.parse(readFileSync(manifestFile));
    if (!/^[a-f0-9]{64}$/.test(manifest.fingerprint) || !manifest.files?.length) throw new Error('invalid manifest');
    const files = new Map();
    for (const entry of manifest.files) {
      const file = /^(?:houseplan-assets\/)?[\w.-]+\.js$/.test(entry.path) && safeFile(dist, entry.path);
      if (!file || files.has(entry.path) || digest(readFileSync(file)) !== entry.sha256) throw new Error('asset mismatch');
      files.set(entry.path, entry.sha256);
    }
    if (!files.has('houseplan-card.js') || !files.has('houseplan-panel.js')) throw new Error('entry missing');
    return { dist, manifest, files };
  } catch { throw new Error('UI Lab product bundle is missing or inconsistent. Run npm run build in this checkout.'); }
}

function requestPath(raw) {
  if (!raw?.startsWith('/') || raw.startsWith('//')) return null;
  try {
    const path = decodeURIComponent(raw.split('?')[0]);
    if (/[\\%\0:#]/.test(path) || (path !== '/' && path.slice(1).split('/').some(part => !part || part === '.' || part === '..'))) return null;
    return path;
  } catch { return null; }
}

function validHost(value, port) {
  const match = /^(localhost|127\.0\.0\.1)(?::(\d+))?$/i.exec(value || '');
  return !!match && (!match[2] || Number(match[2]) === port);
}

export function createLabServer(options = {}) {
  const config = resolveOptions(options), product = productFiles(config.repoRoot);
  const runtime = verifyHaRuntime(config.haCache, options.haLock ?? HA_LOCK);
  const fixtureBytes = readFileSync(config.fixture);
  let fixture;
  try { fixture = JSON.parse(fixtureBytes); } catch { throw new Error('UI Lab fixture must contain valid JSON'); }
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!record(fixture) || !['config', 'layout', 'states', 'devices', 'entities', 'areas'].every(key => record(fixture[key]))) {
    throw new Error('UI Lab fixture must contain config, layout, states, devices, entities and areas objects');
  }
  if (!['spaces', 'markers'].every(key => Array.isArray(fixture.config[key]) && fixture.config[key].every(record))
      || !['layout', 'states', 'devices', 'entities', 'areas'].every(key => Object.values(fixture[key]).every(record))
      || ['floors', 'hostConfig', 'zigbee'].some(key => fixture[key] !== undefined && !record(fixture[key]))
      || ['assets', 'integrations', 'manifests'].some(key => fixture[key] !== undefined && (!Array.isArray(fixture[key]) || !fixture[key].every(record)))
      || (fixture.virtualLightsOff !== undefined && (!Array.isArray(fixture.virtualLightsOff) || fixture.virtualLightsOff.some(id => typeof id !== 'string')))) {
    throw new Error('UI Lab fixture has invalid collection shapes: use object registries/layout/states and config spaces/markers arrays');
  }
  let commit = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: config.repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Source archives have no Git commit. */ }
  const provenance = {
    application: 'houseplan-offline-ui-lab', productVersion: JSON.parse(readFileSync(resolve(config.repoRoot, 'package.json'))).version,
    productCommit: commit, productFingerprint: product.manifest.fingerprint, frontendVersion: runtime.lock.version,
    frontendWheelSha256: runtime.lock.sha256, privateDataset: config.privateDataset,
    // Path differentiates independently edited copies; neither it nor names leak to the browser.
    datasetId: `${config.privateDataset ? 'private' : 'synthetic'}-${digest(Buffer.concat([
      Buffer.from(config.privateDataset ? realpathSync(config.fixture) + '\0' : 'synthetic\0'), fixtureBytes,
    ])).slice(0, 24)}`,
  };
  const publicRuntime = { version: runtime.lock.version, app: runtime.lock.app, modules: runtime.lock.modules, translations: runtime.lock.translations };
  const server = createServer((req, res) => {
    const send = (status, reply) => {
      const body = Buffer.isBuffer(reply.body) ? reply.body : Buffer.from(reply.body);
      res.writeHead(status, { ...headers, 'Content-Type': reply.type || 'text/plain; charset=utf-8',
        'Content-Length': body.length, ...(status === 200 ? { ETag: `"${digest(body)}"` } : {}) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      if (!validHost(req.headers.host, server.address()?.port)) { send(403, { body: 'Loopback host required' }); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { body: 'Read-only UI Lab; all changes stay in the browser' }); return; }
      const path = requestPath(req.url);
      if (!path) { send(400, { body: 'Invalid local path' }); return; }
      let reply;
      if (path === '/health') reply = jsonReply({ ok: true, offline: true, ...provenance });
      else if (path === '/provenance.json') reply = jsonReply(provenance);
      else if (path === '/ha-modules.json') reply = jsonReply(runtime.manifest.modules);
      else if (path === '/ha-runtime.json') reply = jsonReply(publicRuntime);
      else if (path === '/fixture.json') reply = { body: fixtureBytes, type: mime['.json'] };
      else if (path === '/theme-local.css') reply = config.theme ? fileReply(dirname(config.theme), basename(config.theme)) : emptyCss();
      else if (path.startsWith('/overrides/') && overrides.has(path.slice('/overrides/'.length))) {
        reply = config.overrides ? fileReply(config.overrides, path.slice('/overrides/'.length)) || emptyCss() : emptyCss();
      } else if (path.startsWith('/frontend_latest/') || path.startsWith('/static/')) {
        const name = `hass_frontend${path}`, expected = runtime.files.get(name);
        if (expected) {
          reply = fileReply(config.haCache, name);
          if (reply && digest(reply.body) !== expected) throw new Error('Changed HA cache asset');
          if (reply && path === `/frontend_latest/${runtime.lock.app}`) {
            // Keep the official factories but do not execute the HA app/auth/core bootstrap.
            reply.body = Buffer.from(reply.body.toString().replace(runtime.lock.entry, 'window.__hpHaRequire=o;'));
          }
        }
      } else if (path === '/assets/icons.js') reply = fileReply(resolve(config.repoRoot, 'demo/srv/assets'), 'icons.js');
      else if (path.startsWith('/assets/')) {
        const name = path.slice('/assets/'.length), expected = product.files.get(name);
        if (expected) {
          reply = fileReply(product.dist, name);
          if (reply && digest(reply.body) !== expected) throw new Error('Product bundle changed; restart UI Lab');
        }
      } else if (path === '/fixture-state.js') reply = fileReply(resolve(config.repoRoot, 'demo/srv'), 'fixture-state.js');
      else if (config.assets && /^\/api\/houseplan\/content\/assets\/_\/[a-f0-9]{64}\.(png|jpg|webp|svg)$/.test(path)) reply = fileReply(config.assets, path.split('/').pop());
      else if (path === '/') reply = fileReply(config.labRoot, 'index.html');
      else if (labFiles.has(path.slice(1))) reply = fileReply(config.labRoot, path.slice(1));
      else if (path === '/favicon.ico') { res.writeHead(204, headers).end(); return; }
      send(reply ? 200 : 404, reply || { body: 'Not found' });
    } catch { send(500, { body: 'Local asset changed or unavailable; restart UI Lab and verify its files' }); }
  });
  // bind/listen is explicit so smoke/tests can select an ephemeral port.
  Object.assign(server, { config, provenance });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node demo/ui-lab/server.mjs [--port 8891] [--ha-cache DIR] [--fixture FILE] [--assets DIR] [--theme FILE] [--overrides DIR]\nLoopback only; no HA connection. Private input paths stay local.');
    else {
      const server = createLabServer(options);
      server.on('error', error => { console.error(`UI Lab could not listen: ${error.code || 'server error'}`); process.exitCode = 1; });
      server.listen(server.config.port, '127.0.0.1', () => console.log(`House Plan UI Lab: http://localhost:${server.address().port}/\n${JSON.stringify(server.provenance)}`));
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
