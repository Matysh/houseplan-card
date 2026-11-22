import { validFloorPreview, type FloorFitPacket } from './floor-cache-preview';
import { furniturePlanScreenScale, furnitureStrokePx } from './furniture';
import { wallBodyNeedsSolid, wallHatchNeedsSolid } from './wall-thickness';

// No markup, text, images, foreign resources or editable plan objects cross
// the server boundary. Match the HA adapter's closed format.
export const STARTUP_WIRE_BYTES = 512 * 1024;
export const STARTUP_WIRE_VECTOR_BYTES = 2 * 1024 * 1024;
/** Bounded SVG construction after unfolding validated repeated attributes. */
export const STARTUP_WIRE_PAINT_BYTES = 8 * 1024 * 1024;
export const STARTUP_SVG_NS = 'http://www.w3.org/2000/svg';
export type StartupVector = [tag: string, attributes: Record<string, string>, children: StartupVector[]];
export interface StartupGeometry { version: 1; fit: FloorFitPacket; nodes: StartupVector[] }
export interface StartupRemoteAddress {
  readonly source: readonly [string, string];
  readonly variant: string;
  readonly projection: 'flat' | 'iso';
  readonly rotation: number;
}

const tags = new Set(('svg g defs path rect circle ellipse line polyline polygon clipPath mask linearGradient radialGradient stop '
  + 'pattern filter feGaussianBlur feOffset feColorMatrix feFlood feComposite feMerge feMergeNode feMorphology use').split(' '));
const geometry = new Set(('d points x y x1 y1 x2 y2 width height rx ry r cx cy dx dy transform '
  + 'viewBox gradientTransform patternTransform offset fx fy fr stdDeviation values').split(' '));
const paintInputs = new Set(['hp-stroke-units', 'hp-wall-depth', 'hp-hatch-step']);
const attributes = new Set(('id preserveAspectRatio vector-effect clip-rule fill-rule stroke-linecap stroke-linejoin stroke-miterlimit '
  + 'gradientUnits patternUnits patternContentUnits filterUnits primitiveUnits color-interpolation-filters '
  + 'in in2 result type operator k1 k2 k3 k4 maskUnits maskContentUnits marker-start marker-mid marker-end href '
  + 'fill fill-opacity stroke stroke-opacity stroke-width stroke-dasharray stroke-dashoffset opacity color clip-path mask '
  + 'filter paint-order stop-color stop-opacity flood-color flood-opacity shape-rendering').split(' '));
const localRef = /^#[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
const safeNumber = (value: unknown): value is number => typeof value === 'number' && Math.abs(value) <= 10_000_000;
const plainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const isStartupSourceStamp = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function validStartupVectorAttr(tag: string, key: string, value: unknown): value is string {
  if (paintInputs.has(key)) return tag === 'path' && typeof value === 'string'
    && value.length <= 42 && /^\d+(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(value) && safeNumber(Number(value))
    && (key === 'hp-wall-depth' || Number(value) > 0);
  if ((!geometry.has(key) && !attributes.has(key)) || typeof value !== 'string' || value.length > 520_000) return false;
  if (key === 'id') return localRef.test('#' + value);
  if (key === 'href') return tag === 'use' && localRef.test(value);
  const clean = value.replace(/url\((#[A-Za-z_][A-Za-z0-9_.:-]{0,127})\)/gi, '');
  if (!/^[a-z0-9#_.:,() /%+\- \t\r\n]*$/i.test(clean) || /url\s*\(/i.test(clean)) return false;
  if (geometry.has(key)) {
    if (/Infinity|NaN/i.test(clean)) return false;
    for (const m of clean.matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g))
      if (!safeNumber(Number(m[0]))) return false;
  }
  return true;
}

function validFit(value: unknown, address: Pick<StartupRemoteAddress, 'projection' | 'rotation'>): value is FloorFitPacket {
  if (!plainObject(value)) return false;
  const fit = value as unknown as FloorFitPacket;
  return validFloorPreview({ version: 1, fitKey: '0'.repeat(64), fit, shapes: [] })
    && fit.projection === address.projection && fit.rotation === address.rotation
    && [...fit.base, ...Object.values(fit.display), ...Object.values(fit.frame.rect), ...Object.values(fit.frame.all)].every(safeNumber)
    && fit.frame.outliers <= 100_000;
}

export function validStartupGeometry(value: unknown, address: Pick<StartupRemoteAddress, 'projection' | 'rotation'>): value is StartupGeometry {
  if (!plainObject(value) || Object.keys(value).length !== 3 || value.version !== 1
    || !Array.isArray(value.nodes) || !value.nodes.length || !validFit(value.fit, address)) return false;
  let count = 0;
  const todo: Array<[unknown, number]> = value.nodes.map(row => [row, 0]);
  while (todo.length) {
    const [row, depth] = todo.pop()!;
    if (++count > 25_000 || depth > 48 || !Array.isArray(row) || row.length !== 3 || !tags.has(row[0])
      || !plainObject(row[1]) || !Array.isArray(row[2])
      || !Object.entries(row[1]).every(([key, item]) => validStartupVectorAttr(row[0], key, item))) return false;
    for (const child of row[2]) todo.push([child, depth + 1]);
  }
  return true;
}

/** Copy the already resolved detached paint, not the source plan or a
 * clipped viewport. The caller marks stateful opening parts as local-only. */
export function startupVector(root: Element, excluded: ReadonlySet<Element>,
  inputs: ReadonlyMap<Element, Record<string, string>>): StartupVector[] {
  let count = 0;
  const visit = (element: Element, depth: number): StartupVector[] => {
    if (++count > 25_000 || depth > 48) throw Error('vector-size');
    if (excluded.has(element) || ['text', 'tspan', 'image'].includes(element.localName)) return [];
    if (element.namespaceURI !== STARTUP_SVG_NS || !tags.has(element.localName)) throw Error('unsupported-vector');
    const a: Record<string, string> = {};
    for (const attr of element.attributes) {
      if (validStartupVectorAttr(element.localName, attr.name, attr.value)) a[attr.name] = attr.value;
    }
    const paint = inputs.get(element);
    if (paint) {
      for (const [name, value] of Object.entries(paint)) {
        if (!validStartupVectorAttr(element.localName, name, value)) throw Error('unsupported-vector');
        a[name] = value;
      }
      if (a['hp-stroke-units'] !== undefined) delete a['stroke-width'];
      if (a['hp-wall-depth'] !== undefined) delete a.fill;
    }
    return [[element.localName, a, Array.from(element.children).flatMap(child => visit(child, depth + 1))]];
  };
  return Array.from(root.children).flatMap(child => visit(child, 0));
}

export function startupWireAvailable(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

async function collect(stream: ReadableStream<Uint8Array<ArrayBuffer>>, limit: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader(), parts: Uint8Array<ArrayBuffer>[] = [];
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > limit) throw Error('vector-size');
      parts.push(result.value);
    }
    signal.throwIfAborted();
    const bytes = new Uint8Array(length);
    for (let i = 0, offset = 0; i < parts.length; offset += parts[i++].length) bytes.set(parts[i], offset);
    return bytes;
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
  }
}

export async function encodeStartupGeometry(packet: StartupGeometry, signal: AbortSignal): Promise<string> {
  const pool: string[] = [], interned = new Map<string, number>();
  type Compact = [string, Record<string, number>, Compact[]];
  const pack = ([tag, attrs, children]: StartupVector): Compact => {
    const compact: Record<string, number> = {};
    for (const [name, value] of Object.entries(attrs)) {
      let index = interned.get(value);
      if (index === undefined) { index = pool.length; pool.push(value); interned.set(value, index); }
      compact[name] = index;
    }
    return [tag, compact, children.map(pack)];
  };
  const json = new Blob([JSON.stringify({ ...packet, pool, nodes: packet.nodes.map(pack) })]);
  if (json.size > STARTUP_WIRE_VECTOR_BYTES) throw Error('vector-size');
  const bytes = await collect(json.stream().pipeThrough(new CompressionStream('gzip')), STARTUP_WIRE_BYTES, signal);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}

export async function decodeStartupGeometry(encoded: unknown, address: StartupRemoteAddress,
  signal: AbortSignal): Promise<StartupGeometry | null> {
  if (typeof encoded !== 'string' || encoded.length > 4 * Math.ceil(STARTUP_WIRE_BYTES / 3)
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const zip = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
  if (zip.length > STARTUP_WIRE_BYTES) return null;
  const data = await collect(new Blob([zip]).stream().pipeThrough(new DecompressionStream('gzip')), STARTUP_WIRE_VECTOR_BYTES, signal);
  const wire: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  if (!plainObject(wire) || Object.keys(wire).length !== 4 || wire.version !== 1 || !validFit(wire.fit, address)
    || !Array.isArray(wire.pool) || !Array.isArray(wire.nodes) || !wire.nodes.length
    || wire.pool.length > 100_000 || !wire.pool.every(value => typeof value === 'string')) return null;
  const pool = wire.pool;
  const validated = new Set<string>();
  let chars = 0, count = 0;
  const unfold = (row: unknown, depth: number): StartupVector => {
    if (depth > 48 || ++count > 25_000 || !Array.isArray(row) || row.length !== 3
      || !tags.has(row[0]) || !plainObject(row[1]) || !Array.isArray(row[2])) throw Error('unsupported-vector');
    const attrs: Record<string, string> = {};
    for (const [name, index] of Object.entries(row[1])) {
      if (!geometry.has(name) && !attributes.has(name) && !paintInputs.has(name)
        || typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= pool.length)
        throw Error('unsupported-vector');
      const value = pool[index];
      chars += name.length + value.length + 4;
      if (chars > STARTUP_WIRE_PAINT_BYTES) throw Error('vector-size');
      const key = row[0] + '/' + name + '/' + index;
      if (!validated.has(key)) {
        if (!validStartupVectorAttr(row[0], name, value)) throw Error('unsupported-vector');
        validated.add(key);
      }
      attrs[name] = value;
    }
    return [row[0], attrs, row[2].map(child => unfold(child, depth + 1))];
  };
  try { return { version: 1, fit: wire.fit, nodes: wire.nodes.map(row => unfold(row, 0)) }; }
  catch { return null; }
}

/** Safe image built from validated primitives; width, height and camera are current. */
export function startupGeometryImage(packet: StartupGeometry, size: readonly [number, number],
  view: {x: number; y: number; w: number; h: number}): Blob {
  const parts: string[] = [`<svg xmlns="${STARTUP_SVG_NS}" width="${size[0]}" height="${size[1]}"
    viewBox="${view.x} ${view.y} ${view.w} ${view.h}">`];
  const furnitureScale = furniturePlanScreenScale(...size, view.w, view.h);
  const wallScale = Math.round(size[0] / view.w * 1e6) / 1e6;
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const add = ([tag, a, children]: StartupVector) => {
    parts.push('<' + tag);
    for (const [name, value] of Object.entries(a)) {
      if (paintInputs.has(name) || name === 'stroke-width' && a['hp-stroke-units'] !== undefined
        || name === 'fill' && a['hp-wall-depth'] !== undefined) continue;
      parts.push(' ' + name + '="' + escape(value) + '"');
    }
    if (a['hp-stroke-units'] !== undefined)
      parts.push(` stroke-width="${furnitureStrokePx(Number(a['hp-stroke-units']), furnitureScale)}"`);
    if (a['hp-wall-depth'] !== undefined) {
      const solid = wallBodyNeedsSolid(Number(a['hp-wall-depth']), wallScale) || wallHatchNeedsSolid(Number(a['hp-hatch-step']), wallScale);
      parts.push(` fill="${solid ? 'none' : 'url(#hp-wall-hatch)'}"`);
    }
    if (!children.length) { parts.push('/>'); return; }
    parts.push('>');
    for (const child of children) add(child);
    parts.push('</' + tag + '>');
  };
  for (const node of packet.nodes) add(node);
  parts.push('</svg>');
  return new Blob(parts, { type: 'image/svg+xml' });
}
