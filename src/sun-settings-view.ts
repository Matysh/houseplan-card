import { html, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';
import type { SunRayOrigin } from './sun';

export function renderSunRayOriginSelect(
  value: SunRayOrigin,
  translate: (key: I18nKey) => string,
  changed: (value: SunRayOrigin) => void,
): TemplateResult {
  return html`<div class="colorrow gsrow">
    <span class="gsl"><label for="gs-sun-ray-origin">${translate('gs.sun_ray_origin')}</label></span>
    <select id="gs-sun-ray-origin" class="areasel"
      @change=${(event: Event) => changed(
        (event.target as HTMLSelectElement).value === 'outer' ? 'outer' : 'inner',
      )}>
      <option value="inner" ?selected=${value === 'inner'}>${translate('gs.sun_ray_origin.inner')}</option>
      <option value="outer" ?selected=${value === 'outer'}>${translate('gs.sun_ray_origin.outer')}</option>
    </select>
  </div>`;
}
