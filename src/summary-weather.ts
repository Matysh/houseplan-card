import type { SummaryHass, SummaryHassState } from './summary-panel-host';
import type { SummaryPanelConfig } from './types';

export type WeatherConfig = NonNullable<SummaryPanelConfig['weather']>;
export interface WeatherForecast {
  datetime: string; condition?: string; temperature?: number; templow?: number;
}
export const weatherSources = (states: SummaryHass['states']) => Object.entries(states ?? {})
  .filter(([id]) => /^weather\.[a-z0-9_]+$/.test(id))
  .map(([id, state]) => ({ id, name: state.attributes?.friendly_name || id }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

/** A saved missing source never falls back to a different location. */
export function weatherSource(config: WeatherConfig | undefined, states: SummaryHass['states']): string | null {
  if (!config?.enabled) return null;
  if (config.entity_id) return config.entity_id;
  const sources = weatherSources(states);
  return sources.length === 1 ? sources[0].id : null;
}
export const weatherNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function weatherDirection(value: unknown): number | null {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  if (typeof value === 'string' && directions.includes(value.toUpperCase())) return directions.indexOf(value.toUpperCase());
  const numeric = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : weatherNumber(value);
  return numeric === null || !Number.isFinite(numeric) ? null : Math.round(((numeric % 360 + 360) % 360) / 45) % 8;
}
export function weatherDay(date: Date, timeZone?: string): string {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone } as const;
  try { return new Intl.DateTimeFormat('en-CA', options).format(date); }
  catch { return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' }).format(date); }
}
export function weatherDays(raw: unknown, now = new Date(), timeZone?: string): WeatherForecast[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(), today = weatherDay(now, timeZone);
  return raw.filter((row): row is WeatherForecast => !!row && typeof row.datetime === 'string'
      && Number.isFinite(Date.parse(row.datetime))
      && (typeof row.condition === 'string' || weatherNumber(row.temperature) !== null || weatherNumber(row.templow) !== null))
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime))
    .filter(row => { const day = weatherDay(new Date(row.datetime), timeZone);
      if (day < today || seen.has(day)) return false; seen.add(day); return true;
    }).slice(0, 3);
}
export const weatherIcon = (condition: string | undefined): string => `mdi:${({
  'clear-night': 'weather-night', cloudy: 'weather-cloudy', exceptional: 'alert-circle-outline',
  fog: 'weather-fog', hail: 'weather-hail', lightning: 'weather-lightning',
  'lightning-rainy': 'weather-lightning-rainy', partlycloudy: 'weather-partly-cloudy',
  pouring: 'weather-pouring', rainy: 'weather-rainy', snowy: 'weather-snowy',
  'snowy-rainy': 'weather-snowy-rainy', sunny: 'weather-sunny', windy: 'weather-windy',
  'windy-variant': 'weather-windy-variant',
} as Record<string, string>)[condition || ''] || 'weather-cloudy'}`;

type Release = () => void | Promise<void>;
export type WeatherConnection = {
  subscribeMessage(callback: (event: { type?: string; forecast?: unknown }) => void,
    message: { type: 'weather/subscribe_forecast'; entity_id: string; forecast_type: 'daily' }): Promise<Release>;
};
const releaseSafely = (release: Release): void => { try { void Promise.resolve(release()).catch(() => undefined); } catch { /* disconnected */ } };

/** One visible consumer; retiring a pending subscribe also retires its future release. */
export class WeatherForecastSubscription {
  private generation = 0;
  private connection: WeatherConnection | null = null;
  private key = '';
  private release: Release | null = null;
  private failedState: SummaryHassState | null = null;
  public forecast: unknown = [];
  public constructor(private readonly changed: () => void) {}
  public update(hass: SummaryHass | undefined, entity: string | null, visible: boolean): void {
    const state = entity ? hass?.states?.[entity] : undefined;
    const owner = hass?.connection as WeatherConnection | undefined;
    const wanted = visible && !!state && !['unknown', 'unavailable'].includes(state.state || '')
      && !!(Number(state.attributes?.supported_features) & 1) && typeof owner?.subscribeMessage === 'function';
    const key = wanted ? `${entity}:${hass?.user?.id || ''}` : '';
    if (key === this.key && (key === '' || owner === this.connection)
        && (!this.failedState || this.failedState === state)) return;
    this.stop();
    if (!wanted || !entity || !owner) return;
    this.connection = owner; this.key = key;
    const generation = this.generation;
    try {
      void owner.subscribeMessage(event => {
        if (generation !== this.generation || event.type && event.type !== 'daily') return;
        this.forecast = Array.isArray(event.forecast) ? event.forecast : []; this.changed();
      }, { type: 'weather/subscribe_forecast', entity_id: entity, forecast_type: 'daily' })
        .then(release => { if (generation !== this.generation) releaseSafely(release); else this.release = release; })
        .catch(() => { if (generation === this.generation) { this.failedState = state!; this.forecast = []; this.changed(); } });
    } catch { this.failedState = state!; }
  }
  public stop(): void {
    this.generation++; this.key = ''; this.connection = null; this.failedState = null;
    if (this.release) releaseSafely(this.release);
    this.release = null;
    if (Array.isArray(this.forecast) && this.forecast.length) { this.forecast = []; this.changed(); }
  }
}
