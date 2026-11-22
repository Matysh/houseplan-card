/** One canonical preparation shared by the worker and the degraded path.
 * The renderer still owns its existing cache keys and consumers. This frame
 * supplies their values before a pull reader can enter an expensive miss. */
import type { ServerConfig } from './types';
import { spaceModels, NORM_W, GRID_PITCH, GRID_STEP_N } from './space-geometry';
import { roomPoly, islandsOf } from './logic';
import { resolveZeroWalls } from './zero-walls';
import { geometryOpenings, geometryPartitionOpeningCuts, geometryRoomOpeningInputs } from './plan-geometry-preflight';
import { physicalBodyParts, type PhysicalBodyParts } from './physical-geometry';
import { wallBodiesUnionPath, innerContourForRoom, openingWallIndex, openingTunnelGeometriesFromIndex,
  type OpeningWallIndex, type OpeningTunnelGeometry } from './wall-thickness';
import { cleanFloorForRoom, cleanFloorData, type CleanFloorData } from './clean-floor';
import { buildRoomFloorPaint, roomFloorGeometry, type RoomFloorPaint } from './room-floor-paint';
import { physicalBodiesKey, openingWallIndexKey, wallUnionKey, wallUnionPoolEntry } from './floor-geometry-key';
import { captureDirectGeometry, captureDirectParts, restoreDirectGeometry, restoreDirectParts,
  type DirectGeometrySnapshot } from './direct-wall-geometry';
import { wallGraphSource } from './wall-graph-source';
import type { IsoCacheSnapshot } from './iso-scene-geometry';
import { lightGeometryFingerprint } from './glow-scene';

export interface FloorGeometryInput {
  raw: ServerConfig['spaces'][number];
  floorKey: string;
  cleanKey: string;
  projection: 'flat' | 'iso';
}
export interface FloorGeometryFrame {
  version: 1;
  id: string;
  floorKey: string;
  cleanKey: string;
  bodies: PhysicalBodyParts & { key: string };
  partsSemantic?: ReturnType<typeof captureDirectParts>;
  union: { key: string; value: ReturnType<typeof wallBodiesUnionPath> };
  directSemantic?: DirectGeometrySnapshot;
  inner: Array<[string, number[][] | null]>;
  clean: Array<[string, CleanFloorData]>;
  openingIndex: { key: string; value: OpeningWallIndex };
  tunnels: { key: string; value: Array<OpeningTunnelGeometry | null> };
  floorPaint: { key: string; value: Map<string, RoomFloorPaint> };
  iso?: { key: string; value: IsoCacheSnapshot };
  work: Record<string, number>;
}

export async function prepareFloorGeometry(input: FloorGeometryInput, signal?: AbortSignal): Promise<FloorGeometryFrame> {
  signal?.throwIfAborted();
  const { raw, floorKey, cleanKey } = input;
  const space = spaceModels({ spaces: [raw] } as ServerConfig)[0];
  if (!space) throw new Error('floor-cache:missing-space');
  const cellCm = space.cellCm || 5, gridPitch = GRID_PITCH, wallKeyPitch = GRID_STEP_N;
  const walls = raw.walls || [], zero = resolveZeroWalls(raw, space, NORM_W, gridPitch * .02);
  const openCuts = zero.contour, openings = geometryOpenings(raw, space, cellCm, gridPitch, NORM_W);
  const partitionCuts = geometryPartitionOpeningCuts(openings);
  const roomOpenings = geometryRoomOpeningInputs(openings, space, walls, openCuts, wallKeyPitch, cellCm, gridPitch, NORM_W);
  const parts = physicalBodyParts(space, cellCm, gridPitch, gridPitch * .0002, partitionCuts);
  const bodies = { ...parts, rawPatches: parts.rawPatches, key: physicalBodiesKey(floorKey, cellCm, gridPitch) };
  const value = wallBodiesUnionPath(space.rooms, walls, openCuts, roomOpenings,
    wallKeyPitch, cellCm, gridPitch, NORM_W, parts.all);
  const united = wallUnionPoolEntry(wallUnionKey(floorKey, space.rooms.length), value, raw, cellCm, gridPitch);
  const indexKey = openingWallIndexKey(space.id, space.rooms, walls, openCuts, [wallKeyPitch, cellCm, gridPitch]);
  const index = openingWallIndex(space.rooms, walls, openCuts, wallKeyPitch, cellCm, gridPitch, NORM_W);
  const geometryInputs = openings.map(opening => ({ x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen }));
  const tunnelKey = `${indexKey}|${geometryInputs.map(o => `${o.x},${o.y},${o.angle},${o.length}`).join(';')}`;
  const tunnels = openingTunnelGeometriesFromIndex(index, geometryInputs);
  const inner: FloorGeometryFrame['inner'] = [], clean: FloorGeometryFrame['clean'] = [];
  const cleanCache = new Map(), polys = space.rooms.map(roomPoly);
  const cutsKey = openCuts.map(cut => cut.join(',')).join(';');
  const seeds = space.rooms.flatMap((room, roomIndex) => {
    const poly = polys[roomIndex];
    if (!poly) return [];
    const contour = room.id ? innerContourForRoom(space.rooms, room.id, walls, openCuts,
      wallKeyPitch, cellCm, gridPitch, NORM_W, value?.roomGeom, value?.multiWallNodes) : null;
    if (room.id) inner.push([`${floorKey}|${room.id}|${cutsKey}`, contour]);
    const floor = contour || poly;
    const result = cleanFloorForRoom({ room, floor, space, floorKey: () => cleanKey,
      resizePreview: false, cache: cleanCache, physicalBodies: () => parts.all });
    clean.push([`${cleanKey}|${room.id || '#' + roomIndex}`, cleanFloorData(result)]);
    const holes = islandsOf(floor, polys.filter((p, index) => index !== roomIndex && !!p) as number[][][]);
    return [{ id: room.id || '#' + roomIndex, geom: roomFloorGeometry(floor, holes, result.geom) }];
  });
  const paint = value && walls.length && openings.length
    ? buildRoomFloorPaint(seeds, openings, tunnels, value.components.map(component => component.geom).filter(geom => geom?.length))
    : new Map<string, RoomFloorPaint>();
  const frame: FloorGeometryFrame = {
    version: 1, id: space.id, floorKey, cleanKey, bodies,
    partsSemantic: captureDirectParts(parts.all), union: united,
    ...(value?.roomGeom ? { directSemantic: captureDirectGeometry(value.roomGeom) } : {}),
    inner, clean, openingIndex: { key: indexKey, value: index },
    tunnels: { key: tunnelKey, value: tunnels }, floorPaint: { key: `${cleanKey}|${tunnelKey}`, value: paint },
    work: { physicalBodies: 1, wallUnion: 1, innerContour: inner.length, cleanFloor: clean.length,
      openingWallIndex: 1, openingTunnel: 1, roomFloorPaint: paint.size ? 1 : 0 },
  };
  if (input.projection === 'iso') {
    const iso = await import('./iso-scene-geometry');
    signal?.throwIfAborted();
    const source = iso.createIsoStructuralSource({ space, walls, openCuts, openings,
      partitionCuts: () => partitionCuts, roomOpenings: () => roomOpenings,
      cellCm, gridPitch, wallKeyPitch, coordinateScale: NORM_W, onBuild: () => {} });
    const cache = new Map();
    for (const rotation of [0, 90, 180, 270] as const)
      iso.resolveIsoScene({ source, cache, cellCm, liveFrame: { x: 0, y: 0, w: NORM_W, h: NORM_W }, rotation });
    const snapshot = iso.captureIsoCache(cache.get(source.key));
    if (!snapshot) throw new Error('floor-cache:missing-iso-physical');
    frame.iso = { key: source.key, value: snapshot };
    frame.work.isoStructural = 1;
  }
  return frame;
}

/** Reattach semantic side tables only after the owning source/key is proven. */
export function restoreFloorGeometrySemantics(frame: FloorGeometryFrame, raw: FloorGeometryInput['raw']): void {
  const space = spaceModels({ spaces: [raw] } as ServerConfig)[0];
  if (frame.partsSemantic) restoreDirectParts(frame.bodies.all, frame.partsSemantic);
  if (frame.directSemantic && frame.union.value?.roomGeom)
    restoreDirectGeometry(frame.union.value.roomGeom, frame.directSemantic, wallGraphSource(space.rooms), space.cellCm || 5, GRID_PITCH);
}

/** Fail closed before hydrating caches. More detailed numerical validity is
 * enforced by the bounded graph codec, not by a fresh boolean computation. */
export function isFloorGeometryFrame(value: unknown, input: FloorGeometryInput): value is FloorGeometryFrame {
  const frame = value as FloorGeometryFrame | null;
  if (!frame || frame.version !== 1 || frame.id !== input.raw.id || frame.floorKey !== input.floorKey
    || frame.cleanKey !== input.cleanKey || !frame.bodies || !Array.isArray(frame.bodies.all)
    || !frame.union || !Array.isArray(frame.inner) || !Array.isArray(frame.clean)
    || !frame.openingIndex || !Array.isArray(frame.openingIndex.value?.edges)
    || !Array.isArray(frame.tunnels?.value) || !(frame.floorPaint?.value instanceof Map)) return false;
  const union = frame.union.value;
  // Validate the cheap input projections against the cache reader's actual
  // keys, not merely their primitive types. Otherwise a well-formed but
  // incomplete/mis-keyed DTO would hydrate successfully and silently make
  // those readers enter the expensive canonical miss path on the main thread.
  const space = spaceModels({ spaces: [input.raw] } as ServerConfig)[0];
  if (!space) return false;
  const cellCm = space.cellCm || 5;
  const cuts = resolveZeroWalls(input.raw, space, NORM_W, GRID_PITCH * .02).contour;
  const openings = geometryOpenings(input.raw, space, cellCm, GRID_PITCH, NORM_W);
  const indexKey = openingWallIndexKey(space.id, space.rooms, input.raw.walls || [], cuts, [GRID_STEP_N, cellCm, GRID_PITCH]);
  const tunnelKey = `${indexKey}|${openings.map(o => `${o.rx},${o.ry},${o.angle},${o.rlen}`).join(';')}`;
  if (frame.bodies.key !== physicalBodiesKey(input.floorKey, cellCm, GRID_PITCH)
    || frame.union.key !== wallUnionKey(input.floorKey, space.rooms.length)
    || frame.openingIndex.key !== indexKey || frame.tunnels.key !== tunnelKey
    || frame.floorPaint.key !== `${input.cleanKey}|${tunnelKey}`) return false;
  const point = (p: unknown): p is number[] => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite);
  const ring = (r: unknown): r is number[][] => Array.isArray(r) && r.every(point);
  const geom = (g: unknown): boolean => Array.isArray(g) && g.every(poly => Array.isArray(poly) && poly.every(ring));
  const indexValid = (index: OpeningWallIndex | null) => index === null || !!index && Number.isFinite(index.adjacencyEps)
    && Array.isArray(index.edges) && index.edges.every(edge => typeof edge.roomId === 'string' && typeof edge.key === 'string'
      && point(edge.a) && point(edge.b) && point(edge.inward) && [edge.cm, edge.half, edge.area].every(Number.isFinite));
  if (![frame.bodies.all, frame.bodies.partitions, frame.bodies.columns, frame.bodies.patches].every(ringSet =>
    Array.isArray(ringSet) && ringSet.every(ring)) || typeof frame.bodies.key !== 'string') return false;
  if (union && (!['roomComponents', 'openingIndex', 'openingPadUnits', 'coordinateScale', 'sourceFingerprint']
    .every(key => Object.prototype.hasOwnProperty.call(union, key)) || !Array.isArray(union.roomComponents)
    || union.coordinateScale !== NORM_W
    || (union as { sourceFingerprint?: unknown }).sourceFingerprint !== lightGeometryFingerprint(input.raw, cellCm, GRID_PITCH)
    || !union.roomComponents.every(component => typeof component.id === 'string' && geom(component.geom))
    || !Array.isArray(union.components) || !union.components.every(component => typeof component.id === 'string' && geom(component.geom))
    || !indexValid(union.openingIndex) || typeof union.d !== 'string' || typeof union.paperD !== 'string'
    || !Array.isArray(union.paths) || !union.paths.every(path => typeof path.id === 'string' && typeof path.d === 'string')
    || !Number.isFinite(union.depthUnits) || union.openingPadUnits !== undefined && !Number.isFinite(union.openingPadUnits))) return false;
  if (!indexValid(frame.openingIndex.value) || typeof frame.openingIndex.key !== 'string'
    || typeof frame.union.key !== 'string' || typeof frame.tunnels.key !== 'string' || typeof frame.floorPaint.key !== 'string'
    || !frame.tunnels.value.every(tunnel => tunnel === null || typeof tunnel.wallKey === 'string'
      && [tunnel.minY, tunnel.maxY].every(Number.isFinite) && Array.isArray(tunnel.faces)
      && tunnel.faces.every(face => [-1, 1].includes(face.side) && typeof face.roomId === 'string'
        && typeof face.d === 'string' && Array.isArray(face.contours) && face.contours.every(ring)))) return false;
  if (![...frame.floorPaint.value].every(([key, paint]) => typeof key === 'string' && !!paint && typeof paint.path === 'string'
    && typeof paint.basePath === 'string' && typeof paint.extended === 'boolean' && Array.isArray(paint.bounds)
    && paint.bounds.length === 4 && paint.bounds.every(Number.isFinite))) return false;
  if (input.raw.plan_graph) {
    if (!frame.partsSemantic || !Array.isArray(frame.partsSemantic.columns) || !frame.partsSemantic.columns.every(ring)
      || !Array.isArray(frame.partsSemantic.partitionCuts)) return false;
    if (union?.roomGeom) {
      const direct = frame.directSemantic, structure = direct?.structure;
      const rational = (q: any) => !!q && typeof q.n === 'bigint' && typeof q.d === 'bigint' && q.d > 0n;
      const exactPolygon = (p: unknown) => Array.isArray(p) && p.every(p => Array.isArray(p) && p.length === 2 && p.every(rational));
      if (!direct || !structure || !(structure.runs instanceof Map) || !(structure.geometryCache instanceof Map)
        || !Array.isArray(structure.materials) || !structure.materials.every(material => exactPolygon(material.poly)
          && Array.isArray(material.owners) && material.owners.every(owner => typeof owner === 'string') && typeof material.room === 'boolean')
        || !Array.isArray(structure.paper) || !structure.paper.every(exactPolygon) || !Array.isArray(structure.paperMaterials)
        || !structure.paperMaterials.every(exactPolygon) || !structure.nodes || !(structure.nodes.index instanceof Map)
        || !Array.isArray(structure.nodes.nodes) || !Array.isArray(structure.segments) || !Number.isFinite(structure.depth)
        || !Array.isArray(direct.openings) || !direct.extra || !Array.isArray(direct.extra.columns)
        || !Array.isArray(direct.extra.partitionCuts)) return false;
    }
  }
  if (input.projection === 'iso') {
    const iso = frame.iso?.value;
    if (!iso?.physical || !Array.isArray(iso.physical.openings) || !Array.isArray(iso.physical.openingSurfaces)
      || !geom(iso.physical.walls) || !geom(iso.physical.floor) || !(iso.projections instanceof Map)
      || ![90, 180, 270].every(rotation => iso.projections.has(rotation))) return false;
    for (const entry of [iso.entry, ...iso.projections.values()]) if (!entry?.floor || typeof entry.floor.footprintPath !== 'string'
      || !Array.isArray(entry.floor.sides) || !entry.geometry || typeof entry.geometry.topPath !== 'string'
      || !Array.isArray(entry.geometry.topFaces) || !Array.isArray(entry.geometry.sides) || !Array.isArray(entry.openings)
      || !entry.geometry.sides.every(face => typeof face.d === 'string' && ring(face.points))
      || !entry.geometry.topFaces.every(face => typeof face.d === 'string' && Number.isFinite(face.depth))) return false;
  }
  const cutsKey = cuts.map(cut => cut.join(',')).join(';');
  const expectedInner: string[] = [], expectedClean: string[] = [];
  space.rooms.forEach((room, index) => {
    if (!roomPoly(room)) return;
    if (room.id) expectedInner.push(`${input.floorKey}|${room.id}|${cutsKey}`);
    expectedClean.push(`${input.cleanKey}|${room.id || '#' + index}`);
  });
  const complete = (entries: Array<[string, unknown]>, expected: string[]) => {
    const keys = entries.map(entry => entry?.[0]).sort();
    return keys.length === expected.length && expected.sort().every((key, index) => key === keys[index]);
  };
  return complete(frame.inner, expectedInner) && complete(frame.clean, expectedClean)
    && frame.inner.every(entry => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string'
    && (entry[1] === null || ring(entry[1])))
    && frame.clean.every(entry => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string'
      && ring(entry[1]?.floor) && (entry[1].geom === null || geom(entry[1].geom)) && typeof entry[1]?.path === 'string'
      && (entry[1].area === undefined || Number.isFinite(entry[1].area)));
}
