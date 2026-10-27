import type { RouteKiosk } from './route-kiosk';

function positionOf(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const position = Number(value);
  return Number.isSafeInteger(position) && position > 0 ? position : null;
}

/** HA supplies the panel-relative route.path. Path aliases win as a whole. */
export function parseRouteKiosk(path: string, search: string): RouteKiosk {
  const tail = path.endsWith('/') ? path.slice(0, -1) : path;
  const match = /^\/kiosk(?:\/([^/]+))?$/.exec(tail);
  if (match) {
    let value: string | null = match[1] ?? null;
    try { if (value !== null) value = decodeURIComponent(value); } catch { value = null; }
    return { enabled: true, position: positionOf(value) };
  }
  if (tail !== '') return { enabled: false, position: null };
  const query = new URLSearchParams(search);
  return query.get('hpkiosk') === '1'
    ? { enabled: true, position: positionOf(query.get('hpspace')) } : { enabled: false, position: null };
}
