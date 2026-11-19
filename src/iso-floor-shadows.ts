import { svg, type TemplateResult } from 'lit';
import { deviceTextScale, legacySupplementalMetrics } from './device-face';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { IsoOverlayPlacement } from './iso-overlays';
import { isoFloorMatrix, type IsoCamera } from './iso-projection';

export type IsoFloorShadow = { diameter: number; camera?: IsoCamera };
type FloorAnchor = Pick<IsoOverlayPlacement, 'floorScene'>;

/** Shared penumbra. Each shadow is ordinary SVG geometry on the floor plane. */
export const isoFloorShadowGradient = svg`<radialGradient id="hp-iso-marker-penumbra">
  <stop offset="0" stop-color="#1c2026" stop-opacity=".37"></stop>
  <stop offset=".43" stop-color="#1c2026" stop-opacity=".32"></stop>
  <stop offset=".71" stop-color="#1c2026" stop-opacity=".13"></stop>
  <stop offset="1" stop-color="#1c2026" stop-opacity="0"></stop>
</radialGradient>`;

function shadowPlane(placement: FloorAnchor, camera?: IsoCamera): string {
  const [x, y] = placement.floorScene;
  if (!camera) return `translate(${x} ${y})`;
  const [a, b, c, d] = isoFloorMatrix(camera);
  return `matrix(${a} ${b} ${c} ${d} ${x} ${y})`;
}

function penumbra(width: number, height: number, core: number, x = 0, y = 0): TemplateResult {
  return svg`<ellipse cx=${x} cy=${y} rx=${width * .5 + core * .21}
    ry=${height * .5 + core * .21} fill="url(#hp-iso-marker-penumbra)"></ellipse>`;
}

function textWidth(text: string, fullText: string, pad: number): number {
  return [...text].length * .62 * deviceTextScale(fullText || text) + pad;
}

export function renderIsoMarkerFloorShadow(
  owner: string,
  kind: 'device' | 'opening-lock',
  placement: FloorAnchor,
  shadow: IsoFloorShadow,
  presentation?: ResolvedDevicePresentation,
): TemplateResult {
  const core = shadow.diameter;
  const value = presentation?.valueText;
  const width = value == null ? core : core * Math.max(1, textWidth(value, presentation?.valueFullText || value, .32));
  const badge = presentation?.valueBadge;
  const badges = badge ? [Math.max(.7875, textWidth(badge.text, badge.fullText || badge.text, .28)) * core]
    : presentation ? legacySupplementalMetrics(presentation).map(({text, suffix}) =>
      Math.max(.7875, textWidth(text + suffix, text + suffix, .28)) * core) : [];
  const position = badge?.position ?? 'right';
  const side = position === 'left' || position === 'right';
  const direction = position === 'left' || position === 'top' ? -1 : 1;
  const height = .7875 * core;
  const gap = .1 * core;
  let x = -(badges.reduce((sum, entry) => sum + entry + gap, -gap)) * .5;
  return svg`<g class="iso-tile-shadow" data-shadow-of=${owner} data-shadow-kind=${kind}
    aria-hidden="true" pointer-events="none" transform=${shadowPlane(placement, shadow.camera)}>
    ${penumbra(width, core, core, (width - core) * .5)}
    ${badges.map((entry, i) => {
      const paint = side
        ? penumbra(entry, height, core,
          direction * ((direction > 0 ? width - core * .5 : core * .5) + gap + entry * .5),
          (i - (badges.length - 1) * .5) * (height + gap))
        : penumbra(entry, height, core, x + entry * .5, direction * (core * .5 + gap + height * .5));
      x += entry + gap;
      return paint;
    })}
  </g>`;
}

export function renderIsoLabelFloorShadow(owner: string, placement: FloorAnchor, camera: IsoCamera | undefined,
  name: string, metrics: readonly string[], nameFont: number, metricFont: number, opacity: number,
): TemplateResult {
  const [a] = camera ? isoFloorMatrix(camera) : [1];
  return svg`<g class="iso-room-label-shadow" data-room-shadow-of=${owner} pointer-events="none"
    aria-hidden="true" transform=${shadowPlane(placement, camera)} fill="#1c2026" opacity=${opacity * .3}>
    <g transform=${a < 0 ? 'rotate(180)' : ''} text-anchor="middle">
      <text font-weight="700" dominant-baseline="central" font-size=${nameFont}>${name}</text>
      ${metrics.length ? svg`<text font-weight="600" y=${nameFont * .75 + metricFont * .5}
        dominant-baseline="central" font-size=${metricFont}>${metrics.join('  ')}</text>` : ''}
    </g>
  </g>`;
}
