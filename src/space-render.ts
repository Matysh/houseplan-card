/**
 * Shared STATIC renderer for a single houseplan space — used by the read-only
 * `houseplan-space-card`. Draws exactly what is CONFIGURED (plan background,
 * configured room borders/names, device markers at their saved positions), with NO interactivity
 * (pointer-events:none). The owning card supplies current HA states and witnessed activity;
 * device faces and room fills use the same semantic projection as the full plan.
 * Geometry/model math lives in space-geometry.ts (pure, unit-tested).
 */
import { html, svg, nothing, type TemplateResult } from 'lit';
import {
  buildDevices, areaLqi, roomClimateKey, roomClimateMap, sourceValue,
  resolvedLightSources, resolvedLightState,
} from './devices';
import {
  spaceDisplayOf, fillColorsOf, roomFillModeOf, roomGlowOf,
  roomCustomFillOf, resolveEffectiveRoomFill, stageBgOf, paperRoomShapes,
  openingAmount, roomPoly, outlineWithout, islandsOf,
  type ResolvedRoomFill,
} from './logic';
import {
  openingTunnelGeometries, wallBodiesUnionPath, wallBodyNeedsSolid, wallHatchNeedsSolid,
  wallHatchStepUnits, wallIntervals, innerContourForRoom, HATCH_BASE_STEP_UNITS,
  type WallEntry,
} from './wall-thickness';
import { DEFAULT_ICON_RULES, compileIconRules, EXCLUDED_DOMAINS } from './rules';
import { t, type Lang } from './i18n';
import { bgModeOf, resolveDayCycle } from './sun';
import { dayCycleStageVars, renderDayCycleEnvironment } from './day-cycle-render';
import type { DevItem, OpeningCfg, ServerConfig } from './types';
import { floorMinusBodies, physicalBodyParts, polyclipPathD } from './physical-geometry';
import {
  materializePartitionOpening, partitionOpeningCut,
  partitionOpeningFace, partitionOpeningHasCompositeRoomWall, resolvePartitionOpeningCompat,
} from './partition-openings';
import {
  renderOpeningVisibleGeometry, type OpeningVisibleSpec,
} from './render/opening-symbol';
import { activeRegistryHass, fullRegistryHass, type HaRegistrySnapshot } from './ha-binding-status';
import {
  deviceA11yState, resolveDevicePresentation,
  type PresentationActivityRuntime, type ResolvedDevicePresentation,
} from './device-presentation';
import { presentationSnapshotKey } from './render-device-snapshot';
import { deviceFaceStyle, deviceThemeClass, renderDeviceFace } from './device-face';
import { effectiveDeviceBaseSize } from './device-marker-geometry';
import { valueBadgeTitle } from './device-value-badge';
import { contentFingerprint } from './visual-continuity';
import type { VirtualLightSnapshot } from './virtual-light-state';
import { renderOpeningTunnelFills } from './render/opening-tunnels';
import { gridVisualScale, gridVisualUnits } from './grid-scale';
import {
  spaceModels, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,
  GRID_STEP_N, GRID_PITCH, staticPassageOpenings,
  type Layout, type ContentItem,
} from './space-geometry';
import { resolveZeroWalls } from './zero-walls';
import { geometryOpenings } from './plan-geometry-preflight';
import {
  buildGlowClipGeometry, buildLightBarrierScene, forgetGlowSource, forgetGlowSpace,
  glowSourceInOpaqueBody, pruneGlowSources, readGlowClip, renderGlowPools,
  resolveGlowCandidates, resolveGlowFeather, resolveLightBarrierRevision,
  transitionGlowSource, warnGlowGeometryFallback, writeGlowClip,
  type GlowRuntimeHost, type GlowRuntimeState, type GlowSpot, type LightBarrierScene,
} from './glow-scene';

export { spaceModels } from './space-geometry';

type StaticWallGeometry = ReturnType<typeof wallBodiesUnionPath>;
type StaticWallGeometryEntry = { fingerprint: string; value: StaticWallGeometry };
const staticWallGeometryCache = new WeakMap<object, Map<string, StaticWallGeometryEntry>>();
type StaticPhysicalBodiesEntry = { fingerprint: string; value: number[][][] };
const staticPhysicalBodiesCache = new WeakMap<object, Map<string, StaticPhysicalBodiesEntry>>();
// #375: the scene cache is an LRU of 8 per space — parity with the full
// card's _lightBarrierPool. A single-entry cache made a door flipping
// open<->close rebuild the scene on every state change (fingerprint ping-pong).
const STATIC_LIGHT_BARRIER_LRU = 8;
const staticLightBarrierCache = new WeakMap<object, Map<string, Map<string, LightBarrierScene>>>();
// #375: enabledClip is rebuilt only when the geometry or the set of
// glow-disabled rooms changes; the full card keeps the analogous clean-floor
// LRU (600) — static cards need far fewer entries.
const STATIC_ENABLED_CLIP_LRU = 8;
const staticEnabledClipCache = new WeakMap<object, Map<string, Map<string, string[]>>>();

function lruGet<V>(cache: Map<string, V>, key: string): V | undefined {
  const value = cache.get(key);
  if (value !== undefined) { cache.delete(key); cache.set(key, value); }
  return value;
}

function lruSet<V>(cache: Map<string, V>, key: string, value: V, limit: number): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as string);
}

/** Static cards receive the same immutable server-config object on HA ticks. */
function cachedStaticWallGeometry(
  cfg: ServerConfig,
  spaceId: string,
  fingerprint: string,
  build: () => StaticWallGeometry,
): StaticWallGeometry {
  let spaces = staticWallGeometryCache.get(cfg as object);
  if (!spaces) {
    spaces = new Map<string, StaticWallGeometryEntry>();
    staticWallGeometryCache.set(cfg as object, spaces);
  }
  const cached = spaces.get(spaceId);
  if (cached?.fingerprint === fingerprint) return cached.value;
  const value = build();
  spaces.set(spaceId, { fingerprint, value });
  return value;
}

function cachedStaticPhysicalBodies(
  cfg: ServerConfig,
  spaceId: string,
  fingerprint: string,
  build: () => number[][][],
): number[][][] {
  let spaces = staticPhysicalBodiesCache.get(cfg as object);
  if (!spaces) {
    spaces = new Map<string, StaticPhysicalBodiesEntry>();
    staticPhysicalBodiesCache.set(cfg as object, spaces);
  }
  const cached = spaces.get(spaceId);
  if (cached?.fingerprint === fingerprint) return cached.value;
  const value = build();
  spaces.set(spaceId, { fingerprint, value });
  return value;
}

/** Exported for tests only (#375): the LRU behaviour is the contract. */
export function cachedStaticLightBarriers(
  cfg: ServerConfig,
  spaceId: string,
  fingerprint: string,
  build: () => LightBarrierScene,
): LightBarrierScene {
  let spaces = staticLightBarrierCache.get(cfg as object);
  if (!spaces) {
    spaces = new Map<string, Map<string, LightBarrierScene>>();
    staticLightBarrierCache.set(cfg as object, spaces);
  }
  let scenes = spaces.get(spaceId);
  if (!scenes) {
    scenes = new Map<string, LightBarrierScene>();
    spaces.set(spaceId, scenes);
  }
  const cached = lruGet(scenes, fingerprint);
  if (cached) return cached;
  const value = build();
  lruSet(scenes, fingerprint, value, STATIC_LIGHT_BARRIER_LRU);
  return value;
}

/** Exported for tests only (#375): reuse-by-identity is the contract. */
export function cachedStaticEnabledClip(
  cfg: ServerConfig,
  spaceId: string,
  key: string,
  build: () => string[],
): string[] {
  let spaces = staticEnabledClipCache.get(cfg as object);
  if (!spaces) {
    spaces = new Map<string, Map<string, string[]>>();
    staticEnabledClipCache.set(cfg as object, spaces);
  }
  let clips = spaces.get(spaceId);
  if (!clips) {
    clips = new Map<string, string[]>();
    spaces.set(spaceId, clips);
  }
  const cached = lruGet(clips, key);
  if (cached) return cached;
  const value = build();
  lruSet(clips, key, value, STATIC_ENABLED_CLIP_LRU);
  return value;
}

export interface StaticGlowRuntime {
  state: GlowRuntimeState;
  host: GlowRuntimeHost;
  screenBlend: boolean;
}

export interface StaticRenderOpts {
  hass: any;
  registry?: HaRegistrySnapshot;
  cfg: ServerConfig;
  layout: Layout;
  spaceId: string;
  iconSize?: number;
  /** Keep the normal side/bottom frame but let content meet the top edge. */
  compactTopFrame?: boolean;
  /** Measured CSS width of the static stage, used for screen-depth policies. */
  stageWidth?: number;
  lang: Lang;
  /** Optional roster prepared by the card so its activity runtime sees the same instances. */
  devices?: DevItem[];
  activityRuntime?: ReadonlyMap<string, PresentationActivityRuntime>;
  presentations?: ReadonlyMap<string, ResolvedDevicePresentation>;
  liveStates?: boolean;
  showTemperature?: boolean;
  showSignal?: boolean;
  reducedMotion?: boolean;
  /** Full radial Glow is opt-in; omitted/false preserves the cheap static path. */
  lightPools?: boolean;
  glowRuntime?: StaticGlowRuntime;
  /** Deterministic clock injection for unit/smoke fixtures; production omits it. */
  dayCycleNow?: Date | number;
  virtualLights?: VirtualLightSnapshot | null;
  /**
   * Resolve a stored content url to what the DOM may actually request — the
   * plan lives behind `requires_auth`, so it needs an `authSig` signature.
   * Returning '' means "not signed yet": the caller must render no <image>
   * rather than an unsigned one, which would 401 (review R3-2).
   */
  displayUrl?: (raw: string) => string;
  /** Marks a protected backdrop as loaded/paintable for continuity barriers. */
  assetLoaded?: (raw: string, paintedUrl: string) => void;
  /** Recovery overlay owns input while an atomic candidate is being painted. */
  inert?: boolean;
}

export interface StaticDeviceBuildOpts {
  hass: any;
  registry?: HaRegistrySnapshot;
  cfg: ServerConfig;
  lang: Lang;
}

/** Build the static card roster through the exact production device pipeline. */
export function buildSpaceDevices(o: StaticDeviceBuildOpts): DevItem[] {
  const models = spaceModels(o.cfg);
  const areaToSpace: Record<string, string> = {};
  for (const space of o.cfg.spaces || []) {
    for (const room of (space as any).rooms || []) {
      if (room.area) areaToSpace[room.area] = (space as any).id;
    }
  }
  const excluded = o.cfg.settings?.exclude_integrations
    ? new Set(o.cfg.settings.exclude_integrations) : EXCLUDED_DOMAINS;
  const iconRules = compileIconRules(
    o.cfg.settings?.icon_rules?.length ? o.cfg.settings.icon_rules : DEFAULT_ICON_RULES,
  );
  return buildDevices({
    hass: o.hass,
    registry: o.registry,
    areaToSpace,
    markers: o.cfg.markers || [],
    settings: o.cfg.settings || {},
    excluded,
    showAll: !!o.cfg.settings?.show_all,
    firstSpaceId: models[0]?.id || '',
    loc: (key) => t(o.lang, key),
    iconRules,
  });
}

/**
 * Static schematic of one space. Returns the inner stage template (svg + marker
 * layer) or null when the space id is unknown (the caller renders an error card).
 */
export function renderSpaceStatic(o: StaticRenderOpts): TemplateResult | null {
  const models = spaceModels(o.cfg);
  const space = models.find((s) => s.id === o.spaceId);
  if (!space) return null;
  const disp = spaceDisplayOf(o.cfg.spaces.find((s: any) => s.id === o.spaceId));
  const colors = fillColorsOf(o.cfg.settings);
  const cfgSize = o.iconSize ?? 2.5;
  const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
  const deviceBasePct = effectiveDeviceBaseSize(iconPct);

  const planHass = o.registry ? activeRegistryHass(o.hass, o.registry) : o.hass;
  const registryHass = o.registry ? fullRegistryHass(o.hass, o.registry) : o.hass;
  const all = o.devices || buildSpaceDevices(o);
  // Two lists, two jobs (HP-1510-01): AGGREGATION sees every device of the
  // space — hidden ones still count toward room LQI, same as the full card —
  // while RENDERING sees only the visible ones (there is no editor here, so
  // hidden devices are never drawn). Filtering one list for both jobs made
  // the same room show different Zigbee health on the two cards.
  const spaceDevs = all.filter((d) => d.space === o.spaceId);
  const devs = spaceDevs.filter((d) => !d.hidden);
  // The auto grid is computed over the FULL roster, hidden included — the
  // full card reserves grid cells for hidden devices (their ghosts keep a
  // place in the device editor), so the static card must too, or the same
  // visible marker with no saved position lands in different spots on the
  // two cards (HP-1511-01). Rendering still draws `devs` only.
  const defPos = defaultPositions(spaceDevs, space, iconPct);

  // Hosted Static uses the same room-aware automatic aggregate as the full
  // card. Build it once for the whole render: room labels/fills must never
  // rescan the registry or fall back to visible markers only (#317).
  const iconRules = compileIconRules(
    o.cfg.settings?.icon_rules?.length ? o.cfg.settings.icon_rules : DEFAULT_ICON_RULES,
  );
  const roomClimate = roomClimateMap(planHass, iconRules, o.cfg.markers || []);
  const roomTemperature = (room: typeof space.rooms[number]): number | null => {
    const source = room.settings?.temp_source;
    if (source) return sourceValue(planHass, source, 'temp', o.cfg.markers || []);
    const key = roomClimateKey(space.id, room);
    return key ? roomClimate.get(key)?.temp ?? null : null;
  };

  // docs/CANVAS.md §4: the static card frames the CONTENT, exactly like the
  // full one — `space.vb` is only the stored hint now, and on a plan drawn
  // past the old unit square it framed empty canvas with the house off-screen.
  // Markers placed outside every room count too (a gate sensor by the fence)
  // — but only the ones this card DRAWS: a hidden device is never painted
  // here, so it must not stretch the frame either (DEV-2C947-01). It keeps
  // its grid cell above; the frame is presentation, the roster is not.
  const placed: ContentItem[] = [];
  for (const d of devs) {
    const sv = o.layout[d.id];
    if (sv && sv.s === o.spaceId) {
      const x = sv.x * NORM_W, y = sv.y * NORM_W;
      placed.push({ minX: x, minY: y, maxX: x, maxY: y });
    }
  }
  const spCfg: any = o.cfg.spaces.find((s: any) => s.id === o.spaceId) || {};
  const walls: WallEntry[] = Array.isArray(spCfg.walls) ? spCfg.walls : [];
  const cellCm = Number(spCfg.cell_cm) > 0 ? Number(spCfg.cell_cm) : 5;
  const zeroWalls = resolveZeroWalls(spCfg, space, NORM_W, GRID_PITCH * 0.02);
  const resolvedHosted = (spCfg.openings || []).flatMap((opening: OpeningCfg) => {
    // Contour-wall hosts keep the same saved x/y/angle projection as legacy
    // room openings. Only independent partitions need to be materialised from
    // their host because that geometry is stored separately from the opening.
    if (opening.host?.kind !== 'partition') return [];
    const resolved = resolvePartitionOpeningCompat(
      opening, space.partitions, NORM_W, cellCm, GRID_PITCH,
    ).resolved;
    return resolved ? [resolved] : [];
  });
  const physicalFingerprint = contentFingerprint({
    partitions: space.partitions,
    roomDrafts: space.room_drafts,
    columns: space.wall_columns,
    cellCm,
    hostedOpenings: resolvedHosted.map((resolved) => ({
      id: resolved.opening.id, host: resolved.host,
      length: resolved.length, type: resolved.opening.type,
    })),
  });
  const extras = cachedStaticPhysicalBodies(
    o.cfg, space.id, physicalFingerprint,
    () => physicalBodyParts(
      space, cellCm, GRID_PITCH, GRID_PITCH * 0.0002,
      resolvedHosted.map(partitionOpeningCut),
    ).all,
  );
  for (const body of extras) {
    const xs = body.map((p) => p[0]), ys = body.map((p) => p[1]);
    if (xs.length) placed.push({
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys),
    });
  }
  for (const line of zeroWalls.lines) placed.push({
    minX: Math.min(line[0], line[2]), minY: Math.min(line[1], line[3]),
    maxX: Math.max(line[0], line[2]), maxY: Math.max(line[1], line[3]),
  });
  const fr = spaceFrame(space, placed, o.compactTopFrame
    ? { top: 0, right: 0.05, bottom: 0.05, left: 0.05 }
    : 0.05);
  const vb = [fr.x, fr.y, fr.w, fr.h];

  // Resolve once per room and reuse the exact result for the visible fill and
  // the Glow fallback. A selected data mode with no data is effectively empty
  // and therefore receives the same base darkness as explicit `none`.
  const resolvedRoomFills = new Map(space.rooms.map((room) => {
    const fill = roomFillModeOf(disp.fill, room);
    return [room, resolveEffectiveRoomFill(
      fill,
      fill === 'lqi' && room.area ? areaLqi(planHass, spaceDevs, room.area) : null,
      fill === 'light'
        ? resolvedLightState(resolvedLightSources(planHass, spaceDevs, room, o.virtualLights))
        : 'none',
      fill === 'temp' ? roomTemperature(room) : null,
      disp.tempMin,
      disp.tempMax,
      colors,
      roomCustomFillOf(disp.customFill, room),
    )] as const;
  }));
  const roomFillsById = new Map<string, ResolvedRoomFill | null>();
  for (const room of space.rooms) if (room.id) {
    roomFillsById.set(room.id, resolvedRoomFills.get(room) || null);
  }
  // Static intentionally keeps the historical door/window/gate wall output.
  // Only the new negative-space type participates in its masonry fingerprint.
  const resolvedRawOpenings = (spCfg.openings || []).flatMap((opening: OpeningCfg) => {
    if (!opening.host || opening.host.kind === 'wall') return [opening];
    const resolved = resolvedHosted.find((item) => item.opening.id === opening.id);
    return resolved ? [materializePartitionOpening(opening, resolved, NORM_W)] : [];
  });
  const staticPassages = staticPassageOpenings(resolvedRawOpenings, NORM_W);
  const roomIntervals = wallIntervals(
    space.rooms, walls, zeroWalls.contour, GRID_STEP_N, cellCm, GRID_PITCH, NORM_W,
  );
  const hostedCompositeOpenings = resolvedHosted
    .filter((resolved) => partitionOpeningHasCompositeRoomWall(
      resolved, roomIntervals, GRID_PITCH * 0.0002,
    ))
    .map((resolved) => ({
      x: resolved.center[0], y: resolved.center[1],
      angle: resolved.angle, length: resolved.length,
    }));

  const roomShapes = space.rooms
    .filter((r) => r.area || disp.showBorders || roomFillModeOf(disp.fill, r) !== 'none')
    .map((r) => {
      let cls = 'room ' + (space.bg ? 'overlay' : 'yard');
      let style = '';
      // tier 3 wins over the space, exactly as on the full card (HP-1454-07)
      const fill = roomFillModeOf(disp.fill, r);
      if (disp.showBorders || fill !== 'none') {
        cls += ' styled';
        const parts = [`--room-stroke:${disp.color}`, `--room-stroke-op:${
          disp.showBorders && !zeroWalls.contour.length ? disp.opacity : 0}`];
        // fill rendered exactly as configured on the full card (snapshot of current states)
        const fillC = resolvedRoomFills.get(r) || null;
        if (fillC) {
          cls += ' filled';
          parts.push(`--room-fill:${fillC.color}`, `--room-fill-op:${fillC.opacity.toFixed(3)}`);
        } else {
          parts.push('--room-fill:transparent', '--room-fill-op:0');
        }
        style = parts.join(';');
      }
      // docs/STYLING-HOOKS.md §3/§5: the static card carries the same hooks for
      // the objects it draws — a card-mod rule written for the plan reads here
      // too (in its own block: this is a different card, with its own root).
      const hpId = r.id || nothing;
      const hpArea = r.area || nothing;
      const shape = r.poly
        ? svg`<polygon class="${cls}" style="${style}" data-hp="room" data-id=${hpId} data-area=${hpArea}
            points="${r.poly.map((p) => p.join(',')).join(' ')}"></polygon>`
        : svg`<rect class="${cls}" style="${style}" data-hp="room" data-id=${hpId} data-area=${hpArea}
            x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"></rect>`;
      return shape;
    });

  // Base projection is independent of radial pools: opt-in pools are painted
  // above it through the same room-level Glow gates as the full plan.
  const glowEnabledRooms = space.rooms.filter((room) => roomGlowOf(disp.glow, room));
  const glowBaseShapes = glowEnabledRooms
    .filter((room) => {
      const fill = resolvedRoomFills.get(room);
      return !fill || fill.opacity <= 0;
    })
    .map((room) => room.poly
      ? svg`<polygon class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${room.id || nothing}
          points="${room.poly.map((point) => point.join(',')).join(' ')}"
          fill=${colors.glow_base.c} fill-opacity=${colors.glow_base.a}></polygon>`
      : svg`<rect class="glow-base" aria-hidden="true" pointer-events="none"
          data-room-id=${room.id || nothing}
          x=${room.x} y=${room.y} width=${room.w} height=${room.h}
          rx=${Math.min(room.w!, room.h!) * 0.03}
          fill=${colors.glow_base.c} fill-opacity=${colors.glow_base.a}></rect>`);
  const glowBaseFillsById = new Map<string, ResolvedRoomFill | null>();
  for (const room of space.rooms) if (room.id) {
    const fill = resolvedRoomFills.get(room) || null;
    glowBaseFillsById.set(room.id, roomGlowOf(disp.glow, room) && (!fill || fill.opacity <= 0)
      ? { color: colors.glow_base.c, opacity: colors.glow_base.a, mode: 'glow' }
      : null);
  }
  const planLightSources = resolvedLightSources(planHass, devs, null, o.virtualLights);
  const markers = devs.map((d) => {
    const p = markerPos(d, o.layout, o.cfg, defPos, space);
    const left = ((p.x - vb[0]) / vb[2]) * 100;
    const top = ((p.y - vb[1]) / vb[3]) * 100;
    const showLqi = disp.showLqi ?? (o.showSignal !== false);
    const presentation = o.presentations?.get(presentationSnapshotKey(d.id, showLqi))
      || resolveDevicePresentation(planHass, d, {
      liveStates: o.liveStates !== false,
      showTemperature: o.showTemperature !== false,
      showSignal: showLqi,
      activityRuntime: o.activityRuntime?.get(d.id),
      sourceDetails: false,
      lightDevices: devs,
      lightSources: planLightSources,
      registryHass,
      reducedMotion: o.reducedMotion,
    });
    const st = [`left:${left}%`, `top:${top}%`, ...deviceFaceStyle(presentation)];
    const a11yState = deviceA11yState(presentation);
    const deviceAriaLabel = [
      d.name,
      t(o.lang, (`marker.state_a11y_${a11yState}`) as any),
      presentation.pulse.kind !== 'none'
        ? t(o.lang, (`marker.pulse_a11y_${presentation.pulse.reason}`) as any) : '',
      presentation.valueFullText || presentation.valueText || '',
      valueBadgeTitle(presentation.valueBadge),
      presentation.lqiText != null && presentation.lqiBand
        ? t(o.lang, (`marker.lqi_a11y_${presentation.lqiBand}`) as any, {
            value: presentation.lqiText,
          }) : '',
    ].filter(Boolean).join(', ');
    return html`<div class="dev ${deviceThemeClass(planHass)} ${presentation.classes.join(' ')} ${d.virtual ? 'virtual' : ''} ${presentation.valueText != null ? 'valonly' : ''}"
      data-hp="device" data-id="${d.id}" data-entity=${d.primary || nothing} data-area=${d.area || nothing}
      role="img" aria-label=${deviceAriaLabel}
      data-state=${a11yState}
      data-lqi-band=${presentation.lqiText != null ? presentation.lqiBand || nothing : nothing}
      data-binding-status=${d.bindingStatus?.kind === 'ha_disabled' ? 'ha-disabled' : d.bindingStatus?.kind || 'active'}
      data-disabled-reason=${presentation.disabledReason ? presentation.disabledReason.replace('_', '-') : nothing}
      style="${st.join(';')}">
      ${renderDeviceFace(presentation, { surface: 'static-card' })}
    </div>`;
  });

  const labels = disp.showNames
    ? space.rooms
        .filter((r) => r.name)
        .map((r) => {
          const p = labelPos(r, space.id, o.layout, o.cfg);
          const left = ((p.x - vb[0]) / vb[2]) * 100;
          const top = ((p.y - vb[1]) / vb[3]) * 100;
          const op = Math.min(1, disp.opacity + 0.25);
          return html`<div class="roomlabel"
            data-hp="room-label" data-id=${r.id || nothing} data-area=${r.area || nothing}
            style="left:${left}%;top:${top}%;color:${disp.color};opacity:${op}">${r.name}</div>`;
        })
    : [];

  const bgHref = space.bg ? (o.displayUrl ? o.displayUrl(space.bg.href) : space.bg.href) : '';
  // The static card paints the same four-phase environment as full View.
  // Wedges stay full-card-only; the decorative background is independent.
  const spaceSettings = (o.cfg.spaces.find((sp: any) => sp.id === o.spaceId) as any)?.settings || {};
  const dayCycle = bgModeOf(o.cfg?.settings, spaceSettings) === 'daynight'
    ? resolveDayCycle(planHass, o.dayCycleNow ?? new Date()) : null;
  const stageBg = stageBgOf(o.cfg?.settings, disp);

  // Opaque plan paper, same contract as the full card (docs/BACKDROP.md §3):
  // the paper is ALWAYS the ROOM CONTOURS and only them — never their bounding
  // box, and (since v1.58.0) never the backdrop image rect either. The scene
  // colour therefore reaches the exterior walls of an L-shaped house, fills the
  // gaps between detached buildings, and an empty space has no paper at all,
  // image or no image. The picture is drawn ON the paper, one layer above.

  const needsCanonicalWallGeometry = !!(walls.length || (extras.length && disp.showBorders));
  const wallGeometryFingerprint = needsCanonicalWallGeometry
    ? contentFingerprint(staticPassages.length
      ? { rooms: space.rooms, walls, extras, cellCm, zero: zeroWalls.contour,
          passages: staticPassages.map((opening) => ({
          x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
        })), hostedCompositeOpenings }
      : { rooms: space.rooms, walls, extras, cellCm, zero: zeroWalls.contour })
    : '';
  const canonicalWallGeometry = needsCanonicalWallGeometry
    ? cachedStaticWallGeometry(o.cfg, space.id, wallGeometryFingerprint, () => {
      const built = wallBodiesUnionPath(
        space.rooms, walls, zeroWalls.contour, [
          ...staticPassages.filter((opening) => opening.host?.kind !== 'partition').map((opening) => ({
            x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
          })),
          ...hostedCompositeOpenings,
        ], GRID_STEP_N, cellCm, GRID_PITCH, NORM_W, extras,
      );
      // #375: the same non-enumerable tag the full card attaches
      // (houseplan-card.ts, _wallGeometryR): buildLightBarrierScene only takes
      // the fast recutWallBodiesGeometry path when this fingerprint matches
      // revision.geometryFingerprint — without the tag the static path always
      // rebuilt the wall bodies from scratch on a door state change.
      if (built) Object.defineProperty(built, 'sourceFingerprint', {
        value: contentFingerprint([spCfg, cellCm, GRID_PITCH]),
        enumerable: false,
      });
      return built;
    })
    : null;
  const passageTunnelGeometry = staticPassages.length && walls.length
    ? openingTunnelGeometries(
      space.rooms,
      staticPassages.map((opening) => ({
        x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
      })),
      walls, zeroWalls.contour, GRID_STEP_N, cellCm, GRID_PITCH, NORM_W,
    )
    : staticPassages.map(() => null);
  const passageDataTunnels = staticPassages.length
    ? renderOpeningTunnelFills({
      openings: staticPassages,
      geometries: passageTunnelGeometry,
      fillsByRoomId: roomFillsById,
      idPrefix: `${space.id}-static-data`,
      groupClass: 'opening-tunnels static-opening-tunnels',
      dataLayer: 'data',
    })
    : nothing;
  const passageGlowTunnels = staticPassages.length
    ? renderOpeningTunnelFills({
      openings: staticPassages,
      geometries: passageTunnelGeometry,
      fillsByRoomId: glowBaseFillsById,
      idPrefix: `${space.id}-static-glow`,
      groupClass: 'opening-tunnels glow-base-tunnels static-opening-tunnels',
      dataLayer: 'glow-base',
    })
    : nothing;
  const paperShapes = walls.length && canonicalWallGeometry?.paperD
    ? [{ path: canonicalWallGeometry.paperD }]
    : paperRoomShapes(space.rooms);
  const wallUnion = disp.showBorders ? canonicalWallGeometry : null;
  const pxPerUnit = o.stageWidth && vb[2] ? o.stageWidth / vb[2] : 1;
  // Same rule as the interactive card, from the same function: the two used to
  // drift apart at any zoom other than 1 (#230 §3).
  const hatchStep = wallHatchStepUnits(cellCm);
  const solidWall = !!wallUnion && (wallBodyNeedsSolid(wallUnion.depthUnits, pxPerUnit)
    || wallHatchNeedsSolid(hatchStep, pxPerUnit));
  const wallStroke = disp.color || '#607d8b';
  let glowPools: TemplateResult | typeof nothing = nothing;
  const glowRuntime = o.glowRuntime;
  if (!o.lightPools || !glowRuntime || !glowEnabledRooms.length) {
    if (glowRuntime) forgetGlowSpace(glowRuntime.state, glowRuntime.host, space.id);
  } else {
    const lightOpenings = geometryOpenings(spCfg, space, cellCm, GRID_PITCH, NORM_W);
    const revision = resolveLightBarrierRevision({
      rawSpaceConfig: spCfg,
      space,
      openings: lightOpenings,
      cellCm,
      gridPitch: GRID_PITCH,
      openingAmount: (opening) => {
        const entity = opening.contact ? planHass.states?.[opening.contact] : null;
        return openingAmount(
          opening.type, entity?.state, !!opening.invert,
          entity?.attributes?.current_position,
        );
      },
    });
    const scene = cachedStaticLightBarriers(
      o.cfg,
      space.id,
      revision.fingerprint,
      () => buildLightBarrierScene({
        space,
        revision,
        walls,
        zeroWalls,
        wallKeyPitch: GRID_STEP_N,
        cellCm,
        gridPitch: GRID_PITCH,
        coordScale: NORM_W,
        sharedWallGeometry: canonicalWallGeometry,
        physicalBodies: (partitionCuts) => physicalBodyParts(
          space, cellCm, GRID_PITCH, GRID_PITCH * 0.0002, partitionCuts,
        ).all,
      }),
    );
    const configuredRadius = Number(
      (o.cfg.settings as { glow_radius_cm?: unknown }).glow_radius_cm,
    );
    const defaultRadiusCm = Number.isFinite(configuredRadius) && configuredRadius > 0
      ? configuredRadius : 300;
    const candidates = resolveGlowCandidates({
      hass: planHass,
      devices: devs,
      virtualLights: o.virtualLights,
      spaceId: space.id,
      defaultColor: colors.glow_light.c,
      paletteAlpha: colors.glow_light.a,
      defaultRadiusUnits: (defaultRadiusCm / cellCm) * GRID_PITCH,
      cellCm,
      gridPitch: GRID_PITCH,
      position: (device) => markerPos(device, o.layout, o.cfg, defPos, space),
    });
    const seen = new Set<string>();
    const spots: GlowSpot[] = [];
    for (const candidate of candidates) {
      seen.add(candidate.key);
      if (glowSourceInOpaqueBody(candidate.pos, scene)) {
        forgetGlowSource(glowRuntime.state, glowRuntime.host, candidate.key);
        continue;
      }
      const transition = transitionGlowSource(
        glowRuntime.state, glowRuntime.host,
        candidate.key, !!candidate.appearance,
      );
      if (!transition) continue;
      if (candidate.appearance) {
        glowRuntime.state.lastAppearance.set(candidate.key, candidate.appearance);
      }
      const appearance = glowRuntime.state.lastAppearance.get(candidate.key);
      if (!appearance) continue;
      const clipKey = `${space.id}|${scene.fingerprint}|${candidate.pos.x.toFixed(4)},${candidate.pos.y.toFixed(4)}|${candidate.radius.toFixed(4)}`;
      const cachedClip = readGlowClip(glowRuntime.state, clipKey);
      const geometry = cachedClip.hit ? cachedClip.value : buildGlowClipGeometry({
        spaceId: space.id,
        source: candidate.pos,
        radius: candidate.radius,
        scene,
        polygons: revision.polygons,
        onBoundsFailure: (roomId, phase) => warnGlowGeometryFallback(
          glowRuntime.state, space.id, scene.fingerprint, roomId, phase,
        ),
      });
      if (!cachedClip.hit) writeGlowClip(glowRuntime.state, clipKey, geometry);
      spots.push({
        key: candidate.key,
        sourceEid: candidate.sourceEid,
        domId: transition.domId,
        entering: transition.entering,
        leaving: transition.leaving,
        pos: candidate.pos,
        c: appearance.c,
        alpha: appearance.alpha,
        geometry,
        r: candidate.radius,
      });
    }
    pruneGlowSources(glowRuntime.state, glowRuntime.host, space.id, seen);
    if (spots.length) {
      const allEnabled = glowEnabledRooms.length === revision.polygons.length;
      // #375: the clip depends only on the geometry (revision.geometryFingerprint
      // covers spCfg) and on WHICH rooms have glow disabled — not on entity
      // states. Cache it instead of recomputing boolean geometry every hass tick.
      const enabledClipKey = `${revision.geometryFingerprint}|${
        space.rooms.filter((room) => !glowEnabledRooms.includes(room))
          .map((room) => room.id || `#${space.rooms.indexOf(room)}`).sort().join(',')}`;
      const enabledClip = allEnabled ? null : cachedStaticEnabledClip(
        o.cfg, space.id, enabledClipKey, () => glowEnabledRooms.flatMap((room) => {
          const poly = roomPoly(room);
          if (!poly) return [];
          const floorPoly = walls.length && room.id
            ? (innerContourForRoom(
                space.rooms, room.id, walls, zeroWalls.contour,
                GRID_STEP_N, cellCm, GRID_PITCH, NORM_W,
                canonicalWallGeometry?.roomGeom,
                canonicalWallGeometry?.multiWallNodes,
              ) || poly)
            : poly;
          // #375: bbox prefilter, same as the full card's clean-floor cache —
          // bodies entirely outside the room's bounding box cannot cut it.
          const xs = floorPoly.map((point: number[]) => point[0]);
          const ys = floorPoly.map((point: number[]) => point[1]);
          const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          const bodies = extras.filter((body) => {
            const bx = body.map((point: number[]) => point[0]);
            const by = body.map((point: number[]) => point[1]);
            return Math.max(...bx) >= box[0] && Math.min(...bx) <= box[2]
              && Math.max(...by) >= box[1] && Math.min(...by) <= box[3];
          });
          const cleanGeometry = bodies.length ? floorMinusBodies(floorPoly, bodies) : null;
          const clean = cleanGeometry ? polyclipPathD(cleanGeometry) : '';
          const holes = islandsOf(
            floorPoly,
            revision.polygons
              .filter(({ room: other }) => other !== room)
              .map(({ poly: other }) => other),
          );
          const path = (points: number[][]) =>
            `M ${points.map((point) => `${point[0]} ${point[1]}`).join(' L ')} Z`;
          return [[clean || path(floorPoly), ...holes.map(path)].join(' ')];
        }),
      );
      const feather = resolveGlowFeather(
        glowRuntime.state,
        o.stageWidth && vb[2] ? o.stageWidth / vb[2] : 1,
        true,
      );
      glowPools = renderGlowPools({
        spots,
        enabledClip,
        feather: feather.feather,
        featherEnabled: feather.enabled,
        screenBlend: glowRuntime.screenBlend,
      });
    }
  }
  const hostedOpeningSymbols = disp.hideOpenings ? [] : resolvedHosted.map((resolved) => {
    const opening = resolved.opening;
    const entity = opening.type === 'passage' || !opening.contact
      ? null : planHass.states?.[opening.contact];
    const amount = openingAmount(
      opening.type, entity?.state, !!opening.invert, entity?.attributes?.current_position,
    );
    const active = amount > 0 && !!opening.contact;
    const faceFlipV = opening.type === 'gate' ? !opening.flip_v : !!opening.flip_v;
    const spec: OpeningVisibleSpec = {
      type: opening.type,
      length: resolved.length,
      angle: resolved.angle,
      amount,
      flipH: !!opening.flip_h,
      flipV: !!opening.flip_v,
      base: wallStroke,
      tone: active ? 'var(--hp-open)' : wallStroke,
      cellCm,
      gridPitch: GRID_PITCH,
      face: partitionOpeningFace(resolved, faceFlipV),
    };
    return svg`<g class="opening static-opening" data-hp="opening"
      data-id=${opening.id} data-kind=${opening.type} pointer-events="none"
      transform="translate(${resolved.center[0]} ${resolved.center[1]}) rotate(${resolved.angle})">
      ${renderOpeningVisibleGeometry(spec)}
    </g>`;
  });

  return html`
    <div class="hp-static-stage${dayCycle ? ` daycycle phase-${dayCycle.phase}` : ''}"
      ?inert=${!!o.inert}
      style="aspect-ratio:${vb[2]}/${vb[3]}${stageBg ? ';background:' + stageBg : ''};--hp-cell-visual-scale:${gridVisualScale(cellCm)};--wall-fill:${colors.wall_fill.c};--wall-fill-op:${colors.wall_fill.a}${dayCycle ? `;${dayCycleStageVars(dayCycle)}` : ''}">
      ${renderDayCycleEnvironment(dayCycle)}
      <svg viewBox="${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}" preserveAspectRatio="xMidYMid meet">
        ${wallUnion ? svg`<defs>
          <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse"
            width="${hatchStep}" height="${hatchStep}" patternTransform="rotate(45)">
            <path d="M0 0 L0 ${hatchStep}" stroke="${wallStroke}"
              stroke-width="${2 * (hatchStep / HATCH_BASE_STEP_UNITS)}"></path>
          </pattern>
        </defs>` : nothing}
        <g class="hp-paperg">${paperShapes.map((sh) =>
          'path' in sh
            ? svg`<path class="hp-paper" d="${sh.path}" fill-rule="evenodd"></path>`
          : 'poly' in sh
            ? svg`<polygon class="hp-paper" points="${sh.poly}"></polygon>`
            : svg`<rect class="hp-paper" x="${sh.rect.x}" y="${sh.rect.y}" width="${sh.rect.w}" height="${sh.rect.h}" rx="${sh.rect.rx}"></rect>`,
        )}</g>
        ${bgHref
          ? svg`<image href="${bgHref}" x="${space.bg!.x}" y="${space.bg!.y}" width="${space.bg!.w}" height="${space.bg!.h}"
              @load=${() => o.assetLoaded?.(space.bg!.href, bgHref)}
              transform=${space.bg!.angle
                ? `rotate(${space.bg!.angle} ${space.bg!.x + space.bg!.w / 2} ${space.bg!.y + space.bg!.h / 2})`
                : nothing}
              preserveAspectRatio="none" />`
          : nothing}
        ${roomShapes}
        ${disp.showBorders && zeroWalls.contour.length
          ? svg`<g class="room-outlines" aria-hidden="true" pointer-events="none">
              ${space.rooms.map((room) => {
                const poly = roomPoly(room);
                if (!poly) return nothing;
                const segments = outlineWithout(poly, zeroWalls.contour, GRID_PITCH * 0.02);
                return svg`<path class="room-outline" fill="none" stroke=${disp.color}
                  stroke-opacity=${disp.opacity}
                  stroke-width=${gridVisualUnits(2.5, cellCm)}
                  d=${segments.map((line) => `M ${line[0]} ${line[1]} L ${line[2]} ${line[3]}`).join(' ')}></path>`;
              })}
            </g>`
          : nothing}
        ${passageDataTunnels}
        ${glowBaseShapes.length
          ? svg`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${glowBaseShapes}</g>`
          : nothing}
        ${passageGlowTunnels}
        ${glowPools}
        ${wallUnion
          ? svg`<g class="wallbodies" style="--room-stroke:${wallStroke}">
              ${wallUnion.paths.map((component) => svg`
                <path class="wallbody-fill" data-component=${component.id} d="${component.d}"
                  fill="${colors.wall_fill.c}" fill-opacity="${colors.wall_fill.a}"
                  fill-rule=${component.fillRule} stroke="none" pointer-events="none"></path>
                <path class="wallbody ${solidWall ? 'solid' : ''}"
                  data-hp="wall" data-id="union" data-kind="union" data-component=${component.id}
                  d="${component.d}" fill="${solidWall ? 'none' : 'url(#hp-wall-hatch)'}"
                  fill-rule=${component.fillRule} stroke="${wallStroke}"
                  stroke-width="${gridVisualUnits(0.6, cellCm)}" pointer-events="none"></path>`)}
            </g>`
          : nothing}
        ${disp.showBorders && zeroWalls.lines.length
          ? svg`<g class="zero-walls ${zeroWalls.style}"
              data-zero-wall-style=${zeroWalls.style} aria-hidden="true" pointer-events="none">
              ${zeroWalls.lines.map((line) => svg`<line class="zero-wall"
                x1=${line[0]} y1=${line[1]} x2=${line[2]} y2=${line[3]}
                stroke=${wallStroke} stroke-width=${gridVisualUnits(2.5, cellCm)}
                stroke-dasharray=${zeroWalls.style === 'dashed'
                  ? `${gridVisualUnits(7, cellCm)} ${gridVisualUnits(7, cellCm)}` : nothing}></line>`)}
            </g>`
          : nothing}
        ${hostedOpeningSymbols}
      </svg>
      ${''/* docs/CANVAS.md §6: the same expression as the full card. The
             static card has no zoom, but its frame is the CONTENT now, so a
             bare `iconPct` would make markers shrink relative to the plan the
             tighter the frame got. `iconCqw` keeps the resolved device base
             proportional to the plan's base unit, as it was when the frame
             was the stored view_box. */}
      <div class="devlayer" style="--icon-size:${iconCqw(iconPct, space, vb[2]).toFixed(3)}cqw;--device-base-size:${iconCqw(deviceBasePct, space, vb[2]).toFixed(3)}cqw">${markers}${labels}</div>
    </div>
  `;
}
