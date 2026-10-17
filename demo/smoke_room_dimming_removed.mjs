// #943: ordinary legacy inputs, actual screenshot pixels, no product-state writes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, finish, requirePinnedBrowser } from './serve.mjs';
import { waitForKioskViewport } from './helpers/kiosk-viewport-ready.mjs';

requirePinnedBrowser('#943 retired room-darkness pixels');
const output = resolve(process.argv.find(a => a.startsWith('--output='))?.slice(9) || 'artifacts/943/room-dimming');
mkdirSync(output, { recursive: true });
const { page, browser } = await launch({ width: 1200, height: 900 }, 1);
const observations = [];
try {
  await page.evaluate(async () => {
    const c = window.__card;
    const callWS = c.hass.callWS.bind(c.hass);
    window.__dimming943Wire = [];
    // Public HA input: no active lamps, including lamps in the harness registry.
    c.hass = { ...c.hass, callWS: async message => {
      window.__dimming943Wire.push(structuredClone(message));
      return callWS(message);
    }, states: Object.fromEntries(Object.entries(c.hass.states).map(([id, state]) => [id,
      id.startsWith('light.') ? { ...state, state: 'off' } : state])) };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: [],
      spaces: [{ id: 'dimming943', title: 'Legacy darkness', plan_url: null, view_box: [0, 0, 1, 1],
        cell_cm: 10,
        settings: { fill_mode: 'none', glow_enabled: false, show_borders: true, show_names: false },
        rooms: [{ id: 'room943', name: 'Room', poly: [[.1, .1], [.9, .1], [.9, .9], [.1, .9]] }] }],
      settings: { ...cfg.settings, filter_seeded: true, bg_mode: 'static', bg_color: '#c8d0dc',
        volumetric_view: false, sun_rays: false, fill_colors: { ...cfg.settings?.fill_colors } } }));
  });
  await waitForKioskViewport(page);

  const configure = async (fill, legacy) => {
    await page.evaluate(async ({ fill, legacy }) => {
      await window.__hpTest.waitForWrites();
      await window.__hpTest.setServerConfig(cfg => {
        const fill_colors = { ...cfg.settings.fill_colors };
        if (legacy) fill_colors.glow_base = { c: '#15ff2a', a: 1 };
        else delete fill_colors.glow_base;
        return { ...cfg, settings: { ...cfg.settings, fill_colors },
          spaces: cfg.spaces.map(s => ({ ...s, settings: { ...s.settings,
            fill_mode: fill, custom_fill: { c: '#225588', a: 0 }, glow_enabled: legacy } })) };
      });
      await window.__hpTest.settled();
    }, { fill, legacy });
    await waitForKioskViewport(page);
  };
  const pixels = async (name, surface = null) => {
    const points = await page.evaluate(surface => {
      const card = surface ? document.getElementById(surface) : window.__card;
      const room = card.renderRoot.querySelector('[data-hp="room"][data-id="room943"]');
      if (!room) throw Error('room943 is not visibly rendered');
      const b = room.getBoundingClientRect();
      if (!(b.width > 100 && b.height > 100)) throw Error('room943 has no measurable floor');
      return [.3, .5, .7].flatMap(x => [.3, .5, .7].map(y => ({ x: b.x + x * b.width, y: b.y + y * b.height })));
    }, surface);
    const screenshot = await page.screenshot({ path: resolve(output, `${name}.png`) });
    const rgb = await page.evaluate(async ({ encoded, points }) => {
      const image = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const samples = points.map(p => {
        const data = ctx.getImageData(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5).data;
        // A median rejects sparse editor grid dots without changing the scene.
        return [0, 1, 2].map(channel => Array.from({ length: 25 }, (_, n) => data[4 * n + channel]).sort((a, b) => a - b)[12]);
      });
      image.close();
      return samples;
    }, { encoded: screenshot.toString('base64'), points });
    return { name, rgb, points };
  };

  const parity = (reference, legacy, context) => {
    const delta = Math.max(...reference.rgb.flatMap((pixel, n) => pixel.map((v, c) => Math.abs(v - legacy.rgb[n][c]))));
    observations.push({ context, reference, legacy, delta });
    assert.ok(delta <= 1, `#943 ${context}: legacy darkness/Glow without lamps must not repaint the floor (RGB delta ${delta})`);
  };
  for (const mode of ['view', 'plan', 'devices', 'decor']) {
    await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
    await waitForKioskViewport(page);
    for (const fill of ['none', 'custom', 'temp', 'glow']) {
      await configure(fill, false);
      const reference = await pixels(`${mode}-${fill}-reference`);
      await configure(fill, true);
      const legacy = await pixels(`${mode}-${fill}-legacy`);
      parity(reference, legacy, `${mode}/${fill}`);
      assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('.glow-base-layer, .glow-base-tunnels').length), 0,
        'pixel parity also has no retired active scene layer');
    }
  }
  await page.evaluate(() => window.__hpTest.setMode('view'));
  // Both static branches use real server reads and the same legacy input. A
  // newly mounted instance also catches stale static-only defaults/fallbacks.
  for (const lightPools of [false, true]) {
    const frames = [];
    for (const legacy of [false, true]) {
      await configure('none', legacy);
      await page.evaluate(async lightPools => {
        await customElements.whenDefined('houseplan-space-card');
        const card = document.createElement('houseplan-space-card');
        card.id = 'static943';
        card.setConfig({ type: 'custom:houseplan-space-card', space: 'dimming943',
          show_button: false, light_pools: lightPools });
        card.style.cssText = 'position:fixed;inset:0;width:1200px;height:900px;z-index:100;background:#c8d0dc';
        card.hass = window.__card.hass;
        document.body.append(card);
      }, lightPools);
      await page.waitForFunction(() => document.getElementById('static943')?.renderRoot
        ?.querySelector('[data-hp="room"][data-id="room943"]'));
      await page.evaluate(async () => {
        const card = document.getElementById('static943'); await card.updateComplete;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      frames.push(await pixels(`static-${lightPools}-${legacy}`, 'static943'));
      assert.deepEqual(await page.evaluate(() => {
        const root = document.getElementById('static943').renderRoot;
        return { retired: root.querySelectorAll('.glow-base-layer,.glow-base-tunnels').length,
          pointer: getComputedStyle(root.querySelector('.hp-static-stage')).pointerEvents };
      }), { retired: 0, pointer: 'none' });
      await page.evaluate(() => document.getElementById('static943').remove());
    }
    parity(frames[0], frames[1], `static/pools=${lightPools}`);
  }
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
  await waitForKioskViewport(page);
  for (const fill of ['none', 'custom', 'temp', 'glow']) {
    await configure(fill, false);
    const reference = await pixels(`iso-${fill}-reference`);
    await configure(fill, true);
    parity(reference, await pixels(`iso-${fill}-legacy`), `iso/${fill}`);
    assert.equal(await page.locator('.stage.projection-iso').count(), 1);
  }
  await page.evaluate(() => window.__hpTest.setVolumetricView(false));
  await waitForKioskViewport(page);
  // General settings are exercised through real controls, not dialog fields.
  // The wire journal distinguishes a read from a hidden migration/write.
  await configure('none', true);
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    settings: { ...cfg.settings, fill_colors: { ...cfg.settings.fill_colors,
      light_on: { c: '#aabbcc', a: .37 }, glow_light: { c: '#ffeedd', a: .62 } } } })));
  assert.equal(await page.evaluate(() => window.__dimming943Wire.filter(m => m.type === 'houseplan/config/set').length), 0,
    'loading legacy settings must not migrate the server');
  const before = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
  const openSettings = async () => {
    await page.locator('[data-hp="settings"]').click();
    await page.locator('hp-dialog[data-kind="settings"] #gs-glow-radius').waitFor();
  };
  const dialog = page.locator('hp-dialog[data-kind="settings"]');
  const opacity = dialog.locator('.hpf-card[data-card="glow"] .hpf-colortile-meta input');
  await openSettings();
  assert.equal(await dialog.locator('.hpf-card[data-card="glow"] .hpf-colortile').count(), 1);
  await opacity.fill('42');
  await dialog.locator('#gs-glow-radius').fill('4.5');
  await dialog.locator('.dialog-action-commit [data-hp="dialog-cancel"]').click();
  await page.locator('hp-confirm [data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config), before,
    'discarding the draft preserves raw legacy and active settings');
  await openSettings();
  await opacity.fill('42');
  await dialog.locator('#gs-glow-radius').fill('4.5');
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__hpTest.waitForWrites());
  const saved = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
  assert.equal(Object.hasOwn(saved.settings.fill_colors, 'glow_base'), false);
  assert.deepEqual(saved.settings.fill_colors.glow_light, { c: '#ffeedd', a: .42 });
  assert.deepEqual(saved.settings.fill_colors.light_on, before.settings.fill_colors.light_on);
  assert.equal(saved.settings.glow_radius_cm, 450);
  assert.equal(saved.settings.bg_color, before.settings.bg_color);
  assert.deepEqual(saved.spaces, before.spaces);
  assert.equal(await page.evaluate(() => window.__dimming943Wire.filter(m => m.type === 'houseplan/config/set').length), 1,
    'only explicit Save writes the config');
  await openSettings();
  assert.equal(await opacity.inputValue(), '42');
  assert.equal(await dialog.locator('#gs-glow-radius').inputValue(), '4.5');
  await dialog.locator('.dialog-action-group > button').filter({ hasText: 'Reset' }).click();
  assert.equal(await dialog.locator('.hpf-card[data-card="glow"] .hpf-colortile').count(), 1);
  assert.equal(await page.evaluate(() => Object.hasOwn(window.__card._settingsDialog.colors, 'glow_base')), false,
    'Reset does not recreate the retired role');
  await dialog.locator('.dialog-action-commit [data-hp="dialog-cancel"]').click();
  await page.locator('hp-confirm [data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });
  const remountKiosk = async () => {
    await page.evaluate(() => {
      const old = window.__card;
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
      card.hass = old.hass;
      old.replaceWith(card);
      // Harness subject selection, not a product-private field.
      window.__card = card;
    });
    await waitForKioskViewport(page);
  };
  for (const iso of [false, true]) {
    await page.evaluate(async iso => { await window.__hpTest.setVolumetricView(iso); }, iso);
    const frames = [];
    for (const legacy of [false, true]) {
      await configure('none', legacy);
      await remountKiosk();
      frames.push(await pixels(`kiosk-${iso}-${legacy}-mounted`));
      await remountKiosk();
      parity(frames.at(-1), await pixels(`kiosk-${iso}-${legacy}-warm`), `kiosk/iso=${iso}/warm/legacy=${legacy}`);
      assert.equal(await page.locator('.glow-base-layer,.glow-base-tunnels').count(), 0);
      assert.equal(await page.locator('.stage.projection-iso').count(), Number(iso));
    }
    parity(frames[0], frames[1], `kiosk/iso=${iso}/legacy`);
  }
  await finish(browser, { checks: observations.length, output });
} finally {
  writeFileSync(resolve(output, 'pixels.json'), JSON.stringify(observations, null, 2) + '\n');
  await browser.close();
}
