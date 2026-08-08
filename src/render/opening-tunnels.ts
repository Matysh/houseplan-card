/**
 * Render-only projection of already-resolved opening tunnel geometry.
 *
 * Geometry association, cache invalidation and room-fill semantics stay with
 * their existing sources of truth. This module only maps immutable inputs to
 * the established SVG contract, which makes it the first HP-ARCH-01 render
 * seam without introducing a second model or a second state owner.
 */
import { nothing, svg, type TemplateResult } from 'lit';
import type { ResolvedRoomFill } from '../logic';
import type { OpeningCfg } from '../types';
import type { OpeningTunnelGeometry } from '../wall-thickness';

export type RenderOpening = OpeningCfg & { rx: number; ry: number; rlen: number };

export interface OpeningTunnelRenderInput {
  openings: readonly RenderOpening[];
  geometries: readonly (OpeningTunnelGeometry | null)[];
  fillsByRoomId: ReadonlyMap<string, ResolvedRoomFill | null>;
}

/** Preserve the existing `data-hp`, gradient-id and hard centreline contract. */
export function renderOpeningTunnelFills({
  openings,
  geometries,
  fillsByRoomId,
}: OpeningTunnelRenderInput): TemplateResult {
  const parts = openings.map((opening, index) => {
    const geometry = geometries[index];
    if (!geometry) return nothing;
    const negative = geometry.faces.find((face) => face.side === -1);
    const positive = geometry.faces.find((face) => face.side === 1);
    if (!negative || !positive) return nothing;
    const negFill = fillsByRoomId.get(negative.roomId) || null;
    const posFill = fillsByRoomId.get(positive.roomId) || null;
    if (!negFill && !posFill) return nothing;
    const d = `${negative.d} ${positive.d}`;
    const same = !!negFill && !!posFill
      && negFill.color === posFill.color && negFill.opacity === posFill.opacity;
    const transform = `translate(${opening.rx} ${opening.ry}) rotate(${opening.angle})`;
    if (same) {
      return svg`<path class="opening-tunnel" data-hp="opening-tunnel" data-id=${opening.id} data-kind=${opening.type}
        data-wall-key=${geometry.wallKey} aria-hidden="true" pointer-events="none"
        transform=${transform} d=${d} fill=${negFill!.color}
        fill-opacity=${negFill!.opacity}></path>`;
    }
    const span = geometry.maxY - geometry.minY;
    if (!(span > 0)) return nothing;
    const axis = Math.max(0, Math.min(1, -geometry.minY / span));
    const axisOffset = `${(axis * 100).toFixed(6)}%`;
    const nf = negFill || { color: '#000000', opacity: 0, mode: 'none' as const };
    const pf = posFill || { color: '#000000', opacity: 0, mode: 'none' as const };
    const gradientId = `hp-opening-tunnel-${index}`;
    return svg`<g class="opening-tunnel" data-hp="opening-tunnel" data-id=${opening.id} data-kind=${opening.type}
      data-wall-key=${geometry.wallKey} aria-hidden="true" pointer-events="none"
      transform=${transform}>
      <defs><linearGradient id=${gradientId} gradientUnits="userSpaceOnUse"
        x1="0" y1=${geometry.minY} x2="0" y2=${geometry.maxY}>
        <stop offset="0%" stop-color=${nf.color} stop-opacity=${nf.opacity}></stop>
        <stop offset=${axisOffset} stop-color=${nf.color} stop-opacity=${nf.opacity}></stop>
        <stop offset=${axisOffset} stop-color=${pf.color} stop-opacity=${pf.opacity}></stop>
        <stop offset="100%" stop-color=${pf.color} stop-opacity=${pf.opacity}></stop>
      </linearGradient></defs>
      <path d=${d} fill=${`url(#${gradientId})`} fill-rule="nonzero"></path>
    </g>`;
  });
  return svg`<g class="opening-tunnels" aria-hidden="true" pointer-events="none">${parts}</g>`;
}
