import type { OpeningCfg } from './types';
import { effectiveSwingDoorPosition } from './opening-symbol-placement';
/** Persistent keys describe inputs, never a particular mounted card/connection. */
import { sha256 } from './sha256';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { physicalSpaceRecord, PHYSICAL_PRESENTATION_FIELDS } from './structural-space-record';

export const FLOOR_CACHE_FORMAT = 1;
export const FLOOR_CACHE_ALGORITHM = 1;

/** Stable JSON retains unknown fields, array order and absent/null distinctions. */
export function canonicalCacheInput(value: unknown): string {
  const ancestors = new Set<object>();
  const visit = (input: unknown, depth = 0): string => {
    if (depth > 96) throw new Error('floor-cache:input-depth');
    if (input === undefined) return '["undefined"]';
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return JSON.stringify(input);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new Error('floor-cache:non-finite-input');
      return Object.is(input, -0) ? '["negative-zero"]' : String(input);
    }
    if (typeof input === 'bigint') return '["bigint",' + JSON.stringify(String(input)) + ']';
    if (typeof input !== 'object' || ancestors.has(input)) throw new Error('floor-cache:invalid-input');
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
      throw new Error('floor-cache:invalid-input');
    ancestors.add(input);
    try {
      if (Array.isArray(input)) return '["array",[' + input.map(value => visit(value, depth + 1)).join(',') + ']]';
      const object = input as Record<string, unknown>;
      return '["object",[' + Object.keys(object).sort().map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (!descriptor || !('value' in descriptor)) throw new Error('floor-cache:input-getter');
        return '[' + JSON.stringify(key) + ',' + visit(descriptor.value, depth + 1) + ']';
      }).join(',') + ']]';
    } finally { ancestors.delete(input); }
  };
  return visit(value);
}

export function cacheSha256(value: unknown): string {
  return Array.from(sha256(canonicalCacheInput(value)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface FloorCacheKeys {
  physical: string;
  clean: string;
  iso: string;
  /** Display-independent but clean-floor-aware identity of one payload. */
  geometry: string;
}

export function floorCacheKeys(model: unknown, current: unknown, cellCm: number, gridPitch: number): FloorCacheKeys {
  const physical = (record: unknown) => physicalSpaceRecord(record, ...PHYSICAL_PRESENTATION_FIELDS);
  const clean = (record: unknown) => physicalSpaceRecord(record, ...PHYSICAL_PRESENTATION_FIELDS.filter(field => field !== 'stairs'));
  const pair = (project: (record: unknown) => unknown) => [project(model), project(current)];
  // Conservative cross-build invalidation also covers future fixes to shared
  // producers whose author did not remember to bump this local algorithm id.
  const salt = [FLOOR_CACHE_FORMAT, FLOOR_CACHE_ALGORITHM, ENTRY_BUILD_FINGERPRINT, cellCm, gridPitch];
  const physicalKey = cacheSha256([salt, pair(physical)]);
  const cleanKey = cacheSha256([salt, pair(clean)]);
  // Opening presentation changes the cached 2.5D basis (leaves/frames)
  // independently of the masonry and optical geometry.
  const features = (record: unknown) => record && typeof record === 'object'
    ? (record as { openings?: OpeningCfg[] }).openings?.map(opening => opening && typeof opening === 'object'
      ? [opening.id, opening.opening_features, effectiveSwingDoorPosition(opening)] : opening) : undefined;
  return { physical: physicalKey, clean: cleanKey, iso: cacheSha256([physicalKey, pair(features)]),
    geometry: cacheSha256([physicalKey, cleanKey]) };
}
