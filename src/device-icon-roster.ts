/** One read-only icon roster for paint and editor reference points (#893). */
export interface IconMarker {
  id: string;
  space: string;
  hidden?: boolean;
  marker?: { removed?: boolean } | null;
  bindingStatus?: { kind: string } | null;
}

/** LED replacements are not icons; tombstones are never a renderable ghost. */
export function visibleIconMarkers<D extends IconMarker>(
  devices: readonly D[], space: string, leds: { has(id: string): boolean }, showGhosts = false,
): D[] {
  return devices.filter((d) => d.space === space && (!d.hidden || showGhosts)
    && d.marker?.removed !== true && !leds.has(d.id));
}

/** Hidden/disabled service entries can open settings, but are not alignment anchors. */
export function positionableIconMarkers<D extends IconMarker>(
  devices: readonly D[], space: string, leds: { has(id: string): boolean }, movingId?: string,
): D[] {
  return visibleIconMarkers(devices, space, leds)
    .filter((d) => d.id !== movingId && d.bindingStatus?.kind !== 'ha_disabled');
}
