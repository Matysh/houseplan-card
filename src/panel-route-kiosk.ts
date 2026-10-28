import type { RouteKiosk } from './route-kiosk';
import type { ScreenOverrides, ExternalScreen } from './external-screens';

function positionOf(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const position = Number(value);
  return Number.isSafeInteger(position) && position > 0 ? position : null;
}

/** Path aliases retain positional precedence; profile/overrides are independent. */
export function parseRouteKiosk(path: string, search: string): RouteKiosk {
  const tail = path.endsWith('/') ? path.slice(0, -1) : path;
  const match = /^\/kiosk(?:\/([^/]+))?$/.exec(tail);
  if (!match && tail !== '') return { enabled: false, position: null };
  const query = new URLSearchParams(search);
  const profile = positionOf(query.get('hpprofile'));
  const enabled = !!match || profile !== null || query.get('hpkiosk') === '1';
  if (!enabled) return { enabled: false, position: null };
  let value = match ? match[1] ?? null : query.get('hpspace');
  try { if (match && value !== null) value = decodeURIComponent(value); } catch { value = null; }
  const overrides = screenOverrides(query);
  return { enabled: true, position: positionOf(value),
    ...(profile === null ? {} : { profile }),
    ...(Object.keys(overrides).length ? { overrides } : {}) };
}

export function screenOverrides(query: URLSearchParams): ScreenOverrides {
  const value: ScreenOverrides = {};
  const number = (key: string, min: number, max: number): number | undefined => {
    const raw = query.get(key);
    return raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) >= min && Number(raw) <= max ? Number(raw) : undefined;
  };
  const rotation = number('hprotate', 0, 270);
  if (rotation !== undefined && [0, 90, 180, 270].includes(rotation)) value.rotation = rotation as ExternalScreen['rotation'];
  for (const [url, key] of [['hpcycle', 'cycle'], ['hpidle', 'idle']] as const) {
    const n = number(url, 0, 3600); if (n !== undefined) value[key] = n;
  }
  for (const [url, key] of [['hpsummary', 'summary'], ['hphidden', 'hidden_devices'], ['hpcontrols', 'controls']] as const) {
    const raw = query.get(url); if (raw === '0' || raw === '1') value[key] = raw === '1';
  }
  for (const [url, key] of [['hpicons', 'icon_scale'], ['hptext', 'font_scale']] as const) {
    const n = number(url, 50, 300); if (n !== undefined) value[key] = Math.round(n / 5) / 20;
  }
  return value;
}
