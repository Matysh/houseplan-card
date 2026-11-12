/** Persisted opening v1, shared by symbols, optics, dialogs and copy. No DOM or HA writes. */
import type {
  MotionOpeningFeatures, OpeningCfg, OpeningLeaf, OpeningManualPosition,
  OpeningShade, WindowOpeningFeatures,
} from './types';
import { openingAmount, pointInPolygon, roomPoly } from './logic';

export const OPENING_FEATURES_API = 1;
export const openingSlideDirection = (features?: MotionOpeningFeatures | null): 'start' | 'end' =>
  features?.slide_direction === 'start' ? 'start' : 'end';
export interface OpeningEntityState { state: string; attributes?: { current_position?: unknown } }
export type OpeningStateReader = (entity: string) => OpeningEntityState | null | undefined;
export interface OpeningPosition {
  readonly source: 'manual' | 'entity';
  /** null remains unknown, including when an assigned entity disappears. */
  readonly amount: number | null;
}
export type OpeningInterval = readonly [number, number];
export interface ResolvedOpeningLeaf {
  readonly id: string;
  readonly hinge: OpeningLeaf['hinge'];
  readonly amount: number;
  readonly unknown: boolean;
  readonly sensorDriven: boolean;
  readonly shade?: OpeningPosition;
}
export interface ResolvedOpeningVisual {
  readonly mechanism: 'swing' | 'slide';
  readonly direction: 'start' | 'end';
  readonly side: 'negative' | 'positive';
  readonly leaves?: readonly ResolvedOpeningLeaf[];
  readonly unsupported: boolean;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const fail = (): never => { throw new Error('invalid_opening_features'); };
function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) fail();
}
function positionFields(value: Record<string, unknown>): void {
  if (own(value, 'manual') && value.manual !== 'open' && value.manual !== 'closed') fail();
  if (own(value, 'invert') && typeof value.invert !== 'boolean') fail();
  if (own(value, 'contact') && value.contact !== null
      && (typeof value.contact !== 'string' || !value.contact.trim() || value.contact.length > 512)) fail();
}

/** Reject mixed/future forms before any repair or normalization can erase them. */
export function assertOpeningFeatures(opening: Pick<OpeningCfg, 'type'> & { opening_features?: unknown }): void {
  if (!own(opening, 'opening_features')) return;
  const f = opening.opening_features;
  if (!record(f) || f.version !== 1) fail();
  if (opening.type === 'window') {
    keys(f, ['version', 'side', 'leaves']);
    if (f.side !== 'negative' && f.side !== 'positive') fail();
    if (!Array.isArray(f.leaves) || f.leaves.length < 1 || f.leaves.length > 4) fail();
    if (['contact', 'invert', 'flip_h', 'flip_v'].some(key => own(opening, key))) fail();
    const ids = new Set<string>();
    for (const leaf of f.leaves as unknown[]) {
      keys(leaf, ['id', 'hinge', 'manual', 'contact', 'invert', 'shade']);
      const id = leaf.id;
      if (typeof id !== 'string' || !id.trim() || id.length > 120 || ids.has(id)) return fail();
      ids.add(id);
      if (typeof leaf.hinge !== 'string' || !['start', 'end', 'top'].includes(leaf.hinge)) fail();
      positionFields(leaf);
      if (own(leaf, 'shade')) {
        keys(leaf.shade, ['enabled', 'manual', 'contact', 'invert']);
        if (typeof leaf.shade.enabled !== 'boolean') fail();
        positionFields(leaf.shade);
      }
    }
  } else if (opening.type === 'door' || opening.type === 'gate') {
    keys(f, ['version', 'mechanism', 'slide_direction', 'manual']);
    if (own(f, 'mechanism') && (typeof f.mechanism !== 'string' || !['swing', 'slide'].includes(f.mechanism))) fail();
    if (own(f, 'slide_direction') && (typeof f.slide_direction !== 'string' || !['start', 'end'].includes(f.slide_direction))) fail();
    positionFields(f);
  } else fail();
}

export function windowOpeningFeatures(opening: Pick<OpeningCfg, 'type' | 'opening_features'>): WindowOpeningFeatures | null {
  const f = opening.opening_features;
  return opening.type === 'window' && f?.version === 1 && 'leaves' in f ? f : null;
}
export function motionOpeningFeatures(opening: Pick<OpeningCfg, 'type' | 'opening_features'>): MotionOpeningFeatures | null {
  const f = opening.opening_features;
  return (opening.type === 'door' || opening.type === 'gate') && f?.version === 1 && !('leaves' in f) ? f : null;
}

/** Assigned unknown does not consult manual or invert the default pose. */
export function resolveOpeningPosition(
  config: Pick<OpeningLeaf, 'contact' | 'invert' | 'manual'> | OpeningShade,
  fallback: OpeningManualPosition, read: OpeningStateReader,
): OpeningPosition {
  if (!config.contact) return { source: 'manual', amount: (config.manual || fallback) === 'open' ? 1 : 0 };
  const entity = read(config.contact);
  if (!entity || ['unknown', 'unavailable'].includes(entity.state)) return { source: 'entity', amount: null };
  return { source: 'entity', amount: openingAmount(
    'window', entity.state, config.invert, entity.attributes?.current_position,
  ) };
}

export function resolvedOpeningAmount(opening: OpeningCfg, read: OpeningStateReader): number {
  const motion = motionOpeningFeatures(opening);
  if (motion) return resolveOpeningPosition({ contact: opening.contact, invert: opening.invert,
    manual: motion.manual }, 'open', read).amount ?? 1;
  const entity = opening.contact ? read(opening.contact) : null;
  return openingAmount(opening.type, entity?.state, !!opening.invert, entity?.attributes?.current_position);
}

export function openingWindowHandleSides(
  opening: { type: string; rx: number; ry: number; angle: number },
  rooms: readonly unknown[], wallCm: number, cellCm: number, gridPitch: number,
): readonly [boolean, boolean] {
  if (opening.type !== 'window') return [false, false];
  const angle = opening.angle * Math.PI / 180, offset = wallCm / cellCm * gridPitch / 2 + gridPitch * .1;
  return [-1, 1].map(sign => rooms.some(room => {
    const poly = roomPoly(room);
    return poly && pointInPolygon([opening.rx - Math.sin(angle) * offset * sign,
      opening.ry + Math.cos(angle) * offset * sign], poly);
  })) as [boolean, boolean];
}

/** Only an explicit use of a new setting calls this; reads and unrelated Save never do. */
export function materializeWindowFeatures(opening: OpeningCfg, nextId: () => string): OpeningCfg {
  if (windowOpeningFeatures(opening)) return structuredClone(opening);
  if (opening.opening_features !== undefined || opening.type !== 'window') throw new Error('invalid_opening_features');
  const result = structuredClone(opening);
  const bound = opening.contact ? { contact: opening.contact, ...(opening.invert ? { invert: true } : {}) } : {};
  result.opening_features = { version: 1, side: opening.flip_v ? 'positive' : 'negative', leaves: [
    { id: nextId(), hinge: 'start', manual: 'closed', ...bound },
    { id: nextId(), hinge: 'end', manual: 'closed', ...bound },
  ] };
  delete result.contact; delete result.invert; delete result.flip_h; delete result.flip_v;
  return result;
}

/** Resolve once against the caller's immutable HA frame, never against DOM/lab state. */
export function resolveOpeningVisual(opening: OpeningCfg, read: OpeningStateReader, implicitAmount: number): ResolvedOpeningVisual {
  const f = windowOpeningFeatures(opening), motion = motionOpeningFeatures(opening);
  const unsupported = opening.opening_features !== undefined && !f && !motion;
  const result: ResolvedOpeningVisual = {
    mechanism: motion?.mechanism || 'swing', direction: openingSlideDirection(motion),
    side: f?.side || (opening.flip_v ? 'positive' : 'negative'), unsupported,
  };
  if (unsupported || opening.type !== 'window') return result;
  const leaves: OpeningLeaf[] = f?.leaves || [
    { id: 'legacy-start', hinge: 'start', contact: opening.contact, invert: opening.invert },
    { id: 'legacy-end', hinge: 'end', contact: opening.contact, invert: opening.invert },
  ];
  return { ...result, leaves: leaves.map(leaf => {
    const position = f ? resolveOpeningPosition(leaf, 'closed', read) : null;
    return { id: leaf.id, hinge: leaf.hinge, amount: position?.amount ?? (f ? 0 : implicitAmount),
      unknown: !!position && position.amount === null, sensorDriven: !!leaf.contact,
      ...(leaf.shade?.enabled ? { shade: resolveOpeningPosition(leaf.shade, 'open', read) } : {}),
    };
  }) };
}

/** Merge allowed neighbours BEFORE optical geometry, retaining the full parent aperture. */
export function openingTransmissionIntervals(opening: OpeningCfg, read: OpeningStateReader): OpeningInterval[] {
  const f = windowOpeningFeatures(opening);
  if (!f) return opening.type === 'window' && opening.opening_features !== undefined ? [] : [[0, 1]];
  const intervals: [number, number][] = [];
  for (let i = 0; i < f.leaves.length; i++) {
    const shade = f.leaves[i].shade;
    if (shade?.enabled && resolveOpeningPosition(shade, 'open', read).amount === 0) continue;
    const start = i / f.leaves.length, end = (i + 1) / f.leaves.length;
    const last = intervals[intervals.length - 1];
    if (last && last[1] === start) last[1] = end;
    else intervals.push([start, end]);
  }
  return intervals;
}

/** One basis half-turn; callers supply intended physical angle before normalization. */
export function reparameterizeOpeningFeatures(opening: OpeningCfg, intendedAngle: number): OpeningCfg {
  if (!Number.isFinite(intendedAngle)) throw new Error('invalid_opening_angle');
  const turns = Math.floor((intendedAngle + 90) / 180);
  const result = structuredClone(opening);
  result.angle = intendedAngle - 180 * turns;
  if (result.angle === 0) result.angle = 0;
  if (Math.abs(turns % 2) !== 1) return result;
  const window = windowOpeningFeatures(result);
  if (window) {
    window.leaves.reverse();
    for (const leaf of window.leaves) if (leaf.hinge !== 'top') leaf.hinge = leaf.hinge === 'start' ? 'end' : 'start';
    window.side = window.side === 'negative' ? 'positive' : 'negative';
  }
  const motion = motionOpeningFeatures(result);
  // Retained inactive direction also changes. Physical face is resolved by the carrier caller.
  if (motion && (motion.mechanism === 'slide' || motion.slide_direction))
    motion.slide_direction = openingSlideDirection(motion) === 'start' ? 'end' : 'start';
  return result;
}

/** Detached copy/plan-only projection; keep manual defaults, IDs and disabled shade settings. */
export function clearOpeningBindings<T extends OpeningCfg>(opening: T): T {
  const result = structuredClone(opening);
  delete result.contact; delete result.lock;
  for (const leaf of windowOpeningFeatures(result)?.leaves || []) {
    delete leaf.contact;
    if (leaf.shade) delete leaf.shade.contact;
  }
  return result;
}
