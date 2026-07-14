/**
 * Pure functions with no Lit/DOM dependencies — easy to cover with unit tests.
 */

/** Zigbee LQI color: ≤40 — red, ≥180 — green, in between — an hsl gradient. */
export function lqiColor(lqi: number): string {
  const hue = Math.max(0, Math.min(120, ((lqi - 40) / 140) * 120));
  return `hsl(${Math.round(hue)}, 85%, 55%)`;
}

/** Snap a coordinate to the nearest grid node with step pitch. */
export function snapToGrid(v: number, pitch: number): number {
  return Math.round(v / pitch) * pitch;
}

/** Real-world length (cm) of a segment given the grid pitch (render units per cell) and cm per cell. */
export function segmentCm(a: number[], b: number[], gridPitch: number, cellCm: number): number {
  const cells = Math.hypot(b[0] - a[0], b[1] - a[1]) / gridPitch;
  return cells * cellCm;
}

/** Format a length (cm) for display: metric metres ("1.25 m") or imperial feet+inches ("4′ 1″"). */
export function formatLength(cm: number, imperial: boolean): string {
  if (imperial) {
    const totalIn = cm / 2.54;
    let ft = Math.floor(totalIn / 12);
    let inch = Math.round(totalIn - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return `${ft}′ ${inch}″`;
  }
  return `${(cm / 100).toFixed(2)} m`;
}

/** Canonical key of a segment (independent of direction). */
export function segKey(a: number[], b: number[]): string {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${p[0].toFixed(1)},${p[1].toFixed(1)}-${q[0].toFixed(1)},${q[1].toFixed(1)}`;
}

/** Point equality within a tolerance. */
export function samePoint(a: number[], b: number[], eps = 0.001): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

/** Point inside a polygon (ray casting). */
export function pointInPolygon(p: number[], poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Marker id by binding: device → device_id, entity → 'lg_'+entity_id,
 * virtual → the passed-in existing (if it is already a v_ marker) or a new one via newId().
 */
export function markerIdForBinding(
  binding: string,
  existingId: string | undefined,
  newId: () => string,
): string {
  const [kind, ref] = binding.split(':');
  if (kind === 'device') return ref;
  if (kind === 'entity') return 'lg_' + ref;
  return existingId && existingId.startsWith('v_') ? existingId : newId();
}

/** Average LQI over a set of values (or null). */
export function averageLqi(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** “Contain” rectangle with the given aspect (w/h) that fits the whole vb [x,y,w,h]. */
export function fitView(vb: number[], aspect: number): { x: number; y: number; w: number; h: number } {
  const planA = vb[2] / vb[3];
  if (aspect > planA) {
    const h = vb[3], w = vb[3] * aspect;
    return { x: vb[0] - (w - vb[2]) / 2, y: vb[1], w, h };
  }
  const w = vb[2], h = vb[2] / aspect;
  return { x: vb[0], y: vb[1] - (h - vb[3]) / 2, w, h };
}

/** Push points apart: no closer than minDist to each other, within rectangle b with padding pad. Mutates pts. */
export function declump(
  pts: { x: number; y: number }[],
  b: { x: number; y: number; w: number; h: number },
  minDist: number,
  pad: number,
): void {
  if (pts.length < 2) return;
  const minX = b.x + pad, maxX = b.x + b.w - pad, minY = b.y + pad, maxY = b.y + b.h - pad;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          pts[i].x -= ux * push; pts[i].y -= uy * push;
          pts[j].x += ux * push; pts[j].y += uy * push;
          moved = true;
        }
      }
    }
    for (const q of pts) {
      q.x = Math.max(minX, Math.min(maxX, q.x));
      q.y = Math.max(minY, Math.min(maxY, q.y));
    }
    if (!moved) break;
  }
}

/**
 * Safe URL for <a href>: only http(s) and relative paths are allowed.
 * Rejects javascript:, data: and other dangerous schemes (XSS via config).
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^(https?:)?\/\//i.test(u) || u.startsWith('/') || /^[\w./#?=&%~-]+$/i.test(u)) {
    if (/^[a-z][\w+.-]*:/i.test(u) && !/^https?:/i.test(u)) return null;
    return u;
  }
  return null;
}

// ---------------- tap actions ----------------

export type TapAction = 'info' | 'more-info' | 'toggle';

/** Domains a card-wide `tap_action: toggle` may toggle (accidental-tap safe). */
export const TOGGLE_SAFE_DOMAINS = new Set(['light', 'switch', 'fan', 'humidifier']);

/**
 * Domains that must NEVER toggle from a plan tap, even with an explicit
 * per-device override: an accidental tap unlocking a door or disarming an
 * alarm is a security incident, not a UX shortcut.
 */
export const TOGGLE_FORBIDDEN_DOMAINS = new Set(['lock', 'alarm_control_panel']);

/**
 * Resolve the effective tap action for a device icon.
 *
 * Order: per-device override → card-wide default → 'info'.
 * 'toggle' is applied conservatively: a card-wide toggle only affects
 * TOGGLE_SAFE_DOMAINS; an explicit per-device toggle affects any domain
 * except TOGGLE_FORBIDDEN_DOMAINS. Everything else falls back to 'info'.
 */
export function resolveTapAction(
  explicit: string | null | undefined,
  cardDefault: string | null | undefined,
  domain: string | null | undefined,
): TapAction {
  const want = explicit || cardDefault || 'info';
  if (want === 'more-info') return 'more-info';
  if (want !== 'toggle') return 'info';
  if (!domain || TOGGLE_FORBIDDEN_DOMAINS.has(domain)) return 'info';
  if (explicit === 'toggle') return 'toggle';
  return TOGGLE_SAFE_DOMAINS.has(domain) ? 'toggle' : 'info';
}

// ---------------- floors import ----------------

export interface FloorInfo {
  id: string;
  name: string;
  level: number | null;
}

/** HA floor registry → a list ordered by level (unknown levels last), then name. */
export function floorsOf(hass: any): FloorInfo[] {
  const reg = hass?.floors;
  if (!reg || typeof reg !== 'object') return [];
  const list: FloorInfo[] = [];
  for (const f of Object.values<any>(reg)) {
    if (!f || !f.floor_id) continue;
    list.push({ id: f.floor_id, name: f.name || f.floor_id, level: f.level ?? null });
  }
  list.sort((a, b) => {
    const la = a.level ?? 1e9;
    const lb = b.level ?? 1e9;
    return la !== lb ? la - lb : a.name.localeCompare(b.name);
  });
  return list;
}

/** Substitute every occurrence of {name} placeholders in a template string. */
export function subst(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(String(v));
  return out;
}

// ---------------- room fills & colors ----------------

export type RoomFillMode = 'none' | 'lqi' | 'light' | 'temp';

/** Per-space display settings with their defaults resolved. */
export interface SpaceDisplay {
  showBorders: boolean;
  showNames: boolean;
  color: string;    // hex like #3ea6ff
  opacity: number;  // 0..1 — applied to borders, names and fills
  fill: RoomFillMode;
  tempMin: number; // comfort range lower bound, °C
  tempMax: number; // comfort range upper bound, °C
}

export const DEFAULT_ROOM_COLOR = '#3ea6ff';
export const DEFAULT_ROOM_OPACITY = 0.55;
export const DEFAULT_TEMP_MIN = 20;
export const DEFAULT_TEMP_MAX = 25;

/** Resolve a space's display settings; spaces without a plan default to visible markup. */
export function spaceDisplayOf(spaceCfg: any): SpaceDisplay {
  const s = spaceCfg?.settings || {};
  const noPlan = !spaceCfg?.plan_url;
  return {
    showBorders: s.show_borders ?? noPlan,
    showNames: s.show_names ?? noPlan,
    color: typeof s.room_color === 'string' && /^#[0-9a-f]{6}$/i.test(s.room_color) ? s.room_color : DEFAULT_ROOM_COLOR,
    opacity: typeof s.room_opacity === 'number' ? Math.min(1, Math.max(0, s.room_opacity)) : DEFAULT_ROOM_OPACITY,
    fill: ['lqi', 'light', 'temp'].includes(s.fill_mode) ? s.fill_mode : 'none',
    tempMin: typeof s.temp_min === 'number' ? s.temp_min : DEFAULT_TEMP_MIN,
    tempMax: typeof s.temp_max === 'number' ? s.temp_max : DEFAULT_TEMP_MAX,
  };
}

/**
 * Room fill color for the selected mode, or null for "no fill".
 * - lqi: red→green gradient by the room's average zigbee signal (null LQI → no fill)
 * - light: warm yellow when any light in the room is on, grey when all known
 *   lights are off; rooms without lights get no fill (a bathroom without smart
 *   bulbs should not look permanently "off").
 */
export function roomFillColor(
  mode: RoomFillMode,
  lqi: number | null,
  lights: 'on' | 'off' | 'none',
  temp?: number | null,
  tempMin: number = DEFAULT_TEMP_MIN,
  tempMax: number = DEFAULT_TEMP_MAX,
): string | null {
  if (mode === 'lqi') return lqi == null ? null : lqiColor(lqi);
  if (mode === 'light') {
    if (lights === 'none') return null;
    return lights === 'on' ? '#ffd45c' : '#9aa0a6';
  }
  if (mode === 'temp') {
    // blue below the comfort range, green inside, yellow above; no reading → no fill.
    // Bounds are swapped automatically if entered in the wrong order.
    if (temp == null) return null;
    const lo = Math.min(tempMin, tempMax);
    const hi = Math.max(tempMin, tempMax);
    if (temp < lo) return '#4fc3f7';
    if (temp > hi) return '#ffd45c';
    return '#66d17a';
  }
  return null;
}
