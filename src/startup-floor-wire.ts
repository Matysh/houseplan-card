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
export interface StartupRaster {
  version: 2;
  fit: FloorFitPacket;
  size: readonly [number, number];
  view: { x: number; y: number; w: number; h: number };
  zoom: number;
  image: Blob;
}
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

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}

function fromBase64(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(STARTUP_WIRE_BYTES / 3)
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const bytes = Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
    return bytes.length <= STARTUP_WIRE_BYTES ? bytes : null;
  } catch { return null; }
}

/** Header checks bound the image before passing untrusted cache data to a
 * decoder. Its container contains a single static frame and no metadata. */
export function validStartupWebp(bytes: Uint8Array): boolean {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (i: number) => String.fromCharCode(...bytes.subarray(i, i + 4));
  if (bytes.length < 20 || bytes.length > STARTUP_WIRE_BYTES || tag(0) !== 'RIFF'
    || data.getUint32(4, true) !== bytes.length - 8 || tag(8) !== 'WEBP') return false;
  let width = 0, height = 0, expectedWidth = 0, expectedHeight = 0, alpha = false;
  for (let i = 12; i < bytes.length;) {
    if (i + 8 > bytes.length || width || height) return false;
    const count = data.getUint32(i + 4, true), start = i + 8, end = start + count + (count & 1);
    if (end > bytes.length) return false;
    const kind = tag(i);
    const little24 = (at: number) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
    if (kind === 'VP8X' && i === 12 && count === 10 && data.getUint32(start, true) === 16) {
      expectedWidth = 1 + little24(start + 4);
      expectedHeight = 1 + little24(start + 7);
    } else if (kind === 'ALPH' && expectedWidth && !alpha && count > 1) alpha = true;
    else if (kind === 'VP8 ' && count >= 10 && !(bytes[start] & 1) && little24(start + 3) === 0x2a019d) {
      width = data.getUint16(start + 6, true) & 0x3fff;
      height = data.getUint16(start + 8, true) & 0x3fff;
    } else if (kind === 'VP8L' && count >= 5 && bytes[start] === 0x2f && !expectedWidth) {
      const bits = data.getUint32(start + 1, true);
      if (bits >>> 29) return false;
      width = 1 + (bits & 0x3fff);
      height = 1 + ((bits >>> 14) & 0x3fff);
    } else return false;
    i = end;
  }
  return width > 0 && height > 0 && width * height <= 2_000_000
    && (!expectedWidth || alpha && expectedWidth === width && expectedHeight === height);
}

/** Chromium writes an ICC profile even when encoding an sRGB canvas.
 * Strip only the encoder's color profile. Receivers still reject metadata. */
export async function startupWebpFromCanvas(blob: Blob | null): Promise<Blob | null> {
  if (blob?.type !== 'image/webp' || blob.size > STARTUP_WIRE_BYTES) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (validStartupWebp(bytes)) return blob;
  const data = new DataView(bytes.buffer);
  const tag = (i: number) => String.fromCharCode(...bytes.subarray(i, i + 4));
  if (bytes.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP'
    || data.getUint32(4, true) !== bytes.length - 8 || tag(12) !== 'VP8X'
    || data.getUint32(16, true) !== 10 || !(bytes[20] & 32)) return null;
  const extracted = bytes.slice(0, 12);
  const content: Uint8Array<ArrayBuffer>[] = [];
  let total = 12;
  for (let i = 12; i < bytes.length;) {
    if (i + 8 > bytes.length) return null;
    const count = data.getUint32(i + 4, true), end = i + 8 + count + (count & 1);
    if (end > bytes.length) return null;
    const kind = tag(i);
    if (kind !== 'ICCP') {
      const chunk = bytes.slice(i, end);
      if (i === 12) chunk[8] &= ~32;
      if (i !== 12 || chunk[8] !== 0) { content.push(chunk); total += chunk.length; }
    }
    i = end;
  }
  const clean = new Uint8Array(total);
  new DataView(extracted.buffer).setUint32(4, total - 8, true);
  clean.set(extracted);
  let position = extracted.length;
  for (const chunk of content) { clean.set(chunk, position); position += chunk.length; }
  return validStartupWebp(clean) ? new Blob([clean], { type: 'image/webp' }) : null;
}

export async function encodeStartupRaster(packet: StartupRaster, signal: AbortSignal): Promise<string> {
  const { view, image, ...metadata } = packet;
  if (image.type !== 'image/webp' || image.size > STARTUP_WIRE_BYTES) throw Error('raster-format');
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!validStartupWebp(bytes)) throw Error('raster-format');
  const wire = new Blob([JSON.stringify({ ...metadata,
    view: [view.x, view.y, view.w, view.h], image: base64(bytes) })]);
  return base64(await collect(wire.stream().pipeThrough(new CompressionStream('gzip')), STARTUP_WIRE_BYTES, signal));
}

export async function decodeStartupRaster(encoded: unknown, address: StartupRemoteAddress,
  signal: AbortSignal): Promise<StartupRaster | null> {
  if (address.projection !== 'iso') return null;
  const zip = fromBase64(encoded);
  if (!zip) return null;
  const data = await collect(new Blob([zip]).stream().pipeThrough(new DecompressionStream('gzip')), STARTUP_WIRE_VECTOR_BYTES, signal);
  const wire: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  if (!plainObject(wire) || Object.keys(wire).length !== 6 || wire.version !== 2 || !validFit(wire.fit, address)
    || !Array.isArray(wire.size) || wire.size.length !== 2
    || !wire.size.every(n => Number.isInteger(n) && n > 0 && n <= 16_384)
    || !Array.isArray(wire.view) || wire.view.length !== 4 || !wire.view.every(safeNumber)
    || wire.view[2] <= 0 || wire.view[3] <= 0 || typeof wire.zoom !== 'number' || !(wire.zoom > 0 && wire.zoom <= 10_000)) return null;
  const raster = fromBase64(wire.image);
  if (!raster || !validStartupWebp(raster)) return null;
  const [x, y, w, h] = wire.view;
  return { version: 2, fit: wire.fit, size: [wire.size[0], wire.size[1]], view: { x, y, w, h }, zoom: wire.zoom,
    image: new Blob([raster], { type: 'image/webp' }) };
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
  return base64(bytes);
}

export async function decodeStartupGeometry(encoded: unknown, address: StartupRemoteAddress,
  signal: AbortSignal): Promise<StartupGeometry | null> {
  const zip = fromBase64(encoded);
  if (!zip) return null;
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
