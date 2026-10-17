import { html, svg, type TemplateResult } from 'lit';
import { field, selectControl } from './editors/form-kit';
import type { I18nKey } from './i18n';
import type { SunRayOrigin } from './sun';

/**
 * Источник солнечных лучей — сегмент из двух вариантов (#600 §5.1 вместо
 * `<select>`). Значение и ключ прежние: `sunRayOrigin` ∈ inner | outer.
 */
export function renderSunRayOriginSegment(
  value: SunRayOrigin,
  translate: (key: I18nKey) => string,
  changed: (value: SunRayOrigin) => void,
): TemplateResult {
  return field({
    label: translate('gs.sun_ray_origin'),
    control: html`${selectControl<SunRayOrigin>({
      name: 'gs-sun-ray-origin',
      value,
      ariaLabel: translate('gs.sun_ray_origin'),
      options: [
        { value: 'inner', label: translate('gs.sun_ray_origin.inner') },
        { value: 'outer', label: translate('gs.sun_ray_origin.outer') },
      ],
      onChange: (next) => changed(next === 'outer' ? 'outer' : 'inner'),
    })}<div class="hpf-ray-examples">${(['outer', 'inner'] as const).map(origin => html`
      <figure class=${origin === value ? 'is-selected' : ''}>
        <svg viewBox="0 0 180 130" role="img" aria-label=${translate(`gs.sun_ray_origin.${origin}`)}>
          <rect x="4" y="68" width="172" height="57" fill="var(--hpf-canvas)" />
          ${svg`<polygon points=${origin === 'outer' ? '64,40 104,40 104,68 137.529,125 114,125' : '64,68 104,68 137.529,125 97.529,125'} fill="var(--warning-color,#f0a00c)" opacity=".35" />`}
          <path d="M4 40H64V68H4ZM104 40H176V68H104Z" fill="var(--secondary-text-color)" opacity=".65" />
          <path d="M64 54H104" stroke="var(--primary-color)" stroke-width="3" />
          ${svg`<circle cx="64" cy=${origin === 'outer' ? 40 : 68} r="3.5" fill="var(--primary-color)" />
            <circle cx="104" cy=${origin === 'outer' ? 40 : 68} r="3.5" fill="var(--primary-color)" />`}
        </svg>
        <figcaption>${translate(`gs.sun_ray_origin.${origin}`)}</figcaption>
      </figure>`)}</div>`,
  });
}
