import {
  BufferAttribute, Color, DataTexture, Group, LinearFilter, Mesh,
  MeshBasicMaterial, SRGBColorSpace, Vector3, type BufferGeometry, type Camera,
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
  row: number;
  free: number[];
}
interface AtlasCell { page: AtlasPage; index: number; }
const BASE_CELL_LIMIT = 128;
const ATLAS_PAGE_EDGE = 1024;
const HIGH_PAGE_LIMIT = 4; // Each high-resolution RGBA page is 4 MiB.
const atlasRow = (cell: number) => Math.min(8, ATLAS_PAGE_EDGE / cell);

/** Atlas pages grow with the number of visible glyphs and retire when empty.
 * Each state change writes just the affected cell, without rebuilding plates. */
class MarkerAtlas {
  private readonly canvas: HTMLCanvasElement;
  private readonly pages: AtlasPage[] = [];

  constructor(document: Document) { this.canvas = document.createElement('canvas'); }

  allocate(cell: number): AtlasCell | undefined {
    let page = this.pages.find(item => item.cell === cell && item.free.length);
    if (!page) {
      const row = atlasRow(cell), side = cell * row;
      const size = side * side * 4;
      if (cell > BASE_CELL_LIMIT && this.pages.filter(item => item.cell > BASE_CELL_LIMIT).length >= HIGH_PAGE_LIMIT) return;
      const bytes = new Uint8Array(size);
      const texture = new DataTexture(bytes, side, side);
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = texture.minFilter = LinearFilter;
      texture.needsUpdate = true;
      page = { texture, bytes, side, cell, row,
        free: Array.from({ length: row * row }, (_, index) => row * row - 1 - index) };
      this.pages.push(page);
    }
    return { page, index: page.free.pop()! };
  }

  pagesToCompact(limits: ReadonlyMap<number, number>): Set<AtlasPage> {
    const spare = new Set<AtlasPage>();
    const sizes = new Set(this.pages.filter(page => page.cell > BASE_CELL_LIMIT).map(page => page.cell));
    for (const size of sizes) {
      // Keep the fullest pages of each size. Empty sparse pages before
      // assigning the new crop: retained slots can otherwise hold two old
      // pages even when they all fit in just one.
      const sameSize = this.pages.filter(page => page.cell === size).sort((a, b) => a.free.length - b.free.length);
      for (const page of sameSize.slice(limits.get(size) ?? 0)) spare.add(page);
    }
    return spare;
  }

  paint(cell: AtlasCell, glyph: Plan3dMarkerGlyph, foreground: string, background: string, aspect: number): void {
    const { bytes, texture, side, cell: size } = cell.page;
    this.canvas.width = this.canvas.height = size;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Cannot rasterize the plan marker');
    const padding = 2;
    // Bake the ink onto its opaque cap using actual coverage. Detached ink
    // planes can all pass the same depth test for coincident devices and
    // show the icons of several different markers on one visible plate.
    context.fillStyle = new Color(background).getStyle();
    context.fillRect(0, 0, size, size);
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
    const x = cell.index % cell.page.row * size, y = Math.floor(cell.index / cell.page.row) * size;
    const stride = size * 4;
    for (let row = 0; row < size; row++) {
      const offset = ((y + row) * side + x) * 4;
      bytes.set(pixels.subarray(row * stride, (row + 1) * stride), offset);
      texture.addUpdateRange(offset, stride);
    }
    texture.needsUpdate = true;
  }

  apply(cell: AtlasCell, geometry: BufferGeometry, center: PlanPoint, w: number, h: number, angle: number): void {
    const size = cell.page.cell, side = cell.page.side;
    const x = cell.index % cell.page.row * size, y = Math.floor(cell.index / cell.page.row) * size;
    const positions = geometry.getAttribute('position');
    const uv = new Float32Array(positions.count * 2);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cap = geometry.groups[0];
    for (let i = cap.start; i < cap.start + cap.count; i++) {
      const dx = positions.getX(i) - center[0], dy = positions.getZ(i) - center[1];
      const u = (dx * cos + dy * sin) / w + .5, v = (dy * cos - dx * sin) / h + .5;
      uv[i * 2] = (x + .5 + Math.min(1, Math.max(0, u)) * (size - 1)) / side;
      uv[i * 2 + 1] = (y + .5 + Math.min(1, Math.max(0, v)) * (size - 1)) / side;
    }
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  }

  release({ page, index }: AtlasCell): void {
    page.free.push(index);
    if (page.free.length !== page.row * page.row) return;
    this.pages.splice(this.pages.indexOf(page), 1);
    page.texture.dispose();
  }
}

type MarkerPaint = { key: string; body: Mesh<BufferGeometry, MeshBasicMaterial[]>;
  cell?: AtlasCell; glyphKey?: string };

export type MarkerRaster = Readonly<{ camera: Camera; width: number; height: number }>;

/** The front cap and the glyph are one surface. Estimate the number of
 * samples occupied by that surface, including perspective and screen crop. */
function capPixels(marker: Plan3dMarker, face: Plan3dMarkerFace, raster: MarkerRaster): { pixels: number; priority: number } {
  const { center: [x, z], height, diameter } = marker;
  const { left, right, top, bottom, angle = 0 } = face;
  const c = Math.cos(angle), s = Math.sin(angle), point = new Vector3();
  const tx = (left + right) / 2, ty = (top + bottom) / 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const corners: PlanPoint[] = [];
  for (const [a, b] of [[left,top],[right,top],[right,bottom],[left,bottom]]) {
    const u = a - tx, v = b - ty;
    point.set(x + (tx + c*u - s*v) * diameter, height, z + (ty + s*u + c*v) * diameter).project(raster.camera);
    x0 = Math.min(x0,point.x); y0 = Math.min(y0,point.y);
    x1 = Math.max(x1,point.x); y1 = Math.max(y1,point.y);
    corners.push([point.x * raster.width / 2, point.y * raster.height / 2]);
  }
  if (x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return { pixels: 0, priority: Infinity };
  const distance = Math.hypot((x0 + x1) * raster.width, (y0 + y1) * raster.height);
  const pixels = Math.max(...corners.map(([x, y], i) => {
    const [u, v] = corners[(i + 1) % 4]; return Math.hypot(u - x, v - y);
  }));
  return { pixels, priority: distance };
}

function cellSize(pixels: number): number {
  if (pixels > 450) return 1024;
  if (pixels > 225) return 512;
  if (pixels > 110) return 256;
  return pixels > 56 ? 128 : 64;
}

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

  /** Expose only current endpoint cores, not extruding badges. A crisp
   * overlay can stay above the 3D canvas without painting through its caps. */
  screenCoreSilhouettes(ids: ReadonlySet<string>, camera: Camera, box: DOMRectReadOnly): PlanPoint[][] {
    return [...ids].flatMap(id => {
      const body = this.markers.get(id + ':0')?.body;
      const attribute = body?.geometry.getAttribute('position');
      if (!attribute?.count || !body?.visible) return [];
      const point = new Vector3(), unique = new Map<string, PlanPoint>();
      body.updateWorldMatrix(true, false);
      for (let i=0; i<attribute.count; i++) {
        point.fromBufferAttribute(attribute, i).applyMatrix4(body.matrixWorld).project(camera);
        const x = box.left + (point.x + 1) * box.width / 2;
        const y = box.top + (1 - point.y) * box.height / 2;
        if (Number.isFinite(x + y)) unique.set(x + ',' + y, [x, y]);
      }
      const points = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const rim = (list: readonly PlanPoint[]) => {
        const result: PlanPoint[] = [];
        for (const p of list) {
          while (result.length > 1) {
            const a = result[result.length - 2], b = result[result.length - 1];
            if ((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]) > 1e-7) break;
            result.pop();
          }
          result.push(p);
        }
        return result.slice(0, -1);
      };
      return points.length < 3 ? [] : [[...rim(points), ...rim(points.reverse())]];
    });
  }

  present(markers: readonly Plan3dMarker[], devicePixelsPerUnit: number, raster?: MarkerRaster): void {
    const live = new Set<string>();
    const work: { key: string; marker: Plan3dMarker; face: Plan3dMarkerFace;
      size: number; priority: number; order: number }[] = [];
    for (const marker of markers) marker.faces.forEach((face, index) => {
      const key = marker.id + ':' + index;
      if (!(face.left < face.right && face.top < face.bottom && marker.diameter > 0)) return;
      live.add(key);
      const nominal = Math.max(face.right - face.left, face.bottom - face.top) * marker.diameter * devicePixelsPerUnit;
      const measured = raster && nominal > 80 ? capPixels(marker, face, raster) : undefined;
      const baseline = Math.min(BASE_CELL_LIMIT, cellSize(nominal));
      const size = Math.max(baseline, measured ? cellSize(measured.pixels) : 0);
      work.push({ key, marker, face, size, priority: measured?.priority ?? Infinity, order: work.length + 1 });
    });
    for (const [key, paint] of this.markers) {
      if (live.has(key)) continue;
      this.retire(paint);
      this.markers.delete(key);
    }
    // Reserve high-resolution pages for the place the user is looking at.
    // Release from the former crop first. Otherwise earlier devices in floor
    // order would keep the pages when the user pans without changing zoom.
    const slots = new Map<number, number>();
    const limits = new Map<number, number>();
    let pages = 0;
    const nearest = work.filter(row => row.face.glyph && row.size > BASE_CELL_LIMIT)
      .sort((a, b) => a.priority - b.priority);
    for (const row of nearest) {
      while (row.size > BASE_CELL_LIMIT) {
        const free = slots.get(row.size) ?? 0;
        if (free) { slots.set(row.size, free - 1); break; }
        if (pages < HIGH_PAGE_LIMIT) {
          pages++;
          limits.set(row.size, (limits.get(row.size) ?? 0) + 1);
          slots.set(row.size, atlasRow(row.size) ** 2 - 1);
          break;
        }
        row.size /= 2;
      }
    }
    for (const {key, face, size} of work) {
      const paint = this.markers.get(key);
      if (paint?.cell && (!face.glyph || paint.cell.page.cell !== size)) this.clearInk(paint);
    }
    const spare = this.atlas.pagesToCompact(limits);
    if (spare.size) for (const paint of this.markers.values())
      if (paint.cell && spare.has(paint.cell.page)) this.clearInk(paint);
    // Allocation order follows focus priority; draw/pick order stays in the
    // original marker order regardless of which pages were compacted.
    const update = ({ key, marker, face, size, order }: typeof work[number]) => this.update(key, marker, face, size, order);
    for (const row of nearest) if (row.size > BASE_CELL_LIMIT) update(row);
    for (const row of work) if (row.size <= BASE_CELL_LIMIT || !row.face.glyph) update(row);
  }

  private update(key: string, marker: Plan3dMarker, face: Plan3dMarkerFace, size: number, order: number): void {
    const { center: [x, y], diameter, height } = marker;
    const { left, right, top, bottom, rx, ry, angle = 0 } = face;
    const w = (right - left) * diameter, h = (bottom - top) * diameter;
    const geometryKey = [left, right, top, bottom, rx, ry, angle, diameter].join('|');
    let paint = this.markers.get(key);
    if (paint?.key !== geometryKey) {
      if (paint) this.retire(paint);
      const prism = planPrismMesh([[ring(face, diameter)]], -diameter * .24, 0);
      const body = new Mesh(prism, [face.color, face.edge, face.edge].map(color => new MeshBasicMaterial({ color, toneMapped: false })));
      body.userData.plan3dPick = { id: marker.id, geometryOnly: true };
      this.group.add(body);
      this.markers.set(key, paint = { key: geometryKey, body });
    }
    const cap = paint.body.material[0];
    // In the equal-depth case resolve a tie in the same marker order as the
    // interactive DOM and the colour-picking pass.
    paint.body.renderOrder = order;
    paint.body.material[1].color.set(face.edge);
    paint.body.material[2].color.set(face.edge);
    paint.body.position.set(x, height, y);
    if (!face.glyph) {
      cap.color.set(face.color);
      return;
    }
    const previousSize = paint.cell?.page.cell ?? 0;
    let next: AtlasCell | undefined;
    for (let request = size; request > previousSize; request /= 2) {
      next = this.atlas.allocate(request);
      if (next) break;
    }
    if (next) {
      this.clearInk(paint);
      paint.cell = next;
      this.atlas.apply(paint.cell, paint.body.geometry, [(left + right) * diameter / 2, (top + bottom) * diameter / 2], w, h, angle);
      cap.map = paint.cell.page.texture;
      cap.needsUpdate = true;
    }
    if (!paint.cell) throw new Error('Cannot allocate the marker cap');
    cap.color.set(0xffffff);
    const glyphKey = JSON.stringify([face.glyph, face.foreground, face.color]);
    if (paint.glyphKey !== glyphKey) {
      this.atlas.paint(paint.cell, face.glyph, face.foreground, face.color, w / h);
      paint.glyphKey = glyphKey;
    }
  }

  private clearInk(paint: MarkerPaint): void {
    if (!paint.cell) return;
    const cap = paint.body.material[0];
    cap.map = null;
    cap.needsUpdate = true;
    this.atlas.release(paint.cell);
    paint.cell = paint.glyphKey = undefined;
  }

  private retire(paint: MarkerPaint): void {
    this.clearInk(paint);
    this.group.remove(paint.body);
    paint.body.geometry.dispose();
    for (const material of paint.body.material) material.dispose();
  }

  dispose(): void { this.present([], 0); }
}
