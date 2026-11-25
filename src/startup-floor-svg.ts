import { STARTUP_IMAGE_LIMIT, STARTUP_VECTOR_LIMIT } from './startup-floor-store';
import { STARTUP_WIRE_BYTES, STARTUP_WIRE_PAINT_BYTES, startupVector, validStartupWebp, type StartupVector } from './startup-floor-wire';

const SVG = 'http://www.w3.org/2000/svg';
const tags = new Set(('svg g defs path rect circle ellipse line polyline polygon clipPath mask linearGradient radialGradient stop '
  + 'pattern filter feGaussianBlur feOffset feColorMatrix feFlood feComposite feMerge feMergeNode feMorphology text tspan use image').split(' '));
const attributes = new Set(('id d points x y x1 y1 x2 y2 width height rx ry r cx cy dx dy transform viewBox preserveAspectRatio '
  + 'vector-effect clip-rule fill-rule stroke-linecap stroke-linejoin stroke-miterlimit gradientUnits gradientTransform '
  + 'patternUnits patternContentUnits patternTransform offset fx fy fr stdDeviation filterUnits primitiveUnits '
  + 'color-interpolation-filters in in2 result type values operator k1 k2 k3 k4 maskUnits maskContentUnits '
  + 'marker-start marker-mid marker-end href').split(' '));
const paints = (`fill fill-opacity stroke stroke-opacity stroke-width stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin
  stroke-miterlimit opacity color clip-path mask filter paint-order clip-rule fill-rule vector-effect stop-color stop-opacity
  flood-color flood-opacity font-family font-size font-weight font-style letter-spacing word-spacing text-anchor dominant-baseline
  alignment-baseline text-decoration white-space shape-rendering`).trim().split(/\s+/);
const paintSet = new Set(paints);
const hrefImage = /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/;
const local = /^#[a-zA-Z_][a-zA-Z0-9_.:-]{0,127}$/;
const cleanUrl = /url\(["']?(#[a-zA-Z_][a-zA-Z0-9_.:-]{0,127})["']?\)/gi;
const external = /url\s*\(|@import|javascript:|\\|[<>]/i;

function allowed(name: string, value: string, tag: string): boolean {
  if (name === 'href') return tag === 'image' ? hrefImage.test(value) : tag === 'use' && local.test(value);
  if (name === 'id') return local.test('#' + value);
  return (attributes.has(name) || paintSet.has(name)) && value.length <= 520_000
    && !external.test(value.replace(cleanUrl, ''));
}

function normalizePaint(value: string): string {
  // getComputedStyle can expand url(#id) to a document URL. It is safe only
  // if it resolves to this document and its fragment is a local reference.
  return value.replace(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/gi, (_whole, double, single, plain) => {
    try {
      const ref = double ?? single ?? plain;
      const url = new URL(ref, document.baseURI);
      const page = new URL(document.baseURI);
      page.hash = '';
      const hash = url.hash; url.hash = '';
      if (url.href === page.href && local.test(hash)) return `url(${hash})`;
    } catch { /* copied styles never create external loads */ }
    return 'none';
  });
}

type ReadImage = (href: string, signal: AbortSignal) => Promise<Blob | null>;

async function isStartupSvg(text: string, signal: AbortSignal): Promise<boolean> {
  if (!text || text.length > STARTUP_IMAGE_LIMIT || /<!DOCTYPE|<\?/i.test(text)) return false;
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (root.namespaceURI !== SVG || root.localName !== 'svg') return false;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let current: Element | null = root, count = 0, slice = performance.now();
  while (current) {
    if (performance.now() - slice >= 8) {
      await yieldTask(); slice = performance.now();
      if (signal.aborted) return false;
    }
    if (current.namespaceURI !== SVG || !tags.has(current.localName) || ++count > 25_000) return false;
    for (const attr of current.attributes) {
      if (current === root && attr.name === 'xmlns' && attr.value === SVG) continue;
      if (attr.namespaceURI || !allowed(attr.name, attr.value, current.localName)) return false;
    }
    current = walker.nextNode() as Element | null;
  }
  return true;
}

/** Wait outside an existing rendering turn; a slow font/image never gates
 * the interactive tree. Slice the expensive, read-only computed-paint walk. */
const yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function rasterData(blob: Blob, signal: AbortSignal): Promise<string> {
  if (blob.size > STARTUP_IMAGE_LIMIT) throw Error('asset-size');
  let raster = blob;
  if (blob.type === 'image/svg+xml') {
    // Decode as an isolated image, the same way the ordinary SVG <image>
    // renders this asset. Direct createImageBitmap(svgBlob) is not portable.
    const url = URL.createObjectURL(blob), image = new Image();
    const revoke = () => URL.revokeObjectURL(url);
    signal.addEventListener('abort', revoke, { once: true });
    try {
      signal.throwIfAborted(); image.src = url;
      try { await image.decode(); } catch { signal.throwIfAborted(); throw Error('asset-format'); }
      signal.throwIfAborted();
      const width = image.naturalWidth, height = image.naturalHeight;
      if (width <= 0 || height <= 0 || width * height > 4_000_000) throw Error('asset-bounds');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw Error('asset-format');
      context.drawImage(image, 0, 0);
      raster = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        result => result ? resolve(result) : reject(Error('asset-format')), 'image/png'));
    } finally { signal.removeEventListener('abort', revoke); revoke(); }
  }
  signal.throwIfAborted();
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(raster.type) || raster.size > STARTUP_IMAGE_LIMIT)
    throw Error('asset-format');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(raster);
  });
}

/** Consume only a static template tree, not the live plan DOM. Drawn content
 * uses the same authored SVG parts and the same stylesheet scope as View. */
export async function serializeStartupFloor(source: SVGSVGElement, readImage: ReadImage, signal: AbortSignal,
  portable?: (nodes: StartupVector[]) => void): Promise<Blob | null> {
  const doc = source.ownerDocument, output = doc.createElementNS(SVG, 'svg');
  const todo: Array<[Element, SVGElement]> = [[source, output]];
  const images = new Map<string, string>();
  const excluded = portable ? new Set<Element>() : undefined;
  const paintInputs = new Map<Element, Record<string, string>>();
  let slice = performance.now(), vectorBytes = 0, imageBytes = 0;
  for (let index = 0; index < todo.length; index++) {
    if (todo.length > 25_000) throw Error('vector-size');
    signal.throwIfAborted();
    if (performance.now() - slice >= 8) { await yieldTask(); slice = performance.now(); signal.throwIfAborted(); }
    const [input, node] = todo[index];
    const tag = input.localName, css = doc.defaultView!.getComputedStyle(input);
    // Do not discard definitions (which have no rendered boxes of their own).
    if (input !== source && css.display === 'none' && !input.closest('defs')) { node.remove(); continue; }
    if (excluded && input.matches('.iso-opening-panel[data-leaf],.iso-opening-texture,.iso-material-texture,[data-hp-live-opening]'))
      excluded.add(node);
    if (portable && tag === 'path') {
      const stroke = input.getAttribute('data-hp-startup-stroke'), depth = input.getAttribute('data-hp-startup-wall-depth'),
        hatch = input.getAttribute('data-hp-startup-hatch-step');
      if (stroke !== null) paintInputs.set(node, { 'hp-stroke-units': stroke });
      if (depth !== null && hatch !== null) paintInputs.set(node, { 'hp-wall-depth': depth, 'hp-hatch-step': hatch });
    }
    for (const attr of input.attributes) {
      const value = attr.value;
      if (attr.localName === 'href' && tag === 'image') {
        let data = images.get(value);
        if (!data) {
          const blob = await readImage(value, signal); signal.throwIfAborted();
          if (!blob) throw Error('asset-unavailable');
          data = await rasterData(blob, signal); images.set(value, data);
        }
        imageBytes += data.length;
        if (imageBytes > STARTUP_IMAGE_LIMIT) throw Error('asset-size');
        node.setAttribute('href', data);
      } else if (allowed(attr.localName, value, tag)) {
        node.setAttribute(attr.localName, value);
        vectorBytes += attr.localName.length + value.length + 4;
      }
    }
    for (const name of paints) {
      if ((name.startsWith('font-') || name.includes('spacing') || name.includes('baseline')
        || name === 'text-anchor' || name === 'text-decoration' || name === 'white-space') && tag !== 'text' && tag !== 'tspan') continue;
      const value = normalizePaint(css.getPropertyValue(name).trim());
      if (value && value !== cssDefault.get(name) && allowed(name, value, tag)) {
        node.setAttribute(name, value); vectorBytes += name.length + value.length + 4;
      }
    }
    if (vectorBytes > (portable ? STARTUP_WIRE_PAINT_BYTES : STARTUP_VECTOR_LIMIT)) throw Error('vector-size');
    for (const child of input.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && (tag === 'text' || tag === 'tspan')) {
        vectorBytes += (child.textContent ?? '').length;
        node.append(doc.createTextNode(child.textContent ?? ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element, name = element.localName;
        if (element.namespaceURI !== SVG || !tags.has(name)) throw Error('unsupported-vector');
        const target = doc.createElementNS(SVG, name); node.append(target); todo.push([element, target]);
      }
    }
  }
  signal.throwIfAborted();
  if (portable && excluded) {
    try { portable(startupVector(output, excluded, paintInputs)); }
    catch { /* a local image is still usable without a portable packet */ }
  }
  if (portable && vectorBytes > STARTUP_VECTOR_LIMIT) return null;
  const text = new XMLSerializer().serializeToString(output);
  const blob = new Blob([text], { type: 'image/svg+xml' });
  if (blob.size > STARTUP_IMAGE_LIMIT || blob.size - imageBytes > STARTUP_VECTOR_LIMIT) {
    if (portable) return null;
    throw Error('vector-size');
  }
  return blob;
}

// SVG's inherited defaults are supplied by the surrounding group. Don't
// repeat non-rendering defaults for every tessellated furniture facet.
const cssDefault = new Map([
  ['clip-path','none'], ['mask','none'], ['filter','none'], ['shape-rendering','auto'],
  ['opacity','1'], ['stroke-dasharray','none'], ['stroke-dashoffset','0px'],
  ['letter-spacing','normal'], ['word-spacing','0px'], ['text-decoration','none'], ['white-space','normal'],
  ['alignment-baseline','auto'], ['dominant-baseline','auto'], ['paint-order','normal'],
  ['vector-effect','none'],
]);

export async function loadStartupFloorImage(blob: Blob, signal: AbortSignal, constructedFromTypedVector = false): Promise<HTMLImageElement | null> {
  if (signal.aborted) return null;
  const valid = blob.type === 'image/webp'
    ? blob.size <= STARTUP_WIRE_BYTES && validStartupWebp(new Uint8Array(await blob.arrayBuffer()))
    : blob.type === 'image/svg+xml' && (constructedFromTypedVector || await isStartupSvg(await blob.text(), signal));
  if (!valid || signal.aborted) return null;
  const url = URL.createObjectURL(blob);
  const revoke = () => URL.revokeObjectURL(url);
  signal.addEventListener('abort', revoke, { once: true });
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    return image;
  } catch { revoke(); return null; }
  finally { signal.removeEventListener('abort', revoke); }
}
