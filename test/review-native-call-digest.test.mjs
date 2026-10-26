import test from 'node:test';
import assert from 'node:assert/strict';
import { CALL_DIGEST_ALGORITHM, callDigest, canonicalCallJson } from '../scripts/review-call-digest.mjs';
import { NATIVE_CALL_DIGEST_ALGORITHM, nativeCallDigest as policyDigest,
  LEGACY_NATIVE_CALL_DIGEST_ALGORITHM, legacyNativeCallDigest as nativeCallDigest,
  projectNativeCallInput } from '../scripts/review-native-call-digest.mjs';
import { READ_ONLY_REVIEW_TOOLS } from '../scripts/review-capabilities.mjs';

test('#1086 read authorization binds exact native tool identity, independent of read arguments', () => {
  assert.equal(NATIVE_CALL_DIGEST_ALGORITHM, 'sha256/hp-review-policy-v2');
  assert.equal(LEGACY_NATIVE_CALL_DIGEST_ALGORITHM, 'sha256/hp-native-2.1.295-json-v1');
  const inputs = [{ file_path: 'PROCESS.md' }, { file_path: '/repo/PROCESS.md', offset: 1 },
    { pattern: 'x', '-l': true }, { pattern: 'x', output_mode: 'files_with_matches' },
    { query: 'select:mcp__houseplan_review__run_check' }, { unknown: [1, '1', null] }];
  for (const name of READ_ONLY_REVIEW_TOOLS) {
    const expected = policyDigest(name, {});
    for (const input of inputs) assert.equal(policyDigest(name, Object.freeze(input)), expected);
    for (const other of READ_ONLY_REVIEW_TOOLS.filter(other => other !== name))
      assert.notEqual(policyDigest(other, {}), expected, 'even another admitted tool needs its own hook decision');
    assert.notEqual(expected, nativeCallDigest(name, {}), 'historical records cannot gain current authority');
  }
});

test('#1086 writes, checks, output and unknown tools retain exact canonical inputs', () => {
  for (const name of ['Write', 'mcp__houseplan_review__run_check', 'StructuredOutput', 'Bash',
    'read', 'mcp__example__Read', 'Other']) {
    const input = { file_path: '/tmp/report.md', content: 'review', check_id: 'unit:test/a.test.mjs', values: [1, 2] };
    const expected = policyDigest(name, input);
    assert.equal(policyDigest(name, { values: [1, 2], check_id: input.check_id, content: 'review', file_path: input.file_path }), expected);
    for (const changed of [{ ...input, file_path: '/tmp/other.md' }, { ...input, content: 'review ' },
      { ...input, check_id: 'unit:test/b.test.mjs' }, { ...input, values: [2, 1] },
      { ...input, values: ['1', 2] }, { ...input, extra: false }])
      assert.notEqual(policyDigest(name, changed), expected);
    assert.notEqual(policyDigest('Read', input), expected);
  }
});

test('#1086 tool-only binding still rejects malformed JSON without callbacks', () => {
  let invoked = 0;
  const cyclic = {}; cyclic.self = cyclic;
  for (const name of [...READ_ONLY_REVIEW_TOOLS, 'Write'])
    for (const input of [{ get file_path() { invoked++; return 'x'; } },
      { toJSON() { invoked++; return {}; } }, cyclic, new Array(2), { value: undefined },
      { value: Infinity }, new Proxy({}, {})]) assert.throws(() => policyDigest(name, input));
  assert.equal(invoked, 0);
});

test('#1084 pinned Grep aliases bind to their exact native forms without mutating inputs', () => {
  for (const truth of [true, 'true']) for (const [flag, output_mode] of [['-l', 'files_with_matches'], ['-c', 'count']]) {
    const input = Object.freeze({ pattern: 'needle', path: 'src', [flag]: truth });
    assert.equal(nativeCallDigest('Grep', input), nativeCallDigest('Grep', { pattern: 'needle', path: 'src', output_mode }));
    assert.equal(input[flag], truth);
    assert.equal(nativeCallDigest('Grep', { ...input, output_mode }), nativeCallDigest('Grep', { pattern: 'needle', path: 'src', output_mode }));
  }
  assert.equal(nativeCallDigest('Grep', { pattern: 'needle', file_path: 'src' }), nativeCallDigest('Grep', { pattern: 'needle', path: 'src' }));
  assert.equal(nativeCallDigest('Grep', { pattern: 'needle', file_path: 'src', path: 'src', '-r': true }), nativeCallDigest('Grep', { pattern: 'needle', path: 'src' }));
  assert.equal(nativeCallDigest('Grep', { pattern: 'needle', '-r': 'true' }), nativeCallDigest('Grep', { pattern: 'needle' }));
});

test('#1084 ambiguous aliases refuse rather than selecting a convenient value', () => {
  for (const input of [{ '-l': true, output_mode: 'count' }, { '-c': true, output_mode: 'content' },
    { '-l': true, '-c': true }, { file_path: 'a', path: 'b' }, { '-l': 'true', output_mode: null }])
    assert.throws(() => nativeCallDigest('Grep', { pattern: 'x', ...input }), /ambiguous/);
});

test('#1084 false-like values, unknown keys and every other JSON value remain significant', () => {
  const canonical = { pattern: 'needle', path: 'src', output_mode: 'files_with_matches' };
  for (const value of [false, 'false', null, 0, 1, '1', '', [], {}])
    assert.notEqual(nativeCallDigest('Grep', { pattern: 'needle', path: 'src', '-l': value }), nativeCallDigest('Grep', canonical));
  for (const value of [false, 'false', 1, null, ''])
    assert.notEqual(nativeCallDigest('Grep', { pattern: 'needle', '-r': value }), nativeCallDigest('Grep', { pattern: 'needle' }));
  for (const changed of [{ ...canonical, pattern: 'needle ' }, { ...canonical, path: './src' },
    { ...canonical, output_mode: 'content' }, { ...canonical, unknown: true }, { pattern: 'needle', path: 'src', flag_l: true }, { ...canonical, pattern: 'é' },
    { ...canonical, pattern: 'e\u0301' }, { ...canonical, extra: [2, 1] }, { ...canonical, extra: [1, 2] }])
    assert.notEqual(nativeCallDigest('Grep', changed), nativeCallDigest('Grep', canonical));
  const input = JSON.parse('{"pattern":"x","-l":true,"__proto__":{"safe":1},"constructor":2}');
  input.zero = -0; input.array = Object.freeze([1, 2]); Object.freeze(input);
  const before = canonicalCallJson(input), result = projectNativeCallInput('Grep', input);
  assert.equal(canonicalCallJson(input), before);
  assert.equal(Object.is(result.zero, -0), true);
  assert.equal(result.array, input.array);
  assert.deepEqual(result.__proto__, { safe: 1 }); assert.equal(result.constructor, 2);
  assert.notEqual(nativeCallDigest('Grep', { ...result, zero: 0 }), nativeCallDigest('Grep', result));
});

test('#1084 projection is exact-tool-only and the old digest algorithm is unchanged', () => {
  const raw = { pattern: 'x', '-l': true }, normalized = { pattern: 'x', output_mode: 'files_with_matches' };
  assert.equal(CALL_DIGEST_ALGORITHM, 'sha256/hp-json-keys-v1');
  assert.notEqual(NATIVE_CALL_DIGEST_ALGORITHM, CALL_DIGEST_ALGORITHM);
  assert.notEqual(callDigest('Grep', raw), callDigest('Grep', normalized));
  for (const name of ['Read', 'Write', 'grep', 'mcp__example__Grep', 'StructuredOutput']) {
    assert.equal(projectNativeCallInput(name, raw), raw);
    assert.notEqual(nativeCallDigest(name, raw), nativeCallDigest(name, normalized));
  }
  assert.notEqual(nativeCallDigest('Grep', raw), nativeCallDigest('Read', raw));
});

test('#1084 JSON validation precedes projection and never invokes user callbacks', () => {
  let invoked = 0;
  const getter = { pattern: 'x', get file_path() { invoked++; return 'src'; } };
  const toJSON = { pattern: 'x', toJSON() { invoked++; return {}; } };
  const cyclic = {}; cyclic.self = cyclic;
  const sparse = new Array(2);
  for (const value of [getter, toJSON, cyclic, sparse, { n: NaN }, { n: Infinity }, { n: undefined },
    { n: 1n }, new Date(), new Proxy({}, {})]) assert.throws(() => nativeCallDigest('Grep', value));
  assert.equal(invoked, 0);
});
