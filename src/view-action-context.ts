import type { DevItem, OpeningCfg } from './types';

export interface ViewActionContext { readonly spaceId: string; readonly id: string }

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
