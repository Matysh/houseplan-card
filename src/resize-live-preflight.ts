import { GRID_STEP_N } from './space-geometry';

type DataRecord = Record<string, unknown>;

export interface ResizeLiveBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const asRecord = (value: unknown): DataRecord | null =>
  typeof value === 'object' && value !== null ? value as DataRecord : null;

const recordsOf = (value: unknown): DataRecord[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  }) : [];

const pointOf = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null;
  const x = Number(value[0]), y = Number(value[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
};

const pointsOf = (value: unknown): number[][] =>
  Array.isArray(value) ? value.flatMap((item) => {
    const point = pointOf(item);
    return point ? [point] : [];
  }) : [];

function roomPoints(room: DataRecord): number[][] {
  const poly = pointsOf(room.poly);
  if (poly.length >= 3) return poly;
  const x = Number(room.x), y = Number(room.y);
  const w = Number(room.w), h = Number(room.h);
  if (![x, y, w, h].every(Number.isFinite)) return [];
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

function boundsOf(points: readonly number[][]): ResizeLiveBounds | null {
  if (!points.length) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

/**
 * Live validation follows the resize solver's affected-room identity instead
 * of the size of the floor. Cross-room safety is still checked against the
 * complete space before commit; the pointer loop proves the moving rooms and
 * their nearby independent physical bodies without rebuilding remote rooms.
 */
export function resizeLiveRoomIds(
  roomsInput: readonly unknown[], changedRoomIds: readonly string[],
): string[] {
  const rooms = recordsOf(roomsInput);
  const changed = new Set(changedRoomIds);
  return rooms.flatMap((room) => {
    const id = String(room.id || '');
    return id && changed.has(id) ? [id] : [];
  });
}

/** One non-transitive neighbour layer is enough to retain junction rays. */
export function resizeLiveJunctionRoomIds(
  roomsInput: readonly unknown[], changedRoomIds: readonly string[], epsilon = 1e-8,
): string[] {
  const rooms = recordsOf(roomsInput);
  const changed = new Set(changedRoomIds);
  const changedBounds = rooms.flatMap((room) => {
    if (!changed.has(String(room.id || ''))) return [];
    const bounds = boundsOf(roomPoints(room));
    return bounds ? [bounds] : [];
  });
  return rooms.flatMap((room) => {
    const id = String(room.id || '');
    const bounds = boundsOf(roomPoints(room));
    const touches = !!bounds && changedBounds.some((candidate) =>
      bounds.minX <= candidate.maxX + epsilon && bounds.maxX + epsilon >= candidate.minX
      && bounds.minY <= candidate.maxY + epsilon && bounds.maxY + epsilon >= candidate.minY);
    return id && (changed.has(id) || touches) ? [id] : [];
  });
}

/** Build the exact local physical component checked on every live resize frame. */
export function resizeLiveCandidateSpace(
  spaceInput: unknown, changedRoomIds: readonly string[],
): (DataRecord & { rooms: DataRecord[]; walls: DataRecord[] }) | null {
  const space = asRecord(spaceInput);
  if (!space) return null;
  const allRooms = recordsOf(space.rooms);
  const ids = new Set(resizeLiveRoomIds(allRooms, changedRoomIds));
  const rooms = allRooms.filter((room) => ids.has(String(room.id || '')));
  const points = rooms.flatMap(roomPoints);
  const core = boundsOf(points);
  if (!core || !rooms.length) return null;
  const rawCellCm = Number(space.cell_cm);
  const cellCm = Number.isFinite(rawCellCm) && rawCellCm > 0 ? rawCellCm : 5;
  const roomEdges = rooms.flatMap((room) => {
    const poly = roomPoints(room);
    return poly.map((point, index) => [point, poly[(index + 1) % poly.length]]);
  });
  const edgeEpsilon = GRID_STEP_N * 0.02;
  const distanceToSegment = (point: number[], a: number[], b: number[]): number => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const denominator = dx * dx + dy * dy;
    const t = denominator > 0 ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator)) : 0;
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  };
  const segmentDistance = (a: number[], b: number[], c: number[], d: number[]): number => {
    const cross = (p: number[], q: number[], r: number[]) =>
      (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const abC = cross(a, b, c), abD = cross(a, b, d);
    const cdA = cross(c, d, a), cdB = cross(c, d, b);
    if (abC * abD <= edgeEpsilon * edgeEpsilon
        && cdA * cdB <= edgeEpsilon * edgeEpsilon
        && Math.min(a[0], b[0]) <= Math.max(c[0], d[0]) + edgeEpsilon
        && Math.min(c[0], d[0]) <= Math.max(a[0], b[0]) + edgeEpsilon
        && Math.min(a[1], b[1]) <= Math.max(c[1], d[1]) + edgeEpsilon
        && Math.min(c[1], d[1]) <= Math.max(a[1], b[1]) + edgeEpsilon) return 0;
    return Math.min(
      distanceToSegment(a, c, d), distanceToSegment(b, c, d),
      distanceToSegment(c, a, b), distanceToSegment(d, a, b),
    );
  };
  const boundaryDistance = (a: number[], b: number[]): number => Math.min(
    ...roomEdges.map(([c, d]) => segmentDistance(a, b, c, d)),
  );
  const overlapsRoomBoundary = (a: number[], b: number[]): boolean =>
    roomEdges.some(([c, d]) => {
      const dx = d[0] - c[0], dy = d[1] - c[1];
      const length = Math.hypot(dx, dy);
      if (!(length > edgeEpsilon)) return false;
      const lineDistance = (point: number[]) => Math.abs(
        (point[0] - c[0]) * dy - (point[1] - c[1]) * dx) / length;
      if (lineDistance(a) > edgeEpsilon || lineDistance(b) > edgeEpsilon) return false;
      const project = (point: number[]) => (
        (point[0] - c[0]) * dx + (point[1] - c[1]) * dy) / (length * length);
      const ta = project(a), tb = project(b);
      return Math.min(1, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb)) > edgeEpsilon;
    });
  const wallOverlaps = (item: DataRecord): boolean => {
    const a = pointOf(item.a), b = pointOf(item.b);
    if (a && b) return overlapsRoomBoundary(a, b);
    const [midpoint] = String(item.key || '').split('@');
    const coordinates = midpoint?.split(',').map(Number) || [];
    if (coordinates.length === 2 && coordinates.every(Number.isFinite)) {
      return roomEdges.some(([start, end]) => distanceToSegment(coordinates, start, end)
        <= edgeEpsilon);
    }
    // Unknown legacy data remains in the proof so malformed local records
    // cannot be hidden merely because their position cannot be established.
    return true;
  };
  const walls = recordsOf(space.walls).filter(wallOverlaps);
  const wallSegments = recordsOf(space.wall_segments).filter(wallOverlaps);
  const roomWallHalf = Math.max(0, ...[...walls, ...wallSegments]
    .map((item) => Number(item.cm)).filter(Number.isFinite)) / cellCm * GRID_STEP_N / 2;
  const partitions = recordsOf(space.partitions).filter((item) => {
    const a = pointOf(item.a), b = pointOf(item.b);
    if (!a || !b) return true;
    const half = Math.max(0, Number(item.cm) || 0) / cellCm * GRID_STEP_N / 2;
    return boundaryDistance(a, b) <= roomWallHalf + half + edgeEpsilon;
  });
  const roomDrafts = recordsOf(space.room_drafts).filter((item) => {
    const draftPoints = pointsOf(item.points);
    if (draftPoints.length < 2) return true;
    const segments = recordsOf(item.segments);
    return draftPoints.some((point, index) => {
      if (index + 1 >= draftPoints.length) return false;
      const half = Math.max(0, Number(segments[index]?.cm) || 0)
        / cellCm * GRID_STEP_N / 2;
      return boundaryDistance(point, draftPoints[index + 1])
        <= roomWallHalf + half + edgeEpsilon;
    });
  });
  const wallColumns = recordsOf(space.wall_columns).filter((item) => {
    const center = pointOf(item.center);
    if (!center) return true;
    const radius = Math.max(0, Number(item.cm) || 0) / cellCm * GRID_STEP_N;
    return roomEdges.some(([start, end]) => distanceToSegment(center, start, end)
      <= roomWallHalf + radius + edgeEpsilon);
  });
  const partitionIds = new Set(partitions.map((item) => String(item.id || '')).filter(Boolean));
  const openings = recordsOf(space.openings).filter((item) => {
    const host = asRecord(item.host);
    if (host?.kind === 'partition') return partitionIds.has(String(host.id || ''));
    const center = pointOf([item.x, item.y]);
    if (!center) return true;
    return roomEdges.some(([start, end]) => distanceToSegment(center, start, end)
      <= edgeEpsilon);
  });
  return {
    ...space,
    rooms,
    walls,
    wall_segments: wallSegments,
    open_spans: recordsOf(space.open_spans).filter(wallOverlaps),
    partitions,
    room_drafts: roomDrafts,
    wall_columns: wallColumns,
    openings,
  };
}
