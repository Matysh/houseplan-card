// #739: in 2.5D a floor switch between floors with a backdrop image keeps the
// known theme paper. The prepared card renders once per warm switch: no second update pass,
// no new computed-colour probe and no first-frame veil (#654) in the click's
// task, and the light floors are the ones the floor had on its first show.
// The cold path (first paper after load, theme change, chunk failure) stays
// with smoke_iso_first_frame.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 800 }, 1, [], { reducedMotion: 'reduce' });
// The single-task native tab-click oracle explicitly exercises the wide header.
await page.addStyleTag({ content: '#host{width:1060px!important;max-width:none!important;padding:0!important}' });
await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('[data-hp="space-tab"]'));
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

  // The default image-backed demo has only thin room lines. Add genuine
  // masonry and a sill on both floors while retaining their different paper.
  await hp.setServerConfig(cfg => {
    for (const [i, floor] of cfg.spaces.entries()) {
      const id = 'base-switch-' + floor.id, y = .35 + i * .12;
      floor.settings = { ...floor.settings, show_borders:true };
      floor.partitions = [{ id, a:[.14,y], b:[.43,y], cm:24 }];
      floor.openings = [{ id: id + '-window', type:'window', x:.27, y, angle:0, length:.08,
        host:{kind:'partition',id,t:.45} }];
    }
    return cfg;
  });
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
    && stage()?.dataset.hpIsoReadiness === 'ready' && !root.querySelector('.floor-preparation-status');

  // First visits may prepare a passive floor asynchronously. The strict
  // one-render contract below measures already prepared floor switches.
  await hp.switchSpace('garden'); await hp.settled();
  await hp.switchSpace('f1'); await hp.settled();
  const wallBase = () => root.querySelector('.iso-wall-base-paper')?.getAttribute('d');
  const firstBase = wallBase();
  const warmed = card._floorCacheBuilds.isoWallBase;
  result.wallBaseWasPrepared = typeof firstBase === 'string' && firstBase.length > 0
    && warmed === 0 && card._isoWallBasePool.size >= 2;
  let updates = 0;
  const update = card.update.bind(card);
  card.update = (changed) => { updates += 1; return update(changed); };
  let paperProbes = 0;
  const cssColor = card._cssColor.bind(card);
  card._cssColor = (...args) => { paperProbes += 1; return cssColor(...args); }; // private-ok: счётчик проходов и поиска бумаги (#739)
  let veils = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && (node.matches('[data-hp-startup-pending]') || node.querySelector('[data-hp-startup-pending]'))) veils += 1;
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
      baseRebuilds: card._floorCacheBuilds.isoWallBase - warmed,
      sameBase: typeof wallBase() === 'string' && (wallBase() === firstBase) === (id === 'f1'),
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
  result.wallBasesStayPrepared = switches.every(row => row.sameBase && row.baseRebuilds === 0);
  return result;
});
const { switches, ...checks } = out;
checkAll(checks);
await finish(browser, { ...checks, switches });
