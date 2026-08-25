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
  /** Full HA owner evidence. Absence is meaningful only when authoritative. */
  ownerRoster?: {
    authoritative: boolean;
    deviceIds?: readonly string[];
    entityIds?: readonly string[];
    /** User-facing names keyed by the persisted layout owner id. */
    names?: Readonly<Record<string, string>>;
  };
  /** Explicit preview opt-in; the default candidate preserves live owners. */
  removeLiveMissingPositions?: boolean;
}

export type SpaceReferenceOwnerKind = 'room_label' | 'device' | 'group' | 'unknown';

export interface SpaceReferencePositionDetail {
  id: string;
  spaceId: string;
  kind: SpaceReferenceOwnerKind;
  /** Empty when no safe human-readable name exists. */
  name: string;
  reason?: 'registry_unavailable' | 'unknown_owner';
}

export interface SpaceReferenceReport {
  spaceRefsRemapped: number;
  roomRefsRemapped: number;
  positionsRemapped: number;
  markersDetached: number;
  positionsUnresolved: number;
  nestedRefsUnresolved: number;
  deadSpaceIds: string[];
  orphanRoomLabelsRemoved: number;
  orphanDevicePositionsRemoved: number;
  orphanGroupPositionsRemoved: number;
  liveMissingPositionsRemoved: number;
  removedPositions: SpaceReferencePositionDetail[];
  liveMissingPositions: SpaceReferencePositionDetail[];
  unverifiedPositions: SpaceReferencePositionDetail[];
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

export interface ImportLineageRoot {
  root: string;
  layers: number;
  bounded: boolean;
}

/** Same strict, bounded import-id envelope as the backend import seam. */
export function canonicalImportRoot(prefix: string, value: string): ImportLineageRoot {
  let root = String(value ?? '');
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}_(.+)_([0-9a-f]{8})$`);
  let layers = 0;
  for (; layers < 16; layers++) {
    const match = pattern.exec(root);
    if (!match) return { root, layers, bounded: false };
    root = match[1];
  }
  return { root, layers, bounded: pattern.test(root) };
}
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
    const signature = canonicalImportRoot('space', spaceId);
    if (signature.layers > 0 && reversibleStem('space', signature.root)) {
      addCandidate(spaceSignatures, signature.root, spaceId);
    }
  }
  const roomSignaturesBySpace = new Map<string, Map<string, string[]>>();
  const roomOwner = new Map<string, string>();
  const roomNames = new Map<string, string>();
  const roomsByArea = new Map<string, { spaceId: string; roomId: string }[]>();
  for (const space of spaces) {
    const spaceId = typeof space?.id === 'string' ? space.id : '';
    if (!spaceId) continue;
    const roomSignatures = new Map<string, string[]>();
    for (const room of Array.isArray(space.rooms) ? space.rooms : []) {
      const roomId = typeof room?.id === 'string' ? room.id : '';
      if (!roomId) continue;
      const signature = canonicalImportRoot('room', roomId);
      if (signature.layers > 0 && reversibleStem('room', signature.root)) {
        addCandidate(roomSignatures, signature.root, roomId);
      }
      if (!roomOwner.has(roomId)) roomOwner.set(roomId, spaceId);
      if (!roomNames.has(roomId)) roomNames.set(roomId, String(room.name || ''));
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
  const activeMarkers = new Map<string, any>();
  const removedMarkers = new Map<string, any>();
  for (const marker of markers) {
    if (typeof marker?.id !== 'string' || !marker.id) continue;
    if (marker.removed === true) {
      removedMarkers.set(marker.id, marker);
    } else {
      activeMarkers.set(marker.id, marker);
    }
  }

  const report: SpaceReferenceReport = {
    spaceRefsRemapped: 0,
    roomRefsRemapped: 0,
    positionsRemapped: 0,
    markersDetached: 0,
    positionsUnresolved: 0,
    nestedRefsUnresolved: 0,
    deadSpaceIds: [],
    orphanRoomLabelsRemoved: 0,
    orphanDevicePositionsRemoved: 0,
    orphanGroupPositionsRemoved: 0,
    liveMissingPositionsRemoved: 0,
    removedPositions: [],
    liveMissingPositions: [],
    unverifiedPositions: [],
  };
  const handledLayout = new Set<string>();

  const signatureSpace = (oldId: string): string | null => (
    existingSpaceIds.has(oldId)
      ? null
      : (() => {
        const root = canonicalImportRoot('space', oldId).root;
        if (!reversibleStem('space', root)) return null;
        const candidates = spaceSignatures.get(root) || [];
        return candidates.length === 1 ? candidates[0] : null;
      })()
  );
  const exactRoom = (oldId: string, targetSpace: string): string | null => {
    const root = canonicalImportRoot('room', oldId).root;
    if (!reversibleStem('room', root)) return null;
    const candidates = roomSignaturesBySpace.get(targetSpace)?.get(root) || [];
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

  const roster = context.ownerRoster;
  const rosterAuthoritative = roster?.authoritative === true;
  const liveDeviceIds = new Set(roster?.deviceIds || []);
  const liveEntityIds = new Set(roster?.entityIds || []);
  const knownDeviceIds = new Set(
    Array.isArray(config.settings?.known_devices)
      ? config.settings.known_devices.filter((value: unknown) => typeof value === 'string')
      : [],
  );
  const ownerName = (id: string, fallback = ''): string => {
    const value = String(roster?.names?.[id] || fallback || '').trim();
    return value && value !== id ? value : '';
  };
  const detail = (
    id: string, spaceId: string, kind: SpaceReferenceOwnerKind, fallback = '',
    reason?: SpaceReferencePositionDetail['reason'],
  ): SpaceReferencePositionDetail => ({
    id, spaceId, kind, name: ownerName(id, fallback), ...(reason ? { reason } : {}),
  });
  const countRemoval = (kind: SpaceReferenceOwnerKind): void => {
    if (kind === 'room_label') report.orphanRoomLabelsRemoved++;
    else if (kind === 'group') report.orphanGroupPositionsRemoved++;
    else report.orphanDevicePositionsRemoved++;
  };
  const remainingDead = new Set<string>();
  for (const [key, position] of Object.entries(layout)) {
    const value = typeof (position as any)?.s === 'string' ? (position as any).s : '';
    if (!value || existingSpaceIds.has(value)) continue;

    let owner: SpaceReferencePositionDetail;
    let status: 'absent' | 'live' | 'unverified';
    const activeMarker = activeMarkers.get(key);
    const removedMarker = removedMarkers.get(key);
    if (activeMarker) {
      owner = detail(key, value, 'device', String(activeMarker.name || ''));
      status = 'live';
    } else if (removedMarker) {
      owner = detail(key, value, 'device', String(removedMarker.name || ''));
      status = 'absent';
    } else if (key.startsWith('rl_')) {
      const roomId = key.slice(3);
      owner = detail(key, value, 'room_label', roomNames.get(roomId) || '');
      status = existingRoomIds.has(roomId) ? 'live' : 'absent';
    } else if (key.startsWith('lg_')) {
      const entityId = key.slice(3);
      owner = detail(key, value, 'group');
      status = liveEntityIds.has(entityId)
        ? 'live'
        : rosterAuthoritative ? 'absent' : 'unverified';
      if (status === 'unverified') owner.reason = 'registry_unavailable';
    } else if (liveDeviceIds.has(key)) {
      owner = detail(key, value, 'device');
      status = 'live';
    } else if (knownDeviceIds.has(key)) {
      owner = detail(key, value, 'device');
      status = rosterAuthoritative ? 'absent' : 'unverified';
      if (status === 'unverified') owner.reason = 'registry_unavailable';
    } else {
      owner = detail(key, value, 'unknown', '', 'unknown_owner');
      status = 'unverified';
    }

    if (status === 'absent') {
      delete layout[key];
      countRemoval(owner.kind);
      report.removedPositions.push(owner);
      continue;
    }
    if (status === 'live') {
      report.liveMissingPositions.push(owner);
      if (context.removeLiveMissingPositions === true) {
        delete layout[key];
        report.liveMissingPositionsRemoved++;
        countRemoval(owner.kind);
        report.removedPositions.push(owner);
        continue;
      }
    } else {
      report.unverifiedPositions.push(owner);
    }
    report.positionsUnresolved++;
    remainingDead.add(value);
  }
  report.deadSpaceIds = [...remainingDead].sort((a, b) => a.localeCompare(b));

  return {
    config,
    layout,
    report,
    changed: JSON.stringify(config) !== beforeConfig || JSON.stringify(layout) !== beforeLayout,
  };
}
