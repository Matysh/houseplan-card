// #1126: public navigation events; card internals below are read-only oracles.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('smoke_stair_arrival');
const { page, browser } = await launch({ width: 1100, height: 850 });
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
const root = page.locator('#host > houseplan-card');
const link = id => root.locator(`[data-hp="stair"][data-id="${id}"]`);
const count = () => root.locator('[data-hp="stair-arrival"]').count();
try {
  await page.evaluate(async () => {
    const hp = window.__hpTest;
    await hp.setServerConfig(config => {
      const make = (id, target, kind = 'straight', x = .4) => ({ id, kind, x, y: .4, angle: 25,
        length: .2, width: .1, radius: .08, direction: kind === 'spiral' ? 'clockwise' : 'forward', target_space_id: target });
      config.spaces = ['arrival-a', 'arrival-b', 'arrival-c'].map((id, index) => ({
        id, title: id, cell_cm: 5, rooms: [], walls: [], partitions: [],
        stairs: index === 0 ? [make('go', 'arrival-b')] : index === 1
          ? [make('back', 'arrival-a'), make('spiral', 'arrival-a', 'spiral', .7), make('other', 'arrival-c', 'straight', .2)] : [],
      }));
      return config;
    });
    await hp.setLayout({}); await hp.setMode('view'); await hp.switchSpace('arrival-a');
    window.__arrivalSaved = JSON.stringify(window.__card._serverCfg.spaces.map(s => s.stairs));
  });
  for (const [name, iso, dark, kiosk] of [['flat-light', false, false, false], ['iso-dark', true, true, false], ['kiosk', false, true, true]]) {
    await page.evaluate(async ({ iso, dark, kiosk }) => {
      const c = window.__card, hp = window.__hpTest;
      c.setConfig({ type: 'custom:houseplan-card', kiosk, cycle: 0 });
      c.style.setProperty('--primary-color', dark ? '#b56bea' : '#008a75');
      c.hass = { ...c.hass, themes: { ...c.hass.themes, darkMode: dark } };
      await hp.switchSpace('arrival-a'); await hp.setVolumetricView(iso);
    }, { iso, dark, kiosk });
    await link('go').focus(); await page.keyboard.press('Enter'); await settle();
    out[`${name}AllAndOnlyBackStairs`] = await count() === 2;
    out[`${name}SharedContourStyle`] = await root.locator('[data-hp="stair-arrival"]').evaluateAll((nodes, { dark, iso }) => nodes.every(n => {
      const s = getComputedStyle(n), expected = dark ? 'rgb(181, 107, 234)' : 'rgb(0, 138, 117)';
      return s.stroke === expected && s.fill === expected && s.fillOpacity === '0.22'
        && s.strokeWidth === '3px' && s.vectorEffect === 'non-scaling-stroke' && s.pointerEvents === 'none'
        && s.animationDuration === '1s' && s.animationIterationCount === '2' && s.animationTimingFunction === 'ease-in-out'
        && n.getAttribute('points') === n.parentNode.querySelector('.hp-stair-outline').getAttribute('points')
        && (!iso || !!n.closest('.iso-floor-scene'));
    }), { dark, iso });
    // Pause only the browser animation to inspect both pulses without changing product state/timers.
    out[`${name}TwoPulseFrames`] = await root.locator('[data-hp="stair-arrival"]').first().evaluate(n => {
      const a = n.getAnimations()[0]; a.pause();
      const opacity = time => { a.currentTime = time; return Number(getComputedStyle(n).opacity); };
      const okay = opacity(0) === 0 && opacity(400) === 1 && opacity(1000) === 0 && opacity(1400) === 1 && opacity(2000) === 0;
      a.play(); return okay;
    });
    const camera = await page.evaluate(() => [window.__card._zoom, window.__card._view]);
    await page.waitForTimeout(2100);
    out[`${name}ExpiresAndNoExtraCamera`] = await count() === 0 && JSON.stringify(camera) === JSON.stringify(await page.evaluate(() => [window.__card._zoom, window.__card._view]));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => { window.__card.setConfig({ type: 'custom:houseplan-card' }); await window.__hpTest.switchSpace('arrival-a'); });
  await link('go').focus(); await page.keyboard.press('Space'); await settle();
  out.reducedMotionStatic = await count() === 2 && await root.locator('[data-hp="stair-arrival"]').first().evaluate(n => getComputedStyle(n).animationName === 'none' && getComputedStyle(n).opacity === '1');
  // Native pan while feedback is present must remain available and keep feedback alive.
  const box = await root.locator('.stage').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 70, { steps: 3 }); await page.mouse.up();
  out.panDoesNotStopFeedback = await count() === 2;
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__hpTest.setMode('plan')); out.editorClears = await count() === 0;
  await page.evaluate(async () => { await window.__hpTest.setMode('view'); await window.__hpTest.switchSpace('arrival-a'); });
  await link('go').focus(); await page.keyboard.press('Enter'); await settle();
  await page.evaluate(() => window.__hpTest.switchSpace('arrival-c')); out.ordinaryFloorClearsAndNeverStarts = await count() === 0;
  await page.evaluate(() => window.__hpTest.switchSpace('arrival-b'));
  await link('other').focus(); await page.keyboard.press('Enter'); await settle(); out.noReverseNoFeedback = await count() === 0;
  await page.evaluate(() => window.__hpTest.switchSpace('arrival-a'));
  await link('go').focus(); await page.keyboard.press('Enter'); await settle();
  out.activeBeforeDisconnect = await count() === 2;
  await page.evaluate(() => { const c = window.__card, p = c.parentNode; c.remove(); p.append(c); }); await settle();
  out.disconnectClears = await count() === 0;
  out.noStairWrites = await page.evaluate(() => JSON.stringify(window.__card._serverCfg.spaces.map(s => s.stairs)) === window.__arrivalSaved);
  checkAll(out);
} finally { await finish(browser, out); }
