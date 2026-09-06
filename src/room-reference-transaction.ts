/** Room-reference part of Delete/Merge room transactions (#477). */

import type { Marker } from './types';

export interface MarkerRoomReferenceSnapshot {
  markerId: string;
  roomIdPresent: boolean;
  roomId?: Marker['room_id'];
  vacuumPresent: boolean;
  segmentMapPresent: boolean;
  segmentMap?: Record<string, string>;
}

export interface RoomReferenceRewriteResult {
  markers: Marker[];
  before: MarkerRoomReferenceSnapshot[];
  after: MarkerRoomReferenceSnapshot[];
  changed: number;
}

const clone = <T>(value: T): T => (
  value === undefined ? value : JSON.parse(JSON.stringify(value))
);
const own = (value: unknown, key: string): boolean => (
  !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)
);

export function captureMarkerRoomReferences(
  markers: readonly Marker[], markerIds?: readonly string[],
): MarkerRoomReferenceSnapshot[] {
  const wanted = markerIds ? new Set(markerIds) : null;
  return (markers || [])
    .filter((marker) => typeof marker?.id === 'string' && (!wanted || wanted.has(marker.id)))
    .map((marker) => {
      const vacuum = marker.vacuum;
      return {
        markerId: marker.id,
        roomIdPresent: own(marker, 'room_id'),
        ...(own(marker, 'room_id') ? { roomId: clone(marker.room_id) } : {}),
        vacuumPresent: own(marker, 'vacuum'),
        segmentMapPresent: own(vacuum, 'segment_map'),
        ...(own(vacuum, 'segment_map')
          ? { segmentMap: clone(vacuum?.segment_map) }
          : {}),
      };
    })
    .sort((left, right) => left.markerId.localeCompare(right.markerId));
}

/** Restore only room-related fields; unrelated marker/vacuum edits survive. */
export function restoreMarkerRoomReferences(
  markers: Marker[], snapshots: readonly MarkerRoomReferenceSnapshot[],
): void {
  const byId = new Map((markers || []).map((marker) => [marker?.id, marker]));
  for (const snapshot of snapshots) {
    const marker = byId.get(snapshot.markerId);
    if (!marker) continue;
    if (snapshot.roomIdPresent) marker.room_id = clone(snapshot.roomId);
    else delete marker.room_id;

    if (snapshot.segmentMapPresent) {
      if (!marker.vacuum || typeof marker.vacuum !== 'object' || Array.isArray(marker.vacuum)) {
        marker.vacuum = {};
      }
      marker.vacuum.segment_map = clone(snapshot.segmentMap) || {};
      continue;
    }
    if (marker.vacuum && typeof marker.vacuum === 'object' && !Array.isArray(marker.vacuum)) {
      delete marker.vacuum.segment_map;
      if (!snapshot.vacuumPresent && Object.keys(marker.vacuum).length === 0) delete marker.vacuum;
    }
  }
}

export function rewriteMarkerRoomReferences(
  markersIn: readonly Marker[],
  operation: { kind: 'delete'; roomId: string } | { kind: 'merge'; dropId: string; keepId: string },
): RoomReferenceRewriteResult {
  const markers: Marker[] = clone([...(markersIn || [])]);
  const touched = new Set<string>();
  for (const marker of markers) {
    if (typeof marker?.id !== 'string') continue;
    let changed = false;
    if (operation.kind === 'delete') {
      if (marker.room_id === operation.roomId) {
        delete marker.room_id;
        changed = true;
      }
    } else if (marker.room_id === operation.dropId) {
      marker.room_id = operation.keepId;
      changed = true;
    }

    const segmentMap = marker.vacuum?.segment_map;
    if (segmentMap && typeof segmentMap === 'object' && !Array.isArray(segmentMap)) {
      for (const key of Object.keys(segmentMap)) {
        if (operation.kind === 'delete' && segmentMap[key] === operation.roomId) {
          delete segmentMap[key];
          changed = true;
        } else if (operation.kind === 'merge' && segmentMap[key] === operation.dropId) {
          segmentMap[key] = operation.keepId;
          changed = true;
        }
      }
      if (operation.kind === 'delete' && Object.keys(segmentMap).length === 0) {
        if (marker.vacuum) delete marker.vacuum.segment_map;
        if (marker.vacuum && Object.keys(marker.vacuum).length === 0) delete marker.vacuum;
      }
    }
    if (changed) touched.add(marker.id);
  }
  const ids = [...touched].sort((left, right) => left.localeCompare(right));
  return {
    markers,
    before: captureMarkerRoomReferences(markersIn, ids),
    after: captureMarkerRoomReferences(markers, ids),
    changed: ids.length,
  };
}
