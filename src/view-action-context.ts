import type { DevItem, OpeningCfg } from './types';

export interface ViewActionContext { readonly spaceId: string; readonly id: string }

/** Consume only the captured current intent, before calling its action. */
export function acceptTapConfirmation<T extends { exec(): void }>(
  confirmation: T | null, current: T | null, clear: () => void,
): void {
  if (!confirmation || current !== confirmation) return;
  clear();
  confirmation.exec();
}

/** Current canonical carrier only; never search an identically named other floor. */
export function openingActionTargetCurrent(
  space: { id: string; openings?: readonly OpeningCfg[] } | null | undefined,
  activeSpace: string,
  context: ViewActionContext | null,
  shownOpeningId: string | undefined,
  entityId: string,
): boolean {
  if (!context || context.spaceId !== activeSpace || space?.id !== activeSpace
    || shownOpeningId !== context.id) return false;
  const opening = space.openings?.find((item) => item.id === context.id);
  return !!opening && (opening.type === 'door' || opening.type === 'gate')
    && opening.lock === entityId;
}

export function currentMarkerActionDevice(
  devices: readonly DevItem[], activeSpace: string, context: ViewActionContext,
): DevItem | null {
  if (activeSpace !== context.spaceId) return null;
  return devices.find((item) => item.id === context.id && item.space === context.spaceId) ?? null;
}

/** A marker's stable binding identity excludes volatile HA state and presentation. */
export function markerSettingsTargetKey(device: DevItem): string {
  return JSON.stringify([device.id, device.space, device.bindingKind,
    device.bindingRef, device.marker?.binding]);
}

export function currentMarkerSettingsDevice(
  devices: readonly DevItem[], activeSpace: string, context: ViewActionContext, bindingKey: string,
): DevItem | null {
  const current = currentMarkerActionDevice(devices, activeSpace, context);
  return current && !current.hidden && markerSettingsTargetKey(current) === bindingKey ? current : null;
}

/** State ticks may change direction, but a replaced binding/card row set may not act. */
export function infoCardRowContextKey(
  device: DevItem, rows: readonly { eid: string; kind: string }[],
): string {
  return JSON.stringify([
    device.id, device.space, device.bindingKind, device.bindingRef, device.marker?.binding,
    [...(device.controls ?? device.marker?.controls ?? [])].sort(),
    rows.map(({ eid, kind }) => [eid, kind]).sort((a, b) => a[0].localeCompare(b[0])),
  ]);
}
