/** A bounded data graph, not structuredClone of runtime classes (#1454).
 * Shared references, hidden fields, exact integers and paint/run proofs cross
 * the same boundary for disk and workers. No getters or executable values do. */
import { exactPaintRingProof, registerExactPaintRing } from './polygon-paint';
import { captureGraphOpeningRun, restoreGraphOpeningRun, type RunMetadata } from './graph-opening-run';

type Value = null | string | number | boolean | { r: number } | { b: string } | { u: true } | { z: true };
type Node = { kind: 'array'; values: Value[]; proof?: boolean }
  | { kind: 'map'; entries: [Value, Value][] }
  | { kind: 'object'; fields: [string, Value, boolean][]; run?: Value };
export interface GeometryWire { version: 1; root: Value; nodes: Node[]; proofs: number; runs: number }
export const FLOOR_CACHE_MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_NODES = 200_000, MAX_DEPTH = 96, MAX_INTEGER_DIGITS = 4096;
const forbidden = (key: string) => key === '__proto__' || key === 'prototype' || key === 'constructor';
const error = (): never => { throw new Error('floor-cache:invalid-payload'); };

export function encodeGeometryValue(input: unknown): GeometryWire {
  const nodes: Node[] = [], seen = new Map<object, number>(), active = new Set<object>();
  let proofs = 0, runs = 0;
  const encode = (value: unknown, depth: number): Value => {
    if (depth > MAX_DEPTH) return error();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return error();
      return Object.is(value, -0) ? { z: true } : value;
    }
    if (value === undefined) return { u: true };
    if (typeof value === 'bigint') {
      const integer = String(value); if (integer.length > MAX_INTEGER_DIGITS) return error();
      return { b: integer };
    }
    if (typeof value !== 'object' || active.has(value)) return error();
    const known = seen.get(value);
    if (known !== undefined) return { r: known };
    if (nodes.length >= MAX_NODES) return error();
    const id = nodes.length;
    seen.set(value, id); active.add(value);
    nodes.push({ kind: 'array', values: [] });
    try {
      if (Array.isArray(value)) {
        const proof = exactPaintRingProof(value);
        if (proof !== undefined) proofs++;
        nodes[id] = { kind: 'array', values: value.map(item => encode(item, depth + 1)), ...(proof === undefined ? {} : { proof }) };
      } else if (value instanceof Map) {
        nodes[id] = { kind: 'map', entries: [...value].map(([key, item]) => [encode(key, depth + 1), encode(item, depth + 1)]) };
      } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return error();
        const fields: [string, Value, boolean][] = [];
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
          if (forbidden(key) || !('value' in descriptor)) return error();
          fields.push([key, encode(descriptor.value, depth + 1), !!descriptor.enumerable]);
        }
        const run = captureGraphOpeningRun(value);
        if (run) runs++;
        nodes[id] = { kind: 'object', fields, ...(run ? { run: encode(run, depth + 1) } : {}) };
      }
    } finally { active.delete(value); }
    return { r: id };
  };
  const root = encode(input, 0);
  return { version: 1, root, nodes, proofs, runs };
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function decodeGeometryValue(wire: unknown): unknown {
  if (!record(wire) || wire.version !== 1 || !Array.isArray(wire.nodes) || wire.nodes.length > MAX_NODES
    || !Number.isSafeInteger(wire.proofs) || !Number.isSafeInteger(wire.runs)) return error();
  const nodes = wire.nodes as unknown[], values = new Map<number, unknown>(), active = new Set<number>();
  let proofs = 0, runs = 0, visited = 0;
  const decode = (value: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH || ++visited > 2_000_000) return error();
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') { if (!Number.isFinite(value)) return error(); return value; }
    if (!record(value) || Object.keys(value).length !== 1) return error();
    if (value.u === true) return undefined;
    if (value.z === true) return -0;
    if (typeof value.b === 'string') {
      if (value.b.length > MAX_INTEGER_DIGITS || !/^(?:0|-?[1-9][0-9]*)$/.test(value.b)) return error();
      return BigInt(value.b);
    }
    const id = value.r;
    if (!Number.isSafeInteger(id) || (id as number) < 0 || (id as number) >= nodes.length || active.has(id as number)) return error();
    if (values.has(id as number)) return values.get(id as number);
    const node = nodes[id as number];
    if (!record(node)) return error();
    active.add(id as number);
    try {
      let out: unknown;
      if (node.kind === 'array' && Array.isArray(node.values)) {
        const array = node.values.map(item => decode(item, depth + 1));
        if (node.proof !== undefined) {
          if (typeof node.proof !== 'boolean') return error();
          proofs++; registerExactPaintRing(array, node.proof);
        }
        out = array;
      } else if (node.kind === 'map' && Array.isArray(node.entries)) {
        const map = new Map<unknown, unknown>();
        for (const entry of node.entries) {
          if (!Array.isArray(entry) || entry.length !== 2) return error();
          const key = decode(entry[0], depth + 1);
          if (map.has(key)) return error();
          map.set(key, decode(entry[1], depth + 1));
        }
        out = map;
      } else if (node.kind === 'object' && Array.isArray(node.fields)) {
        const object: Record<string, unknown> = {};
        for (const field of node.fields) {
          if (!Array.isArray(field) || field.length !== 3 || typeof field[0] !== 'string' || forbidden(field[0])
            || typeof field[2] !== 'boolean' || Object.prototype.hasOwnProperty.call(object, field[0])) return error();
          Object.defineProperty(object, field[0], { value: decode(field[1], depth + 1), enumerable: field[2], writable: true, configurable: true });
        }
        if (node.run !== undefined) {
          const run = decode(node.run, depth + 1);
          if (!record(run) || typeof run.checkCarrier !== 'boolean' || !record(run.run)
            || !Array.isArray(run.run.members) || !record(run.run.anchor)) return error();
          runs++; restoreGraphOpeningRun(object, run as unknown as RunMetadata);
        }
        out = object;
      } else return error();
      values.set(id as number, out);
      return out;
    } finally { active.delete(id as number); }
  };
  const result = decode(wire.root, 0);
  if (proofs !== wire.proofs || runs !== wire.runs || values.size !== nodes.length) return error();
  return result;
}

export function encodeGeometryText(value: unknown): string {
  const text = JSON.stringify(encodeGeometryValue(value));
  if (new TextEncoder().encode(text).byteLength > FLOOR_CACHE_MAX_PAYLOAD_BYTES) return error();
  return text;
}
export function decodeGeometryText(text: string): unknown {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > FLOOR_CACHE_MAX_PAYLOAD_BYTES) return error();
  return decodeGeometryValue(JSON.parse(text));
}
