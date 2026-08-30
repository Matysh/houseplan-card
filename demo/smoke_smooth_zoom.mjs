// #82: every discrete camera command uses one short, retargetable transition;
// direct pointer gestures and structural/lifecycle changes remain atomic.
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 900, height: 720 });

const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const stage = () => root().querySelector('.stage');
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const camera = () => ({ zoom: card._zoom, view: { ...card._view } });
  const close = (a, b, epsilon = 1e-4) => Math.abs(a - b) <= epsilon;
  const sameView = (a, b, epsilon = 1e-4) => close(a.x, b.x, epsilon)
    && close(a.y, b.y, epsilon) && close(a.w, b.w, epsilon)
    && close(a.h, b.h, epsilon);
  const settle = async () => {
    const samples = [];
    const started = performance.now();
    do {
      await frame();
      samples.push(camera());
    } while (card._cameraTransition.active && performance.now() - started < 1200);
    await card.updateComplete;
    return samples;
  };
  const directBaseline = (zoom = 1) => {
    const vb = card._baseVb();
    card._applyView(zoom, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
  };

  card._setMode('view');
  await card.updateComplete;
  directBaseline(1);
  const originalSave = card._saveZoom.bind(card);
  let saveCount = 0;
  card._saveZoom = () => { saveCount++; originalSave(); };

  // Toolbar button: intermediate pixels exist and exact legacy target wins.
  const buttonExpected = card._cameraTargetAt(
    stage().clientWidth / 2, stage().clientHeight / 2, 1.4,
  ).target;
  card._stepZoom(1);
  const buttonSamples = await settle();
  const buttonFinal = camera();
  const buttonSaves = saveCount;

  // Wheel anchor is calculated from the actually painted frame. A reversal
  // replaces the target and RAF rather than queueing a second transition.
  directBaseline(1);
  saveCount = 0;
  const rect = stage().getBoundingClientRect();
  const anchor = { x: rect.width * 0.31, y: rect.height * 0.67 };
  stage().dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaY: -100,
    clientX: rect.left + anchor.x, clientY: rect.top + anchor.y,
  }));
  const firstToken = card._cameraTransition.state?.token;
  await frame();
  const presentedCameraBeforeReverse = camera();
  const presentedBeforeReverse = presentedCameraBeforeReverse.zoom;
  const worldAtReverse = {
    x: presentedCameraBeforeReverse.view.x
      + anchor.x / rect.width * presentedCameraBeforeReverse.view.w,
    y: presentedCameraBeforeReverse.view.y
      + anchor.y / rect.height * presentedCameraBeforeReverse.view.h,
  };
  stage().dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaY: 100,
    clientX: rect.left + anchor.x, clientY: rect.top + anchor.y,
  }));
  const secondToken = card._cameraTransition.state?.token;
  const reverseFrom = card._cameraTransition.state?.from.zoom;
  const wheelSamples = await settle();
  const worldAfter = {
    x: card._view.x + anchor.x / rect.width * card._view.w,
    y: card._view.y + anchor.y / rect.height * card._view.h,
  };
  const wheelSaves = saveCount;

  // A real pointerdown freezes the presented camera: the obsolete target may
  // not settle later under a drag/select gesture.
  directBaseline(1);
  card._stepZoom(1);
  await frame();
  const pointerPresented = camera();
  stage().dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 82, pointerType: 'mouse', buttons: 1,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }));
  await wait(260);
  const pointerFrozen = camera();
  stage().dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, pointerId: 82, pointerType: 'mouse', buttons: 0,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }));

  // Pinch's production primitive is direct and cancels a running tween.
  directBaseline(1);
  card._stepZoom(1);
  await frame();
  card._zoomAt(rect.width / 2, rect.height / 2, 2);
  const pinchDirect = camera();
  await wait(240);
  const pinchAfterDeadline = camera();

  // Fit/home/double-tap share the same exact fit but retain their observable
  // reason, so their entry points cannot silently regress to a snap.
  const reasons = {};
  for (const reason of ['fit', 'home', 'double-tap']) {
    directBaseline(2);
    if (reason === 'home') card._fitAll('home');
    else if (reason === 'fit') card._fitAll('fit');
    else card._resetZoom('double-tap');
    reasons[reason] = {
      liveReason: card._cameraTransition.state?.reason,
      samples: (await settle()).map((sample) => sample.zoom),
      final: card._zoom,
    };
  }
  card._showFar = false;
  card._frame = null;
  directBaseline(2);
  card._fitFar();
  const farFitReason = card._cameraTransition.state?.reason;
  const farFitSamples = await settle();
  const farFitFinal = card._zoom;

  // Reduced motion before and during a command is authoritative immediately.
  directBaseline(1);
  card._reducedMotion = true;
  card._stepZoom(1);
  const reducedBefore = { active: card._cameraTransition.active, zoom: card._zoom };
  card._reducedMotion = false;
  directBaseline(1);
  card._stepZoom(1);
  await frame();
  card._onMotionChange({ matches: true });
  const reducedDuring = { active: card._cameraTransition.active, zoom: card._zoom };
  card._reducedMotion = false;

  // Projection owns an atomic structural conversion and cancels the camera.
  card._labs = { ...card._labs, active: [...new Set([...card._labs.active, 'iso'])] };
  card._viewPreference = { ...card._viewPreference, [card._space]: 'flat' };
  directBaseline(1);
  card._stepZoom(1);
  await frame();
  card._setProjection('iso');
  const projectionCancelled = !card._cameraTransition.active;
  await card.updateComplete;
  await frame();
  await frame();
  const isoExpected = card._cameraTargetAt(
    stage().clientWidth / 2, stage().clientHeight / 2, card._zoom * 1.4,
  ).target;
  card._stepZoom(1);
  await settle();
  const isoFinal = camera();
  card._setProjection('flat');

  // Hidden commits the user's target and no old RAF resumes later.
  directBaseline(1);
  card._stepZoom(1);
  card._pageVisibility({ kind: 'hidden' });
  const hiddenCommitted = { active: card._cameraTransition.active, zoom: card._zoom };
  await wait(240);
  const hiddenAfterDeadline = card._zoom;

  // Exact fit is a no-op: neither a RAF nor persistence write is created.
  card._reducedMotion = true;
  card._resetZoom('fit');
  card._reducedMotion = false;
  saveCount = 0;
  card._resetZoom('fit');
  const fitNoop = { active: card._cameraTransition.active, saves: saveCount };
  card._applyView(8);
  saveCount = 0;
  card._stepZoom(1);
  const maxNoop = { active: card._cameraTransition.active, saves: saveCount };
  card._applyView(1 / 3);
  saveCount = 0;
  card._stepZoom(-1);
  const minNoop = { active: card._cameraTransition.active, saves: saveCount };

  const glowBefore = {
    spots: root().querySelectorAll('[data-glow-spot]').length,
    blend: root().querySelector('.glow-pools')?.getAttribute('data-blend') || '',
    rooms: root().querySelectorAll('.room').length,
    base: [...card._baseVb()],
  };
  card._stepZoom(1);
  await settle();
  const glowAfter = {
    spots: root().querySelectorAll('[data-glow-spot]').length,
    blend: root().querySelector('.glow-pools')?.getAttribute('data-blend') || '',
    rooms: root().querySelectorAll('.room').length,
    base: [...card._baseVb()],
  };

  const resources = performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname);
  // #396 идёт последним намеренно: проверки выше считают saveCount
  // абсолютным значением, а пользовательская отмена теперь тоже пишет.
  // #396: interrupted zoom, structural cancellation, fast wheel anchor.
  const spaceOf = () => card._space;
  const storedZoom = () => {
    try {
      return (JSON.parse(localStorage.getItem('houseplan_card_zoom_v1') || '{}') || {})[spaceOf()];
    } catch { return undefined; }
  };
  const wheelAt = (x, y, deltaY) => stage().dispatchEvent(new WheelEvent('wheel', {
    clientX: x, clientY: y, deltaY, bubbles: true, cancelable: true, composed: true,
  }));
  const pointerDownAt = (x, y) => stage().dispatchEvent(new PointerEvent('pointerdown', {
    clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0,
    bubbles: true, cancelable: true, composed: true,
  }));

  directBaseline(1);
  await settle();
  const stageRect = () => stage().getBoundingClientRect();
  // (1) wheel, then touch the plan mid-flight: the shown zoom must be stored.
  wheelAt(stageRect().left + 600, stageRect().top + 400, -100);
  await frame();
  await frame();
  const interruptedShown0 = card._zoom;
  pointerDownAt(stageRect().left + 200, stageRect().top + 200);
  await card.updateComplete;
  const interruptedShown = card._zoom;
  const interruptedStored = storedZoom();
  const interruptedFroze = !card._cameraTransition.active
    && close(interruptedShown, interruptedShown0, 1e-9);

  // (2) structural cancellation writes nothing.
  directBaseline(1);
  await settle();
  const structuralStoredBefore = storedZoom();
  wheelAt(stageRect().left + 600, stageRect().top + 400, -100);
  await frame();
  await frame();
  const structuralSavesBefore = saveCount;
  card._cancelCameraTransition(false);
  await card.updateComplete;
  const structuralSaves = saveCount - structuralSavesBefore;
  const structuralStored = storedZoom();

  // (3) six notches, one animation frame apart: the anchor must stay put.
  directBaseline(1);
  await settle();
  const anchorScreen = { x: stageRect().left + 600, y: stageRect().top + 400 };
  const worldUnder = () => {
    const box = card._view;
    const box2 = { x: box.x, y: box.y, w: box.w, h: box.h };
    const r = stageRect();
    return {
      x: box2.x + ((anchorScreen.x - r.left) / r.width) * box2.w,
      y: box2.y + ((anchorScreen.y - r.top) / r.height) * box2.h,
    };
  };
  const anchorBefore = worldUnder();
  for (let i = 0; i < 6; i++) {
    wheelAt(anchorScreen.x, anchorScreen.y, -100);
    await frame();
  }
  await settle();
  const anchorAfter = worldUnder();
  const anchorDriftUnits = Math.hypot(anchorAfter.x - anchorBefore.x,
    anchorAfter.y - anchorBefore.y);
  const anchorDriftPx = anchorDriftUnits * (stageRect().width / card._view.w);
  directBaseline(1);
  await settle();

  return {
    buttonHasIntermediateFrame: buttonSamples.some((sample) =>
      sample.zoom > 1.001 && sample.zoom < buttonExpected.zoom - 0.001),
    buttonSettlesAtExactTarget: close(buttonFinal.zoom, buttonExpected.zoom)
      && sameView(buttonFinal.view, buttonExpected.viewBox),
    buttonPersistsOnce: buttonSaves === 1,
    wheelRetargetsRunningTween: Number.isFinite(firstToken) && Number.isFinite(secondToken)
      && firstToken !== secondToken && close(reverseFrom, presentedBeforeReverse, 0.02),
    wheelHasIntermediateFrames: wheelSamples.some((sample) => sample.zoom > 1.001),
    wheelReversalKeepsAnchor: Math.hypot(
      (worldAfter.x - worldAtReverse.x) / card._view.w * rect.width,
      (worldAfter.y - worldAtReverse.y) / card._view.h * rect.height,
    ) <= 0.5,
    wheelStreamPersistsOnce: wheelSaves === 1,
    pointerdownFreezesPresentedFrame: !card._cameraTransition.active
      && close(pointerFrozen.zoom, pointerPresented.zoom, 0.001)
      && sameView(pointerFrozen.view, pointerPresented.view, 0.001),
    pinchIsDirectWithoutPostAnimation: close(pinchDirect.zoom, 2)
      && !card._cameraTransition.active
      && close(pinchAfterDeadline.zoom, 2)
      && sameView(pinchAfterDeadline.view, pinchDirect.view),
    fitHomeAndDoubleTapAnimate: Object.entries(reasons).every(([reason, value]) =>
      value.liveReason === reason
      && value.samples.some((zoom) => zoom > 1.001 && zoom < 1.999)
      && close(value.final, 1)),
    farFitUsesTheSameTransition: farFitReason === 'fit'
      && farFitSamples.some((sample) => sample.zoom > 1.001 && sample.zoom < 1.999)
      && close(farFitFinal, 1),
    reducedMotionIsImmediate: !reducedBefore.active && close(reducedBefore.zoom, 1.4)
      && !reducedDuring.active && close(reducedDuring.zoom, 1.4),
    projectionCancelsAndIsoSettlesExactly: projectionCancelled
      && close(isoFinal.zoom, isoExpected.zoom)
      && sameView(isoFinal.view, isoExpected.viewBox),
    hiddenCommitsTargetOnce: !hiddenCommitted.active && close(hiddenCommitted.zoom, 1.4)
      && close(hiddenAfterDeadline, hiddenCommitted.zoom),
    exactLimitsAndFitAreNoops: !fitNoop.active && fitNoop.saves === 0
      && !maxNoop.active && maxNoop.saves === 0
      && !minNoop.active && minNoop.saves === 0,
    glowAndStructuralFrameStayStable: JSON.stringify(glowAfter) === JSON.stringify(glowBefore),
    coldViewDoesNotLoadEditorRuntime: resources.every((path) =>
      !/houseplan-editor-runtime-/.test(path)),
    // #396 AC1: touching the plan freezes the animated frame — and the frozen
    // frame is what the user sees, so it must be what gets persisted.
    userCancelPersistsTheShownZoom: interruptedShown > 1.001
      && close(interruptedStored, interruptedShown, 1e-6),
    // #396 AC2: a structural cancellation writes nothing.
    structuralCancelPersistsNothing: structuralSaves === 0
      && close(structuralStored, structuralStoredBefore, 1e-9),
    // #396 AC3: the anchor under the pointer survives a fast wheel series.
    fastWheelKeepsTheAnchor: anchorDriftPx < 0.5,
    diagnostics: { projectionCancelled, isoExpected, isoFinal, glowBefore, glowAfter,
      interruptedShown, interruptedStored, interruptedFroze, structuralSaves,
      structuralStored, structuralStoredBefore, anchorDriftPx },
  };
});

const { diagnostics, ...checks } = out;
checkAll(checks);
await finish(browser, out);
