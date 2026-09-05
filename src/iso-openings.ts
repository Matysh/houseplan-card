import {
  ISO_CAMERA, ISO_WALL_HEIGHT, projectPlanPoint,
  type IsoCamera, type PlanPoint, type ScenePoint,
} from './iso-projection';
import { openingSymbolOffset } from './opening-symbol-placement';

export type IsoOpeningType = 'door' | 'window' | 'gate' | 'passage';

export interface IsoOpeningFace {
  ox: number;
  oy: number;
  /** Physical thickness metadata from the resolved host, in centimetres. */
  cm?: number;
  side: -1 | 1;
}

export interface IsoOpeningInput {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  x: number;
  y: number;
  angle: number;
  length: number;
  flipH: boolean;
  flipV: boolean;
  face: IsoOpeningFace;
}

export interface IsoOpeningLeafBasis {
  leaf: number;
  hinge: PlanPoint;
  closedVector: PlanPoint;
  quarterVector: PlanPoint;
  turnDeg: number;
  bottom: number;
  top: number;
}

export interface IsoOpeningAxisBasis {
  center: PlanPoint;
  tangent: PlanPoint;
  normal: PlanPoint;
  start: PlanPoint;
  end: PlanPoint;
}

export interface IsoOpeningFaceBasis {
  side: -1 | 1;
  cm: number;
  /** Full physical wall depth in plan-render units. */
  depth: number;
  /** Centreline-to-selected-face vector returned by the canonical host resolver. */
  offset: PlanPoint;
  selectedStart: PlanPoint;
  selectedEnd: PlanPoint;
  oppositeStart: PlanPoint;
  oppositeEnd: PlanPoint;
}

export interface IsoOpeningRevealBasis {
  jamb: 0 | 1;
  center: PlanPoint;
  selected: PlanPoint;
  opposite: PlanPoint;
}

/**
 * Versioned authority for every fixed Stage 3 opening dimension. It is part of
 * the structural fingerprint, so a policy change cannot reuse stale cached
 * opening volumes from an older algorithm.
 */
export interface IsoOpeningGeometryPolicy {
  revision: number;
  leafThicknessRatio: number;
  frameThicknessRatio: number;
  gateTurnDeg: number;
  gateTopRatio: number;
  windowBottomRatio: number;
  windowTopRatio: number;
  doorTopRatio: number;
}

export const ISO_OPENING_GEOMETRY_POLICY: Readonly<IsoOpeningGeometryPolicy> = Object.freeze({
  revision: 1,
  leafThicknessRatio: 0.04,
  frameThicknessRatio: 0.055,
  gateTurnDeg: 10,
  gateTopRatio: 0.88,
  windowBottomRatio: 0.27,
  windowTopRatio: 0.78,
  doorTopRatio: 0.92,
});

export const ISO_OPENING_LEAF_THICKNESS_RATIO =
  ISO_OPENING_GEOMETRY_POLICY.leafThicknessRatio;
export const ISO_OPENING_FRAME_THICKNESS_RATIO =
  ISO_OPENING_GEOMETRY_POLICY.frameThicknessRatio;

/** Immutable jamb/axis topology stored in the structural Iso LRU. */
export interface IsoOpeningBasis {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  wallHeight: number;
  leafThickness: number;
  frameThickness: number;
  axis: IsoOpeningAxisBasis;
  face: IsoOpeningFaceBasis;
  reveals: readonly IsoOpeningRevealBasis[];
  leaves: readonly IsoOpeningLeafBasis[];
}

export type IsoOpeningSurfaceKind =
  | 'jamb-reveal'
  | 'leaf-front'
  | 'leaf-back'
  | 'leaf-edge'
  | 'leaf-top'
  | 'window-insert'
  | 'window-frame-side'
  | 'window-frame-top'
  | 'window-sill';

export type IsoOpeningMaterial =
  | 'reveal'
  | 'matte-leaf'
  | 'light-window'
  | 'light-frame'
  | 'light-sill';

export interface IsoOpeningSurface {
  kind: IsoOpeningSurfaceKind;
  material: IsoOpeningMaterial;
  d: string;
  depth: number;
  jamb?: 0 | 1;
  edge?: 'hinge' | 'tip';
}

export interface IsoOpeningPanel {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  leaf: number;
  d: string;
  shadowD: string;
  depth: number;
  material: 'matte-leaf' | 'light-window';
  thickness: number;
  /** Stage 3 prism/frame faces. The legacy d remains the centre face for compatibility. */
  surfaces: readonly IsoOpeningSurface[];
}

export interface IsoOpeningBounds { x: number; y: number; w: number; h: number; }

const finite = (values: readonly number[]): boolean => values.every(Number.isFinite);

function frozenPoint(x: number, y: number): PlanPoint {
  return Object.freeze([
    Object.is(x, -0) ? 0 : x,
    Object.is(y, -0) ? 0 : y,
  ]) as PlanPoint;
}

function add(a: PlanPoint, b: PlanPoint): PlanPoint {
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract(a: PlanPoint, b: PlanPoint): PlanPoint {
  return [a[0] - b[0], a[1] - b[1]];
}

function scaled(a: PlanPoint, factor: number): PlanPoint {
  return [a[0] * factor, a[1] * factor];
}

function transformVector(
  point: PlanPoint, angleDeg: number, sx: number, sy: number,
): PlanPoint {
  const x = point[0] * sx, y = point[1] * sy;
  const angle = angleDeg * Math.PI / 180;
  return [x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle)];
}

function leafBasis(
  input: IsoOpeningInput,
  leaf: number,
  localHinge: PlanPoint,
  localVector: PlanPoint,
  turnDeg: number,
  bottom: number,
  top: number,
): IsoOpeningLeafBasis {
  const sx = input.flipH ? -1 : 1;
  // Gate flip_v is represented by its resolved face.side/turnDeg. Mirroring
  // the structural basis as well would cancel that direction on shared and
  // partition hosts, just like a nested scaleY in the flat renderer.
  const sy = input.type === 'gate' ? 1 : input.flipV ? -1 : 1;
  const offset = openingSymbolOffset(input.type, input.flipV, input.angle, input.face);
  const origin: PlanPoint = [input.x + offset.ox, input.y + offset.oy];
  const hinge = add(origin, transformVector(localHinge, input.angle, sx, sy));
  const closedVector = transformVector(localVector, input.angle, sx, sy);
  const quarterVector = transformVector(
    [-localVector[1], localVector[0]], input.angle, sx, sy,
  );
  return { leaf, hinge, closedVector, quarterVector, turnDeg, bottom, top };
}

/**
 * Build only stable opening topology. The transform is algebraically the same
 * as the floor symbol's translate/rotate/flip nesting, including the gate's
 * 0..10 degree exterior-face convention.
 */
export function buildIsoOpeningBasis(
  input: IsoOpeningInput,
  wallHeight = ISO_WALL_HEIGHT,
  policy: Readonly<IsoOpeningGeometryPolicy> = ISO_OPENING_GEOMETRY_POLICY,
): IsoOpeningBasis {
  const faceCm = input.face.cm ?? 0;
  if (!finite([
    input.x, input.y, input.angle, input.length,
    input.face.ox, input.face.oy, faceCm, wallHeight,
  ]) || !(input.length > 0) || !(wallHeight > 0)
      || (input.face.side !== -1 && input.face.side !== 1) || faceCm < 0) {
    throw new Error('invalid isometric opening input');
  }
  const half = input.length / 2;
  const angle = input.angle * Math.PI / 180;
  const tangent = frozenPoint(Math.cos(angle), Math.sin(angle));
  const normal = frozenPoint(-Math.sin(angle), Math.cos(angle));
  const center = frozenPoint(input.x, input.y);
  const start = frozenPoint(input.x - tangent[0] * half, input.y - tangent[1] * half);
  const end = frozenPoint(input.x + tangent[0] * half, input.y + tangent[1] * half);
  const offset = frozenPoint(input.face.ox, input.face.oy);
  const selectedStart = frozenPoint(start[0] + offset[0], start[1] + offset[1]);
  const selectedEnd = frozenPoint(end[0] + offset[0], end[1] + offset[1]);
  const oppositeStart = frozenPoint(start[0] - offset[0], start[1] - offset[1]);
  const oppositeEnd = frozenPoint(end[0] - offset[0], end[1] - offset[1]);
  const axis = Object.freeze({ center, tangent, normal, start, end });
  const face = Object.freeze({
    side: input.face.side,
    cm: faceCm,
    depth: Math.hypot(input.face.ox, input.face.oy) * 2,
    offset,
    selectedStart,
    selectedEnd,
    oppositeStart,
    oppositeEnd,
  });
  const reveals = input.type === 'passage' ? [] : [
    Object.freeze({
      jamb: 0 as const,
      center: start,
      selected: selectedStart,
      opposite: oppositeStart,
    }),
    Object.freeze({
      jamb: 1 as const,
      center: end,
      selected: selectedEnd,
      opposite: oppositeEnd,
    }),
  ];
  let leaves: IsoOpeningLeafBasis[];
  if (input.type === 'passage') {
    leaves = [];
  } else if (input.type === 'gate') {
    const turn = input.face.side * policy.gateTurnDeg;
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], turn, 0,
        wallHeight * policy.gateTopRatio),
      leafBasis(input, 1, [half, 0], [-half, 0], -turn, 0,
        wallHeight * policy.gateTopRatio),
    ];
  } else if (input.type === 'window') {
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], -90,
        wallHeight * policy.windowBottomRatio, wallHeight * policy.windowTopRatio),
      leafBasis(input, 1, [half, 0], [-half, 0], 90,
        wallHeight * policy.windowBottomRatio, wallHeight * policy.windowTopRatio),
    ];
  } else {
    leaves = [leafBasis(input, 0, [-half, 0], [input.length, 0], -90, 0,
      wallHeight * policy.doorTopRatio)];
  }
  return Object.freeze({
    id: input.id,
    sourceIndex: input.sourceIndex,
    type: input.type,
    wallHeight,
    leafThickness: wallHeight * policy.leafThicknessRatio,
    frameThickness: wallHeight * policy.frameThicknessRatio,
    axis,
    face,
    reveals: Object.freeze(reveals),
    leaves: Object.freeze(leaves.map((leaf) => Object.freeze({
      ...leaf,
      hinge: frozenPoint(leaf.hinge[0], leaf.hinge[1]),
      closedVector: frozenPoint(leaf.closedVector[0], leaf.closedVector[1]),
      quarterVector: frozenPoint(leaf.quarterVector[0], leaf.quarterVector[1]),
    }))),
  });
}

const pointText = (point: ScenePoint): string =>
  `${Number(point[0].toFixed(4))} ${Number(point[1].toFixed(4))}`;

interface IsoSpatialPoint {
  point: PlanPoint;
  z: number;
}

function projectedSurface(
  kind: IsoOpeningSurfaceKind,
  material: IsoOpeningMaterial,
  points: readonly IsoSpatialPoint[],
  camera: IsoCamera,
  metadata: Pick<IsoOpeningSurface, 'jamb' | 'edge'> = {},
): IsoOpeningSurface {
  const projected = points.map((value) => projectPlanPoint(value.point, value.z, camera));
  return Object.freeze({
    kind,
    material,
    d: `M ${projected.map(pointText).join(' L ')} Z`,
    depth: Math.max(...projected.map((point) => point[1])),
    ...metadata,
  });
}

function verticalSurface(
  kind: IsoOpeningSurfaceKind,
  material: IsoOpeningMaterial,
  a: PlanPoint,
  b: PlanPoint,
  bottom: number,
  top: number,
  camera: IsoCamera,
  metadata: Pick<IsoOpeningSurface, 'jamb' | 'edge'> = {},
): IsoOpeningSurface {
  return projectedSurface(kind, material, [
    { point: a, z: bottom },
    { point: b, z: bottom },
    { point: b, z: top },
    { point: a, z: top },
  ], camera, metadata);
}

function liveTip(leaf: IsoOpeningLeafBasis, amount: number): PlanPoint {
  const angle = leaf.turnDeg * amount * Math.PI / 180;
  return [
    leaf.hinge[0] + leaf.closedVector[0] * Math.cos(angle)
      + leaf.quarterVector[0] * Math.sin(angle),
    leaf.hinge[1] + leaf.closedVector[1] * Math.cos(angle)
      + leaf.quarterVector[1] * Math.sin(angle),
  ];
}

function leafPrismSurfaces(
  leaf: IsoOpeningLeafBasis,
  tip: PlanPoint,
  thickness: number,
  camera: IsoCamera,
): readonly IsoOpeningSurface[] {
  const vector = subtract(tip, leaf.hinge);
  const length = Math.hypot(vector[0], vector[1]);
  if (!(length > 1e-9) || !(thickness > 0)) return Object.freeze([]);
  const halfNormal = frozenPoint(
    -vector[1] * thickness / (2 * length),
    vector[0] * thickness / (2 * length),
  );
  const frontHinge = add(leaf.hinge, halfNormal);
  const frontTip = add(tip, halfNormal);
  const backHinge = subtract(leaf.hinge, halfNormal);
  const backTip = subtract(tip, halfNormal);
  const surfaces = [
    verticalSurface(
      'leaf-back', 'matte-leaf', backTip, backHinge,
      leaf.bottom, leaf.top, camera,
    ),
    verticalSurface(
      'leaf-front', 'matte-leaf', frontHinge, frontTip,
      leaf.bottom, leaf.top, camera,
    ),
    verticalSurface(
      'leaf-edge', 'matte-leaf', backHinge, frontHinge,
      leaf.bottom, leaf.top, camera, { edge: 'hinge' },
    ),
    verticalSurface(
      'leaf-edge', 'matte-leaf', frontTip, backTip,
      leaf.bottom, leaf.top, camera, { edge: 'tip' },
    ),
    projectedSurface('leaf-top', 'matte-leaf', [
      { point: frontHinge, z: leaf.top },
      { point: backHinge, z: leaf.top },
      { point: backTip, z: leaf.top },
      { point: frontTip, z: leaf.top },
    ], camera),
  ];
  return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
    || a.kind.localeCompare(b.kind) || String(a.edge || '').localeCompare(String(b.edge || ''))));
}

/**
 * Project state-independent Stage 3 jamb/reveal and window frame/sill surfaces.
 * Passage deliberately has no decorative volume. This function consumes only
 * the immutable structural basis and is safe to cache with that basis.
 */
export function projectIsoOpeningStructure(
  basis: IsoOpeningBasis,
  camera: IsoCamera = ISO_CAMERA,
): readonly IsoOpeningSurface[] {
  if (basis.type === 'passage') return Object.freeze([]);
  const surfaces: IsoOpeningSurface[] = [];
  if (basis.face.depth > 1e-9) {
    for (const reveal of basis.reveals) {
      surfaces.push(verticalSurface(
        'jamb-reveal', 'reveal', reveal.selected, reveal.opposite,
        0, basis.wallHeight, camera, { jamb: reveal.jamb },
      ));
    }
  }
  if (basis.type !== 'window' || !basis.leaves.length) {
    return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
      || a.kind.localeCompare(b.kind) || (a.jamb ?? 0) - (b.jamb ?? 0)));
  }

  const bottom = Math.min(...basis.leaves.map((leaf) => leaf.bottom));
  const top = Math.max(...basis.leaves.map((leaf) => leaf.top));
  const member = Math.min(basis.frameThickness, Math.hypot(
    basis.axis.end[0] - basis.axis.start[0],
    basis.axis.end[1] - basis.axis.start[1],
  ) / 4, (top - bottom) / 4);
  const innerStart = add(basis.axis.start, scaled(basis.axis.tangent, member));
  const innerEnd = subtract(basis.axis.end, scaled(basis.axis.tangent, member));
  const offsets: readonly PlanPoint[] = basis.face.depth > 1e-9
    ? [basis.face.offset, frozenPoint(-basis.face.offset[0], -basis.face.offset[1])]
    : [basis.face.offset];
  for (const offset of offsets) {
    const outerStart = add(basis.axis.start, offset);
    const outerEnd = add(basis.axis.end, offset);
    const innerFaceStart = add(innerStart, offset);
    const innerFaceEnd = add(innerEnd, offset);
    surfaces.push(
      verticalSurface(
        'window-frame-side', 'light-frame', outerStart, innerFaceStart,
        bottom, top, camera, { jamb: 0 },
      ),
      verticalSurface(
        'window-frame-side', 'light-frame', innerFaceEnd, outerEnd,
        bottom, top, camera, { jamb: 1 },
      ),
      verticalSurface(
        'window-frame-top', 'light-frame', innerFaceStart, innerFaceEnd,
        Math.max(bottom, top - member), top, camera,
      ),
    );
  }
  if (basis.face.depth > 1e-9) {
    surfaces.push(projectedSurface('window-sill', 'light-sill', [
      { point: basis.face.selectedStart, z: bottom },
      { point: basis.face.selectedEnd, z: bottom },
      { point: basis.face.oppositeEnd, z: bottom },
      { point: basis.face.oppositeStart, z: bottom },
    ], camera));
  }
  return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
    || a.kind.localeCompare(b.kind) || (a.jamb ?? 0) - (b.jamb ?? 0)));
}

/** Apply live state after the structural cache: O(leaves), no topology work. */
export function projectIsoOpening(
  basis: IsoOpeningBasis,
  amount: number,
  camera: IsoCamera = ISO_CAMERA,
): IsoOpeningPanel[] {
  const liveAmount = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
  return basis.leaves.map((leaf) => {
    const tip = liveTip(leaf, liveAmount);
    const floorHinge = projectPlanPoint(leaf.hinge, leaf.bottom, camera);
    const floorTip = projectPlanPoint(tip, leaf.bottom, camera);
    const topTip = projectPlanPoint(tip, leaf.top, camera);
    const topHinge = projectPlanPoint(leaf.hinge, leaf.top, camera);
    const material = basis.type === 'window' ? 'light-window' : 'matte-leaf';
    const surfaces = basis.type === 'window'
      ? Object.freeze([verticalSurface(
          'window-insert', 'light-window', leaf.hinge, tip,
          leaf.bottom, leaf.top, camera,
        )])
      : leafPrismSurfaces(leaf, tip, basis.leafThickness, camera);
    return Object.freeze({
      id: basis.id,
      sourceIndex: basis.sourceIndex,
      type: basis.type,
      leaf: leaf.leaf,
      d: `M ${pointText(floorHinge)} L ${pointText(floorTip)} L ${pointText(topTip)} L ${pointText(topHinge)} Z`,
      shadowD: `M ${pointText(projectPlanPoint(leaf.hinge, 0, camera))} L ${pointText(projectPlanPoint(tip, 0, camera))}`,
      depth: Math.max(floorHinge[1], floorTip[1]),
      material,
      thickness: basis.type === 'window' ? 0 : basis.leafThickness,
      surfaces,
    });
  });
}

/** State-independent plan envelope for fit/home; blur is intentionally absent. */
export function isoOpeningBounds(
  bases: readonly IsoOpeningBasis[],
): IsoOpeningBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = (point: PlanPoint, radius = 0): void => {
    minX = Math.min(minX, point[0] - radius);
    minY = Math.min(minY, point[1] - radius);
    maxX = Math.max(maxX, point[0] + radius);
    maxY = Math.max(maxY, point[1] + radius);
  };
  for (const basis of bases) {
    if (basis.type === 'passage') continue;
    include(basis.axis.start);
    include(basis.axis.end);
    include(basis.face.selectedStart);
    include(basis.face.selectedEnd);
    include(basis.face.oppositeStart);
    include(basis.face.oppositeEnd);
    for (const leaf of basis.leaves) {
      const radius = Math.hypot(leaf.closedVector[0], leaf.closedVector[1])
        + basis.leafThickness / 2;
      include(leaf.hinge, radius);
    }
  }
  return finite([minX, minY, maxX, maxY])
    ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    : null;
}

export interface IsoDecorationInput {
  showBorders: boolean;
  hideOpenings: boolean;
  filtersSupported: boolean;
  forcedColors: boolean;
}

export interface IsoDecorationLayers {
  structural: boolean;
  panels: boolean;
  shadows: boolean;
  materialNuance: boolean;
  floorSymbols: boolean;
}

/** Display/capability policy is pure so decoration can never trigger Flat fallback. */
export function resolveIsoDecoration(input: IsoDecorationInput): IsoDecorationLayers {
  const structural = !!input.showBorders;
  return {
    structural,
    panels: structural && !input.hideOpenings,
    shadows: structural && input.filtersSupported && !input.forcedColors,
    materialNuance: structural && input.filtersSupported && !input.forcedColors,
    floorSymbols: !input.hideOpenings && !structural,
  };
}
