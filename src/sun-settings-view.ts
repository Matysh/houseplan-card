import type { TemplateResult } from 'lit';
import { field, segmented } from './editors/form-kit';
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
    control: segmented<SunRayOrigin>({
      name: 'gs-sun-ray-origin',
      value,
      ariaLabel: translate('gs.sun_ray_origin'),
      options: [
        { value: 'inner', label: translate('gs.sun_ray_origin.inner') },
        { value: 'outer', label: translate('gs.sun_ray_origin.outer') },
      ],
      onChange: (next) => changed(next === 'outer' ? 'outer' : 'inner'),
    }),
  });
}
