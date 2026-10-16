/** The same current-model envelope for browser and CLI, not a second writer. */
import { commitWallSegmentModel, WALL_SEGMENT_MODEL_VERSION, CONVERTER_LIMITS as LIMITS } from './geometry-runtime.generated.mjs';

export const CURRENT_MODEL_VERSION = WALL_SEGMENT_MODEL_VERSION;
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
export const MIN_CURRENT_HOUSEPLAN = '1.81.0';
const clone = (value) => JSON.parse(JSON.stringify(value));
const canonical = (value) => Math.round(value * 1e9) / 1e9 || 0;

export class OutputError extends Error {
  constructor(code, detail) { super(detail || code); this.name = 'OutputError'; this.code = code; }
}

function finiteTree(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new OutputError('non_finite_output');
  if (value && typeof value === 'object') for (const item of Object.values(value)) finiteTree(item);
}

function targetLimits(space, markers, layout) {
  const check = (count, maximum) => { if (count > maximum) throw new OutputError('output_too_complex'); };
  for (const [key, maximum] of [['rooms', LIMITS.MAX_ROOMS], ['openings', LIMITS.MAX_OPENINGS],
    ['decor', LIMITS.MAX_DECOR], ['partitions', LIMITS.MAX_PARTITIONS], ['wall_segments', LIMITS.MAX_WALL_SEGMENTS],
    ['led_strips', LIMITS.MAX_LED_STRIPS]]) check(space[key]?.length || 0, maximum);
  check(markers.length, LIMITS.MAX_MARKERS); check(Object.keys(layout).length, LIMITS.MAX_LAYOUT);
  const point = p => {
    if (p.some(value => !Number.isFinite(value) || Math.abs(value) > LIMITS.CANVAS_LIMIT))
      throw new OutputError('output_invalid_geometry');
  };
  for (const room of space.rooms || []) {
    check(room.poly.length, LIMITS.MAX_POLY_POINTS); room.poly.forEach(point);
  }
  for (const wall of [...(space.wall_segments || []), ...(space.partitions || [])]) { point(wall.a); point(wall.b); }
  for (const strip of space.led_strips || []) { check(strip.points.length, LIMITS.MAX_LED_POINTS); strip.points.forEach(point); }
  for (const item of space.decor || []) {
    point([item.x, item.y]);
    if (item.w !== undefined && (!(item.w > 0) || !(item.h > 0)
        || Math.max(item.w, item.h) > LIMITS.CANVAS_LIMIT)) throw new OutputError('output_invalid_geometry');
  }
  for (const position of Object.values(layout)) point([position.x, position.y]);
}

export function placementManifest(config, layout) {
  const markers = new Map(config.markers.map((marker) => [marker.id, marker]));
  return Object.entries(layout).map(([key, position]) => {
    const marker = markers.get(key);
    if (!marker) throw new OutputError('invalid_layout_owner', key);
    return {
      layout_id: key, space_id: position.s ?? null, owner: 'marker', owner_id: key,
      binding: marker.binding ?? null, label: marker.name ?? null, icon: marker.icon ?? null,
    };
  });
}

/** Our readers never produce internal HP files or invent their availability. */
export function contentManifest(config) {
  return config.spaces.filter((space) => typeof space.plan_url === 'string' && space.plan_url)
    .map((space) => ({
      kind: 'plan', owner: 'space', owner_id: space.id, field: 'plan_url',
      url: space.plan_url, storage: 'external', exists_at_export: null,
    }));
}

function hostCandidate(opening, carrier, kind) {
  if (!(carrier.cm > 0)) return null;
  const [ax, ay] = carrier.a, [bx, by] = carrier.b;
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (!(length > 0) || !(opening.length > 0)) return null;
  const t = ((opening.x - ax) * dx + (opening.y - ay) * dy) / (length * length);
  const x = ax + t * dx, y = ay + t * dy;
  const distance = Math.hypot(opening.x - x, opening.y - y);
  const direction = opening.angle * Math.PI / 180;
  const sine = Math.abs((Math.cos(direction) * dy - Math.sin(direction) * dx) / length);
  const half = opening.length / (2 * length);
  if (distance > 1e-7 || sine > Math.sin(8 * Math.PI / 180) + 1e-9
      || t < half - 1e-8 || t > 1 - half + 1e-8) return null;
  const sameDirection = Math.cos(direction) * dx + Math.sin(direction) * dy >= 0;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI + (sameDirection ? 0 : 180);
  angle = ((angle + 180) % 360 + 360) % 360 - 180;
  return { kind, id: carrier.id, t: Math.max(half, Math.min(1 - half, t)),
    x, y, angle, distance };
}

export function modernDocument(space, options = {}) {
  finiteTree({ space, markers: options.markers, layout: options.layout });
  if (options.planOnly && (options.markers?.length || Object.keys(options.layout || {}).length || space.plan_url))
    throw new OutputError('invalid_plan_only');
  const raw = clone(space);
  const openings = raw.openings || [];
  delete raw.openings;
  targetLimits(raw, options.markers || [], options.layout || {});
  let config = commitWallSegmentModel({ spaces: [raw], markers: clone(options.markers || []) }).config;
  const current = config.spaces[0];
  const notes = [];
  const carriers = [
    ...(current.wall_segments || []).map((item) => [item, 'wall']),
    ...(current.partitions || []).map((item) => [item, 'partition']),
  ];
  current.openings = [];
  for (const opening of openings) {
    if (!(opening.length >= 0.001 && opening.length <= LIMITS.CANVAS_LIMIT)) {
      notes.push({ code: 'opening_size_unsupported', id: opening.id }); continue;
    }
    let candidates = carriers.map(([item, kind]) => hostCandidate(opening, item, kind)).filter(Boolean);
    if (opening.host) candidates = candidates.filter((candidate) =>
      candidate.id === opening.host.id && candidate.kind === opening.host.kind);
    candidates.sort((a, b) => a.distance - b.distance);
    const host = candidates[0];
    if (!host || (candidates[1] && Math.abs(candidates[1].distance - host.distance) <= 1e-9)) {
      notes.push({ code: host ? 'opening_ambiguous' : 'opening_unhosted', id: opening.id });
      continue;
    }
    current.openings.push({ ...opening,
      x: canonical(host.x), y: canonical(host.y), angle: canonical(host.angle),
      host: { kind: host.kind, id: host.id, t: canonical(host.t) } });
  }
  if (!current.openings.length) delete current.openings;
  config = commitWallSegmentModel(config).config;
  delete config.model_version;
  const layout = clone(options.layout || {});
  targetLimits(config.spaces[0], config.markers, layout);
  const document = {
    format: 'houseplan-export', export_version: 2, kind: 'space',
    created_at: options.now || new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    card_version: options.toolVersion || 'plan-convert 0.2',
    integration_version: options.toolVersion || 'plan-convert 0.2',
    model_version: CURRENT_MODEL_VERSION, payload: { config, layout },
    placement_manifest: placementManifest(config, layout), content_manifest: contentManifest(config),
    ...(options.planOnly ? { transfer: { plan_only: true } } : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(config)).length > MAX_CONFIG_BYTES
      || new TextEncoder().encode(JSON.stringify(document)).length > MAX_OUTPUT_BYTES)
    throw new OutputError('output_too_large');
  return { document, notes };
}
