/** #792 AC4–10: live dependencies, static exceptions, geometry and passive input; #807 AC2 low-only mode.
 * D32/56/96 × light/dark and the approved MDI art are also pinned by battery golden boards;
 * route layering has its own raster witness in smoke_device_battery_zigbee.
 */
import { launch, check, checkAll, finish } from './serve.mjs';
import { batteryColorPixels, batteryGeometry, batteryInputProbe, batteryMdiIcon, batteryPointerReachedPlan, captureBatteryPointerDown, installBatteryFixture, patchBatteryMarker, setBatteryState } from './helpers/device-battery-fixture.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 }, 1, [], { hasTouch: true });
const out = {};
try {
  await installBatteryFixture(page);
  out.approvedShadowIsAppliedAtRenderedScale = await page.evaluate(() => {
    const icon = window.__card.shadowRoot.querySelector('[data-id="d_temp"] ha-icon.device-battery-icon');
    if (!icon) return false;
    const frame = icon.getBoundingClientRect().width;
    const filter = getComputedStyle(icon).filter;
    const values = [...filter.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
    const expected = [
      frame * 0.024324324324 + 0.237837837844,
      frame * 0.048648648649 + 0.875675675669,
      frame * 0.051351351351 + 0.324324324331,
    ];
    return filter.includes('drop-shadow') && /0\.75|75%/.test(filter)
      && values.length >= 3 && expected.every((value, index) => Math.abs(value - values[index]) <= 0.03);
  });
  out.nonBatteryGetsNoQuestionMark = await page.evaluate(() => {
    const node = window.__card.shadowRoot.querySelector('[data-id="d_leak"]');
    return !!node && node.getBoundingClientRect().width > 0 && !node.querySelector('.device-battery');
  });

  for (const [value, state, rgb] of [
    ['80', 'normal', [29, 194, 29]], ['40', 'warning', [240, 160, 12]],
    ['5', 'low', [240, 65, 12]], ['unavailable', 'unknown', [112, 119, 129]],
  ]) {
    await setBatteryState(page, value);
    await page.waitForFunction(state => window.__card.shadowRoot
      .querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === state, state);
    const geometry = await batteryGeometry(page);
    const pixels = await batteryColorPixels(page, geometry.battery, rgb);
    out[`batteryUsesOfficialMdi_${state}`] = await batteryMdiIcon(page, state);
    out[`batteryOnlyTickPaints_${state}`] = pixels >= 8;
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, show_device_battery: false },
    })));
    out[`globalOffHides_${state}`] = (await batteryGeometry(page)).battery === null;
    // #807 AC2: the low-only mode keeps just the red indicator.
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, show_device_battery: 'low' },
    })));
    const lowOnly = await batteryGeometry(page);
    out[`lowOnlyKeepsOnlyRed_${state}`] = state === 'low' ? lowOnly.state === 'low' : lowOnly.battery === null;
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, show_device_battery: true },
    })));
  }
  // The selected unavailable first source must not borrow the healthy second.
  await setBatteryState(page, '100', 'sensor.zzz_hp_battery');
  out.unavailableFirstRemainsUnknown = (await batteryGeometry(page)).state === 'unknown';
  await setBatteryState(page, '80');
  await page.evaluate(() => window.__setRegistryDisabled('entity', 'sensor.aaa_hp_battery', 'user'));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'unknown');
  out.disabledFirstSourceCannotReadStaleLiveValue = true;
  await page.evaluate(() => window.__setRegistryDisabled('entity', 'sensor.aaa_hp_battery', null));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'normal');
  await page.evaluate(() => window.__setRegistryDisabled('device', 'd_temp', 'user'));
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery'));
  out.disabledMarkerGetsNoLiveBattery = true;
  await page.evaluate(() => window.__setRegistryDisabled('device', 'd_temp', null));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'normal');

  await patchBatteryMarker(page, { hide_battery: true });
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery'));
  out.localOptOutHidesOnlySelectedDevice = await page.evaluate(() =>
    !window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery')
      && !!window.__card.shadowRoot.querySelector('[data-id="d_light1"] .device-battery'));
  await patchBatteryMarker(page, { hide_battery: 'true' });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery'));
  out.localOptOutRequiresExactBooleanTrue = true;
  await patchBatteryMarker(page, { hide_battery: false });

  for (const position of ['none', 'right', 'left', 'top', 'bottom']) {
    await patchBatteryMarker(page, { value_badge: position === 'none' ? { enabled: false } : {
      enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.living_temp' }, position,
    } });
    const before = await batteryGeometry(page);
    out[`rightOfWholeBlock_${position}`] = !!before.battery && !!before.shell
      && before.battery.x >= before.shell.right + 1
      && Math.abs(before.battery.y + before.battery.height / 2 - before.shell.y - before.shell.height / 2) <= 0.8;
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, show_device_battery: false },
    })));
    const hidden = await batteryGeometry(page);
    out[`hideKeepsCoreAndBadge_${position}`] = hidden.battery === null
      && ['shell', 'core', 'badge', 'lqi'].every(key => JSON.stringify(before[key]) === JSON.stringify(hidden[key]));
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, show_device_battery: true },
    })));
  }

  const iconGeometry = await batteryGeometry(page);
  await patchBatteryMarker(page, { binding: 'entity:sensor.living_temp', display: 'value',
    value_source: { kind: 'entity_state', entity_id: 'sensor.living_temp' },
    value_badge: { enabled: false },
  });
  await setBatteryState(page, '123456789012345', 'sensor.living_temp');
  const text = await batteryGeometry(page);
  out.longTextUsesWholeShell = text.core.width > iconGeometry.core.width * 1.5
    && text.battery.x >= text.shell.right + 1;
  await setBatteryState(page, '5');
  out.entityMarkerInheritsOwnSiblingTick = (await batteryGeometry(page)).state === 'low';

  for (const display of ['static_icon', 'value_static_icon']) {
    await patchBatteryMarker(page, { display });
    await setBatteryState(page, '40');
    const warning = await batteryGeometry(page);
    await setBatteryState(page, '80');
    const normal = await batteryGeometry(page);
    out[`staticModeLiveBattery_${display}`] = warning.state === 'warning' && normal.state === 'normal';
    out[`staticModeKeepsOtherDiagnosticsSuppressed_${display}`] = await page.evaluate(() => {
      const node = window.__card.shadowRoot.querySelector('[data-id="d_temp"]');
      return !node.querySelector('.lqi,.value-badge,.device-pulse,.activity-dot');
    });
  }
  await patchBatteryMarker(page, { display: 'badge', binding: 'device:d_temp', value_badge: { enabled: false } });
  await setBatteryState(page, '22.4', 'sensor.living_temp');

  // Public marker editor entry gives the exact live preview and draft projection.
  await page.evaluate(async () => { await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_temp'); });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot
    ?.querySelector('.device-battery'));
  await setBatteryState(page, '40');
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot
    ?.querySelector('.device-battery')?.dataset.state === 'warning');
  out.previewLiveTickAndNoClipping = await page.evaluate(() => {
    const preview = window.__card.shadowRoot.querySelector('hp-device-preview').shadowRoot;
    const battery = preview.querySelector('.device-battery');
    const r = battery?.getBoundingClientRect();
    const stage = preview.querySelector('.previewstage')?.getBoundingClientRect();
    return battery?.dataset.state === 'warning' && !!r && !!stage
      && r.left >= stage.left && r.top >= stage.top && r.right <= stage.right && r.bottom <= stage.bottom;
  });
  out.previewHasLocalOptOutToggle = await page.evaluate(() => {
    const input = window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery');
    return !!input && input.checked === false;
  });
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery').click());
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot
    ?.querySelector('.device-battery'));
  out.previewOptOutHidesOnlyDraftBattery = await page.evaluate(() =>
    !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.device-battery')
      && !!window.__card.shadowRoot.querySelector('[data-id="d_light1"] .device-battery'));
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery').click());
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot
    ?.querySelector('.device-battery'));
  await page.evaluate(async () => { await window.__hpTest.close(undefined, { via: 'cancel' }); await window.__hpTest.setMode('view'); });

  // Save/reopen is the public persistence witness; the second save restores
  // the default so the remaining #792 surface checks still see the battery.
  await page.evaluate(async () => {
    await window.__hpTest.setMode('devices');
    await window.__hpTest.openMarkerDialog('d_temp');
  });
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery').click());
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] .dialog-action-commit [data-hp="dialog-confirm"]').click());
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]')
    && !window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery'));
  await page.evaluate(() => window.__hpTest.openMarkerDialog('d_temp'));
  await page.waitForFunction(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery')?.checked === true);
  out.savedOptOutSurvivesReopen = await page.evaluate(() =>
    !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.device-battery'));
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] #marker-hide-battery').click());
  await page.evaluate(() => window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="marker"] .dialog-action-commit [data-hp="dialog-confirm"]').click());
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]')
    && !!window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery'));
  await page.evaluate(() => window.__hpTest.setMode('view'));
  out.defaultRestoredAfterSecondSave = true;

  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const secondary = document.createElement('houseplan-space-card');
    secondary.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: false, show_button: false });
    secondary.hass = window.__card.hass;
    document.body.appendChild(secondary);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot
    ?.querySelector('[data-id="d_temp"] .device-battery'));
  await setBatteryState(page, '5');
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot
    ?.querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'low');
  out.staticCardLiveStatesFalseUpdatesBattery = (await batteryGeometry(page)).state === 'low';
  out.staticCardHasNoInteractiveBattery = await page.evaluate(() => {
    const node = document.querySelector('houseplan-space-card').shadowRoot.querySelector('[data-id="d_temp"]');
    return getComputedStyle(node.querySelector('.device-battery')).pointerEvents === 'none'
      && !node.querySelector('.device-battery [tabindex],.device-battery [title],.device-pulse,.activity-dot');
  });
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());

  // LED owns the physical representation; hide its geometry to restore the normal icon.
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    spaces: cfg.spaces.map(space => space.id === 'f1' ? { ...space,
      led_strips: [{ id: 'battery-led', marker: 'd_light1', active: true, points: [[0.61, 0.7], [0.82, 0.7]] }],
    } : space),
  })));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('.led-strip[data-led-strip="battery-led"]'));
  out.ledHasNoBattery = await page.evaluate(() => !window.__card.shadowRoot
    .querySelector('[data-id="d_light1"] .device-battery'));
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    spaces: cfg.spaces.map(space => space.id === 'f1' ? { ...space,
      led_strips: space.led_strips.map(strip => ({ ...strip, active: false })),
    } : space),
  })));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_light1"] .device-battery'));
  out.hiddenLedRestoresBattery = true;

  // A point outside the old shell is visually occupied, but is not a new click target.
  const desktopInput = await batteryInputProbe(page);
  out.desktopBatteryFrameIsPassive = desktopInput.passive;
  out.desktopBatteryPointIsVisibleAndOutsideOldHitArea = desktopInput.visible && desktopInput.outsideOldHitArea;
  const point = desktopInput.point;
  out.batteryDoesNotExpandHitCapsule = await page.evaluate(point => {
    const root = window.__card.shadowRoot;
    const target = root.elementFromPoint(point.x, point.y);
    return !!target && !target.closest('[data-hp="device"][data-id="d_temp"]')
      && !root.querySelector('[data-id="d_temp"] .device-battery [tabindex]')
      && !root.querySelector('[data-id="d_temp"] .device-battery [title]');
  }, point);
  const mouseEvents = await captureBatteryPointerDown(page);
  await page.mouse.click(point.x, point.y);
  out.trustedMouseStartsThroughBattery = batteryPointerReachedPlan(await mouseEvents(), 'mouse');
  await page.evaluate(() => window.__hpTest.settled());
  out.batteryClickDoesNotOpenCard = await page.evaluate(() => !window.__card.shadowRoot
    .querySelector('hp-dialog[data-kind="info"],hp-dialog[data-kind="marker"]'));

  const flat = await batteryGeometry(page);
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
  const iso = await batteryGeometry(page);
  const isoInput = await batteryInputProbe(page);
  out.isoBatteryFrameIsPassive = isoInput.passive;
  out.isoBatteryPointIsVisibleAndOutsideOldHitArea = isoInput.visible && isoInput.outsideOldHitArea;
  out.isoKeepsScreenFacingBattery = iso.battery.x > iso.shell.right
    && Math.abs(iso.battery.width - iso.battery.height) <= 0.8
    && Math.abs(iso.battery.y + iso.battery.height / 2 - iso.shell.y - iso.shell.height / 2) <= 0.8;
  await page.evaluate(() => window.__hpTest.setVolumetricView(false));
  const flatAgain = await batteryGeometry(page);
  out.viewSwitchDoesNotDriftBattery = Math.abs(flat.battery.x - flatAgain.battery.x) <= 1
    && Math.abs(flat.battery.y - flatAgain.battery.y) <= 1;

  // Trusted touch begins on painted battery ink. The plan must still pan.
  await page.setViewportSize({ width: 430, height: 820 });
  await page.evaluate(() => window.__hpTest.settled());
  const mobile = await batteryGeometry(page);
  const mobileInput = await batteryInputProbe(page);
  out.mobileBatteryFrameIsPassive = mobileInput.passive;
  out.mobileBatteryPointIsVisibleAndOutsideOldHitArea = mobileInput.visible && mobileInput.outsideOldHitArea;
  const touchPoint = mobileInput.point;
  const touchEvents = await captureBatteryPointerDown(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchPoint, id: 1 }] });
  for (let step = 1; step <= 5; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: touchPoint.x + step * 9, y: touchPoint.y + step * 3, id: 1 },
    ] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  out.trustedTouchStartsThroughBattery = batteryPointerReachedPlan(await touchEvents(), 'touch');
  await cdp.detach();
  await page.evaluate(() => window.__hpTest.settled());
  const panned = await batteryGeometry(page);
  out.touchPanStartsThroughBattery = Math.hypot(panned.core.x - mobile.core.x, panned.core.y - mobile.core.y) > 15;
  out.touchPanDoesNotOpenInfo = await page.evaluate(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="info"]'));
  // Positive control: no-dialog checks cannot pass merely because the scene
  // stopped accepting input. Re-measure after the pan and use a trusted click.
  await page.mouse.click(panned.core.x + panned.core.width / 2, panned.core.y + panned.core.height / 2);
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-dialog[data-kind="info"]'));
  out.coreStillOpensInfoAfterBatteryPan = true;
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' }));
  checkAll(out);
} catch (error) {
  check('batterySmokeCompleted', false);
  out.error = String(error?.stack || error);
}
await finish(browser, out);
