// Robot vacuum trail on a real Home Assistant (houseplan-card#1010, row 3):
// the seed's stored run is drawn; a run started in Home Assistant moves the
// robot on the plan — exactly where its map says it is — and draws a new
// trail that the integration records on the server; after a reload it is
// still there.
//
// The seed robot (demo_robot) drives a fixed serpentine route, 600 mm per
// 2-second tick, so the journey drives it a counted number of ticks: the run,
// and with it every evidence frame, is the same from one run to the next.
//
// Runs before plan-mutating journeys: full import intentionally purges the
// history of removed markers, and config/layout teardown cannot restore it.
// The 00- prefix makes the existing one-worker file order explicit. Later
// journeys may replace the plan; no test fabricates/restores trail storage.
import { test, expect } from '@playwright/test';
import { requireHooks } from './lib/contract.mjs';
import { callService, getState, waitForState } from './lib/ha-api.mjs';
import { card, evidence, expectPlanDrawn } from './lib/ha-page.mjs';
import { planConfig, wsCall } from './lib/ha-ws.mjs';
import { hp } from './lib/hooks.mjs';
import { toClient } from './lib/plan.mjs';

requireHooks(test, 'stage', 'vacuum-trail', 'vacuum-trail-segment@data-entity', 'vacuum-puck@data-entity');

const VACUUM = 'vacuum.demo_robot';
const ROBOT_MAP = 'sensor.demo_robot_map';
const MARKER = 'e_vacuum_demo_robot';
const DOCK = { x: 6100, y: 3600 }; // mm, seed/custom_components/demo_robot
const trailOf = async () => (await wsCall({ type: 'houseplan/trail/get' })).trails?.[MARKER] ?? {};
const robotAt = async () => (await getState(ROBOT_MAP)).attributes.vacuum_position;
const lastPoint = (run) => (run?.paths?.length ? run.paths.at(-1).at(-1) : run?.points?.at(-1)) ?? null;
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Starts (or resumes) the robot, lets it drive `ticks` telemetry steps, pauses it. */
async function drive(ticks) {
  let last = JSON.stringify(await robotAt());
  await callService('vacuum', 'start', { entity_id: VACUUM });
  for (let seen = 0; seen < ticks;) {
    await new Promise((r) => setTimeout(r, 100));
    const now = JSON.stringify(await robotAt());
    if (now !== last) { seen += 1; last = now; }
  }
  await callService('vacuum', 'pause', { entity_id: VACUUM });
  await waitForState(VACUUM, 'paused');
}

test.afterEach(async () => {
  // back to the dock, so the next journeys find a parked robot
  if ((await getState(VACUUM)).state !== 'docked') {
    await callService('vacuum', 'return_to_base', { entity_id: VACUUM });
    await waitForState(VACUUM, 'docked', 120_000);
  }
});

test('the stored trail is drawn, a live run moves the robot and draws a trail the server keeps', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await waitForState(VACUUM, 'docked');
  // This journey observes the immutable seeded previous run before destructive
  // full imports. Missing history is a broken fixture precondition, never an
  // alternate rendering success or a reason to manufacture a replacement run.
  const stored = await trailOf();
  await testInfo.attach('vacuum-seeded-trails-before-render.json', {
    body: JSON.stringify({ marker: MARKER, trails: stored }), contentType: 'application/json',
  });
  expect(stored.previous, 'seed previous run must precede marker-removing imports').toBeTruthy();
  expect(stored.previous.map_id).toBe('1');
  expect(lastPoint(stored.previous)).toEqual([4041.9, 3088.3]);
  const marker = (await planConfig()).config.markers.find((m) => m.id === MARKER);
  const [a, b, c, d, e, f] = Object.values(marker.vacuum.calibration)[0];
  await page.goto('/houseplan');
  let host = card(page);
  await expectPlanDrawn(page, host);
  const segment = (kind) => host.locator(hp('vacuum-trail-segment', { entity: VACUUM, kind }));
  const puck = () => host.locator(hp('vacuum-puck', { entity: VACUUM })).first();
  await expect(host.locator(hp('vacuum-trail')).first()).toBeAttached();
  await expect(segment('previous').first()).toBeAttached();
  await evidence(testInfo, page, 'vacuum-stored-trail');

  // the puck is drawn where the robot's map puts it, through the marker's
  // calibration (it glides between telemetry points: wait for it to land)
  const offPosition = async () => {
    const at = await robotAt();
    const box = await puck().boundingBox();
    if (!box || JSON.stringify(await robotAt()) !== JSON.stringify(at)) return Infinity;
    const want = await toClient(host, a * at.x + b * at.y + c, d * at.x + e * at.y + f);
    return Math.hypot(box.x + box.width / 2 - want.x, box.y + box.height / 2 - want.y);
  };
  const run = drive(10);
  await waitForState(VACUUM, 'cleaning');
  await expect(puck()).toBeVisible({ timeout: 15_000 });
  await expect.poll(offPosition, { timeout: 15_000, message: 'the puck sits where the robot is' }).toBeLessThan(3);
  await run;

  // the server recorded the run: it ends where the paused robot stands, away from the dock
  const stopped = await robotAt();
  expect(apart(stopped, DOCK)).toBeGreaterThan(1000);
  await expect.poll(async () => {
    const last = lastPoint((await trailOf()).current);
    return last ? apart({ x: last[0], y: last[1] }, stopped) : Infinity;
  }, { timeout: 15_000, message: 'the stored run ends at the robot' }).toBeLessThanOrEqual(1);
  await expect(segment('current').first()).toBeAttached();
  const recorded = (await trailOf()).current;
  await evidence(testInfo, page, 'vacuum-live-trail');

  await page.reload();
  host = card(page);
  await expectPlanDrawn(page, host);
  await expect(segment('current').first()).toBeAttached();
  expect(lastPoint((await trailOf()).current)).toEqual(lastPoint(recorded));
  await evidence(testInfo, page, 'vacuum-after-reload');

  // the puck is the robot on the move: resumed after the reload, it is back
  const resumed = drive(4);
  await expect(puck()).toBeVisible({ timeout: 15_000 });
  await resumed;
});
