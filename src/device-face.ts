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

/** HA theme state is authoritative when available; CSS color-scheme remains the fallback. */
export function deviceThemeClass(hass: any): string {
  return typeof hass?.themes?.darkMode === 'boolean'
    ? hass.themes.darkMode ? 'theme-dark' : 'theme-light'
    : '';
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

/** Deterministic fit without DOM measurement or a per-marker ResizeObserver. */
export function deviceTextScale(text: string): number {
  const units = [...String(text)].reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.35;
    return sum + (char.codePointAt(0)! > 0xff ? 1 : 0.62);
  }, 0);
  if (units <= 8) return 0.45;
  return Math.max(0.25, Math.round((0.45 * 8 / units) * 1000) / 1000);
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
  const badge = presentation.valueBadge;
  const shellPosition = badge?.position || 'right';
  const hasSections = !!badge || legacyMetrics.length > 0;
  const shellClasses = [
    'device-shell',
    presentation.valueText != null ? 'text-shell' : '',
    hasSections ? `with-values pos-${shellPosition}` : '',
    legacyMetrics.length ? 'with-legacy' : '',
  ].filter(Boolean).join(' ');
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
    <span class=${shellClasses} aria-hidden="true">
      <span class="device-core">
        ${presentation.valueText != null
          ? html`<span class="valtext" title=${presentation.valueFullText || presentation.valueText}
              style=${`--value-font-scale:${deviceTextScale(presentation.valueFullText || presentation.valueText)}`}
            >${presentation.valueText}</span>`
          : html`<ha-icon icon=${presentation.icon}
              style=${presentation.angle ? `transform:rotate(${presentation.angle}deg)` : nothing}></ha-icon>`}
      </span>
      ${hasSections ? html`<span class="device-sections">
        ${badge
          ? html`<span
              class=${valueBadgeClassName(badge)}
              title=${valueBadgeTitle(badge)}
              style=${`--value-font-scale:${deviceTextScale(badge.fullText || badge.text)}`}
            >${badge.text}</span>`
          : nothing}
        ${legacyMetrics.map((metric) => html`<span
          class="value-badge legacy-secondary available tone-${metric.kind}"
          title=${metric.text + metric.suffix}
          style=${`--value-font-scale:${deviceTextScale(metric.text + metric.suffix)}`}
        >${metric.text}${metric.suffix}</span>`)}
      </span>` : nothing}
    </span>
    ${presentation.lqiText != null
      ? html`<span class="${lqiClassName(presentation.valueBadge)}${presentation.lqiBand ? ` band-${presentation.lqiBand}` : ''}"
          style=${presentation.lqiColor ? `color:${presentation.lqiColor}` : nothing}>${presentation.lqiText}</span>`
      : nothing}
  `;
}
