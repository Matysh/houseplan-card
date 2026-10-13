// #851: real editor controls and form input. Faults are confined to the
// server/geometry refusal boundary; never fabricate a happy-path draft.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('851-editor-draft-exit');
const width = Number(process.env.HP_SMOKE_WIDTH || 1100);
const { page, browser } = await launch({ width, height: 850 }, 1, [], width < 500 ? { hasTouch: true, isMobile: true } : {});
const out = await page.evaluate(async () => {
  const c = window.__card, ui = window.__hpTest, result = {};
  const root = () => c.shadowRoot;
  const dialog = kind => root().querySelector(`hp-dialog[data-kind="${kind}"]`);
  const confirm = () => root().querySelector('hp-confirm hp-dialog');
  const settle = () => ui.settled();
  const wait = async condition => {
    const until = performance.now() + 5000;
    while (!condition()) {
      if (performance.now() > until) throw new Error('851 condition timed out');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await settle();
  };
  const decide = async accepted => {
    if (!confirm()) throw new Error('851 regression: dirty form/navigation closed without its confirmation');
    confirm().querySelector(`[data-hp="dialog-${accepted ? 'confirm' : 'cancel'}"]`).click();
    await settle();
  };
  let writes = 0, rejectSave = false, releaseSave;
  const originalWS = c.hass.callWS;
  c.hass.callWS = async message => {
    if (message.type === 'houseplan/config/set') {
      writes++;
      if (releaseSave) await new Promise(resolve => { releaseSave = resolve; });
      if (rejectSave) throw new Error('851 injected transport refusal');
    }
    return originalWS(message);
  };
  await ui.setMode('devices');
  let owner = await ui.openMarkerDialog();
  const before = writes;
  await ui.close(owner, { via: 'x' });
  result.pristineNewDeviceClosesWithoutQuestion = !dialog('marker') && !confirm() && writes === before;
  for (const via of ['escape', 'x', 'cancel']) {
    owner = await ui.openMarkerDialog();
    await ui.input(owner.querySelector('#marker-name'), `Unfinished ${via}`);
    const field = owner.querySelector('#marker-name');
    await ui.close(owner, { via });
    result[`newDevice${via}HasOneQuestion`] = !!confirm() && root().querySelectorAll('hp-confirm').length === 1;
    await decide(false);
    result[`newDevice${via}KeepPreservesInputAndFocus`] = field.value === `Unfinished ${via}`
      && owner.isConnected && root().activeElement === field;
    await ui.close(owner, { via }); await decide(true);
    result[`newDevice${via}DiscardDoesNotWrite`] = !dialog('marker') && writes === before;
  }
  owner = await ui.openMarkerDialog();
  const name = owner.querySelector('#marker-name'), initial = name.value;
  await ui.input(name, 'changed'); await ui.input(name, initial);
  await ui.close(owner);
  result.returnToInitialIsPristine = !dialog('marker') && !confirm();

  // Creation and face queue enter through real stage clicks.
  await ui.setMode('view');
  await ui.setServerConfig({ model_version: 10, spaces: [
    { id: 'draft', title: 'Draft', cell_cm: 5, view_box: [0, 0, 1, 0.8], rooms: [], partitions: [], openings: [] },
    { id: 'other', title: 'Other', cell_cm: 5, view_box: [0, 0, 1, 0.8], rooms: [], partitions: [], openings: [] },
  ], markers: [], settings: {} });
  await ui.setMode('plan');
  const click = async (x, y) => {
    const stage = root().querySelector('.stage'), rect = stage.getBoundingClientRect();
    const view = c._viewOr(c._baseVb());
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true,
      clientX: rect.left + (x - view.x) / view.w * rect.width,
      clientY: rect.top + (y - view.y) / view.h * rect.height }));
    await settle();
  };
  const draw = async points => { for (const [x, y] of points) await click(x, y); };
  const saved = async () => { await wait(() => !c._pendingPhysicalWrites.size && !c._writesPending); };
  await draw([[200, 200], [500, 200], [500, 450], [200, 450], [200, 200]]);
  await saved();
  owner = dialog('room');
  if (!owner) throw new Error('851 room creation was not offered');
  const partitions = JSON.stringify(c._curSpaceCfg.partitions), roomWrites = writes;
  await ui.input(owner.querySelector('#room-name'), 'Unfinished room');
  await ui.close(owner); await decide(false);
  result.newRoomKeepPreservesDraft = dialog('room') === owner
    && owner.querySelector('#room-name').value === 'Unfinished room';
  // Same-element warm detach cannot forget the baseline or draft.
  const parent = c.parentNode, sibling = c.nextSibling;
  c.remove(); parent.insertBefore(c, sibling); await settle();
  await ui.close(dialog('room')); await decide(true);
  result.warmRoomDiscardKeepsSavedWalls = !dialog('room')
    && JSON.stringify(c._curSpaceCfg.partitions) === partitions && writes === roomWrites;
  await ui.setTool('select');

  await ui.setServerConfig(cfg => {
    cfg.spaces.find(space => space.id === c._space).rooms.push({ id: 'room-edit', name: 'Room', settings: { fill_mode: 'temp' }, poly: [[.6,.2],[.85,.2],[.85,.45],[.6,.45]] });
  });
  owner = await ui.openRoomEdit('room-edit');
  await ui.input(owner.querySelector('#room-temp-min'), '30');
  await ui.input(owner.querySelector('#room-temp-max'), '20');
  await ui.close(owner); await decide(false);
  result.invalidRoomRangeIsProtectedAndRefocused = owner.querySelector('#room-temp-min').value === '30'
    && owner.querySelector('#room-temp-max').value === '20' && root().activeElement === owner.querySelector('#room-temp-max');
  await ui.input(owner.querySelector('#room-temp-min'), '');
  await ui.input(owner.querySelector('#room-temp-max'), '');
  await ui.input(owner.querySelector('#room-name'), 'Retry this room');
  rejectSave = true;
  owner.querySelector('[data-hp="dialog-confirm"]').click();
  await wait(() => !c._writesPending && !c._editorRuntime.roomSaveBusy);
  result.refusedRoomSaveKeepsFormAndInput = owner.isConnected && owner.querySelector('#room-name').value === 'Retry this room';
  result.refusedRoomSaveRollsBackConfig = c._curSpaceCfg.rooms.find(room => room.id === 'room-edit').name === 'Room';
  await ui.close(owner); await decide(false);
  result.refusedRoomSaveKeepsDirtyProtection = owner.isConnected;
  rejectSave = false;
  owner.querySelector('[data-hp="dialog-confirm"]').click();
  await wait(() => !dialog('room'));
  result.retrySaveClosesOnlyAfterAcceptance = c._curSpaceCfg.rooms.find(room => room.id === 'room-edit').name === 'Retry this room' && !confirm();

  // A delayed accepted Save A must not close an identical reopened editor B.
  owner = await ui.openRoomEdit('room-edit');
  await ui.input(owner.querySelector('#room-name'), 'Saved A');
  releaseSave = true;
  owner.querySelector('[data-hp="dialog-confirm"]').click();
  await wait(() => typeof releaseSave === 'function');
  await ui.close(owner); await decide(true);
  const next = await ui.openRoomEdit('room-edit');
  await ui.input(next.querySelector('#room-name'), 'Draft B');
  const release = releaseSave; releaseSave = null; release();
  await saved();
  result.lateRoomSaveDoesNotCloseB = next.isConnected && next.querySelector('#room-name').value === 'Draft B';
  await ui.close(next); await decide(true);

  const preflight = c._checkSpacePhysicalGeometry;
  const refuse = () => { c._checkSpacePhysicalGeometry = () => ({ ok: false }); }; // private-ok: #851 inject only fail-closed geometry refusal; all chain points are authored through DOM.
  const restore = () => { c._checkSpacePhysicalGeometry = preflight; }; // private-ok: #851 restore that same refusal boundary after each case.
  const freshChain = async () => {
    await ui.setTool('draw');
    await draw([[200, 650], [350, 650], [500, 650]]);
    await saved();
  };
  await freshChain(); refuse();
  const chainBefore = JSON.stringify(c._curSpaceCfg.partitions), historyBefore = c._geometryHistory.size, writesBefore = writes;
  await ui.setTool('select');
  result.failedFinishOffersSafeExit = !!confirm() && c._tool === 'draw' && c._path.length > 0;
  await decide(false);
  result.failedFinishKeepChangesNothing = JSON.stringify(c._curSpaceCfg.partitions) === chainBefore
    && c._geometryHistory.size === historyBefore && writes === writesBefore && c._tool === 'draw';
  await ui.setTool('select'); await decide(true);
  result.leaveReleasesOnlySessionAndSelectsRequestedTool = c._tool === 'select' && !c._path.length
    && JSON.stringify(c._curSpaceCfg.partitions) === chainBefore && c._geometryHistory.size === historyBefore && writes === writesBefore;
  restore();
  // Start a new non-coincident run for the no-destination Escape exit.
  await ui.setTool('draw'); await draw([[200, 720], [350, 720], [500, 720]]); await saved(); refuse();
  root().querySelector('.stage').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await settle(); await decide(true);
  result.failedEscapeLeavesIntoSelect = c._tool === 'select' && !c._path.length;
  restore();
  await ui.setTool('draw'); await draw([[550, 650], [650, 650], [750, 650]]); await saved(); refuse();
  location.hash = '#space=other'; await wait(() => !!confirm());
  result.pendingHashRestoresActualFloor = c._space === 'draft' && location.hash === '#space=draft';
  await decide(false);
  result.rejectedHashKeepsUrlAndFloor = c._space === 'draft' && location.hash === '#space=draft';
  location.hash = '#space=other'; await wait(() => !!confirm()); await decide(true);
  result.acceptedHashExecutesRequestedNavigation = c._space === 'other' && location.hash === '#space=other' && !c._path.length;
  restore();
  for (const destination of ['reset', 'space', 'editor', 'retry']) {
    if (c._mode !== 'plan') await ui.setMode('plan');
    await ui.setServerConfig(cfg => {
      const space = cfg.spaces.find(item => item.id === c._space);
      space.partitions = []; space.rooms = []; space.walls = [];
    });
    await freshChain(); refuse();
    const walls = JSON.stringify(c._curSpaceCfg.partitions), history = c._geometryHistory.size, count = writes;
    if (destination === 'reset') {
      const reset = [...root().querySelectorAll('button')].find(button => button.textContent.trim() === c._t('btn.reset'));
      if (!reset) throw new Error('851 Reset button missing');
      reset.click();
    } else if (destination === 'space') {
      const target = c._space === 'draft' ? 'other' : 'draft';
      root().querySelector(`[data-hp="space-tab"][data-id="${target}"]`).click();
    } else if (destination === 'editor') root().querySelector('[data-hp="editor-close"]').click();
    else await ui.setTool('select');
    await wait(() => !!confirm());
    if (destination === 'retry') {
      await decide(false); restore(); await ui.setTool('select'); await saved();
      result.retryFinishesThroughOriginalSafeTransaction = c._tool === 'select' && !c._path.length
        && c._curSpaceCfg.partitions.length === 1;
    } else {
      await decide(true);
      const originalSpace = c._serverCfg.spaces.find(space => JSON.stringify(space.partitions) === walls);
      result[`${destination}LeaveDoesNotRewriteWallsOrHistory`] = !!originalSpace && c._geometryHistory.size === history && writes === count;
      result[`${destination}LeaveReachesDestination`] = destination === 'reset' ? c._tool === 'select'
        : destination === 'space' ? !c._path.length && originalSpace.id !== c._space : c._mode === 'view';
      restore();
    }
  }
  c.hass.callWS = originalWS;
  return result;
});
checkAll(out);
await finish(browser, out);
