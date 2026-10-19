import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { request } from 'node:http';
import { once } from 'node:events';
import { createLabServer } from '../demo/ui-lab/server.mjs';
import { parseOptions, resolveOptions } from '../demo/ui-lab/config.mjs';
import { digest, runtimeManifest, verifyHaRuntime, safeFile } from '../demo/ui-lab/ha-runtime.mjs';
import { prepareHa } from '../demo/ui-lab/prepare-ha.mjs';

function write(root, name, value) {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
  return path;
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'houseplan-ui-lab-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repoRoot = join(root, 'repo'), labRoot = join(repoRoot, 'demo/ui-lab'), haCache = join(root, 'ha');
  const snapshot = { config: { spaces: [], markers: [] }, layout: {}, states: {}, devices: {}, entities: {}, areas: {} };
  write(labRoot, 'fixture.json', snapshot);
  write(labRoot, 'index.html', '<!doctype html><title>UI Lab</title>');
  write(labRoot, 'app.mjs', 'export const local = true;');
  write(labRoot, 'session.mjs', 'export const session = true;');
  write(repoRoot, 'package.json', { version: '1.0.0-test' });
  write(repoRoot, 'demo/srv/fixture-state.js', 'export const mock = true;');
  write(repoRoot, 'demo/srv/assets/icons.js', 'globalThis.demoIcons = {};');
  const product = ['houseplan-card.js', 'houseplan-panel.js', 'houseplan-assets/chunk.js'].map(path => {
    const bytes = Buffer.from(`export const name = ${JSON.stringify(path)};`);
    write(repoRoot, `dist/${path}`, bytes);
    return { path, sha256: digest(bytes) };
  });
  write(repoRoot, 'dist/houseplan-assets.json', { fingerprint: 'a'.repeat(64), files: product });
  const haLock = { version: 'test-pinned', sha256: 'b'.repeat(64), app: 'app.test.js', entry: 'o(7);',
    modules: { theme: '1', dialog: '2', icon: '3', card: '4', contexts: '5' }, translations: { en: 'en-test.json' } };
  const sources = {
    'hass_frontend/frontend_latest/app.test.js': 'function o() {}o(7);',
    'hass_frontend/frontend_latest/123.abc.js': 'export const __webpack_modules__ = {};',
    'hass_frontend/static/fonts/test.woff2': 'font data',
  };
  const files = Object.entries(sources).map(([path, source]) => { write(haCache, path, source); return { path, sha256: digest(source) }; });
  const modules = Object.fromEntries(Object.values(haLock.modules).map(id => [id, { file: '123.abc.js', bytes: 41, dependencies: [] }]));
  const manifest = runtimeManifest({ files, modules }, haLock);
  haLock.manifestSha256 = digest(JSON.stringify(manifest));
  write(haCache, 'manifest.json', manifest);
  return { root, repoRoot, labRoot, haCache, haLock, snapshot };
}

async function serve(t, options) {
  const server = createLabServer({ ...options, port: 0 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server;
}

function http(server, path, { method = 'GET', host = `localhost:${server.address().port}` } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers: { Host: host } }, res => {
      const parts = [];
      res.on('data', part => parts.push(part));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

test('UI Lab validates portable CLI options and missing inputs', () => {
  assert.deepEqual(parseOptions(['--port=8892', '--ha-cache', 'cache', '--fixture=f.json']), { port: 8892, haCache: 'cache', fixture: 'f.json' });
  assert.deepEqual(parseOptions(['--wheel', 'a.whl'], { prepare: true }), { wheel: 'a.whl' });
  assert.throws(() => parseOptions(['--host=0.0.0.0']), /Unknown/);
  assert.throws(() => parseOptions(['--fixture']), /Missing/);
  assert.throws(() => parseOptions(['--port=2', '--port=3']), /Repeated/);
  assert.throws(() => resolveOptions({ port: NaN }), /port/);
  assert.throws(() => resolveOptions({ port: 65536 }), /port/);
  assert.throws(() => resolveOptions({ fixture: '/missing-ui-lab-fixture.json' }), /existing file/);
});

test('UI Lab serves actual bundle and authentic-loader shim without HA bootstrap', async t => {
  const input = fixture(t), server = await serve(t, input);
  const root = await http(server, '/');
  assert.equal(root.status, 200); assert.match(root.body, /UI Lab/);
  const bundle = await http(server, '/assets/houseplan-card.js');
  assert.match(bundle.body, /houseplan-card.js/);
  assert.equal((await http(server, '/assets/icons.js')).status, 200);
  assert.equal((await http(server, '/fixture-state.js')).status, 200);
  assert.equal((await http(server, '/session.mjs')).status, 200);
  assert.deepEqual(JSON.parse((await http(server, '/fixture.json')).body), input.snapshot);
  const app = await http(server, '/frontend_latest/app.test.js');
  assert.equal(app.status, 200); assert.match(app.body, /window\.__hpHaRequire=o/); assert.doesNotMatch(app.body, /o\(7\)/);
  const modules = JSON.parse((await http(server, '/ha-modules.json')).body);
  assert.equal(modules['2'].file, '123.abc.js');
  assert.equal(JSON.parse((await http(server, '/ha-runtime.json')).body).modules.dialog, '2');
  assert.equal((await http(server, '/frontend_latest/core.js')).status, 404);
  assert.match(root.headers['content-security-policy'], /connect-src 'self';/);
  assert.match(root.headers['content-security-policy'], /frame-ancestors 'none';/);
  assert.equal(root.headers['cross-origin-resource-policy'], 'same-origin');
  assert.equal(root.headers['cache-control'], 'no-store');
  const head = await http(server, '/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(Number(head.headers['content-length']), Buffer.byteLength(root.body));
});

test('UI Lab rejects non-loopback Hosts, writes, path traversal and non-allowlisted files', async t => {
  const input = fixture(t), server = await serve(t, input);
  for (const host of ['evil.test', 'localhost.evil.test', '127.0.0.2', '[::1]', `localhost:${server.address().port + 1}`, 'localhost@evil.test']) {
    assert.equal((await http(server, '/', { host })).status, 403, host);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) assert.equal((await http(server, '/fixture.json', { method })).status, 405, method);
  for (const path of ['/../fixture.json', '/%2e%2e/fixture.json', '/assets/%2e%2e/package.json', '/assets%5c..%5cpackage.json', '/assets/%252e%252e/package.json', '/%00', '/%', '//evil.test/']) {
    assert.equal((await http(server, path)).status, 400, path);
  }
  for (const path of ['/package.json', '/config.mjs', '/ha-lock.json', '/server.mjs', '/assets/houseplan-assets.json', '/overrides/private.json', '/theme.css?file=../config.mjs']) {
    assert.equal((await http(server, path)).status, 404, path);
  }
});

test('private fixture identity is path+content derived; provenance never exposes private paths or names', async t => {
  const input = fixture(t);
  const privateFile = write(input.root, 'private-home-A.json', { ...input.snapshot, datasetId: 'user-controlled-collision' });
  const one = await serve(t, { ...input, fixture: privateFile });
  const two = await serve(t, { ...input, fixture: privateFile });
  const copy = write(input.root, 'private-home-B.json', JSON.parse(readFileSync(privateFile)));
  const three = await serve(t, { ...input, fixture: copy });
  const publicLab = await serve(t, input);
  assert.equal(one.provenance.datasetId, two.provenance.datasetId);
  assert.notEqual(one.provenance.datasetId, three.provenance.datasetId);
  assert.notEqual(one.provenance.datasetId, publicLab.provenance.datasetId);
  assert.equal(one.provenance.privateDataset, true);
  assert.equal(publicLab.provenance.privateDataset, false);
  const data = (await http(one, '/provenance.json')).body;
  assert.doesNotMatch(data, /private-home|user-controlled|repoRoot|haCache/);
  assert.equal(data.includes(input.root), false);
  write(input.root, 'private-home-A.json', { ...input.snapshot, states: { 'sensor.example': { state: '2' } } });
  const four = await serve(t, { ...input, fixture: privateFile });
  assert.notEqual(one.provenance.datasetId, four.provenance.datasetId);
});

test('optional theme, named CSS overrides and hashed local images are explicit and read-only', async t => {
  const input = fixture(t), assets = join(input.root, 'images'), overrides = join(input.root, 'overrides');
  const imageName = `${'c'.repeat(64)}.jpg`;
  write(assets, imageName, 'local image'); write(overrides, 'houseplan-card.css', ':host{color:red}');
  write(overrides, 'private.txt', 'not served');
  const theme = write(input.root, 'theme-private.css', ':root{--primary-color:blue}');
  const server = await serve(t, { ...input, assets, overrides, theme });
  assert.match((await http(server, '/theme-local.css')).body, /primary-color:blue/);
  assert.match((await http(server, '/overrides/houseplan-card.css')).body, /color:red/);
  assert.match((await http(server, '/overrides/ha-dialog.css')).body, /No local override/);
  const image = await http(server, `/api/houseplan/content/assets/_/${imageName}`);
  assert.equal(image.status, 200); assert.equal(image.headers['content-type'], 'image/jpeg');
  assert.equal((await http(server, '/api/houseplan/content/assets/_/private.jpg')).status, 404);
  assert.equal((await http(server, '/overrides/private.txt')).status, 404);
});

test('missing, mismatched and tampered product/runtime/fixture inputs fail closed', async t => {
  const input = fixture(t);
  assert.throws(() => createLabServer({ ...input, haCache: join(input.root, 'missing') }), /runtime is missing/);
  const manifestPath = join(input.haCache, 'manifest.json'), manifest = readFileSync(manifestPath);
  write(input.haCache, 'manifest.json', `${manifest}\n`);
  assert.throws(() => createLabServer(input), /manifest integrity mismatch/);
  writeFileSync(manifestPath, manifest);
  write(input.haCache, 'hass_frontend/static/fonts/test.woff2', 'changed');
  assert.throws(() => verifyHaRuntime(input.haCache, input.haLock), /asset integrity mismatch/);
  write(input.haCache, 'hass_frontend/static/fonts/test.woff2', 'font data');
  write(input.labRoot, 'bad.json', '{');
  assert.throws(() => createLabServer({ ...input, fixture: join(input.labRoot, 'bad.json') }), /valid JSON/);
  write(input.labRoot, 'bad.json', { config: {}, layout: [], states: {} });
  assert.throws(() => createLabServer({ ...input, fixture: join(input.labRoot, 'bad.json') }), /objects/);
  for (const invalid of [
    { ...input.snapshot, devices: undefined }, { ...input.snapshot, entities: [] },
    { ...input.snapshot, config: { spaces: {}, markers: [] } },
    { ...input.snapshot, config: { spaces: [], markers: ['not an object'] } },
    { ...input.snapshot, states: { 'sensor.example': 'invalid' } },
    { ...input.snapshot, areas: { invalid: [] } },
    { ...input.snapshot, layout: { invalid: false } },
  ]) {
    write(input.labRoot, 'bad.json', invalid);
    assert.throws(() => createLabServer({ ...input, fixture: join(input.labRoot, 'bad.json') }), /objects|collection shapes/);
  }
  write(input.repoRoot, 'dist/houseplan-card.js', 'mismatch');
  assert.throws(() => createLabServer(input), /bundle is missing or inconsistent/);
});

test('post-start asset tampering is not served and errors do not disclose paths', async t => {
  const input = fixture(t), server = await serve(t, input);
  write(input.haCache, 'hass_frontend/frontend_latest/123.abc.js', 'tampered');
  const response = await http(server, '/frontend_latest/123.abc.js');
  assert.equal(response.status, 500); assert.doesNotMatch(response.body, /tampered|houseplan-ui-lab-test/);
  write(input.repoRoot, 'dist/houseplan-card.js', 'tampered');
  assert.equal((await http(server, '/assets/houseplan-card.js')).status, 500);
});

test('directory symlinks and Windows junctions cannot escape a served root or HTTP route', async t => {
  const input = fixture(t), outside = join(input.root, 'outside'), base = join(input.root, 'base');
  write(outside, 'private.txt', 'private'); write(outside, 'test.woff2', 'private font'); mkdirSync(base);
  try { symlinkSync(outside, join(base, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('OS denied creating a test symlink'); return; } throw error; }
  assert.equal(safeFile(base, 'escape/private.txt'), null);
  assert.equal(safeFile(base, '../outside/private.txt'), null);
  assert.equal(safeFile(base, '..\\outside\\private.txt'), null);
  const server = await serve(t, input);
  const fonts = join(input.haCache, 'hass_frontend/static/fonts');
  rmSync(fonts, { recursive: true });
  symlinkSync(outside, fonts, process.platform === 'win32' ? 'junction' : 'dir');
  const reply = await http(server, '/static/fonts/test.woff2');
  assert.equal(reply.status, 404); assert.doesNotMatch(reply.body, /private font/);
  assert.throws(() => verifyHaRuntime(input.haCache, input.haLock), /asset integrity mismatch/);
});

test('preparer rejects unverified wheel before creating a cache', async t => {
  const input = fixture(t), wheel = write(input.root, 'bad.whl', 'not the official wheel');
  await assert.rejects(prepareHa({ haCache: join(input.root, 'new-cache'), wheel }), /hash\/size mismatch/);
});
