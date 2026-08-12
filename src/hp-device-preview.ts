/** Live, read-only device display preview used by the marker editor. */
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { cardStyles } from './styles';
import { deviceFaceStyle, renderDeviceFace } from './device-face';
import {
  type PresentationReason,
  type ResolvedDevicePresentation,
} from './device-presentation';
import { withDemoPulse } from './device-pulse';
import { valueBadgeTitle } from './device-value-badge';
import {
  acquireIntegrationMetadata, integrationMetadataSnapshot,
  resolveBindingProviders, resolveEntityProvider, type IntegrationProvider,
} from './integration-provider';
import type { HaRegistrySnapshot } from './ha-binding-status';
import { langOf, t, type I18nKey, type Lang } from './i18n';

const DEMO_MS = 3300;

class HpDevicePreview extends LitElement {
  public hass?: any;
  public presentation?: ResolvedDevicePresentation;
  public registry?: HaRegistrySnapshot;
  public deviceName = '';

  private _metadataRelease?: () => void;
  private _metadataConnection: any = null;
  private _demoUntil = 0;
  private _demoTimer = 0;
  private _demoGeneration = 1;
  private _demoKind: 'short' | 'continuous' | null = null;
  private _reducedMotion = false;
  private _motionMedia?: MediaQueryList;
  private _onMotionChange = (event: MediaQueryListEvent): void => {
    this._reducedMotion = event.matches;
    this.requestUpdate();
  };

  static properties = {
    hass: { attribute: false },
    presentation: { attribute: false },
    registry: { attribute: false },
    deviceName: { attribute: false },
  };

  public connectedCallback(): void {
    super.connectedCallback();
    this._motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._reducedMotion = !!this._motionMedia?.matches;
    this._motionMedia?.addEventListener?.('change', this._onMotionChange);
    this._ensureMetadata();
  }

  public disconnectedCallback(): void {
    this._metadataRelease?.();
    this._metadataRelease = undefined;
    this._metadataConnection = null;
    this._clearDemo();
    this._motionMedia?.removeEventListener?.('change', this._onMotionChange);
    this._motionMedia = undefined;
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass')) this._ensureMetadata();
    const p = this.presentation;
    const previous = changed.get('presentation') as ResolvedDevicePresentation | undefined;
    if (changed.has('presentation') && previous?.binding !== p?.binding) this._clearDemo();
    if (p && this._demoKind
        && (p.display !== 'icon_ripple' || p.pulse.kind !== 'none')) {
      this._clearDemo();
    }
  }

  private _ensureMetadata(): void {
    const connection = this.hass?.connection || null;
    if (!connection || connection === this._metadataConnection) return;
    this._metadataRelease?.();
    this._metadataConnection = connection;
    this._metadataRelease = acquireIntegrationMetadata(this.hass, () => this.requestUpdate());
  }

  private _clearDemo(): void {
    window.clearTimeout(this._demoTimer);
    this._demoTimer = 0;
    this._demoUntil = 0;
    this._demoKind = null;
  }

  private _startShortDemo = (): void => {
    const p = this.presentation;
    if (!p || p.display !== 'icon_ripple' || p.pulse.kind !== 'none') return;
    this._demoGeneration++;
    this._demoKind = 'short';
    this._demoUntil = Date.now() + DEMO_MS;
    window.clearTimeout(this._demoTimer);
    this._demoTimer = window.setTimeout(() => {
      this._demoUntil = 0;
      this._demoTimer = 0;
      this._demoKind = null;
      this.requestUpdate();
    }, DEMO_MS + 30);
    this.requestUpdate();
  };

  private _toggleContinuousDemo = (): void => {
    const p = this.presentation;
    if (!p || p.display !== 'icon_ripple' || p.pulse.kind !== 'none') return;
    if (this._demoKind === 'continuous') {
      this._clearDemo();
    } else {
      this._clearDemo();
      this._demoGeneration++;
      this._demoKind = 'continuous';
      this._demoUntil = Number.POSITIVE_INFINITY;
    }
    this.requestUpdate();
  };

  private get _lang(): Lang {
    return langOf(this.hass);
  }

  private _t(key: I18nKey, vars?: Record<string, string | number>): string {
    return t(this._lang, key, vars);
  }

  private _providerText(provider: IntegrationProvider): string {
    if (provider.domain === 'houseplan') return this._t('marker.preview.virtual_provider');
    return provider.label.toLowerCase() === provider.domain.toLowerCase()
      ? provider.domain : `${provider.label} (${provider.domain})`;
  }

  private _providers(): IntegrationProvider[] {
    if (!this.presentation || !this.registry) return [];
    return resolveBindingProviders(
      this.hass,
      this.presentation.binding,
      this.registry,
      integrationMetadataSnapshot(this.hass),
    );
  }

  private _providerSummary(providers: IntegrationProvider[]): string {
    if (!providers.length) return this._t('marker.preview.unknown_provider');
    const shown = providers.slice(0, 2).map((provider) => this._providerText(provider));
    const rest = providers.length - shown.length;
    return shown.join(', ') + (rest > 0 ? ` · ${this._t('marker.preview.more_sources', { n: rest })}` : '');
  }

  private _sourceSummary(p: ResolvedDevicePresentation): string {
    const sources = p.visualSources;
    if (!sources.length) return this._t('marker.preview.no_source');
    if (sources.length === 1) {
      return `${sources[0].name} · ${sources[0].eid} · ${this._sourceProvider(sources[0].eid)}`;
    }
    if (sources.length === 2) return sources.map((source) => source.name).join(' · ');
    return this._t('marker.preview.multiple_sources', { n: sources.length });
  }

  private _stateSummary(p: ResolvedDevicePresentation): string {
    if (!p.visualSources.length) return this._t('marker.preview.no_state');
    if (p.visualSources.length === 1) {
      return p.visualSources[0].stateText || this._t('marker.preview.no_state');
    }
    const unique = [...new Set(p.visualSources.map((source) => source.stateText).filter(Boolean))];
    return unique.length === 1 ? unique[0] : this._t('marker.preview.mixed_states');
  }

  private _reason(reason: PresentationReason): string {
    return this._t((`marker.preview.reason.${reason}`) as I18nKey);
  }

  private _sourceProvider(eid: string): string {
    if (!this.registry) return this._t('marker.preview.unknown_provider');
    const provider = resolveEntityProvider(
      this.hass, eid, this.registry, integrationMetadataSnapshot(this.hass),
    );
    return provider ? this._providerText(provider) : this._t('marker.preview.unknown_provider');
  }

  protected render(): TemplateResult | typeof nothing {
    const actual = this.presentation;
    if (!actual) return nothing;
    const demoActive = !!this._demoKind && this._demoUntil > Date.now()
      && actual.display === 'icon_ripple'
      && actual.pulse.kind === 'none';
    const shown = demoActive
      ? (() => {
          const pulse = withDemoPulse(
            actual.pulse, this._demoKind!, this._demoGeneration, this._reducedMotion,
            this._demoKind === 'short' ? this._demoUntil : null,
          );
          return { ...actual, pulse, classes: [
            ...actual.classes.filter((name) => !name.startsWith('pulse-')),
            `pulse-${pulse.kind}`,
            ...(pulse.generation % 2 === 0 ? ['pulse-gen2'] : []),
          ] };
        })() : actual;
    const providers = this._providers();
    const realEffect = actual.pulse.kind !== 'none';
    const diameter = shown.scale * (shown.pulse.animated ? shown.pulse.diameterScale : 1);
    // Fit the complete face, not only the activity ring. The value satellite
    // is intentionally capped by CSS at four face widths; measure its likely
    // rendered width conservatively so every position keeps a safe inset.
    let left = -diameter / 2;
    let right = diameter / 2;
    let top = -diameter / 2;
    let bottom = diameter / 2;
    if (shown.valueBadge) {
      const badgeWidth = shown.scale
        * Math.min(4, Math.max(0.9, shown.valueBadge.text.length * 0.29 + 0.28));
      const badgeHeight = shown.scale * 0.7;
      const badgeEdge = shown.scale * 0.6;
      if (shown.valueBadge.position === 'right') right = Math.max(right, badgeEdge + badgeWidth);
      if (shown.valueBadge.position === 'left') left = Math.min(left, -badgeEdge - badgeWidth);
      if (shown.valueBadge.position === 'top') top = Math.min(top, -badgeEdge - badgeHeight);
      if (shown.valueBadge.position === 'bottom') bottom = Math.max(bottom, badgeEdge + badgeHeight);
    }
    if (shown.lqiText != null) {
      const lqiBottom = shown.scale * (shown.valueBadge?.position === 'bottom' ? 1.55 : 0.95);
      bottom = Math.max(bottom, lqiBottom);
    }
    const fit = Math.min(1, 2.35 / Math.max(1, right - left), 2.35 / Math.max(1, bottom - top));
    const fitPct = Math.round(fit * 100);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const previewFitStyle = [
      `left:calc(50% - ${centerX * 54 * fit}px)`,
      `top:calc(50% - ${centerY * 54 * fit}px)`,
      fit < 1 ? `transform:scale(${fit})` : '',
    ].filter(Boolean).join(';');
    const rootClasses = [
      'dev', ...shown.classes,
      shown.binding === 'virtual' ? 'virtual' : '',
      shown.haDisabled ? 'ghost ha-disabled' : '',
      shown.valueText != null ? 'valonly' : '',
    ].filter(Boolean).join(' ');
    const faceStyle = deviceFaceStyle(shown).join(';');
    const result = demoActive
      ? this._t(this._demoKind === 'continuous'
        ? 'marker.preview.demo_continuous_notice' : 'marker.preview.demo_short_notice')
      : this._reason(actual.explanation.reason);
    const aria = [
      this.deviceName,
      this._providerSummary(providers),
      this._stateSummary(actual),
      result,
      actual.valueFullText || '',
      valueBadgeTitle(actual.valueBadge),
    ].filter(Boolean).join('. ');

    return html`<section class="devicepreview">
      <div class="previewhead">
        <strong>${this._t('marker.preview.title')}</strong>
        <span class="previewbadge ${demoActive ? 'example' : ''}">
          ${this._t(demoActive ? 'marker.preview.example' : 'marker.preview.actual')}
        </span>
      </div>
      <div class="previewgrid">
        <div class="previewstage" role="img" aria-label=${aria}>
          <div class="previewfit" style=${previewFitStyle}>
            <div class=${rootClasses} style=${faceStyle}>
              ${renderDeviceFace(shown, {
                surface: 'preview',
                disabledTitle: this._reason('ha_disabled'),
              })}
            </div>
          </div>
        </div>
        <div class="previewfacts" aria-live="polite">
          <div><span>${this._t('marker.preview.integration')}</span><b>${this._providerSummary(providers)}</b></div>
          <div><span>${this._t('marker.preview.source')}</span><b>${this._sourceSummary(actual)}</b></div>
          <div><span>${this._t('marker.preview.current_state')}</span><b>${this._stateSummary(actual)}</b></div>
          <div><span>${this._t('marker.preview.result')}</span><b>${result}</b></div>
          ${actual.fallbackReason
            ? html`<p class="previewnotice">${this._reason(actual.fallbackReason)}</p>` : nothing}
          ${actual.explanation.notices.map((reason) => html`<p class="previewnotice">${this._reason(reason)}</p>`)}
          ${fit < 1
            ? html`<p class="previewnotice">${this._t('marker.preview.scaled', { n: fitPct })}</p>` : nothing}
          ${demoActive && this._reducedMotion
            ? html`<p class="previewnotice">${this._t('marker.preview.reduced_motion')}</p>` : nothing}
        </div>
      </div>
      ${actual.visualSources.length || actual.criticalSources.length
        ? html`<details class="previewdetails">
            <summary>${this._t('marker.preview.details')}</summary>
            <div class="previewtable">
              ${[...actual.visualSources, ...actual.criticalSources].map((source) => html`
                <div class="previewsource">
                  <b>${source.name}</b><code>${source.eid}</code>
                  <span>${source.stateText || source.state}</span>
                  <span>${this._sourceProvider(source.eid)}</span>
                </div>`)}
            </div>
          </details>` : nothing}
      ${actual.display === 'icon_ripple'
        ? html`<div class="previewdemos">
            <button class="previewdemo" type="button"
              ?disabled=${realEffect || this._demoKind === 'continuous'}
              title=${realEffect ? this._t('marker.preview.demo_already_visible') : ''}
              @click=${this._startShortDemo}>
              <ha-icon icon="mdi:motion-play-outline"></ha-icon>
              ${this._t('marker.preview.demo_short')}
            </button>
            <button class="previewdemo" type="button"
              ?disabled=${realEffect}
              title=${realEffect ? this._t('marker.preview.demo_already_visible') : ''}
              @click=${this._toggleContinuousDemo}>
              <ha-icon icon=${this._demoKind === 'continuous' ? 'mdi:stop-circle-outline' : 'mdi:repeat'}></ha-icon>
              ${this._t(this._demoKind === 'continuous'
                ? 'marker.preview.stop_continuous' : 'marker.preview.demo_continuous')}
            </button>
          </div>` : nothing}
    </section>`;
  }

  static styles = [
    cardStyles,
    css`
      :host { display: block; min-width: 0; }
      .devicepreview {
        margin: 4px 0 14px;
        padding: 14px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.28));
        border-radius: 14px;
        background: color-mix(in srgb, var(--card-background-color, #20232b) 92%, var(--primary-color, #03a9f4));
        color: var(--primary-text-color, #fff);
        overflow: hidden;
      }
      .previewhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .previewbadge {
        padding: 3px 9px;
        border-radius: 999px;
        color: var(--secondary-text-color, #9aa0aa);
        background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 12%, transparent);
        font-size: 12px;
        font-weight: 700;
      }
      .previewbadge.example { color: var(--warning-color, #ffb300); }
      .previewgrid { display: grid; grid-template-columns: minmax(170px, 0.8fr) minmax(240px, 1.2fr); gap: 16px; align-items: stretch; }
      .previewstage {
        position: relative;
        min-height: 168px;
        border-radius: 12px;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.16));
        overflow: hidden;
        pointer-events: none;
        container-type: inline-size;
        --icon-size: 54px;
      }
      .previewfit { position: absolute; left: 50%; top: 50%; transform-origin: center; }
      .previewstage .dev { left: 0; top: 0; cursor: default; }
      .previewstage .dev:hover { z-index: 2; }
      .previewfacts { min-width: 0; display: grid; align-content: start; gap: 8px; }
      .previewfacts > div { display: grid; grid-template-columns: minmax(115px, 0.8fr) minmax(0, 1.3fr); gap: 8px; }
      .previewfacts span { color: var(--secondary-text-color, #9aa0aa); }
      .previewfacts b { min-width: 0; overflow-wrap: anywhere; }
      .previewnotice { margin: 2px 0 0; color: var(--secondary-text-color, #9aa0aa); font-size: 13px; }
      .previewdetails { margin-top: 12px; }
      .previewdetails summary { cursor: pointer; color: var(--secondary-text-color, #9aa0aa); }
      .previewtable { display: grid; gap: 8px; margin-top: 9px; }
      .previewsource { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3px 10px; font-size: 13px; }
      .previewsource > * { min-width: 0; overflow-wrap: anywhere; }
      .previewsource code { color: var(--secondary-text-color, #9aa0aa); }
      .previewdemo {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: 10px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .previewdemos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .previewdemo:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
      .previewdemo:disabled { opacity: 0.5; cursor: not-allowed; }
      @media (max-width: 640px) {
        .previewgrid { grid-template-columns: minmax(0, 1fr); }
        .previewstage { min-height: 142px; }
        .previewfacts > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
      }
    `,
  ];
}

if (!customElements.get('hp-device-preview')) {
  customElements.define('hp-device-preview', HpDevicePreview);
}

declare global {
  interface HTMLElementTagNameMap {
    'hp-device-preview': HpDevicePreview;
  }
}

export { HpDevicePreview };
