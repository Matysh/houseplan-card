/** Issue #137: architectural endpoint/line overlay and exact snap in Plan. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const cfg = {
    model_version: 10,
    spaces: [{
      id: 'snap', title: 'Snap', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [
        { id: 'left', name: 'Left', area: null,
          poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]],
          wall_ids: ['left-top', 'shared', 'left-bottom', 'left-side'] },
        { id: 'right', name: 'Right', area: null,
          poly: [[0.5, 0.1], [0.9, 0.1], [0.9, 0.5], [0.5, 0.5]],
          wall_ids: ['right-top', 'right-side', 'right-bottom', 'shared'] },
      ],
      wall_segments: [
        { id: 'left-top', a: [0.1, 0.1], b: [0.5, 0.1], cm: 15 },
        { id: 'shared', a: [0.5, 0.1], b: [0.5, 0.5], cm: 0 },
        { id: 'left-bottom', a: [0.5, 0.5], b: [0.1, 0.5], cm: 15 },
        { id: 'left-side', a: [0.1, 0.5], b: [0.1, 0.1], cm: 15 },
        { id: 'right-top', a: [0.5, 0.1], b: [0.9, 0.1], cm: 15 },
        { id: 'right-side', a: [0.9, 0.1], b: [0.9, 0.5], cm: 15 },
        { id: 'right-bottom', a: [0.9, 0.5], b: [0.5, 0.5], cm: 15 },
      ],
      openings: [
        { id: 'door', type: 'door', x: 0.3, y: 0.1, angle: 0, length: 0.1 },
        { id: 'partition-door', type: 'door', x: 0.84, y: 0.6, angle: 0, length: 0.05,
          host: { kind: 'partition', id: 'base-partition', t: 0.8 } },
      ],
      open_spans: [{ a: [0.5, 0.2], b: [0.5, 0.3] }],
      partitions: [
        { id: 'saved-a', a: [0.1, 0.6], b: [0.3, 0.6], cm: 15 },
        { id: 'saved-b', a: [0.3, 0.6], b: [0.3, 0.7], cm: 15 },
        { id: 'base-partition', a: [0.6, 0.6], b: [0.9, 0.6], cm: 15 },
      ],
      wall_columns: [{ id: 'ignored-column', shape: 'square', center: [0.8, 0.35], cm: 25 }],
    }],
    markers: [], settings: {},
  };
  card._serverCfg = JSON.parse(JSON.stringify(cfg));
  card._layout = {};
  card._space = 'snap';
  card._modelCache = null;
  card._frame = null;
  card._cfgEpoch++;
  card._setMode('plan');
  card._tool = 'draw';
  card._path = [];
  card._activeWallChainId = null;
  card._activeWallChainPartitionIds = [];
  card._clearPlanSnapHover();
  await update();

  const stage = root().querySelector('.stage');
  const eventAt = (x, y, type = 'pointermove', extra = {}) => {
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    const EventType = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    return new EventType(type, {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
      pointerId: 41,
      pointerType: 'mouse',
      ...extra,
    });
  };
  const overlay = () => root().querySelector('[data-hp="plan-snap-overlay"]');
  const active = () => root().querySelector('.plan-snap-node[data-active="true"]');
  const close = (a, b, epsilon = 1e-5) => Math.abs(a - b) <= epsilon;

  result.overlayBeforeFirstClick = !!overlay();
  result.overlayIsPointerTransparent = overlay()?.getAttribute('pointer-events') === 'none'
    && getComputedStyle(overlay()).pointerEvents === 'none';
  const wallBodies = root().querySelector('.wallbodies');
  result.overlayAfterWallBodies = !!wallBodies && !!overlay()
    && !!(wallBodies.compareDocumentPosition(overlay()) & Node.DOCUMENT_POSITION_FOLLOWING);
  result.oneLinePerSolidInterval = overlay()?.querySelectorAll('.plan-snap-line').length === 12;
  result.uniqueSourceEndpointsOnly = overlay()?.querySelectorAll('.plan-snap-node[data-kind="endpoint"]').length === 11;
  result.columnIsNotACandidate = ![...overlay().querySelectorAll('.plan-snap-node')].some((node) =>
    close(+node.getAttribute('cx'), 800) && close(+node.getAttribute('cy'), 350));

  const crosses = (x1, y1, x2, y2, px, py) => {
    const dx = x2 - x1, dy = y2 - y1;
    const length2 = dx * dx + dy * dy;
    if (!length2) return false;
    const t = ((px - x1) * dx + (py - y1) * dy) / length2;
    if (t <= 0 || t >= 1) return false;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) < 0.01;
  };
  const lines = () => [...overlay().querySelectorAll('.plan-snap-line')].map((line) => [
    +line.getAttribute('x1'), +line.getAttribute('y1'),
    +line.getAttribute('x2'), +line.getAttribute('y2'),
  ]);
  result.openingGapHasNoLine = !lines().some((line) => crosses(...line, 300, 100));
  result.partitionOpeningGapHasNoLine = !lines().some((line) => crosses(...line, 840, 600));
  result.zeroWallKeepsAxis = lines().some((line) => crosses(...line, 500, 250));
  result.cutBoundariesAreNotEndpoints = ![...overlay().querySelectorAll('[data-kind="endpoint"]')].some((node) => {
    const x = +node.getAttribute('cx'), y = +node.getAttribute('cy');
    return (close(y, 100) && (close(x, 250) || close(x, 350)))
      || (close(x, 500) && (close(y, 200) || close(y, 300)));
  });
  stage.dispatchEvent(eventAt(300, 100));
  await card.updateComplete;
  result.openingGapDoesNotActivateSnap = !active();
  stage.dispatchEvent(eventAt(840, 600));
  await card.updateComplete;
  result.partitionOpeningGapDoesNotActivateSnap = !active();
  stage.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerId: 41 }));
  await card.updateComplete;
  result.pointerLeaveClearsActiveNode = !active();

  // The remainder exercises structural writes, not opening migration. Remove
  // the intentionally legacy/unhosted gap fixtures after their assertions so
  // the v9 fail-closed host barrier does not reject an unrelated wall edit.
  delete card._curSpaceCfg.openings;
  card._modelCache = null;
  card._cfgEpoch++;
  await update();
  const cachedGeometry = card._planSnapGeometryCache?.value;
  const staticNodesBefore = [...overlay().querySelectorAll(
    '.plan-snap-line, .plan-snap-node[data-kind="endpoint"]',
  )];
  const originalRequestUpdate = card.requestUpdate;
  let initialHoverUpdates = 0;
  card.requestUpdate = function (...args) {
    initialHoverUpdates++;
    return originalRequestUpdate.apply(this, args);
  };

  stage.dispatchEvent(eventAt(104, 104));
  await card.updateComplete;
  result.endpointHoverIsActive = active()?.getAttribute('data-kind') === 'endpoint'
    && close(+active().getAttribute('cx'), 100) && close(+active().getAttribute('cy'), 100)
    && close(+active().getAttribute('r'), card._cmToUnits(10));
  stage.dispatchEvent(eventAt(735, 606));
  await card.updateComplete;
  const initialLineActive = active()?.getAttribute('data-kind') === 'line';
  stage.dispatchEvent(eventAt(500, 650));
  await card.updateComplete;
  const initialMissInactive = !active();
  stage.dispatchEvent(eventAt(104, 104));
  await card.updateComplete;
  card.requestUpdate = originalRequestUpdate;
  result.initialHoverAvoidsFullCardUpdate = initialHoverUpdates === 0;
  result.initialHoverCyclesCandidateKinds = initialLineActive && initialMissInactive
    && active()?.getAttribute('data-kind') === 'endpoint';
  result.initialHoverKeepsStaticNodeIdentity = staticNodesBefore.every(
    (node, index) => node === overlay().querySelectorAll(
      '.plan-snap-line, .plan-snap-node[data-kind="endpoint"]',
    )[index],
  );
  card._markupClick(eventAt(104, 104, 'click', { shiftKey: true }));
  await card.updateComplete;
  result.endpointOverridesGridAndShift = card._path.length === 1
    && close(card._path[0][0], 100) && close(card._path[0][1], 100);

  // Keep the line-snap append scenario independent from the room corner just
  // verified above. In v9 that corner is a canonical zero-wall topology node,
  // so a wall from it may legitimately complete a face and open the room flow.
  card._cancelPath();
  card._markupClick(eventAt(504, 654, 'click'));
  await card.updateComplete;
  result.freeStartForLineSnap = card._path.length === 1
    && Number.isFinite(card._path[0][0]) && Number.isFinite(card._path[0][1]);

  stage.dispatchEvent(eventAt(735, 606));
  await card.updateComplete;
  const lineNode = active();
  result.lineHoverShowsOneDynamicNode = !!lineNode
    && lineNode.getAttribute('data-kind') === 'line'
    && root().querySelectorAll('.plan-snap-node.dynamic[data-active="true"]').length === 1;
  const linePoint = lineNode ? [+lineNode.getAttribute('cx'), +lineNode.getAttribute('cy')] : [NaN, NaN];
  result.lineNodeStaysWallBound = close(linePoint[1], 600);
  result.lineNodeQuantizesAlongWall = close((linePoint[0] - 600) / card._gridPitch,
    Math.round((linePoint[0] - 600) / card._gridPitch));
  result.hoverKeepsStaticGeometryCache = !!cachedGeometry
    && card._planSnapGeometryCache?.value === cachedGeometry;
  const originalPartition = JSON.stringify(card._curSpaceCfg.partitions
    .find((item) => item.id === 'base-partition'));
  card._markupClick(eventAt(735, 606, 'click'));
  await card.updateComplete;
  result.drawPathLength = card._path.length;
  result.drawCommitUsesExactLineNode = card._path.length === 2
    && close(card._path[1][0], linePoint[0]) && close(card._path[1][1], linePoint[1]);
  result.existingPartitionWasNotSplit = card._curSpaceCfg.partitions.length === 4
    && JSON.stringify(card._curSpaceCfg.partitions.find((item) => item.id === 'base-partition'))
      === originalPartition;

  // Remove the first synthetic active wall before the independent scenario;
  // accepted walls otherwise correctly survive session cancellation.
  const firstActiveIds = new Set(card._activeWallChainPartitionIds);
  card._curSpaceCfg.partitions = card._curSpaceCfg.partitions
    .filter((partition) => !firstActiveIds.has(partition.id));
  card._modelCache = null;
  card._cfgEpoch++;

  card._cancelPath();
  card._activeWallChainId = 'saved-chain';
  card._activeWallChainPartitionIds = ['saved-a', 'saved-b'];
  card._wallChainSegmentCms = [15, 15];
  card._path = [[100, 600], [300, 600], [300, 700]];
  await update();
  result.activeChainUsesStaticOverlay = lines().some((line) => (
    close(line[1], 600) && close(line[3], 600)
      && Math.min(line[0], line[2]) < 300 && Math.max(line[0], line[2]) > 100
  ) || (
    close(line[0], 300) && close(line[2], 300)
      && Math.min(line[1], line[3]) < 700 && Math.max(line[1], line[3]) > 600
  ));
  stage.dispatchEvent(eventAt(302, 602));
  await card.updateComplete;
  result.intermediateCurrentPointDoesNotSelfSnap = !active();
  stage.dispatchEvent(eventAt(102, 602));
  await card.updateComplete;
  result.firstCurrentPointRemainsClosureTarget = active()?.getAttribute('data-kind') === 'endpoint'
    && close(+active().getAttribute('cx'), 100) && close(+active().getAttribute('cy'), 600);
  stage.dispatchEvent(eventAt(302, 698));
  await card.updateComplete;
  result.currentAnchorDoesNotCreateZeroSegment = !active();
  card._cancelPath();
  card._activateMarkupTool('draw');
  await update();
  // Use a fresh point on the same physical line: the earlier assertion left
  // 735,600 as a saved-draft endpoint, and public Walls correctly resumes it.
  card._markupClick(eventAt(775, 606, 'click'));
  await card.updateComplete;
  result.tapWithoutHoverSnapsFirstPoint = card._path.length === 1
    && close(card._path[0][1], 600)
    && close((card._path[0][0] - 600) / card._gridPitch,
      Math.round((card._path[0][0] - 600) / card._gridPitch));
  card._markupClick(eventAt(896, 496, 'click'));
  await card.updateComplete;
  result.secondPathLengthBeforeSelect = card._path.length;
  result.secondNoRoomDialog = card._roomDialog !== true;
  const secondDrawnIds = [...card._activeWallChainPartitionIds];
  result.secondActiveWallCountBeforeSelect = secondDrawnIds.length;
  result.secondToast = String(card._toast || '');
  card._activateMarkupTool('select');
  await update();
  result.partitionCountAfterDraw = card._curSpaceCfg.partitions.length;
  const drawnPartition = card._curSpaceCfg.partitions.find(
    (partition) => secondDrawnIds.includes(partition.id),
  );
  result.secondWallsClickFinishesSnappedPartition = card._path.length === 0
    && card._curSpaceCfg.partitions.length === 4
    && !!drawnPartition
    && [drawnPartition.a, drawnPartition.b].some((point) =>
      close(point[0] * 1000, 900) && close(point[1] * 1000, 500));
  result.originalSegmentStillUnchanged = JSON.stringify(card._curSpaceCfg.partitions
    .find((item) => item.id === 'base-partition')) === originalPartition;

  const gestureGeometry = JSON.stringify({ partitions: card._curSpaceCfg.partitions });
  card._activateMarkupTool('draw');
  await update();
  card._suppressClick = true;
  card._markupClick(eventAt(700, 600, 'click'));
  result.suppressedClickDoesNotCommit = card._path.length === 0;
  card._suppressClick = false;
  stage.dispatchEvent(eventAt(700, 600, 'pointerdown', { pointerId: 51, buttons: 1 }));
  stage.dispatchEvent(eventAt(760, 640, 'pointermove', { pointerId: 51, buttons: 1 }));
  stage.dispatchEvent(eventAt(760, 640, 'pointerup', { pointerId: 51 }));
  stage.dispatchEvent(eventAt(650, 560, 'pointerdown', { pointerId: 61, buttons: 1 }));
  stage.dispatchEvent(eventAt(800, 650, 'pointerdown', { pointerId: 62, buttons: 1 }));
  stage.dispatchEvent(eventAt(620, 540, 'pointermove', { pointerId: 61, buttons: 1 }));
  stage.dispatchEvent(eventAt(830, 670, 'pointermove', { pointerId: 62, buttons: 1 }));
  stage.dispatchEvent(eventAt(620, 540, 'pointercancel', { pointerId: 61 }));
  stage.dispatchEvent(eventAt(830, 670, 'pointerup', { pointerId: 62 }));
  await card.updateComplete;
  result.panPinchCancelDoNotCommit = card._path.length === 0
    && JSON.stringify({ partitions: card._curSpaceCfg.partitions }) === gestureGeometry;

  card._curSpaceCfg.partitions.push({
    id: 'hidden-partition', a: [0.1, 0.1], b: [0.5, 0.1], cm: 15,
  });
  card._modelCache = null;
  card._cfgEpoch++;
  card._activateMarkupTool('select');
  await update();
  const diagnostic = root().querySelector('[data-hp="hidden-wall-diagnostic"]');
  result.otherPlanToolsKeepFullOverlayAndHiddenDiagnostic = !!overlay() && !!diagnostic
    && diagnostic.querySelectorAll('.hidden-wall-line').length === 1
    && diagnostic.querySelectorAll('.hidden-wall-node').length === 2;
  const editorZeroWalls = root().querySelector('.zero-walls');
  result.hiddenDiagnosticAboveAllWallBodies = !!diagnostic && !!wallBodies
    && !!(wallBodies.compareDocumentPosition(diagnostic) & Node.DOCUMENT_POSITION_FOLLOWING)
    && (!editorZeroWalls
      || !!(editorZeroWalls.compareDocumentPosition(diagnostic) & Node.DOCUMENT_POSITION_FOLLOWING));
  result.hiddenDiagnosticIsPointerTransparent = diagnostic?.getAttribute('pointer-events') === 'none'
    && getComputedStyle(diagnostic).pointerEvents === 'none';
  card._activateMarkupTool('draw');
  await update();
  const drawDiagnostic = root().querySelector('[data-hp="hidden-wall-diagnostic"]');
  const drawSnap = overlay();
  result.drawToolKeepsHiddenDiagnosticAndSnapOverlay = !!drawDiagnostic && !!drawSnap
    && drawDiagnostic.querySelectorAll('.hidden-wall-line').length === 1
    && drawDiagnostic.querySelectorAll('.hidden-wall-node').length === 2;
  result.hiddenDiagnosticPaintsBeforeTransientSnap = !!(
    drawDiagnostic.compareDocumentPosition(drawSnap) & Node.DOCUMENT_POSITION_FOLLOWING
  );

  // #304 regression fixture: one room plus two independent walls which overlap
  // its left/bottom axes and continue beyond them. The six source endpoints are
  // the exact topology from the field report, reduced to deterministic data.
  const parityCfg = {
    model_version: 10,
    spaces: [{
      id: 'axis-parity', title: 'Axis parity', cell_cm: 5, view_box: [0, 0, 1, 0.75],
      rooms: [{
        id: 'room', name: 'Room', area: null,
        poly: [[0.2, 0.2], [0.6, 0.2], [0.6, 0.6], [0.2, 0.6]],
        wall_ids: ['axis-top', 'axis-right', 'axis-bottom', 'axis-left'],
      }],
      wall_segments: [
        { id: 'axis-top', a: [0.2, 0.2], b: [0.6, 0.2], cm: 20 },
        { id: 'axis-right', a: [0.6, 0.2], b: [0.6, 0.6], cm: 20 },
        { id: 'axis-bottom', a: [0.6, 0.6], b: [0.2, 0.6], cm: 20 },
        { id: 'axis-left', a: [0.2, 0.6], b: [0.2, 0.2], cm: 20 },
      ],
      openings: [], open_spans: [],
      partitions: [
        { id: 'vertical', a: [0.2, 0.05], b: [0.2, 0.6], cm: 20 },
        { id: 'horizontal', a: [0.2, 0.6], b: [0.9, 0.6], cm: 20 },
      ],
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
    }],
    markers: [], settings: {},
  };
  card._serverCfg = JSON.parse(JSON.stringify(parityCfg));
  card._layout = {};
  card._space = 'axis-parity';
  card._modelCache = null;
  card._frame = null;
  card._activeWallChainId = null;
  card._activeWallChainPartitionIds = [];
  card._path = [];
  card._cfgEpoch++;
  card._setMode('plan');
  await update();

  const staticSnapshot = () => {
    const current = overlay();
    return JSON.stringify({
      lines: [...current.querySelectorAll('.plan-snap-line')].map((line) => [
        line.getAttribute('data-key'), line.getAttribute('data-source-kind'),
        line.getAttribute('x1'), line.getAttribute('y1'),
        line.getAttribute('x2'), line.getAttribute('y2'),
      ]),
      endpoints: [...current.querySelectorAll('.plan-snap-node[data-kind="endpoint"]')]
        .map((node) => [
          node.getAttribute('data-key'), node.getAttribute('cx'), node.getAttribute('cy'),
        ]),
    });
  };
  const tools = [
    'select', 'draw', 'column', 'merge', 'split', 'resize',
    'opening', 'wallthick', 'delroom',
  ];
  let expectedSnapshot = null;
  let everyToolMatches = true;
  let everyToolIsPassive = true;
  let everyToolPaintsAboveWalls = true;
  let thicknessHasSixNodes = false;
  for (const tool of tools) {
    card._tool = tool;
    card._clearPlanSnapHover();
    await update();
    const current = overlay();
    const bodies = root().querySelector('.wallbodies');
    const snapshot = current ? staticSnapshot() : null;
    if (expectedSnapshot == null) expectedSnapshot = snapshot;
    everyToolMatches &&= !!current && snapshot === expectedSnapshot;
    everyToolIsPassive &&= current?.getAttribute('pointer-events') === 'none'
      && getComputedStyle(current).pointerEvents === 'none'
      && !current.querySelector('.plan-snap-node[data-active="true"]');
    everyToolPaintsAboveWalls &&= !!bodies && !!current
      && !!(bodies.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (tool === 'wallthick') {
      thicknessHasSixNodes = current.querySelectorAll(
        '.plan-snap-node[data-kind="endpoint"]',
      ).length === 6 && current.querySelectorAll('.plan-snap-line').length === 6;
    }
  }
  result.allPlanToolsShareStaticAxesAndNodes = everyToolMatches;
  result.allPlanToolOverlaysStayPointerTransparent = everyToolIsPassive;
  result.allPlanToolOverlaysPaintAboveWallBodies = everyToolPaintsAboveWalls;
  result.thicknessShowsCompleteSixNodeFixture = thicknessHasSixNodes;

  card._setMode('devices');
  await update();
  const devicesHaveNoPlanOverlay = !overlay();
  card._setMode('decor');
  await update();
  const decorHasNoPlanOverlay = !overlay();
  card._setMode('view');
  await update();
  result.nonPlanModesHaveNoOverlay = devicesHaveNoPlanOverlay && decorHasNoPlanOverlay
    && !overlay()
    && !root().querySelector('[data-hp="hidden-wall-diagnostic"]');

  return result;
});

await page.emulateMedia({ forcedColors: 'active' });
out.forcedColorsStayReadable = await page.evaluate(async () => {
  const card = window.__card;
  card._setMode('plan');
  card._tool = 'draw';
  card._path = [];
  card.requestUpdate();
  await card.updateComplete;
  const overlay = card.renderRoot.querySelector('[data-hp="plan-snap-overlay"]');
  const line = overlay?.querySelector('.plan-snap-line');
  const node = overlay?.querySelector('.plan-snap-node');
  const lineStyle = line ? getComputedStyle(line) : null;
  const nodeStyle = node ? getComputedStyle(node) : null;
  return matchMedia('(forced-colors: active)').matches
    && lineStyle?.stroke !== 'none' && nodeStyle?.stroke !== 'none'
    && nodeStyle?.fill !== 'none';
});

await finish(browser, checkAll(out, {
  drawPathLength: 2,
  secondPathLengthBeforeSelect: 2,
  secondActiveWallCountBeforeSelect: 1,
  secondToast: '',
  partitionCountAfterDraw: 4,
}));
