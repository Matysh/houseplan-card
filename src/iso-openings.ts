import {
  ISO_CAMERA, ISO_WALL_HEIGHT, projectPlanPoint, isoRotationBasis,
  type IsoCamera, type PlanPoint, type ScenePoint,
} from './iso-projection';
import { openingLeafOriginOffset } from './opening-symbol-placement';
import type { OpeningFeatures } from './types';
import { openingSlideDirection } from './opening-features';

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
  handleSides?: readonly [boolean, boolean];
  opening_features?: OpeningFeatures;
  /** Physical 20cm converted with this space's grid, not a visual constant. */
  topShift?: number;
}

export interface IsoOpeningLeafBasis {
  leaf: number;
  hinge: PlanPoint;
  closedVector: PlanPoint;
  quarterVector: PlanPoint;
  turnDeg: number;
  bottom: number;
  top: number;
  translation?: PlanPoint;
  /** Local detailed view only; the ordinary dev/Flat contract stays intact. */
  detailedTurnDeg?: number;
  tiltSash?: { readonly outward: PlanPoint; readonly turnDeg: number };
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
 * Versioned authority for every fixed Stage 4 opening dimension. It is part of
 * the structural fingerprint, so a policy change cannot reuse stale cached
 * opening volumes from an older algorithm.
 */
export interface IsoOpeningGeometryPolicy {
  revision: number;
  leafThicknessRatio: number;
  frameThicknessRatio: number;
  doorTurnDeg: number;
  windowTurnDeg: number;
  gateTurnDeg: number;
  detailedGateTurnDeg: number;
  detailedTopWindowTurnDeg: number;
  gateTopRatio: number;
  windowFrameBottomRatio: number;
  windowFrameTopRatio: number;
  windowSashBottomRatio: number;
  windowSashTopRatio: number;
  windowGlassBottomRatio: number;
  windowGlassTopRatio: number;
  doorTopRatio: number;
}

export const ISO_OPENING_GEOMETRY_POLICY: Readonly<IsoOpeningGeometryPolicy> = Object.freeze({
  revision: 4,
  leafThicknessRatio: 0.04,
  frameThicknessRatio: 0.05,
  doorTurnDeg: 50,
  windowTurnDeg: 65,
  gateTurnDeg: 10,
  detailedGateTurnDeg: 90,
  detailedTopWindowTurnDeg: 30,
  gateTopRatio: 0.88,
  windowFrameBottomRatio: 0.38,
  windowFrameTopRatio: 1,
  windowSashBottomRatio: 0.40,
  windowSashTopRatio: 0.98,
  windowGlassBottomRatio: 0.45,
  windowGlassTopRatio: 0.93,
  doorTopRatio: 0.92,
});

export const ISO_OPENING_LEAF_THICKNESS_RATIO =
  ISO_OPENING_GEOMETRY_POLICY.leafThicknessRatio;
export const ISO_OPENING_FRAME_THICKNESS_RATIO =
  ISO_OPENING_GEOMETRY_POLICY.frameThicknessRatio;

export interface IsoWindowProfile {
  handleSides: readonly [boolean, boolean];
  frameBottom: number;
  frameTop: number;
  sashBottom: number;
  sashTop: number;
  glassBottom: number;
  glassTop: number;
  member: number;
}

/** Immutable jamb/axis topology stored in the structural Iso LRU. */
export interface IsoOpeningBasis {
  id: string;
  sourceIndex: number;
  type: IsoOpeningType;
  wallHeight: number;
  /** Clear head height for door/passages; kept in the immutable physical basis. */
  apertureTop: number;
  leafThickness: number;
  frameThickness: number;
  windowProfile: IsoWindowProfile | null;
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
  | 'window-sash-side'
  | 'window-sash-bottom'
  | 'window-sash-top'
  | 'window-glass'
  | 'window-glass-covered'
  | 'window-glass-top'
  | 'window-frame-side'
  | 'window-frame-top'
  | 'window-mullion'
  | 'window-handle'
  | 'window-blind'
  | 'window-blind-hem'
  | 'window-sill'
  | 'window-sill-side'
  | 'window-apron-side'
  | 'window-apron-top'
  | 'opening-lintel-side'
  | 'opening-lintel-top'
  | 'opening-lintel-underside'
  | 'door-frame'
  | 'door-stile'
  | 'door-rail'
  | 'door-glass'
  | 'door-handle'
  | 'door-hinge'
  | 'gate-rail';

export type IsoOpeningMaterial =
  | 'reveal'
  | 'matte-leaf'
  | 'light-window'
  | 'glass-side'
  | 'glass-over-fabric'
  | 'glass-top'
  | 'light-frame'
  | 'blind-fabric'
  | 'blind-hem'
  | 'light-sill'
  | 'wall-side'
  | 'wall-top'
  | 'hardware'
  | 'gate-panel'
  | 'gate-metal';

export interface IsoOpeningSurface {
  kind: IsoOpeningSurfaceKind;
  material: IsoOpeningMaterial;
  d: string;
  /** Camera depth of the face centre along the projector, used for local occlusion. */
  cameraDepth: number;
  /** Render-only vertices for exact visibility; never written to the plan. */
  points?: readonly IsoSpatialPoint[];
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
  material: 'matte-leaf' | 'light-window' | 'glass-side';
  thickness: number;
  /** Stage 4 prism/frame faces. The legacy d remains the centre face for compatibility. */
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
  // Flat symbols stay on the saved centreline (#250). A volumetric door/gate
  // has a physical host face, however: centring its prism inside the masonry
  // makes half of the leaf look embedded in the wall. Only the derived Iso
  // leaf moves to that selected face; saved coordinates and the Flat symbol do
  // not change. Windows keep their frame/sash centred across the reveal.
  const offset = openingLeafOriginOffset(input.type, input.face, 'iso-volume');
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
  profileReferenceHeight = wallHeight,
): IsoOpeningBasis {
  const faceCm = input.face.cm ?? 0;
  if (!finite([
    input.x, input.y, input.angle, input.length,
    input.face.ox, input.face.oy, faceCm, wallHeight, profileReferenceHeight,
  ]) || !(input.length > 0) || !(wallHeight > 0) || !(profileReferenceHeight > 0)
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
  const features = input.opening_features;
  const explicitWindow = input.type === 'window' && features?.version === 1 && 'leaves' in features ? features : null;
  const motion = (input.type === 'door' || input.type === 'gate') && features?.version === 1 && !('leaves' in features) ? features : null;
  if (input.type === 'passage') {
    leaves = [];
  } else if (explicitWindow) {
    const width = input.length / explicitWindow.leaves.length;
    const side = explicitWindow.side === 'negative' ? 1 : -1;
    const neutral = { ...input, flipH: false, flipV: false };
    leaves = explicitWindow.leaves.map((leaf, index) => {
      const end = leaf.hinge === 'end', top = leaf.hinge === 'top';
      const basis = leafBasis(neutral, index, [-half + index * width + (end ? width : 0), 0],
        [end ? -width : width, 0], top ? 0 : (end ? 1 : -1) * side * policy.windowTurnDeg,
        wallHeight * policy.windowSashBottomRatio, wallHeight * policy.windowSashTopRatio);
      if (top) {
        basis.translation = transformVector([0, -side * (input.topShift ?? 20)], input.angle, 1, 1);
        basis.tiltSash = Object.freeze({
          outward: frozenPoint(normal[0] * -side, normal[1] * -side),
          turnDeg: policy.detailedTopWindowTurnDeg,
        });
      }
      return basis;
    });
  } else if (motion?.mechanism === 'slide') {
    const basis = leafBasis({ ...input, flipH: false, flipV: false }, 0,
      [-half, 0], [input.length, 0], 0, 0,
      wallHeight * (input.type === 'gate' ? policy.gateTopRatio : policy.doorTopRatio));
    basis.translation = transformVector([input.length * (openingSlideDirection(motion) === 'end' ? 1 : -1), 0], input.angle, 1, 1);
    leaves = [basis];
  } else if (input.type === 'gate') {
    const turn = input.face.side * policy.gateTurnDeg;
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], turn, 0,
        wallHeight * policy.gateTopRatio),
      leafBasis(input, 1, [half, 0], [-half, 0], -turn, 0,
        wallHeight * policy.gateTopRatio),
    ].map((leaf,index)=>({...leaf,
      detailedTurnDeg: input.face.side * (index === 0 ? 1 : -1) * policy.detailedGateTurnDeg}));
  } else if (input.type === 'window') {
    leaves = [
      leafBasis(input, 0, [-half, 0], [half, 0], -policy.windowTurnDeg,
        wallHeight * policy.windowSashBottomRatio,
        wallHeight * policy.windowSashTopRatio),
      leafBasis(input, 1, [half, 0], [-half, 0], policy.windowTurnDeg,
        wallHeight * policy.windowSashBottomRatio,
        wallHeight * policy.windowSashTopRatio),
    ];
  } else {
    leaves = [leafBasis(input, 0, [-half, 0], [input.length, 0], -policy.doorTurnDeg, 0,
      wallHeight * policy.doorTopRatio)];
  }
  const windowProfile = input.type === 'window' ? Object.freeze({
    handleSides: Object.freeze([...(input.handleSides ?? [false,false])]) as readonly [boolean, boolean],
    frameBottom: wallHeight * policy.windowFrameBottomRatio,
    frameTop: wallHeight * policy.windowFrameTopRatio,
    sashBottom: wallHeight * policy.windowSashBottomRatio,
    sashTop: wallHeight * policy.windowSashTopRatio,
    glassBottom: wallHeight * policy.windowGlassBottomRatio,
    glassTop: wallHeight * policy.windowGlassTopRatio,
    member: profileReferenceHeight * policy.frameThicknessRatio,
  }) : null;
  return Object.freeze({
    id: input.id,
    sourceIndex: input.sourceIndex,
    type: input.type,
    wallHeight,
    apertureTop: wallHeight * policy.doorTopRatio,
    leafThickness: profileReferenceHeight * policy.leafThicknessRatio,
    frameThickness: profileReferenceHeight * policy.frameThicknessRatio,
    windowProfile,
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

export interface IsoSpatialPoint {
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
  const [cos, sin] = isoRotationBasis(camera);
  const tilt = camera.tiltDeg * Math.PI / 180;
  // #713: depth along the oblique projector (s, 1) of `y' = y − z·s`.
  const cameraDepth = points.reduce((sum, value) => sum
    + (value.point[0] * sin + value.point[1] * cos)
      * Math.sin(tilt)
    + value.z, 0) / points.length;
  return Object.freeze({
    kind,
    material,
    points,
    d: `M ${projected.map(pointText).join(' L ')} Z`,
    cameraDepth,
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

/** Closed prism using the canonical physical wall faces. All vertices stay in
 * plan coordinates until the shared projection; no screen-space gap patches. */
function openingPrism(
  ring: readonly PlanPoint[], bottom: number, top: number,
  sideKind: IsoOpeningSurfaceKind, topKind: IsoOpeningSurfaceKind,
  sideMaterial: IsoOpeningMaterial, topMaterial: IsoOpeningMaterial,
  camera: IsoCamera, undersideKind?: IsoOpeningSurfaceKind,
): IsoOpeningSurface[] {
  if (!(top > bottom)) return [];
  const result = ring.map((a,i) => verticalSurface(sideKind, sideMaterial,
    a, ring[(i+1)%ring.length], bottom, top, camera));
  result.push(projectedSurface(topKind, topMaterial, ring.map(point=>({point,z:top})), camera));
  if (undersideKind) result.push(projectedSurface(undersideKind, sideMaterial,
    [...ring].reverse().map(point=>({point,z:bottom})), camera));
  return result;
}

/** Local #1451: real masonry below a window / above a door or passage.
 * Gates and zero-depth hosts deliberately never acquire a floating lintel. */
export function isoOpeningMasonry(basis: IsoOpeningBasis) {
  if (!(basis.face.depth > 1e-9) || basis.type === 'gate') return null;
  return Object.freeze({
    ring: Object.freeze([basis.face.selectedStart, basis.face.selectedEnd,
      basis.face.oppositeEnd, basis.face.oppositeStart]),
    bottom: basis.type === 'window' ? 0 : basis.apertureTop,
    top: basis.windowProfile ? basis.windowProfile.frameBottom - basis.frameThickness * .4 : basis.wallHeight,
  });
}

export function projectIsoOpeningMasonry(basis: IsoOpeningBasis, camera: IsoCamera = ISO_CAMERA): readonly IsoOpeningSurface[] {
  const volume = isoOpeningMasonry(basis);
  if (!volume) return [];
  const {ring, bottom, top} = volume;
  return Object.freeze(basis.type === 'window'
    ? openingPrism(ring, bottom, top,
      'window-apron-side','window-apron-top','wall-side','wall-top',camera)
    : openingPrism(ring, bottom, top,
      'opening-lintel-side','opening-lintel-top','wall-side','wall-top',camera,'opening-lintel-underside'));
}

/**
 * Project state-independent Stage 4 jamb/reveal and window frame/sill surfaces.
 * Passage deliberately has no decorative volume. This function consumes only
 * the immutable structural basis and is safe to cache with that basis.
 */
export function projectIsoOpeningStructure(
  basis: IsoOpeningBasis,
  camera: IsoCamera = ISO_CAMERA,
  masonry = false,
): readonly IsoOpeningSurface[] {
  if (basis.type === 'passage' && !masonry) return Object.freeze([]);
  const surfaces: IsoOpeningSurface[] = masonry ? [...projectIsoOpeningMasonry(basis,camera)] : [];
  const lower = masonry && basis.windowProfile ? basis.windowProfile.frameBottom : 0;
  const upper = masonry && (basis.type === 'door' || basis.type === 'passage')
    ? basis.apertureTop : basis.windowProfile?.frameTop ?? basis.wallHeight;
  if (basis.face.depth > 1e-9) {
    const reveals = basis.type === 'passage' ? [
      {jamb:0 as const,selected:basis.face.selectedStart,opposite:basis.face.oppositeStart},
      {jamb:1 as const,selected:basis.face.selectedEnd,opposite:basis.face.oppositeEnd},
    ] : basis.reveals;
    for (const reveal of reveals) {
      surfaces.push(verticalSurface(
        'jamb-reveal', 'reveal', reveal.selected, reveal.opposite,
        lower, upper, camera, { jamb: reveal.jamb },
      ));
    }
  }
  if (masonry && basis.type === 'door' && basis.face.depth > 1e-9) {
    const member = Math.min(basis.frameThickness * .6, basis.wallHeight - upper);
    for (const sign of [-1,1]) {
      const faceOffset = scaled(basis.face.offset,sign);
      const lip = scaled(faceOffset, Math.min(member*.35,basis.face.depth*.1)/(basis.face.depth/2));
      const start=add(basis.axis.start,faceOffset), end=add(basis.axis.end,faceOffset);
      const before=subtract(start,scaled(basis.axis.tangent,member));
      const after=add(end,scaled(basis.axis.tangent,member));
      for (const [a,b,bottom,top] of [
        [before,start,0,upper+member], [end,after,0,upper+member],
        [start,end,upper,upper+member],
      ] as const) surfaces.push(...openingPrism([a,b,add(b,lip),add(a,lip)],bottom,top,
        'door-frame','door-frame','light-frame','light-frame',camera));
    }
  }
  if (basis.type !== 'window' || !basis.leaves.length) {
    return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
      || a.kind.localeCompare(b.kind) || (a.jamb ?? 0) - (b.jamb ?? 0)));
  }

  const profile = basis.windowProfile;
  if (!profile) throw new Error('missing isometric window profile');
  const bottom = profile.frameBottom;
  const top = profile.frameTop;
  const member = Math.min(basis.frameThickness, Math.hypot(
    basis.axis.end[0] - basis.axis.start[0],
    basis.axis.end[1] - basis.axis.start[1],
  ) / 4, (top - bottom) / 4);
  if (masonry && basis.leaves.length > 1 && basis.face.depth > 0) {
    // Only an interior side hinge needs a fixed support. Meeting free edges
    // and sill-hinged sashes leave the opening clear when they swing away.
    const {start, end, tangent, normal} = basis.axis;
    const bay = Math.hypot(...subtract(end, start)) / basis.leaves.length;
    const supported = new Set<number>();
    for (const leaf of basis.leaves) {
      if (leaf.tiltSash || !leaf.turnDeg) continue;
      const offset = subtract(leaf.hinge, start);
      const joint = Math.round((offset[0] * tangent[0] + offset[1] * tangent[1]) / bay);
      if (joint <= 0 || joint >= basis.leaves.length || supported.has(joint)) continue;
      supported.add(joint);
      const swing = (leaf.quarterVector[0] * normal[0] + leaf.quarterVector[1] * normal[1]) * leaf.turnDeg;
      const back = scaled(normal, -Math.sign(swing));
      const halfWidth = Math.min(member * .45, bay * .06);
      const near = basis.face.depth * .20, far = Math.min(basis.face.depth / 2, near + member);
      const corner = (across: number, depth: number) =>
        add(start, add(scaled(tangent, joint * bay + across), scaled(back, depth)));
      surfaces.push(...openingPrism([corner(-halfWidth, near), corner(halfWidth, near),
        corner(halfWidth, far), corner(-halfWidth, far)], bottom, top,
        'window-mullion', 'window-mullion', 'light-frame', 'light-frame', camera));
    }
  }
  const innerStart = add(basis.axis.start, scaled(basis.axis.tangent, member));
  const innerEnd = subtract(basis.axis.end, scaled(basis.axis.tangent, member));
  const offsets: readonly PlanPoint[] = basis.face.depth > 1e-9
    ? [basis.face.offset, frozenPoint(-basis.face.offset[0], -basis.face.offset[1])]
    : [basis.face.offset];
  for (const offset of offsets) {
    if (masonry) continue; // one sash frame, no duplicated front/rear trim rails
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
    if (masonry) {
      const overhang = scaled(basis.face.offset, 1 + Math.min(member*.4,basis.face.depth*.2)/(basis.face.depth/2));
      surfaces.push(...openingPrism([add(basis.axis.start,overhang),add(basis.axis.end,overhang),
        subtract(basis.axis.end,overhang),subtract(basis.axis.start,overhang)],
        bottom-basis.frameThickness*.4,bottom,'window-sill-side','window-sill',
        'light-sill','light-sill',camera));
    } else surfaces.push(projectedSurface('window-sill', 'light-sill', [
      { point: basis.face.selectedStart, z: bottom },
      { point: basis.face.selectedEnd, z: bottom },
      { point: basis.face.oppositeEnd, z: bottom },
      { point: basis.face.oppositeStart, z: bottom },
    ], camera));
  }
  return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
    || a.kind.localeCompare(b.kind) || (a.jamb ?? 0) - (b.jamb ?? 0)));
}

/** Live sash frame and glass, all derived from the same immutable window basis. */
function windowSashSurfaces(
  basis: IsoOpeningBasis,
  leaf: IsoOpeningLeafBasis,
  tip: PlanPoint,
  camera: IsoCamera,
  simple = false,
  shadeAmount?: number | null,
): readonly IsoOpeningSurface[] {
  const profile = basis.windowProfile;
  if (!profile) throw new Error('missing isometric window profile');
  const vector = subtract(tip, leaf.hinge);
  const length = Math.hypot(vector[0], vector[1]);
  if (!(length > 1e-9)) return Object.freeze([]);
  const unit = frozenPoint(vector[0] / length, vector[1] / length);
  const member = Math.min(profile.member, length / 4,
    (profile.sashTop - profile.sashBottom) / 4);
  if (simple) {
    const bottom = profile.frameBottom, top = profile.frameTop;
    const rail = Math.min(member * .65, length * .12);
    const tilt = leaf.tiltSash;
    const slope = Math.tan(Math.abs(tilt?.turnDeg ?? leaf.turnDeg) * Math.PI / 180);
    const halfDepth = Math.min(basis.frameThickness * .35, length * .025,
      basis.face.depth > 0 ? basis.face.depth * .16 : Infinity, rail / (1 + slope));
    const normal: PlanPoint = [-unit[1], unit[0]];
    const vertex = (x: number, z: number, depth: number): IsoSpatialPoint =>
      ({ point: add(leaf.hinge, add(scaled(unit, x), scaled(normal, depth))), z });
    const ring = (x0: number, x1: number, z0: number, z1: number, depth: number) =>
      [vertex(x0,z0,depth), vertex(x1,z0,depth), vertex(x1,z1,depth), vertex(x0,z1,depth)];
    // Keep the centreline tight against the jamb/sill. Bevel the two faces
    // on the moving axis so the frame thickness clears the neighbouring bay
    // for every intermediate angle, with the original hinge and leaf span.
    const bevel = halfDepth * slope;
    const insetX = tilt ? 0 : bevel, insetZ = tilt ? bevel : 0;
    const outer = ring(0,length,bottom,top,0);
    const kinds = ['window-sash-bottom','window-sash-side','window-sash-top','window-sash-side'] as const;
    const result: IsoOpeningSurface[] = [];
    const inner = (depth: number) => ring(rail,length-rail,bottom+rail,top-rail,depth);
    const rear = inner(-halfDepth), front = inner(halfDepth);
    for (const depth of [-halfDepth,halfDepth]) {
      const rim = ring(insetX,length-insetX,bottom+insetZ,top-insetZ,depth);
      const opening = depth < 0 ? rear : front;
      kinds.forEach((kind,i) => {
        const j = (i + 1) % 4;
        result.push(projectedSurface(kind,'light-frame',[rim[i],rim[j],opening[j],opening[i]],camera),
          projectedSurface(kind,'light-frame',[outer[i],outer[j],rim[j],rim[i]],camera));
        if (depth > 0) result.push(projectedSurface(kind,'light-frame',[rear[i],rear[j],front[j],front[i]],camera));
      });
    }
    // A sash-mounted roller blind uses the same local plane and hinge as the pane.
    // Its bottom rail ends at the reported cover position, inside the white frame.
    const [vx, vy] = leaf.closedVector, [qx, qy] = leaf.quarterVector;
    const side = Math.sign(tilt ? tilt.outward[0] * normal[0] + tilt.outward[1] * normal[1]
      : (vx * qy - vy * qx) * leaf.turnDeg);
    if (typeof shadeAmount === 'number' && shadeAmount >= 0 && shadeAmount < 1) {
      const shadeTop = top - rail, shadeBottom = bottom + rail + (shadeTop - bottom - rail) * shadeAmount;
      const hemTop = Math.min(shadeTop, shadeBottom + Math.min(rail * .75, (shadeTop - bottom - rail) * .035));
      const depth = (side || 1) * halfDepth * .8;
      // Behind fabric only the glass reflection is visible. Keep the normal
      // blue transmission on the exposed part of the pane.
      if (shadeAmount > 0) result.push(projectedSurface('window-glass', 'glass-side',
        ring(rail,length-rail,bottom+rail,shadeBottom,0),camera));
      result.push(projectedSurface('window-glass-covered', 'glass-over-fabric',
        ring(rail,length-rail,shadeBottom,shadeTop,0),camera));
      if (hemTop < shadeTop) result.push(projectedSurface('window-blind', 'blind-fabric',
        ring(rail,length-rail,hemTop,shadeTop,depth),camera));
      result.push(projectedSurface('window-blind-hem', 'blind-hem',
        ring(rail,length-rail,shadeBottom,hemTop,depth),camera));
    } else result.push(projectedSurface('window-glass','glass-side',inner(0),camera));
    // Map each occupied side of the closed opening into the moving sash's
    // local normal. A right-hand hinge reverses that normal.
    if (length >= profile.member * 5 && top - bottom >= profile.member * 5) {
      const x = tilt ? length / 2 : length - (rail + insetX) / 2;
      const z = tilt ? top - (rail + insetZ) / 2 : (bottom + top) / 2;
      const grip = Math.min(profile.member * 1.65, length * .22, (top - bottom) * .22);
      const halfWidth = tilt ? grip / 2 : (rail - insetX) * .35;
      const halfHeight = tilt ? (rail - insetZ) * .35 : grip / 2;
      const hingeDirection = Math.sign(vx * basis.axis.tangent[0] + vy * basis.axis.tangent[1]);
      const corner = (along: number, depth: number) => vertex(along, z, depth).point;
      profile.handleSides.forEach((occupied,index) => {
        if (!occupied) return;
        const mount = (index === 0 ? -1 : 1) * hingeDirection;
        const frontDepth = mount * halfDepth;
        const gripDepth = frontDepth + mount * Math.min(rail * .55, basis.face.depth * .12);
        if (gripDepth !== frontDepth) result.push(...openingPrism([
          corner(x-halfWidth, frontDepth), corner(x+halfWidth, frontDepth),
          corner(x+halfWidth, gripDepth), corner(x-halfWidth, gripDepth),
        ], z-halfHeight, z+halfHeight, 'window-handle', 'window-handle', 'hardware', 'hardware', camera, 'window-handle'));
      });
    }
    return Object.freeze(result);
  }
  const innerHinge = add(leaf.hinge, scaled(unit, member));
  const innerTip = subtract(tip, scaled(unit, member));
  const paneThickness = Math.min(basis.frameThickness * 0.35, length * 0.02);
  const paneHalfNormal = frozenPoint(
    -unit[1] * paneThickness / 2,
    unit[0] * paneThickness / 2,
  );
  const glassFrontHinge = add(innerHinge, paneHalfNormal);
  const glassFrontTip = add(innerTip, paneHalfNormal);
  const glassBackHinge = subtract(innerHinge, paneHalfNormal);
  const glassBackTip = subtract(innerTip, paneHalfNormal);
  const surfaces: IsoOpeningSurface[] = [
    verticalSurface('window-sash-side', 'light-frame', leaf.hinge, innerHinge,
      profile.sashBottom, profile.sashTop, camera, { edge: 'hinge' }),
    verticalSurface('window-sash-side', 'light-frame', innerTip, tip,
      profile.sashBottom, profile.sashTop, camera, { edge: 'tip' }),
    verticalSurface('window-sash-bottom', 'light-frame', leaf.hinge, tip,
      profile.sashBottom, profile.sashBottom + member, camera),
    verticalSurface('window-sash-top', 'light-frame', leaf.hinge, tip,
      profile.sashTop - member, profile.sashTop, camera),
    verticalSurface('window-glass', 'glass-side', glassFrontHinge, glassFrontTip,
      profile.glassBottom, profile.glassTop, camera),
    verticalSurface('window-glass', 'glass-side', glassBackTip, glassBackHinge,
      profile.glassBottom, profile.glassTop, camera),
    projectedSurface('window-glass-top', 'glass-top', [
      { point: glassFrontHinge, z: profile.glassTop },
      { point: glassFrontTip, z: profile.glassTop },
      { point: glassBackTip, z: profile.glassTop },
      { point: glassBackHinge, z: profile.glassTop },
    ], camera),
  ];
  return Object.freeze(surfaces.sort((a, b) => a.depth - b.depth
    || a.kind.localeCompare(b.kind) || String(a.edge || '').localeCompare(String(b.edge || ''))));
}

/** Four solid frame members and a single pane, all in the moving leaf's coordinates. */
function glazedDoorSurfaces(
  basis: IsoOpeningBasis, leaf: IsoOpeningLeafBasis, tip: PlanPoint,
  camera: IsoCamera, rail: number,
): IsoOpeningSurface[] {
  const vector = subtract(tip, leaf.hinge);
  const length = Math.hypot(...vector);
  const u = scaled(vector, 1 / length);
  const normal = scaled([-u[1], u[0]], basis.leafThickness / 2);
  const at = (x: number) => add(leaf.hinge, scaled(u, x));
  const frame = (x0: number, x1: number, z0: number, z1: number, kind: 'door-stile' | 'door-rail') =>
    openingPrism([subtract(at(x0), normal), subtract(at(x1), normal),
      add(at(x1), normal), add(at(x0), normal)], z0, z1, kind, kind, 'light-frame', 'light-frame', camera);
  const {bottom, top} = leaf;
  return [
    ...frame(0, rail, bottom, top, 'door-stile'),
    ...frame(length - rail, length, bottom, top, 'door-stile'),
    ...frame(rail, length - rail, bottom, bottom + rail, 'door-rail'),
    ...frame(rail, length - rail, top - rail, top, 'door-rail'),
    verticalSurface('door-glass', 'glass-side', at(rail), at(length - rail), bottom + rail, top - rail, camera),
  ];
}

/** Hardware follows the resolved leaf on both faces, including slide/mirror.
 * Width and motion are untouched; only render-only details are added. */
function openingHardware(basis:IsoOpeningBasis,leaf:IsoOpeningLeafBasis,tip:PlanPoint,camera:IsoCamera,stileWidth=0):IsoOpeningSurface[] {
  const vector=subtract(tip,leaf.hinge),length=Math.hypot(...vector);
  if(length<1e-9)return [];
  const u=scaled(vector,1/length),n:PlanPoint=[-u[1],u[0]],h=leaf.top-leaf.bottom,t=basis.leafThickness;
  const point=(x:number,y:number)=>add(leaf.hinge,add(scaled(u,x),scaled(n,y)));
  const box=(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,kind:IsoOpeningSurfaceKind,mat:IsoOpeningMaterial)=>
    openingPrism([point(x0,y0),point(x1,y0),point(x1,y1),point(x0,y1)],z0,z1,kind,kind,mat,mat,camera);
  const out:IsoOpeningSurface[]=[];
  if (basis.type === 'door' && !leaf.translation) {
    // Both pins share the actual pivot, independent of the opening angle.
    const radius = Math.min(t * .65, h * .025, length * .023);
    const ring = Array.from({length:8}, (_,i):PlanPoint => {
      const a = i * Math.PI / 4;
      return [leaf.hinge[0] + radius * Math.cos(a), leaf.hinge[1] + radius * Math.sin(a)];
    });
    for (const position of [.18,.82]) {
      const z = leaf.bottom + position * h;
      out.push(...openingPrism(ring,z - h * .033,z + h * .033,'door-hinge','door-hinge',
        'hardware','hardware',camera,'door-hinge'));
    }
  }
  for(const side of [-1,1]) {
    const face=side*t*.5,outer=face+side*t*.35;
    const x=stileWidth ? length-stileWidth/2 : length*.84,z=leaf.bottom+h*.47;
    const plateWidth=stileWidth ? Math.min(h*.012,stileWidth*.25) : h*.012;
    out.push(...box(x-plateWidth,x+plateWidth,face,outer,z-h*.04,z+h*.04,'door-handle','hardware'));
    if(basis.type==='door') out.push(...box(x-Math.min(length*.12,h*.1),x+plateWidth,outer,outer+side*t*.35,
      z-h*.009,z+h*.009,'door-handle','hardware'));
    else {
      out.push(...box(x-h*.012,x+h*.012,outer,outer+side*t*.4,z-h*.05,z+h*.05,'door-handle','hardware'));
      for(const ratio of [.18,.38,.62,.82]) out.push(...box(0,length,face,face+side*t*.08,
        leaf.bottom+h*ratio-h*.006,leaf.bottom+h*ratio+h*.006,'gate-rail','gate-metal'));
    }
  }
  return out;
}

/** Apply live state after the structural cache: O(leaves), no topology work. */
export function projectIsoOpening(
  basis: IsoOpeningBasis,
  amount: number | readonly number[],
  camera: IsoCamera = ISO_CAMERA,
  detailed = false,
  lightTransparent = false,
  shadeAmounts?: readonly (number | null | undefined)[],
): IsoOpeningPanel[] {
  return basis.leaves.map((storedLeaf) => {
    const sourceAmount = typeof amount === 'number' ? amount : amount[storedLeaf.leaf] ?? 0;
    const liveAmount = Math.max(0, Math.min(1, Number.isFinite(sourceAmount) ? sourceAmount : 0));
    const tilted = detailed && !!storedLeaf.tiltSash && !!basis.windowProfile;
    const leaf = { ...storedLeaf,
      turnDeg: detailed ? storedLeaf.detailedTurnDeg ?? storedLeaf.turnDeg : storedLeaf.turnDeg,
      hinge: storedLeaf.translation && !tilted
        ? add(storedLeaf.hinge, scaled(storedLeaf.translation, liveAmount)) : storedLeaf.hinge,
    };
    const tip = liveTip(leaf, liveAmount);
    // The detailed lab preview uses a sill-hinged tilt for the symbolic
    // vertical-opening mode. Rotate both the frame thickness and the glass.
    const pose = (vertex: IsoSpatialPoint): IsoSpatialPoint => {
      if (!tilted || liveAmount === 0) return vertex;
      const n = storedLeaf.tiltSash!.outward;
      const theta = storedLeaf.tiltSash!.turnDeg * liveAmount * Math.PI / 180;
      const c = Math.cos(theta), s = Math.sin(theta), pivot = basis.windowProfile!.frameBottom;
      const offset = subtract(vertex.point, storedLeaf.hinge);
      const normalDistance = offset[0] * n[0] + offset[1] * n[1];
      const aboveSill = vertex.z - pivot;
      return {point:add(vertex.point,scaled(n,normalDistance * (c-1) + aboveSill*s)),
        z:pivot - normalDistance*s + aboveSill*c};
    };
    const bottom = tilted ? basis.windowProfile!.frameBottom : leaf.bottom;
    const top = tilted ? basis.windowProfile!.frameTop : leaf.top;
    const bottomHinge = pose({point:leaf.hinge,z:bottom}), bottomTip = pose({point:tip,z:bottom});
    const project = (vertex:IsoSpatialPoint)=>projectPlanPoint(vertex.point,vertex.z,camera);
    const floorHinge = project(bottomHinge), floorTip = project(bottomTip);
    const topTip = project(pose({point:tip,z:top}));
    const topHinge = project(pose({point:leaf.hinge,z:top}));
    const glazed = detailed && basis.type === 'door' && lightTransparent;
    const stileWidth = glazed ? Math.min(Math.hypot(...leaf.closedVector) * .09, (top - bottom) * .065) : 0;
    const material = basis.type === 'window' ? 'light-window' : glazed ? 'glass-side' : 'matte-leaf';
    let surfaces = basis.type === 'window'
      ? windowSashSurfaces(basis, leaf, tip, camera, detailed, shadeAmounts?.[storedLeaf.leaf])
      : glazed ? glazedDoorSurfaces(basis, leaf, tip, camera, stileWidth)
      : leafPrismSurfaces(leaf, tip, basis.leafThickness, camera);
    if (tilted && liveAmount !== 0) surfaces = surfaces.map(surface=>projectedSurface(
      surface.kind,surface.material,surface.points!.map(pose),camera,
      { ...(surface.edge ? {edge:surface.edge} : {}), ...(surface.jamb !== undefined ? {jamb:surface.jamb} : {}) },
    ));
    if (detailed && (basis.type==='door'||basis.type==='gate')) {
      surfaces = [...surfaces,...openingHardware(basis,leaf,tip,camera,stileWidth)];
      if(basis.type==='gate') surfaces=surfaces.map(surface=>surface.material==='matte-leaf'
        ? {...surface,material:surface.kind==='leaf-front'||surface.kind==='leaf-back'?'gate-panel' as const:'gate-metal' as const}:surface);
    }
    return Object.freeze({
      id: basis.id,
      sourceIndex: basis.sourceIndex,
      type: basis.type,
      leaf: leaf.leaf,
      d: `M ${pointText(floorHinge)} L ${pointText(floorTip)} L ${pointText(topTip)} L ${pointText(topHinge)} Z`,
      shadowD: `M ${pointText(projectPlanPoint(bottomHinge.point, 0, camera))} L ${pointText(projectPlanPoint(bottomTip.point, 0, camera))}`,
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
  detailed = false,
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
      if (leaf.translation) include(add(leaf.hinge, leaf.translation), radius);
      if (detailed && leaf.tiltSash && basis.windowProfile) {
        const reach = (basis.windowProfile.frameTop-basis.windowProfile.frameBottom)
          * Math.sin(leaf.tiltSash.turnDeg * Math.PI / 180);
        // For tall, narrow leaves the top edge can travel farther than their width.
        include(add(leaf.hinge,scaled(leaf.tiltSash.outward,reach)),radius+basis.frameThickness);
      }
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
