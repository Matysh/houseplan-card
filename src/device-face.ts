/** Shared icon/value/badge/activity DOM for every device surface. */
import { html, nothing, type TemplateResult } from 'lit';
import type { ResolvedDevicePresentation } from './device-presentation';

export interface DeviceFaceOptions {
  surface: 'interactive-plan' | 'preview' | 'static-card';
  newDevice?: boolean;
  newDeviceTitle?: string;
  disabledTitle?: string;
}

/** CSS variables owned by the face, independent of its coordinates/wrapper. */
export function deviceFaceStyle(presentation: ResolvedDevicePresentation): string[] {
  const out: string[] = [];
  if (presentation.scale !== 1) out.push(`--dev-scale:${presentation.scale}`);
  if (presentation.display === 'icon_ripple') {
    out.push(`--ripple-scale:${presentation.rippleScale}`);
    if (presentation.rippleColor) out.push(`--ripple-color:${presentation.rippleColor}`);
  }
  return out;
}

/**
 * Render only the face contents. The owning surface keeps coordinates,
 * pointer handlers, tooltip and selection semantics; this fragment is shared.
 */
export function renderDeviceFace(
  presentation: ResolvedDevicePresentation,
  options: DeviceFaceOptions,
): TemplateResult {
  const activity = presentation.activity;
  const gen2 = presentation.classes.includes('activity-gen2');
  return html`
    ${activity !== 'none'
      ? html`<span class="activity-ring ${activity} ${gen2 ? 'gen2' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`
      : nothing}
    ${options.newDevice
      ? html`<span class="newdot" title=${options.newDeviceTitle || ''} aria-hidden="true"></span>`
      : nothing}
    ${presentation.haDisabled
      ? html`<span class="habadge" title=${options.disabledTitle || ''} aria-hidden="true"><ha-icon icon="mdi:power-plug-off-outline"></ha-icon></span>`
      : nothing}
    ${presentation.valueText != null
      ? html`<span class="valtext" title=${presentation.valueFullText || presentation.valueText}
          aria-label=${presentation.valueFullText || presentation.valueText}>${presentation.valueText}</span>`
      : html`<ha-icon icon=${presentation.icon}
          style=${presentation.angle ? `transform:rotate(${presentation.angle}deg)` : nothing}></ha-icon>`}
    ${presentation.tempText != null && presentation.valueText == null
      ? html`<span class="tval">${presentation.tempText}°</span>` : nothing}
    ${presentation.humText != null && presentation.valueText == null
      ? html`<span class="hval">${presentation.humText}%</span>` : nothing}
    ${presentation.lqiText != null
      ? html`<span class="lqi" style=${presentation.lqiColor ? `color:${presentation.lqiColor}` : nothing}>${presentation.lqiText}</span>`
      : nothing}
  `;
}
