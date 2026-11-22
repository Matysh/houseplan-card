/** Passive SVG data, not saved markup. Even an origin-local database is an
 * untrusted input: never feed strings to unsafeSVG/innerHTML. */
import { svg, nothing } from 'lit';
import type { Rect } from './space-geometry';
import { validFlatPlanRotation, validPlanRotation } from './view-frame';
export interface FloorFitPacket {
  frame: { rect: Rect; all: Rect; outliers: number; hasContent: boolean };
  base: number[]; display: Rect; projection: 'flat' | 'iso'; rotation: number;
}
interface Shape { tag: 'path' | 'polygon' | 'polyline' | 'line' | 'rect' | 'circle' | 'ellipse';
  attributes: Record<string, string>; transforms: string[]; role: 'floor' | 'wall' | 'decor' | 'stairs' }
export interface FloorPreview { version: 1; fitKey: string; fit: FloorFitPacket; shapes: Shape[] }
const numeric = /^(?:[-+\d.eE\s,]+)$/;
const pathData = /^[MmZzLlHhVvCcSsQqTtAa\d.eE\s,+-]*$/;
const transform = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([-+\d.eE\s,]+\)\s*)*$/;
const attributes = new Set(['d', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rx', 'ry', 'r', 'cx', 'cy']);
const tags = new Set(['path', 'polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse']);
const finiteTokens = (text: string) => (text.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []).every(token => Number.isFinite(Number(token)));
const fieldsOnly = (value: object, names: string[]) => !!value && typeof value === 'object'
  && Object.keys(value).every(key => names.includes(key)) && names.every(key => Object.prototype.hasOwnProperty.call(value, key));
const rectValid = (r: Rect) => !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
export function validFloorPreview(value: unknown, fitKey?: string): value is FloorPreview {
  const p = value as FloorPreview;
  return !!p && fieldsOnly(p, ['version', 'fitKey', 'fit', 'shapes']) && p.version === 1 && typeof p.fitKey === 'string' && /^[a-f0-9]{64}$/.test(p.fitKey)
    && (!fitKey || p.fitKey === fitKey) && !!p.fit && ['flat', 'iso'].includes(p.fit.projection)
    && fieldsOnly(p.fit, ['frame', 'base', 'display', 'projection', 'rotation']) && fieldsOnly(p.fit.frame, ['rect', 'all', 'outliers', 'hasContent'])
    && rectValid(p.fit.display) && fieldsOnly(p.fit.display, ['x', 'y', 'w', 'h'])
    && (p.fit.projection === 'iso' ? validPlanRotation(p.fit.rotation) : validFlatPlanRotation(p.fit.rotation)) && rectValid(p.fit.frame?.rect) && rectValid(p.fit.frame?.all)
    && fieldsOnly(p.fit.frame.rect, ['x', 'y', 'w', 'h']) && fieldsOnly(p.fit.frame.all, ['x', 'y', 'w', 'h'])
    && Number.isSafeInteger(p.fit.frame.outliers) && p.fit.frame.outliers >= 0 && typeof p.fit.frame.hasContent === 'boolean'
    && Array.isArray(p.fit.base) && p.fit.base.length === 4 && p.fit.base.every(Number.isFinite) && p.fit.base[2] > 0 && p.fit.base[3] > 0
    && Array.isArray(p.shapes) && p.shapes.length <= 20_000 && p.shapes.every(shape => fieldsOnly(shape, ['tag', 'attributes', 'transforms', 'role']) && tags.has(shape.tag)
      && ['floor', 'wall', 'decor', 'stairs'].includes(shape.role) && Array.isArray(shape.transforms)
      && shape.transforms.length <= 32 && shape.transforms.every(text => typeof text === 'string' && text.length < 2048 && transform.test(text) && finiteTokens(text))
      && !!shape.attributes && typeof shape.attributes === 'object' && Object.entries(shape.attributes).every(([key, text]) =>
        attributes.has(key) && typeof text === 'string' && text.length <= 500_000
        && (key === 'd' ? pathData : numeric).test(text) && finiteTokens(text)));
}
export function captureFloorPreview(root: ParentNode, fit: FloorFitPacket, fitKey: string,
  diagnose?: (value: { shapes: number; invalid: string[] }) => void): FloorPreview | null {
  // A structurally typed card frame also carries model/layout/device refs.
  // Pick only calculated anonymous extents; never serialize that runtime frame.
  const rect = (r: Rect): Rect => ({ x: r.x, y: r.y, w: r.w, h: r.h });
  fit = { frame: { rect: rect(fit.frame.rect), all: rect(fit.frame.all), outliers: fit.frame.outliers, hasContent: fit.frame.hasContent },
    base: [...fit.base], display: rect(fit.display), projection: fit.projection, rotation: fit.rotation };
  const shapes: Shape[] = [], seen = new Set<Element>();
  const layers = [['.hp-paper,.iso-underlay-svg', 'floor'], ['[data-hp-mode-layer="rooms"],.plan-svg .room', 'floor'],
    ['[data-hp-mode-layer="decor"],.decorlayer', 'decor'], ['[data-hp-mode-layer="stairs"],.hp-stairs-layer', 'stairs'],
    ['[data-hp-mode-layer="walls"],.wallbodies,.iso-walls', 'wall'], ['[data-hp-mode-layer="zero-view"]', 'wall']] as const;
  for (const [selector, role] of layers) for (const layer of root.querySelectorAll(selector)) {
    const rootSvg = layer instanceof SVGSVGElement ? layer : (layer as SVGGraphicsElement).ownerSVGElement;
    const inverse = rootSvg?.getCTM()?.inverse();
    for (const element of [layer, ...layer.querySelectorAll('path,polygon,polyline,line,rect,circle,ellipse')]) {
      if (!tags.has(element.tagName.toLowerCase()) || seen.has(element)
        || element.closest('.roomlabel,.roomgear,.hp-stair-hit,[data-kind="image"],.room-hover,.hpf-arrival-highlight,.iso-opening-panel,.iso-opening-texture,.iso-ambient-shadow,.iso-material-texture,.room-hit,.hp-mode-room-hit')) continue;
      seen.add(element);
      const values: Record<string, string> = {};
      for (const name of attributes) if (element.hasAttribute(name)) {
        let value = element.getAttribute(name)!;
        if (value.includes('%')) {
          const length = (element as unknown as Record<string, { baseVal?: { value?: number } }>)[name]?.baseVal?.value;
          if (!Number.isFinite(length)) continue;
          value = String(length);
        }
        values[name] = value;
      }
      const transforms: string[] = [];
      const ctm = (element as SVGGraphicsElement).getCTM();
      if (!inverse || !ctm) continue;
      // Include nested SVG viewport/viewBox transforms as well as group
      // transforms. Attribute concatenation alone misplaces built-in furniture.
      const matrix = inverse.multiply(ctm);
      transforms.push(`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
      shapes.push({ tag: element.tagName.toLowerCase() as Shape['tag'], attributes: values, transforms, role });
    }
  }
  const result: FloorPreview = { version: 1, fit, fitKey, shapes };
  diagnose?.({ shapes: shapes.length, invalid: shapes.filter(shape => !validFloorPreview({ ...result, shapes: [shape] }))
    .slice(0, 5).flatMap(shape => Object.entries(shape.attributes).filter(([key, text]) => !(key === 'd' ? pathData : numeric).test(text))
      .map(([key]) => `${shape.tag}.${key}:unsupported`)) });
  return validFloorPreview(result) ? result : null;
}
export function renderFloorPreview(preview: FloorPreview | null) {
  if (!preview || !validFloorPreview(preview)) return nothing;
  const wrap = (shape: Shape, content: unknown) => svg`<g transform=${shape.transforms.join(' ')}
    fill=${shape.role === 'floor' ? 'var(--ha-card-background, #888)' : shape.role === 'wall' ? 'var(--wall-fill, #888)' : 'none'}
    stroke=${shape.role === 'stairs' || shape.role === 'decor' || shape.tag === 'line' || shape.tag === 'polyline' ? 'var(--hp-muted, #666)' : 'none'}
    stroke-width="1" fill-rule="evenodd">${content}</g>`;
  return preview.shapes.map(shape => {
    const a = shape.attributes;
    switch (shape.tag) {
      case 'path': return wrap(shape, svg`<path d=${a.d || ''}></path>`);
      case 'polygon': return wrap(shape, svg`<polygon points=${a.points || ''}></polygon>`);
      case 'polyline': return wrap(shape, svg`<polyline points=${a.points || ''}></polyline>`);
      case 'line': return wrap(shape, svg`<line x1=${a.x1 || 0} y1=${a.y1 || 0} x2=${a.x2 || 0} y2=${a.y2 || 0}></line>`);
      case 'rect': return wrap(shape, svg`<rect x=${a.x || 0} y=${a.y || 0} width=${a.width || 0} height=${a.height || 0} rx=${a.rx || 0} ry=${a.ry || 0}></rect>`);
      case 'circle': return wrap(shape, svg`<circle cx=${a.cx || 0} cy=${a.cy || 0} r=${a.r || 0}></circle>`);
      case 'ellipse': return wrap(shape, svg`<ellipse cx=${a.cx || 0} cy=${a.cy || 0} rx=${a.rx || 0} ry=${a.ry || 0}></ellipse>`);
    }
  });
}
