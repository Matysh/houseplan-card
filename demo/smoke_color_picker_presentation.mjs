// #1008 / UI-016: native range pseudo-elements require actual paint, not CSS text.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, requirePinnedBrowser, checkAll, finish } from './serve.mjs';

requirePinnedBrowser('1008 HSV thumb and track pixels');
const output = 'artifacts/color-picker-presentation';
mkdirSync(output, { recursive: true });
const { page, browser } = await launch({ width: 712, height: 884 });
const out = {}, report = [];
const near = (a, b, tolerance = 3) => a.every((n, i) => Math.abs(n - b[i]) <= tolerance);
const rgb = hex => hex.match(/\w\w/g).map(n => parseInt(n, 16));
const settle = () => page.evaluate(async () => {
  await window.__picker.updateComplete;
  // #1081 gives this surface a real entrance animation. A settled raster
  // oracle must observe its completed paint, not disable motion or loosen RGB.
  await Promise.all(window.__picker._surface().getAnimations({ subtree: true })
    .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
    .map(animation => animation.finished.catch(() => {})));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
});

async function paint(label, selected, endpoints) {
  await settle();
  const state = await page.evaluate(() => {
    const surface = window.__picker._surface();
    const box = surface.getBoundingClientRect();
    return { fits: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      background: getComputedStyle(surface).backgroundColor,
      ranges: [...surface.querySelectorAll('.control input[type="range"]')].map(input => {
        const r = input.getBoundingClientRect(), css = getComputedStyle(input);
        return { x: r.x, y: r.y, width: r.width, height: r.height, value: +input.value, max: +input.max,
          cursor: css.cursor, focused: input.matches(':focus-visible'),
          thumbX: r.x + 10 + (r.width - 20) * (+input.value / +input.max), thumbY: r.y + r.height / 2 };
      }) };
  });
  const png = await page.screenshot();
  const sampled = await page.evaluate(async ({ data, state }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const pixel = (x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
    return state.ranges.map(r => ({ centre: pixel(r.thumbX, r.thumbY),
      // Circular 20px border-box with a 2px white rim, centred on the 10px track.
      rim: [[0, -9], [0, 8], [-9, 0], [8, 0]].map(([x, y]) => pixel(r.thumbX + x, r.thumbY + y)),
      halo: pixel(r.thumbX, r.thumbY - 12),
      track: [.12, .3, .7, .88].filter(t => Math.abs(r.x + r.width * t - r.thumbX) > 18)
        .map(t => ({ t: (Math.round(r.x + r.width * t) + .5 - r.x) / r.width,
          centre: pixel(r.x + r.width * t, r.thumbY),
          outside: pixel(r.x + r.width * t, r.thumbY - 6),
          inside: pixel(r.x + r.width * t, r.thumbY - 3) })) }));
  }, { data: png.toString('base64'), state });
  out[`${label}:centres`] = sampled.every(r => near(r.centre, rgb(selected), 1));
  out[`${label}:20px-centred-white-rims`] = sampled.every(r => r.rim.every(p => near(p, [255, 255, 255], 12)));
  out[`${label}:44px-inputs-fit`] = state.fits && state.ranges.every(r => r.height === 44);
  if (endpoints) {
    const bg = state.background.match(/\d+/g).slice(0, 3).map(Number);
    out[`${label}:10px-tracks`] = sampled.every(r => r.track.every(p => near(p.outside, bg, 1)));
    // H is independently sampled against its six primary/secondary intervals.
    const rainbow = [[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 0, 0]];
    out[`${label}:gradients`] = sampled.every((r, i) => r.track.every(p => {
      let a, b, t;
      if (i === 0) { const band = Math.min(5, Math.floor(p.t * 6)); a = rainbow[band]; b = rainbow[band + 1]; t = p.t * 6 - band; }
      else { [a, b] = endpoints[i - 1].map(rgb); t = p.t; }
      return near(p.centre, a.map((n, c) => n + (b[c] - n) * t), 3)
        && near(p.inside, a.map((n, c) => n + (b[c] - n) * t), 3);
    }));
  }
  report.push({ label, state, sampled });
  writeFileSync(`${output}/${label.replace(/[^\w-]/g, '_')}.png`, png);
  return { state, sampled };
}

async function hsv(h, s, v) {
  await page.evaluate(async values => {
    for (const [i, value] of values.entries()) {
      const surface = window.__picker._surface();
      const owned = ['left', 'top', 'maxWidth', 'maxHeight'];
      const before = owned.map(key => surface.style[key]);
      const input = surface.querySelectorAll('.control input[type="range"]')[i];
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await window.__picker.updateComplete;
      // Read before requestAnimationFrame: settling first would hide a placement reset.
      window.__placementStable &&= surface === window.__picker._surface()
        && surface.isConnected && owned.every((key, i) => surface.style[key] === before[i]);
    }
  }, [h, s, v]);
}

try {
  await page.evaluate(async () => {
    const p = document.createElement('hp-color-opacity'); p.id = 'presentation-probe'; p.pointerHover = true;
    p.style.cssText = 'position:fixed;left:80px;top:60px'; p.color = '#66cc66';
    document.body.append(p); window.__picker = p; window.__events = []; window.__placementStable = true;
    p.addEventListener('hp-color-opacity-change', e => window.__events.push(e.detail));
    await p.updateComplete; await p.togglePicker();
  });
  await page.mouse.move(5, 5);
  for (const [theme, bg, text, accent] of [
    ['dark', '#202126', '#eeeeee', '#03a9f4'], ['light', '#ffffff', '#212121', '#03a9f4'],
    ['custom', '#26232e', '#e6d8f0', '#ff9800'],
  ]) {
    await page.evaluate(([bg, text, accent]) => {
      for (const [k, v] of Object.entries({ '--card-background-color': bg, '--primary-text-color': text, '--primary-color': accent }))
        document.documentElement.style.setProperty(k, v);
    }, [bg, text, accent]);
    await hsv(120, 50, 80);
    await paint(theme, '#66cc66', [['#cccccc', '#00cc00'], ['#000000', '#80ff80']]);
  }
  for (const [name, coords, color, endpoints] of [
    ['black', [0, 0, 0], '#000000', [['#000000', '#000000'], ['#000000', '#ffffff']]],
    ['white', [0, 0, 100], '#ffffff', [['#ffffff', '#ff0000'], ['#000000', '#ffffff']]],
    ['gray', [240, 0, 50], '#808080', [['#808080', '#000080'], ['#000000', '#ffffff']]],
    ['maximum', [359, 100, 100], '#ff0004', [['#ffffff', '#ff0004'], ['#000000', '#ff0004']]],
  ]) { await hsv(...coords); await paint(name, color, endpoints); }

  const hex = page.locator('#presentation-probe input[type="text"]');
  await hex.fill('#4080bf');
  await paint('hex', '#4080bf', [['#bfbfbf', '#0060bf'], ['#000000', '#55abff']]);
  const before = await page.evaluate(() => window.__events.length);
  await hex.fill('#12');
  await paint('invalid-hex', '#4080bf');
  out.invalidHexNoEvent = await page.evaluate(n => window.__events.length === n, before);
  await hex.fill('#66cc66'); await hex.press('Tab');

  // Real SV pointer input: H=120, S=50, V=80 -> #66cc66, using the rendered field.
  await hsv(120, 100, 100);
  const field = await page.locator('#presentation-probe .sv-field').boundingBox();
  await page.mouse.click(field.x + field.width / 2, field.y + field.height * .2);
  await paint('sv-field', '#66cc66');
  const normal = await paint('normal', '#66cc66');
  const ranges = page.locator('#presentation-probe .control input[type="range"]');
  const gateRange = normal.state.ranges[0];
  await page.evaluate(() => { window.__picker.pointerHover = false; });
  await page.mouse.move(gateRange.thumbX, gateRange.thumbY); await page.waitForTimeout(150);
  const noHover = await paint('modality-no-hover', '#66cc66');
  out.modalitySuppressesHover = near(noHover.sampled[0].halo, normal.sampled[0].halo, 1);
  await page.evaluate(() => { window.__picker.pointerHover = true; });
  for (let i = 0; i < 3; i++) {
    const r = normal.state.ranges[i];
    await page.mouse.move(r.thumbX, r.thumbY); await page.waitForTimeout(150);
    const hovered = await paint(`hover-${i}`, '#66cc66');
    out[`hover-${i}:ring`] = !near(hovered.sampled[i].halo, normal.sampled[i].halo, 8)
      && hovered.state.ranges[i].cursor === 'pointer';
    await page.mouse.down(); await page.waitForTimeout(150);
    const active = await paint(`active-${i}`, '#66cc66');
    out[`active-${i}:ring`] = !near(active.sampled[i].halo, hovered.sampled[i].halo, 8)
      && active.state.ranges[i].cursor === 'grabbing';
    await page.mouse.up(); await page.mouse.move(5, 5); await page.waitForTimeout(150);
    await ranges.nth(i).focus(); await page.keyboard.press('ArrowRight');
    const changed = await page.evaluate(() => window.__picker.color);
    await page.waitForTimeout(150);
    const focused = await paint(`focus-${i}`, changed);
    out[`focus-${i}:ring-and-key`] = focused.state.ranges[i].focused
      && !near(focused.sampled[i].halo, normal.sampled[i].halo, 8) && changed !== '#66cc66';
    await page.keyboard.press('Shift+ArrowLeft');
    out[`focus-${i}:shift-ten`] = await ranges.nth(i).inputValue() === String(Number(focused.state.ranges[i].value) - 10);
    await hex.focus(); await hsv(120, 50, 80);
  }
  const hue = normal.state.ranges[0];
  await page.mouse.move(hue.thumbX, hue.thumbY); await page.mouse.down();
  await page.mouse.move(hue.x + hue.width - 10, hue.thumbY, { steps: 6 }); await page.mouse.up();
  out.trustedHueDrag = Number(await ranges.nth(0).inputValue()) >= 355;
  await paint('drag-end', await page.evaluate(() => window.__picker.color));

  await hex.focus(); await page.mouse.move(5, 5); await page.waitForTimeout(150);
  const current = await page.evaluate(() => window.__picker.color);
  const idleMotion = await paint('motion-idle', current);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motionRange = idleMotion.state.ranges[0];
  await page.mouse.move(motionRange.thumbX, motionRange.thumbY);
  const firstMotion = await paint('motion-first-frame', current);
  await page.waitForTimeout(150);
  const lastMotion = await paint('motion-final-frame', current);
  out.reducedMotion = near(firstMotion.sampled[0].halo, lastMotion.sampled[0].halo, 1)
    && !near(firstMotion.sampled[0].halo, idleMotion.sampled[0].halo, 8);
  await page.emulateMedia({ forcedColors: 'active' });
  await ranges.nth(1).hover();
  await ranges.nth(1).focus(); await page.keyboard.press('ArrowRight');
  out.forcedColorsFocus = await ranges.nth(1).evaluate(e => e.matches(':focus-visible')
    && e.matches(':hover')
    && getComputedStyle(e).outlineStyle === 'solid' && getComputedStyle(e).outlineWidth === '2px');
  await page.emulateMedia({ forcedColors: 'none' });

  const alpha = page.locator('#presentation-probe .row input[type="range"]');
  const native = await alpha.evaluate(e => ({ height: e.getBoundingClientRect().height, appearance: getComputedStyle(e).appearance }));
  await alpha.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  out.opacityStaysNativeAndIndependent = native.height === 44 && native.appearance === 'auto'
    && await page.evaluate(() => window.__picker.opacity === .01);

  await page.evaluate(() => { window.__picker.remove(); });
  const savedBefore = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
  // Each real settings family supplies the same actual component/template.
  for (const family of ['general', 'space', 'room', 'device', 'decor']) {
    await page.evaluate(async family => {
      const c = window.__card, hp = window.__hpTest;
      if (family === 'general') {
        let button = c.renderRoot.querySelector('[data-hp="settings"]');
        if (!button) {
          c.renderRoot.querySelector('[data-hp="header-menu"]').click(); await hp.settled();
          button = c.renderRoot.querySelector('[data-hp="header-menu-item"][data-id="settings"]');
        }
        button.click();
      }
      if (family === 'space') await hp.openSpaceDialog('edit', c._space);
      if (family === 'room') { await hp.setMode('plan'); await hp.openRoomEdit(c._curSpaceCfg.rooms[0].id); }
      if (family === 'device') { await hp.setMode('devices'); await hp.openMarkerDialog(); }
      if (family === 'decor') { await hp.setMode('decor'); await hp.setTool('line'); }
      await hp.settled();
      const dialog = c.renderRoot.querySelector('hp-dialog');
      if (family === 'room' || family === 'device') {
        const input = dialog.querySelector(family === 'room' ? 'select[name="rfill"]' : '#marker-display');
        input.value = family === 'room' ? 'custom' : 'icon_ripple';
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await hp.settled();
      }
      const p = family === 'decor' ? c.renderRoot.querySelector('.editor-secondary hp-color-opacity')
        : dialog.querySelector('hp-color-opacity');
      if (!p) throw new Error(`no picker in ${family}`);
      // Navigate the real section containing this control before interacting.
      const section = p.closest('[data-settings-section]');
      const id = section?.getAttribute('data-settings-section');
      if (id) { dialog.querySelector(`[data-section-target="${id}"]`)?.click(); await c.updateComplete; }
      p.scrollIntoView({ block: 'center' }); window.__picker = p;
      await p.togglePicker(); await p.updateComplete;
      const input = p._surface().querySelector('input[type="text"]');
      input.value = '#66cc66'; input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }, family);
    await paint(`consumer-${family}`, '#66cc66');
    await page.evaluate(async family => {
      const c = window.__card, hp = window.__hpTest; window.__picker.closePicker();
      if (family === 'decor') { await hp.setMode('view'); return; }
      const { confirm } = await hp.close(undefined, { via: 'cancel' });
      if (confirm) { confirm.querySelector('[data-hp="dialog-confirm"]').click(); await hp.settled(); }
      const until = performance.now() + 3000;
      while (c.renderRoot.querySelector('hp-dialog')) {
        if (performance.now() > until) throw new Error('settings did not close after discard');
        await new Promise(requestAnimationFrame);
      }
    }, family);
  }
  out.consumerCancelDoesNotPersist = await page.evaluate(before => JSON.stringify(window.__card._serverCfg) === before, savedBefore);
  await page.setViewportSize({ width: 320, height: 760 });
  // An absent browser capability is an environment input, not a source mutation.
  await page.evaluate(async () => {
    window.__savedPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
    Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined });
    const p = document.createElement('hp-color-opacity'); p.color = '#66cc66'; p.pointerHover = true;
    p.style.cssText = 'position:fixed;right:5px;top:120px'; document.body.append(p);
    window.__picker = p; await p.updateComplete; await p.togglePicker();
  });
  await paint('fallback-320', '#66cc66');
  await hsv(240, 50, 80);
  await paint('fallback-320-updated', '#6666cc', [['#cccccc', '#0000cc'], ['#000000', '#8080ff']]);
  out.fallbackUsesPortal = await page.evaluate(() => !!document.querySelector('[data-hp-overlay="color-opacity"]')
    && !window.__picker._surface().hasAttribute('popover'));
  await page.evaluate(() => {
    window.__picker._surface().querySelector('.confirm').click();
    Object.defineProperty(HTMLElement.prototype, 'showPopover', window.__savedPopover);
  });
  out.fallbackCloses = await page.evaluate(() => !window.__picker.pickerOpen);
  out.colorUpdatesPreserveControllerPlacementBeforePaint = await page.evaluate(() => window.__placementStable);
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  checkAll(out);
  await finish(browser, out);
}
