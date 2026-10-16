/** Local-only bounded reader for one Easy Floorplan card, never a dashboard. */
import { isAlias, isMap, isScalar, isSeq, parseDocument } from 'yaml';

export const MAX_EASY_BYTES = 8 * 1024 * 1024;
export const MAX_EASY_DEPTH = 64;
export const MAX_EASY_NODES = 100000;
export const MAX_EASY_GEOMETRY = 5000;
const ARRAY_FIELDS = ['walls', 'areas', 'openings', 'items', 'furniture', 'texts', 'trackers'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', '<<']);

export class EasyInputError extends Error {
  constructor(code, detail = '') {
    super(detail || code);
    this.name = 'EasyInputError';
    this.code = code;
  }
}

const fail = (code, path) => { throw new EasyInputError(code, path); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Inspect the AST BEFORE toJS can expand anything or construct object keys. */
function checkTree(root) {
  let nodes = 0;
  const walk = (node, depth, path) => {
    if (++nodes > MAX_EASY_NODES || depth > MAX_EASY_DEPTH) fail('easy_too_complex', path);
    if (node == null) return;
    if (isAlias(node) || node.anchor || node.tag) fail('easy_unsafe_yaml', path);
    if (isScalar(node)) {
      if (typeof node.value === 'number' && !Number.isFinite(node.value))
        fail('easy_non_finite', path);
      return;
    }
    if (isSeq(node)) {
      for (const [index, child] of node.items.entries()) walk(child, depth + 1, `${path}[${index}]`);
      return;
    }
    if (isMap(node)) {
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') fail('easy_invalid_key', path);
        const key = pair.key.value;
        if (FORBIDDEN_KEYS.has(key)) fail('easy_unsafe_yaml', `${path}.${key}`);
        walk(pair.key, depth + 1, path);
        walk(pair.value, depth + 1, `${path}.${key}`);
      }
      return;
    }
    fail('easy_invalid_yaml', path);
  };
  walk(root, 0, '$');
}

/** No network, source URL resolution, implicit card search or execution. */
export function readEasy(text) {
  if (typeof text !== 'string' || !text.trim()) fail('easy_empty', '$');
  if (new TextEncoder().encode(text).length > MAX_EASY_BYTES) fail('easy_file_too_large', '$');
  // Directives are not useful in a card config. This is an input restriction,
  // not a YAML parser; all syntax and duplicate keys are handled by yaml below.
  if (/^%/m.test(text.replace(/^\uFEFF/, ''))) fail('easy_unsafe_yaml', '$');
  let document;
  try {
    document = parseDocument(text, {
      schema: 'core', version: '1.2', uniqueKeys: true, strict: true,
      customTags: [], resolveKnownTags: false, prettyErrors: false,
    });
  } catch {
    fail('easy_invalid_yaml', '$');
  }
  if (document.errors.length || document.warnings.length) fail('easy_invalid_yaml', '$');
  checkTree(document.contents);
  const config = document.toJS({ maxAliasCount: 0 });
  if (!record(config) || config.type !== 'custom:easy-floorplan-card') fail('easy_not_card', '$.type');
  for (const key of ['width', 'height']) {
    if (config[key] !== undefined && (typeof config[key] !== 'number' || !(config[key] > 0)))
      fail('easy_invalid_size', `$.${key}`);
  }
  if (config.floors !== undefined && !Array.isArray(config.floors)) fail('easy_invalid_floors', '$.floors');
  const explicit = config.floors?.length > 0;
  const floors = explicit ? config.floors : [config];
  let geometry = 0;
  for (const [index, floor] of floors.entries()) {
    const path = explicit ? `$.floors[${index}]` : '$';
    if (!record(floor)) fail('easy_invalid_floor', path);
    for (const key of ARRAY_FIELDS) {
      if (floor[key] === undefined) continue;
      if (!Array.isArray(floor[key])) fail('easy_invalid_collection', `${path}.${key}`);
      geometry += floor[key].length;
      if (geometry > MAX_EASY_GEOMETRY) fail('easy_too_complex', path);
      for (const [itemIndex, item] of floor[key].entries())
        if (!record(item)) fail('easy_invalid_object', `${path}.${key}[${itemIndex}]`);
    }
  }
  return config;
}

export function easyFloors(config) {
  return config.floors?.length ? config.floors : [{
    ...Object.fromEntries([...ARRAY_FIELDS, 'image', 'imageFit', 'imageOpacity']
      .filter(key => config[key] !== undefined).map(key => [key, config[key]])),
    id: 'main', name: config.title || 'Floor',
  }];
}
