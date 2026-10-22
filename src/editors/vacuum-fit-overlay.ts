/** Manual fit renders genuine rooms or the verified raster map in one affine. */
import { html, nothing, svg, type TemplateResult } from 'lit';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { applyAffine, fitMatrix, readVacTelemetry, type Pt, type VacTelemetry } from '../vacuum';
import type { VacuumMapPreview } from '../vacuum-ecovacs-client';

export function vacuumFitBounds(tele: VacTelemetry | null, preview?: VacuumMapPreview, rectanglesOnly = false): number[] | null {
  const image = preview?.bounds || tele?.mapBounds;
  if (image) return [image[0], image[1], image[0] + image[2], image[1] + image[3]];
  const xs: number[] = [], ys: number[] = [];
  for (const room of tele?.rooms || []) {
    if (rectanglesOnly && room.x0 == null) continue;
    xs.push(room.x0 ?? room.cx, room.x1 ?? room.cx);
    ys.push(room.y0 ?? room.cy, room.y1 ?? room.cy);
  }
  return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
}

export function vacuumFitCentre(tele: VacTelemetry | null, preview?: VacuumMapPreview): Pt {
  const bounds = vacuumFitBounds(tele, preview);
  return bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : [0, 0];
}

export function renderVacuumFitOverlay(
  runtime: HouseplanEditorRuntime, view: { x: number; y: number; w: number; h: number },
): TemplateResult | typeof nothing {
  const host = runtime.host, fit = host._vacFit;
  if (!fit) return nothing;
  const current = readVacTelemetry(host._renderPlanHass?.states?.[fit.source]?.attributes);
  const tele = fit.preview && current?.mapId !== fit.mapId ? null : current;
  if (!tele && !fit.preview) return nothing;
  const matrix = fitMatrix(fit.p);
  const geometry: TemplateResult[] = [];
  if (fit.preview) {
    const [x, y, width, height] = fit.preview.bounds;
    geometry.push(svg`<image data-hp="vacuum-map-preview" href=${fit.preview.image}
      x=${x} y=${y} width=${width} height=${height} opacity="0.45" style="pointer-events:none"
      transform="matrix(${matrix[0]} ${matrix[3]} ${matrix[1]} ${matrix[4]} ${matrix[2]} ${matrix[5]})"/>`);
  } else for (const room of tele?.rooms || []) {
    if (room.x0 == null) continue;
    const corners = [[room.x0, room.y0!], [room.x1!, room.y0!], [room.x1!, room.y1!], [room.x0, room.y1!]]
      .map(([x, y]) => applyAffine(matrix, x, y));
    const [x, y] = applyAffine(matrix, room.cx, room.cy);
    geometry.push(svg`<polygon points=${corners.map(point => point.map(n => n.toFixed(1)).join(',')).join(' ')}></polygon>
      <text x=${x.toFixed(1)} y=${y.toFixed(1)}>${room.name}</text>`);
  }
  if (tele?.pos) {
    const [x, y] = applyAffine(matrix, tele.pos.x, tele.pos.y);
    geometry.push(svg`<circle class="vacfitdot" cx=${x.toFixed(1)} cy=${y.toFixed(1)} r=${(view.w * .012).toFixed(1)}></circle>`);
  }
  const bounds = vacuumFitBounds(tele, fit.preview, true);
  if (bounds) {
    const [x0, y0, x1, y1] = bounds;
    const points = [[x0, y0, x1, y1], [x1, y0, x0, y1], [x1, y1, x0, y0], [x0, y1, x1, y0]];
    for (const [x, y, fx, fy] of points) {
      const [hx, hy] = applyAffine(matrix, x, y), radius = view.w * .022;
      geometry.push(svg`<circle class="vacfithandle" data-corner=${`${fx},${fy}`}
        cx=${hx.toFixed(1)} cy=${hy.toFixed(1)} r=${radius.toFixed(1)}></circle>
        <circle class="vacfitknob" cx=${hx.toFixed(1)} cy=${hy.toFixed(1)} r=${(radius / 4).toFixed(2)}></circle>`);
    }
  }
  return html`<svg class="vacfit" data-hp="vacuum-calibration-step" data-step="manual" viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
    preserveAspectRatio="none"
    @pointerdown=${(event: PointerEvent) => runtime._vacFitPointer(event, view)}
    @pointermove=${(event: PointerEvent) => runtime._vacFitPointer(event, view)}
    @pointerup=${(event: PointerEvent) => runtime._vacFitPointer(event, view)}
    @pointercancel=${(event: PointerEvent) => runtime._vacFitPointer(event, view)}>${geometry}</svg>`;
}
