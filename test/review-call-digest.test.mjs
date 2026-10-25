import test from 'node:test';
import assert from 'node:assert/strict';
import { CALL_DIGEST_ALGORITHM, canonicalCallJson, callDigest } from '../scripts/review-call-digest.mjs';

test('#1065 canonical call equality changes only object key order, at every nesting level', () => {
  const a = { command: 'ordinary exact text', description: 'same', timeout: 1000,
    nested: [{ z: null, a: { '10': 10, '2': 2, constructor: 'data' } }, true] };
  const b = { nested: [{ a: { constructor: 'data', '2': 2, '10': 10 }, z: null }, true],
    timeout: 1000, command: 'ordinary exact text', description: 'same' };
  assert.equal(callDigest('Bash', a), callDigest('Bash', b));
  assert.equal(CALL_DIGEST_ALGORITHM, 'sha256/hp-json-keys-v1');
  assert.equal(canonicalCallJson(JSON.parse('{"constructor":2,"__proto__":1,"2":2,"10":10}')),
    '{"10":10,"2":2,"__proto__":1,"constructor":2}');
  assert.equal(Object.prototype.polluted, undefined);
});

for (const [a, b] of [
  [{ x: 'text' }, { x: 'text ' }], [{ x: '\n' }, { x: '\r\n' }],
  [{ x: '\u00e9' }, { x: 'e\u0301' }], [{ x: '\ud800' }, { x: '\ufffd' }],
  [{ x: 1 }, { x: '1' }], [{ x: 1 }, { x: 1.0000000000000002 }], [{ x: false }, { x: 0 }],
  [{ x: null }, {}], [{ x: null }, { x: null, extra: null }], [{ x: 0 }, { x: -0 }],
  [[0, -0], [-0, 0]], [[1, 2], [2, 1]], [{ a: 1 }, { b: 1 }],
  [{ content: 'full report\n' }, { content: 'full report' }],
]) test('#1065 call digest distinguishes exact strings, values, types, keys, report bytes and array order', () => {
  assert.notEqual(callDigest('Read', a), callDigest('Read', b));
});

test('#1065 call name and signed zero remain significant; shared noncyclic JSON is valid', () => {
  assert.notEqual(callDigest('Read', { x: 1 }), callDigest('Write', { x: 1 }));
  assert.equal(canonicalCallJson(-0), '-0'); assert.equal(canonicalCallJson(0), '0');
  const part = { a: 1 };
  assert.equal(canonicalCallJson([part, part]), '[{"a":1},{"a":1}]');
  assert.equal(canonicalCallJson(Object.assign(Object.create(null), { safe: null })), '{"safe":null}');
});

test('#1065 unsupported JSON data fails without dropping fields, running accessors/toJSON or proxy traps', () => {
  let calls = 0;
  const cycle = {}; cycle.self = cycle;
  const accessor = Object.defineProperty({}, 'x', { enumerable: true, get() { calls++; return 1; } });
  const toJSON = { toJSON() { calls++; return 'hidden'; } };
  const proxy = new Proxy({}, { getPrototypeOf() { calls++; return Object.prototype; } });
  const sparse = []; sparse.length = 2;
  const extended = [1]; extended.extra = 2;
  const hidden = Object.defineProperty({}, 'hidden', { value: 1 });
  const symbol = { [Symbol('hidden')]: 1 };
  const subclass = new (class extends Array {})();
  for (const value of [undefined, () => 1, Symbol('value'), 1n, NaN, Infinity, -Infinity,
    { omitted: undefined }, new Date(), new Map(), new Number(1), cycle, accessor, toJSON,
    proxy, sparse, extended, hidden, symbol, subclass]) assert.throws(() => canonicalCallJson(value));
  assert.equal(calls, 0);
  assert.throws(() => callDigest(undefined, {}));
});
