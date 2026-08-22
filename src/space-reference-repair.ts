/**
 * Lossless/bounded repair for space-owned references.
 *
 * This pass is explicit (Optimize only). It deliberately keeps opaque layout
 * and nested calibration data unless there is either an exact import
 * signature or the production placement snapshot supplies one unambiguous HA
 * Area. Inputs are never mutated.
 */

export interface SpaceReferenceRepairContext {
  /** Effective Area from the same buildDevices snapshot used by View. */
  effectiveAreaByMarker?: Readonly<Record<string, string>>;
}

export interface SpaceReferenceReport {
  spaceRefsRemapped: number;
  roomRefsRemapped: number;
  positionsRemapped: number;
  markersDetached: number;
  positionsUnresolved: number;
  nestedRefsUnresolved: number;
  deadSpaceIds: string[];
}

export interface SpaceReferenceRepairResult {
  config: any;
  layout: Record<string, any>;
  report: SpaceReferenceReport;
  changed: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const own = (value: any, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);
const reversibleStem = (prefix: 'space' | 'room', value: string): boolean => (
  value.length > 0 && value.length <= 35
  && (prefix === 'space' ? /^[a-z0-9_-]+$/.test(value) : /^[A-Za-z0-9_-]+$/.test(value))
);
const addCandidate = (map: Map<string, string[]>, oldId: string, candidate: string): void => {
  const values = map.get(oldId) || [];
  values.push(candidate);
  map.set(oldId, values);
};

/**
 * Repair references against the current set of spaces. The caller may run
 * this before the geometry optimizer; all indexes are built once, keeping the
 * pass linear apart from bounded per-space room maps.
 */
export function repairSpaceReferences(
  configIn: any,
  layoutIn: Record<string, any>,
  context: SpaceReferenceRepairContext = {},
): SpaceReferenceRepairResult {
  const config = clone(configIn || { spaces: [], markers: [], settings: {} });
  const layout = clone(layoutIn || {});
  const beforeConfig = JSON.stringify(config);
  const beforeLayout = JSON.stringify(layout);
  const spaces = Array.isArray(config.spaces) ? config.spaces : [];
  const markers = Array.isArray(config.markers) ? config.markers : [];

  const spaceIds = spaces
    .map((space: any) => typeof space?.id === 'string' ? space.id : '')
    .filter(Boolean);
  const existingSpaceIds = new Set(spaceIds);
  const spaceSignatures = new Map<string, string[]>();
  for (const spaceId of spaceIds) {
    const signature = /^space_(.+)_([0-9a-f]{8})$/.exec(spaceId);
    if (signature) addCandidate(spaceSignatures, signature[1], spaceId);
  }
  const roomSignaturesBySpace = new Map<string, Map<string, string[]>>();
  const roomOwner = new Map<string, string>();
  const roomsByArea = new Map<string, { spaceId: string; roomId: string }[]>();
  for (const space of spaces) {
    const spaceId = typeof space?.id === 'string' ? space.id : '';
    if (!spaceId) continue;
    const roomSignatures = new Map<string, string[]>();
    for (const room of Array.isArray(space.rooms) ? space.rooms : []) {
      const roomId = typeof room?.id === 'string' ? room.id : '';
      if (!roomId) continue;
      const signature = /^room_(.+)_([0-9a-f]{8})$/.exec(roomId);
      if (signature) addCandidate(roomSignatures, signature[1], roomId);
      if (!roomOwner.has(roomId)) roomOwner.set(roomId, spaceId);
      const area = typeof room.area === 'string' ? room.area : '';
      if (area) {
        const values = roomsByArea.get(area) || [];
        values.push({ spaceId, roomId });
        roomsByArea.set(area, values);
      }
    }
    roomSignaturesBySpace.set(spaceId, roomSignatures);
  }
  const existingRoomIds = new Set(roomOwner.keys());
  const activeMarkerIds = new Set<string>();
  const removedMarkerIds = new Set<string>();
  for (const marker of markers) {
    if (typeof marker?.id !== 'string' || !marker.id) continue;
    (marker.removed === true ? removedMarkerIds : activeMarkerIds).add(marker.id);
  }

  const report: SpaceReferenceReport = {
    spaceRefsRemapped: 0,
    roomRefsRemapped: 0,
    positionsRemapped: 0,
    markersDetached: 0,
    positionsUnresolved: 0,
    nestedRefsUnresolved: 0,
    deadSpaceIds: [],
  };
  const handledLayout = new Set<string>();

  const signatureSpace = (oldId: string): string | null => (
    existingSpaceIds.has(oldId) || !reversibleStem('space', oldId)
      ? null
      : (spaceSignatures.get(oldId)?.length === 1 ? spaceSignatures.get(oldId)![0] : null)
  );
  const exactRoom = (oldId: string, targetSpace: string): string | null => {
    if (!reversibleStem('room', oldId)) return null;
    const candidates = roomSignaturesBySpace.get(targetSpace)?.get(oldId) || [];
    return candidates.length === 1 ? candidates[0] : null;
  };
  const uniqueAreaRoom = (markerId: string): { spaceId: string; roomId: string } | null => {
    const area = context.effectiveAreaByMarker?.[markerId] || '';
    const candidates = area ? roomsByArea.get(area) || [] : [];
    return candidates.length === 1 ? candidates[0] : null;
  };

  const repairRoomAndNested = (
    marker: any,
    targetSpace: string | null,
    areaRoom: { spaceId: string; roomId: string } | null,
  ): void => {
    if (typeof marker.room_id === 'string' && marker.room_id
        && !existingRoomIds.has(marker.room_id)) {
      const mapped = targetSpace ? exactRoom(marker.room_id, targetSpace) : null;
      if (mapped) {
        marker.room_id = mapped;
        report.roomRefsRemapped++;
      } else if (areaRoom) {
        marker.room_id = areaRoom.roomId;
        report.roomRefsRemapped++;
      } else if (marker.removed !== true) {
        delete marker.room_id;
      }
    }
    const segmentMap = marker.vacuum?.segment_map;
    if (!segmentMap || typeof segmentMap !== 'object' || Array.isArray(segmentMap)) return;
    for (const key of Object.keys(segmentMap)) {
      const oldRoom = segmentMap[key];
      if (typeof oldRoom !== 'string' || !oldRoom || existingRoomIds.has(oldRoom)) continue;
      const mapped = targetSpace ? exactRoom(oldRoom, targetSpace) : null;
      if (mapped) {
        segmentMap[key] = mapped;
        report.roomRefsRemapped++;
      } else {
        report.nestedRefsUnresolved++;
      }
    }
  };

  for (const marker of markers) {
    const markerId = typeof marker?.id === 'string' ? marker.id : '';
    if (!markerId) continue;
    const storedSpace = typeof marker.space === 'string' ? marker.space : '';
    const deadMarkerSpace = storedSpace && !existingSpaceIds.has(storedSpace);
    const position = layout[markerId];
    const positionSpace = typeof position?.s === 'string' ? position.s : '';
    const deadPosition = positionSpace && !existingSpaceIds.has(positionSpace);
    const isRemoved = marker.removed === true;

    let targetSpace = storedSpace && existingSpaceIds.has(storedSpace) ? storedSpace : null;
    let areaRoom: { spaceId: string; roomId: string } | null = null;
    let exact = false;
    if (deadMarkerSpace) {
      const signature = signatureSpace(storedSpace);
      if (signature) {
        marker.space = signature;
        targetSpace = signature;
        exact = true;
        report.spaceRefsRemapped++;
      } else if (!isRemoved && marker.binding !== 'virtual') {
        areaRoom = uniqueAreaRoom(markerId);
        if (areaRoom) {
          marker.space = areaRoom.spaceId;
          targetSpace = areaRoom.spaceId;
          report.spaceRefsRemapped++;
        } else {
          delete marker.space;
          targetSpace = null;
          report.markersDetached++;
        }
      } else if (!isRemoved) {
        delete marker.space;
        targetSpace = null;
        report.markersDetached++;
      }
    }

    if (!isRemoved || exact) repairRoomAndNested(marker, targetSpace, areaRoom);

    if (deadPosition) {
      if (exact && positionSpace === storedSpace && targetSpace) {
        layout[markerId] = { ...position, s: targetSpace };
        report.positionsRemapped++;
        handledLayout.add(markerId);
      } else if (!isRemoved) {
        // Coordinates from an unrelated/deleted plan must not be transplanted.
        delete layout[markerId];
        handledLayout.add(markerId);
      }
    }
  }

  // Layout without an active marker owner remains user data. Only the exact
  // independent-copy signature is sufficient to rewrite it automatically.
  for (const key of Object.keys(layout)) {
    if (handledLayout.has(key)) continue;
    const position = layout[key];
    const oldSpace = typeof position?.s === 'string' ? position.s : '';
    if (!oldSpace || existingSpaceIds.has(oldSpace)) continue;
    const targetSpace = signatureSpace(oldSpace);
    if (!targetSpace) continue;

    if (key.startsWith('rl_')) {
      const oldRoom = key.slice(3);
      const targetRoom = exactRoom(oldRoom, targetSpace);
      if (targetRoom) {
        const targetKey = `rl_${targetRoom}`;
        if (!own(layout, targetKey)) layout[targetKey] = { ...position, s: targetSpace };
        delete layout[key];
        report.roomRefsRemapped++;
        report.positionsRemapped++;
        continue;
      }
    }
    layout[key] = { ...position, s: targetSpace };
    report.positionsRemapped++;
  }

  const remainingDead = new Set<string>();
  for (const marker of markers) {
    const value = typeof marker?.space === 'string' ? marker.space : '';
    if (value && !existingSpaceIds.has(value)) remainingDead.add(value);
  }
  for (const [key, position] of Object.entries(layout)) {
    const value = typeof (position as any)?.s === 'string' ? (position as any).s : '';
    if (!value || existingSpaceIds.has(value)) continue;
    remainingDead.add(value);
    // Active marker positions should have been deleted above. Count every
    // preserved opaque/removed owner once in the remaining warning.
    if (!activeMarkerIds.has(key) || removedMarkerIds.has(key)) report.positionsUnresolved++;
  }
  report.deadSpaceIds = [...remainingDead].sort((a, b) => a.localeCompare(b));

  return {
    config,
    layout,
    report,
    changed: JSON.stringify(config) !== beforeConfig || JSON.stringify(layout) !== beforeLayout,
  };
}
