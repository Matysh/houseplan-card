import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from '../i18n';
import { roomCo2Text } from '../room-co2';

/** Editor/onboarding-only sample; never part of the cold View graph. */
export function roomCardPreview(
  t: (key: I18nKey, vars?: Record<string, string | number>) => string,
  name: string, spaceScale: number, nameScale: number, labelScale: number, co2?: number | null, labelSpaceScale = spaceScale,
  metrics?: {temp:boolean; hum:boolean; lqi:boolean; light:boolean; showName:boolean},
): TemplateResult {
  const base = (metrics ? 16 : 18) * spaceScale;
  return html`<div class="cardpreview">
    <span class="cpname" style="font-size:${(base * nameScale).toFixed(1)}px">
      ${metrics?.showName === false ? nothing : name}</span>
    <span class="cpmeta" style="font-size:${((metrics ? 12 : 18 * 0.62) * labelSpaceScale * labelScale).toFixed(1)}px">
      ${!metrics || metrics.temp ? html`<span><ha-icon icon="mdi:thermometer"></ha-icon>${metrics ? '22.4 °C' : '22.4°'}</span>` : nothing}
      ${!metrics || metrics.hum ? html`<span><ha-icon icon="mdi:water-percent"></ha-icon>45%</span>` : nothing}
      ${co2 == null ? nothing : html`<span class="cpco2" aria-label=${t('roomcard.co2_label', { value: co2 })}
        >${metrics ? 'CO₂ ' : html`<ha-icon icon="mdi:molecule-co2"></ha-icon>`}${roomCo2Text(co2)}</span>`}
      ${metrics?.lqi ? html`<span><ha-icon icon="mdi:zigbee"></ha-icon>148</span>` : nothing}
      ${!metrics || metrics.light ? html`<span><ha-icon icon="mdi:lightbulb-on"></ha-icon>${t('roomcard.light_partial', { on:1,total:3 })}</span>` : nothing}
    </span>
  </div>`;
}
