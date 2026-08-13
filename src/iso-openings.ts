import {
  ISO_CAMERA, ISO_WALL_HEIGHT, projectPlanPoint,
  type IsoCamera, type PlanPoint, type ScenePoint,
} from './iso-projection';

export type IsoOpeningType = 'door' | 'window' | 'gate';

export interface IsoOpeningFace {
  ox: number;
  oy: number;
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

/** Immutable jamb/axis topology stored in the structural Iso LRU. */
export interface IsoOpeningBasis {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  leaves: readonly IsoOpeningLeafBasis[];
}

export interface IsoOpeningPanel {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  leaf: number;
  d: string;
  shadowD: string;
  depth: number;
}

export interface IsoOpeningBounds { x: number; y: number; w: number; h: number; }

const finite = (values: readonly number[]): boolean => values.every(Number.isFinite);

function add(a: PlanPoint, b: PlanPoint): PlanPoint {
  return [a[0] + b[0], a[1] + b[1]];
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
  const sy = input.flipV ? -1 : 1;
  const origin: PlanPoint = [input.x + input.face.ox, input.y + input.face.oy];
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
): IsoOpeningBasis {
  if (!finite([
    input.x, input.y, input.angle, input.length,
    input.face.ox, input.face.oy, wallHeight,
  ]) || !(input.length > 0) || !(wallHeight > 0)) {
    throw new Error('invalid isometric opening input');
  }
  const half = input.length / 2;
  let leaves: IsoOpeningLeafBasis[];
  if (input.type === 'gate') {
    const sy = input.flipV ? -1 : 1;
    const turn = input.face.side * sy * 10;
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], turn, 0, wallHeight * 0.88),
      leafBasis(input, 1, [half, 0], [-half, 0], -turn, 0, wallHeight * 0.88),
    ];
  } else if (input.type === 'window') {
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], -90, wallHeight * 0.27, wallHeight * 0.78),
      leafBasis(input, 1, [half, 0], [-half, 0], 90, wallHeight * 0.27, wallHeight * 0.78),
    ];
  } else {
    leaves = [leafBasis(input, 0, [-half, 0], [input.length, 0], -90, 0, wallHeight * 0.92)];
  }
  return {
    id: input.id,
    sourceIndex: input.sourceIndex,
    type: input.type,
    leaves: Object.freeze(leaves.map((leaf) => Object.freeze(leaf))),
  };
}

const pointText = (point: ScenePoint): string =>
  `${Number(point[0].toFixed(4))} ${Number(point[1].toFixed(4))}`;

function liveTip(leaf: IsoOpeningLeafBasis, amount: number): PlanPoint {
  const angle = leaf.turnDeg * amount * Math.PI / 180;
  return [
    leaf.hinge[0] + leaf.closedVector[0] * Math.cos(angle)
      + leaf.quarterVector[0] * Math.sin(angle),
    leaf.hinge[1] + leaf.closedVector[1] * Math.cos(angle)
      + leaf.quarterVector[1] * Math.sin(angle),
  ];
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
    return {
      id: basis.id,
      sourceIndex: basis.sourceIndex,
      type: basis.type,
      leaf: leaf.leaf,
      d: `M ${pointText(floorHinge)} L ${pointText(floorTip)} L ${pointText(topTip)} L ${pointText(topHinge)} Z`,
      shadowD: `M ${pointText(projectPlanPoint(leaf.hinge, 0, camera))} L ${pointText(projectPlanPoint(tip, 0, camera))}`,
      depth: Math.max(floorHinge[1], floorTip[1]),
    };
  });
}

/** State-independent plan envelope for fit/home; blur is intentionally absent. */
export function isoOpeningBounds(
  bases: readonly IsoOpeningBasis[],
): IsoOpeningBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const basis of bases) {
    for (const leaf of basis.leaves) {
      const radius = Math.hypot(leaf.closedVector[0], leaf.closedVector[1]);
      minX = Math.min(minX, leaf.hinge[0] - radius);
      minY = Math.min(minY, leaf.hinge[1] - radius);
      maxX = Math.max(maxX, leaf.hinge[0] + radius);
      maxY = Math.max(maxY, leaf.hinge[1] + radius);
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
    materialNuance: structural && !input.forcedColors,
    floorSymbols: !input.hideOpenings && !structural,
  };
}
