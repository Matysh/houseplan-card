/**
 * Shared STATIC renderer for a single houseplan space — used by the read-only
 * `houseplan-space-card`. Draws exactly what is CONFIGURED (plan background,
 * configured room borders/names, device markers at their saved positions), with NO interactivity
 * (pointer-events:none). The owning card supplies current HA states and witnessed activity;
 * device faces and room fills use the same semantic projection as the full plan.
 * Geometry/model math lives in space-geometry.ts (pure, unit-tested).
 */
import { html, svg, nothing, type TemplateResult } from 'lit';
import { buildDevices, areaLqi, areaTemp, resolvedLightSources, resolvedLightState } from './devices';
import {
  spaceDisplayOf, fillColorsOf, roomFillModeOf, roomGlowOf,
  roomCustomFillOf, resolveEffectiveRoomFill, stageBgOf, paperRoomShapes,
} from './logic';
import { wallBodiesUnionPath, wallBodyNeedsSolid, type WallEntry } from './wall-thickness';
import { DEFAULT_ICON_RULES, compileIconRules, EXCLUDED_DOMAINS } from './rules';
import { t, type Lang } from './i18n';
import { bgModeOf, northDegOf, sunStateOf, dayPhase } from './sun';
import type { DevItem, ServerConfig } from './types';
import { physicalBodies } from './physical-geometry';
import { activeRegistryHass, fullRegistryHass, type HaRegistrySnapshot } from './ha-binding-status';
import {
  resolveDevicePresentation, type PresentationActivityRuntime, type ResolvedDevicePresentation,
} from './device-presentation';
import { presentationSnapshotKey } from './render-device-snapshot';
import { deviceFaceStyle, renderDeviceFace } from './device-face';
import { valueBadgeTitle } from './device-value-badge';
import { contentFingerprint } from './visual-continuity';
import {
  spaceModels, roomCenter, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,
  GRID_STEP_N, GRID_PITCH,
  type Layout, type ContentItem,
} from './space-geometry';

export { spaceModels } from './space-geometry';

type StaticWallGeometry = ReturnType<typeof wallBodiesUnionPath>;
type StaticWallGeometryEntry = { fingerprint: string; value: StaticWallGeometry };
const staticWallGeometryCache = new WeakMap<object, Map<string, StaticWallGeometryEntry>>();

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

export interface StaticRenderOpts {
  hass: any;
  registry?: HaRegistrySnapshot;
  cfg: ServerConfig;
  layout: Layout;
  spaceId: string;
  iconSize?: number;
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
  const extras = physicalBodies(space, cellCm, GRID_PITCH);
  for (const body of extras) {
    const xs = body.map((p) => p[0]), ys = body.map((p) => p[1]);
    if (xs.length) placed.push({
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys),
    });
  }
  const fr = spaceFrame(space, placed);
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
        ? resolvedLightState(resolvedLightSources(planHass, spaceDevs, room))
        : 'none',
      fill === 'temp' && room.area ? areaTemp(planHass, spaceDevs, room.area) : null,
      disp.tempMin,
      disp.tempMax,
      colors,
      roomCustomFillOf(disp.customFill, room),
    )] as const;
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
        const parts = [`--room-stroke:${disp.color}`, `--room-stroke-op:${disp.showBorders ? disp.opacity : 0}`];
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

  // The compact card intentionally has no live radial pools, but it shares the
  // exact independent data/base projection with the full plan.
  const glowBaseShapes = space.rooms
    .filter((room) => {
      const fill = resolvedRoomFills.get(room);
      return roomGlowOf(disp.glow, room) && (!fill || fill.opacity <= 0);
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
  const staticSvgLabels = !space.bg && !disp.showNames
    ? space.rooms.map((room) => {
        const center = roomCenter(room);
        return svg`<text class="rlabel" data-hp="room-label"
          data-id=${room.id || nothing} data-area=${room.area || nothing}
          x=${center[0]} y=${center[1]}>${room.name}</text>`;
      })
    : [];

  const planLightSources = resolvedLightSources(planHass, devs);
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
    const deviceAriaLabel = [
      d.name,
      presentation.pulse.kind !== 'none'
        ? t(o.lang, (`marker.pulse_a11y_${presentation.pulse.reason}`) as any) : '',
      valueBadgeTitle(presentation.valueBadge),
    ].filter(Boolean).join(', ');
    return html`<div class="dev ${presentation.classes.join(' ')} ${d.virtual ? 'virtual' : ''} ${presentation.valueText != null ? 'valonly' : ''}"
      data-hp="device" data-id="${d.id}" data-entity=${d.primary || nothing} data-area=${d.area || nothing}
      aria-label=${deviceAriaLabel}
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
  // The static card paints the same background around the plan as the full
  // one. In 'daynight' mode (docs/SUN.md) the sun's elevation paints it —
  // wedges stay full-card-only in v1, the background alone follows the sky.
  const spaceSettings = (o.cfg.spaces.find((sp: any) => sp.id === o.spaceId) as any)?.settings || {};
  let sunBg = '';
  if (bgModeOf(o.cfg?.settings, spaceSettings) === 'daynight' && northDegOf(o.cfg?.settings, spaceSettings) !== null) {
    const sun = sunStateOf(o.hass);
    if (sun) sunBg = dayPhase(sun.elevation).bg;
  }
  const stageBg = sunBg || stageBgOf(o.cfg?.settings, disp);

  // Opaque plan paper, same contract as the full card (docs/BACKDROP.md §3):
  // the paper is ALWAYS the ROOM CONTOURS and only them — never their bounding
  // box, and (since v1.58.0) never the backdrop image rect either. The scene
  // colour therefore reaches the exterior walls of an L-shaped house, fills the
  // gaps between detached buildings, and an empty space has no paper at all,
  // image or no image. The picture is drawn ON the paper, one layer above.

  const needsCanonicalWallGeometry = !!(walls.length || (extras.length && disp.showBorders));
  const wallGeometryFingerprint = needsCanonicalWallGeometry
    ? contentFingerprint({ rooms: space.rooms, walls, extras, cellCm })
    : '';
  const canonicalWallGeometry = needsCanonicalWallGeometry
    ? cachedStaticWallGeometry(o.cfg, space.id, wallGeometryFingerprint, () => wallBodiesUnionPath(
      space.rooms, walls, [], [], GRID_STEP_N, cellCm, GRID_PITCH, NORM_W, extras,
    ))
    : null;
  const paperShapes = walls.length && canonicalWallGeometry?.paperD
    ? [{ path: canonicalWallGeometry.paperD }]
    : paperRoomShapes(space.rooms);
  const wallUnion = disp.showBorders ? canonicalWallGeometry : null;
  const pxPerUnit = o.stageWidth && vb[2] ? o.stageWidth / vb[2] : 1;
  const solidWall = !!wallUnion && wallBodyNeedsSolid(wallUnion.depthUnits, pxPerUnit);
  const wallStroke = disp.color || '#607d8b';

  return html`
    <div class="hp-static-stage" ?inert=${!!o.inert} style="aspect-ratio:${vb[2]}/${vb[3]}${stageBg ? ';background:' + stageBg : ''};--wall-fill:${colors.wall_fill.c};--wall-fill-op:${colors.wall_fill.a}">
      <svg viewBox="${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}" preserveAspectRatio="xMidYMid meet">
        ${wallUnion ? svg`<defs>
          <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse" width="8" height="8"
            patternTransform="rotate(45)">
            <path d="M0 0 L0 8" stroke="${wallStroke}" stroke-width="2"></path>
          </pattern>
        </defs>` : nothing}
        ${paperShapes.map((sh) =>
          'path' in sh
            ? svg`<path class="hp-paper" d="${sh.path}" fill-rule="evenodd"></path>`
          : 'poly' in sh
            ? svg`<polygon class="hp-paper" points="${sh.poly}"></polygon>`
            : svg`<rect class="hp-paper" x="${sh.rect.x}" y="${sh.rect.y}" width="${sh.rect.w}" height="${sh.rect.h}" rx="${sh.rect.rx}"></rect>`,
        )}
        ${bgHref
          ? svg`<image href="${bgHref}" x="${space.bg!.x}" y="${space.bg!.y}" width="${space.bg!.w}" height="${space.bg!.h}"
              @load=${() => o.assetLoaded?.(space.bg!.href, bgHref)}
              transform=${space.bg!.angle
                ? `rotate(${space.bg!.angle} ${space.bg!.x + space.bg!.w / 2} ${space.bg!.y + space.bg!.h / 2})`
                : nothing}
              preserveAspectRatio="none" />`
          : nothing}
        ${roomShapes}
        ${glowBaseShapes.length
          ? svg`<g class="glow-base-layer" aria-hidden="true" pointer-events="none">${glowBaseShapes}</g>`
          : nothing}
        <g class="room-svg-labels" pointer-events="none">${staticSvgLabels}</g>
        ${wallUnion
          ? svg`<g class="wallbodies" style="--room-stroke:${wallStroke}">
              <path class="wallbody-fill" d="${wallUnion.d}"
                fill="${colors.wall_fill.c}" fill-opacity="${colors.wall_fill.a}" fill-rule=${wallUnion.fillRule}
                stroke="none" pointer-events="none"></path>
              <path class="wallbody ${solidWall ? 'solid' : ''}" data-hp="wall" data-id="union" data-kind="union"
                d="${wallUnion.d}" fill="${solidWall ? 'none' : 'url(#hp-wall-hatch)'}" fill-rule=${wallUnion.fillRule}
                stroke="${wallStroke}" stroke-width="0.6" pointer-events="none"></path>
            </g>`
          : nothing}
      </svg>
      ${''/* docs/CANVAS.md §6: the same expression as the full card. The
             static card has no zoom, but its frame is the CONTENT now, so a
             bare `iconPct` would make markers shrink relative to the plan the
             tighter the frame got. `iconCqw` keeps the marker's footprint at
             iconPct% of the plan's base unit, which is what it was when the
             frame was the stored view_box. */}
      <div class="devlayer" style="--icon-size:${iconCqw(iconPct, space, vb[2]).toFixed(3)}cqw">${markers}${labels}</div>
    </div>
  `;
}
