import type { DevItem } from './types';

/** Keep off-floor light drivers/targets of a visible marker in its HA frame.
 * Their faces are not painted; only their authoritative rows are demanded. */
export function snapshotDeviceDemand(devices: readonly DevItem[], space?: string, showGhosts = false): readonly DevItem[] {
  if (space === undefined) return devices;
  const selected = new Set(devices.filter(device => device.space === space && (!device.hidden || showGhosts)
    && !device.marker?.removed));
  const refs = (device: DevItem): string[] => [
    `marker:${device.id}`, ...device.entities.map(id => `entity:${id}`),
    ...(device.primary ? [`entity:${device.primary}`] : []),
  ];
  const controls = (device: DevItem): string[] => [...device.controls || [], ...device.marker?.controls || []]
    .map(ref => ref.startsWith('marker:') ? ref : `entity:${ref}`);
  let changed = true;
  while (changed) {
    changed = false;
    const owned = new Set([...selected].flatMap(refs)), targets = new Set([...selected].flatMap(controls));
    for (const device of devices) if (!selected.has(device)
        && (refs(device).some(ref => targets.has(ref)) || controls(device).some(ref => owned.has(ref)))) {
      selected.add(device); changed = true;
    }
  }
  return devices.filter(device => selected.has(device));
}
