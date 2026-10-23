import {contentFingerprint} from './visual-continuity';

export interface DevicePlacement {
  x: number;
  y: number;
  s?: string;
  contact_basis?: unknown;
}

export interface DeviceLayoutEntry extends Record<string, unknown> {
  x: number;
  y: number;
  s?: string;
  k?: number;
}

export type DeviceLayout = Record<string, DeviceLayoutEntry>;

export interface DevicePositionState {
  deviceId: string;
  spaceId: string;
  placement: DevicePlacement | null;
  related?: Array<{deviceId:string;spaceId:string;placement:DevicePlacement|null}>;
}

/** #931: only changed visual keys, including absence/null, belong to this command. */
export interface DeviceVisualState {
  kind: 'visual'; deviceId: string; spaceId: string; binding: string;
  fields: Array<{ key: 'angle' | 'size'; present: boolean; value?: number | null }>;
}

export type DeviceEditorHistoryState = DevicePositionState | DeviceVisualState;

export function deviceVisualFields(
  marker: { angle?: number | null; size?: number | null }, keys: Array<'angle' | 'size'>,
): DeviceVisualState['fields'] {
  return keys.map(key => ({ key, present: Object.prototype.hasOwnProperty.call(marker, key),
    ...(Object.prototype.hasOwnProperty.call(marker, key) ? { value: marker[key] } : {}) }));
}

export function applyDeviceVisualFields<T extends { angle?: number | null; size?: number | null }>(
  marker: T, fields: DeviceVisualState['fields'],
): T {
  const result = { ...marker };
  for (const field of fields) {
    if (field.present) result[field.key] = field.value;
    else delete result[field.key];
  }
  return result;
}

export function devicePlacement(layout: DeviceLayout, deviceId: string): DevicePlacement | null {
  const entry = layout[deviceId];
  if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null;
  return {
    x: entry.x,
    y: entry.y,
    ...(typeof entry.s === 'string' ? { s: entry.s } : {}),
    ...(Object.prototype.hasOwnProperty.call(entry,'contact_basis') ? {contact_basis:structuredClone(entry.contact_basis)} : {}),
  };
}

export function sameDevicePlacement(
  left: DevicePlacement | null,
  right: DevicePlacement | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.x === right.x && left.y === right.y && left.s === right.s
    && contentFingerprint(left.contact_basis)===contentFingerprint(right.contact_basis);
}

/**
 * Apply only placement fields. Existing/future sibling fields deliberately
 * survive an update; a null placement removes the complete persisted position
 * record because the layout schema does not permit a record without x/y.
 */
export function applyDevicePlacement(
  layout: DeviceLayout,
  deviceId: string,
  placement: DevicePlacement | null,
): DeviceLayout {
  if (placement === null) {
    if (!(deviceId in layout)) return layout;
    const next = { ...layout };
    delete next[deviceId];
    return next;
  }

  const current = { ...(layout[deviceId] || {}) } as Record<string, unknown>;
  delete current.x;
  delete current.y;
  delete current.s;
  delete current.contact_basis;
  const entry: DeviceLayoutEntry = {
    ...current,
    x: placement.x,
    y: placement.y,
    ...(placement.s !== undefined ? { s: placement.s } : {}),
    ...(Object.prototype.hasOwnProperty.call(placement,'contact_basis') ? {contact_basis:structuredClone(placement.contact_basis)} : {}),
  };
  return { ...layout, [deviceId]: entry };
}
