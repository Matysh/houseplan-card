export interface DevicePlacement {
  x: number;
  y: number;
  s?: string;
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
}

export function devicePlacement(layout: DeviceLayout, deviceId: string): DevicePlacement | null {
  const entry = layout[deviceId];
  if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null;
  return {
    x: entry.x,
    y: entry.y,
    ...(typeof entry.s === 'string' ? { s: entry.s } : {}),
  };
}

export function sameDevicePlacement(
  left: DevicePlacement | null,
  right: DevicePlacement | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.x === right.x && left.y === right.y && left.s === right.s;
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
  const entry: DeviceLayoutEntry = {
    ...current,
    x: placement.x,
    y: placement.y,
    ...(placement.s !== undefined ? { s: placement.s } : {}),
  };
  return { ...layout, [deviceId]: entry };
}
