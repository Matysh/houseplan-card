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
          ppu: svg.getBoundingClientRect().width / vb.width,
        });
      }
    } while (card._modeTransitionBusy && performance.now() - started < 1000);
    return samples;
  };

  await card.updateComplete;
  card._setMode('view');
  await card.updateComplete;
  const viewHeight = root().querySelector('.stage').clientHeight;
  const initialSvg = root().querySelector('.plan-svg');
  const initialPpu = initialSvg.getBoundingClientRect().width / initialSvg.viewBox.baseVal.width;

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
    // The scene raster now stays fixed while the stage clips it. Its physical
    // scale, rather than matching two different viewport boxes, is invariant.
    cameraKeepsScreenScale: allFrames.every((sample) =>
      Number.isFinite(sample.ppu) && Math.abs(sample.ppu - initialPpu) < 1e-5),
    editorSwapUsesSharedTimeline: swap.some((sample) => sample.busy) && !!chromeInner,
    viewHeightRestored: Math.abs(restoredHeight - viewHeight) <= 2,
    controllerSettled: card._modeTransitionBusy === false
      && !root().querySelector('.stage').classList.contains('mode-transition'),
  };
});

// The projection crossing retains one real scene and switches it while faded;
// narrow and reduced-motion paths must leave neither a veil nor an inert stage.
for (const [name, width, reduced] of [['isoWide', 1440, false], ['isoNarrow', 380, false], ['isoReduced', 820, true]]) {
  await page.setViewportSize({width, height:760});
  await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); await window.__hpTest.settled(); });
  result[name] = await page.evaluate(async () => {
    const c=window.__card, root=c.renderRoot, frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    const ready=async()=>{const start=performance.now();while(c._modeTransitionBusy){if(performance.now()-start>3000)throw Error('Mode did not settle');await frame();}await c.updateComplete;await frame();};
    await ready();
    const scale=()=>{const svg=root.querySelector('.plan-svg');return svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;};
    const start=scale(), samples=[];
    for(const mode of ['plan','devices','decor','view']) {
      c._setMode(mode);
      do {await frame();samples.push(scale());}while(c._modeTransitionBusy);
      await ready();
      if(root.querySelectorAll('.zoomwrap').length!==1)return false;
    }
    c._setMode('plan');await frame();c._setMode('view');await frame();c._setMode('devices');await ready();
    c._setMode('view');await ready();
    const stage=root.querySelector('.stage'),scene=root.querySelector('.zoomwrap');
    return samples.every(value=>Number.isFinite(value)&&Math.abs(value-start)<1e-5)
      &&stage.classList.contains('projection-iso')&&!stage.inert&&!scene.style.width&&!scene.style.opacity;
  });
}

checkAll(result);
await finish(browser, result);
