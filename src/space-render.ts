/**
 * Shared STATIC renderer for a single houseplan space — used by the read-only
 * `houseplan-space-card`. Draws exactly what is CONFIGURED (plan background,
 * configured room borders/names, device markers at their saved positions), with NO interactivity
 * (pointer-events:none) and NO state subscription; room fills are rendered exactly as
 * configured on the full card (a snapshot of the current states passed via `hass`).
 * Geometry/model math lives in space-geometry.ts (pure, unit-tested).
 */
import { html, svg, nothing, type TemplateResult } from 'lit';
import { buildDevices, areaLqi, areaLights, areaTemp } from './devices';
import { spaceDisplayOf, roomFillStyle, fillColorsOf, roomFillModeOf, stageBgOf } from './logic';
import { DEFAULT_ICON_RULES, compileIconRules, EXCLUDED_DOMAINS } from './rules';
import { t, type Lang } from './i18n';
import type { ServerConfig } from './types';
import {
  spaceModels, roomCenter, defaultPositions, markerPos, labelPos, type Layout,
} from './space-geometry';

export { spaceModels } from './space-geometry';

export interface StaticRenderOpts {
  hass: any;
  cfg: ServerConfig;
  layout: Layout;
  spaceId: string;
  iconSize?: number;
  lang: Lang;
  /**
   * Resolve a stored content url to what the DOM may actually request — the
   * plan lives behind `requires_auth`, so it needs an `authSig` signature.
   * Returning '' means "not signed yet": the caller must render no <image>
   * rather than an unsigned one, which would 401 (review R3-2).
   */
  displayUrl?: (raw: string) => string;
}

/**
 * Static schematic of one space. Returns the inner stage template (svg + marker
 * layer) or null when the space id is unknown (the caller renders an error card).
 */
export function renderSpaceStatic(o: StaticRenderOpts): TemplateResult | null {
  const models = spaceModels(o.cfg);
  const space = models.find((s) => s.id === o.spaceId);
  if (!space) return null;
  const vb = space.vb;
  const disp = spaceDisplayOf(o.cfg.spaces.find((s: any) => s.id === o.spaceId));
  const cfgSize = o.iconSize ?? 2.5;
  const iconPct = cfgSize > 8 ? 2.5 : cfgSize;

  const areaToSpace: Record<string, string> = {};
  for (const s of o.cfg.spaces || []) for (const r of (s as any).rooms || []) if (r.area) areaToSpace[r.area] = (s as any).id;
  const excluded = o.cfg.settings?.exclude_integrations ? new Set(o.cfg.settings.exclude_integrations) : EXCLUDED_DOMAINS;
  const iconRules = compileIconRules(
    o.cfg.settings?.icon_rules?.length ? o.cfg.settings.icon_rules : DEFAULT_ICON_RULES,
  );
  const loc = (k: 'device.unnamed' | 'device.light_group' | 'device.fallback' | 'device.virtual') => t(o.lang, k);
  const all = buildDevices({
    hass: o.hass,
    areaToSpace,
    markers: o.cfg.markers || [],
    settings: o.cfg.settings || {},
    excluded,
    showAll: !!o.cfg.settings?.show_all,
    firstSpaceId: models[0]?.id || '',
    loc,
    iconRules,
  });
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

  const roomShapes = space.rooms
    .filter((r) => r.area || disp.showBorders)
    .map((r) => {
      let cls = 'room ' + (space.bg ? 'overlay' : 'yard');
      let style = '';
      // tier 3 wins over the space, exactly as on the full card (HP-1454-07)
      const fill = roomFillModeOf(disp.fill, r);
      if (disp.showBorders || fill !== 'none') {
        cls += ' styled';
        const parts = [`--room-stroke:${disp.color}`, `--room-stroke-op:${disp.showBorders ? disp.opacity : 0}`];
        // fill rendered exactly as configured on the full card (snapshot of current states)
        const fillC = r.area
          ? roomFillStyle(
              fill,
              fill === 'lqi' ? areaLqi(o.hass, spaceDevs, r.area) : null,
              fill === 'light' ? areaLights(o.hass, spaceDevs, r.area) : 'none',
              fill === 'temp' ? areaTemp(o.hass, spaceDevs, r.area) : null,
              disp.tempMin,
              disp.tempMax,
              fillColorsOf(o.cfg?.settings),
            )
          : null;
        if (fillC) {
          cls += ' filled';
          parts.push(`--room-fill:${fillC.c}`, `--room-fill-op:${fillC.a.toFixed(3)}`);
        } else {
          parts.push('--room-fill:transparent', '--room-fill-op:0');
        }
        style = parts.join(';');
      }
      const svgLabel = !space.bg && !disp.showNames;
      const c = roomCenter(r);
      const shape = r.poly
        ? svg`<polygon class="${cls}" style="${style}" points="${r.poly.map((p) => p.join(',')).join(' ')}"></polygon>`
        : svg`<rect class="${cls}" style="${style}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"></rect>`;
      return svg`${shape}${svgLabel ? svg`<text class="rlabel" x="${c[0]}" y="${c[1]}">${r.name}</text>` : nothing}`;
    });

  const markers = devs.map((d) => {
    const p = markerPos(d, o.layout, o.cfg, defPos, space);
    const left = ((p.x - vb[0]) / vb[2]) * 100;
    const top = ((p.y - vb[1]) / vb[3]) * 100;
    // per-marker size and rotation, exactly as on the full card (HP-1513-01):
    // the same stored marker must look the same on both cards. Geometry only —
    // no live-state dressing here, the static card stays a schematic.
    const scale = Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1;
    const angle = Number(d.marker?.angle) || 0;
    const st = [`left:${left}%`, `top:${top}%`];
    if (scale !== 1) st.push(`--dev-scale:${scale}`);
    return html`<div class="dev ${d.virtual ? 'virtual' : ''}" style="${st.join(';')}">
      <ha-icon icon="${d.icon}" style=${angle ? `transform:rotate(${angle}deg)` : nothing}></ha-icon>
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
          return html`<div class="roomlabel" style="left:${left}%;top:${top}%;color:${disp.color};opacity:${op}">${r.name}</div>`;
        })
    : [];

  const bgHref = space.bg ? (o.displayUrl ? o.displayUrl(space.bg.href) : space.bg.href) : '';
  // the static card paints the same background around the plan as the full one
  const stageBg = stageBgOf(o.cfg?.settings, disp);

  return html`
    <div class="hp-static-stage" style="aspect-ratio:${vb[2]}/${vb[3]}${stageBg ? ';background:' + stageBg : ''}">
      <svg viewBox="${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}" preserveAspectRatio="xMidYMid meet">
        ${bgHref
          ? svg`<image href="${bgHref}" x="${space.bg!.x}" y="${space.bg!.y}" width="${space.bg!.w}" height="${space.bg!.h}" preserveAspectRatio="none" />`
          : nothing}
        ${roomShapes}
      </svg>
      <div class="devlayer" style="--icon-size:${iconPct}cqw">${markers}${labels}</div>
    </div>
  `;
}
