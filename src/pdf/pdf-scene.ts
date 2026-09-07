import type { DecorShape } from '../editors/decor/types';
import { boxCorners, decorStrokeCm } from '../editors/decor/geometry';
import { GENERATED_FURNITURE_ART } from '../furniture-plan-art.generated';
import { formatArea } from '../area-format';
import { roomPoly } from '../logic';
import {
  floorMinusBodies, geometryAllRings, geometryArea, geometryOuterRings, physicalBodyParts,
} from '../physical-geometry';
import {
  geometryOpenings, geometryPartitionOpeningCuts, geometryRoomOpeningInputs,
  type GeometryOpeningProjection,
} from '../plan-geometry-preflight';
import { labelPos, GRID_PITCH, GRID_STEP_N, NORM_W } from '../space-geometry';
import type { OpeningCfg, ServerConfig, SpaceModel } from '../types';
import {
  innerContourForRoom, openingInnerFaceOffset, wallBodiesGeometry,
  type WallBodiesGeometryResult, type WallEntry,
} from '../wall-thickness';
import { resolveZeroWalls } from '../zero-walls';
import { northDegOf } from '../sun';
import {
  choosePdfScale, compactRing, dimensionEdges, edgeNormal, outsideNormal, ringCentroid,
  stableDimensionEdges,
} from './pdf-dimensions';
import { measurePdfText, type PdfCommand, type PdfJpegImage, type PdfPage } from './pdf-writer';
import { transformSvgPath } from './svg-path';
import { pdfLocalDate } from './pdf-date';

export interface PdfExportOptions {
  dimensions: boolean;
  decor: boolean;
  roomNames: boolean;
  backdrop: boolean;
}

export interface PdfRasterPlacement extends PdfJpegImage {
  x: number;
  y: number;
  drawWidth: number;
  drawHeight: number;
  angle?: number;
  opacity?: number;
}

/** Persisted space fields consumed by the print-only projection. */
export interface PdfRawSpace {
  cell_cm?: unknown;
  walls?: WallEntry[];
  decor?: DecorShape[];
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PdfSharedWallGeometry = Pick<WallBodiesGeometryResult,
  'status' | 'components' | 'roomGeom' | 'openingIndex' | 'multiWallNodes'>;

export interface PdfSceneInput {
  config: ServerConfig;
  rawSpace: PdfRawSpace;
  space: SpaceModel;
  layout: Record<string, { s?: string; x: number; y: number } | undefined>;
  options: PdfExportOptions;
  imperial: boolean;
  cardTitle: string;
  version: string;
  now: Date;
  t: (key: string, vars?: Record<string, string | number>) => string;
  rasters?: readonly PdfRasterPlacement[];
  /** The exact structural pass already used by the visible card. */
  sharedWallGeometry?: PdfSharedWallGeometry | null;
  /** The visible card's per-room clean-floor cache, resolved only when dimensions are requested. */
  resolveInnerContour?: (roomId: string) => number[][] | null | undefined;
  /** Area in render units from the same clean-floor cache used by the visible card. */
  resolveRoomArea?: (roomId: string, contour: number[][]) => number | undefined;
}

const MM = 72 / 25.4;
const INK: readonly [number, number, number] = [0.08, 0.08, 0.08];
const WALL: readonly [number, number, number] = [0.33, 0.33, 0.33];
const LIGHT: readonly [number, number, number] = [0.72, 0.72, 0.72];

type TextBox = { minX: number; minY: number; maxX: number; maxY: number };
const intersects = (a: TextBox, b: TextBox): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
const inside = (a: TextBox, b: TextBox): boolean =>
  a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;
function textBox(
  x: number, y: number, text: string, size: number, angle = 0, align: 'left' | 'center' | 'right' = 'left',
): TextBox {
  const width = measurePdfText(text, size);
  const height = size * 1.15;
  const anchorX = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  const centerX = anchorX + width / 2, centerY = y - height / 2;
  const radians = angle * Math.PI / 180;
  const projectedWidth = Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height;
  const projectedHeight = Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height;
  return { minX: centerX - projectedWidth / 2, maxX: centerX + projectedWidth / 2,
    minY: centerY - projectedHeight / 2, maxY: centerY + projectedHeight / 2 };
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };
const emptyBox = (): Box => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const extend = (box: Box, point: readonly number[]): void => {
  box.minX = Math.min(box.minX, point[0]); box.minY = Math.min(box.minY, point[1]);
  box.maxX = Math.max(box.maxX, point[0]); box.maxY = Math.max(box.maxY, point[1]);
};
const ringBox = (rings: readonly number[][][]): Box => {
  const box = emptyBox();
  for (const ring of rings) for (const point of ring) extend(box, point);
  return box;
};
const validBox = (box: Box): boolean => [box.minX, box.minY, box.maxX, box.maxY].every(Number.isFinite)
  && box.maxX > box.minX && box.maxY > box.minY;

function ellipseRing(x: number, y: number, w: number, h: number, rotationDeg = 0): number[][] {
  const rotation = rotationDeg * Math.PI / 180;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const cx = x + w / 2, cy = y + h / 2;
  return Array.from({ length: 48 }, (_, index) => {
    const angle = index / 48 * Math.PI * 2;
    const dx = Math.cos(angle) * w / 2, dy = Math.sin(angle) * h / 2;
    return [cx + c * dx - s * dy, cy + s * dx + c * dy];
  });
}

function openingLines(opening: GeometryOpeningProjection, faceCm: number, cellCm: number): number[][][] {
  if (opening.type === 'passage') return [];
  const half = opening.rlen / 2;
  const depth = faceCm > 0 ? faceCm / cellCm * GRID_PITCH / 2 : 2;
  const local: number[][][] = [];
  if (opening.type === 'window') {
    local.push([[-half, -depth], [half, -depth]], [[-half, depth], [half, depth]],
      [[-half, -depth], [-half, depth]], [[half, -depth], [half, depth]]);
  } else if (opening.type === 'gate') {
    const turn = ((opening.flip_v ? -1 : 1) * 10) * Math.PI / 180;
    const leaves = [
      [[-half, 0], [-half + Math.cos(turn) * half, Math.sin(turn) * half]],
      [[half, 0], [half - Math.cos(turn) * half, Math.sin(-turn) * half]],
    ];
    local.push(...leaves);
    for (const leaf of leaves) {
      const dx = leaf[1][0] - leaf[0][0], dy = leaf[1][1] - leaf[0][1];
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length;
      const hatch = Math.min(length * 0.08, Math.max(1, depth * 0.7));
      for (const at of [0.3, 0.5, 0.7]) {
        const x = leaf[0][0] + dx * at, y = leaf[0][1] + dy * at;
        local.push([[x - nx * hatch, y - ny * hatch], [x + nx * hatch, y + ny * hatch]]);
      }
    }
  } else {
    const direction = opening.flip_v ? 1 : -1;
    const hinge = opening.flip_h ? half : -half;
    const leafEnd = [hinge, direction * opening.rlen];
    local.push([[hinge, 0], leafEnd]);
    const arc: number[][] = [];
    for (let index = 0; index <= 16; index++) {
      const angle = direction * index / 16 * Math.PI / 2;
      const sign = opening.flip_h ? -1 : 1;
      arc.push([hinge + sign * Math.cos(angle) * opening.rlen, Math.sin(angle) * opening.rlen]);
    }
    local.push(arc);
  }
  const angle = opening.angle * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return local.map((line) => line.map(([x, y]) => [
    opening.rx + x * c - y * s, opening.ry + x * s + y * c,
  ]));
}

function physicalGeometry(input: PdfSceneInput) {
  const { rawSpace, space } = input;
  const cellCm = Number(rawSpace.cell_cm) > 0 ? Number(rawSpace.cell_cm) : 5;
  const walls: WallEntry[] = Array.isArray(rawSpace.walls) ? rawSpace.walls : [];
  const zero = resolveZeroWalls(rawSpace, space, NORM_W, GRID_PITCH * 0.02);
  const openings = geometryOpenings(rawSpace, space, cellCm, GRID_PITCH, NORM_W);
  const partitionCuts = geometryPartitionOpeningCuts(openings);
  const extras = physicalBodyParts(space, cellCm, GRID_PITCH, GRID_PITCH * 0.0002, partitionCuts).all;
  const roomOpenings = geometryRoomOpeningInputs(
    openings, space, walls, zero.contour, GRID_STEP_N, cellCm, GRID_PITCH, NORM_W,
  );
  const geometry = input.sharedWallGeometry || wallBodiesGeometry(
    space.rooms, walls, zero.contour, roomOpenings, GRID_STEP_N,
    cellCm, GRID_PITCH, NORM_W, extras,
  );
  return { cellCm, walls, zero, openings, extras, geometry };
}

function bodiesOverlappingRing(ring: number[][], bodies: number[][][]): number[][][] {
  const bounds = ringBox([ring]);
  return bodies.filter((body) => {
    const box = ringBox([body]);
    return box.maxX >= bounds.minX && box.minX <= bounds.maxX
      && box.maxY >= bounds.minY && box.minY <= bounds.maxY;
  });
}

function decorBounds(rawSpace: PdfRawSpace, include: boolean): number[][][] {
  if (!include) return [];
  const result: number[][][] = [];
  for (const shape of (rawSpace.decor || []) as DecorShape[]) {
    if (shape.kind === 'line') result.push([
      [shape.x1 * NORM_W, shape.y1 * NORM_W], [shape.x2 * NORM_W, shape.y2 * NORM_W],
    ]);
    else if (shape.kind !== 'text') result.push(boxCorners(shape).map(([x, y]) => [x * NORM_W, y * NORM_W]));
    else result.push([[shape.x * NORM_W, shape.y * NORM_W]]);
  }
  return result;
}

export function buildPdfPage(input: PdfSceneInput): PdfPage & { scale: number } {
  const built = physicalGeometry(input);
  const dimensionContours = new Map<(typeof input.space.rooms)[number], number[][]>();
  if (input.options.dimensions) for (const room of input.space.rooms) {
    const original = roomPoly(room);
    if (!original) continue;
    const shared = room.id ? input.resolveInnerContour?.(room.id) : undefined;
    dimensionContours.set(room, room.id ? (shared === undefined ? innerContourForRoom(
      input.space.rooms, room.id, built.walls, built.zero.contour, GRID_STEP_N,
      built.cellCm, GRID_PITCH, NORM_W, built.geometry.roomGeom, built.geometry.multiWallNodes,
    ) : shared) || original : original);
  }
  const architectureRings = built.geometry.status === 'failed-core'
    ? input.space.rooms.map((room) => roomPoly(room) || []).filter((ring) => ring.length)
    : built.geometry.components.flatMap((component) => geometryAllRings(component.geom));
  const allBounds = [...architectureRings, ...built.zero.lines.map((line) => [[line[0], line[1]], [line[2], line[3]]])];
  if (input.options.decor) allBounds.push(...decorBounds(input.rawSpace, true));
  for (const raster of input.rasters || []) allBounds.push([
    [raster.x, raster.y], [raster.x + raster.drawWidth, raster.y + raster.drawHeight],
  ]);
  let bounds = ringBox(allBounds);
  if (!validBox(bounds)) bounds = { minX: 0, minY: 0, maxX: NORM_W, maxY: NORM_W };
  const cmPerUnit = built.cellCm / GRID_PITCH;
  const physicalWidth = (bounds.maxX - bounds.minX) * cmPerUnit;
  const physicalHeight = (bounds.maxY - bounds.minY) * cmPerUnit;
  const landscape = physicalWidth > physicalHeight;
  const pageWidth = (landscape ? 297 : 210) * MM;
  const pageHeight = (landscape ? 210 : 297) * MM;
  const margin = 12 * MM, header = 18 * MM, footer = 24 * MM;
  const fieldWidthMm = (pageWidth - margin * 2) / MM;
  const fieldHeightMm = (pageHeight - margin * 2 - header - footer) / MM;
  const hasNonRectRoom = [...dimensionContours.values()]
    .some((ring) => compactRing(ring).length !== 4);
  // A non-rectangular room may need the mandatory R<n> value block. Reserve
  // it before choosing the scale so a fallback never covers the plan.
  const calloutWidthMm = hasNonRectRoom ? 48 : 0;
  // The chain starts 6 mm outside the wall; a crowded label can use a shelf
  // out to 13 mm. Reserve 15 mm per side so a just-fitting plan stays inside
  // the printable field.
  const dimensionReserveMm = input.options.dimensions ? 30 : 0;
  const scale = choosePdfScale(physicalWidth, physicalHeight,
    fieldWidthMm - calloutWidthMm - dimensionReserveMm,
    fieldHeightMm - dimensionReserveMm);
  const pointPerUnit = cmPerUnit * (10 * MM) / scale;
  const drawingWidth = (bounds.maxX - bounds.minX) * pointPerUnit;
  const drawingHeight = (bounds.maxY - bounds.minY) * pointPerUnit;
  const fieldTop = margin + header;
  const fieldHeight = pageHeight - fieldTop - margin - footer;
  const planFieldWidth = pageWidth - margin * 2 - calloutWidthMm * MM;
  const left = margin + (planFieldWidth - drawingWidth) / 2;
  const top = fieldTop + (fieldHeight - drawingHeight) / 2;
  const pt = (point: readonly number[]): [number, number] => [
    left + (point[0] - bounds.minX) * pointPerUnit,
    top + (point[1] - bounds.minY) * pointPerUnit,
  ];
  const furnitureMatrix = (shape: Extract<DecorShape, { kind: 'furniture' }>, artW: number, artH: number) => {
    const x = shape.x * NORM_W, y = shape.y * NORM_W;
    const w = shape.w * NORM_W, h = shape.h * NORM_W;
    const cx = x + w / 2, cy = y + h / 2;
    const tx = x + (shape.flip_h ? w : 0), ty = y + (shape.flip_v ? h : 0);
    const sx = (shape.flip_h ? -1 : 1) * w / artW;
    const sy = (shape.flip_v ? -1 : 1) * h / artH;
    const angle = (Number(shape.angle) || 0) * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle);
    const constantX = cx + c * (tx - cx) - s * (ty - cy);
    const constantY = cy + s * (tx - cx) + c * (ty - cy);
    return {
      a: pointPerUnit * c * sx, b: pointPerUnit * s * sx,
      c: -pointPerUnit * s * sy, d: pointPerUnit * c * sy,
      e: left + (constantX - bounds.minX) * pointPerUnit,
      f: top + (constantY - bounds.minY) * pointPerUnit,
    };
  };

  const commands: PdfCommand[] = [];
  // Architectural export deliberately has no marker/device projection pass.
  const occupied: TextBox[] = [];
  const planField: TextBox = {
    minX: margin, minY: fieldTop,
    maxX: margin + planFieldWidth, maxY: fieldTop + fieldHeight,
  };
  for (const raster of input.rasters || []) commands.push({
    kind: 'image', imageId: raster.id, ...pt([raster.x, raster.y]).reduce((o, value, index) =>
      ({ ...o, [index ? 'y' : 'x']: value }), {} as { x: number; y: number }),
    width: raster.drawWidth * pointPerUnit, height: raster.drawHeight * pointPerUnit,
    angle: raster.angle, opacity: raster.opacity,
  });
  for (const component of built.geometry.components) commands.push({
    kind: 'path', rings: geometryAllRings(component.geom).map((ring) => ring.map(pt)),
    fill: WALL, stroke: INK, width: 0.25 * MM,
  });
  if (!built.geometry.components.length) for (const room of input.space.rooms) {
    const poly = roomPoly(room);
    if (poly) commands.push({ kind: 'path', rings: [poly.map(pt)], stroke: INK, width: 0.25 * MM });
  }
  for (const line of built.zero.lines) commands.push({
    kind: 'line', points: [pt([line[0], line[1]]), pt([line[2], line[3]])],
    stroke: INK, width: 0.35 * MM, dash: [3 * MM, 2 * MM],
  });

  const wallIndexGeometry = built.geometry.openingIndex;
  for (const opening of built.openings) {
    const face = opening.partitionHost
      ? { cm: opening.partitionHost.partition.cm }
      : wallIndexGeometry
        ? openingInnerFaceOffset(input.space.rooms, opening, built.walls,
            GRID_STEP_N, built.cellCm, GRID_PITCH, NORM_W, built.zero.contour)
        : { cm: 0 };
    for (const line of openingLines(opening, face.cm, built.cellCm)) commands.push({
      kind: 'line', points: line.map(pt), stroke: INK, width: 0.3 * MM,
    });
  }

  if (input.options.decor) for (const shape of (input.rawSpace.decor || []) as DecorShape[]) {
    if (shape.kind === 'image') continue;
    if (shape.kind === 'line') commands.push({
      kind: 'line', points: [pt([shape.x1 * NORM_W, shape.y1 * NORM_W]),
        pt([shape.x2 * NORM_W, shape.y2 * NORM_W])], stroke: INK,
      width: Math.max(0.2 * MM, Number(shape.width_cm || 1) * 10 * MM / scale),
      dash: shape.line_style === 'dashed' ? [3 * MM, 2 * MM] : undefined,
    });
    else if (shape.kind === 'text') commands.push({
      kind: 'text', ...(() => { const [x, y] = pt([shape.x * NORM_W, shape.y * NORM_W]); return { x, y }; })(),
      text: shape.text, size: Math.max(6, Number(shape.size_cm || 20) * 10 * MM / scale),
      angle: Number(shape.angle) || 0,
    });
    else if (shape.kind === 'furniture') {
      const art = GENERATED_FURNITURE_ART[shape.symbol];
      if (art) commands.push({
        kind: 'vector', ops: transformSvgPath(art.d, furnitureMatrix(shape, art.viewW, art.viewH)),
        stroke: INK,
        width: Math.max(0.2 * MM, decorStrokeCm(shape, built.cellCm, GRID_PITCH) * 10 * MM / scale),
      });
      else commands.push({
        kind: 'path', rings: [boxCorners(shape).map(([x, y]) => pt([x * NORM_W, y * NORM_W]))],
        stroke: INK, width: 0.25 * MM,
      });
    } else {
      const ring = shape.kind === 'ellipse'
        ? ellipseRing(shape.x * NORM_W, shape.y * NORM_W, shape.w * NORM_W, shape.h * NORM_W,
            Number(shape.angle) || 0)
        : boxCorners(shape).map(([x, y]) => [x * NORM_W, y * NORM_W]);
      commands.push({ kind: 'path', rings: [ring.map(pt)], stroke: INK, width: 0.25 * MM });
    }
  }

  if (input.options.dimensions && built.geometry.roomGeom) {
    for (const ring of geometryOuterRings(built.geometry.roomGeom)) {
      const centroid = ringCentroid(ring);
      for (const edge of dimensionEdges(ring, cmPerUnit, input.imperial)) {
        const outward = outsideNormal(edge.a, edge.b, centroid);
        const a = pt(edge.a), b = pt(edge.b);
        const oa: [number, number] = [a[0] + outward[0] * 6 * MM, a[1] + outward[1] * 6 * MM];
        const ob: [number, number] = [b[0] + outward[0] * 6 * MM, b[1] + outward[1] * 6 * MM];
        const middle: [number, number] = [(oa[0] + ob[0]) / 2, (oa[1] + ob[1]) / 2];
        const needsShelf = measurePdfText(edge.text, 7) + 2 * MM > Math.hypot(ob[0] - oa[0], ob[1] - oa[1]);
        const label: [number, number] = [middle[0] + outward[0] * (needsShelf ? 7 : 2) * MM,
          middle[1] + outward[1] * (needsShelf ? 7 : 2) * MM];
        commands.push({ kind: 'line', points: [oa, ob], stroke: INK, width: 0.2 * MM },
          { kind: 'line', points: [a, oa], stroke: INK, width: 0.15 * MM },
          { kind: 'line', points: [b, ob], stroke: INK, width: 0.15 * MM });
        if (needsShelf) commands.push({
          kind: 'line', points: [middle, label], stroke: INK, width: 0.15 * MM,
        });
        commands.push({ kind: 'text', x: label[0], y: label[1], text: edge.text,
          size: 7, angle: edge.angle, align: 'center' });
        occupied.push(textBox(label[0], label[1], edge.text, 7, edge.angle, 'center'));
      }
    }
  }

  const callouts: Array<{ mark: string; room: string; value: string }> = [];
  const rooms = [...input.space.rooms].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  for (const room of rooms) {
    const original = roomPoly(room);
    if (!original) continue;
    const contour = dimensionContours.get(room) || original;
    const cachedArea = input.options.dimensions && room.id
      ? input.resolveRoomArea?.(room.id, contour) : undefined;
    const localBodies = input.options.dimensions && !Number.isFinite(cachedArea)
      ? bodiesOverlappingRing(contour, built.extras) : [];
    const candidates = localBodies.length ? floorMinusBodies(contour, localBodies) : null;
    const areaUnits = Number.isFinite(cachedArea) && (cachedArea as number) >= 0
      ? cachedArea as number
      : candidates ? geometryArea(candidates) : Math.abs(
        contour.reduce((sum, p, i) => { const q = contour[(i + 1) % contour.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
    const label = labelPos(room, input.space.id, input.layout, input.config);
    const [labelX, labelY] = pt([label.x, label.y]);
    const pageContour = contour.map(pt);
    const contourBounds = ringBox([pageContour]);
    let printedName = false;
    if (input.options.roomNames && room.name) {
      const available = Math.max(0, contourBounds.maxX - contourBounds.minX - 4 * MM);
      const nameSize = measurePdfText(room.name, 9) <= available ? 9
        : measurePdfText(room.name, 7) <= available ? 7 : 0;
      if (nameSize) {
        commands.push({ kind: 'text', x: labelX, y: labelY - 2, text: room.name,
          size: nameSize, align: 'center' });
        occupied.push(textBox(labelX, labelY - 2, room.name, nameSize, 0, 'center'));
        printedName = true;
      }
    }
    if (input.options.dimensions) {
      const area = formatArea(areaUnits * cmPerUnit * cmPerUnit / 1e4, input.imperial);
      const areaY = labelY + (printedName ? 8 : 0);
      commands.push({ kind: 'text', x: labelX, y: areaY, text: area, size: 8, align: 'center' });
      occupied.push(textBox(labelX, areaY, area, 8, 0, 'center'));
    }
    if (input.options.dimensions) {
      const centroid = ringCentroid(contour);
      const edges = stableDimensionEdges(contour, cmPerUnit, input.imperial);
      const nonRect = edges.length !== 4;
      for (const edge of edges) {
        const inward = edgeNormal(edge.a, edge.b, centroid);
        const base = pt(edge.mid);
        const x = base[0] + inward[0] * 2 * MM, y = base[1] + inward[1] * 2 * MM;
        if (edge.short) {
          const a = pt(edge.a), b = pt(edge.b);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          commands.push({ kind: 'line', points: [[mx - inward[0] * 1.5 * MM, my - inward[1] * 1.5 * MM],
            [mx + inward[0] * 1.5 * MM, my + inward[1] * 1.5 * MM]], stroke: INK, width: 0.2 * MM });
        } else {
          const a = pt(edge.a), b = pt(edge.b);
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const tangent: [number, number] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
          let placed: { x: number; y: number; size: number; box: TextBox } | null = null;
          for (const candidate of [
            { size: 7, shift: 0 }, { size: 6, shift: 0 }, { size: 6, shift: 4 },
            { size: 6, shift: -4 }, { size: 6, shift: 8 }, { size: 6, shift: -8 },
          ]) {
            const cx = x + tangent[0] * candidate.shift * MM;
            const cy = y + tangent[1] * candidate.shift * MM;
            const box = textBox(cx, cy, edge.text, candidate.size, edge.angle, 'center');
            const fitsEdge = measurePdfText(edge.text, candidate.size) + 2 * MM <= length;
            if (fitsEdge && inside(box, planField) && !occupied.some((other) => intersects(box, other))) {
              placed = { x: cx, y: cy, size: candidate.size, box };
              break;
            }
          }
          if (placed) {
            commands.push({ kind: 'text', x: placed.x, y: placed.y, text: edge.text,
              size: placed.size, angle: edge.angle, align: 'center' });
            occupied.push(placed.box);
          } else if (nonRect) {
            const mark = `R${callouts.length + 1}`;
            const markerX = base[0] + inward[0] * 4 * MM;
            const markerY = base[1] + inward[1] * 4 * MM;
            commands.push({ kind: 'line', points: [base, [markerX, markerY]], stroke: INK, width: 0.15 * MM },
              { kind: 'text', x: markerX, y: markerY, text: mark, size: 6, align: 'center' });
            callouts.push({ mark, room: room.name || room.id || '', value: edge.text });
          } else {
            // Rectangles are still fully dimensioned when no duplicate can be
            // hidden safely; preserving the value is preferable to clipping it.
            commands.push({ kind: 'text', x, y, text: edge.text, size: 6,
              angle: edge.angle, align: 'center' });
          }
        }
      }
    }
  }

  if (callouts.length) {
    const x = pageWidth - margin - calloutWidthMm * MM + 3 * MM;
    let y = fieldTop + 5 * MM;
    commands.push({ kind: 'text', x, y, text: input.t('pdf.internal_dimensions'), size: 8 });
    y += 5 * MM;
    for (const callout of callouts) {
      commands.push({ kind: 'text', x, y,
        text: `${callout.mark} ${callout.room}: ${callout.value}`, size: 6 });
      y += 4 * MM;
    }
  }

  commands.push({ kind: 'text', x: margin, y: margin + 10, text: input.space.title, size: 14 });
  if (input.cardTitle) commands.push({
    kind: 'text', x: pageWidth - margin, y: margin + 10, text: input.cardTitle,
    size: 10, align: 'right',
  });
  const footerY = pageHeight - margin - 13 * MM;
  commands.push({ kind: 'line', points: [[margin, footerY - 4 * MM], [pageWidth - margin, footerY - 4 * MM]],
    stroke: LIGHT, width: 0.2 * MM });
  commands.push({ kind: 'text', x: margin, y: footerY,
    text: input.t('pdf.scale', { n: scale }), size: 8 });
  const barCm = input.imperial ? 152.4 : 100;
  const barLength = barCm * 10 * MM / scale;
  const barY = footerY + 8;
  commands.push({ kind: 'line', points: [[margin, barY], [margin + barLength, barY]], stroke: INK, width: 0.4 * MM });
  for (let index = 0; index <= 4; index++) {
    const tickX = margin + barLength * index / 4;
    commands.push({ kind: 'line', points: [[tickX, barY - 2], [tickX, barY + 2]],
      stroke: INK, width: 0.25 * MM });
  }
  commands.push(
    { kind: 'text', x: margin + barLength / 2, y: footerY + 17,
      text: input.imperial ? '5 ft' : '1 m', size: 7, align: 'center' });
  const north = northDegOf(input.config.settings, input.rawSpace.settings || {});
  if (north !== null) {
    const nx = pageWidth / 2, ny = footerY + 8;
    const angle = north * Math.PI / 180;
    const tipX = nx + Math.sin(angle) * 8 * MM, tipY = ny - Math.cos(angle) * 8 * MM;
    commands.push({ kind: 'line', points: [[nx, ny], [tipX, tipY]],
      stroke: INK, width: 0.3 * MM });
    for (const wing of [-0.45, 0.45]) {
      commands.push({ kind: 'line', points: [[tipX, tipY], [
        tipX - Math.sin(angle + wing) * 2.5 * MM,
        tipY + Math.cos(angle + wing) * 2.5 * MM,
      ]], stroke: INK, width: 0.3 * MM });
    }
    commands.push(
      { kind: 'text', x: nx, y: footerY, text: input.t('pdf.north'), size: 7, align: 'center' });
  }
  const legend: string[] = [];
  if (built.geometry.components.length) legend.push(input.t('pdf.legend.wall'));
  if (input.space.partitions.length) legend.push(input.t('pdf.legend.partition'));
  if (built.zero.lines.length) legend.push(input.t('pdf.legend.virtual'));
  const openingLegend = {
    door: input.t('pdf.legend.door'), window: input.t('pdf.legend.window'), gate: input.t('pdf.legend.gate'),
  };
  for (const type of ['door', 'window', 'gate'] as const) {
    if (built.openings.some((opening: OpeningCfg) => opening.type === type)) legend.push(openingLegend[type]);
  }
  commands.push({ kind: 'text', x: pageWidth - margin, y: footerY,
    text: legend.join(' · '), size: 7, align: 'right' });
  commands.push({ kind: 'text', x: pageWidth - margin, y: footerY + 12,
    text: `${pdfLocalDate(input.now)} · House Plan v${input.version}`,
    size: 7, align: 'right' });
  return { width: pageWidth, height: pageHeight, commands,
    images: (input.rasters || []).map(({ id, bytes, width, height }) => ({ id, bytes, width, height })),
    now: input.now, scale };
}
