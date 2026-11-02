/** Keyboard translations use the authored offset and the current host, never a pointer magnet. */
import { CANVAS_LIMIT, GRID_PITCH, NORM_W } from '../canvas-constants';
import { roomPoly } from '../logic';
import { freePartitionEnds } from './properties/physical';
import { materializePartitionOpening, resolvePartitionOpeningStrict } from '../partition-openings';
import { resolveRoomOpeningHost } from '../wall-segment-model';
import { annotateSpaceGraphOpeningRuns, annotateGraphOpeningRuns, graphOpeningRun, graphOpeningRunCenter, graphOpeningRunTarget } from '../graph-opening-run';
import type { PlanGraph } from '../plan-graph';
import type { OpeningCfg, PartitionCfg, RoomCfg, WallSegmentEntry } from '../types';

export interface NudgeSpace {
  plan_graph?: PlanGraph;
  id: string; rooms?: RoomCfg[]; partitions?: PartitionCfg[]; wall_segments?: WallSegmentEntry[]; openings?: OpeningCfg[];
}
export interface NudgeSelection { kind: 'partition' | 'contour' | 'opening'; id: string }
const EPS = 1e-9;
const bounded = (points: readonly (readonly number[])[]): boolean => points.every(p =>
  p.length >= 2 && p.every(n => Number.isFinite(n) && Math.abs(n) <= CANVAS_LIMIT));
const axis = (wall: {a: number[]; b: number[]}) => {
  const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy);
  return { dx, dy, length };
};

function translateWall<T extends NudgeSpace>(space: T, selection: NudgeSelection, dx: number, dy: number, cellCm: number): T | null {
  const key = selection.kind === 'partition' ? 'partitions' : 'wall_segments';
  const wall = space[key]?.find(w => w.id === selection.id);
  if (!wall || !(axis(wall).length > EPS)) return null;
  if (selection.kind === 'contour' && space.rooms?.some(room => room.wall_ids?.includes(wall.id))) return null;
  const roomEdges = (space.rooms ?? []).flatMap((room, i) => {
    const poly = roomPoly(room) ?? [];
    return poly.map((a, j) => ({id:wall.id+'\0room:'+i+':'+j,a,b:poly[(j+1)%poly.length]}));
  });
  const walls = [...space.partitions ?? [], ...space.wall_segments ?? [], ...roomEdges];
  if (!freePartitionEnds(wall, walls).every(Boolean)) return null;
  const moved = { ...structuredClone(wall), a: [wall.a[0] + dx, wall.a[1] + dy], b: [wall.b[0] + dx, wall.b[1] + dy] };
  if (!bounded([moved.a, moved.b]) || !freePartitionEnds(moved, walls).every(Boolean)) return null;
  const kind = selection.kind === 'partition' ? 'partition' : 'wall';
  const openings: OpeningCfg[] = [];
  for (const opening of space.openings ?? []) {
    if (opening.host?.kind !== kind || opening.host.id !== wall.id) { openings.push(structuredClone(opening)); continue; }
    const candidate = structuredClone(opening);
    if (kind === 'partition') {
      const rendered = { ...moved, a: moved.a.map(n => n * NORM_W), b: moved.b.map(n => n * NORM_W) };
      const resolved = resolvePartitionOpeningStrict(candidate, [rendered], NORM_W, cellCm, GRID_PITCH).resolved;
      if (!resolved) return null;
      openings.push(materializePartitionOpening(candidate, resolved, NORM_W));
    } else {
      candidate.x += dx; candidate.y += dy;
      const host = resolveRoomOpeningHost(candidate, [moved]);
      if (!host || host.id !== wall.id) return null;
      openings.push(candidate);
    }
  }
  return { ...structuredClone(space), [key]: space[key]?.map(w => w.id === wall.id ? moved : structuredClone(w)),
    ...(space.openings ? { openings } : {}) };
}

/** Graph movements retain the physical run while explicitly choosing its new
 * anchor child. The input and canonical graph remain untouched. */
function translateGraphOpening<T extends NudgeSpace>(space: T, id: string, dx: number, dy: number, cellCm: number): T | null {
  const draft = annotateSpaceGraphOpeningRuns(structuredClone(space));
  const opening = draft.openings?.find(o => o.id === id), host = opening?.host;
  if (!opening || !host) return null;
  const carriers = (host.kind === 'partition' ? draft.partitions : draft.wall_segments) || [];
  const wall = carriers.find(w => w.id === host.id), run = graphOpeningRun(wall);
  if (!wall || !run || run.kind !== host.kind) return null;
  const current = graphOpeningRunCenter(run, host), {dx: wx, dy: wy, length} = axis(wall);
  if (!current || !(length > EPS)) return null;
  const horizontal = Math.abs(wx) + EPS >= Math.abs(wy);
  if (horizontal ? !dx || !!dy : !dy || !!dx) return null;
  const along = horizontal ? dx * Math.sign(wx) : dy * Math.sign(wy);
  const desired: [number,number] = [current[0] + wx / length * along, current[1] + wy / length * along];
  const target = graphOpeningRunTarget(carriers, host.id, desired);
  // Keyboard movement is a complete authored step, never an endpoint clamp.
  if (!target || Math.hypot(target.center[0]-desired[0], target.center[1]-desired[1]) > EPS) return null;
  const ux = wx / length, uy = wy / length;
  const fullLength = Math.hypot(run.b[0]-run.a[0], run.b[1]-run.a[1]);
  const fullAlong = (target.center[0]-run.a[0])*ux + (target.center[1]-run.a[1])*uy;
  if (!(opening.length > 0) || fullAlong-opening.length/2 < -EPS || fullAlong+opening.length/2 > fullLength+EPS) return null;
  let candidate: OpeningCfg = {...opening, host: {...host,...target.host}, x:target.normalized[0], y:target.normalized[1]};
  if (!bounded([[candidate.x,candidate.y]])) return null;
  if (host.kind === 'partition') {
    const rendered = carriers.map(w => ({...w,a:w.a.map(n=>n*NORM_W),b:w.b.map(n=>n*NORM_W)}));
    annotateGraphOpeningRuns(draft.plan_graph!, rendered, 'partition', NORM_W);
    const resolved = resolvePartitionOpeningStrict(candidate, rendered, NORM_W, cellCm, GRID_PITCH).resolved;
    if (!resolved) return null;
    candidate = materializePartitionOpening(candidate,resolved,NORM_W);
  }
  for (const other of draft.openings || []) {
    if (other.id === id || other.host?.kind !== host.kind) continue;
    const otherWall = carriers.find(w=>w.id===other.host!.id), otherRun = graphOpeningRun(otherWall);
    if (!otherRun || otherRun.key !== run.key) continue;
    const center = graphOpeningRunCenter(otherRun,other.host);
    if (!center) return null;
    const offset = (center[0]-target.center[0])*ux + (center[1]-target.center[1])*uy;
    if (Math.max(-opening.length/2,offset-other.length/2) < Math.min(opening.length/2,offset+other.length/2)-EPS) return null;
  }
  return {...draft,openings:draft.openings?.map(o=>o.id===id?candidate:o)};
}

function translateOpening<T extends NudgeSpace>(space: T, id: string, dx: number, dy: number, cellCm: number): T | null {
  if (space.plan_graph) return translateGraphOpening(space,id,dx,dy,cellCm);
  const opening = space.openings?.find(o => o.id === id);
  if (!opening) return null;
  const host = opening.host?.kind === 'partition' ? opening.host : resolveRoomOpeningHost(opening, space.wall_segments ?? []);
  if (!host || opening.host && (opening.host.kind !== host.kind || opening.host.id !== host.id)) return null;
  const wall = (host.kind === 'partition' ? space.partitions : space.wall_segments)?.find(w => w.id === host.id);
  if (!wall || !(wall.cm > 0) || !bounded([wall.a, wall.b])) return null;
  const {dx: wx, dy: wy, length} = axis(wall);
  if (!(length > EPS) || !Number.isFinite(host.t)) return null;
  // Decimal endpoint subtraction must not flip an authored 45-degree host to Up/Down.
  const horizontal = Math.abs(wx) + EPS >= Math.abs(wy);
  if (horizontal ? !dx || !!dy : !dy || !!dx) return null;
  const along = (horizontal ? dx * Math.sign(wx) : dy * Math.sign(wy));
  const t = host.t + along / length, half = opening.length / (2 * length);
  if (!(half > 0) || t - half < -EPS || t + half > 1 + EPS) return null;
  let candidate: OpeningCfg = { ...structuredClone(opening), host: { ...structuredClone(opening.host), ...host, t },
    x: wall.a[0] + wx * t, y: wall.a[1] + wy * t };
  if (candidate.host) delete candidate.host.tq;
  if (!bounded([[candidate.x, candidate.y]])) return null;
  if (host.kind === 'partition') {
    const rendered = { ...wall, a: wall.a.map(n => n * NORM_W), b: wall.b.map(n => n * NORM_W) };
    const resolved = resolvePartitionOpeningStrict(candidate, [rendered], NORM_W, cellCm, GRID_PITCH).resolved;
    if (!resolved) return null;
    candidate = materializePartitionOpening(candidate, resolved, NORM_W);
  } else if (resolveRoomOpeningHost(candidate, space.wall_segments?.filter(w=>w.id===host.id) ?? [])?.id !== host.id) return null;
  for (const other of space.openings ?? []) {
    if (other.id === id || other.host?.kind !== host.kind || other.host.id !== host.id) continue;
    const otherHalf = other.length / (2 * length);
    if (Math.max(t - half, other.host.t - otherHalf) < Math.min(t + half, other.host.t + otherHalf) - EPS) return null;
  }
  return { ...structuredClone(space), openings: space.openings?.map(o => o.id === id ? candidate : structuredClone(o)) };
}

/** Input deltas are normalized current grid units; no snap, clamp or partial step. */
export function nudgePlan<T extends NudgeSpace>(space: T, selection: NudgeSelection,
  dx: number, dy: number, cellCm: number): T | null {
  if (![dx, dy, cellCm].every(Number.isFinite) || !(cellCm > 0) || (!dx && !dy) || (!!dx && !!dy)) return null;
  return selection.kind === 'opening' ? translateOpening(space, selection.id, dx, dy, cellCm)
    : translateWall(space, selection, dx, dy, cellCm);
}
