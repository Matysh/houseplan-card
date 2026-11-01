// #1086: bind the authorization decision, not incidental native read arguments.
// Raw inputs/metadata remain separate; old bindings are diagnostic-only.
import { createHash } from 'node:crypto';
import { canonicalCallJson } from './review-call-digest.mjs';
import { READ_ONLY_REVIEW_TOOLS } from './review-capabilities.mjs';

export const NATIVE_CALL_DIGEST_ALGORITHM = 'sha256/hp-review-policy-v2';
export const LEGACY_NATIVE_CALL_DIGEST_ALGORITHM = 'sha256/hp-native-2.1.295-json-v1';
const enabled = value => value === true || value === 'true';

// #1084 compatibility only: never reinterpret a historical mismatch with v2.
export function projectNativeCallInput(name, input) {
  // Validate first: no getters, toJSON, proxies, cycles, nonfinite or sparse data.
  canonicalCallJson(input);
  if (name !== 'Grep' || input === null || typeof input !== 'object' || Array.isArray(input)) return input;
  const copy = Object.create(null);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input)))
    Object.defineProperty(copy, key, { value: descriptor.value, enumerable: true, writable: true, configurable: true });
  if (typeof copy.file_path === 'string' && copy.file_path !== '') {
    if (Object.hasOwn(copy, 'path') && copy.path !== copy.file_path) throw Error('ambiguous native Grep path');
    copy.path = copy.file_path;
    delete copy.file_path;
  }
  for (const [flag, mode] of [['-l', 'files_with_matches'], ['-c', 'count']]) {
    if (!enabled(copy[flag])) continue;
    if (Object.hasOwn(copy, 'output_mode') && copy.output_mode !== mode) throw Error('ambiguous native Grep output mode');
    copy.output_mode = mode;
    delete copy[flag];
  }
  if (enabled(copy['-r'])) delete copy['-r'];
  return copy;
}

export function legacyNativeCallDigest(name, input) {
  if (typeof name !== 'string') throw Error('call name must be a string');
  return createHash('sha256').update(canonicalCallJson({ algorithm: LEGACY_NATIVE_CALL_DIGEST_ALGORITHM,
    name, input: projectNativeCallInput(name, input) })).digest('hex');
}

export function nativeCallDigest(name, input) {
  if (typeof name !== 'string') throw Error('call name must be a string');
  canonicalCallJson(input); // Reject malformed data even when arguments do not govern admission.
  const binding = READ_ONLY_REVIEW_TOOLS.includes(name)
    ? { binding: 'tool-only', name }
    : { binding: 'exact-input', name, input };
  return createHash('sha256').update(canonicalCallJson({ algorithm: NATIVE_CALL_DIGEST_ALGORITHM,
    ...binding })).digest('hex');
}
