import {
  BufferAttribute, DataTexture, DoubleSide, Group, LinearFilter, Mesh,
  MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type BufferGeometry,
} from 'three';
import type { IsoDeviceFace } from './iso-overlays';
import type { PlanPoint } from './iso-projection';
import { planPrismMesh } from './plan-3d-mesh';

export type Plan3dMarkerGlyph = {
  kind: 'icon'; paths: readonly { d: string; rule: CanvasFillRule }[];
  bounds: readonly [number, number, number, number]; angle: number; fraction: number;
} | { kind: 'text'; value: string; font: string; fraction: number };

export interface Plan3dMarkerFace extends IsoDeviceFace {
  color: string;
  edge: string;
  foreground: string;
  glyph?: Plan3dMarkerGlyph;
}

export interface Plan3dMarker {
  id: string;
  center: PlanPoint;
  diameter: number;
  height: number;
  faces: readonly Plan3dMarkerFace[];
}

function iconGlyph(icon: Element, angle: number): Plan3dMarkerGlyph | undefined {
  const nodes = icon.shadowRoot ?? icon;
  const inner = nodes.querySelector('ha-svg-icon');
  const svg = (inner?.shadowRoot ?? inner ?? nodes).querySelector('svg');
  const bounds = (svg?.getAttribute('viewBox') ?? '0 0 24 24').trim().split(/[\s,]+/).map(Number);
  const paths = [...(svg?.querySelectorAll('path[d]') ?? [])].map(path => ({ d: path.getAttribute('d')!,
    rule: path.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' as const : 'nonzero' as const }));
  if (!paths.length || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) return;
  return { kind: 'icon', paths, bounds: [bounds[0], bounds[1], bounds[2], bounds[3]], angle, fraction: .58 };
}

/** CSS and HA own face colours, text and vector glyphs. The contact solver
 * provides the same measured and rotated capsules used by grouped devices. */
export function readPlan3dMarkerFaces(
  element: HTMLElement, geometry: readonly IsoDeviceFace[], iconTurn: number,
): readonly Plan3dMarkerFace[] | undefined {
  const window = element.ownerDocument.defaultView;
  if (!window) return;
  const nodes = [...element.querySelectorAll<HTMLElement>('.device-core,.value-badge')];
  if (nodes.length !== geometry.length) return;
  const faces: Plan3dMarkerFace[] = [];
  for (const [index, node] of nodes.entries()) {
    const style = window.getComputedStyle(node), face = geometry[index];
    const icon = node.querySelector('ha-icon');
    const text = node.querySelector('.valtext,.value-badge-content');
    let glyph: Plan3dMarkerGlyph | undefined;
    let foreground = style.color;
    if (icon) {
      glyph = iconGlyph(icon, iconTurn);
      // An asynchronous HA icon keeps its existing presentation until the
      // provider has resolved its path, including custom icon sets.
      if (!glyph) return;
      foreground = window.getComputedStyle(icon).color;
    } else if (text) {
      const textStyle = window.getComputedStyle(text);
      const size = Number.parseFloat(textStyle.fontSize), height = Number.parseFloat(style.height);
      glyph = { kind: 'text', value: text.textContent ?? '', font: textStyle.fontFamily,
        fraction: height > 0 ? Math.min(.85, size / height) : .45 };
      foreground = textStyle.color;
    }
    faces.push({ ...face, color: style.backgroundColor, foreground, edge: '#808080', glyph });
  }
  return faces;
}

interface AtlasPage {
  texture: DataTexture;
  bytes: Uint8Array;
  side: number;
  cell: number;
  free: number[];
}
interface AtlasCell { page: AtlasPage; index: number; }

/** Atlas pages grow with the number of visible glyphs and retire when empty.
 * Each state change writes just the affected cell, without rebuilding plates. */
class MarkerAtlas {
  private readonly canvas: HTMLCanvasElement;
  private readonly pages: AtlasPage[] = [];

  constructor(document: Document) { this.canvas = document.createElement('canvas'); }

  allocate(cell: number): AtlasCell {
    let page = this.pages.find(item => item.cell === cell && item.free.length);
    if (!page) {
      const side = cell * 8, bytes = new Uint8Array(side * side * 4);
      const texture = new DataTexture(bytes, side, side);
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = texture.minFilter = LinearFilter;
      texture.needsUpdate = true;
      page = { texture, bytes, side, cell, free: Array.from({ length: 64 }, (_, index) => 63 - index) };
      this.pages.push(page);
    }
    return { page, index: page.free.pop()! };
  }

  paint(cell: AtlasCell, glyph: Plan3dMarkerGlyph, foreground: string, aspect: number): void {
    const { bytes, texture, side, cell: size } = cell.page;
    this.canvas.width = this.canvas.height = size;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Cannot rasterize the plan marker');
    const padding = 2;
    context.fillStyle = foreground;
    context.translate(size / 2, size / 2);
    if (glyph.kind === 'text') {
      context.font = `600 ${Math.floor(size * glyph.fraction)}px ${glyph.font}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.scale(1 / aspect, 1);
      context.fillText(glyph.value, 0, 0, (size - padding * 2) * aspect);
    } else {
      const [x, y, w, h] = glyph.bounds;
      const factor = size * glyph.fraction / Math.max(w, h);
      context.scale(1 / aspect, 1);
      context.rotate(glyph.angle);
      context.scale(factor, factor);
      context.translate(-x - w / 2, -y - h / 2);
      for (const path of glyph.paths) context.fill(new Path2D(path.d), path.rule);
    }
    const pixels = context.getImageData(0, 0, size, size).data;
    const x = cell.index % 8 * size, y = Math.floor(cell.index / 8) * size;
    const stride = size * 4;
    for (let row = 0; row < size; row++) {
      const offset = ((y + row) * side + x) * 4;
      bytes.set(pixels.subarray(row * stride, (row + 1) * stride), offset);
      texture.addUpdateRange(offset, stride);
    }
    texture.needsUpdate = true;
  }

  apply(cell: AtlasCell, geometry: BufferGeometry): void {
    const size = cell.page.cell, side = cell.page.side;
    const x = cell.index % 8 * size, y = Math.floor(cell.index / 8) * size;
    const uv = geometry.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (x + .5 + uv.getX(i) * (size - 1)) / side,
        (y + .5 + (1 - uv.getY(i)) * (size - 1)) / side);
    }
    uv.needsUpdate = true;
  }

  release({ page, index }: AtlasCell): void {
    page.free.push(index);
    if (page.free.length !== 64) return;
    this.pages.splice(this.pages.indexOf(page), 1);
    page.texture.dispose();
  }
}

type MarkerPaint = { key: string; body: Mesh<BufferGeometry, MeshBasicMaterial[]>;
  ink?: Mesh<BufferGeometry, MeshBasicMaterial>; cell?: AtlasCell; glyphKey?: string };

function ring(face: Plan3dMarkerFace, diameter: number): PlanPoint[] {
  const width = face.right - face.left, height = face.bottom - face.top;
  const x = (face.left + face.right) / 2, y = (face.top + face.bottom) / 2;
  const rx = Math.max(0, Math.min(width / 2, face.rx)), ry = Math.max(0, Math.min(height / 2, face.ry));
  const turn = face.angle ?? 0, cos = Math.cos(turn), sin = Math.sin(turn);
  return Array.from({ length: 32 }, (_, i) => {
    const corner = Math.floor(i / 8), t = (corner + i % 8 / 7) * Math.PI / 2;
    const dx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - rx) + rx * Math.cos(t);
    const dy = (corner < 2 ? 1 : -1) * (height / 2 - ry) + ry * Math.sin(t);
    return [(x + dx * cos - dy * sin) * diameter, (y + dx * sin + dy * cos) * diameter];
  });
}

export class Plan3dMarkerLayer {
  readonly group = new Group();
  private readonly atlas: MarkerAtlas;
  private readonly markers = new Map<string, MarkerPaint>();

  constructor(document: Document) { this.atlas = new MarkerAtlas(document); }

  present(markers: readonly Plan3dMarker[], devicePixelsPerUnit: number): void {
    const live = new Set<string>();
    for (const marker of markers) marker.faces.forEach((face, index) => {
      const key = marker.id + ':' + index;
      if (!(face.left < face.right && face.top < face.bottom && marker.diameter > 0)) return;
      live.add(key);
      this.update(key, marker, face, devicePixelsPerUnit);
    });
    for (const [key, paint] of this.markers) {
      if (live.has(key)) continue;
      this.retire(paint);
      this.markers.delete(key);
    }
  }

  private update(key: string, marker: Plan3dMarker, face: Plan3dMarkerFace, density: number): void {
    const { center: [x, y], diameter, height } = marker;
    const { left, right, top, bottom, rx, ry, angle = 0 } = face;
    const w = (right - left) * diameter, h = (bottom - top) * diameter;
    const geometryKey = [left, right, top, bottom, rx, ry, angle, diameter].join('|');
    let paint = this.markers.get(key);
    if (paint?.key !== geometryKey) {
      if (paint) this.retire(paint);
      const prism = planPrismMesh([[ring(face, diameter)]], -diameter * .24, 0);
      const body = new Mesh(prism, [face.color, face.edge, face.edge].map(color => new MeshBasicMaterial({ color, toneMapped: false })));
      body.userData.plan3dPick = { id: marker.id };
      this.group.add(body);
      this.markers.set(key, paint = { key: geometryKey, body });
    }
    paint.body.material[0].color.set(face.color);
    paint.body.material[1].color.set(face.edge);
    paint.body.material[2].color.set(face.edge);
    paint.body.position.set(x, height, y);
    const pixels = Math.max(w, h) * density;
    const size = pixels > 96 ? 128 : pixels > 48 ? 64 : 32;
    if (paint.ink && (!face.glyph || paint.cell?.page.cell !== size)) this.clearInk(paint);
    if (!face.glyph) return;
    if (!paint.ink) {
      const cell = this.atlas.allocate(size);
      const geometry = new PlaneGeometry(w, h);
      this.atlas.apply(cell, geometry);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateY(-angle);
      geometry.translate((left + right) * diameter / 2, 0, (top + bottom) * diameter / 2);
      const ink = new Mesh(geometry, new MeshBasicMaterial({ map: cell.page.texture, side: DoubleSide,
        alphaTest: .02, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      ink.userData.plan3dPick = { occludes: false };
      this.group.add(ink);
      paint.cell = cell;
      paint.ink = ink;
    }
    paint.ink.position.set(x, height, y);
    const glyphKey = JSON.stringify([face.glyph, face.foreground]);
    if (paint.glyphKey !== glyphKey) {
      this.atlas.paint(paint.cell!, face.glyph, face.foreground, w / h);
      paint.glyphKey = glyphKey;
    }
  }

  private clearInk(paint: MarkerPaint): void {
    if (!paint.ink || !paint.cell) return;
    this.group.remove(paint.ink);
    paint.ink.material.dispose();
    paint.ink.geometry.dispose();
    this.atlas.release(paint.cell);
    paint.ink = paint.cell = paint.glyphKey = undefined;
  }

  private retire(paint: MarkerPaint): void {
    this.clearInk(paint);
    this.group.remove(paint.body);
    paint.body.geometry.dispose();
    for (const material of paint.body.material) material.dispose();
  }

  dispose(): void { this.present([], 0); }
}
