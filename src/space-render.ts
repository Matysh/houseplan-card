/**
 * Shared STATIC renderer for a single houseplan space — used by the read-only
 * `houseplan-space-card`. Draws exactly what is CONFIGURED (plan background,
 * configured room borders/names, device markers at their saved positions), with
 * NO live states, NO status/temperature fills, and NO event handlers.
 * Geometry/model math lives in space-geometry.ts (pure, unit-tested).
 */
import { html, svg, nothing, type TemplateResult } from 'lit';
import { buildDevices } from './devices';
import { spaceDisplayOf } from './logic';
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
  const devs = all.filter((d) => d.space === o.spaceId);
  const defPos = defaultPositions(devs, space, iconPct);

  const roomShapes = space.rooms
    .filter((r) => r.area || disp.showBorders)
    .map((r) => {
      let cls = 'room ' + (space.bg ? 'overlay' : 'yard');
      let style = '';
      if (disp.showBorders || disp.fill !== 'none') {
        cls += ' styled';
        // STATIC: only the configured border; status fills (lqi/light/temp) are live and omitted
        style = `--room-stroke:${disp.color};--room-stroke-op:${disp.showBorders ? disp.opacity : 0};--room-fill:transparent;--room-fill-op:0`;
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
    return html`<div class="dev ${d.virtual ? 'virtual' : ''}" style="left:${left}%;top:${top}%">
      <ha-icon icon="${d.icon}"></ha-icon>
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

  return html`
    <div class="hp-static-stage" style="aspect-ratio:${vb[2]}/${vb[3]}">
      <svg viewBox="${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}" preserveAspectRatio="xMidYMid meet">
        ${space.bg
          ? svg`<image href="${space.bg.href}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}" preserveAspectRatio="none" />`
          : nothing}
        ${roomShapes}
      </svg>
      <div class="devlayer" style="--icon-size:${iconPct}cqw">${markers}${labels}</div>
    </div>
  `;
}
