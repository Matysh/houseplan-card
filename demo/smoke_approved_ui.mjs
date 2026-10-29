/** #1119: accepted UI contracts through public HA fixtures and native input. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, requirePinnedBrowser, check, finish } from './serve.mjs';
import { installDeviceOfflineFixture, readDeviceOfflinePaint, setDeviceOfflineStates,
  waitDeviceOfflinePaint } from './helpers/device-offline.mjs';
import { makeDeviceContactsFixture } from './golden/device-contacts.mjs';

requirePinnedBrowser('#1119 accepted UI');
const { page, browser } = await launchColdView({ width: 1900, height: 1050 }, 1);
const evidence = process.env.HP_APPROVED_UI_EVIDENCE || 'artifacts/approved-ui-1119';
mkdirSync(evidence, { recursive: true });
const observations = {};
const card = page.locator('houseplan-card').first();
const settled = async () => {
  await page.waitForFunction(() => {
    const c = window.__card;
    return c && !c._booting && !c._bootSoft && !c._modeTransitionBusy
      && !c._modeTransitionPreparing && !c._cameraTransition.active && !c._refitRaf && !c._pendingRefitSize;
  });
  await page.evaluate(async () => {
    await window.__hpTest.settled();
    for (let n = 0; n < 3; n++) await new Promise(requestAnimationFrame);
  });
};
const width = async value => {
  await page.locator('#host').evaluate((host, value) => {
    host.style.cssText = `width:${value}px!important;max-width:none!important;margin:0!important;padding:0!important`;
  }, value);
  await settled();
};
const finiteAnimations = async locator => locator.evaluate(async node => {
  await Promise.allSettled(node.getAnimations({ subtree: true })
    .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
    .map(animation => animation.finished));
});
const setMode = async mode => { await page.evaluate(mode => window.__hpTest.setMode(mode), mode); await settled(); };
const record = (name, value) => { observations[name] = value; return value; };

try {
  await settled();
  await page.evaluate(() => {
    const card = window.__card, callWS = card.hass.callWS;
    window.__1119Writes = [];
    card.hass = { ...card.hass, callWS: async message => {
      if (/houseplan\/.*(?:update|set|patch|save|copy|delete|move)$/.test(message.type))
        window.__1119Writes.push(structuredClone(message));
      return callWS(message);
    } };
  });
  // UI-003 must work in a cold View before any editor has been requested.
  const lamp = card.locator('[data-hp="device"][data-id="d_light1"]');
  await lamp.hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  const info = card.locator('hp-dialog[data-kind="info"]');
  await info.waitFor(); await finiteAnimations(info);
  assert.deepEqual(await info.evaluate(dialog => ({
    shell: dialog.hasAttribute('form-shell'), settings: dialog.hasAttribute('settings-layout'),
    compact: dialog.hasAttribute('compact'), subtitle: !!dialog.shadowRoot.querySelector('.subtitle')?.textContent.trim(),
    rows: dialog.querySelectorAll('.hpf-row').length > 0, footer: !!dialog.querySelector('.hpf-footer'),
  })), { shell: true, settings: true, compact: true, subtitle: true, rows: true, footer: true });
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource')
    .some(row => /houseplan-editor-runtime-[^/]+\.js/.test(row.name))), false,
  'opening information in cold View must not request the complete editor runtime');
  await page.screenshot({ path: `${evidence}/cold-info.png` });
  assert.equal(await info.locator('.infofooter').evaluate(node => getComputedStyle(node).gap), '10px');
  await page.keyboard.press('Escape'); await info.waitFor({ state: 'hidden' });
  record('coldInfoUsesSharedUiKitWithoutEditor', true);

  // UI-005 uses one guarded close path and must not save from any dismissal.
  await width(1600);
  for (const via of ['x', 'escape', 'cancel']) {
    await card.locator('.summary-control button').first().click();
    const summary = card.locator('hp-dialog[data-kind="summary"]');
    await summary.waitFor(); await finiteAnimations(summary);
    assert.equal(await summary.evaluate(node => node.matches('[form-shell][settings-layout][compact]')), true);
    assert.equal(await summary.locator('.header').evaluate(node => Math.round(node.getBoundingClientRect().height)), 78);
    const kit = await summary.evaluate(node => {
      const body = getComputedStyle(node.querySelector('.summary-editor'));
      return { padding: body.padding, fontSize: body.fontSize, lineHeight: body.lineHeight,
        inputs: [...node.querySelectorAll('input[type="text"]')].map(input => { const css = getComputedStyle(input);
          return [css.fontSize, css.lineHeight, css.padding, css.fontWeight]; }),
        switches: [...node.querySelectorAll('.summary-switch input[type="checkbox"]')].map(input => {
          const box = input.getBoundingClientRect(); return [box.width, box.height];
        }) };
    });
    assert.deepEqual({ padding: kit.padding, fontSize: kit.fontSize, lineHeight: kit.lineHeight },
      { padding: '20px', fontSize: '13px', lineHeight: '19.5px' });
    if (!kit.inputs.length) assert.equal(await page.evaluate(() => window.__card._summary.dialog.localOnly), true,
      'the preserved local-only summary deliberately has no server title/blocks');
    for (const input of kit.inputs) assert.deepEqual(input, ['13px', '22px', '10px 12px', '400']);
    assert.ok(kit.switches.length > 0);
    assert.ok(kit.switches.every(([width, height]) => width === 44 && height === 44));
    record(`summary-kit-${via}`, kit);
    const before = await page.evaluate(() => ({ writes: window.__1119Writes.length,
      services: window.__serviceCalls.length }));
    await page.evaluate(() => {
      window.__1119CloseFrames = []; window.__1119CloseTracing = true;
      const sample = () => {
        if (!window.__1119CloseTracing) return;
        const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="summary"]');
        const surface = dialog?.shadowRoot?.querySelector('.surface') || dialog;
        window.__1119CloseFrames.push(surface ? getComputedStyle(surface).opacity : null);
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    if (via === 'x') await summary.locator('.close').click();
    else if (via === 'escape') await page.keyboard.press('Escape');
    else await summary.locator(':scope > [slot="footer"] [data-hp="dialog-cancel"]').click();
    await summary.waitFor({ state: 'hidden' });
    const after = await page.evaluate(() => {
      window.__1119CloseTracing = false;
      return { state: { writes: window.__1119Writes.length,
        services: window.__serviceCalls.length }, frames: window.__1119CloseFrames };
    });
    assert.deepEqual(after.state, before, `${via} must dismiss without persistence`);
    assert.ok(after.frames.some(opacity => Number(opacity) > 0 && Number(opacity) < 1),
      `${via} must retain an actual intermediate exit frame before retirement`);
    record(`summary-close-${via}`, after.frames);
  }

  // UI-006: real on-light pools are the positive control in View and Devices.
  await page.evaluate(() => window.__hpTest.setServerConfig(config => {
    config.spaces.find(space => space.id === window.__card._space).settings = { fill_mode: 'glow' };
    return config;
  }));
  for (const mode of ['view', 'plan', 'devices', 'decor']) {
    await setMode(mode);
    const light = await card.evaluate(card => {
      const root = card.renderRoot;
      const nodes = [...root.querySelectorAll('.glow-pools-frame,.led-fields')];
      return { pools: root.querySelectorAll('.glow-spot').length,
        visible: nodes.filter(node => getComputedStyle(node).display !== 'none').length };
    });
    record(`glow-${mode}`, light);
    if (mode === 'view' || mode === 'devices') assert.ok(light.pools > 0 && light.visible > 0);
    else assert.equal(light.visible, 0);
  }

  // UI-010: one actual-container threshold in all three editor modes.
  for (const mode of ['plan', 'devices', 'decor']) {
    await width(1200); await setMode(mode);
    for (const value of [1023, 1024, 1023, 1024]) {
      await width(value);
      assert.equal(await card.locator('[data-hp="properties-panel"]').count(), value >= 1024 ? 1 : 0,
        `${mode}: properties at ${value}`);
    }
  }
  await setMode('view');

  // UI-007: native fixture owns its power/availability; exact computed layers.
  await width(1400); await installDeviceOfflineFixture(page);
  const faces = (await readDeviceOfflinePaint(page, ['offline-icon', 'offline-down'])).faces;
  assert.equal(faces['offline-icon'].parent.opacity, 1);
  assert.equal(faces['offline-icon'].glyph.opacity, .35);
  assert.equal(faces['offline-down'].parent.opacity, .35);
  assert.equal(faces['offline-down'].glyph.opacity, 1);
  assert.equal(faces['offline-down'].glyph.effective, .35);
  await setDeviceOfflineStates(page, { 'media_player.offline_down': 'off' });
  const recovered = (await readDeviceOfflinePaint(page, ['offline-down'])).faces['offline-down'];
  assert.equal(recovered.parent.opacity, 1); assert.equal(recovered.glyph.opacity, .35);
  record('ownStatusPaint', { faces, recovered });
  await card.locator('[data-hp="device"][data-id="offline-down"]').hover();
  const statusTip = card.locator('[data-hp-live-tip]');
  await statusTip.waitFor({ state: 'visible' });
  assert.match(await statusTip.innerText(), /\bOff\b/);
  for (const [state, expected] of [['on', ''], ['unavailable', 'Unavailable'], ['off', 'Off']]) {
    await setDeviceOfflineStates(page, { 'media_player.offline_down': state });
    const text = await statusTip.innerText();
    if (expected) assert.ok(text.split('\n').includes(expected), `active status after ${state}: ${text}`);
    else assert.doesNotMatch(text, /\b(?:Off|Unavailable)\b/);
    const box = await statusTip.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1900 && box.y + box.height <= 1050);
  }
  record('activeTooltipFollowsCurrentHaFrame', true);

  // UI-004: actual dots, above the existing ordinary shell, not a replacement.
  await page.evaluate(() => window.__hpTest.setServerConfig(config => {
    config.settings.new_device_ids = ['offline-down'];
    config.markers.find(marker => marker.id === 'offline-text').hidden = true;
    return config;
  }));
  await settled();
  await setMode('devices');
  await card.locator('[data-hp="hidden-devices"]').click(); await settled();
  const dotProbes = [];
  for (const id of ['offline-down', 'offline-text']) {
    const dot = card.locator(`.dev[data-id="${id}"] .newdot`);
    await dot.waitFor();
    assert.equal(await dot.evaluate(node => getComputedStyle(node).zIndex), '3');
    dotProbes.push(await dot.evaluate((node, id) => {
      const marker = node.closest('.dev'), dot = node.getBoundingClientRect();
      return { id, point: [Math.floor(dot.x + dot.width / 2), Math.floor(dot.y + dot.height / 2)],
        opacity: Number(getComputedStyle(marker).opacity),
        rgb: id === 'offline-down' ? [240, 48, 31] : [158, 158, 158] };
    }, id));
  }
  // A ghost composites over the exact pixels underneath it, which may be a
  // wall rather than the nearby floor. Obtain that background through the
  // normal hidden-device toggle, preserving the actual camera throughout.
  const dotCamera = await page.evaluate(() => window.__hpTest.viewFrameSnapshot().camera);
  await card.locator('[data-hp="hidden-devices"]').click(); await waitDeviceOfflinePaint(page);
  assert.equal(await card.locator('.dev[data-id="offline-text"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.__hpTest.viewFrameSnapshot().camera), dotCamera);
  const absentPng = await page.screenshot({ path: `${evidence}/hidden-absent-background.png` });
  await card.locator('[data-hp="hidden-devices"]').click(); await waitDeviceOfflinePaint(page);
  assert.deepEqual(await page.evaluate(() => window.__hpTest.viewFrameSnapshot().camera), dotCamera);
  const dotPng = await page.screenshot({ path: `${evidence}/visible-dots.png` });
  const dotPixels = await page.evaluate(async ({ base64, absent, probes }) => {
    const reader = async base64 => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
      return ([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    };
    const pixel = await reader(base64), background = await reader(absent);
    return probes.map(probe => ({ ...probe, actual: pixel(probe.point), background: background(probe.point),
      expected: background(probe.point).map((color, i) => probe.rgb[i] * probe.opacity + color * (1 - probe.opacity)) }));
  }, { base64: dotPng.toString('base64'), absent: absentPng.toString('base64'), probes: dotProbes });
  for (const probe of dotPixels) assert.ok(probe.actual.every((color, i) => Math.abs(color - probe.expected[i]) <= 2),
    `${probe.id}: the accepted dot must actually paint above the shell, ${JSON.stringify(probe)}`);
  record('visibleDotPixels', dotPixels);

  // UI-001: approved contact corpus has asymmetric upright faces and real
  // connected/wall groups. Each quarter must update contour and native hit frame.
  assert.equal(await card.locator('[data-hp="hidden-devices"]').getAttribute('aria-pressed'), 'true');
  await card.locator('[data-hp="hidden-devices"]').click(); await setMode('view');
  const fixture = makeDeviceContactsFixture();
  for (const marker of fixture.config.markers) { marker.name = marker.id; marker.tap_action = 'info'; }
  await page.evaluate(async fixture => {
    const card = window.__card;
    // The frozen designer corpus is calibrated for the same icon_size=5
    // public card option as its existing Golden scenarios.
    card.setConfig({ ...card._config, icon_size: 5 });
    card.hass = { ...card.hass, states: { ...card.hass.states, ...fixture.states } };
    await window.__hpTest.setServerConfig(fixture.config);
    await window.__hpTest.setLayout(fixture.layout);
    await window.__hpTest.switchSpace(fixture.config.spaces[0].id);
  }, fixture);
  await width(1600); await card.locator('[data-hp="zoom-fit"]').click(); await setMode('view');
  await page.evaluate(() => window.__hpTest.waitForWrites()); await settled();
  const snapshot = () => page.evaluate(() => ({ frame: window.__hpTest.viewFrameSnapshot(),
    layout: JSON.stringify(window.__card._layout),
    writes: window.__1119Writes.length,
    shapes: window.__card._deviceContacts.scene?.shapes.size,
    groups: window.__card.renderRoot.querySelectorAll('.device-contact-contour.grouped').length,
    contours: [...window.__card.renderRoot.querySelectorAll('.device-contact-contour')].map(node => node.outerHTML) }));
  const initial = await snapshot(), turns = [];
  record('contactInitial', initial);
  assert.equal(initial.shapes, 32, 'the frozen designer fixture must be fully mounted before rotation');
  assert.ok(initial.contours.length >= 10 && initial.groups >= 7,
    'the original wall/free contact corpus must actually contact before quarter-turn acceptance');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (let quarter = 0; quarter < 4; quarter++) {
    await page.evaluate(() => {
      window.__1119TurnFrames = []; window.__1119TurnTracing = true;
      const sample = () => {
        if (!window.__1119TurnTracing) return;
        const root = window.__card.renderRoot, stage = root.querySelector('.stage');
        window.__1119TurnFrames.push({ transform: root.querySelector('.zoomwrap').style.transform,
          inert: stage.inert, background: getComputedStyle(stage).backgroundImage });
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await card.locator('[data-hp="rotate-right"]').click();
    await page.waitForFunction(() => window.__card.renderRoot.querySelector('.zoomwrap').style.transform.startsWith('rotate('));
    await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.zoomwrap').style.transform);
    await settled();
    const frames = await page.evaluate(() => { window.__1119TurnTracing = false; return window.__1119TurnFrames; });
    const result = await snapshot();
    assert.equal(result.layout, initial.layout);
    assert.equal(result.writes, initial.writes);
    assert.ok(frames.filter(frame => frame.transform.startsWith('rotate(')).length >= 2,
      'native rotation must have actual intermediate painted frames');
    assert.equal(new Set(frames.map(frame => frame.background)).size, 1);
    assert.ok(frames.filter(frame => frame.transform).every(frame => frame.inert));
    assert.ok(result.contours.length >= 10);
    turns.push({ ...result, frames });
    await card.locator('.stage').screenshot({ path: `${evidence}/contacts-${result.frame.rotation}.png` });
    // The exact accepted replay has a standalone wall badge at 90 and a
    // completely occluded free badge at 180. Native input must respect that
    // same front-to-back composition rather than click through its neighbour.
    const expected = { 0: [11, 7], 90: [10, 7], 180: [10, 6], 270: [11, 7] }[result.frame.rotation];
    assert.deepEqual([result.contours.length, result.groups], expected);
    for (const id of ['badge-designer-0', 'wall-double-designer-0']) {
      const hit = await card.locator(`.dev[data-id="${id}"]`).evaluate(marker => {
        const root = marker.getRootNode(), id = marker.dataset.id;
        const badge = marker.querySelector('.value-badge'), path = marker.querySelector('.device-contact-hit');
        const box = badge.getBoundingClientRect();
        const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const owner = point => root.elementFromPoint(point.x, point.y)?.closest('.dev')?.dataset.id || null;
        const visiblePoint = node => {
          const box = node.getBoundingClientRect();
          for (const y of [.1, .3, .5, .7, .9]) for (const x of [.1, .3, .5, .7, .9]) {
            const point = { x: box.x + box.width * x, y: box.y + box.height * y };
            if (owner(point) === id) return point;
          }
          return null;
        };
        return { custom: marker.hasAttribute('data-hp-device-contact'), center, centerOwner: owner(center),
          badgePoint: visiblePoint(badge), corePoint: visiblePoint(marker.querySelector('.device-core')),
          contains: path ? path.isPointInFill(new DOMPoint(center.x, center.y)
            .matrixTransform(path.getScreenCTM().inverse())) : null };
      });
      const standalone = (id === 'wall-double-designer-0' && result.frame.rotation === 90)
        || (id === 'badge-designer-0' && result.frame.rotation === 180);
      assert.equal(hit.custom, !standalone, `${id}: accepted contact ownership at ${result.frame.rotation}`);
      if (hit.custom) assert.equal(hit.contains, true, `${id}: upright badge belongs to its real hit silhouette`);
      if (id === 'badge-designer-0' && result.frame.rotation === 180) {
        assert.equal(hit.badgePoint, null, 'the accepted front neighbour must fully occlude this badge');
        assert.equal(hit.centerOwner, 'badge-designer-1');
        await page.mouse.click(hit.center.x, hit.center.y); await info.waitFor();
        assert.equal(await info.evaluate(dialog => dialog.title), 'badge-designer-1');
        await page.keyboard.press('Escape'); await info.waitFor({ state: 'hidden' });
        assert.ok(hit.corePoint, 'the device must still have a visible native target');
      } else assert.ok(hit.badgePoint, `${id}: an actual visible badge target must remain available`);
      const point = hit.badgePoint || hit.corePoint;
      await page.mouse.click(point.x, point.y); await info.waitFor();
      assert.equal(await info.evaluate(dialog => dialog.title), id,
        'native visible hit must open the actual front device');
      await page.keyboard.press('Escape'); await info.waitFor({ state: 'hidden' });
      turns.at(-1).hits ??= [];
      turns.at(-1).hits.push({ id, ...hit });
    }
  }
  assert.deepEqual(turns.at(-1).frame.camera, initial.frame.camera);
  assert.deepEqual(turns.at(-1).contours, initial.contours);
  assert.deepEqual(turns.at(-1).frame.floorBuilds, initial.frame.floorBuilds);
  record('quarterTurns', turns);
  const rotateButton = card.locator('[data-hp="rotate-right"]');
  const buttonBox = await rotateButton.boundingBox();
  const clickRotate = () => page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  const rotationSettled = async expected => page.waitForFunction(async expected => {
    if (window.__card._rotation !== expected) return false;
    for (let n = 0; n < 3; n++) await new Promise(requestAnimationFrame);
    return window.__card._rotation === expected
      && !window.__card.renderRoot.querySelector('.zoomwrap').style.transform;
  }, expected);
  // Three native clicks during a running motion must retain their order.
  await clickRotate();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.zoomwrap').style.transform.startsWith('rotate('));
  await clickRotate(); await clickRotate(); await rotationSettled(270);
  assert.equal((await snapshot()).writes, initial.writes);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await clickRotate(); await rotationSettled(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // A new mode owns input; a queued View turn cannot run after that handoff.
  await clickRotate();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.zoomwrap').style.transform.startsWith('rotate('));
  await clickRotate(); await card.locator('.modetab[data-mode="plan"]').click(); await settled();
  await page.waitForTimeout(350);
  assert.equal((await snapshot()).frame.rotation, 90);
  assert.equal(await card.locator('.stage').evaluate(stage => stage.inert), false);
  assert.equal(await card.locator('.zoomwrap').evaluate(wrap => wrap.style.transform), '');
  await setMode('view');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.locator('[data-hp="rotate-left"]').click(); await rotationSettled(0);
  record('orderedQueueAndModeRetirement', true);
  // Follow-up native drag after a quarter turn uses screen deltas and the
  // ordinary writer/history; Escape must restore it without a write.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.locator('[data-hp="rotate-right"]').click(); await settled();
  await setMode('devices');
  const moving = card.locator('.dev[data-id="badge-designer-0"]');
  const beforeDrag = await page.evaluate(() => ({ layout: structuredClone(window.__card._layout),
    history: window.__card._devicePositionHistory.size, writes: window.__1119Writes.length }));
  const box = await moving.boundingBox(), from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 48, from.y + 24, { steps: 8 });
  assert.equal(await page.evaluate(() => !!window.__card._deviceDrag), true);
  const liveBox = await moving.boundingBox();
  assert.ok(Math.hypot(liveBox.x - box.x, liveBox.y - box.y) > 10,
    'the next real drag must visibly move the rotated device');
  // Existing wide Properties selection consumes the first Escape. Prove that
  // transition explicitly, then use the next Escape to cancel the live drag.
  assert.ok(await page.evaluate(() => window.__card._editorRuntime.properties.identity));
  await page.keyboard.press('Escape'); await settled();
  assert.equal(await page.evaluate(() => window.__card._editorRuntime.properties.identity), null);
  assert.equal(await page.evaluate(() => !!window.__card._deviceDrag), true);
  await page.keyboard.press('Escape'); await settled();
  assert.equal(await page.evaluate(() => !!window.__card._deviceDrag), false);
  await page.mouse.up(); await settled();
  assert.deepEqual(await page.evaluate(() => ({ layout: structuredClone(window.__card._layout),
    history: window.__card._devicePositionHistory.size, writes: window.__1119Writes.length })), beforeDrag);
  record('rotatedNativeDragCancel', true);
  // A fresh document resets lazy adoption. The initial scenario above owns
  // cold Info -> Summary; these two orders cover Summary first and editor first.
  for (const order of ['summary-first', 'editor-first']) {
    await page.reload();
    await page.waitForFunction(() => window.__card?._devices?.length > 0 && !window.__card._booting && !window.__card._bootSoft);
    await page.locator('#host').evaluate(host => { host.style.cssText = 'width:1600px!important;max-width:none!important;margin:0!important;padding:0!important'; });
    const ready = async () => page.evaluate(async () => {
      await window.__card.updateComplete;
      for (let n = 0; n < 3; n++) await new Promise(requestAnimationFrame);
    });
    await ready();
    if (order === 'editor-first') {
      await card.locator('.modetab[data-mode="plan"]').click();
      await page.waitForFunction(() => window.__card._mode === 'plan' && !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);
      await card.locator('.modes [data-hp="editor-close"]').click();
      await page.waitForFunction(() => window.__card._mode === 'view' && !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);
    }
    await card.locator('.summary-control button').first().click();
    const summary = card.locator('hp-dialog[data-kind="summary"]');
    await summary.waitFor(); await finiteAnimations(summary);
    const composition = await summary.evaluate(node => {
      const body = getComputedStyle(node.querySelector('.summary-editor'));
      const inputs = [...node.querySelectorAll('input[type="text"]')].map(input => { const css = getComputedStyle(input);
        return [css.padding, css.fontSize, css.lineHeight, css.fontWeight]; });
      const group = node.querySelector('.summary-general').getBoundingClientRect();
      return { body: [body.padding, body.fontSize, body.lineHeight],
        inputs,
        switches: [...node.querySelectorAll('.summary-switch input')].map(input => {
          const box = input.getBoundingClientRect();
          return { width: box.width, height: box.height, within: box.left >= group.left && box.right <= group.right };
        }) };
    });
    assert.deepEqual(composition.body, ['20px', '13px', '19.5px']);
    if (!composition.inputs.length) assert.equal(await page.evaluate(() => window.__card._summary.dialog.localOnly), true);
    for (const input of composition.inputs) assert.deepEqual(input, ['10px 12px', '13px', '22px', '400']);
    assert.ok(composition.switches.length > 0 && composition.switches.every(input => input.width === 44 && input.height === 44 && input.within));
    if (order === 'summary-first') assert.equal(await page.evaluate(() => performance.getEntriesByType('resource')
      .some(row => /houseplan-editor-runtime-[^/]+\.js/.test(row.name))), false);
    await page.keyboard.press('Escape'); await summary.waitFor({ state: 'detached' });
    const target = card.locator('[data-hp="device"][data-id="d_light1"]');
    await target.hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await info.waitFor(); await finiteAnimations(info);
    const infoComposition = await info.evaluate(node => ({ footerGap: getComputedStyle(node.querySelector('.infofooter')).gap,
      padding: getComputedStyle(node.querySelector('.body')).padding,
      header: Math.round(node.shadowRoot.querySelector('.header').getBoundingClientRect().height) }));
    assert.deepEqual(infoComposition, { footerGap: '10px', padding: '20px', header: 78 });
    record(`load-order-${order}`, { composition, infoComposition });
    await page.keyboard.press('Escape'); await info.waitFor({ state: 'detached' });
  }
  check('approved-ui-seven-contracts-completed', true);
} catch (error) {
  observations.error = String(error?.stack || error);
  check('approved-ui-seven-contracts-completed', false);
} finally {
  writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
  await finish(browser, observations);
}
