// #1161: native warm navigation, actual compiled snapshot work, hidden HA return.
import { launch, checkAll, finish } from './serve.mjs';
import { evaluateRetainedAction } from './helpers/retained-page-action.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 });
try {
  await page.waitForFunction(() => !!window.__card._liveRt?.work);
  const report = await evaluateRetainedAction(page, async () => {
    const c = window.__card, hp = window.__hpTest;
    const out = {}, saved = new Map();
    await hp.setMode('view');
    const floors = c._model.map(space => space.id);
    if (floors.length < 2 || floors.length > 8) throw Error('fixture requires two to eight real floors');
    for (const floor of floors) {
      await hp.switchSpace(floor);
      const snapshot = c._renderDeviceSnapshot;
      if (!snapshot?.presentations.size) throw Error(`no real faces on ${floor}`);
      saved.set(floor, snapshot);
    }
    const before = c._liveRt.work();
    let sameFaces = true, neverBlank = true;
    for (let index = 0; index < 12; index++) {
      const floor = floors[index % floors.length];
      await hp.switchSpace(floor);
      const snapshot = c._renderDeviceSnapshot, previous = saved.get(floor);
      if (!snapshot?.presentations.size) throw Error('warm navigation lost its snapshot');
      for (const [key, face] of snapshot.presentations)
        sameFaces &&= face === previous.presentations.get(key);
      const stage = c.renderRoot.querySelector('.stage');
      neverBlank &&= !!stage && stage.clientWidth > 0 && stage.clientHeight > 0
        && !!stage.querySelector('[data-hp="device"]');
    }
    const after = c._liveRt.work();
    out.realMultiFloorFixture = saved.size >= 2;
    out.noFullCaptureInTwelveWarmSwitches = after.full === before.full;
    out.noUnchangedFaceResolutions = after.presentations === before.presentations;
    out.sameImmutableFacesOnReturn = sameFaces;
    out.noBlankWarmFloor = neverBlank;

    const first = floors[0], hidden = saved.get(first);
    const device = c._devices.find(device => device.space === first && device.primary?.startsWith('light.')
      && hidden.hass.states[device.primary] && !saved.get(floors[1]).entityIds.includes(device.primary));
    if (!device) throw Error('fixture needs a real lamp on the first floor');
    const eid = device.primary, oldState = hidden.hass.states[eid].state;
    const nextState = oldState === 'on' ? 'off' : 'on';
    await hp.switchSpace(floors[1]);
    const beforeHidden = c._liveRt.work();
    c.hass = { ...c.hass, states: { ...c.hass.states,
      [eid]: { ...c.hass.states[eid], state: nextState } } };
    await hp.settled();
    const afterHidden = c._liveRt.work();
    out.hiddenTickDoesNotCaptureVisibleFloor = afterHidden.full === beforeHidden.full
      && afterHidden.incremental === beforeHidden.incremental && afterHidden.refreshed === beforeHidden.refreshed;
    await hp.switchSpace(first);
    out.hiddenReturnHasLatestState = c._renderDeviceSnapshot.hass.states[eid].state === nextState;
    out.heldOldFrameRemainsImmutable = hidden.hass.states[eid].state === oldState;
    out.changedDeviceIsStillDrawn = !!c.renderRoot.querySelector(
      `[data-hp="device"][data-id="${CSS.escape(device.id)}"]`);
    return { out, work: { fullDelta: after.full - before.full,
      presentationsDelta: after.presentations - before.presentations } };
  }, 'warm floor snapshot reuse');
  console.log(JSON.stringify(report.work));
  await finish(browser, checkAll(report.out));
} catch (error) {
  await browser.close();
  throw error;
}
