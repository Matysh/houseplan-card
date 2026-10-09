// #836: build identity of the running frontend (entry URL seam) and of the
// backend (config/get), and the label format shown by the console, «About»
// and the version notice. That the console and «About» actually read the
// running label is proven on the production bundle (demo/smoke_build_identity.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTRY_URL_SEAM, devBuildLabel, entryBuildLabel, formatBuild, knownFingerprint,
} from '../test-build/build-identity.js';
import { adoptCardConfigCapabilities, runningBuild } from '../test-build/version-recovery-card.js';
import { ENTRY_URL_SEAM as BUNDLE_ENTRY_URL_SEAM } from '../scripts/bundle-manifest.mjs';

const SHA = `024b6595${'1'.repeat(32)}`;
const FP = `c0ffee00${'2'.repeat(56)}`;
const ENTRY = 'https://ha.local:8123/houseplan_files/houseplan-card.js';

test('#836 the entry wrapper and the card read one seam name', () => {
  assert.equal(ENTRY_URL_SEAM, BUNDLE_ENTRY_URL_SEAM);
  assert.equal(ENTRY_URL_SEAM, '__HOUSEPLAN_ENTRY_URL__');
});

test('#836 К5: the running label is `dev=<40 hex>` of the entry URL, nothing else', () => {
  assert.deepEqual(entryBuildLabel(`${ENTRY}?v=1.80.1&b=c0ffee00&dev=${SHA}`), { channel: 'dev', source: SHA });
  assert.deepEqual(entryBuildLabel(`${ENTRY}?dev=${SHA}`), { channel: 'dev', source: SHA });
  for (const url of [
    `${ENTRY}?v=1.80.1`,
    `${ENTRY}?v=1.80.1&b=c0ffee00`,
    ENTRY,
    `${ENTRY}?dev=${SHA.slice(0, 8)}`,
    `${ENTRY}?dev=${SHA.toUpperCase()}`,
    `${ENTRY}?dev=${SHA}0`,
    `${ENTRY}?dev=`,
    `${ENTRY}#dev=${SHA}`,
    'not a url',
    '',
    undefined,
    null,
    42,
  ]) assert.equal(entryBuildLabel(url), null, String(url));
});

test('#836 К5: without an argument the label is read from the seam at call time', () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, ENTRY_URL_SEAM);
  try {
    delete globalThis[ENTRY_URL_SEAM];
    assert.equal(entryBuildLabel(), null, 'no seam outside a built entry');
    globalThis[ENTRY_URL_SEAM] = `${ENTRY}?v=1.80.1&dev=${SHA}`;
    assert.deepEqual(entryBuildLabel(), { channel: 'dev', source: SHA });
  } finally {
    if (prior) Object.defineProperty(globalThis, ENTRY_URL_SEAM, prior);
    else delete globalThis[ENTRY_URL_SEAM];
  }
});

test('#836 backend label and fingerprint accept only their exact shapes', () => {
  assert.deepEqual(devBuildLabel({ channel: 'dev', source: SHA }), { channel: 'dev', source: SHA });
  for (const value of [
    null, undefined, 'dev', [SHA], { channel: 'beta', source: SHA }, { channel: 'dev', source: SHA.slice(1) },
    { channel: 'dev', source: SHA.toUpperCase() }, { channel: 'dev' }, { source: SHA },
  ]) assert.equal(devBuildLabel(value), null, JSON.stringify(value));
  assert.equal(knownFingerprint(FP), FP);
  for (const value of [null, undefined, '', '__HOUSEPLAN_SOURCE_FINGERPRINT__', FP.toUpperCase(), FP.slice(1), `${FP}0`, 1]) {
    assert.equal(knownFingerprint(value), null, String(value));
  }
});

test('#836 К7: label format — dev SHA, else fingerprint, else the version as before', () => {
  assert.equal(formatBuild('1.80.1', { channel: 'dev', source: SHA }), '1.80.1 · dev 024b6595');
  assert.equal(formatBuild('1.80.1-beta.1', { channel: 'dev', source: SHA }, FP), '1.80.1-beta.1 · dev 024b6595');
  assert.equal(formatBuild('1.80.1', null, FP), '1.80.1 · c0ffee00');
  assert.equal(formatBuild('1.80.1', null), '1.80.1');
});

test('#836 К4/К6: config/get adoption keeps the backend build; an old backend is unknown', () => {
  let synced = 0;
  const host = { _syncVersionRecovery: () => { synced++; } };
  adoptCardConfigCapabilities(host, {
    integration_version: '1.80.1', frontend_fingerprint: FP, build: { channel: 'dev', source: SHA },
  });
  assert.deepEqual(host._haBackendBuild, { fingerprint: FP, build: { channel: 'dev', source: SHA } });
  assert.equal(host._haIntegrationVersion, '1.80.1');
  adoptCardConfigCapabilities(host, { integration_version: '1.80.1' });
  assert.deepEqual(host._haBackendBuild, { fingerprint: null, build: null }, 'a stale build is cleared');
  adoptCardConfigCapabilities(host, { integration_version: '1.80.1', frontend_fingerprint: 'x', build: {} });
  assert.deepEqual(host._haBackendBuild, { fingerprint: null, build: null });
  assert.equal(synced, 3);

  const prior = Object.getOwnPropertyDescriptor(globalThis, ENTRY_URL_SEAM);
  try {
    delete globalThis[ENTRY_URL_SEAM];
    const running = runningBuild();
    assert.equal(knownFingerprint(running.fingerprint), null, 'unit tests run with the placeholder');
    assert.equal(running.build, null);
    globalThis[ENTRY_URL_SEAM] = `${ENTRY}?v=1.80.1&dev=${SHA}`;
    assert.deepEqual(runningBuild().build, { channel: 'dev', source: SHA }, 'the running side is the entry URL');
  } finally {
    if (prior) Object.defineProperty(globalThis, ENTRY_URL_SEAM, prior);
    else delete globalThis[ENTRY_URL_SEAM];
  }
});
