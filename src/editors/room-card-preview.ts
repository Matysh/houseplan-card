import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from '../i18n';
import { roomCo2Text } from '../room-co2';

/** Editor/onboarding-only sample; never part of the cold View graph. */
export function roomCardPreview(
  t: (key: I18nKey, vars?: Record<string, string | number>) => string,
  name: string, spaceScale: number, nameScale: number, labelScale: number, co2?: number | null,
): TemplateResult {
  const base = 18 * spaceScale;
  return html`<div class="cardpreview">
    <span class="cpname" style="font-size:${(base * nameScale).toFixed(1)}px">
      ${name}</span>
    <span class="cpmeta" style="font-size:${(base * 0.62 * labelScale).toFixed(1)}px">
      <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
      <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
      ${co2 == null ? nothing : html`<span class="cpco2" aria-label=${t('roomcard.co2_label', { value: co2 })}
        ><ha-icon icon="mdi:molecule-co2"></ha-icon>${roomCo2Text(co2)}</span> ·`}
      <ha-icon icon="mdi:lightbulb-on"></ha-icon>${t('roomcard.light_partial', { on: 1, total: 3 })}
    </span>
  </div>`;
}
