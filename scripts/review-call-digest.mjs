// #1065: call equality ignores ONLY JSON object key insertion order.
import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

export const CALL_DIGEST_ALGORITHM = 'sha256/hp-json-keys-v1';
export const LEGACY_CALL_DIGEST_ALGORITHM = 'sha256/json-stringify-v1';
const hash = text => createHash('sha256').update(text).digest('hex');

export function canonicalCallJson(value) {
  const ancestors = new Set();
  function encode(item) {
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new Error('non-JSON call value');
      return Object.is(item, -0) ? '-0' : JSON.stringify(item);
    }
    if (typeof item !== 'object' || isProxy(item) || ancestors.has(item)) throw new Error('non-JSON or cyclic call value');
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('non-JSON call object');
    const descriptors = Object.getOwnPropertyDescriptors(item), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string')) throw new Error('non-JSON call key');
    ancestors.add(item);
    try {
      if (array) {
        const length = descriptors.length.value;
        if (keys.length !== length + 1) throw new Error('sparse or extended call array');
        const values = [];
        for (let index = 0; index < length; index++) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('non-JSON call array element');
          values.push(encode(descriptor.value));
        }
        return '[' + values.join(',') + ']';
      }
      return '{' + keys.sort().map(key => {
        const descriptor = descriptors[key];
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('non-JSON call property');
        return JSON.stringify(key) + ':' + encode(descriptor.value);
      }).join(',') + '}';
    } finally { ancestors.delete(item); }
  }
  return encode(value);
}

export function callDigest(name, input) {
  if (typeof name !== 'string') throw new Error('call name must be a string');
  return hash(canonicalCallJson({ name, input }));
}

// Diagnostic compatibility only. Current hook/audit never fall back to this.
export const legacyCallDigest = (name, input) => hash(JSON.stringify({ name, input }));
