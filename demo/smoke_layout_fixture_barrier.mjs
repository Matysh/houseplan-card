// #880: a real label gesture, held point-write receipt, then an authoritative
// fixture. The negative case uses the same exact-content oracle as grid_snap.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 900, height: 820 });
const out = {};
try {
  await page.evaluate(async () => {
    const c = window.__card, hp = window.__hpTest;
    await hp.waitForWrites(); await hp.setMode('plan');
    await hp.setLayout({ rl_r1: { s: 'f1', x: 0.4, y: 0.2 } });
    const base = c.hass.callWS, push = window.__pushServerLayout;
    window.__barrierJournal = [];
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/layout/update' && message.device_id === 'rl_r1') {
        const row = { kind: 'write', pos: structuredClone(message.pos), done: false };
        window.__barrierJournal.push(row);
        await new Promise(resolve => { window.__releaseLayoutReceipt = resolve; });
        const response = await base(message); row.done = true; return response;
      }
      return base(message);
    }};
    window.__pushServerLayout = layout => {
      window.__barrierJournal.push({ kind: 'fixture', pending: c._sentPos.size });
      return push(layout);
    };
  });

  const dragLabel = async () => {
    const before = await page.evaluate(() => window.__barrierJournal.length);
    const label = page.locator('houseplan-card').locator('[data-hp="room-label"][data-id="r1"]');
    const box = await label.boundingBox();
    if (!box) throw new Error('label gesture has no visible room label');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 36, y + 34, { steps: 3 }); await page.mouse.up();
    await page.waitForFunction(index => window.__barrierJournal.slice(index)
      .some(row => row.kind === 'write' && !row.done), before);
  };
  const fixture = { rl_r1: { s: 'f1', x: 0.125, y: 0.25 } };

  // No-barrier negative: the reload protects the still-unacknowledged old
  // position over the new fixture even though the revision check can pass.
  await dragLabel();
  out.latePointWriteIsReallyInFlight = await page.evaluate(() => window.__card._sentPos.has('rl_r1'));
  out.withoutBarrierExactContentOracleRejectsFixture = await page.evaluate(async expected => {
    await window.__hpTest.setLayout(structuredClone(expected));
    return JSON.stringify(window.__card._layout) !== JSON.stringify(expected);
  }, fixture);
  await page.evaluate(() => window.__releaseLayoutReceipt());
  await page.evaluate(() => window.__hpTest.waitForWrites());
  // Explicit recovery after the intentional negative probe, not a retry in
  // the helper: the ordinary positive path still pushes its fixture once.
  await page.evaluate(expected => window.__hpTest.setLayout(structuredClone(expected)), fixture);

  await dragLabel();
  const waiting = page.evaluate(async () => {
    window.__barrierDone = false;
    await window.__hpTest.waitForWrites();
    window.__barrierDone = true;
  });
  out.barrierRetainsPendingWrite = await page.evaluate(() => !window.__barrierDone
    && window.__card._sentPos.has('rl_r1')
    && window.__barrierJournal.at(-1).done === false);
  await page.evaluate(() => window.__releaseLayoutReceipt());
  await waiting;
  out.barrierEndsAfterReceipt = await page.evaluate(() => window.__barrierDone
    && window.__card._sentPos.size === 0 && window.__barrierJournal.at(-1).done === true);
  const beforeFixture = await page.evaluate(() => window.__barrierJournal.length);
  out.fixtureContentMatchesExactly = await page.evaluate(async expected => {
    await window.__hpTest.setLayout(structuredClone(expected));
    return JSON.stringify(window.__card._layout) === JSON.stringify(expected);
  }, fixture);
  out.positiveFixtureDeliveredOnceWithoutPendingWrite = await page.evaluate(before => {
    const rows = window.__barrierJournal.slice(-2);
    return window.__barrierJournal.length === before + 1
      && rows[0]?.kind === 'write' && rows[0].done
      && rows[1]?.kind === 'fixture' && rows[1].pending === 0;
  }, beforeFixture);
} finally { await finish(browser, checkAll(out)); }
