import { GRID_STEP_N } from './space-geometry';

type DataRecord = Record<string, unknown>;
type Point = [number, number];

export interface WallChainLiveSeed {
  partitionId: string;
  a: Point;
  b: Point;
  cm: number;
}

export interface WallChainLiveProjection {
  space: DataRecord & {
    rooms: DataRecord[];
    walls: DataRecord[];
    wall_segments: DataRecord[];
    open_spans: DataRecord[];
    openings: DataRecord[];
    partitions: DataRecord[];
    wall_columns: DataRecord[];
  };
  roomIds: string[];
  segmentCount: number;
}

interface LocalSegment {
  key: string;
  source: DataRecord;
  a: Point;
  b: Point;
  cm: number;
}

const asRecord = (value: unknown): DataRecord | null =>
  typeof value === 'object' && value !== null ? value as DataRecord : null;

const recordsOf = (value: unknown): DataRecord[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  }) : [];

const pointOf = (value: unknown): Point | null => {
  if (!Array.isArray(value)) return null;
  const x = Number(value[0]), y = Number(value[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
};

const pointsOf = (value: unknown): Point[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    const point = pointOf(item);
    return point ? [point] : [];
  }) : [];

const stable = (value: unknown): string => JSON.stringify(value ?? null);

const pointKey = (point: Point, factor = 1e8): string =>
  `${Math.round(point[0] * factor)},${Math.round(point[1] * factor)}`;

const samePoint = (left: Point, right: Point, epsilon = 1e-8): boolean =>
  Math.hypot(left[0] - right[0], left[1] - right[1]) <= epsilon;

const distanceToSegment = (point: Point, a: Point, b: Point): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator > 0 ? Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
};

const cross = (a: Point, b: Point, c: Point): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const segmentDistance = (a: Point, b: Point, c: Point, d: Point): number => {
  const epsilon = GRID_STEP_N * 0.0002;
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (abC * abD <= epsilon * epsilon && cdA * cdB <= epsilon * epsilon
      && Math.min(a[0], b[0]) <= Math.max(c[0], d[0]) + epsilon
      && Math.min(c[0], d[0]) <= Math.max(a[0], b[0]) + epsilon
      && Math.min(a[1], b[1]) <= Math.max(c[1], d[1]) + epsilon
      && Math.min(c[1], d[1]) <= Math.max(a[1], b[1]) + epsilon) return 0;
  return Math.min(
    distanceToSegment(a, c, d), distanceToSegment(b, c, d),
    distanceToSegment(c, a, b), distanceToSegment(d, a, b),
  );
};

const roomPoints = (room: DataRecord): Point[] => {
  const poly = pointsOf(room.poly);
  if (poly.length >= 3) return poly;
  const x = Number(room.x), y = Number(room.y);
  const w = Number(room.w), h = Number(room.h);
  return [x, y, w, h].every(Number.isFinite)
    ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    : [];
};

const roomEdges = (room: DataRecord): Array<[Point, Point]> => {
  const points = roomPoints(room);
  return points.map((point, index) => [point, points[(index + 1) % points.length]]);
};

const cmUnits = (cm: number, cellCm: number): number =>
  (Math.max(0, Number(cm) || 0) / cellCm) * GRID_STEP_N;

const segmentCm = (segment: DataRecord, fallback = 15): number => {
  const value = Number(segment.cm);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
};

const segmentAngle = (segment: Pick<LocalSegment, 'a' | 'b'>): number =>
  Math.atan2(segment.b[1] - segment.a[1], segment.b[0] - segment.a[0]);

const collinear = (left: LocalSegment, right: LocalSegment): boolean => {
  let delta = Math.abs(segmentAngle(left) - segmentAngle(right));
  delta %= Math.PI;
  delta = Math.min(delta, Math.PI - delta);
  return delta <= Math.PI / 180 && Math.abs(left.cm - right.cm) <= 1e-6;
};

function localSegments(space: DataRecord): {
  segments: LocalSegment[];
  malformedPartitions: DataRecord[];
} {
  const segments: LocalSegment[] = [];
  const malformedPartitions: DataRecord[] = [];
  for (const partition of recordsOf(space.partitions)) {
    const a = pointOf(partition.a), b = pointOf(partition.b);
    if (!a || !b) {
      malformedPartitions.push(partition);
      continue;
    }
    segments.push({
      key: `partition:${String(partition.id || stable(partition))}`,
      source: partition, a, b, cm: segmentCm(partition, 0),
    });
  }
  return { segments, malformedPartitions };
}

/** The ordinary independent wall appended by the current chain click. */
export function wallChainLiveSeed(
  spaceInput: unknown, partitionId: string,
): WallChainLiveSeed | null {
  const space = asRecord(spaceInput);
  const partition = recordsOf(space?.partitions).find((item) => item.id === partitionId);
  if (!partition) return null;
  const a = pointOf(partition.a), b = pointOf(partition.b);
  const cm = Number(partition.cm);
  if (!a || !b || !Number.isFinite(cm) || cm < 0 || samePoint(a, b)) return null;
  return { partitionId, a, b, cm };
}

/** Prove that the editor appended exactly one partition and changed nothing else. */
export function isSinglePartitionAppend(
  beforeInput: unknown, afterSpaceInput: unknown, partitionId: string,
): boolean {
  const before = asRecord(beforeInput), after = asRecord(afterSpaceInput);
  if (!before || !after || String(before.spaceId || '') !== String(after.id || '')) return false;
  const arrays = [
    'rooms', 'openings', 'walls', 'wall_segments', 'open_spans', 'wall_columns', 'decor',
  ];
  if (arrays.some((key) => stable(before[key] ?? []) !== stable(after[key] ?? []))) return false;
  const transform = asRecord(before.plan_transform) || {};
  const transformAfter: DataRecord = {};
  for (const key of [
    'plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle',
  ]) if (after[key] !== undefined) transformAfter[key] = after[key];
  if (stable(transform) !== stable(transformAfter)) return false;

  const previous = recordsOf(before.partitions);
  const next = recordsOf(after.partitions);
  if (next.length !== previous.length + 1
      || stable(next.slice(0, -1)) !== stable(previous)) return false;
  const appended = next[next.length - 1];
  const a = pointOf(appended.a), b = pointOf(appended.b);
  return appended.id === partitionId && !!a && !!b && !samePoint(a, b)
    && Number.isFinite(Number(appended.cm)) && Number(appended.cm) >= 0;
}

/** Build the same bounded physical/junction proof as #461 around one partition. */
export function wallChainLiveCandidateSpace(
  spaceInput: unknown, seed: WallChainLiveSeed,
): WallChainLiveProjection | null {
  const space = asRecord(spaceInput);
  if (!space) return null;
  const cellCmRaw = Number(space.cell_cm);
  const cellCm = Number.isFinite(cellCmRaw) && cellCmRaw > 0 ? cellCmRaw : 5;
  const clearance = cmUnits(5, cellCm);
  const seedHalf = cmUnits(seed.cm, cellCm) / 2;
  const allRooms = recordsOf(space.rooms);
  const catalogue = recordsOf(space.wall_segments);
  const catalogueById = new Map(catalogue.map((record) => [String(record.id || ''), record]));
  const legacyWalls = recordsOf(space.walls);
  const roomEdgesWithHalf = (room: DataRecord) => {
    const ids = Array.isArray(room.wall_ids) ? room.wall_ids.map(String) : [];
    return roomEdges(room).map(([a, b], index) => {
      const candidates = [catalogueById.get(ids[index]), ...legacyWalls.filter((wall) => {
        const wa = pointOf(wall.a), wb = pointOf(wall.b);
        if (wa && wb) return segmentDistance(a, b, wa, wb) <= GRID_STEP_N * 0.02;
        const [midpoint] = String(wall.key || '').split('@');
        const center = pointOf(midpoint?.split(',').map(Number));
        return !!center && distanceToSegment(center, a, b) <= GRID_STEP_N * 0.02;
      })].filter((value): value is DataRecord => !!value);
      const cm = Math.max(15, ...candidates.map((value) => segmentCm(value, 15)));
      return { a, b, half: cmUnits(cm, cellCm) / 2 };
    });
  };
  const directRoomIds = allRooms.flatMap((room) => {
    const id = String(room.id || '');
    const near = roomEdgesWithHalf(room).some(({ a, b, half }) =>
      segmentDistance(seed.a, seed.b, a, b) <= seedHalf + half + clearance);
    return id && near ? [id] : [];
  });
  const selectedRoomIds = new Set(directRoomIds);
  if (directRoomIds.length) {
    const directBounds = allRooms.filter((room) => selectedRoomIds.has(String(room.id || '')))
      .flatMap(roomEdgesWithHalf);
    for (const room of allRooms) {
      const id = String(room.id || '');
      if (!id || selectedRoomIds.has(id)) continue;
      if (roomEdgesWithHalf(room).some(({ a, b, half }) => directBounds.some((other) =>
        segmentDistance(a, b, other.a, other.b)
          <= half + other.half + GRID_STEP_N * 0.02))) selectedRoomIds.add(id);
    }
  }

  const roomIds = [...selectedRoomIds];
  const selectedRooms = allRooms.filter((room) => selectedRoomIds.has(String(room.id || '')));
  const selectedWallIds = new Set(selectedRooms.flatMap((room) => (
    Array.isArray(room.wall_ids) ? room.wall_ids.map(String) : []
  )));
  const wallSegments = recordsOf(space.wall_segments).filter((segment) =>
    selectedWallIds.has(String(segment.id || '')));
  const selectedEdges = selectedRooms.flatMap(roomEdges);
  const walls = recordsOf(space.walls).filter((wall) => {
    const a = pointOf(wall.a), b = pointOf(wall.b);
    if (a && b) return selectedEdges.some(([c, d]) =>
      segmentDistance(a, b, c, d) <= GRID_STEP_N * 0.02);
    const [midpoint] = String(wall.key || '').split('@');
    const center = pointOf(midpoint?.split(',').map(Number));
    if (center) return selectedEdges.some(([c, d]) =>
      distanceToSegment(center, c, d) <= GRID_STEP_N * 0.02);
    return true;
  });

  const { segments, malformedPartitions } = localSegments(space);
  const selectedKeys = new Set(segments.flatMap((segment) => {
    const near = segmentDistance(seed.a, seed.b, segment.a, segment.b)
      <= seedHalf + cmUnits(segment.cm, cellCm) / 2 + clearance;
    return near ? [segment.key] : [];
  }));
  let grew = true;
  while (grew) {
    grew = false;
    const selected = segments.filter((segment) => selectedKeys.has(segment.key));
    for (const candidate of segments) {
      if (selectedKeys.has(candidate.key)) continue;
      if (selected.some((current) => collinear(current, candidate)
          && (samePoint(current.a, candidate.a) || samePoint(current.a, candidate.b)
            || samePoint(current.b, candidate.a) || samePoint(current.b, candidate.b)))) {
        selectedKeys.add(candidate.key);
        grew = true;
      }
    }
  }
  const junctions = new Set(segments.filter((segment) => selectedKeys.has(segment.key))
    .flatMap((segment) => [pointKey(segment.a), pointKey(segment.b)]));
  for (const candidate of segments) {
    if (junctions.has(pointKey(candidate.a)) || junctions.has(pointKey(candidate.b)))
      selectedKeys.add(candidate.key);
  }
  const selectedSegments = segments.filter((segment) => selectedKeys.has(segment.key));
  const partitions = selectedSegments.map((segment) => segment.source).concat(malformedPartitions);

  const wallColumns = recordsOf(space.wall_columns).filter((column) => {
    const center = pointOf(column.center);
    if (!center) return true;
    const half = cmUnits(Number(column.cm), cellCm) / 2;
    const radius = column.shape === 'circle' ? half : half * Math.SQRT2;
    return distanceToSegment(center, seed.a, seed.b) <= seedHalf + radius + clearance;
  });
  const partitionIds = new Set(partitions.map((partition) => String(partition.id || '')));
  const wallIds = new Set(wallSegments.map((segment) => String(segment.id || '')));
  const openings = recordsOf(space.openings).filter((opening) => {
    const host = asRecord(opening.host);
    if (host?.kind === 'partition') return partitionIds.has(String(host.id || ''));
    if (host?.kind === 'wall' && wallIds.has(String(host.id || ''))) return true;
    const center = pointOf([opening.x, opening.y]);
    return !center || distanceToSegment(center, seed.a, seed.b) <= seedHalf + clearance;
  });
  const openSpans = recordsOf(space.open_spans).filter((span) => {
    const a = pointOf(span.a), b = pointOf(span.b);
    return !a || !b || segmentDistance(seed.a, seed.b, a, b) <= seedHalf + clearance;
  });

  return {
    space: {
      ...space,
      rooms: selectedRooms,
      walls,
      wall_segments: wallSegments,
      open_spans: openSpans,
      openings,
      partitions,
      wall_columns: wallColumns,
    },
    roomIds,
    segmentCount: wallSegments.length + selectedSegments.length,
  };
}
