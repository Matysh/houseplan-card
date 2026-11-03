/**
 * Journeys that edit the plan put the seed back afterwards, through the
 * integration's own websocket API (tests/lib/ha-ws.mjs). Each scenario then
 * starts from the same house and leaves the same house for the next one, in
 * any order and on a retry. The restore is teardown, never an oracle.
 */
import { restorePlan, snapshotPlan } from './ha-ws.mjs';

export function restoreSeedAfterEach(test) {
  let seed;
  test.beforeAll(async () => { seed = await snapshotPlan(); });
  test.afterEach(async () => { if (seed) await restorePlan(seed); });
}
