/**
 * Stage 4 isometric scene orchestration and inert SVG rendering.
 *
 * The card remains the owner of live HA state and editor interaction. This
 * module owns the presentation-only structural cache, overlay projection and
 * SVG volume layers so the main Lit shell does not also become a renderer.
 */
import { ISO_ICON_SCALE } from './iso-tiles';
// #649 п.2: the 2.5D light lives in this lazy graph; Flat never loads it.
export { computeIsoSunBeams, renderIsoSunWash } from './iso-sun';
import { nothing, svg, type TemplateResult } from 'lit';
import { clampScale, islandsOf, roomPoly, type SpaceDisplay } from './logic';
import {
  ISO_CAMERA, ISO_FLOOR_EDGE_HEIGHT,
  ISO_RAISED_OVERLAY_HEIGHT, ISO_WALL_HEIGHT,
  projectPlanPoint, projectedFrame, type PlanPoint, type ScenePoint,
} from './iso-projection';
import {
  buildIsoFloorGeometry, buildIsoWallGeometry, isoGeometryFingerprint,
  type IsoFloorGeometry, type IsoWallFace, type IsoWallGeometry, type IsoWallTopFace,
} from './iso-walls';
import {
  ISO_OPENING_GEOMETRY_POLICY, buildIsoOpeningBasis, isoOpeningBounds, projectIsoOpening,
  projectIsoOpeningStructure, resolveIsoDecoration,
  type IsoDecorationLayers, type IsoOpeningBasis, type IsoOpeningPanel,
  type IsoOpeningGeometryPolicy, type IsoOpeningSurface,
} from './iso-openings';
import {
  resolveIsoOverlayOwner, resolveIsoOverlayPlacement,
  type IsoOverlayPlacement, type IsoOverlayRoom, type IsoRaisedOverlayKind,
  type IsoWallSilhouette,
} from './iso-overlays';
import {
  floorFootprintGeometry, openingInnerFaceOffsetFromIndex,
  openingWallIndex as buildOpeningWallIndex, resolveOpeningWallAssociation,
  wallBodiesGeometry,
  type OpeningWallIndex, type WallEntry,
} from './wall-thickness';
import { partitionOpeningFace } from './partition-openings';
import { openingLockFloorPlacement } from './opening-symbol-placement';
import { physicalBodyParts, type PartitionOpeningCut } from './physical-geometry';
import { gridVisualScale, gridVisualUnits } from './grid-scale';
import { iconUnit, type Rect } from './space-geometry';
import { lruRead, lruWrite } from './card-runtime';
import type { ResolvedDevicePresentation } from './device-presentation';
import { deviceTextScale, legacySupplementalMetrics } from './device-face';
import type { RenderOpening } from './interaction-types';
import type { DevItem, RoomCfg, SpaceModel } from './types';

/** Exact-build handshake for the hidden lazy alpha runtime. */
export const ISO_SCENE_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

export type IsoOpeningRenderSurface = IsoOpeningSurface & {
  id: string;
  sourceIndex: number;
  type: string;
  leaf?: number;
};

export type IsoWallDepthQueueEntry =
  | { layer: 'wall-side'; depth: number; face: IsoWallFace }
  | { layer: 'wall-top'; depth: number; face: IsoWallTopFace }
  | { layer: 'opening'; depth: number; surface: IsoOpeningRenderSurface };

const isoDepthLayerRank = (entry: IsoWallDepthQueueEntry): number =>
  entry.layer === 'wall-side' ? 0 : entry.layer === 'wall-top' ? 1 : 2;

const isoDepthStableKey = (entry: IsoWallDepthQueueEntry): string => {
  if (entry.layer === 'wall-side') {
    return `${entry.face.polygon}:${entry.face.ring}:${entry.face.edge}`;
  }
  if (entry.layer === 'wall-top') return String(entry.face.component);
  const surface = entry.surface;
  return `${surface.sourceIndex}:${surface.leaf ?? -1}:${surface.kind}:${surface.jamb ?? -1}`
    + `:${surface.edge ?? ''}:${surface.id}:${surface.material}`;
};

/**
 * Far-to-near painter queue shared by every opaque Stage 4 structural surface.
 *
 * The established screen-depth order remains authoritative between unrelated
 * walls/openings. Inside one opening, however, physical camera depth is the
 * authoritative face order: elevated window glass must paint over its rear
 * sill, and a door/gate prism must not invert its front/back faces while it
 * rotates. Reorder only that opening's already allocated queue slots, so the
 * fix cannot move an unrelated wall or opening into a different layer.
 */
export function buildIsoWallDepthQueue(
  geometry: IsoWallGeometry,
  openingSurfaces: readonly IsoOpeningRenderSurface[],
): readonly IsoWallDepthQueueEntry[] {
  const entries: IsoWallDepthQueueEntry[] = [
    ...geometry.sides.map((face) => ({
      layer: 'wall-side' as const, depth: face.depth, face,
    })),
    ...geometry.topFaces.map((face) => ({
      layer: 'wall-top' as const, depth: face.depth, face,
    })),
    ...openingSurfaces.map((surface) => ({
      layer: 'opening' as const, depth: surface.depth, surface,
    })),
  ];
  entries.sort((a, b) => a.depth - b.depth
    || isoDepthLayerRank(a) - isoDepthLayerRank(b)
    || isoDepthStableKey(a).localeCompare(isoDepthStableKey(b)));
  const openingSlots = new Map<string, IsoWallDepthQueueEntry[]>();
  for (const entry of entries) {
    if (entry.layer !== 'opening') continue;
    const key = `${entry.surface.type}\u0000${entry.surface.id}`;
    const slots = openingSlots.get(key) || [];
    slots.push(entry);
    openingSlots.set(key, slots);
  }
  for (const slots of openingSlots.values()) slots.sort((a, b) => {
    const surfaceA = a.layer === 'opening' ? a.surface : null;
    const surfaceB = b.layer === 'opening' ? b.surface : null;
    return (surfaceA?.cameraDepth ?? surfaceA?.depth ?? 0)
      - (surfaceB?.cameraDepth ?? surfaceB?.depth ?? 0)
      || isoDepthStableKey(a).localeCompare(isoDepthStableKey(b));
  });
  const nextOpeningSlot = new Map<string, number>();
  return Object.freeze(entries.map((entry) => {
    if (entry.layer !== 'opening') return entry;
    const key = `${entry.surface.type}\u0000${entry.surface.id}`;
    const index = nextOpeningSlot.get(key) || 0;
    nextOpeningSlot.set(key, index + 1);
    return openingSlots.get(key)?.[index] || entry;
  }));
}

export type IsoOverlayRenderEntry = {
  id: string;
  kind: IsoRaisedOverlayKind;
  placement: IsoOverlayPlacement;
  groundRadius: number;
  /** Screen-facing HTML footprint around visualScene, in scene units. */
  screenHalfSize: PlanPoint;
  /**
   * #711: the footprint the layout sees. For a device it is the state-free tile —
   * value text and badges change with HA state, and the owner's rule is that a
   * device never moves because its state changed. Absent means screenHalfSize.
   */
  layoutHalfSize?: PlanPoint;
};

const layoutHalfSizeOf = (entry: IsoOverlayRenderEntry): PlanPoint =>
  entry.layoutHalfSize ?? entry.screenHalfSize;

/** #711: the tile of a device without anything its HA state writes on it. */
const stateFreePresentation = (
  presentation: ResolvedDevicePresentation,
): ResolvedDevicePresentation => ({
  ...presentation,
  valueText: null, valueFullText: null, valueBadge: null, tempText: null, humText: null,
});

export type IsoOverlayRenderScene = {
  devices: ReadonlyMap<string, IsoOverlayPlacement>;
  rooms: ReadonlyMap<RoomCfg, IsoOverlayPlacement>;
  locks: ReadonlyMap<string, IsoOverlayPlacement>;
  entries: readonly IsoOverlayRenderEntry[];
  /** Internal memo key for the complete raised-overlay layout. */
  layoutSignature: string;
};

/**
 * CSS-derived, deliberately conservative footprint constants. The invisible
 * footprint has no DOM measurement loop, so every value is an upper bound in
 * multiples of the device core / room base-font rather than a sampled pixel
 * size. Keep these in one place beside the pure footprint resolver whenever
 * the shared face/room-label CSS changes.
 */
export const ISO_RAISED_FOOTPRINT = Object.freeze({
  textLatinAdvance: 0.72,
  textWideAsciiAdvance: 1,
  textWideAdvance: 1.1,
  textSpaceAdvance: 0.4,
  textWidthSafety: 1.08,
  deviceShellInset: 0.134375,
  deviceShellGap: 0.1,
  deviceSectionGap: 0.08,
  deviceBadgeMinWidth: 0.7875,
  deviceBadgeHeight: 0.7875,
  deviceBadgeInlinePadding: 0.28,
  deviceValueInlinePadding: 0.32,
  deviceAuxiliaryExtent: 0.7,
  deviceLqiFontSize: 0.38,
  deviceLqiTop: 0.734375,
  deviceLqiBelowBottomBadgeTop: 1.571875,
  devicePadding: 0.08,
  roomNameLineHeight: 1.25,
  roomAreaLinkWidth: 1.1,
  roomMetricsTopGap: 0.15,
  roomMetricFontSize: 0.75,
  roomMetricLineHeight: 1.25,
  roomMetricIconWidth: 1.05,
  roomMetricInnerGap: 0.12,
  roomMetricRowGap: 0.55,
  roomMetricMinWidth: 11,
  roomPadding: 0.4,
  openingLockHalfSize: 0.62,
  roomMetricTextCharacters: Object.freeze({
    temperature: 10,
    humidity: 8,
    lqi: 6,
    light: 24,
  }),
});

type IsoRaisedFootprintInput =
  | { kind: 'device'; core: number; presentation: ResolvedDevicePresentation }
  | {
      kind: 'room-label';
      font: number;
      room: RoomCfg;
      display: Pick<SpaceDisplay, 'labelTemp' | 'labelHum' | 'labelLqi' | 'labelLight'>;
    }
  | { kind: 'opening-lock'; size: number };

type RelativeBounds = { left: number; right: number; top: number; bottom: number };

function conservativeTextAdvance(text: string): number {
  return [...String(text)].reduce((sum, char) => {
    if (/\s/.test(char)) return sum + ISO_RAISED_FOOTPRINT.textSpaceAdvance;
    if (/[MW@#%&]/.test(char)) return sum + ISO_RAISED_FOOTPRINT.textWideAsciiAdvance;
    return sum + (char.codePointAt(0)! > 0xff
      ? ISO_RAISED_FOOTPRINT.textWideAdvance : ISO_RAISED_FOOTPRINT.textLatinAdvance);
  }, 0) * ISO_RAISED_FOOTPRINT.textWidthSafety;
}

function deviceFaceTextWidth(text: string, fullText: string): number {
  return conservativeTextAdvance(text) * deviceTextScale(fullText || text);
}

function halfSizeOf(bounds: RelativeBounds, padding: number): PlanPoint {
  return [
    Math.max(Math.abs(bounds.left), Math.abs(bounds.right)) + padding,
    Math.max(Math.abs(bounds.top), Math.abs(bounds.bottom)) + padding,
  ];
}

/** Conservative invisible footprint for every supported raised HTML overlay. */
export function isoRaisedOverlayHalfSize(input: IsoRaisedFootprintInput): PlanPoint {
  if (input.kind === 'opening-lock') {
    const size = Number.isFinite(input.size) && input.size > 0 ? input.size : 0;
    const half = size * ISO_RAISED_FOOTPRINT.openingLockHalfSize;
    return [half, half];
  }
  if (input.kind === 'room-label') {
    const font = Number.isFinite(input.font) && input.font > 0 ? input.font : 0;
    const nameScale = clampScale(input.room.settings?.name_scale);
    const metricScale = clampScale(input.room.settings?.label_scale);
    const nameWidth = (conservativeTextAdvance(input.room.name || '')
      + (input.room.area ? ISO_RAISED_FOOTPRINT.roomAreaLinkWidth : 0)) * nameScale;
    const nameHeight = ISO_RAISED_FOOTPRINT.roomNameLineHeight * nameScale;
    const metricSlots = [
      input.display.labelTemp ? ISO_RAISED_FOOTPRINT.roomMetricTextCharacters.temperature : 0,
      input.display.labelHum ? ISO_RAISED_FOOTPRINT.roomMetricTextCharacters.humidity : 0,
      input.display.labelLqi && input.room.area
        ? ISO_RAISED_FOOTPRINT.roomMetricTextCharacters.lqi : 0,
      input.display.labelLight ? ISO_RAISED_FOOTPRINT.roomMetricTextCharacters.light : 0,
    ].filter((characters) => characters > 0);
    const metricFont = ISO_RAISED_FOOTPRINT.roomMetricFontSize * metricScale;
    const metricsWidth = metricSlots.length
      ? Math.max(ISO_RAISED_FOOTPRINT.roomMetricMinWidth,
          metricSlots.reduce((sum, characters) => sum
            + ISO_RAISED_FOOTPRINT.roomMetricIconWidth
            + ISO_RAISED_FOOTPRINT.roomMetricInnerGap
            + characters * ISO_RAISED_FOOTPRINT.textLatinAdvance
              * ISO_RAISED_FOOTPRINT.textWidthSafety, 0)
          + (metricSlots.length - 1) * ISO_RAISED_FOOTPRINT.roomMetricRowGap) * metricFont
      : 0;
    const metricsHeight = metricSlots.length
      ? metricFont * ISO_RAISED_FOOTPRINT.roomMetricLineHeight : 0;
    const bounds: RelativeBounds = {
      left: -Math.max(nameWidth, metricsWidth) / 2,
      right: Math.max(nameWidth, metricsWidth) / 2,
      top: -nameHeight / 2,
      bottom: metricSlots.length
        ? nameHeight / 2 + ISO_RAISED_FOOTPRINT.roomMetricsTopGap + metricsHeight
        : nameHeight / 2,
    };
    const half = halfSizeOf(bounds, ISO_RAISED_FOOTPRINT.roomPadding);
    return [half[0] * font, half[1] * font];
  }

  const core = Number.isFinite(input.core) && input.core > 0 ? input.core : 0;
  const presentation = input.presentation;
  const coreWidth = presentation.valueText == null ? 1 : Math.max(1,
    deviceFaceTextWidth(presentation.valueText,
      presentation.valueFullText || presentation.valueText)
      + ISO_RAISED_FOOTPRINT.deviceValueInlinePadding);
  const sectionWidths: number[] = [];
  if (presentation.valueBadge) {
    sectionWidths.push(Math.max(ISO_RAISED_FOOTPRINT.deviceBadgeMinWidth,
      deviceFaceTextWidth(presentation.valueBadge.text,
        presentation.valueBadge.fullText || presentation.valueBadge.text)
        + ISO_RAISED_FOOTPRINT.deviceBadgeInlinePadding));
  }
  for (const metric of legacySupplementalMetrics(presentation)) {
    const text = metric.text + metric.suffix;
    sectionWidths.push(Math.max(ISO_RAISED_FOOTPRINT.deviceBadgeMinWidth,
      deviceFaceTextWidth(text, text) + ISO_RAISED_FOOTPRINT.deviceBadgeInlinePadding));
  }
  const position = presentation.valueBadge?.position || 'right';
  let bounds: RelativeBounds;
  if (sectionWidths.length && (position === 'left' || position === 'right')) {
    const sectionWidth = Math.max(...sectionWidths);
    const sectionHeight = sectionWidths.length * ISO_RAISED_FOOTPRINT.deviceBadgeHeight
      + (sectionWidths.length - 1) * ISO_RAISED_FOOTPRINT.deviceSectionGap;
    const contentWidth = coreWidth + ISO_RAISED_FOOTPRINT.deviceShellGap + sectionWidth;
    const contentHeight = Math.max(1, sectionHeight);
    bounds = position === 'right' ? {
      left: -0.5 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      right: -0.5 + contentWidth + ISO_RAISED_FOOTPRINT.deviceShellInset,
      top: -contentHeight / 2 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      bottom: contentHeight / 2 + ISO_RAISED_FOOTPRINT.deviceShellInset,
    } : {
      left: 0.5 - contentWidth - ISO_RAISED_FOOTPRINT.deviceShellInset,
      right: 0.5 + ISO_RAISED_FOOTPRINT.deviceShellInset,
      top: -contentHeight / 2 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      bottom: contentHeight / 2 + ISO_RAISED_FOOTPRINT.deviceShellInset,
    };
  } else if (sectionWidths.length) {
    const sectionWidth = sectionWidths.reduce((sum, width) => sum + width, 0)
      + (sectionWidths.length - 1) * ISO_RAISED_FOOTPRINT.deviceSectionGap;
    const contentWidth = Math.max(coreWidth, sectionWidth);
    const contentHeight = 1 + ISO_RAISED_FOOTPRINT.deviceShellGap
      + ISO_RAISED_FOOTPRINT.deviceBadgeHeight;
    bounds = position === 'bottom' ? {
      left: -contentWidth / 2 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      right: contentWidth / 2 + ISO_RAISED_FOOTPRINT.deviceShellInset,
      top: -0.5 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      bottom: -0.5 + contentHeight + ISO_RAISED_FOOTPRINT.deviceShellInset,
    } : {
      left: -contentWidth / 2 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      right: contentWidth / 2 + ISO_RAISED_FOOTPRINT.deviceShellInset,
      top: 0.5 - contentHeight - ISO_RAISED_FOOTPRINT.deviceShellInset,
      bottom: 0.5 + ISO_RAISED_FOOTPRINT.deviceShellInset,
    };
  } else {
    bounds = {
      left: -0.5 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      right: -0.5 + coreWidth + ISO_RAISED_FOOTPRINT.deviceShellInset,
      top: -0.5 - ISO_RAISED_FOOTPRINT.deviceShellInset,
      bottom: 0.5 + ISO_RAISED_FOOTPRINT.deviceShellInset,
    };
  }
  const auxiliary = ISO_RAISED_FOOTPRINT.deviceAuxiliaryExtent;
  bounds.left = Math.min(bounds.left, -auxiliary);
  bounds.right = Math.max(bounds.right, auxiliary);
  bounds.top = Math.min(bounds.top, -auxiliary);
  bounds.bottom = Math.max(bounds.bottom, auxiliary);
  if (presentation.pulse.animated) {
    const pulseRadius = Math.max(1, presentation.pulse.diameterScale) / 2;
    bounds.left = Math.min(bounds.left, -pulseRadius);
    bounds.right = Math.max(bounds.right, pulseRadius);
    bounds.top = Math.min(bounds.top, -pulseRadius);
    bounds.bottom = Math.max(bounds.bottom, pulseRadius);
  }
  if (presentation.lqiText != null) {
    const lqiTop = presentation.valueBadge?.position === 'bottom'
      ? ISO_RAISED_FOOTPRINT.deviceLqiBelowBottomBadgeTop
      : ISO_RAISED_FOOTPRINT.deviceLqiTop;
    const lqiHalfWidth = conservativeTextAdvance(presentation.lqiText)
      * ISO_RAISED_FOOTPRINT.deviceLqiFontSize / 2;
    bounds.left = Math.min(bounds.left, -lqiHalfWidth);
    bounds.right = Math.max(bounds.right, lqiHalfWidth);
    bounds.bottom = Math.max(bounds.bottom,
      lqiTop + ISO_RAISED_FOOTPRINT.deviceLqiFontSize);
  }
  const half = halfSizeOf(bounds, ISO_RAISED_FOOTPRINT.devicePadding);
  return [half[0] * core, half[1] * core];
}

export type IsoSceneCacheEntry = {
  geometry: IsoWallGeometry;
  floor: IsoFloorGeometry;
  wallSilhouettes: readonly IsoWallSilhouette[];
  openings: readonly IsoOpeningBasis[];
  openingSurfaces: readonly IsoOpeningRenderSurface[];
};

export type IsoRenderScene = IsoSceneCacheEntry & {
  key: string;
  frame: Rect;
  /** Presentation-only metadata; never stored in the structural LRU. */
  overlayFitEntries?: readonly IsoOverlayRenderEntry[];
};

export type IsoStructuralSource = {
  key: string;
  build: () => {
    walls: unknown;
    floor: unknown;
    openings: readonly IsoOpeningBasis[];
    openingSurfaces: readonly IsoOpeningRenderSurface[];
  };
};

export type IsoSourceOpening = {
  id: string;
  sourceIndex: number;
  type: RenderOpening['type'];
  x: number;
  y: number;
  angle: number;
  length: number;
  flipH: boolean;
  flipV: boolean;
};

export function isoSourceOpenings(
  openings: readonly RenderOpening[], coordinateScale: number,
): IsoSourceOpening[] {
  return openings.flatMap((opening, sourceIndex) => opening.orphanReason ? [] : [{
    id: String(opening.id || sourceIndex),
    sourceIndex,
    type: opening.type,
    x: opening.rx,
    y: opening.ry,
    angle: Number(opening.angle) || 0,
    length: opening.rlen > 0 ? opening.rlen : 0.9 * coordinateScale,
    flipH: !!opening.flip_h,
    flipV: !!opening.flip_v,
  }]);
}

/** Geometry-only room snapshot used by the structural cache fingerprint. */
export function isoStructuralRoomGeometry(room: RoomCfg): Pick<
RoomCfg, 'id' | 'x' | 'y' | 'w' | 'h' | 'poly' | 'wall_ids'
> {
  return {
    id: room.id,
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    poly: room.poly,
    wall_ids: room.wall_ids,
  };
}

export type IsoStructuralOpeningHost = {
  sourceIndex: number;
  hostId: string;
  t: number;
  depth: number;
  face: { ox: number; oy: number; cm: number; side: -1 | 1 };
};

/** Exact canonical partition-host inputs consumed by the opening-volume build. */
export function isoStructuralOpeningHost(
  rendered: RenderOpening | undefined,
  opening: IsoSourceOpening,
): IsoStructuralOpeningHost | null {
  const resolved = rendered?.partitionHost;
  if (!resolved) return null;
  const faceFlipV = opening.type === 'gate' ? !opening.flipV : opening.flipV;
  return {
    sourceIndex: opening.sourceIndex,
    hostId: resolved.host.id,
    t: resolved.t,
    depth: resolved.depth,
    face: partitionOpeningFace(resolved, faceFlipV),
  };
}

export interface IsoStructuralSourceInput {
  space: SpaceModel;
  walls: WallEntry[];
  openCuts: number[][];
  openings: readonly RenderOpening[];
  partitionCuts(): readonly PartitionOpeningCut[];
  roomOpenings(): Array<{ x: number; y: number; angle: number; length: number }>;
  cellCm: number;
  gridPitch: number;
  wallKeyPitch: number;
  coordinateScale: number;
  onBuild(): void;
}

/** Build the structural key eagerly and the expensive booleans only on miss. */
export function createIsoStructuralSource(
  input: IsoStructuralSourceInput,
  openingGeometryPolicy: Readonly<IsoOpeningGeometryPolicy> = ISO_OPENING_GEOMETRY_POLICY,
): IsoStructuralSource {
  const openings = isoSourceOpenings(input.openings, input.coordinateScale);
  const openingHosts = openings.map((opening) =>
    isoStructuralOpeningHost(input.openings[opening.sourceIndex], opening));
  const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, input.cellCm);
  const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, input.cellCm);
  const raisedHeight = gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT, input.cellCm);
  const key = `${input.space.id}|${isoGeometryFingerprint({
    rooms: input.space.rooms.map(isoStructuralRoomGeometry),
    walls: input.walls,
    openCuts: input.openCuts,
    openings,
    openingHosts,
    openingGeometryPolicy,
    partitions: input.space.partitions,
    columns: input.space.wall_columns,
    cellCm: input.cellCm,
    gridPitch: input.gridPitch,
    wallKeyPitch: input.wallKeyPitch,
    camera: ISO_CAMERA,
    wallHeight,
    raisedHeight,
    floorEdgeHeight,
    algorithm: 6, // #713: vertical oblique projection
  })}`;
  return {
    key,
    build: () => {
      input.onBuild();
      const extras = physicalBodyParts(
        input.space, input.cellCm, input.gridPitch, input.gridPitch * 0.0002,
        input.partitionCuts(),
      ).all;
      const roomOpenings = input.roomOpenings();
      const united = input.walls.length || extras.length
        ? wallBodiesGeometry(
            input.space.rooms, input.walls, input.openCuts, roomOpenings,
            input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordinateScale, extras,
          )
        : null;
      if (united && (united.status === 'failed-core' || united.status === 'not-applicable'))
        throw new Error('wall boolean geometry failed');
      const floor = united?.paperGeom ?? floorFootprintGeometry(
        input.space.rooms, input.walls, input.openCuts,
        input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordinateScale,
      );
      if (!floor) throw new Error('floor boolean geometry failed');
      const openingIndex = united?.openingIndex || buildOpeningWallIndex(
        input.space.rooms, input.walls, input.openCuts,
        input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordinateScale,
      );
      const openingBases = openings.map((opening, index) => {
        const host = openingHosts[index];
        const faceFlipV = opening.type === 'gate' ? !opening.flipV : opening.flipV;
        const face = host
          ? host.face
          : input.walls.length || opening.type === 'gate'
            ? openingInnerFaceOffsetFromIndex(openingIndex, {
                x: opening.x,
                y: opening.y,
                angle: opening.angle,
                length: opening.length,
                flip_v: faceFlipV,
              })
            : { ox: 0, oy: 0, cm: 0, side: -1 as -1 | 1 };
        return buildIsoOpeningBasis({ ...opening, face }, wallHeight, openingGeometryPolicy);
      });
      const frozenBases = Object.freeze(openingBases);
      return {
        walls: united?.components.flatMap((component) => component.geom) || [],
        floor,
        openings: frozenBases,
        openingSurfaces: Object.freeze(frozenBases.flatMap((basis) =>
          projectIsoOpeningStructure(basis).map((surface) => Object.freeze({
            ...surface,
            id: basis.id,
            sourceIndex: basis.sourceIndex,
            type: basis.type,
          })))),
      };
    },
  };
}

const unknownArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

/**
 * Project a cached physical wall union once. Since #714 no overlay is tested
 * against it; the frozen array is the structural identity the overlay caches key on.
 */
export function isoWallSilhouettesOf(geometry: unknown, height: number): IsoWallSilhouette[] {
  const projectRing = (raw: unknown): ScenePoint[] => unknownArray(raw).flatMap((point) => {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return [];
    return [projectPlanPoint([Number(point[0]), Number(point[1])], height)];
  });
  return unknownArray(geometry).flatMap((rawPolygon) => {
    const polygon = unknownArray(rawPolygon);
    if (!polygon.length) return [];
    const outer = projectRing(polygon[0]);
    if (outer.length < 3) return [];
    const holes = polygon.slice(1).map(projectRing).filter((ring) => ring.length >= 3);
    return [{ outer, holes } satisfies IsoWallSilhouette];
  });
}

export interface ResolveIsoSceneInput {
  source: IsoStructuralSource;
  cache: Map<string, IsoSceneCacheEntry>;
  cellCm: number;
  liveFrame: Rect;
}

export function resolveIsoScene(input: ResolveIsoSceneInput): IsoRenderScene {
  const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, input.cellCm);
  const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, input.cellCm);
  const raisedHeight = gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT, input.cellCm);
  const cached = lruRead(input.cache, input.source.key);
  let value = cached.hit ? cached.value : undefined;
  if (!value) {
    const structural = input.source.build();
    const geometry = buildIsoWallGeometry(structural.walls, ISO_CAMERA, wallHeight);
    const wallTops = isoWallSilhouettesOf(structural.walls, wallHeight);
    value = {
      geometry,
      floor: buildIsoFloorGeometry(structural.floor, floorEdgeHeight),
      wallSilhouettes: Object.freeze([
        ...wallTops,
        ...geometry.sides.map((face) => ({ outer: face.points })),
      ]),
      openings: structural.openings,
      openingSurfaces: structural.openingSurfaces,
    };
    lruWrite(input.cache, input.source.key, value, 8);
  }
  const openingFrame = isoOpeningBounds(value.openings);
  const structuralFrame = openingFrame ? unionRect(input.liveFrame, openingFrame) : input.liveFrame;
  const frame = projectedFrame({
    rect: structuralFrame,
    wallHeight,
    openingHeight: wallHeight,
    floorDepth: floorEdgeHeight,
    raisedHeight,
  });
  return { key: input.source.key, ...value, frame };
}

const unionRect = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
};

const rectFromPoints = (points: readonly ScenePoint[]): Rect | null => {
  if (!points.length || !points.every((point) =>
    Number.isFinite(point[0]) && Number.isFinite(point[1]))) return null;
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

const overlayEntryPoints = (entry: IsoOverlayRenderEntry): ScenePoint[] => {
  const placement = entry.placement;
  const center = placement.visualScene;
  const [halfX, halfY] = entry.screenHalfSize;
  return [
    placement.floorScene,
    ...placement.footprint,
    [center[0] - halfX, center[1] - halfY],
    [center[0] + halfX, center[1] - halfY],
    [center[0] + halfX, center[1] + halfY],
    [center[0] - halfX, center[1] + halfY],
  ];
};

const selectedOverlayEntries = (
  entries: readonly IsoOverlayRenderEntry[], ownerId?: string,
): readonly IsoOverlayRenderEntry[] => ownerId === undefined ? entries
  : entries.filter((entry) => entry.placement.owner?.id === ownerId);

/** Exact AABB of the final screen-facing roots and their invisible footprints. */
export function isoOverlaySceneBounds(
  scene: IsoOverlayRenderScene | null, ownerId?: string,
): Rect | null {
  return scene ? rectFromPoints(selectedOverlayEntries(scene.entries, ownerId)
    .flatMap(overlayEntryPoints)) : null;
}

export interface IsoOverlayFitEnvelopeInput {
  baseBounds: Rect;
  entries: readonly IsoOverlayRenderEntry[];
  stageSize?: { width: number; height: number } | null;
  targetView(bounds: Rect): Rect | null;
  ownerId?: string;
}

/**
 * Stable fit envelope for screen-facing content: the structure plus the tiles'
 * own visual extent. Since #713 nothing moves at runtime, so no nudge budget is
 * reserved and current zoom can never feed back into the canonical home frame.
 */
export function resolveIsoOverlayFitEnvelope(
  input: IsoOverlayFitEnvelopeInput,
): { bounds: Rect; view: Rect } | null {
  const entries = selectedOverlayEntries(input.entries, input.ownerId);
  const overlay = rectFromPoints(entries.flatMap(overlayEntryPoints));
  const base = overlay ? unionRect(input.baseBounds, overlay) : input.baseBounds;
  // #713: markers no longer move at runtime, so fit reserves no nudge budget:
  // the frame is the structure plus the markers' own visual extent.
  const view = input.targetView(base);
  return view && view.w > 0 && view.h > 0
    && [view.x, view.y, view.w, view.h].every(Number.isFinite) ? { bounds: base, view } : null;
}

export interface IsoOverlaySceneInput {
  space: SpaceModel;
  devices: readonly DevItem[];
  openings: readonly RenderOpening[];
  display: SpaceDisplay;
  /** Identity of the structural scene; the placement caches are keyed by it. */
  wallSilhouettes: readonly IsoWallSilhouette[];
  /**
   * `false` for fit-envelope probes, which keep their own cache slot. Since
   * #713 there is no collision search, so both slots hold equal placements.
   */
  resolveCollisions?: boolean;
  iconPct: number;
  deviceBasePct: number;
  showLqi: boolean;
  cellCm: number;
  kioskIconScale: number;
  kioskFontScale: number;
  positionOf(device: DevItem): { x: number; y: number };
  presentationOf(device: DevItem, showLqi: boolean): ResolvedDevicePresentation;
  labelPositionOf(room: RoomCfg, spaceId: string): { x: number; y: number };
  labelScaleOf(room: RoomCfg): number;
  openingEntityAvailable(entityId: string): boolean;
  openingWallIndex(): OpeningWallIndex;
}

type IsoOverlayRoomRow = { room: RoomCfg; overlayRoom: IsoOverlayRoom };
const isoOverlayRoomCache = new WeakMap<readonly RoomCfg[], readonly IsoOverlayRoomRow[]>();
type IsoOverlayPlacementCacheEntry = { signature: string; placement: IsoOverlayPlacement };
type IsoOverlayOwnerCacheEntry = { signature: string; owner: IsoOverlayPlacement['owner'] };
export const ISO_OVERLAY_PLACEMENT_CACHE_LIMIT = 2048;
const isoOverlayPlacementCache = new WeakMap<
  readonly IsoWallSilhouette[], Map<string, IsoOverlayPlacementCacheEntry>
>();
const isoOverlayOwnerCache = new WeakMap<
  readonly IsoOverlayRoomRow[], Map<string, IsoOverlayOwnerCacheEntry>
>();
const isoOverlayRenderSceneCache = new WeakMap<
  readonly IsoWallSilhouette[], Map<'fit' | 'live', IsoOverlayRenderScene>
>();

function samePlacementMap<K>(
  previous: ReadonlyMap<K, IsoOverlayPlacement>, next: ReadonlyMap<K, IsoOverlayPlacement>,
): boolean {
  if (previous.size !== next.size) return false;
  for (const [key, placement] of next) if (previous.get(key) !== placement) return false;
  return true;
}

function sameOverlayEntries(
  previous: readonly IsoOverlayRenderEntry[], next: readonly IsoOverlayRenderEntry[],
): boolean {
  return previous.length === next.length && next.every((entry, index) => {
    const before = previous[index];
    return before.id === entry.id && before.kind === entry.kind
      && before.placement === entry.placement && before.groundRadius === entry.groundRadius
      && before.screenHalfSize[0] === entry.screenHalfSize[0]
      && before.screenHalfSize[1] === entry.screenHalfSize[1];
  });
}

/** Build legal island-room holes once per immutable room snapshot. */
export function isoOverlayRooms(space: SpaceModel): readonly IsoOverlayRoomRow[] {
  const cached = isoOverlayRoomCache.get(space.rooms);
  if (cached) return cached;
  const rows = space.rooms.flatMap((room, index) => {
    const poly = roomPoly(room);
    return poly && poly.length >= 3 ? [{ room, index, poly }] : [];
  });
  const result = Object.freeze(rows.map(({ room, index, poly }) => {
    const holes = islandsOf(poly, rows.filter((row) => row.index !== index).map((row) => row.poly));
    const base: IsoOverlayRoom = {
      id: room.id || `room-index-${index}`,
      outer: poly.map((point) => [point[0], point[1]] as PlanPoint),
      holes: holes.map((ring) => ring.map((point) => [point[0], point[1]] as PlanPoint)),
    };
    return { room, overlayRoom: base };
  }));
  isoOverlayRoomCache.set(space.rooms, result);
  return result;
}

/** Build the one-frame mapping from immutable floor anchors to raised visuals. */
export function buildIsoOverlayRenderScene(input: IsoOverlaySceneInput): IsoOverlayRenderScene {
  const roomRows = isoOverlayRooms(input.space);
  const rooms = roomRows.map((row) => row.overlayRoom);
  // #713: device tiles and lock badges stand on the wall-top plane, one common
  // straight-up shift for every marker; room names stay on the floor where
  // Flat puts them. No placement search: markers may meet walls and each other.
  const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, input.cellCm);
  const devices = new Map<string, IsoOverlayPlacement>();
  const roomPlacements = new Map<RoomCfg, IsoOverlayPlacement>();
  const locks = new Map<string, IsoOverlayPlacement>();
  const entries: IsoOverlayRenderEntry[] = [];
  let placements = isoOverlayPlacementCache.get(input.wallSilhouettes);
  if (!placements) {
    placements = new Map();
    isoOverlayPlacementCache.set(input.wallSilhouettes, placements);
  }
  let owners = isoOverlayOwnerCache.get(roomRows);
  if (!owners) {
    owners = new Map();
    isoOverlayOwnerCache.set(roomRows, owners);
  }
  const baseIconUnits = input.iconPct * iconUnit(input.space) * input.kioskIconScale / 100;
  const baseDeviceUnits = input.deviceBasePct * iconUnit(input.space) * input.kioskIconScale / 100;
  const place = (
    kind: IsoRaisedOverlayKind,
    id: string,
    floorAnchor: PlanPoint,
    footprintHalfSize: PlanPoint,
    preferredRoomId?: string | null,
  ): IsoOverlayPlacement => {
    const visualOffset = kind === 'room-label' ? 0 : wallHeight;
    const collisionMode = input.resolveCollisions === false ? 'fit' : 'live';
    const cacheKey = `${collisionMode}\u0000${kind}\u0000${id}`;
    // Nothing here depends on zoom or stage size, so a pinch, wheel or resize
    // reuses the immutable placement and Lit keeps the raised SVG subtree.
    const signature = [floorAnchor[0], floorAnchor[1],
      footprintHalfSize[0], footprintHalfSize[1],
      preferredRoomId || '', wallHeight, visualOffset,
    ].join('|');
    const cached = lruRead(placements!, cacheKey);
    if (cached.hit && cached.value.signature === signature) return cached.value.placement;
    const ownerKey = `${kind}\u0000${id}`;
    const ownerSignature = [floorAnchor[0], floorAnchor[1], preferredRoomId || ''].join('|');
    const cachedOwner = lruRead(owners!, ownerKey);
    const owner = cachedOwner.hit && cachedOwner.value.signature === ownerSignature
      ? cachedOwner.value.owner
      : resolveIsoOverlayOwner({
        kind, floorAnchor, rooms, roomsValidated: true, preferredRoomId,
      });
    if (!cachedOwner.hit || cachedOwner.value.signature !== ownerSignature) {
      lruWrite(owners!, ownerKey, { signature: ownerSignature, owner },
        ISO_OVERLAY_PLACEMENT_CACHE_LIMIT);
    }
    const placement = resolveIsoOverlayPlacement({
      kind,
      floorAnchor,
      rooms, roomsValidated: true,
      preferredRoomId,
      ownerAlreadyResolved: true,
      resolvedOwner: owner,
      showBorders: true,
      footprintHalfSize,
      visualOffset,
    });
    lruWrite(placements!, cacheKey, { signature, placement }, ISO_OVERLAY_PLACEMENT_CACHE_LIMIT);
    return placement;
  };

  for (const device of input.devices) {
    const pos = input.positionOf(device);
    const presentation = input.presentationOf(device, input.showLqi);
    // #649: the 2.5D tile is ICON_SCALE larger; layout and fit see that size.
    const core = baseDeviceUnits * presentation.scale * ISO_ICON_SCALE;
    const halfSize = isoRaisedOverlayHalfSize({ kind: 'device', core, presentation });
    const layoutHalfSize = isoRaisedOverlayHalfSize({
      kind: 'device', core, presentation: stateFreePresentation(presentation),
    });
    const preferredRoomId = device.marker?.room_id
      || roomRows.find((row) => !!device.area && row.room.area === device.area)?.overlayRoom.id
      || null;
    const placement = place(
      'device', device.id, [pos.x, pos.y],
      layoutHalfSize,
      preferredRoomId,
    );
    devices.set(device.id, placement);
    entries.push({
      id: device.id,
      kind: 'device',
      placement,
      groundRadius: Math.max(core * 0.32, 2),
      screenHalfSize: halfSize,
      layoutHalfSize,
    });
  }

  for (const { room, overlayRoom } of roomRows) {
    if (!input.display.showNames || !room.name) continue;
    const pos = input.labelPositionOf(room, input.space.id);
    const scale = input.labelScaleOf(room) * input.kioskFontScale * input.display.cardFontScale;
    const font = baseIconUnits * 0.5 * scale;
    const halfSize = isoRaisedOverlayHalfSize({
      kind: 'room-label', font, room, display: input.display,
    });
    const placement = place(
      'room-label', overlayRoom.id, [pos.x, pos.y],
      halfSize, overlayRoom.id,
    );
    roomPlacements.set(room, placement);
    entries.push({
      id: overlayRoom.id,
      kind: 'room-label',
      placement,
      groundRadius: Math.max(font * 0.75, 2),
      screenHalfSize: halfSize,
    });
  }

  const lockItems = input.openings.filter((opening): opening is RenderOpening & { lock: string } =>
    !opening.orphanReason && (opening.type === 'door' || opening.type === 'gate')
      && typeof opening.lock === 'string' && !!opening.lock
      && input.openingEntityAvailable(opening.lock));
  if (lockItems.length) {
    const openingWallIndex = input.openingWallIndex();
    for (const opening of lockItems) {
      const lockPlacement = isoOpeningLockPlacement(opening, openingWallIndex, input.cellCm);
      const floorAnchor = lockPlacement.floorAnchor;
      const size = baseIconUnits * 0.62 * ISO_ICON_SCALE;
      const halfSize = isoRaisedOverlayHalfSize({ kind: 'opening-lock', size });
      const placement = place(
        'opening-lock', String(opening.id), floorAnchor,
        halfSize, lockPlacement.preferredRoomId,
      );
      locks.set(String(opening.id), placement);
      entries.push({
        id: String(opening.id),
        kind: 'opening-lock',
        placement,
        groundRadius: Math.max(size * 0.28, 2),
        screenHalfSize: halfSize,
      });
    }
  }
  const mode = input.resolveCollisions === false ? 'fit' : 'live';
  let renderScenes = isoOverlayRenderSceneCache.get(input.wallSilhouettes);
  if (!renderScenes) {
    renderScenes = new Map();
    isoOverlayRenderSceneCache.set(input.wallSilhouettes, renderScenes);
  }
  const previous = renderScenes.get(mode);
  const layoutSignature = entries.map((entry) => {
    const placement = entry.placement;
    return [entry.kind, entry.id, placement.floorAnchor[0], placement.floorAnchor[1],
      placement.raisedScene[0], placement.raisedScene[1], placement.owner?.id || '',
      layoutHalfSizeOf(entry)[0], layoutHalfSizeOf(entry)[1]].join('|');
  }).sort().join('\u0001');
  if (previous?.layoutSignature === layoutSignature
      && samePlacementMap(previous.rooms, roomPlacements)) {
    // #711: an HA-only change keeps the layout; only the visual extent that
    // scene bounds read is refreshed.
    const visual = new Map(entries.map((entry) => [
      `${entry.kind}\u0000${entry.id}`, entry.screenHalfSize,
    ]));
    const changed = previous.entries.some((entry) => {
      const next = visual.get(`${entry.kind}\u0000${entry.id}`);
      return !!next && (next[0] !== entry.screenHalfSize[0] || next[1] !== entry.screenHalfSize[1]);
    });
    if (!changed) return previous;
    const refreshed: IsoOverlayRenderScene = {
      ...previous,
      entries: Object.freeze(previous.entries.map((entry) => {
        const next = visual.get(`${entry.kind}\u0000${entry.id}`);
        return next && (next[0] !== entry.screenHalfSize[0] || next[1] !== entry.screenHalfSize[1])
          ? { ...entry, screenHalfSize: next } : entry;
      })),
    };
    renderScenes.set(mode, refreshed);
    return refreshed;
  }

  // #713: no placement search, so the placed entries are final.
  const resolvedEntries = Object.freeze(entries);
  const resolvedDevices = new Map<string, IsoOverlayPlacement>();
  const resolvedLocks = new Map<string, IsoOverlayPlacement>();
  for (const entry of resolvedEntries) {
    if (entry.kind === 'device') resolvedDevices.set(entry.id, entry.placement);
    else if (entry.kind === 'opening-lock') resolvedLocks.set(entry.id, entry.placement);
  }
  const scene: IsoOverlayRenderScene = {
    devices: resolvedDevices,
    rooms: roomPlacements,
    locks: resolvedLocks,
    entries: resolvedEntries,
    layoutSignature,
  };
  if (previous && sameOverlayEntries(previous.entries, scene.entries)
      && samePlacementMap(previous.devices, scene.devices)
      && samePlacementMap(previous.rooms, scene.rooms)
      && samePlacementMap(previous.locks, scene.locks)) return previous;
  renderScenes.set(mode, scene);
  return scene;
}

export function isoOpeningLockAnchor(
  opening: RenderOpening,
  openingWallIndex: OpeningWallIndex,
  cellCm: number,
): PlanPoint {
  return isoOpeningLockPlacement(opening, openingWallIndex, cellCm).floorAnchor;
}

export function isoOpeningLockPlacement(
  opening: RenderOpening,
  openingWallIndex: OpeningWallIndex,
  cellCm: number,
): { floorAnchor: PlanPoint; preferredRoomId: string | null } {
  const faceFlipV = !opening.flip_v;
  const gateFace = opening.type === 'gate'
    ? opening.partitionHost
      ? partitionOpeningFace(opening.partitionHost, faceFlipV)
      : openingInnerFaceOffsetFromIndex(openingWallIndex, {
          x: opening.rx,
          y: opening.ry,
          angle: opening.angle,
          length: opening.rlen,
          flip_v: faceFlipV,
        })
    : null;
  const [floorAnchor, negativeSide] = openingLockFloorPlacement({
    x: opening.rx,
    y: opening.ry,
    angle: opening.angle,
    flipV: !!opening.flip_v,
    gateFace,
  }, cellCm);
  if (opening.partitionHost) return { floorAnchor, preferredRoomId: null };
  const association = resolveOpeningWallAssociation(openingWallIndex, {
    x: opening.rx,
    y: opening.ry,
    angle: opening.angle,
    length: opening.rlen,
  }, true);
  const side = negativeSide ? 'negative' : 'positive';
  return { floorAnchor, preferredRoomId: association[side]?.roomId || null };
}

export function resolveIsoDecorationLayers(display: SpaceDisplay): IsoDecorationLayers {
  // Capability probes are presentation-only and must never enter the
  // structural Flat fallback. Unknown/throwing filter support degrades to the
  // same solid path as an explicitly unsupported filter.
  let filtersSupported = false;
  try {
    filtersSupported = typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('filter', 'blur(1px)');
  } catch { filtersSupported = false; }
  let forcedColors = false;
  try {
    forcedColors = typeof matchMedia === 'function'
      && matchMedia('(forced-colors: active)').matches;
  } catch { forcedColors = true; }
  return resolveIsoDecoration({
    showBorders: display.showBorders,
    hideOpenings: display.hideOpenings,
    filtersSupported,
    forcedColors,
  });
}

export function resolveIsoOpeningPanels(
  layers: IsoDecorationLayers,
  scene: IsoRenderScene | null,
  openings: readonly RenderOpening[],
  amountOf: (opening: RenderOpening) => number,
): IsoOpeningPanel[] {
  if (!layers.panels || !scene) return [];
  const panels = scene.openings.flatMap((basis) => {
    const opening = openings[basis.sourceIndex];
    return opening ? projectIsoOpening(basis, amountOf(opening)) : [];
  });
  return panels.sort((a, b) => a.depth - b.depth
    || a.sourceIndex - b.sourceIndex || a.leaf - b.leaf);
}

export interface IsoFramePresentation {
  layers: IsoDecorationLayers;
  panels: readonly IsoOpeningPanel[];
  overlays: IsoOverlayRenderScene | null;
  underlay: TemplateResult;
  shadows: TemplateResult;
  walls: TemplateResult;
  grounds: TemplateResult;
  raised: TemplateResult;
}

/** Resolve every lazy Stage 4 artifact inside the card's single failure boundary. */
export function resolveIsoFramePresentation(input: {
  projection: 'flat' | 'iso';
  display: SpaceDisplay;
  scene: IsoRenderScene | null;
  openings: readonly RenderOpening[];
  amountOf: (opening: RenderOpening) => number;
  overlays: (layers: IsoDecorationLayers) => IsoOverlayRenderScene | null;
  cellCm: number;
}): IsoFramePresentation {
  const layers = resolveIsoDecorationLayers(input.display);
  const panels = layers.panels
    ? resolveIsoOpeningPanels(layers, input.scene, input.openings, input.amountOf)
    : [];
  const overlays = input.overlays(layers);
  const render = (renderLayers: IsoDecorationLayers): IsoFramePresentation => ({
    layers: renderLayers, panels, overlays,
    underlay: renderIsoUnderlay(renderLayers, input.scene?.floor, input.cellCm),
    shadows: renderIsoShadows(renderLayers, panels, input.scene?.geometry, input.cellCm),
    walls: renderIsoWalls(input.projection, renderLayers, input.scene, panels, input.cellCm),
    grounds: renderIsoOverlayGrounds(overlays, renderLayers, input.cellCm),
    raised: renderIsoRaisedOverlays(overlays),
  });
  try { return render(layers); } catch (error) {
    // A material/shadow presentation failure loses only decorative nuance.
    // Structural projection errors above (panels/overlays), or failures that
    // persist on the solid retry, still escape to the fingerprint latch.
    if (!layers.shadows && !layers.materialNuance) throw error;
    return render({ ...layers, shadows: false, materialNuance: false });
  };
}

const emptySvg = (): TemplateResult => svg`` as unknown as TemplateResult;

/** Scale-aware visual light vector for the one remaining building ambient shadow. */
export function isoFixedLightTransform(cellCm: number): string {
  return `translate(${gridVisualUnits(4, cellCm)} ${gridVisualUnits(8, cellCm)})`;
}

function renderIsoDefs(
  layers: IsoDecorationLayers,
  root: 'underlay' | 'walls',
  cellCm: number,
): TemplateResult {
  const visualScale = gridVisualScale(cellCm);
  return svg`<defs>
    ${root === 'walls' && layers.materialNuance ? svg`
      <linearGradient id="hp-iso-wall-side" data-hp-iso-material-def x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="iso-side-hi"></stop><stop offset="0.58" class="iso-side-mid"></stop><stop offset="1" class="iso-side-lo"></stop>
      </linearGradient>
      <linearGradient id="hp-iso-wall-top" data-hp-iso-material-def x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" class="iso-top-hi"></stop><stop offset="1" class="iso-top-lo"></stop>
      </linearGradient>
      <pattern id="hp-iso-wall-texture" data-hp-iso-material-def patternUnits="userSpaceOnUse"
        width="${12 * visualScale}" height="${12 * visualScale}">
        <circle class="iso-texture-mark" cx="${2 * visualScale}" cy="${2 * visualScale}"
          r="${0.55 * visualScale}"></circle>
        <path class="iso-texture-line" d="M ${5 * visualScale} ${10 * visualScale}
          l ${5 * visualScale} ${-5 * visualScale}"></path>
      </pattern>` : nothing}
    ${root === 'underlay' && layers.materialNuance ? svg`
      <pattern id="hp-iso-floor-texture" data-hp-iso-material-def patternUnits="userSpaceOnUse"
        width="${14 * visualScale}" height="${14 * visualScale}">
        <circle class="iso-texture-mark" cx="${3 * visualScale}" cy="${3 * visualScale}"
          r="${0.5 * visualScale}"></circle>
      </pattern>` : nothing}
    ${root === 'underlay' && layers.shadows ? svg`
      <filter id="hp-iso-ambient-shadow" data-hp-iso-material-def x="-12%" y="-12%" width="124%" height="130%">
        <feGaussianBlur stdDeviation="${7 * visualScale}"></feGaussianBlur>
      </filter>` : nothing}
  </defs>` as unknown as TemplateResult;
}

export function renderIsoOverlayGrounds(
  _overlays: IsoOverlayRenderScene | null,
  _layers: IsoDecorationLayers,
  _cellCm: number,
): TemplateResult {
  return emptySvg();
}

export function renderIsoRaisedOverlays(
  _overlays: IsoOverlayRenderScene | null,
): TemplateResult {
  return emptySvg();
}

export function renderIsoUnderlay(
  layers: IsoDecorationLayers,
  floor: IsoFloorGeometry | undefined,
  cellCm: number,
): TemplateResult {
  if (!layers.structural || !floor) return emptySvg();
  return svg`<g class="iso-underlay" data-hp="iso-underlay" aria-hidden="true" pointer-events="none">
    ${renderIsoDefs(layers, 'underlay', cellCm)}
    ${layers.shadows && floor.footprintPath
      ? svg`<path class="iso-ambient-shadow" d=${floor.footprintPath}
          transform=${isoFixedLightTransform(cellCm)}></path>`
      : nothing}
    <g class="iso-floor-edge">${floor.sides.map((face) =>
      svg`<path class="iso-floor-side" d=${face.d} data-component=${face.component}
        data-edge=${face.edge}></path>${layers.materialNuance
        ? svg`<path class="iso-material-texture iso-floor-texture" d=${face.d}></path>`
        : nothing}`)}</g>
  </g>` as unknown as TemplateResult;
}

export function renderIsoShadows(
  _layers: IsoDecorationLayers,
  _panels: readonly IsoOpeningPanel[],
  _geometry: IsoWallGeometry | undefined,
  _cellCm: number,
): TemplateResult {
  return emptySvg();
}

export function renderIsoWalls(
  projection: 'flat' | 'iso',
  layers: IsoDecorationLayers,
  scene: IsoRenderScene | null,
  panels: readonly IsoOpeningPanel[],
  cellCm: number,
): TemplateResult {
  if (projection !== 'iso' || !layers.structural || !scene) return emptySvg();
  const openingSurfaces: IsoOpeningRenderSurface[] = layers.panels ? [
    ...scene.openingSurfaces,
    ...panels.flatMap((panel) => panel.surfaces.map((surface) => ({
      ...surface,
      id: panel.id,
      sourceIndex: panel.sourceIndex,
      type: panel.type,
      leaf: panel.leaf,
    }))),
  ] : [];
  const depthQueue = buildIsoWallDepthQueue(scene.geometry, openingSurfaces);
  return svg`<g class="iso-walls" data-hp="iso-walls" data-fingerprint=${scene.key}>
    ${renderIsoDefs(layers, 'walls', cellCm)}
    <g class=${layers.panels ? 'iso-wall-depth-queue iso-openings' : 'iso-wall-depth-queue'}
      data-hp=${layers.panels ? 'iso-openings' : nothing}
      aria-hidden="true" pointer-events="none">${depthQueue.map((entry) => {
        if (entry.layer === 'wall-side') {
          const face = entry.face;
          return svg`<path class="iso-wall-side" d=${face.d} data-edge=${face.edge}></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}></path>`
            : nothing}`;
        }
        if (entry.layer === 'wall-top') {
          const face = entry.face;
          return svg`<path class="iso-wall-top" d=${face.d} data-component=${face.component}
            fill-rule="evenodd"></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture" d=${face.d}
                fill-rule="evenodd"></path>`
            : nothing}`;
        }
        const surface = entry.surface;
        return svg`<path class="iso-opening-panel iso-${surface.type} iso-opening-${surface.kind} iso-material-${surface.material}"
          d=${surface.d} data-id=${surface.id} data-kind=${surface.type}
          data-surface=${surface.kind} data-leaf=${surface.leaf ?? nothing}></path>${layers.materialNuance
            ? svg`<path class="iso-material-texture iso-wall-texture iso-opening-texture"
                d=${surface.d}></path>`
            : nothing}`;
      })}</g>
  </g>` as unknown as TemplateResult;
}
