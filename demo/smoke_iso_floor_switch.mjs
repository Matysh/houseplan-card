// #739: in 2.5D a floor switch between floors with a backdrop image keeps the
// known theme paper. The card renders once per switch: no second update pass,
// no new computed-colour probe and no first-frame veil (#654) in the click's
// task, and the light floors are the ones the floor had on its first show.
// The cold path (first paper after load, theme change, chunk failure) stays
// with smoke_iso_first_frame.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 800 }, 1, [], { reducedMotion: 'reduce' });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const hp = window.__hpTest;
  const root = card.renderRoot;
  const stage = () => root.querySelector('.stage');
  const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const task = () => new Promise((done) => setTimeout(done, 0));
  // A raised tile and its floor shadow both carry the class; the shadow names its owner.
  const lightDevices = () => [...root.querySelectorAll('.dev.iso-floor-light')]
    .map((node) => node.getAttribute('data-shadow-of')
      ? `shadow:${node.getAttribute('data-shadow-of')}`
      : node.closest('[data-id]')?.getAttribute('data-id') || '?')
    .sort().join(',');
  const result = {};

  document.documentElement.style.setProperty('--ha-card-background', '#fff');
  await hp.switchSpace('f1');
  await hp.setVolumetricView(true);
  for (let guard = 0; guard < 120 && stage()?.dataset.hpIsoReadiness !== 'ready'; guard++) await frames();
  await hp.settled();
  await frames();
  const tabs = [...root.querySelectorAll('[data-hp="space-tab"]')].map((tab) => tab.getAttribute('data-id'));
  result.demoHasTwoBackdropFloors = tabs.includes('f1') && tabs.includes('garden')
    && ['f1', 'garden'].every((id) => !!card._model.find((space) => space.id === id)?.bg);
  result.isoReadyWithResolvedPaper = !!stage()?.classList.contains('projection-iso')
    && stage()?.dataset.hpIsoReadiness === 'ready' && !root.querySelector('.bootveil:not(.off)');

  let updates = 0;
  const update = card.update.bind(card);
  card.update = (changed) => { updates += 1; return update(changed); };
  let paperProbes = 0;
  const cssColor = card._cssColor.bind(card);
  card._cssColor = (...args) => { paperProbes += 1; return cssColor(...args); }; // private-ok: счётчик проходов и поиска бумаги (#739)
  let veils = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && (node.matches('.bootveil') || node.querySelector('.bootveil'))) veils += 1;
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  const firstShow = new Map([['f1', lightDevices()]]);
  const switches = [];
  for (const id of ['garden', 'f1', 'garden', 'f1', 'garden', 'f1']) {
    updates = 0;
    paperProbes = 0;
    veils = 0;
    root.querySelector(`[data-hp="space-tab"][data-id="${id}"]`)?.click();
    await card.updateComplete;
    await task();
    const inTask = { updates, paperProbes, veils };
    await frames();
    await hp.settled();
    const light = lightDevices();
    if (!firstShow.has(id)) firstShow.set(id, light);
    switches.push({
      id, ...inTask,
      active: root.querySelector('[data-hp="space-tab"][aria-current="page"]')?.getAttribute('data-id'),
      readiness: stage()?.dataset.hpIsoReadiness || '',
      light, sameLight: light === firstShow.get(id),
    });
  }
  observer.disconnect();
  result.switches = switches;
  result.everySwitchReachesItsFloor = switches.every((row) => row.active === row.id);
  result.everySwitchRendersOnce = switches.every((row) => row.updates === 1);
  result.noSwitchProbesThePaperAgain = switches.every((row) => row.paperProbes === 0);
  result.noSwitchInsertsTheVeil = switches.every((row) => row.veils === 0);
  result.everySwitchEndsReady = switches.every((row) => row.readiness === 'ready');
  result.lightFloorsMatchFirstShow = switches.every((row) => row.sameLight)
    && [...firstShow.values()].some((light) => light.length > 0);
  return result;
});
const { switches, ...checks } = out;
checkAll(checks);
await finish(browser, { ...checks, switches });
