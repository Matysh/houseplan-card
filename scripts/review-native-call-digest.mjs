// #1084: binding projection for the pinned native 2.1.295 Grep input protocol.
// Raw inputs/metadata and admission decisions are never rewritten by this helper.
import { createHash } from 'node:crypto';
import { canonicalCallJson } from './review-call-digest.mjs';

export const NATIVE_CALL_DIGEST_ALGORITHM = 'sha256/hp-native-2.1.295-json-v1';
const enabled = value => value === true || value === 'true';

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

export function nativeCallDigest(name, input) {
  if (typeof name !== 'string') throw Error('call name must be a string');
  return createHash('sha256').update(canonicalCallJson({ algorithm: NATIVE_CALL_DIGEST_ALGORITHM,
    name, input: projectNativeCallInput(name, input) })).digest('hex');
}
