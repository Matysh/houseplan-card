/**
 * Canonical Glow transport, source projection and SVG field shared by the
 * full plan and the opt-in static space card (#374).
 *
 * This module deliberately knows neither card class. Callers own configuration
 * snapshots and structural caches; the algorithms below own the meaning of a
 * light opening, one spatial source and one painted pool.
 */
import { nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import {
  resolvedLightSources, selectSpatialGlowSource,
} from './devices';
import {
  glowAlpha, isInteriorLightOpeningType, openingLightApertureLength,
  openingLightStateSignature, outlineWithout, pointInPolygon,
  quantizeOpeningLightAmount, resolveGlowAppearance, roomPoly,
} from './logic';
import {
  geometryAllRings, intersectionPaths, pointInOpaquePlanBody,
  scalePartitionOpeningCut, type PartitionOpeningCut,
} from './physical-geometry';
import { partitionOpeningCut } from './partition-openings';
import {
  geometryRoomOpeningInputs, type GeometryOpeningProjection,
} from './plan-geometry-preflight';
import {
  type LightSegment, polygonSegments, splitAtIntersections, visibilityPolygon,
} from './light-visibility';
import {
  recutWallBodiesGeometry, wallBodiesGeometry,
  type WallBodiesGeometryResult, type WallEntry,
} from './wall-thickness';
import type { DevItem, RoomCfg, SpaceModel } from './types';
import type { VirtualLightSnapshot } from './virtual-light-state';
import { contentFingerprint } from './visual-continuity';

/** 96 steps keep an unobstructed arc below a tenth of a tablet pixel. */
export const GLOW_ARC_STEPS = 96;
/** The visible penumbra is one screen-space hair, not plan-space masonry. */
export const GLOW_EDGE_FEATHER_PX = 2;
/** One calibrated monotonic field per source. */
export const GLOW_FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1], [45, 0.88], [70, 0.62], [86, 0.32], [100, 0],
];
export const GLOW_FADE_MS = 500;

export type GlowClipGeometry = { lit: string[] };

export interface GlowCandidate {
  key: string;
  sourceEid: string;
  pos: { x: number; y: number };
  radius: number;
  appearance: { c: string; alpha: number } | null;
}

export interface GlowSpot {
  key: string;
  sourceEid: string;
  domId: number;
  entering: boolean;
  leaving: boolean;
  pos: { x: number; y: number };
  c: string;
  alpha: number;
  geometry: GlowClipGeometry | null;
  r: number;
}

export interface LightRoomPolygon {
  room: RoomCfg;
  poly: number[][];
}

export interface LightBarrierRevision {
  geometryFingerprint: string;
  fingerprint: string;
  polygons: LightRoomPolygon[];
  passageStates: Array<{ opening: GeometryOpeningProjection; amount: number }>;
}

export interface LightBarrierScene {
  occluders: LightSegment[];
  floor: number[][][];
  fingerprint: string;
  masonryGeometry: unknown;
  opaqueBodies: number[][][];
}

export interface LightZeroWalls {
  contour: number[][];
  barriers: number[][];
  transmissive: number[][];
}

export interface GlowRuntimeHost {
  window: () => Window;
  isConnected: () => boolean;
  requestUpdate: () => void;
  reducedMotion: () => boolean;
}

export interface GlowRuntimeState {
  clipCache: Map<string, GlowClipGeometry | null>;
  geometryWarnings: Set<string>;
  featherUnits: number | null;
  renderedSources: Map<string, number>;
  lastAppearance: Map<string, { c: string; alpha: number }>;
  enteringSources: Set<string>;
  enterRafs: Map<string, number>;
  fadeTimers: Map<string, number>;
  featherSuspendUntil: number;
  featherResumeTimer: number;
  sourceSeq: number;
}

type GlowHass = Record<string, unknown> & { states: Record<string, unknown> };

type SharedWallGeometry = Pick<WallBodiesGeometryResult,
  'status' | 'roomGeom' | 'roomComponents' | 'openingIndex' | 'depthUnits'
    | 'openingPadUnits'> & { sourceFingerprint?: string };

export function createGlowRuntimeState(): GlowRuntimeState {
  return {
    clipCache: new Map(),
    geometryWarnings: new Set(),
    featherUnits: null,
    renderedSources: new Map(),
    lastAppearance: new Map(),
    enteringSources: new Set(),
    enterRafs: new Map(),
    fadeTimers: new Map(),
    featherSuspendUntil: 0,
    featherResumeTimer: 0,
    sourceSeq: 0,
  };
}

export function readGlowClip(
  state: GlowRuntimeState, key: string,
): { hit: boolean; value: GlowClipGeometry | null } {
  if (!state.clipCache.has(key)) return { hit: false, value: null };
  const value = state.clipCache.get(key) ?? null;
  state.clipCache.delete(key);
  state.clipCache.set(key, value);
  return { hit: true, value };
}

export function writeGlowClip(
  state: GlowRuntimeState, key: string, value: GlowClipGeometry | null,
  limit = 256,
): void {
  state.clipCache.delete(key);
  state.clipCache.set(key, value);
  while (state.clipCache.size > limit) {
    const oldest = state.clipCache.keys().next().value;
    if (oldest === undefined) break;
    state.clipCache.delete(oldest);
  }
}

/** The exact spatial-source decision shared by both public cards. */
export function resolveGlowCandidates(input: {
  hass: GlowHass;
  devices: readonly DevItem[];
  virtualLights?: VirtualLightSnapshot | null;
  spaceId: string;
  defaultColor: string;
  paletteAlpha: number;
  defaultRadiusUnits: number;
  cellCm: number;
  gridPitch: number;
  position: (device: DevItem) => { x: number; y: number };
}): GlowCandidate[] {
  // #375: pass the array as-is — RESOLVED_LIGHT_CACHE is keyed by the array's
  // identity, so a fresh spread would guarantee a miss on every render.
  const sources = resolvedLightSources(
    input.hass, input.devices, null, input.virtualLights,
  ).filter((source) => source.device.space === input.spaceId);
  const byDevice = new Map<string, typeof sources>();
  for (const source of sources) {
    if (!source.device.id) continue;
    const current = byDevice.get(source.device.id) || [];
    current.push(source);
    byDevice.set(source.device.id, current);
  }
  const result: GlowCandidate[] = [];
  for (const device of input.devices) {
    if (!device.id || device.space !== input.spaceId) continue;
    const source = selectSpatialGlowSource(byDevice.get(device.id) || []);
    if (!source) continue;
    const appearance = resolveGlowAppearance(
      source.passive
        ? { state: source.on ? 'on' : 'off', attributes: {} }
        : input.hass.states[source.eid],
      device.marker?.glow_color,
      input.defaultColor,
    );
    const ownCm = Number(device.marker?.glow_radius_cm);
    const radius = Number.isFinite(ownCm) && ownCm > 0
      ? (ownCm / input.cellCm) * input.gridPitch
      : input.defaultRadiusUnits;
    result.push({
      key: `${input.spaceId}|${device.id}`,
      sourceEid: source.eid,
      pos: input.position(device),
      radius,
      appearance: appearance
        ? { c: appearance.c, alpha: glowAlpha(appearance.bri, input.paletteAlpha) }
        : null,
    });
  }
  return result;
}

/**
 * Resolve the part of a barrier revision that changes with an architectural
 * opening. The fingerprint is intentionally available before structural work.
 */
export function resolveLightBarrierRevision(input: {
  rawSpaceConfig: unknown;
  space: SpaceModel;
  openings: readonly GeometryOpeningProjection[];
  cellCm: number;
  gridPitch: number;
  openingAmount: (opening: GeometryOpeningProjection) => number;
}): LightBarrierRevision {
  const geometryFingerprint = contentFingerprint([
    input.rawSpaceConfig, input.cellCm, input.gridPitch,
  ]);
  const polygons = input.space.rooms.flatMap((room) => {
    const poly = roomPoly(room);
    return poly ? [{ room, poly }] : [];
  });
  const probe = Math.max(
    (10 / input.cellCm) * input.gridPitch,
    input.gridPitch * 0.5,
  );
  const onFloor = (point: number[]): boolean =>
    polygons.some(({ poly }) => pointInPolygon(point, poly));
  const passageStates = input.openings.flatMap((opening) => {
    if (!isInteriorLightOpeningType(String(opening.type))) return [];
    const rad = (opening.angle * Math.PI) / 180;
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    const interior = onFloor([opening.rx + nx * probe, opening.ry + ny * probe])
      && onFloor([opening.rx - nx * probe, opening.ry - ny * probe]);
    return interior ? [{
      opening,
      amount: quantizeOpeningLightAmount(input.openingAmount(opening)),
    }] : [];
  });
  const openingStateSignature = openingLightStateSignature(
    passageStates.map(({ opening, amount }) => ({
      id: opening.id,
      type: opening.type,
      contact: opening.contact,
      amount,
    })),
  );
  return {
    geometryFingerprint,
    fingerprint: contentFingerprint([geometryFingerprint, openingStateSignature]),
    polygons,
    passageStates,
  };
}

/**
 * Build the one canonical light transport scene after a caller-owned cache
 * miss. Full and static cards may supply different cache owners, never a
 * different barrier algorithm.
 */
export function buildLightBarrierScene(input: {
  space: SpaceModel;
  revision: LightBarrierRevision;
  walls: readonly WallEntry[];
  zeroWalls: LightZeroWalls;
  wallKeyPitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale: number;
  sharedWallGeometry?: SharedWallGeometry | null;
  physicalBodies: (partitionCuts: PartitionOpeningCut[], cacheKey: string) => number[][][];
}): LightBarrierScene {
  const { revision } = input;
  const cacheKey = `${input.space.id}|${revision.fingerprint}`;
  const outlineCuts: number[][] = [...input.zeroWalls.transmissive];
  const passages = revision.passageStates
    .filter(({ amount }) => amount > 0)
    .map(({ opening, amount }) => ({
      ...opening,
      rlen: openingLightApertureLength(opening.rlen, amount),
    }));
  const roomPassages = geometryRoomOpeningInputs(
    passages,
    input.space,
    [...input.walls],
    input.zeroWalls.contour,
    input.wallKeyPitch,
    input.cellCm,
    input.gridPitch,
    input.coordScale,
  );
  for (const opening of roomPassages) {
    const rad = (opening.angle * Math.PI) / 180;
    const dx = (Math.cos(rad) * opening.length) / 2;
    const dy = (Math.sin(rad) * opening.length) / 2;
    outlineCuts.push([
      opening.x - dx, opening.y - dy,
      opening.x + dx, opening.y + dy,
    ]);
  }
  const partitionCuts = revision.passageStates.flatMap(({ opening, amount }) =>
    amount > 0 && opening.partitionHost
      ? [scalePartitionOpeningCut(partitionOpeningCut(opening.partitionHost), amount)]
      : []);
  const opaqueBodies = input.physicalBodies(partitionCuts, cacheKey);
  const occluders: LightSegment[] = [];
  const sharedFingerprint = input.sharedWallGeometry?.sourceFingerprint;
  const recut = input.sharedWallGeometry
    && sharedFingerprint === revision.geometryFingerprint
    ? recutWallBodiesGeometry(input.sharedWallGeometry, roomPassages, opaqueBodies)
    : null;
  const masonry = recut || (input.walls.length || opaqueBodies.length
    ? wallBodiesGeometry(
        input.space.rooms,
        [...input.walls],
        input.zeroWalls.contour,
        roomPassages,
        input.wallKeyPitch,
        input.cellCm,
        input.gridPitch,
        input.coordScale,
        opaqueBodies,
      )
    : null);
  if (masonry && (masonry.status === 'ok' || masonry.status === 'degraded-extra')) {
    for (const component of masonry.components) {
      for (const ring of geometryAllRings(component.geom)) {
        occluders.push(...polygonSegments(ring));
      }
    }
  } else {
    for (const body of opaqueBodies) occluders.push(...polygonSegments(body));
  }
  const eps = input.gridPitch * 0.02;
  for (const { poly } of revision.polygons) {
    const segments = outlineCuts.length
      ? outlineWithout(poly, outlineCuts, eps)
      : polygonSegments(poly);
    for (const segment of segments) occluders.push(segment as LightSegment);
  }
  for (const barrier of input.zeroWalls.barriers) {
    occluders.push(barrier as LightSegment);
  }
  return {
    occluders: splitAtIntersections(occluders),
    floor: revision.polygons.map(({ poly }) => poly),
    fingerprint: revision.fingerprint,
    masonryGeometry: masonry && (masonry.status === 'ok' || masonry.status === 'degraded-extra')
      ? masonry.components.flatMap((component) => component.geom)
      : [],
    opaqueBodies,
  };
}

export function buildGlowClipGeometry(input: {
  spaceId: string;
  source: { x: number; y: number };
  radius: number;
  scene: LightBarrierScene;
  polygons: readonly LightRoomPolygon[];
  onBoundsFailure?: (roomId: string, phase: string) => void;
}): GlowClipGeometry {
  const seen = visibilityPolygon(
    [input.source.x, input.source.y], input.radius,
    input.scene.occluders, GLOW_ARC_STEPS,
  );
  return {
    lit: seen.length >= 3
      ? intersectionPaths([seen], input.scene.floor, {
          onBoundsFailure: ({ boundIndex, phase }) => {
            const room = input.polygons[boundIndex]?.room;
            input.onBoundsFailure?.(room?.id || `#${boundIndex}`, phase);
          },
        })
      : [],
  };
}

export function glowSourceInOpaqueBody(
  source: { x: number; y: number }, scene: LightBarrierScene,
): boolean {
  return pointInOpaquePlanBody(
    [source.x, source.y], scene.masonryGeometry, scene.opaqueBodies,
  );
}

function suspendGlowFeather(
  state: GlowRuntimeState, host: GlowRuntimeHost,
): void {
  if (host.reducedMotion()) return;
  const win = host.window();
  state.featherSuspendUntil = Math.max(
    state.featherSuspendUntil, Date.now() + GLOW_FADE_MS,
  );
  win.clearTimeout(state.featherResumeTimer);
  const resume = () => {
    state.featherResumeTimer = 0;
    if (Date.now() < state.featherSuspendUntil) {
      state.featherResumeTimer = win.setTimeout(
        resume, state.featherSuspendUntil - Date.now() + 17,
      );
      return;
    }
    state.featherSuspendUntil = 0;
    if (host.isConnected()) host.requestUpdate();
  };
  const delay = Math.max(0, state.featherSuspendUntil - Date.now()) + 17;
  state.featherResumeTimer = win.setTimeout(resume, delay);
}

export function transitionGlowSource(
  state: GlowRuntimeState,
  host: GlowRuntimeHost,
  key: string,
  active: boolean,
): { domId: number; entering: boolean; leaving: boolean } | null {
  const win = host.window();
  let domId = state.renderedSources.get(key);
  if (active) {
    const timer = state.fadeTimers.get(key);
    if (timer != null) {
      win.clearTimeout(timer);
      state.fadeTimers.delete(key);
    }
    if (domId == null) {
      suspendGlowFeather(state, host);
      domId = ++state.sourceSeq;
      state.renderedSources.set(key, domId);
      state.enteringSources.add(key);
      const raf = win.requestAnimationFrame(() => {
        if (state.enterRafs.get(key) !== raf) return;
        state.enterRafs.delete(key);
        state.enteringSources.delete(key);
        if (host.isConnected()) host.requestUpdate();
      });
      state.enterRafs.set(key, raf);
    }
    return { domId, entering: state.enteringSources.has(key), leaving: false };
  }
  if (domId == null) return null;
  const enterRaf = state.enterRafs.get(key);
  if (enterRaf != null) win.cancelAnimationFrame(enterRaf);
  state.enterRafs.delete(key);
  state.enteringSources.delete(key);
  if (!state.fadeTimers.has(key)) {
    suspendGlowFeather(state, host);
    const timer = win.setTimeout(() => {
      if (state.fadeTimers.get(key) !== timer) return;
      state.fadeTimers.delete(key);
      state.renderedSources.delete(key);
      state.lastAppearance.delete(key);
      if (host.isConnected()) host.requestUpdate();
    }, GLOW_FADE_MS + 34);
    state.fadeTimers.set(key, timer);
  }
  return { domId, entering: false, leaving: true };
}

export function forgetGlowSource(
  state: GlowRuntimeState, host: GlowRuntimeHost, key: string,
): void {
  const win = host.window();
  const timer = state.fadeTimers.get(key);
  const raf = state.enterRafs.get(key);
  if (timer != null) win.clearTimeout(timer);
  if (raf != null) win.cancelAnimationFrame(raf);
  state.fadeTimers.delete(key);
  state.enterRafs.delete(key);
  state.enteringSources.delete(key);
  state.renderedSources.delete(key);
  state.lastAppearance.delete(key);
}

export function forgetGlowSpace(
  state: GlowRuntimeState, host: GlowRuntimeHost, spaceId: string,
): void {
  const prefix = `${spaceId}|`;
  for (const key of [...state.renderedSources.keys()]) {
    if (key.startsWith(prefix)) forgetGlowSource(state, host, key);
  }
}

export function pruneGlowSources(
  state: GlowRuntimeState,
  host: GlowRuntimeHost,
  spaceId: string,
  seen: ReadonlySet<string>,
): void {
  const prefix = `${spaceId}|`;
  for (const key of [...state.renderedSources.keys()]) {
    if (key.startsWith(prefix) && !seen.has(key)) forgetGlowSource(state, host, key);
  }
}

export function disposeGlowRuntime(
  state: GlowRuntimeState, host: GlowRuntimeHost,
): void {
  const win = host.window();
  for (const timer of state.fadeTimers.values()) win.clearTimeout(timer);
  for (const raf of state.enterRafs.values()) win.cancelAnimationFrame(raf);
  win.clearTimeout(state.featherResumeTimer);
  state.clipCache.clear();
  state.geometryWarnings.clear();
  state.fadeTimers.clear();
  state.enterRafs.clear();
  state.enteringSources.clear();
  state.renderedSources.clear();
  state.lastAppearance.clear();
  state.featherUnits = null;
  state.featherSuspendUntil = 0;
  state.featherResumeTimer = 0;
  state.sourceSeq = 0;
}

export function warnGlowGeometryFallback(
  state: GlowRuntimeState,
  spaceId: string,
  fingerprint: string,
  roomId: string,
  phase: string,
): void {
  const key = `${spaceId}|${fingerprint}|${roomId}`;
  if (state.geometryWarnings.has(key)) return;
  if (state.geometryWarnings.size >= 128) {
    const oldest = state.geometryWarnings.values().next().value;
    if (oldest) state.geometryWarnings.delete(oldest);
  }
  state.geometryWarnings.add(key);
  console.warn(
    `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,
  );
}

export function resolveGlowFeather(
  state: GlowRuntimeState,
  perUnit: number,
  allowRefresh: boolean,
): { feather: number; enabled: boolean } {
  const next = GLOW_EDGE_FEATHER_PX / 2 / (perUnit > 0 ? perUnit : 1);
  const enabled = allowRefresh && Date.now() >= state.featherSuspendUntil;
  if (state.featherUnits == null || enabled) state.featherUnits = next;
  return { feather: state.featherUnits ?? next, enabled };
}

/** One shared SVG field: one circle and one clip per source, one layer blur. */
export function renderGlowPools(input: {
  spots: readonly GlowSpot[];
  enabledClip?: readonly string[] | null;
  feather: number;
  featherEnabled: boolean;
  screenBlend: boolean;
}): TemplateResult {
  if (!input.spots.length) return svg`` as unknown as TemplateResult;
  const pad = input.feather * 4;
  const featherBox = input.spots.reduce((box, spot) => ({
    x: Math.min(box.x, spot.pos.x - spot.r - pad),
    y: Math.min(box.y, spot.pos.y - spot.r - pad),
    maxX: Math.max(box.maxX, spot.pos.x + spot.r + pad),
    maxY: Math.max(box.maxY, spot.pos.y + spot.r + pad),
    w: 0,
    h: 0,
  }), { x: Infinity, y: Infinity, maxX: -Infinity, maxY: -Infinity, w: 0, h: 0 });
  featherBox.w = featherBox.maxX - featherBox.x;
  featherBox.h = featherBox.maxY - featherBox.y;
  const enabledClip = input.enabledClip?.length ? input.enabledClip : null;
  return svg`<defs>
      ${repeat(input.spots, (spot) => spot.key, (spot) => {
        const id = spot.domId;
        return svg`
          <radialGradient id="hp-glow-${id}" gradientUnits="userSpaceOnUse"
            cx="${spot.pos.x}" cy="${spot.pos.y}" r="${spot.r}">
            ${GLOW_FALLOFF.map(([offset, scale]) => svg`
              <stop offset="${offset}%" stop-color="${spot.c}"
                stop-opacity="${(spot.alpha * scale).toFixed(4)}"></stop>`)}
          </radialGradient>
          ${spot.geometry ? svg`
            <clipPath id="hp-glowclip-${id}">
              <path class="glow-lit" d="${spot.geometry.lit.join(' ')}"
                clip-rule="evenodd" fill-rule="evenodd"></path>
            </clipPath>` : nothing}`;
      })}
      ${enabledClip ? svg`<clipPath id="hp-glow-enabled">${enabledClip.map((d) => svg`
        <path d=${d} clip-rule="evenodd" fill-rule="evenodd"></path>`)}
      </clipPath>` : nothing}
      <filter id="hp-glowfeather" filterUnits="userSpaceOnUse"
        x="${featherBox.x}" y="${featherBox.y}"
        width="${featherBox.w}" height="${featherBox.h}"
        color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="${input.feather.toFixed(4)}" edgeMode="none"></feGaussianBlur>
      </filter>
    </defs>
    <g class="glowlayer glow-pools-frame" pointer-events="none" aria-hidden="true"
      filter=${input.featherEnabled ? 'url(#hp-glowfeather)' : nothing}>
      <g class="glow-pools ${input.screenBlend ? 'blend-screen' : 'blend-normal'}"
        data-blend=${input.screenBlend ? 'screen' : 'normal'}
        data-feather-px="${GLOW_EDGE_FEATHER_PX}"
        clip-path=${enabledClip ? 'url(#hp-glow-enabled)' : nothing}>
        ${repeat(input.spots, (spot) => spot.key, (spot) => svg`
          <g class="glow-spot ${spot.entering ? 'is-entering' : ''} ${spot.leaving ? 'is-leaving' : ''}"
            data-glow-spot="${spot.domId}" data-glow-source="${spot.sourceEid}">
            <circle class="glow-pool"
              cx="${spot.pos.x}" cy="${spot.pos.y}" r="${spot.r}"
              data-lit-parts="${spot.geometry?.lit.length || 0}"
              data-feather-px="${GLOW_EDGE_FEATHER_PX}"
              fill="url(#hp-glow-${spot.domId})"
              clip-path=${spot.geometry ? `url(#hp-glowclip-${spot.domId})` : nothing}></circle>
          </g>`)}
      </g>
    </g>` as unknown as TemplateResult;
}
