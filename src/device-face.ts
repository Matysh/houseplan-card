/** Shared icon/value/badge/activity DOM for every device surface. */
import { html, nothing, type TemplateResult } from 'lit';
import type { ResolvedDevicePresentation } from './device-presentation';
import { safeRenderColor } from './color';

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
  if (presentation.pulse.kind !== 'none') {
    out.push(`--ripple-scale:${presentation.pulse.diameterScale}`);
    const rippleColor = safeRenderColor(presentation.pulse.color, null);
    if (rippleColor) out.push(`--ripple-color:${rippleColor}`);
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
  const pulse = presentation.pulse;
  const gen2 = pulse.generation % 2 === 0;
  return html`
    ${pulse.kind !== 'none' && pulse.reducedMotionIndicator !== 'dot'
      ? html`<span class="device-pulse activity-ring ${pulse.kind} ${pulse.reason} reason-${pulse.reason} ${gen2 ? 'gen2' : ''}"
          aria-hidden="true"><i></i><i></i><i></i></span>`
      : nothing}
    ${pulse.reducedMotionIndicator === 'dot'
      ? html`<span class="activity-dot" aria-hidden="true"></span>`
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
    ${presentation.valueBadge
      ? html`<span
          class="value-badge pos-${presentation.valueBadge.position} ${presentation.valueBadge.availability} tone-${presentation.valueBadge.tone}"
          title=${`${presentation.valueBadge.sourceLabel}: ${presentation.valueBadge.fullText}`}
          aria-hidden="true"
        >${presentation.valueBadge.text}</span>`
      : nothing}
    ${presentation.lqiText != null
      ? html`<span class="lqi ${presentation.valueBadge?.position === 'bottom' ? 'below-value-badge' : ''}"
          style=${presentation.lqiColor ? `color:${presentation.lqiColor}` : nothing}>${presentation.lqiText}</span>`
      : nothing}
  `;
}
