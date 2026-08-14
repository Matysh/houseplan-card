/** Runtime-only persistent state for manually toggled virtual lights (#107). */
export interface VirtualLightSnapshot {
  rev: number;
  configRev: number;
  off: ReadonlySet<string>;
}

export interface VirtualLightWireSnapshot {
  rev?: unknown;
  config_rev?: unknown;
  off?: unknown;
}

export interface VirtualLightEvent {
  marker_id?: unknown;
  on?: unknown;
  rev?: unknown;
}

const nonNegative = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizedSnapshot = (
  raw: VirtualLightWireSnapshot | null | undefined,
  configRev: number,
): { snapshot: VirtualLightSnapshot; valid: boolean } => {
  const fallback: VirtualLightSnapshot = {
    rev: 0,
    configRev: nonNegative(configRev),
    off: new Set(),
  };
  if (raw == null) return { snapshot: fallback, valid: false };
  const off = raw.off;
  if (!Number.isInteger(raw.rev) || Number(raw.rev) < 0
      || !Number.isInteger(raw.config_rev) || Number(raw.config_rev) < 0
      || !Array.isArray(off)
      || off.some((id) => typeof id !== 'string' || !id)) {
    return { snapshot: fallback, valid: false };
  }
  return {
    snapshot: {
      rev: Number(raw.rev),
      configRev: Number(raw.config_rev),
      off: new Set(off as string[]),
    },
    valid: true,
  };
};

export function virtualLightSnapshot(
  raw: VirtualLightWireSnapshot | null | undefined,
  configRev = 0,
): VirtualLightSnapshot {
  return normalizedSnapshot(raw, configRev).snapshot;
}

/** Adopt a config/get result without letting an older response undo a live event. */
export function adoptVirtualLightServerSnapshot(
  current: VirtualLightSnapshot,
  raw: VirtualLightWireSnapshot | null | undefined,
  configRev: number,
  fieldPresent: boolean,
): VirtualLightSnapshot {
  const incoming = normalizedSnapshot(raw, configRev);
  if (!fieldPresent || !incoming.valid || incoming.snapshot.configRev !== configRev) {
    return virtualLightSnapshot(null, configRev);
  }
  if (current.configRev === configRev && incoming.snapshot.rev < current.rev) return current;
  return incoming.snapshot;
}

export function virtualLightWire(snapshot: VirtualLightSnapshot): Required<VirtualLightWireSnapshot> {
  return {
    rev: snapshot.rev,
    config_rev: snapshot.configRev,
    off: [...snapshot.off].sort(),
  };
}

export function virtualLightFingerprint(snapshot: VirtualLightSnapshot | null | undefined): string {
  if (!snapshot) return '0:0:';
  return `${snapshot.configRev}:${snapshot.rev}:${[...snapshot.off].sort().join(',')}`;
}

export function isManualVirtualLightMarker(marker: any): boolean {
  return !!marker
    && typeof marker.id === 'string'
    && !!marker.id
    && marker.binding === 'virtual'
    && marker.is_light === true
    && marker.tap_action === 'toggle'
    && marker.removed !== true;
}

export function virtualLightIsOn(
  marker: any,
  snapshot: VirtualLightSnapshot | null | undefined,
): boolean {
  return !isManualVirtualLightMarker(marker) || !snapshot?.off.has(marker.id);
}

/** Apply an event/reply only when it advances the current durable revision. */
export function applyVirtualLightEvent(
  current: VirtualLightSnapshot,
  event: VirtualLightEvent | null | undefined,
): VirtualLightSnapshot {
  const markerId = typeof event?.marker_id === 'string' ? event.marker_id : '';
  const rev = nonNegative(event?.rev, -1);
  if (!markerId || typeof event?.on !== 'boolean' || rev <= current.rev) return current;
  const off = new Set(current.off);
  if (event.on) off.delete(markerId);
  else off.add(markerId);
  return { ...current, rev, off };
}

/** Carry state across a configuration revision accepted by this client. */
export function reconcileVirtualLightSnapshot(
  current: VirtualLightSnapshot,
  config: any,
  configRev: number,
): VirtualLightSnapshot {
  if (current.configRev === configRev) return current;
  const eligible = new Set(
    (Array.isArray(config?.markers) ? config.markers : [])
      .filter(isManualVirtualLightMarker)
      .map((marker: any) => marker.id),
  );
  return {
    ...current,
    configRev,
    off: new Set([...current.off].filter((id) => eligible.has(id))),
  };
}
