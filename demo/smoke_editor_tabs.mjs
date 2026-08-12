import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const tabs = () => [...sr().querySelectorAll('.modetab')];
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  // 1) две вкладки, Просмотра нет, крестиков в неактивных нет
  out.twoTabs = tabs().length === 3; // третья — Редактор подложки (v1.33.0)
  out.labels = tabs().map((t) => t.textContent.trim());
  out.noCrossIdle = sr().querySelectorAll('.modetab .closex').length === 0;
  out.startView = c._mode === 'view';
  // 2) клик по «Редактор плана» → активна, панель с крестиком
  tabs()[0].click(); await c.updateComplete;
  out.planActive = c._mode === 'plan' && tabs()[0].classList.contains('active');
  out.planBar = !!sr().querySelector('.editbar');
  out.planBarClose = !!sr().querySelector('.editbar .barclose');
  const barClose = sr().querySelector('.editbar .barclose');
  const barCloseIcon = barClose?.querySelector('ha-icon');
  const barCloseRect = barClose?.getBoundingClientRect();
  const barCloseIconRect = barCloseIcon?.getBoundingClientRect();
  out.planBarCloseIconIsCentered = !!barCloseRect && !!barCloseIconRect
    && Math.abs((barCloseIconRect.left + barCloseIconRect.width / 2)
      - (barCloseRect.left + barCloseRect.width / 2)) <= 1
    && Math.abs((barCloseIconRect.top + barCloseIconRect.height / 2)
      - (barCloseRect.top + barCloseRect.height / 2)) <= 1;
  out.tabCross = !!tabs()[0].querySelector('.closex');
  // 3) повторный клик по активной вкладке — ничего
  tabs()[0].click(); await c.updateComplete;
  out.reclickNoop = c._mode === 'plan';
  await settleMode();
  // HP-UX-11: transient tool controls live in a stage overlay. Opening the
  // thickness controls must not resize/refit the stage or move pinned Close.
  const stageBeforeContext = sr().querySelector('.stage').getBoundingClientRect();
  const closeBeforeContext = sr().querySelector('.editbar .barclose').getBoundingClientRect();
  const hdrBeforeContext = c._hdrH;
  c._tool = 'draw'; c.requestUpdate(); await c.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 40));
  const stageWithContext = sr().querySelector('.stage').getBoundingClientRect();
  const closeWithContext = sr().querySelector('.editbar .barclose').getBoundingClientRect();
  const secondary = sr().querySelector('.editor-secondary-host.open .editor-secondary');
  out.contextTrayLivesInStage = !!secondary
    && secondary.closest('.stage') === sr().querySelector('.stage')
    && !secondary.closest('.editorchrome');
  out.contextDoesNotResizeStage = Math.abs(stageWithContext.top - stageBeforeContext.top) <= 1
    && Math.abs(stageWithContext.height - stageBeforeContext.height) <= 1
    && c._hdrH === hdrBeforeContext;
  out.contextDoesNotMoveClose = Math.abs(closeWithContext.left - closeBeforeContext.left) <= 1
    && Math.abs(closeWithContext.top - closeBeforeContext.top) <= 1;
  out.closeHasPinnedEndCap = !!sr().querySelector('.editbar > .editbar-end > .barclose');
  // No current tools are grouped automatically. Inject one declarative group
  // to pin the generic launcher/keyboard/restore contract for future editors.
  let groupInvokes = 0;
  Object.defineProperty(c, '_editorToolbarGroups', { configurable: true, get: () => [{
    id: 'smoke-group', label: 'Smoke group', icon: 'mdi:dots-grid', items: [{
      id: 'smoke-command', label: 'Smoke command', icon: 'mdi:check',
      role: 'command', invoke: () => { groupInvokes += 1; },
    }],
  }] });
  c.requestUpdate(); await c.updateComplete;
  const groupLauncher = sr().querySelector('[data-editor-group="smoke-group"]');
  groupLauncher?.focus();
  groupLauncher?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowDown', bubbles: true, composed: true, cancelable: true,
  }));
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  out.groupUsesSharedTray = !!sr().querySelector('.editor-secondary.kind-group')
    && sr().querySelectorAll('.editor-secondary-host').length === 1;
  out.groupArrowDownMovesFocus = sr().activeElement?.classList?.contains('editor-group-item') === true;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  out.groupEscapeRestoresToolContext = c._editorSecondary.hasOpenGroup === false
    && !!sr().querySelector('.editor-secondary.kind-tool')
    && sr().activeElement === groupLauncher;
  groupLauncher?.click(); await c.updateComplete;
  sr().querySelector('.editor-group-item')?.click(); await c.updateComplete;
  out.groupCommandClosesBeforeInvoke = groupInvokes === 1
    && c._editorSecondary.hasOpenGroup === false
    && !!sr().querySelector('.editor-secondary.kind-tool');
  groupLauncher?.click(); await c.updateComplete;
  const outsideTool = document.createElement('button');
  const unrelatedTool = document.createElement('button');
  let outsideInvokes = 0;
  let unrelatedInvokes = 0;
  outsideTool.addEventListener('click', () => outsideInvokes++);
  unrelatedTool.addEventListener('click', () => unrelatedInvokes++);
  document.body.append(outsideTool, unrelatedTool);
  outsideTool.dispatchEvent(new PointerEvent('pointerdown', {
    pointerId: 301, pointerType: 'mouse', button: 0,
    bubbles: true, composed: true, cancelable: true,
  }));
  outsideTool.dispatchEvent(new MouseEvent('click', {
    button: 0, bubbles: true, composed: true, cancelable: true,
  }));
  unrelatedTool.click();
  await c.updateComplete;
  out.groupOutsideDismissIsConsumed = c._editorSecondary.hasOpenGroup === false
    && outsideInvokes === 0 && c._tool === 'draw';
  out.dismissTailDoesNotEatUnrelatedClick = unrelatedInvokes === 1;
  outsideTool.remove();
  unrelatedTool.remove();
  delete c._editorToolbarGroups;
  c._tool = 'select'; c.requestUpdate(); await c.updateComplete;
  // 4) прямое переключение План → Устройства
  // Deliberately make the outgoing bar taller: the editor transition must
  // interpolate real content height, not merely fade two equal-height rows.
  const planBarBeforeSwap = sr().querySelector('.editorchrome .editbar');
  planBarBeforeSwap.style.minHeight = `${planBarBeforeSwap.getBoundingClientRect().height + 36}px`;
  tabs()[1].click(); await c.updateComplete;
  out.directSwitch = c._mode === 'devices';
  out.devBar = !!sr().querySelector('.editbar.devbar');
  out.devBarBtns = sr().querySelectorAll('.editbar.devbar .btn:not(.barclose)').length === 3; // add/show-all/rules (v1.33.2: Reset removed)
  const swapChrome = sr().querySelector('.editorchrome');
  const swapInner = swapChrome.querySelector('.editorchrome-inner');
  out.editorSwapAnimatesHeight = c._modeTransitionBusy
    && sr().querySelector('.stage').classList.contains('mode-transition');
  out.editorSwapAnimatesContent = c._modeTransitionBusy && !!swapInner
    && (c._modeTransitionVisual?.toolbarContentOpacity ?? 1) < 1;
  await settleMode();
  // 5) инструменты устройств из шапки исчезли (в .bar их больше нет)
  out.headerCleanInDev = !sr().querySelector('.bar > .btn[title*="' + (c._t('title.add_device')) + '"]');
  // 6) крестик на панели → Просмотр
  sr().querySelector('.editbar .barclose').click(); await c.updateComplete;
  const chrome = sr().querySelector('.editorchrome');
  out.barCloseStarts = c._mode === 'view' && c._modeTransitionBusy
    && sr().querySelector('.stage').inert
    && sr().querySelector('.stage').classList.contains('mode-transition');
  await settleMode();
  out.barCloseWorks = c._mode === 'view'
    && getComputedStyle(chrome).visibility === 'hidden'
    && chrome.getBoundingClientRect().height < 1;
  // 7) крестик в самой вкладке → Просмотр (и не переключает режим)
  tabs()[1].click(); await settleMode();
  tabs()[1].querySelector('.closex').click(); await settleMode();
  out.tabCrossWorks = c._mode === 'view';

  // Layout-independent editor history: physical KeyZ works when `key` is the
  // Russian «я», while an input keeps its native browser history.
  tabs()[0].click(); await settleMode();
  c._tool = 'draw'; c.requestUpdate(); await c.updateComplete;
  const realUndo = c._undoGeometry;
  const realRedo = c._redoGeometry;
  let undoCalls = 0;
  let redoCalls = 0;
  c._undoGeometry = () => { undoCalls += 1; };
  c._redoGeometry = () => { redoCalls += 1; };
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'я', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.layoutIndependentUndo = undoCalls === 1;
  const editorInput = sr().querySelector('.editor-secondary input');
  editorInput.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'я', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.inputKeepsNativeUndo = undoCalls === 1;
  // QWERTZ swaps the physical Y/Z codes. The labelled key wins when it is a
  // Latin letter; otherwise both isZ/isY became true and Redo ran first.
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyY', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.qwertzCtrlZIsUndo = undoCalls === 2 && redoCalls === 0;
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'y', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.qwertzCtrlYIsRedo = undoCalls === 2 && redoCalls === 1;
  // On AZERTY the physical KeyZ carries W: Ctrl+W must remain the browser's
  // close-tab shortcut, never an editor Undo.
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'w', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.azertyCtrlWIsNotUndo = undoCalls === 2 && redoCalls === 1;
  c._undoGeometry = realUndo;
  c._redoGeometry = realRedo;

  // Ctrl+click closes a valid draft without adding the click as a new point;
  // the same gesture must refuse a draft with fewer than two existing edges.
  const savedPath = c._path;
  const savedRoomDialog = c._roomDialog;
  const savedNameSel = c._nameSel;
  const savedAreaSel = c._areaSel;
  const ctrlClick = () => {
    let prevented = false;
    c._markupClick({
      ctrlKey: true, metaKey: false, clientX: 0, clientY: 0,
      preventDefault() { prevented = true; }, composedPath() { return []; },
    });
    return prevented;
  };
  c._tool = 'draw';
  c._roomDialog = false;
  c._path = [[-120, -120], [-80, -120]];
  const shortBefore = JSON.stringify(c._path);
  out.ctrlCloseRequiresTwoEdges = ctrlClick()
    && !c._roomDialog && JSON.stringify(c._path) === shortBefore;
  c._path = [[-120, -120], [-80, -120], [-80, -80]];
  out.ctrlCloseValidContour = ctrlClick() && c._roomDialog
    && c._path.length === 4
    && c._path[0][0] === c._path[3][0] && c._path[0][1] === c._path[3][1];
  await c.updateComplete;
  const roomDialog = sr().querySelector('hp-dialog.roomdialog');
  const roomBody = roomDialog?.querySelector('.body');
  out.roomDialogUsesMediumWidth = roomDialog?.wide === true
    && roomDialog.hasAttribute('wide');
  out.roomDialogHasNoHorizontalScroll = !!roomBody
    && roomBody.scrollWidth <= roomBody.clientWidth + 1;
  c._nameSel = 'No-area room';
  c._areaSel = '';
  c.requestUpdate();
  await c.updateComplete;
  const noAreaSave = sr().querySelector('hp-dialog.roomdialog .room-save');
  out.noAreaUsesRegularSave = !!noAreaSave && !noAreaSave.disabled
    && sr().querySelectorAll('hp-dialog.roomdialog .room-save').length === 1;
  c._path = savedPath;
  c._roomDialog = savedRoomDialog;
  c._nameSel = savedNameSel;
  c._areaSel = savedAreaSel;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "labels": ["Plan editor", "Device editor", "Background editor"],
});
await finish(browser, res);
