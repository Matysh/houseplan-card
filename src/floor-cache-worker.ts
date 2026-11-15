import { computeFloorJob } from './floor-cache-compute';
import type { FloorJob } from './floor-cache-job';
const fingerprint = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const port = globalThis as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; job: FloorJob }>) => void) | null;
  postMessage(value: unknown): void;
};
port.onmessage = async event => {
  const { id, job } = event.data;
  try { port.postMessage({ id, fingerprint, result: await computeFloorJob(job) }); }
  catch { port.postMessage({ id, fingerprint, error: 'floor-cache:compute-failed' }); }
};
