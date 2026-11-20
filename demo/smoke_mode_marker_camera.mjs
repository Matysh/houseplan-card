// #1484: capture the first published and settling frames from native panel controls.
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';

requirePinnedBrowser();
const { page, browser } = await launchPanelCold({ width: 1850, height: 1000 });
const card = page.locator('houseplan-panel houseplan-card');
const close = card.locator('.editor-close-slot [data-hp="editor-close"]');
const tab = mode => card.locator('[data-hp="mode-tab"][data-mode="' + mode + '"]');

async function settled(mode) {
  await page.waitForFunction(mode => window.__card._mode === mode && !window.__card._modeTransitionBusy, mode);
  await page.evaluate(() => window.__hpTest.settled());
}

function sample() {
  return page.evaluate(() => {
    const c = window.__card, root = c.renderRoot;
    const svg = root.querySelector('svg.plan-svg');
    const marker = root.querySelector('[data-hp="device"][data-id="d_light1"]');
    const ink = svg.querySelector('.iso-floor-scene') ?? svg.firstElementChild;
    const transform = ink.getScreenCTM();
    const position = c._pos(c._renderDevices.find(device => device.id === 'd_light1'));
    const point = new DOMPoint(position.x, position.y).matrixTransform(transform);
    const box = marker.getBoundingClientRect();
    return {
      projection: svg.dataset.projection,
      layers: root.querySelectorAll('.zoomwrap .devlayer').length,
      visible: Number(getComputedStyle(root.querySelector('.zoomwrap')).opacity) > .5,
      diameter: box.width,
      anchorError: Math.hypot(box.x + box.width / 2 - point.x, box.y + box.height / 2 - point.y),
    };
  });
}

async function observe(mode, phase) {
  await page.evaluate(phase => {
    const controller = window.__card._modeTransition, clock = controller._clock;
    const held = window.__hpMarkerModeFrame = { clock, callback: null };
    controller._clock = {
      ...clock,
      requestFrame(callback) {
        if (controller.state?.phase !== phase) return clock.requestFrame(callback);
        held.callback = callback;
        return -1484;
      },
      cancelFrame(id) {
        if (id === -1484) held.callback = null;
        else clock.cancelFrame(id);
      },
    };
  }, phase);
  if (mode === 'view') await close.click();
  else await tab(mode).click();
  await page.waitForFunction(() => !!window.__hpMarkerModeFrame.callback);
  const frame = await sample();
  await page.evaluate(() => {
    const held = window.__hpMarkerModeFrame;
    window.__card._modeTransition._clock = held.clock;
    held.clock.requestFrame(held.callback);
  });
  await settled(mode);
  return frame;
}

try {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    const hass = window.__mkHass(), { config } = await hass.callWS({ type: 'houseplan/config/get' });
    config.settings = { ...config.settings, volumetric_view: false, center_summary: true, summary_panel: {
      version: 1, title: 'Summary', show_on_mobile: true, blocks: [{
        id: 'state', title: 'State', visible: true, scope: { type: 'all' }, values: [
          { id: 'devices', label: 'Devices', source: { type: 'system', key: 'device_count' } },
        ],
      }],
    } };
    config.spaces[0].settings = { ...config.spaces[0].settings, show_borders: true };
    window.__pushServerConfig(config);
    history.replaceState(null, '', '/houseplan');
    const host = document.getElementById('host'), panel = document.createElement('houseplan-panel');
    host.style.cssText = 'width:100%;max-width:none;height:100vh;margin:0;padding:0';
    panel.hass = hass; panel.narrow = false;
    panel.panel = { component_name: 'houseplan-panel' };
    panel.route = { prefix: '/houseplan', path: '' };
    host.replaceChildren(panel);
    await import('/assets/houseplan-panel.js');
  });
  await page.waitForFunction(() => {
    const c = document.querySelector('houseplan-panel')?.shadowRoot?.querySelector('houseplan-card');
    if (!c || c._booting || c._bootSoft || c._floorPreparation?.pending || c._stageEl?.inert
        || !c.renderRoot.querySelector('[data-hp="device"][data-id="d_light1"]')) return false;
    window.__card = c;
    return true;
  });

  await assertFreshDemoBundleUnlessAllowed(page);
  const first = await observe('plan', 'running');
  check('cold-Flat-editor-start-has-one-aligned-device-layer',
    first.projection === 'flat' && first.layers === 1 && first.visible && first.anchorError < 1);
  await close.click();
  await settled('view');
  await card.locator('[data-hp="rotate-right"]').click();
  await page.waitForFunction(() => window.__card._rotation === 90 && !window.__card._rotationMotion.active);
  for (const editor of ['plan', 'devices', 'decor']) {
    for (const mode of [editor, 'view']) {
      const frame = await observe(mode, 'settling');
      check('turned-Flat-' + editor + '-' + mode + '-has-aligned-terminal-frame',
        frame.projection === 'flat' && frame.layers === 1 && frame.visible && frame.anchorError < 1);
    }
  }

  await card.locator('[data-hp="rotate-left"]').click();
  await page.waitForFunction(() => window.__card._rotation === 0 && !window.__card._rotationMotion.active);
  await page.evaluate(() => window.__hpTest.setVolumetricView(true));
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('svg.plan-svg')?.dataset.projection === 'iso');
  for (const editor of ['plan', 'devices', 'decor']) {
    const view = await sample();
    const start = await observe(editor, 'running');
    check('outgoing-2.5D-' + editor + '-keeps-device-shape',
      view.projection === 'iso' && start.projection === 'iso' && start.layers === 1 && start.visible
      && Math.abs(view.diameter - start.diameter) < .25);
    const end = await observe('view', 'settling');
    check('incoming-2.5D-' + editor + '-keeps-device-shape',
      end.projection === 'iso' && end.layers === 1 && end.visible && Math.abs(view.diameter - end.diameter) < .25);
    console.log(JSON.stringify({ editor, view, start, end }));
  }
} finally {
  await finish(browser);
}
