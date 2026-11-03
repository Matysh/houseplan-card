import { LitElement, html, nothing } from 'lit';
import { langOf } from './i18n';
import type { SummaryHass, SummaryHassState } from './summary-panel-host';
import { WeatherForecastSubscription, weatherSource, weatherSources, weatherNumber, weatherDay,
  weatherDays, weatherDirection, weatherIcon, type WeatherConfig } from './summary-weather';
import { weatherText, weatherWindText, weatherConditionText } from './summary-weather-i18n';

/** A separate update owner: forecasts never repaint the plan or its geometry. */
export class HpSummaryWeather extends LitElement {
  static properties = { hass: { attribute: false }, config: { attribute: false }, active: { type: Boolean }, language: { type: String }, showHeading: { attribute: false } };
  showHeading = true;
  declare hass?: SummaryHass;
  declare config?: WeatherConfig;
  active = false;
  language?: string;
  private readonly forecast = new WeatherForecastSubscription(() => this.requestUpdate());
  protected createRenderRoot(): HTMLElement { return this; } // inherit the parent's shared reading kit
  private readonly visibilityChanged = (): void => { this.sync(); this.requestUpdate(); };
  connectedCallback(): void { super.connectedCallback(); this.ownerDocument.addEventListener('visibilitychange', this.visibilityChanged); }
  disconnectedCallback(): void { this.forecast.stop(); this.ownerDocument.removeEventListener('visibilitychange', this.visibilityChanged); super.disconnectedCallback(); }
  private sync(): void {
    this.forecast.update(this.hass, weatherSource(this.config, this.hass?.states),
      this.isConnected && this.active && this.ownerDocument.visibilityState !== 'hidden');
  }
  protected willUpdate(): void { this.sync(); }
  private get weatherLang() { return langOf(this.hass, this.language); }
  private get weatherTimeZone(): string | undefined {
    return (this.hass?.locale as { time_zone?: string } | undefined)?.time_zone === 'local'
      ? undefined : this.hass?.config?.time_zone;
  }
  private number(value: number): string {
    const locale = (this.hass?.locale as { language?: string; number_format?: string } | undefined);
    const formats: Record<string, string> = { comma_decimal: 'en-US', decimal_comma: 'de-DE', space_comma: 'ru-RU' };
    const lang = locale?.number_format === 'system' ? navigator.language : formats[locale?.number_format || ''] || locale?.language || this.weatherLang;
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 1, useGrouping: locale?.number_format !== 'none' }).format(value);
  }
  private attribute(state: SummaryHassState, key: string, value: number, unit: string): string {
    const formatter = this.hass?.formatEntityAttributeValue;
    if (typeof formatter === 'function') {
      try { return String(formatter.call(this.hass, state, key, value)); } catch { /* bounded fallback */ }
    }
    const units: Record<string, string> = this.weatherLang === 'ru' ? { 'm/s': 'м/с', 'km/h': 'км/ч', mph: 'миль/ч' } : {};
    return `${this.number(value)}${unit ? ` ${units[unit] || unit}` : ''}`;
  }
  private temperature(state: SummaryHassState, key: string, value: unknown): string | null {
    const n = weatherNumber(value); if (n === null) return null;
    const config = this.hass?.config?.unit_system as { temperature?: string } | undefined;
    const unit = String(state.attributes?.temperature_unit || config?.temperature || '');
    const formatted = this.attribute(state, key, n, unit).replace(/\s*°C$/, '°').replace(/\s+(°F|K)$/, '$1');
    return n > 0 && !formatted.startsWith('+') ? `+${formatted}` : formatted;
  }
  protected render() {
    const stateId = weatherSource(this.config, this.hass?.states);
    const state = stateId ? this.hass?.states?.[stateId] : undefined;
    const t = (key: Parameters<typeof weatherText>[1]) => weatherText(this.weatherLang, key);
    const status = !stateId ? t(weatherSources(this.hass?.states).length ? 'select_source' : 'no_source')
      : !state ? t('deleted') : ['unknown', 'unavailable'].includes(state.state || '') ? t('unavailable') : null;
    const open = () => this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: stateId } }));
    // An absent source has no valid HA more-info target; only existing states are clickable.
    if (status) return html`<section class="summary-block hpf-reading-block summary-weather" data-hp="weather-widget">
      ${this.showHeading ? html`<h3 class="hpf-heading hpf-heading-section">${t('title')}</h3>` : nothing}
      ${state ? html`<button type="button" class="hpf-reading-action" @click=${open}>${status}</button>`
        : html`<p class="hpf-reading-empty">${status}</p>`}</section>`;
    if (!state) return nothing;
    const a = state.attributes || {}, temp = this.temperature(state, 'temperature', a.temperature);
    const feels = this.temperature(state, 'apparent_temperature', a.apparent_temperature);
    const wind = weatherNumber(a.wind_speed), humidity = weatherNumber(a.humidity);
    const bearing = weatherDirection(a.wind_bearing);
    const condition = state.state || '';
    const stateFormatter = this.hass?.formatEntityState;
    let label = weatherConditionText(this.weatherLang, condition);
    if (typeof stateFormatter === 'function') { try { label = String(stateFormatter.call(this.hass, state)); } catch { /* fallback */ } }
    const days = weatherDays(this.forecast.forecast, new Date(), this.weatherTimeZone);
    const pair = (label: string, value: string | null) => html`<span class="hpf-reading-pair hpf-reading-pair-compact"><span>${label}</span>${value === null ? nothing : html`<strong>${value}</strong>`}</span>`;
    return html`<section class="summary-block hpf-reading-block summary-weather" data-hp="weather-widget" data-entity=${stateId}>
      ${this.showHeading ? html`<h3 class="hpf-heading hpf-heading-section">${t('title')}</h3>` : nothing}
      <button type="button" class="hpf-reading-action" @click=${open} title=${`${t('more')}: ${a.friendly_name || stateId}`}>
        <span class="summary-weather-now"><ha-icon .icon=${weatherIcon(condition)} aria-hidden="true"></ha-icon>${temp === null ? nothing : html`<strong>${temp}</strong>`}<span>${label}</span></span>
        <span class="summary-weather-meta">
          ${feels === null ? nothing : pair(t('feels'), feels)}
          ${wind !== null && wind >= 0 || bearing !== null ? pair(`${t('wind')}${bearing === null ? '' : ` ${weatherWindText(this.weatherLang, bearing)}`}`,
            wind !== null && wind >= 0 ? this.attribute(state, 'wind_speed', wind, String(a.wind_speed_unit || '')) : null) : nothing}
          ${humidity !== null && humidity >= 0 && humidity <= 100 ? pair(t('humidity'), `${this.number(humidity)}%`) : nothing}
        </span>
        ${days.length ? html`<span class="summary-weather-forecast hpf-divider-before">${days.map(day => {
          const date = new Date(day.datetime);
          let name: string;
          try { name = new Intl.DateTimeFormat((this.hass?.locale as { language?: string } | undefined)?.language || this.weatherLang, { weekday: 'short', timeZone: this.weatherTimeZone }).format(date); }
          catch { name = new Intl.DateTimeFormat(this.weatherLang, { weekday: 'short' }).format(date); }
          return html`<span><span>${weatherDay(date, this.weatherTimeZone) === weatherDay(new Date(), this.weatherTimeZone) ? t('today') : name}</span>
            ${day.condition ? html`<ha-icon .icon=${weatherIcon(day.condition)} aria-label=${weatherConditionText(this.weatherLang, day.condition)}></ha-icon>` : nothing}
            ${this.temperature(state, 'temperature', day.temperature) === null ? nothing : html`<strong>${this.temperature(state, 'temperature', day.temperature)}</strong>`}
            ${this.temperature(state, 'templow', day.templow) === null ? nothing : html`<small>${this.temperature(state, 'templow', day.templow)}</small>`}</span>`;
        })}</span>` : nothing}
      </button></section>`;
  }
}
if (!customElements.get('hp-summary-weather')) customElements.define('hp-summary-weather', HpSummaryWeather);
