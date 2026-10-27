/** Independent virtual templates; no writes, HA commands or source mutations (#935). */
import { hasOwnSpatialSource, ownControllableEntities, persistedExternalControls, forcedLightEntityOf } from './devices';
import { projectedTapAction } from './device-toggle';
import { resolveGlowValues } from './logic';
import type { DevItem, Marker, PdfRef, ServerConfig } from './types';

export function nextDeviceCopyName(name: string, occupied: Iterable<string>, fallback: string): string {
  let base = name.trim() || fallback;
  const suffix = /\s+(\d+)$/.exec(base);
  if (suffix && Number(suffix[1]) >= 2) base = base.slice(0, suffix.index).trim() || fallback;
  const names = new Set(occupied);
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function deviceCopyIncoming(config: ServerConfig, source: DevItem): string[] {
  const own = new Set(source.bindingKind === 'entity' ? [source.bindingRef!]
    : ownControllableEntities(source));
  return (config.markers || []).filter(marker => marker.id !== source.id && !marker.removed
    && marker.controls?.some(ref => ref === `marker:${source.id}` || own.has(ref)))
    .map(marker => marker.id);
}

export function virtualDeviceCopy(
  source: DevItem, id: string, name: string, incoming: readonly string[],
  hass: { states?: Record<string, { state: string; attributes?: Record<string, unknown> }> },
  fallbackColor: string,
): Marker {
  const marker: Marker = {
    ...structuredClone(source.marker || {}), id, binding: 'virtual', name,
    icon: source.icon, space: source.space, area: source.area || null,
    model: source.model || source.marker?.model || null,
    link: source.link ?? null, description: source.description ?? null,
    pdfs: structuredClone(source.pdfs || []),
    tap_action: projectedTapAction(source.marker?.tap_action, source.primary?.split('.')[0]),
  };
  delete marker.light_entity;
  delete marker.toggle_entity;
  // HA dialog selection belongs to the original physical binding.
  delete marker.more_info_entity;
  delete marker.hidden;
  delete marker.removed;
  for (const value of [marker.value_source, marker.value_badge?.source]) {
    if (value?.kind === 'derived_marker_state' && value.ref === `marker:${source.id}`) value.ref = `marker:${id}`;
  }
  if (source.marker?.controls) marker.controls = persistedExternalControls(
    source.marker.binding, source.marker.controls, source.entities,
  );
  const ownLight = source.marker?.is_light === true || hasOwnSpatialSource(hass, source)
    || (source.marker?.is_light !== false && source.primary?.startsWith('light.'));
  if (ownLight || incoming.length) {
    marker.is_light = true;
    // A virtual source cannot keep a brightness that used to come from its own HA row.
    if (source.bindingKind !== 'virtual') {
      const eid = forcedLightEntityOf(source);
      const values = resolveGlowValues(eid ? hass.states?.[eid] : undefined, marker.glow_color, fallbackColor);
      marker.glow_color = { c: values.c, bri: Math.max(0.01, values.bri) };
    }
  }
  return marker;
}

export interface CopyFootprint { x: number; y: number; radius: number }
export interface CopyStripObstacle { points: readonly (readonly number[])[]; radius: number }

/** Circle enclosing the measured rounded shell, including long value capsules. */
export function deviceCopyRadius(base: number, shape?: { box: { left: number; right: number; top: number; bottom: number }; radius: number }): number {
  if (!shape) return base;
  const b = shape.box, r = shape.radius;
  return Math.max(base, Math.hypot(Math.max(0, Math.abs(b.left), Math.abs(b.right)) - r,
    Math.max(0, Math.abs(b.top), Math.abs(b.bottom)) - r) + r);
}

function segmentDistance(x: number, y: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Render units in, normalised position out. The room/unit square are not bounds. */
export function deviceCopyPosition(
  source: CopyFootprint, occupied: readonly CopyFootprint[], grid: number,
  strips: readonly CopyStripObstacle[] = [], maxRings = 64,
): { x: number; y: number } | null {
  const step = Math.max(grid, 1 / 240 * 1000);
  const stride = Math.max(1, Math.ceil((source.radius * 2 + step) / step));
  const sx = Math.round(source.x / step), sy = Math.round(source.y / step);
  const free = (x: number, y: number): boolean => Math.abs(x) <= 5_000_000 && Math.abs(y) <= 5_000_000
    && occupied.every(o => Math.hypot(x - o.x, y - o.y) >= source.radius + o.radius + step * .25)
    && strips.every(s => s.points.every((b, i) => !i || segmentDistance(x, y, s.points[i - 1], b) >= source.radius + s.radius + step * .25));
  for (let ring = 1; ring <= maxRings; ring++) {
    const candidates: [number, number][] = [];
    for (let i = -ring; i <= ring; i++) {
      candidates.push([ring, i], [-ring, i]);
      if (Math.abs(i) !== ring) candidates.push([i, ring], [i, -ring]);
    }
    candidates.sort((a,b) => Math.hypot(...a) - Math.hypot(...b) || b[0] - a[0] || a[1] - b[1]);
    for (const [dx, dy] of candidates) {
      const x = (sx + dx * stride) * step, y = (sy + dy * stride) * step;
      if (free(x, y)) return { x: x / 1000, y: y / 1000 };
    }
  }
  return null;
}

/** Only genuine internal marker files are copied; external URLs stay external. */
const INTERNAL_FILE = /^(\/api\/houseplan\/content|\/houseplan_files)\/files\/([^/]+)\/([^?#/]+)([?#].*)?$/;
export function deviceCopyFileGroups(marker: Marker): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const pdf of marker.pdfs || []) {
    const match = INTERNAL_FILE.exec(pdf.url);
    if (!match) continue;
    const owner = decodeURIComponent(match[2]), name = decodeURIComponent(match[3]);
    const names = groups.get(owner) || [];
    if (!names.includes(name)) names.push(name);
    groups.set(owner, names);
  }
  return groups;
}

export function rewriteDeviceCopyFiles(pdfs: PdfRef[], owner: string, id: string, mapping: Record<string, string>): PdfRef[] {
  return pdfs.map(pdf => {
    const match = INTERNAL_FILE.exec(pdf.url);
    if (!match || decodeURIComponent(match[2]) !== owner) return pdf;
    const name = mapping[decodeURIComponent(match[3])];
    if (!name) throw new Error('Missing copied attachment');
    return { ...pdf, url: `${match[1]}/files/${encodeURIComponent(id)}/${encodeURIComponent(name)}${match[4] || ''}` };
  });
}
