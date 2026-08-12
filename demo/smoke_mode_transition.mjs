// #101: View/editor navigation has one controller for toolbar height, stage
// geometry and camera. This smoke deliberately observes real animation frames;
// it never asserts an exact wall-clock millisecond.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleepFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const sampleUntilSettled = async () => {
    const samples = [];
    const started = performance.now();
    do {
      await sleepFrame();
      const stage = root().querySelector('.stage');
      const svg = stage?.querySelector(':scope .zoomwrap > svg');
      if (stage && svg) {
        const vb = svg.viewBox.baseVal;
        samples.push({
          busy: card._modeTransitionBusy,
          inert: stage.inert,
          height: stage.getBoundingClientRect().height,
          aspect: vb.width / vb.height,
          stageAspect: stage.clientWidth / stage.clientHeight,
        });
      }
    } while (card._modeTransitionBusy && performance.now() - started < 1000);
    return samples;
  };

  await card.updateComplete;
  card._setMode('view');
  await card.updateComplete;
  const viewHeight = root().querySelector('.stage').clientHeight;

  card._setMode('plan');
  const enter = await sampleUntilSettled();
  const planHeight = root().querySelector('.stage').clientHeight;
  const distinctEnterHeights = new Set(enter.map((sample) => Math.round(sample.height))).size;

  card._setMode('devices');
  const swap = await sampleUntilSettled();
  const chromeInner = root().querySelector('.editorchrome-inner');

  card._setMode('view');
  const leave = await sampleUntilSettled();
  const restoredHeight = root().querySelector('.stage').clientHeight;
  const allFrames = [...enter, ...swap, ...leave];
  return {
    enterHadIntermediateGeometry: distinctEnterHeights >= 3,
    editorConsumesViewportHeight: planHeight < viewHeight,
    stageInertDuringMotion: allFrames.filter((sample) => sample.busy).every((sample) => sample.inert),
    cameraMatchesEveryStageAspect: allFrames.every((sample) =>
      Number.isFinite(sample.aspect) && Math.abs(sample.aspect - sample.stageAspect) < 0.02),
    editorSwapUsesSharedTimeline: swap.some((sample) => sample.busy) && !!chromeInner,
    viewHeightRestored: Math.abs(restoredHeight - viewHeight) <= 2,
    controllerSettled: card._modeTransitionBusy === false
      && !root().querySelector('.stage').classList.contains('mode-transition'),
  };
});

checkAll(result);
await finish(browser, result);
