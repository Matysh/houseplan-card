// #478 keeps every native Draw click crash-safe. #1283 preserves live endpoints
// until Finish, then collapses the compatible run. A normalizing fixture writer
// cannot stand in for that live session: it has no active endpoint protections.
import { launch, checkAll, finish } from './serve.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';

const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
const fixture = currentGraphFixture({ spaces: [{ id: 'chain', title: 'Chain', cell_cm: 5,
  view_box: [0, 0, 1, 1], rooms: [{ id: 'envelope',
    poly: [[.01, .01], [.99, .01], [.99, .99], [.01, .99]] }], partitions: [] }],
  markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } });
const settle = () => page.evaluate(async () => {
  await window.__hpTest.waitForWrites(); await window.__hpTest.settled();
});
const snapshot = () => page.evaluate(async () => {
  const c = window.__card, reply = await c.hass.callWS({ type: 'houseplan/config/get' });
  return { space: reply.config.spaces.find(space => space.id === 'chain'),
    path: c._path, active: c._activeWallChainId, ids: [...c._activeWallChainPartitionIds] };
});
const draw = async points => {
  await page.evaluate(() => window.__hpTest.setTool('draw'));
  await page.locator('[data-hp="field"][data-field="wall-thickness"]').fill('15');
  await page.keyboard.press('Tab'); await settle();
  await page.waitForFunction(() => !window.__card._modeTransitionBusy);
  for (const [ix, iy] of points) {
    const point = await page.evaluate(({ ix, iy }) => {
      const stage = window.__card.renderRoot.querySelector('[data-hp="stage"]');
      const p = stage.createSVGPoint(); p.x = ix * 1000 / 240; p.y = iy * 1000 / 240;
      const mapped = p.matrixTransform(stage.getScreenCTM()); return [mapped.x, mapped.y];
    }, { ix, iy });
    await page.mouse.click(...point); await settle();
  }
};
const finishChain = async () => {
  await page.evaluate(() => window.__hpTest.setTool('select')); await settle(); return snapshot();
};
const spans = (wall, a, b) => !!wall && (JSON.stringify([wall.a, wall.b]) === JSON.stringify([a, b])
  || JSON.stringify([wall.b, wall.a]) === JSON.stringify([a, b]));
try {
  await page.evaluate(async config => {
    await window.__hpTest.setServerConfig(config); await window.__hpTest.setLayout({});
    await window.__hpTest.switchSpace('chain'); await window.__hpTest.setMode('plan');
  }, fixture);
  const out = {};
  await draw([[48, 72], [72, 72], [100, 72], [132, 72]]);
  const live = await snapshot();
  out.chainHasThreeSegments = live.space.partitions.length === 3 && live.ids.length === 3 && live.path.length === 4;
  const straight = await finishChain();
  out.straightRunMergedAtFinish = straight.space.partitions.length === 1
    && straight.space.partitions[0].id === [...live.ids].sort()[0];
  out.straightRunSpansTheChain = spans(straight.space.partitions[0], [.2, .3], [.55, .3]);
  out.straightRunKeepsThickness = straight.space.partitions.every(wall => wall.cm === 15);

  await draw([[48, 168], [96, 168], [96, 196]]);
  const cornerLive = await snapshot(), corner = await finishChain();
  const corners = corner.space.partitions.filter(wall => cornerLive.ids.includes(wall.id));
  out.cornerKeepsBothRecords = corners.length === 2
    && corners.some(wall => spans(wall, [.2, .7], [.4, .7]))
    && corners.some(wall => spans(wall, [.4, .7], [.4, 196 / 240]));

  // Resume the existing endpoint through native clicks, so the real Draw
  // session protects its first node until the explicit Finish boundary.
  await draw([[132, 72], [168, 72]]);
  const extension = await snapshot();
  out.clickPersistsOrdinaryWall = extension.space.partitions.length === corner.space.partitions.length + 1
    && extension.ids.length === 1
    && extension.space.partitions.some(wall => spans(wall, [.55, .3], [.7, .3]));
  const joined = await finishChain();
  out.finishMergesOnlyTheExtension = joined.space.partitions.length === corner.space.partitions.length
    && corners.every(wall => JSON.stringify(joined.space.partitions.find(p => p.id === wall.id)) === JSON.stringify(wall));
  const retainedId = [straight.space.partitions[0].id, ...extension.ids].sort()[0];
  out.extensionJoinedExistingRun = joined.space.partitions.some(wall => wall.id === retainedId
    && wall.cm === 15 && spans(wall, [.2, .3], [.7, .3]));
  out.sessionCleared = !joined.active && joined.ids.length === 0 && joined.path.length === 0;
  checkAll(out); console.log(JSON.stringify(out, null, 1));
} finally { await finish(browser); }
