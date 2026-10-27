import assert from 'node:assert/strict';
import test from 'node:test';
import { ViewRuntimeBoundary, ViewRuntimeCode, assertViewRuntimeFingerprint, guardedViewRuntimeReload } from '../test-build/view-runtime-boundary.js';

const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const fixture = code => {
  let owner = {}, connected = true, changes = 0;
  const installed = [], host = {};
  const boundary = new ViewRuntimeBoundary(host, code, {
    owner: () => owner, current: token => connected && token === owner,
    install: value => installed.push(value), changed: () => changes++,
  });
  return { boundary, installed, host, changes: () => changes,
    replace: () => { owner = {}; }, disconnect: () => { connected = false; boundary.disconnect(); } };
};

test('#1093 demand disappearing during import prevents installation and permits latest-demand show', async () => {
  const pending=deferred();let demanded=true,installed=0,imports=0;
  const code=new ViewRuntimeCode(()=>{imports++;return pending.promise;});
  const owner={},boundary=new ViewRuntimeBoundary({},code,{owner:()=>owner,current:()=>demanded,
    install:()=>installed++,changed:()=>{}});
  boundary.connect(false);
  const result=boundary.ensure();demanded=false;
  pending.resolve(()=>({}));assert.equal(await result,false);
  assert.equal(installed,0);assert.equal(boundary.state,'idle');
  assert.equal(await boundary.ensure(),false,'hidden demand does not start optional work');
  demanded=true;assert.equal(await boundary.ensure(),true);
  assert.equal(installed,1);assert.equal(imports,1,'return uses code but creates only the current owner runtime');
});

test('#848 AC1/AC2: initial error is visible and ticks never import; one explicit retry has a fresh attempt', async () => {
  const attempts = [];
  const code = new ViewRuntimeCode(async attempt => { attempts.push(attempt); throw Error('root404'); });
  const f = fixture(code); f.boundary.connect();
  await f.boundary.ensure();
  assert.equal(f.boundary.state, 'error'); assert.equal(f.boundary.canRetry, true);
  await Promise.all(Array.from({ length: 10 }, () => f.boundary.ensure()));
  assert.deepEqual(attempts, [0]);
  await Promise.all([f.boundary.retry(), f.boundary.retry(), f.boundary.retry()]);
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(f.boundary.canRetry, false); assert.equal(f.boundary.terminalFailure, true);
  await f.boundary.retry(); await f.boundary.ensure();
  assert.deepEqual(attempts, [0, 1]);
});

test('#848 AC2: a mismatched factory is terminal before construction', async () => {
  let attempts = 0, creates = 0;
  const code = new ViewRuntimeCode(async () => {
    attempts++; assertViewRuntimeFingerprint('foreign', 'entry');
    return () => { creates++; return {}; };
  });
  const f = fixture(code); f.boundary.connect(); await f.boundary.ensure();
  assert.equal(f.boundary.state, 'error'); assert.equal(f.boundary.canRetry, false);
  await f.boundary.retry(); assert.equal(attempts, 1); assert.equal(creates, 0);
});

test('#848 AC6: an explicit in-flight retry retains the error surface until genuine readiness', async () => {
  const retry = deferred();
  const code = new ViewRuntimeCode(attempt => attempt === 0 ? Promise.reject(Error('404')) : retry.promise);
  const f = fixture(code); f.boundary.connect(); await f.boundary.ensure();
  const pending = f.boundary.retry();
  assert.equal(f.boundary.state, 'loading'); assert.equal(f.boundary.unavailable, true);
  assert.equal(f.boundary.canRetry, false);
  retry.resolve(() => ({})); await pending;
  assert.equal(f.boundary.state, 'ready'); assert.equal(f.boundary.unavailable, false);
});

test('#848 AC4: manual reload uses the existing draft decision and rejects retired decisions', () => {
  for (const retire of [false, true]) {
    let current = true, reloads = 0, resume;
    guardedViewRuntimeReload({ current: () => current,
      guard: next => { resume = next; return false; }, reload: () => reloads++ });
    assert.equal(reloads, 0, 'unsaved input cannot be discarded by requesting recovery');
    current = !retire; resume();
    assert.equal(reloads, retire ? 0 : 1);
  }
});

test('#848 AC3/AC4: shared import is immutable code, live hosts receive distinct runtimes; warm adoption is synchronous', async () => {
  const pending = deferred(); let requests = 0;
  const code = new ViewRuntimeCode(() => { requests++; return pending.promise; });
  const a = fixture(code), b = fixture(code); a.boundary.connect(); b.boundary.connect();
  pending.resolve(host => ({ host })); await Promise.all([a.boundary.ensure(), b.boundary.ensure()]);
  assert.equal(requests, 1); assert.equal(a.installed.length, 1); assert.equal(b.installed.length, 1);
  assert.notEqual(a.installed[0], b.installed[0]); assert.equal(a.installed[0].host, a.host);
  const warm = fixture(code); warm.boundary.connect();
  assert.equal(warm.installed.length, 1); assert.equal(warm.boundary.state, 'ready');
});

test('#848 AC4: disconnect and HA retirement suppress construction and every late host update', async () => {
  for (const retire of ['disconnect', 'context']) {
    const pending = deferred(); let creates = 0;
    const code = new ViewRuntimeCode(() => pending.promise);
    const f = fixture(code); f.boundary.connect(); const loading = f.boundary.ensure(), before = f.changes();
    if (retire === 'disconnect') f.disconnect(); else f.replace();
    pending.resolve(() => { creates++; return {}; }); await loading;
    assert.equal(creates, 0, retire); assert.equal(f.installed.length, 0); assert.equal(f.changes(), before);
    if (retire === 'context') {
      await f.boundary.ensure(); assert.equal(creates, 1); assert.equal(f.installed.length, 1);
    }
  }
});
