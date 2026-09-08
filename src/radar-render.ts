/** Pointer-transparent floor-level live presence rendering (#485). */
import { html, nothing, svg, type TemplateResult } from 'lit';
import type { RadarLiveFrame } from './radar-model';

export interface RadarRenderView { x: number; y: number; w: number; h: number }

export function renderRadarLive(
  frames: Iterable<RadarLiveFrame>,
  view: RadarRenderView,
  project: (point: readonly [number, number]) => readonly [number, number],
): TemplateResult | typeof nothing {
  const items = [...frames];
  if (!items.length) return nothing;
  const dots: TemplateResult[] = [];
  const arcs: TemplateResult[] = [];
  const zones: TemplateResult[] = [];
  for (const frame of items) {
    for (const zone of frame.zones) {
      const occupied = zone.state === true || typeof zone.state === 'number' && zone.state > 0;
      if (!occupied || !zone.polygon) continue;
      const projected = zone.polygon.map((point) => project([point[0] * 1000, point[1] * 1000]));
      zones.push(svg`<polygon class="radar-zone" data-radar-zone=${zone.id}
        points=${projected.map((point) => `${point[0]},${point[1]}`).join(' ')}></polygon>`);
    }
    for (const range of frame.ranges) {
      // An empty authoritative segment list means clipping removed the whole
      // arc. Never resurrect it with an unclipped client-side fallback.
      if (range.segments) {
        for (const segment of range.segments) {
          const projected = segment.map((point) => project([point[0] * 1000, point[1] * 1000]));
          arcs.push(svg`<polyline points=${projected.map((point) => `${point[0]},${point[1]}`).join(' ')}></polyline>`);
        }
      }
    }
    for (const target of frame.targets) {
      if (!target.included) continue;
      const point = project([target.x * 1000, target.y * 1000]);
      const left = ((point[0] - view.x) / view.w) * 100;
      const top = ((point[1] - view.y) / view.h) * 100;
      dots.push(html`<span class="radar-target ${target.smooth ? 'smooth' : ''}" data-radar-marker=${frame.marker_id}
        data-radar-slot=${target.slot} style="left:${left}%;top:${top}%"
        aria-hidden="true"></span>`);
    }
  }
  if (!arcs.length && !zones.length && !dots.length) return nothing;
  return html`${arcs.length || zones.length ? svg`<svg class="radar-ranges" data-hp-live-viewbox="camera"
      viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="none"
      aria-hidden="true">${zones}${arcs}</svg>` : nothing}${dots}`;
}
