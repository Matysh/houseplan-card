/** Shared icon/value/badge/activity DOM for every device surface. */
import { html, nothing, type TemplateResult } from 'lit';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { ResolvedValueBadge } from './device-value-badge';
import { safeRenderColor } from './color';
import { valueBadgeTitle } from './device-value-badge';

export interface DeviceFaceOptions {
  surface: 'interactive-plan' | 'preview' | 'static-card';
  newDevice?: boolean;
  newDeviceTitle?: string;
  disabledTitle?: string;
}

export interface LegacySupplementalMetric {
  kind: 'temperature' | 'humidity';
  text: string;
  suffix: string;
}

/**
 * Issue #90 replaced the automatic temperature/humidity satellites with one
 * configurable value badge. Untouched legacy markers, however, could show
 * both readings at once. Keep only the second legacy metric here: the primary
 * one is already represented by `valueBadge`, while explicitly configured
 * badges remain exactly single-valued as the new UI promises.
 */
export function legacySupplementalMetrics(
  presentation: ResolvedDevicePresentation,
): LegacySupplementalMetric[] {
  const badge = presentation.valueBadge;
  if (!badge || badge.configured !== false) return [];
  const out: LegacySupplementalMetric[] = [];
  if (presentation.tempText != null && badge.tone !== 'temperature') {
    out.push({ kind: 'temperature', text: presentation.tempText, suffix: '°' });
  }
  if (presentation.humText != null && badge.tone !== 'humidity') {
    out.push({ kind: 'humidity', text: presentation.humText, suffix: '%' });
  }
  return out;
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

/** Stable DOM classes shared by the plan, static card and dialog preview. */
export function valueBadgeClassName(badge: ResolvedValueBadge): string {
  return `value-badge pos-${badge.position} ${badge.availability} tone-${badge.tone}`;
}

/** A bottom value badge owns the first satellite row; LQI moves below it. */
export function lqiClassName(badge: ResolvedValueBadge | null | undefined): string {
  return `lqi${badge?.position === 'bottom' ? ' below-value-badge' : ''}`;
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
  const legacyMetrics = legacySupplementalMetrics(presentation);
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
          class=${valueBadgeClassName(presentation.valueBadge)}
          title=${valueBadgeTitle(presentation.valueBadge)}
          aria-hidden="true"
        >${presentation.valueBadge.text}</span>`
      : nothing}
    ${legacyMetrics.map((metric) => html`<span
      class="value-badge legacy-secondary pos-right available tone-${metric.kind}"
      title=${metric.text + metric.suffix}
      aria-hidden="true"
    >${metric.text}${metric.suffix}</span>`)}
    ${presentation.lqiText != null
      ? html`<span class=${lqiClassName(presentation.valueBadge)}
          style=${presentation.lqiColor ? `color:${presentation.lqiColor}` : nothing}>${presentation.lqiText}</span>`
      : nothing}
  `;
}
