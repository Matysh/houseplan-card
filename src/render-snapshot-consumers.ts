import { roomFillModeOf, roomGlowOf, type SpaceDisplay } from './logic';
import type { Marker, RoomCfg } from './types';

/** Non-marker consumers of the current painted frame, including draft previews. */
export interface SnapshotConsumerDemand {
  sources: string[];
  areas: string[];
  decor: boolean;
}

export function snapshotConsumerDemand(input: {
  spaceId: string;
  rooms: readonly RoomCfg[];
  markers: readonly Marker[];
  display: SpaceDisplay;
  mode: string;
  markup: boolean;
  tooltip: boolean;
  roomPreview?: { id: string | null; fill: string };
}): SnapshotConsumerDemand {
  const { display, mode, markup } = input;
  const labels = display.showNames || markup;
  const tooltip = mode === 'view' && input.tooltip;
  const sources = new Set<string>(), areas = new Set<string>();
  const aggregateAreas = new Set<string>(), aggregateRooms = new Set<string>();
  for (const room of input.rooms) {
    const fill = roomFillModeOf(display.fill, input.roomPreview && input.roomPreview.id === room.id
      ? { settings: { fill_mode: input.roomPreview.fill } } : room);
    let aggregate = false;
    for (const [needed, source] of [
      [tooltip || (labels && display.labelTemp) || fill === 'temp', room.settings?.temp_source],
      [tooltip || (labels && display.labelHum), room.settings?.hum_source],
      [tooltip || (labels && display.labelCo2), room.settings?.co2_source],
    ] as const) {
      if (!needed) continue;
      if (source) sources.add(source); else aggregate = true;
    }
    // Room light/Glow and LQI consume data even without a climate label.
    const light = (labels && display.labelLight) || fill === 'light' || roomGlowOf(display.glow, room);
    if (room.area && (aggregate || light || tooltip || (labels && display.labelLqi) || fill === 'lqi'))
      areas.add(room.area);
    if (aggregate || light) {
      if (room.area) aggregateAreas.add(room.area);
      else if (room.id) aggregateRooms.add(room.id);
    }
  }
  // Hiding a face does not remove its contribution to room aggregates. In
  // particular, a manually placed sensor may belong to no HA Area at all.
  for (const marker of input.markers) {
    if (marker.removed || !marker.binding || !/^(device|entity):/.test(marker.binding)) continue;
    if ((marker.area && aggregateAreas.has(marker.area))
        || (marker.area == null && marker.space === input.spaceId && marker.room_id
          && aggregateRooms.has(marker.room_id))) sources.add(marker.binding);
  }
  return { sources: [...sources], areas: [...areas], decor: !display.hideDecor || mode === 'decor' };
}
