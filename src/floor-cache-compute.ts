import { prepareFloorGeometry, isFloorGeometryFrame, restoreFloorGeometrySemantics } from './floor-geometry-frame';
import { encodeGeometryValue, decodeGeometryValue, decodeGeometryText, FLOOR_CACHE_MAX_PAYLOAD_BYTES } from './floor-cache-codec';
import { cacheTextChecksum, type FloorJob, type FloorJobResult } from './floor-cache-job';
import { buildLightBarrierScene } from './glow-scene';
import { physicalBodyParts } from './physical-geometry';
import { resolveZeroWalls } from './zero-walls';
import { spaceModels, NORM_W, GRID_PITCH, GRID_STEP_N } from './space-geometry';
import type { ServerConfig } from './types';
import { totalCleanFloorAreaM2 } from './summary-panel-metrics';
import { payloadBytes } from './floor-cache-store';
import { geometryWorkSnapshot } from './geometry-work';

/** Same pure canonical algorithms in worker and one honest degraded fallback. */
async function computeFloorJobImpl(job: FloorJob, signal?: AbortSignal): Promise<FloorJobResult> {
  signal?.throwIfAborted();
  const started = performance.now();
  if (job.kind === 'area') {
    const config = { spaces: [job.raw] } as ServerConfig;
    return { area: totalCleanFloorAreaM2(config, spaceModels(config)), ms: performance.now() - started };
  }
  let frame: unknown, hit = false;
  if (job.memory) frame = decodeGeometryValue(job.memory);
  if (job.kind === 'geometry' && job.disk) try {
    if (payloadBytes(job.disk.text) !== job.disk.bytes || cacheTextChecksum(job.disk.text) !== job.disk.checksum)
      throw new Error('floor-cache:checksum');
    frame = decodeGeometryText(job.disk.text);
    hit = isFloorGeometryFrame(frame, job.input);
  } catch { frame = undefined; }
  if (!isFloorGeometryFrame(frame, job.input)) frame = await prepareFloorGeometry(job.input, signal);
  signal?.throwIfAborted();
  if (!isFloorGeometryFrame(frame, job.input)) throw new Error('floor-cache:unusable-frame');
  restoreFloorGeometrySemantics(frame, job.input.raw);
  // Snapshot the persistent structural graph BEFORE the state-dependent recut.
  // Direct geometry retains mutable optional memos: a live cut can populate
  // them, but those results must never leak into a disk generation.
  const wire = job.kind === 'geometry' ? encodeGeometryValue(frame) : undefined;
  let payload = job.kind === 'geometry' && hit ? job.disk || undefined : undefined;
  if (wire && !payload) try {
    const text = JSON.stringify(wire), bytes = payloadBytes(text);
    if (bytes <= FLOOR_CACHE_MAX_PAYLOAD_BYTES) payload = { text, bytes, checksum: cacheTextChecksum(text) };
  } catch { /* oversized/unsupported persistent shape: memory only */ }
  const space = spaceModels({ spaces: [job.input.raw] } as ServerConfig)[0];
  const cellCm = space.cellCm || 5;
  const light = job.light ? buildLightBarrierScene({ space, revision: job.light,
    walls: job.input.raw.walls || [], zeroWalls: resolveZeroWalls(job.input.raw, space, NORM_W, GRID_PITCH * .02),
    wallKeyPitch: GRID_STEP_N, cellCm, gridPitch: GRID_PITCH, coordScale: NORM_W,
    sharedWallGeometry: frame.union.value,
    physicalBodies: cuts => physicalBodyParts(space, cellCm, GRID_PITCH, GRID_PITCH * .0002, cuts).all,
  }) : undefined;
  if (job.kind === 'light') return { light: encodeGeometryValue(light), ms: performance.now() - started };
  return { wire, payload, light: light && encodeGeometryValue(light),
    hit, work: hit ? {} : frame.work, ms: performance.now() - started };
}

export async function computeFloorJob(job: FloorJob, signal?: AbortSignal): Promise<FloorJobResult> {
  const before = geometryWorkSnapshot();
  const result = await computeFloorJobImpl(job, signal), after = geometryWorkSnapshot();
  return { ...result, producer: { owner: typeof document === 'undefined' ? 'worker' : 'main',
    counts: Object.fromEntries(Object.entries(after).map(([name, count]) => [name, count - before[name]])) } };
}
