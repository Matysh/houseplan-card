import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupArchiveClient } from '../test-build/backup-archive-client.js';
import * as archiveModule from '../test-build/backup-archive-client.js';
import { LazyBackupArchiveClient } from '../test-build/backup-archive-lazy.js';

const prepared = (complete = true) => ({ archive: true, token: 'owned', filename: 'copy.zip',
  complete, images: 1, missing: complete ? [] : [{ name: 'Kitchen', reason: 'missing' }], snapshot: [] });
const state = () => ({ kind: 'full', planOnly: false, busy: false, error: '' });
function host(hass) {
  return { hass, isConnected: true, _space: 'one', _backupExportDialog: state(),
    _showToast() {}, _t: key => key };
}
function downloads(t) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const received = [];
  let blob;
  URL.createObjectURL = value => { blob = value; return 'blob:owned'; };
  URL.revokeObjectURL = () => {};
  globalThis.window = { setTimeout: callback => callback() };
  globalThis.document = { body: { append() {} }, createElement: () => ({ style: {}, remove() {},
    click() { received.push({ name: this.download, blob }); } }) };
  t.after(() => {
    globalThis.document = oldDocument; globalThis.window = oldWindow;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  });
  return received;
}

test('incomplete ZIP needs a second distinctly labelled action, bound to its token', async t => {
  const files = downloads(t), requests = [];
  let prepares = 0;
  const owner = host({ user: { is_admin: true }, callWS: async () => { prepares++; return prepared(false); },
    fetchWithAuth: async (path, init) => { requests.push({ path, body: JSON.parse(init.body) });
      return new Response('PK zip', { headers: { 'content-type': 'application/zip' } }); } });
  const client = new BackupArchiveClient(owner);
  await client.export({ card_version: 'review' }, String);
  assert.equal(owner._backupExportDialog.archive.complete, false);
  assert.equal(files.length, 0);
  assert.equal(requests.length, 0);
  await client.export({ card_version: 'review' }, String);
  assert.equal(prepares, 1, 'confirmation must not silently prepare a different archive');
  assert.deepEqual(requests, [{ path: '/api/houseplan/backup/export/owned', body: { confirm_missing_content: true } }]);
  assert.equal(files[0].name, 'copy.zip');
});

test('cancelled delayed prepare is discarded, never downloaded or reopened', async t => {
  const files = downloads(t), calls = [];
  let finish;
  const owner = host({ user: { is_admin: true }, callWS: message => {
    calls.push(message);
    return message.type === 'houseplan/export/create' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ ok: true });
  }, fetchWithAuth: async () => { throw new Error('late transfer'); } });
  const client = new BackupArchiveClient(owner);
  const task = client.export({ card_version: 'review' }, String);
  await Promise.resolve(); // The request is actually in flight before cancellation.
  client.cancelExport(); owner._backupExportDialog = null;
  finish(prepared()); await task;
  assert.equal(files.length, 0);
  assert.equal(owner._backupExportDialog, null);
  assert.equal(calls.at(-1).type, 'houseplan/backup/cancel');
});

test('late blob after dialog close is not downloaded even if transport ignores AbortSignal', async t => {
  const files = downloads(t);
  let finish, fetched;
  const ready = new Promise(resolve => { fetched = resolve; });
  const owner = host({ user: { is_admin: true }, callWS: async message => message.type === 'houseplan/export/create' ? prepared() : {},
    fetchWithAuth: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/zip' }),
      blob: () => { fetched(); return new Promise(resolve => { finish = resolve; }); } }) });
  const client = new BackupArchiveClient(owner);
  const task = client.export({ card_version: 'review' }, String);
  await ready;
  client.cancelExport(); owner._backupExportDialog = null;
  finish(new Blob(['ZIP'])); await task;
  assert.equal(files.length, 0);
});

test('ordinary editor keeps full JSON and never requests archive privilege', async t => {
  const files = downloads(t), requests = [];
  const owner = host({ user: { is_admin: false }, callWS: async message => {
    requests.push(message); return { document: { original: true }, filename: 'old.json' };
  } });
  await new BackupArchiveClient(owner).export({ card_version: 'review' }, String);
  assert.equal(requests[0].archive, undefined);
  assert.equal(requests[0].card_version, 'review');
  assert.equal(files[0].name, 'old.json');
  assert.deepEqual(JSON.parse(await files[0].blob.text()), { original: true });
});

test('late blob from cancelled export cannot steal a newer prepared token', async t => {
  const files = downloads(t), cancelled = [];
  let finish, fetched, prepares = 0;
  const ready = new Promise(resolve => { fetched = resolve; });
  const owner = host({ user: { is_admin: true }, callWS: async message => {
    if (message.type === 'houseplan/backup/cancel') { cancelled.push(message.token); return {}; }
    prepares++;
    return { ...prepared(prepares === 1), token: prepares === 1 ? 'old' : 'new' };
  }, fetchWithAuth: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/zip' }), blob: () => {
    fetched(); return new Promise(resolve => { finish = resolve; });
  } }) });
  const client = new BackupArchiveClient(owner);
  const old = client.export({ card_version: 'review' }, String);
  await ready; client.cancelExport(); owner._backupExportDialog = state();
  await client.export({ card_version: 'review' }, String);
  assert.equal(owner._backupExportDialog.archive.token, 'new');
  finish(new Blob(['old'])); await old;
  client.cancelExport(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(cancelled, ['old', 'new']);
  assert.equal(files.length, 0);
});

test('ZIP magic cannot bypass ordinary-editor refusal with a JSON filename', async () => {
  let fetches = 0;
  const owner = host({ user: { is_admin: false }, callWS: async () => {},
    fetchWithAuth: async () => { fetches++; } });
  await assert.rejects(new BackupArchiveClient(owner).preview(new File(['PK\x03\x04'], 'renamed.json')), { code: 'zip_admin_only' });
  assert.equal(fetches, 0);
});

test('legacy JSON bytes go unchanged to the existing server preview, without browser parsing', async () => {
  const file = new File(['not valid JSON: server decides'], 'old.json');
  let observed;
  const owner = host({ user: { is_admin: false }, callWS: async () => {},
    fetchWithAuth: async (path, init) => {
      observed = { path, body: init.body };
      return Response.json({ token: 'json', preview: {}, expected_config_rev: 1, expected_layout_rev: 1 });
    } });
  await new BackupArchiveClient(owner).preview(file);
  assert.equal(observed.path, '/api/houseplan/import/preview?duplicate_policy=skip');
  assert.equal(observed.body, file);
});

test('closing a cold backup loader cannot start a delayed export request or reopen the dialog', async () => {
  let finish, requests = 0;
  const owner = host({ user: { is_admin: true }, callWS: async () => { requests++; return prepared(false); } });
  const cold = new Promise(resolve => { finish = resolve; });
  const client = new LazyBackupArchiveClient(owner, () => cold);
  const pending = client.export({ card_version: 'review' }, String);
  assert.equal(owner._backupExportDialog.busy, true);
  client.cancelExport(); owner._backupExportDialog = null;
  finish(archiveModule); await pending;
  assert.equal(requests, 0);
  assert.equal(owner._backupExportDialog, null);
});

test('closing a cold import loader sends no upload after its script arrives', async () => {
  let finish, requests = 0;
  const owner = host({ user: { is_admin: true }, callWS: async () => {},
    fetchWithAuth: async () => { requests++; } });
  const cold = new Promise(resolve => { finish = resolve; });
  const client = new LazyBackupArchiveClient(owner, () => cold);
  const pending = client.preview(new File(['PK'], 'copy.zip'));
  client.cancelImport(); finish(archiveModule);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requests, 0);
});

test('proxy HTML rejection of a large ZIP is a friendly size error, not a JSON parser exception', async () => {
  const owner = host({ user: { is_admin: true }, callWS: async () => {},
    fetchWithAuth: async () => new Response('<h1>Request too large</h1>', { status: 413 }) });
  await assert.rejects(new BackupArchiveClient(owner).preview(new File(['PK'], 'copy.zip')), { code: 'zip_limit' });
});

for (const status of [200, 502]) test(`HTML download response (${status}) leaves an actionable error and no fake ZIP`, async t => {
  const files = downloads(t);
  const owner = host({ user: { is_admin: true }, callWS: async () => prepared(),
    fetchWithAuth: async () => new Response('<h1>Gateway error</h1>', { status,
      headers: { 'content-type': 'text/html' } }) });
  await new BackupArchiveClient(owner).export({ card_version: 'review' }, error => error.code || error.name);
  assert.equal(files.length, 0);
  assert.equal(owner._backupExportDialog.error, 'zip_invalid');
});

test('cancel during response-body read releases the known operation before the next ZIP upload', async () => {
  const active = new Set(), log = [];
  let reading, first = true;
  const ready = new Promise(resolve => { reading = resolve; });
  const owner = host({ user: { is_admin: true }, callWS: async message => {
    log.push(message); active.delete(message.operation_id); return { ok: true };
  }, fetchWithAuth: async (_path, init) => {
    const id = init.headers['x-houseplan-operation'];
    assert.match(id, /^[0-9a-f]{32}$/);
    log.push({ upload: id });
    if (active.size) return Response.json({ error: 'zip_busy' }, { status: 400 });
    active.add(id);
    if (first) {
      first = false;
      return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
        reading();
      }) };
    }
    return Response.json({ token: 'fresh-preview', preview: { archive: {} } });
  } });
  const client = new BackupArchiveClient(owner);
  const pending = client.preview(new File(['PK'], 'first.zip'));
  await ready;
  client.cancelImport();
  await assert.rejects(pending);
  const next = await client.preview(new File(['PK'], 'next.zip'));
  assert.equal(next.token, 'fresh-preview');
  assert.equal(active.size, 1, 'only the live, not the cancelled, preview owns the server slot');
  const uploads = log.filter(row => row.upload);
  assert.notEqual(uploads[0].upload, uploads[1].upload);
  assert.ok(log.some(row => row.operation_id === uploads[0].upload), 'cancel does not require an unreceived preview token');
  client.cancelImport();
});

test('a late cancelled ZIP reply cannot clear a newer operation, even if transport ignores abort', async () => {
  let finish, started;
  const calls = [], ready = new Promise(resolve => { started = resolve; });
  let count = 0;
  const owner = host({ user: { is_admin: true }, callWS: async message => { calls.push(message); return {}; },
    fetchWithAuth: async () => {
      if (++count === 1) { started(); return new Promise(resolve => { finish = resolve; }); }
      return Response.json({ token: 'new', preview: {} });
    } });
  const client = new BackupArchiveClient(owner);
  const old = client.preview(new File(['PK'], 'old.zip'));
  await ready; client.cancelImport();
  await client.preview(new File(['PK'], 'new.zip'));
  finish(Response.json({ token: 'old', preview: {} }));
  await assert.rejects(old, { name: 'AbortError' });
  client.cancelImport();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(new Set(calls.filter(row => row.operation_id).map(row => row.operation_id)).size, 2);
  assert.ok(calls.some(row => row.token === 'old'), 'late opaque token is discarded as well');
});

test('lost cancel ACK is retried before a fresh upload, and invalid replies are cancelled too', async () => {
  const calls = [];
  let cancels = 0, uploads = 0;
  const owner = host({ user: { is_admin: true }, callWS: async message => {
    calls.push(message);
    if (++cancels === 1) throw new Error('connection lost');
    return {};
  }, fetchWithAuth: async (_path, init) => {
    calls.push({ upload: init.headers['x-houseplan-operation'] });
    return ++uploads === 1 ? new Response('broken body') : Response.json({ token: 'next', preview: {} });
  } });
  const client = new BackupArchiveClient(owner);
  await assert.rejects(client.preview(new File(['PK'], 'bad.zip')), { code: 'zip_invalid' });
  assert.equal((await client.preview(new File(['PK'], 'good.zip'))).token, 'next');
  const first = calls[0].upload, nextIndex = calls.findIndex((row, index) => index > 0 && row.upload);
  assert.equal(calls.filter(row => row.operation_id === first).length, 2);
  assert.ok(nextIndex > calls.findLastIndex(row => row.operation_id === first));
  client.cancelImport();
});

test('losing ZIP admin rights cannot strand an otherwise permitted legacy JSON import', async () => {
  const calls = [];
  const owner = host({ user: { is_admin: true }, callWS: async message => {
    calls.push(message);
    if (!owner.hass.user.is_admin) throw Object.assign(new Error('not an admin'), { code: 'unauthorized' });
    return {};
  }, fetchWithAuth: async path => {
    calls.push({ path });
    return Response.json({ token: path.includes('/backup/') ? 'zip' : 'json', preview: {} });
  } });
  const client = new BackupArchiveClient(owner);
  await client.preview(new File(['PK'], 'archive.zip'));
  owner.hass.user.is_admin = false;
  const next = await client.preview(new File(['{}'], 'old.json'));
  assert.equal(next.token, 'json');
  assert.ok(calls.some(row => row.operation_id));
  assert.equal(calls.at(-1).path, '/api/houseplan/import/preview?duplicate_policy=skip');
});
