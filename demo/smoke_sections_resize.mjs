// #648: Home Assistant Sections owns the card height.  The production bundle
// must fill that slot at every row count instead of leaking its viewport-sized
// stage through the dashboard, including while editor chrome opens/closes.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 940 }, 1);

const out = await page.evaluate(async () => {
  const card = window.__card;
  const host = document.getElementById('host');
  const root = card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (probe, label, timeout = 6000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      const value = probe();
      if (value) return value;
      await sleep(20);
    }
    throw new Error(`Sections smoke timed out: ${label}`);
  };
  const rowHeight = (rows) => rows * 64 - 8;
  const settle = async () => {
    await card.updateComplete;
    await frame(); await frame(); await frame();
  };
  const rect = (node) => node.getBoundingClientRect();
  const geometry = () => {
    const haCard = root.querySelector('ha-card');
    const header = root.querySelector('.hdr');
    const stage = root.querySelector('.stage');
    return {
      host: rect(host), card: rect(card), haCard: rect(haCard),
      header: rect(header), stage: rect(stage),
      cardScroll: card.scrollHeight - card.clientHeight,
      haCardScroll: haCard.scrollHeight - haCard.clientHeight,
      stageStyle: stage.style.height,
    };
  };
  const fillsSlot = (sample, expected) =>
    Math.abs(sample.host.height - expected) <= 1
    && Math.abs(sample.card.height - expected) <= 1
    && Math.abs(sample.haCard.height - expected) <= 1
    && Math.abs(sample.header.height + sample.stage.height - expected) <= 1
    && sample.stage.height > 0
    && sample.cardScroll <= 1
    && sample.haCardScroll <= 1;
  const setRows = async (rows) => {
    const expected = rowHeight(rows);
    host.style.height = `${expected}px`;
    await waitFor(() => Math.abs(card.getBoundingClientRect().height - expected) <= 1,
      `${rows} rows card height`);
    await settle();
    return geometry();
  };
  const center = () => {
    const view = card._view;
    return view ? [view.x + view.w / 2, view.y + view.h / 2] : null;
  };
  const near = (a, b, tolerance = 0.02) =>
    !!a && !!b && Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;

  host.style.cssText = `box-sizing:border-box;width:780px;height:${rowHeight(10)}px;`
    + 'margin:0;padding:0;overflow:visible;';
  document.body.style.margin = '0';

  // HA merges explicit dashboard grid_options outside the element.  A frozen
  // input proves the card neither writes those options nor tries to persist a
  // competing value of its own.
  const config = Object.freeze({
    type: 'custom:houseplan-card', title: 'Sections fixture', language: 'ru',
    grid_options: Object.freeze({ rows: 14, columns: 'full' }),
  });
  const configBefore = JSON.stringify(config);
  card.setConfig(config);
  card.layout = 'grid';
  await settle();
  const defaults = card.getGridOptions();
  const defaultGeometry = await setRows(10);

  // Absence of HA's grid signal retains the ordinary viewport contract.  This
  // is checked on the real rendered inline style, then the fixture returns to
  // Sections before any behavioural assertions.
  card.layout = null;
  await settle();
  const ordinary = geometry();
  card.layout = 'grid';
  await setRows(10);

  const minimumGeometry = await (async () => {
    host.style.width = '390px';
    const sample = await setRows(6);
    const header = root.querySelector('.hdr');
    return {
      sample,
      headerContained: header.scrollHeight - header.clientHeight <= 1,
      menuReachable: !!root.querySelector('[data-hp="header-menu"]')
        || !!root.querySelector('[data-hp="mode-tab"]'),
    };
  })();
  host.style.width = '780px';
  await setRows(10);

  root.querySelector('[data-hp="zoom-in"]').click();
  await waitFor(() => card._zoom > 1 && !card._cameraTransition?.active, 'zoom before resize');
  await settle();
  const preservedZoom = card._zoom;
  const preservedCenter = center();
  const resizeHeights = [];
  let stableView = true;
  const stableSpace = card._space;
  const stableMode = card._mode;
  let moreInfo = 0;
  card.addEventListener('hass-more-info', () => { moreInfo += 1; });
  for (const rows of [6, 10, 14, 6]) {
    const sample = await setRows(rows);
    resizeHeights.push(Math.round(sample.stage.height));
    stableView &&= Math.abs(card._zoom - preservedZoom) < 1e-9
      && near(center(), preservedCenter)
      && Math.abs(card._view.w / card._view.h - sample.stage.width / sample.stage.height) < 0.001;
  }

  // Every editor must borrow its chrome from inside the slot.  Exercise both
  // the default and minimum, and wait for the real animated transition rather
  // than forcing the private settled state.
  let editorsContained = true;
  let editorsSettle = true;
  for (const rows of [10, 6]) {
    await setRows(rows);
    for (const mode of ['plan', 'devices', 'decor']) {
      await window.__hpTest.setMode(mode);
      await waitFor(() => card._mode === mode && !card._modeTransitionBusy,
        `${mode} enter at ${rows} rows`);
      await settle();
      const entered = geometry();
      editorsContained &&= fillsSlot(entered, rowHeight(rows));
      editorsSettle &&= !root.querySelector('.stage').hasAttribute('inert')
        && !root.querySelector('.editorchrome')?.classList.contains('transitioning');
      await window.__hpTest.setMode('view');
      await waitFor(() => card._mode === 'view' && !card._modeTransitionBusy,
        `${mode} exit at ${rows} rows`);
      await settle();
      editorsContained &&= fillsSlot(geometry(), rowHeight(rows));
    }
  }

  // A short resize storm is the failure mode most likely to expose a
  // ResizeObserver feedback loop. Require the last size to win in a bounded
  // interval and prove the geometry stops changing after settling.
  const stormStarted = performance.now();
  for (let index = 0; index < 30; index++) {
    host.style.height = `${rowHeight(index % 2 ? 6 : 14)}px`;
    await frame();
  }
  host.style.height = `${rowHeight(10)}px`;
  await waitFor(() => Math.abs(card.clientHeight - rowHeight(10)) <= 1
    && Math.abs(root.querySelector('.hdr').getBoundingClientRect().height
      + root.querySelector('.stage').getBoundingClientRect().height - rowHeight(10)) <= 1,
  'resize storm final geometry');
  await settle();
  const stormElapsed = performance.now() - stormStarted;
  const settledStage = geometry().stage;
  await frame(); await frame(); await frame(); await frame();
  const finalGeometry = geometry();
  const finalStage = root.querySelector('.stage');
  const stageRect = finalStage.getBoundingClientRect();
  const matrix = root.querySelector('.plan-svg')?.getScreenCTM();
  const finalPoint = matrix
    ? new DOMPoint(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2)
      .matrixTransform(matrix.inverse())
    : null;
  const finalCenter = center();

  return {
    executableGridDefaults: JSON.stringify(defaults)
      === JSON.stringify({ columns: 'full', rows: 10, min_rows: 6 })
      && !Object.prototype.hasOwnProperty.call(defaults, 'max_rows')
      && card.getCardSize() === 12,
    gridSignalReflectsForScopedCss: card.getAttribute('layout') === 'grid',
    defaultTenRowsFillTheSlot: fillsSlot(defaultGeometry, rowHeight(10)),
    minimumSixRowsStayContained: fillsSlot(minimumGeometry.sample, rowHeight(6))
      && minimumGeometry.headerContained && minimumGeometry.menuReachable,
    ordinaryCardKeepsViewportHeight: ordinary.stageStyle.includes('100dvh'),
    explicitGridOptionsStayExternal: JSON.stringify(config) === configBefore
      && card._config.grid_options === config.grid_options,
    resizeChangesStageAtEveryRowCount: resizeHeights[0] < resizeHeights[1]
      && resizeHeights[1] < resizeHeights[2] && resizeHeights[3] === resizeHeights[0],
    resizePreservesCameraAndIntent: stableView && card._space === stableSpace
      && stableMode === 'view' && moreInfo === 0,
    allEditorsStayInsideTheFixedSlot: editorsContained,
    editorTransitionsLeaveNoBusyTail: editorsSettle && card._mode === 'view'
      && !card._modeTransitionBusy,
    resizeStormSettlesWithoutLoop: fillsSlot(finalGeometry, rowHeight(10))
      && stormElapsed < 3000
      && Math.abs(finalGeometry.stage.width - settledStage.width) <= 0.5
      && Math.abs(finalGeometry.stage.height - settledStage.height) <= 0.5,
    postResizeHitCoordinatesMatchCamera: finalPoint
      && near([finalPoint.x, finalPoint.y], finalCenter, 0.001)
      && Math.abs(card._view.w / card._view.h
        - finalGeometry.stage.width / finalGeometry.stage.height) < 0.001,
  };
});

checkAll(out);
await finish(browser, out);
