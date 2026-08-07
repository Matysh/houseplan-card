import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const tabs = () => [...sr().querySelectorAll('.modetab')];
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
  out.tabCross = !!tabs()[0].querySelector('.closex');
  // 3) повторный клик по активной вкладке — ничего
  tabs()[0].click(); await c.updateComplete;
  out.reclickNoop = c._mode === 'plan';
  // 4) прямое переключение План → Устройства
  tabs()[1].click(); await c.updateComplete;
  out.directSwitch = c._mode === 'devices';
  out.devBar = !!sr().querySelector('.editbar.devbar');
  out.devBarBtns = sr().querySelectorAll('.editbar.devbar .btn:not(.barclose)').length === 3; // add/show-all/rules (v1.33.2: Reset removed)
  // 5) инструменты устройств из шапки исчезли (в .bar их больше нет)
  out.headerCleanInDev = !sr().querySelector('.bar > .btn[title*="' + (c._t('title.add_device')) + '"]');
  // 6) крестик на панели → Просмотр
  sr().querySelector('.editbar .barclose').click(); await c.updateComplete;
  const chrome = sr().querySelector('.editorchrome');
  out.barCloseStarts = c._mode === 'view' && !chrome.classList.contains('open')
    && chrome.getAttribute('aria-hidden') === 'true';
  // The last bar deliberately remains mounted while its grid row collapses.
  await new Promise((resolve) => setTimeout(resolve, 220));
  out.barCloseWorks = c._mode === 'view'
    && getComputedStyle(chrome).visibility === 'hidden'
    && chrome.getBoundingClientRect().height < 1;
  // 7) крестик в самой вкладке → Просмотр (и не переключает режим)
  tabs()[1].click(); await c.updateComplete;
  tabs()[1].querySelector('.closex').click(); await c.updateComplete;
  out.tabCrossWorks = c._mode === 'view';

  // Layout-independent editor history: physical KeyZ works when `key` is the
  // Russian «я», while an input keeps its native browser history.
  tabs()[0].click(); await c.updateComplete;
  const realUndo = c._undoGeometry;
  let undoCalls = 0;
  c._undoGeometry = () => { undoCalls += 1; };
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'я', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.layoutIndependentUndo = undoCalls === 1;
  const editorInput = sr().querySelector('.editbar input');
  editorInput.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'я', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true,
  }));
  out.inputKeepsNativeUndo = undoCalls === 1;
  c._undoGeometry = realUndo;

  // Ctrl+click closes a valid draft without adding the click as a new point;
  // the same gesture must refuse a draft with fewer than two existing edges.
  const savedPath = c._path;
  const savedRoomDialog = c._roomDialog;
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
  c._path = savedPath;
  c._roomDialog = savedRoomDialog;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "labels": ["Plan editor", "Device editor", "Background editor"],
});
await finish(browser, res);
