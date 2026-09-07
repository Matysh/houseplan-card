import type { DecorShape } from '../editors/decor/types';
import { boxCorners, decorStrokeCm } from '../editors/decor/geometry';
import { GENERATED_FURNITURE_ART } from '../furniture-plan-art.generated';
import { formatArea } from '../area-format';
import { roomPoly } from '../logic';
import {
  floorMinusBodies, geometryAllRings, geometryArea, geometryOuterRings, physicalBodyParts,
  pointInPhysicalGeometry,
} from '../physical-geometry';
import {
  geometryOpenings, geometryPartitionOpeningCuts, geometryRoomOpeningInputs,
  type GeometryOpeningProjection,
} from '../plan-geometry-preflight';
import { labelPos, GRID_PITCH, GRID_STEP_N, NORM_W } from '../space-geometry';
import type { ServerConfig, SpaceModel } from '../types';
import {
  innerContourForRoom, openingInnerFaceOffset, wallBodiesGeometry,
  type WallBodiesGeometryResult, type WallEntry,
} from '../wall-thickness';
import { resolveZeroWalls } from '../zero-walls';
import { northDegOf } from '../sun';
import {
  compactRing, dedupeOppositeDimensionEdges, dimensionEdges, dimensionEpsilonUnits,
  groupCollinearDimensionEdges, PDF_SCALE_SERIES, pointInSimpleRing,
  stableDimensionEdges, type DimensionEdge,
} from './pdf-dimensions';
import { pdfCompassOps } from './pdf-compass';
import {
  pdfBoxInsideRing, pdfBoxTouchesGeometry, pdfInflateBox, pdfSegmentTouchesBox,
  pdfSegmentTouchesGeometry, type PdfCollisionBox, type PdfCollisionPoint,
} from './pdf-collision';
import {
  centerPdfScene, pdfBoundsHeight, pdfBoundsWidth, pdfCommandBounds, pdfSceneFits,
  type PdfBounds, type PdfField,
} from './pdf-layout';
import {
  measurePdfText, pdfTextBounds, type PdfCommand, type PdfJpegImage, type PdfPage,
  type PdfTextBounds,
} from './pdf-writer';
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

export interface BuiltPdfPage extends PdfPage {
  scale: number;
  /** Full translated plan-scene bbox; header/footer are deliberately excluded. */
  sceneBounds: PdfBounds;
  /** Printable field used for scene fitting and centring. */
  planField: PdfField;
}

const MM = 72 / 25.4;
const INK: readonly [number, number, number] = [0.08, 0.08, 0.08];
const WALL: readonly [number, number, number] = [127 / 255, 127 / 255, 127 / 255];
const LIGHT: readonly [number, number, number] = [0.72, 0.72, 0.72];

type TextBox = PdfTextBounds;
const intersects = (a: TextBox, b: TextBox): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
function textBox(
  x: number, y: number, text: string, size: number, angle = 0, align: 'left' | 'center' | 'right' = 'left',
): TextBox {
  return pdfTextBounds({ kind: 'text', x, y, text, size, angle, align });
}

function textNormalOffset(
  box: TextBox, anchorX: number, anchorY: number, normal: readonly number[], clearance: number,
): number {
  const minNormal = Math.min(
    ...[[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]]
      .map(([x, y]) => (x - anchorX) * normal[0] + (y - anchorY) * normal[1]),
  );
  return Math.max(0, clearance - minNormal);
}

function pageHatchLines(pageWidth: number, pageHeight: number): Array<readonly [readonly [number, number], readonly [number, number]]> {
  const step = 3 * MM * Math.SQRT2;
  const lines: Array<readonly [readonly [number, number], readonly [number, number]]> = [];
  for (let intercept = -pageHeight; intercept <= pageWidth + step; intercept += step) {
    lines.push([[intercept, 0], [intercept + pageHeight, pageHeight]]);
  }
  return lines;
}

const normalKey = (edge: DimensionEdge, normal: readonly number[]): string => (
  `${edge.axis}:${normal[0] < -0.5 || normal[1] < -0.5 ? -1 : 1}`
);

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

function rotatedRectRing(x: number, y: number, w: number, h: number, rotationDeg = 0): number[][] {
  const rotation = rotationDeg * Math.PI / 180;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const cx = x + w / 2, cy = y + h / 2;
  return [
    [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2],
  ].map(([dx, dy]) => [cx + c * dx - s * dy, cy + s * dx + c * dy]);
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

interface PreparedPdfScene {
  built: ReturnType<typeof physicalGeometry>;
  dimensionContours: Map<SpaceModel['rooms'][number], number[][]>;
  roomAreas: Map<SpaceModel['rooms'][number], number>;
  bounds: Box;
  cmPerUnit: number;
}

interface PdfCandidate {
  page: BuiltPdfPage;
  sceneBounds: PdfBounds;
  field: PdfField;
  fits: boolean;
  fillRatio: number;
  landscape: boolean;
}

function preparePdfScene(input: PdfSceneInput): PreparedPdfScene {
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
  const roomAreas = new Map<SpaceModel['rooms'][number], number>();
  if (input.options.dimensions) for (const room of input.space.rooms) {
    const original = roomPoly(room);
    if (!original) continue;
    const contour = dimensionContours.get(room) || original;
    const cachedArea = room.id ? input.resolveRoomArea?.(room.id, contour) : undefined;
    const localBodies = !Number.isFinite(cachedArea)
      ? bodiesOverlappingRing(contour, built.extras) : [];
    const candidates = localBodies.length ? floorMinusBodies(contour, localBodies) : null;
    const areaUnits = Number.isFinite(cachedArea) && (cachedArea as number) >= 0
      ? cachedArea as number
      : candidates ? geometryArea(candidates) : Math.abs(
        contour.reduce((sum, point, index) => {
          const next = contour[(index + 1) % contour.length];
          return sum + point[0] * next[1] - next[0] * point[1];
        }, 0) / 2);
    roomAreas.set(room, areaUnits);
  }
  const architectureRings = built.geometry.status === 'failed-core'
    ? input.space.rooms.map((room) => roomPoly(room) || []).filter((ring) => ring.length)
    : built.geometry.components.flatMap((component) => geometryAllRings(component.geom));
  const allBounds = [...architectureRings, ...built.zero.lines.map((line) => [[line[0], line[1]], [line[2], line[3]]])];
  if (input.options.decor) allBounds.push(...decorBounds(input.rawSpace, true));
  for (const raster of input.rasters || []) allBounds.push(rotatedRectRing(
    raster.x, raster.y, raster.drawWidth, raster.drawHeight, raster.angle,
  ));
  let bounds = ringBox(allBounds);
  if (!validBox(bounds)) bounds = { minX: 0, minY: 0, maxX: NORM_W, maxY: NORM_W };
  const cmPerUnit = built.cellCm / GRID_PITCH;
  return { built, dimensionContours, roomAreas, bounds, cmPerUnit };
}

function buildPdfCandidate(
  input: PdfSceneInput, prepared: PreparedPdfScene, scale: number, landscape: boolean,
): PdfCandidate {
  const { built, dimensionContours, roomAreas, bounds, cmPerUnit } = prepared;
  const pageWidth = (landscape ? 297 : 210) * MM;
  const pageHeight = (landscape ? 210 : 297) * MM;
  const margin = 12 * MM, header = 18 * MM, footer = 24 * MM;
  const pointPerUnit = cmPerUnit * (10 * MM) / scale;
  const drawingWidth = (bounds.maxX - bounds.minX) * pointPerUnit;
  const drawingHeight = (bounds.maxY - bounds.minY) * pointPerUnit;
  const fieldTop = margin + header;
  const fieldHeight = pageHeight - fieldTop - margin - footer;
  const planFieldWidth = pageWidth - margin * 2;
  // Candidate content is laid out in local paper coordinates and translated
  // as one scene only after every real annotation/callout is known.
  const left = 0;
  const top = 0;
  const pt = (point: readonly number[]): [number, number] => [
    left + (point[0] - bounds.minX) * pointPerUnit,
    top + (point[1] - bounds.minY) * pointPerUnit,
  ];
  const planPoint = (x: number, y: number): [number, number] => [
    bounds.minX + (x - left) / pointPerUnit,
    bounds.minY + (y - top) / pointPerUnit,
  ];
  const planBox = (box: TextBox): PdfCollisionBox => {
    const minimum = planPoint(box.minX, box.minY), maximum = planPoint(box.maxX, box.maxY);
    return { minX: minimum[0], minY: minimum[1], maxX: maximum[0], maxY: maximum[1] };
  };
  const architectureRings = built.geometry.components.flatMap((component) =>
    geometryAllRings(component.geom));
  const pointInArchitecture = (point: PdfCollisionPoint): boolean =>
    built.geometry.components.some((component) => pointInPhysicalGeometry([...point], component.geom));
  const boxTouchesArchitecture = (box: TextBox): boolean => {
    const clearance = MM - 1e-6;
    return pdfBoxTouchesGeometry(planBox(pdfInflateBox(box, clearance)),
      architectureRings, pointInArchitecture);
  };
  const boxInsideRing = (box: TextBox, ring: readonly (readonly number[])[]): boolean =>
    pdfBoxInsideRing(planBox(box), ring, (point) => pointInSimpleRing([...point], ring));
  const segmentTouchesArchitecture = (
    start: readonly [number, number], end: readonly [number, number],
    options: { allowStartBoundary?: boolean; allowStartExit?: boolean } = {},
  ): boolean => pdfSegmentTouchesGeometry(
    planPoint(start[0], start[1]), planPoint(end[0], end[1]),
    architectureRings, pointInArchitecture, options,
  );
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

  let commands: PdfCommand[] = [];
  // Architectural export deliberately has no marker/device projection pass.
  const occupied: TextBox[] = [];
  const hatchLines = pageHatchLines(pageWidth, pageHeight);
  for (const raster of input.rasters || []) commands.push({
    kind: 'image', imageId: raster.id, ...pt([raster.x, raster.y]).reduce((o, value, index) =>
      ({ ...o, [index ? 'y' : 'x']: value }), {} as { x: number; y: number }),
    width: raster.drawWidth * pointPerUnit, height: raster.drawHeight * pointPerUnit,
    angle: raster.angle, opacity: raster.opacity,
  });
  for (const component of built.geometry.components) commands.push({
    kind: 'path', rings: geometryAllRings(component.geom).map((ring) => ring.map(pt)),
    fill: WALL, stroke: INK, width: 0.25 * MM,
    hatch: { lines: hatchLines, stroke: INK, width: 0.18 * MM },
  });
  if (built.geometry.status === 'failed-core') for (const room of input.space.rooms) {
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
    for (const [ringIndex, ring] of geometryOuterRings(built.geometry.roomGeom).entries()) {
      const epsilon = dimensionEpsilonUnits(cmPerUnit);
      type ExternalDimensionPlacement = {
        edge: DimensionEdge; a: [number, number]; b: [number, number];
        oa: [number, number]; ob: [number, number]; middle: [number, number];
        label: [number, number]; box: TextBox; needsShelf: boolean;
      };
      type ExternalDimensionSegment = {
        start: [number, number]; end: [number, number];
        allowStartBoundary?: boolean; allowStartExit?: boolean; mayEnterOwnLabel?: boolean;
      };
      const externalPlacement = (
        edge: DimensionEdge, outward: readonly [number, number], lane: number,
      ): ExternalDimensionPlacement => {
        // The dimension line is axis-projected, but its extensions must begin
        // on the real outer face. Starting them at projected near-axis points
        // can place an endpoint inside a thick wall and reject a safe label.
        const a = pt(edge.sourceA), b = pt(edge.sourceB);
        const projectedA = pt(edge.a), projectedB = pt(edge.b);
        const lineOffset = (6 + lane) * MM;
        const oa: [number, number] = [projectedA[0] + outward[0] * lineOffset,
          projectedA[1] + outward[1] * lineOffset];
        const ob: [number, number] = [projectedB[0] + outward[0] * lineOffset,
          projectedB[1] + outward[1] * lineOffset];
        const middle: [number, number] = [(oa[0] + ob[0]) / 2, (oa[1] + ob[1]) / 2];
        const needsShelf = measurePdfText(edge.text, 7) + 2 * MM
          > Math.hypot(ob[0] - oa[0], ob[1] - oa[1]);
        const provisional = textBox(middle[0], middle[1], edge.text, 7, edge.angle, 'center');
        const labelOffset = textNormalOffset(provisional, middle[0], middle[1], outward, MM);
        const label: [number, number] = [middle[0] + outward[0] * labelOffset,
          middle[1] + outward[1] * labelOffset];
        return { edge, a, b, oa, ob, middle, label,
          box: textBox(label[0], label[1], edge.text, 7, edge.angle, 'center'), needsShelf };
      };
      const externalSegments = (entry: ExternalDimensionPlacement): ExternalDimensionSegment[] => {
        const segments: ExternalDimensionSegment[] = [
          { start: entry.oa, end: entry.ob },
          { start: entry.a, end: entry.oa, allowStartExit: true },
          { start: entry.b, end: entry.ob, allowStartExit: true },
        ];
        if (entry.needsShelf) segments.push({
          start: entry.middle, end: entry.label, mayEnterOwnLabel: true,
        });
        return segments;
      };
      const externalPlacementTouchesArchitecture = (entry: ExternalDimensionPlacement): boolean =>
        boxTouchesArchitecture(entry.box) || externalSegments(entry).some((segment) =>
          segmentTouchesArchitecture(segment.start, segment.end, {
            allowStartBoundary: segment.allowStartBoundary,
            allowStartExit: segment.allowStartExit,
          }));
      const edges = dedupeOppositeDimensionEdges(
        dimensionEdges(ring, cmPerUnit, input.imperial, { ringIndex, epsilon }),
        {
          ring,
          epsilon,
          score: (edge) => {
            const outward: readonly [number, number] = [
              -edge.inwardNormal[0], -edge.inwardNormal[1],
            ];
            const base = pt(edge.mid);
            const firstSafeLane = Array.from({ length: 21 }, (_, index) => index * 4)
              .find((lane) => !externalPlacementTouchesArchitecture(
                externalPlacement(edge, outward, lane),
              ));
            const centeredX = base[0] + (planFieldWidth - drawingWidth) / 2;
            const centeredY = base[1] + (fieldHeight - drawingHeight) / 2;
            const normalClearance = Math.abs(outward[0]) > 0.5
              ? (outward[0] > 0 ? planFieldWidth - centeredX : centeredX)
              : (outward[1] > 0 ? fieldHeight - centeredY : centeredY);
            return {
              hardCollisions: firstSafeLane === undefined ? 21 : firstSafeLane / 4,
              normalClearance,
            };
          },
        },
      );
      for (const edgeGroup of groupCollinearDimensionEdges(edges, epsilon)) {
        const group = edgeGroup.map((edge) => ({
          edge,
          outward: [-edge.inwardNormal[0], -edge.inwardNormal[1]] as const,
        }));
        const layoutGroup = (lane: number): ExternalDimensionPlacement[] => group.map(
          ({ edge, outward }) => externalPlacement(edge, outward, lane));
        let accepted: ExternalDimensionPlacement[] | null = null;
        for (let lane = 0; lane <= 80 && !accepted; lane += 4) {
          const proposed = layoutGroup(lane);
          const selfCollision = proposed.some((entry, index) =>
            proposed.slice(0, index).some((other) => intersects(entry.box, other.box)));
          const priorCollision = proposed.some((entry) => externalPlacementTouchesArchitecture(entry)
            || occupied.some((other) => intersects(entry.box, other)));
          const segmentCollision = proposed.some((entry, ownIndex) => {
            return externalSegments(entry).some((segment) =>
              occupied.some((box) => pdfSegmentTouchesBox(segment.start, segment.end, box))
              || proposed.some((other, index) =>
                (!segment.mayEnterOwnLabel || index !== ownIndex)
                && pdfSegmentTouchesBox(segment.start, segment.end, other.box)));
          });
          if (!selfCollision && !priorCollision && !segmentCollision) accepted = proposed;
        }
        // A knowingly colliding lane is worse than omitting an unsafe annotation.
        if (!accepted) continue;
        for (const entry of accepted) {
          commands.push({ kind: 'line', points: [entry.oa, entry.ob], stroke: INK, width: 0.2 * MM },
            { kind: 'line', points: [entry.a, entry.oa], stroke: INK, width: 0.15 * MM },
            { kind: 'line', points: [entry.b, entry.ob], stroke: INK, width: 0.15 * MM });
          if (entry.needsShelf) commands.push({
            kind: 'line', points: [entry.middle, entry.label], stroke: INK, width: 0.15 * MM,
          });
          commands.push({ kind: 'text', x: entry.label[0], y: entry.label[1], text: entry.edge.text,
            size: 7, angle: entry.edge.angle, align: 'center' });
          occupied.push(entry.box);
        }
      }
    }
  }

  const callouts: Array<{ mark: string; room: string; value: string }> = [];
  const rooms = [...input.space.rooms].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  for (const [roomIndex, room] of rooms.entries()) {
    const original = roomPoly(room);
    if (!original) continue;
    const contour = dimensionContours.get(room) || original;
    const areaUnits = roomAreas.get(room) || 0;
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
      const epsilon = dimensionEpsilonUnits(cmPerUnit);
      const rawEdges = stableDimensionEdges(contour, cmPerUnit, input.imperial,
        { ringIndex: roomIndex, epsilon });
      const placementScore = (edge: DimensionEdge) => {
        const base = pt(edge.mid);
        const provisional = textBox(base[0], base[1], edge.text, 7, edge.angle, 'center');
        const offset = textNormalOffset(
          provisional, base[0], base[1], edge.inwardNormal, MM,
        );
        const x = base[0] + edge.inwardNormal[0] * offset;
        const y = base[1] + edge.inwardNormal[1] * offset;
        const box = textBox(x, y, edge.text, 7, edge.angle, 'center');
        const clearance = edge.axis === 'horizontal'
          ? (edge.inwardNormal[1] > 0 ? contourBounds.maxY - base[1] : base[1] - contourBounds.minY)
          : (edge.inwardNormal[0] > 0 ? contourBounds.maxX - base[0] : base[0] - contourBounds.minX);
        return {
          hardCollisions: Number(boxTouchesArchitecture(box))
            + occupied.reduce((count, other) => count + Number(intersects(box, other)), 0),
          normalClearance: clearance,
        };
      };
      const edges = dedupeOppositeDimensionEdges(rawEdges,
        { ring: contour, epsilon, score: placementScore });
      const nonRect = compactRing(contour, epsilon).length !== 4;
      for (const edge of edges.filter((candidate) => candidate.short)) {
        const inward = edge.inwardNormal;
        const a = pt(edge.a), b = pt(edge.b);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        commands.push({ kind: 'line', points: [[mx - inward[0] * 1.5 * MM, my - inward[1] * 1.5 * MM],
          [mx + inward[0] * 1.5 * MM, my + inward[1] * 1.5 * MM]], stroke: INK, width: 0.2 * MM });
      }
      const groups = new Map<string, DimensionEdge[]>();
      for (const edge of edges.filter((candidate) => !candidate.short)) {
        const key = normalKey(edge, edge.inwardNormal);
        const group = groups.get(key) || [];
        group.push(edge);
        groups.set(key, group);
      }
      for (const group of groups.values()) {
        let placed: Array<{ edge: DimensionEdge; x: number; y: number; box: TextBox }> | null = null;
        for (let lane = 0; lane <= 30 && !placed; lane += 3) {
          const proposed = group.map((edge) => {
            const base = pt(edge.mid);
            const provisional = textBox(base[0], base[1], edge.text, 7, edge.angle, 'center');
            const offset = textNormalOffset(
              provisional, base[0], base[1], edge.inwardNormal, (1 + lane) * MM,
            );
            const x = base[0] + edge.inwardNormal[0] * offset;
            const y = base[1] + edge.inwardNormal[1] * offset;
            return { edge, x, y, box: textBox(x, y, edge.text, 7, edge.angle, 'center') };
          });
          const selfCollision = proposed.some((entry, index) =>
            proposed.slice(0, index).some((other) => intersects(entry.box, other.box)));
          const priorCollision = proposed.some((entry) => boxTouchesArchitecture(entry.box)
            || occupied.some((other) => intersects(entry.box, other)));
          const insideRoom = proposed.every((entry) => boxInsideRing(entry.box, contour));
          if (!selfCollision && !priorCollision && insideRoom) placed = proposed;
        }
        if (placed) {
          for (const entry of placed) {
            commands.push({ kind: 'text', x: entry.x, y: entry.y, text: entry.edge.text,
              size: 7, angle: entry.edge.angle, align: 'center' });
            occupied.push(entry.box);
          }
          continue;
        }
        for (const edge of group) {
          const base = pt(edge.mid), inward = edge.inwardNormal;
          if (nonRect) {
            const mark = `R${callouts.length + 1}`;
            const markerX = base[0] + inward[0] * 4 * MM;
            const markerY = base[1] + inward[1] * 4 * MM;
            commands.push({ kind: 'line', points: [base, [markerX, markerY]], stroke: INK, width: 0.15 * MM },
              { kind: 'text', x: markerX, y: markerY, text: mark, size: 6, align: 'center' });
            callouts.push({ mark, room: room.name || room.id || '', value: edge.text });
          }
          // Rectangular rooms have no unambiguous numbered callout fallback.
          // If every internal lane is blocked, omit the unsafe label rather
          // than knowingly printing it through a wall, room title or area.
        }
      }
    }
  }

  if (callouts.length) {
    const content = pdfCommandBounds(commands);
    const x = (Number.isFinite(content.maxX) ? content.maxX : drawingWidth) + 8 * MM;
    let y = (Number.isFinite(content.minY) ? content.minY : 0) + 5 * MM;
    commands.push({ kind: 'text', x, y, text: input.t('pdf.internal_dimensions'), size: 8 });
    y += 5 * MM;
    for (const callout of callouts) {
      commands.push({ kind: 'text', x, y,
        text: `${callout.mark} ${callout.room}: ${callout.value}`, size: 6 });
      y += 4 * MM;
    }
  }

  const field: PdfField = {
    minX: margin, minY: fieldTop,
    maxX: pageWidth - margin, maxY: fieldTop + fieldHeight,
  };
  const localSceneBounds = pdfCommandBounds(commands);
  const localField: PdfField = { minX: 0, minY: 0, maxX: planFieldWidth, maxY: fieldHeight };
  const fits = pdfSceneFits(localSceneBounds, localField, 0.5 * MM);
  const centered = centerPdfScene(commands, field);
  commands = centered.commands;

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
    const nx = pageWidth / 2, ny = footerY + 5.5 * MM;
    commands.push({ kind: 'vector',
      ops: pdfCompassOps({ centerX: nx, centerY: ny, size: 11 * MM, northDeg: north }),
      fill: INK, width: 0, fillRule: 'evenodd' });
    commands.push(
      { kind: 'text', x: nx, y: footerY, text: input.t('pdf.north'), size: 7, align: 'center' });
  }
  commands.push({ kind: 'text', x: pageWidth - margin, y: footerY + 12,
    text: `${pdfLocalDate(input.now)} · House Plan v${input.version}`,
    size: 7, align: 'right' });
  const page: BuiltPdfPage = { width: pageWidth, height: pageHeight, commands,
    images: (input.rasters || []).map(({ id, bytes, width, height }) => ({ id, bytes, width, height })),
    now: input.now, scale, sceneBounds: centered.bounds, planField: field };
  const sceneArea = Math.max(0, pdfBoundsWidth(localSceneBounds))
    * Math.max(0, pdfBoundsHeight(localSceneBounds));
  const fieldArea = planFieldWidth * fieldHeight;
  return { page, sceneBounds: centered.bounds, field, fits,
    fillRatio: fieldArea > 0 ? sceneArea / fieldArea : 0, landscape };
}

function betterPdfCandidate(a: PdfCandidate, b: PdfCandidate): PdfCandidate {
  if (a.fillRatio !== b.fillRatio) return a.fillRatio > b.fillRatio ? a : b;
  return a.landscape ? b : a;
}

function rawArchitectureCanFit(
  prepared: PreparedPdfScene, scale: number, landscape: boolean,
): boolean {
  const pageWidth = (landscape ? 297 : 210) * MM;
  const pageHeight = (landscape ? 210 : 297) * MM;
  const margin = 12 * MM, header = 18 * MM, footer = 24 * MM;
  const fieldWidth = pageWidth - margin * 2;
  const fieldHeight = pageHeight - margin * 2 - header - footer;
  const pointPerUnit = prepared.cmPerUnit * (10 * MM) / scale;
  return (prepared.bounds.maxX - prepared.bounds.minX) * pointPerUnit <= fieldWidth + 0.5 * MM
    && (prepared.bounds.maxY - prepared.bounds.minY) * pointPerUnit <= fieldHeight + 0.5 * MM;
}

/** Build both A4 orientations from actual annotations and keep the largest standard scale. */
export function buildPdfPage(input: PdfSceneInput): BuiltPdfPage {
  const prepared = preparePdfScene(input);
  let lastCandidates: PdfCandidate[] = [];
  for (const scale of PDF_SCALE_SERIES) {
    const candidates = [false, true]
      .filter((landscape) => rawArchitectureCanFit(prepared, scale, landscape))
      .map((landscape) => buildPdfCandidate(input, prepared, scale, landscape));
    if (!candidates.length) continue;
    const fitting = candidates.filter((candidate) => candidate.fits);
    if (fitting.length) return fitting.reduce(betterPdfCandidate).page;
    lastCandidates = candidates;
  }

  // Preserve the unbounded-space fallback from #53. A first real 1:500 scene
  // supplies a useful starting estimate, but fixed-size labels/callouts do not
  // shrink with the architecture. Bracket a fitting denominator
  // exponentially, then refine it to a 50-step denominator. Never return a
  // knowingly clipped page when fixed annotations cannot fit at any useful
  // scale.
  if (!lastCandidates.length) lastCandidates = [false, true].map((landscape) =>
    buildPdfCandidate(input, prepared, 500, landscape));
  const defensiveFit = lastCandidates.filter((candidate) => candidate.fits);
  if (defensiveFit.length) return defensiveFit.reduce(betterPdfCandidate).page;
  const overflow = (candidate: PdfCandidate): number => Math.max(
    pdfBoundsWidth(candidate.sceneBounds) / pdfBoundsWidth(candidate.field),
    pdfBoundsHeight(candidate.sceneBounds) / pdfBoundsHeight(candidate.field),
  );
  const ratio = Math.min(...lastCandidates.map(overflow));
  const step = 50;
  const maxFallbackScale = 1_000_000;
  const estimate = Number.isFinite(ratio)
    ? Math.ceil(Math.min(maxFallbackScale, 500 * Math.max(1, ratio)) / step) * step
    : maxFallbackScale;
  let failingScale = 500;
  let fittingScale = 0;
  let fittingCandidates: PdfCandidate[] = [];
  let probeScale = Math.max(550, estimate);
  while (probeScale <= maxFallbackScale) {
    const candidates = [false, true].map((landscape) =>
      buildPdfCandidate(input, prepared, probeScale, landscape));
    const fitting = candidates.filter((candidate) => candidate.fits);
    if (fitting.length) {
      fittingScale = probeScale;
      fittingCandidates = fitting;
      break;
    }
    failingScale = probeScale;
    if (probeScale === maxFallbackScale) break;
    probeScale = Math.min(maxFallbackScale,
      Math.ceil((probeScale * 2) / step) * step);
  }
  if (!fittingScale) throw new Error('pdf.failed');

  // Refine the failed/fitting bracket to a representable 50-step denominator
  // instead of accepting the deliberately coarse exponential probe.
  let lowStep = Math.floor(failingScale / step);
  let highStep = Math.floor(fittingScale / step);
  while (highStep - lowStep > 1) {
    const middleStep = Math.floor((lowStep + highStep) / 2);
    const candidates = [false, true].map((landscape) =>
      buildPdfCandidate(input, prepared, middleStep * step, landscape));
    const fitting = candidates.filter((candidate) => candidate.fits);
    if (fitting.length) {
      highStep = middleStep;
      fittingCandidates = fitting;
    } else lowStep = middleStep;
  }
  const page = fittingCandidates.reduce(betterPdfCandidate).page;
  if (!pdfSceneFits(page.sceneBounds, page.planField, 0.5 * MM)) throw new Error('pdf.failed');
  return page;
}
