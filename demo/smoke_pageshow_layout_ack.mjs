// #902: native released drag, real synthetic-server ACK and old paired read.
// No private card mutation or invented success response enters this witness.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
for (const order of ['ack-before-pair', 'pair-before-ack', 'settled-ack']) {
  const { page, browser } = await launch({ width: 1000, height: 820 });
  try {
    await page.evaluate(async () => {
      const hp = window.__hpTest;
      await hp.waitForWrites();
      await hp.setLayout(layout => ({ ...layout, d_light1: { s: 'f1', x: .3, y: .3 } }));
    });
    const card = page.locator('houseplan-card');
    await card.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
    await page.evaluate(() => window.__hpTest.settled());
    await page.waitForFunction(() => !window.__card._modeTransitionBusy);
    await page.evaluate(() => {
      const c = window.__card, original = c.hass.callWS;
      const proof = window.__ack902 = { writes: [], reads: [], original, holdPair: false };
      const writeGate = new Promise(resolve => { proof.releaseWrite = resolve; });
      const pairGate = new Promise(resolve => { proof.releasePair = resolve; });
      c.hass = { ...c.hass, callWS: async message => {
        if (message.type === 'houseplan/layout/update') {
          const row = { message: structuredClone(message), accepted: false };
          proof.writes.push(row);
          if (proof.writes.length === 1) await writeGate;
          const response = await original(message);
          row.response = structuredClone(response); row.accepted = true;
          return response;
        }
        const response = await original(message);
        if (proof.holdPair && ['houseplan/config/get', 'houseplan/layout/get'].includes(message.type)) {
          proof.reads.push({ type: message.type, response: structuredClone(response) });
          await pairGate;
        }
        return response;
      } };
    });
    const marker = card.locator('[data-hp="device"][data-id="d_light1"]');
    const box = await marker.boundingBox();
    if (!box) throw new Error('native #902 marker is not painted');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 75, y + 35, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(() => window.__ack902.writes.length === 1);
    check(`${order}: released real drag is pending without history`, await page.evaluate(() =>
      !window.__ack902.writes[0].accepted && !window.__card._devicePositionHistory.canUndo));

    if (order === 'settled-ack') {
      await page.evaluate(() => window.__ack902.releaseWrite());
      await page.evaluate(() => window.__hpTest.waitForWrites());
    }
    await page.evaluate(() => {
      window.__ack902.holdPair = true;
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.waitForFunction(() => window.__ack902.reads.length >= 2);
    if (order !== 'settled-ack') check(`${order}: held pair is really older than sent position`,
      await page.evaluate(() => {
        const p = window.__ack902;
        return JSON.stringify(p.reads.find(row => row.type === 'houseplan/layout/get').response.layout.d_light1)
          !== JSON.stringify(p.writes[0].message.pos);
      }));
    if (order === 'ack-before-pair') {
      await page.evaluate(() => window.__ack902.releaseWrite());
      await page.evaluate(() => window.__hpTest.waitForWrites());
    }
    await page.evaluate(() => { window.__ack902.holdPair = false; window.__ack902.releasePair(); });
    if (order === 'pair-before-ack') {
      await page.evaluate(() => window.__hpTest.settled());
      check(`${order}: old read does not invent an ACK or Undo`, await page.evaluate(() =>
        !window.__ack902.writes[0].accepted && !window.__card._devicePositionHistory.canUndo));
      await page.evaluate(() => window.__ack902.releaseWrite());
    }
    await page.evaluate(() => window.__hpTest.waitForWrites());
    await page.waitForFunction(() => !window.__card._loading);
    // Let the ordinary 200ms server echo reconcile too: it must not erase Undo.
    await page.waitForTimeout(250);
    await card.locator('[data-hp="mode-tab"][data-mode="devices"]').click();
    await page.waitForFunction(() => !window.__card._modeTransitionBusy);
    const accepted = await page.evaluate(async () => {
      const c = window.__card, p = window.__ack902;
      const saved = await p.original({ type: 'houseplan/layout/get' });
      const pos = p.writes[0].message.pos, view = c._view;
      const node = c.renderRoot.querySelector('[data-hp="device"][data-id="d_light1"]');
      return { exact: JSON.stringify(c._layout.d_light1) === JSON.stringify(p.writes[0].message.pos)
          && JSON.stringify(saved.layout.d_light1) === JSON.stringify(p.writes[0].message.pos),
        painted: !!node && !!view
          && Math.abs(parseFloat(node.style.left) - (pos.x * 1000 - view.x) / view.w * 100) < .001
          && Math.abs(parseFloat(node.style.top) - (pos.y * 1000 - view.y) / view.h * 100) < .001,
        undo: c._devicePositionHistory.canUndo, count: p.writes.length };
    });
    check(`${order}: accepted canonical position is still shown`, accepted.exact);
    check(`${order}: painted marker matches accepted coordinates`, accepted.painted);
    check(`${order}: one drag is one accepted write`, accepted.count, 1);
    check(`${order}: accepted move remains undoable`, accepted.undo);
    // A broken baseline must report the missing history, not hang on disabled UI.
    if (accepted.undo) {
      await card.locator('[data-device-position-history="undo"]').click();
      await page.evaluate(() => window.__hpTest.waitForWrites());
      check(`${order}: native Undo restores exact start in one write`, await page.evaluate(async () => {
        const p = window.__ack902, saved = await p.original({ type: 'houseplan/layout/get' });
        const pos = saved.layout.d_light1;
        return p.writes.length === 2 && pos?.s === 'f1' && pos.x === .3 && pos.y === .3
          && JSON.stringify(window.__card._layout.d_light1) === JSON.stringify(saved.layout.d_light1);
      }));
      await page.keyboard.press('Control+Shift+Z');
      await page.evaluate(() => window.__hpTest.waitForWrites());
      check(`${order}: native Redo restores exact accepted end in one write`, await page.evaluate(async () => {
        const p = window.__ack902, saved = await p.original({ type: 'houseplan/layout/get' });
        return p.writes.length === 3 && JSON.stringify(saved.layout.d_light1) === JSON.stringify(p.writes[0].message.pos)
          && JSON.stringify(window.__card._layout.d_light1) === JSON.stringify(saved.layout.d_light1);
      }));
    }
  } finally { await finish(browser); }
}
