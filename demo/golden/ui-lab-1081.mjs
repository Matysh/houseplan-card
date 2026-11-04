/** Synthetic accepted-UI surfaces; commands enter through their native controls. */
export function addUiLab1081Fixture(fixture, scenario) {
  fixture.config.spaces.push({ id: scenario.space, title: 'UI Lab', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], decor: [] });
  fixture.config.markers.push({ id: 'ui1081-device', binding: 'virtual', space: scenario.space, name: 'Living room lamp', icon: 'mdi:lamp' });
  fixture.layout['ui1081-device'] = { s: scenario.space, x: .4, y: .45 };
}

// Read only after the screenshot: diagnostic layout reads must not change the
// timing/raster history of the frame being judged (#1133).
export async function uiLab1081CaptureEvidence(page) {
  return page.evaluate(() => {
    const root=window.__goldenCard.renderRoot,stage=root.querySelector('.stage');
    const rect=el=>el?.getBoundingClientRect().toJSON()??null;
    const style=getComputedStyle(stage);
    return {schema:1,dpr:devicePixelRatio,stage:rect(stage),
      svg:rect(stage.querySelector('svg')),marker:rect(root.querySelector('[data-hp="device"][data-id="ui1081-device"]')),
      backgroundPosition:style.backgroundPosition,backgroundSize:style.backgroundSize,
      transform:style.transform,stageClasses:[...stage.classList].sort()};
  });
}

/** Static goldens own a complete frame while the native pan stays held. */
export async function prepareActivePanGoldenFrame(page) {
  return page.evaluate(async () => {
    const card = window.__goldenCard, press = card._panStart;
    if (!press || card._panLock !== 'pan') throw Error('Golden requires an active native pan');
    const view = JSON.stringify(card._view), config = JSON.stringify(card._serverCfg);
    // Viewport anchors refresh on a 100ms/15% budget, so an arbitrary
    // compositor projection is timing-dependent even at the same endpoint.
    // A normal full Lit frame reconciles SVG and HTML camera bases while
    // retaining the held gesture's promoted layer. No pointer release,
    // forced viewport assignment or replacement screenshot is used.
    card.requestUpdate();
    await card.updateComplete;
    if (card._panStart !== press || card._panLock !== 'pan'
        || JSON.stringify(card._view) !== view || JSON.stringify(card._serverCfg) !== config)
      throw Error('Golden full frame changed the active pan, camera or configuration');
    return { phase: 'complete-active-pan-frame', pointerHeld: true,
      cameraUnchanged: true, configUnchanged: true };
  });
}

export async function prepareUiLab1081(page, scenario) {
  const card = page.locator('houseplan-card');
  let panFrame;
  await page.waitForFunction(mode => window.__goldenCard._mode === mode, scenario.mode);
  if (scenario.uiLab1081 === 'new-space') {
    await card.locator('[data-hp="space-add"]').click();
    await card.locator('hp-dialog[data-kind="space"] [data-section="basics"][aria-current="page"]').waitFor();
  } else if (scenario.uiLab1081 === 'space-blocker') {
    // Open through the visible header gear (tab or compact picker), then exercise responsive
    // reflow. The launch facade belongs to the discarded pre-golden card.
    await page.setViewportSize({ width: 1180, height: 900 });
    const tab = card.locator(`[data-hp="space-tab"][data-id="${scenario.space}"]`).filter({ visible: true });
    if (await tab.count()) await tab.hover();
    await card.locator(`[data-hp="space-settings"][data-id="${scenario.space}"]`).filter({ visible: true }).click();
    await card.locator('[data-hp="space-delete"]').click();
    await card.locator('[data-action="space-delete-devices"]').waitFor();
    await page.setViewportSize(scenario.viewport);
  } else if (scenario.uiLab1081 === 'grid-pan') {
    const rect = await card.locator('.stage').boundingBox(), x = rect.x + rect.width * .3, y = rect.y + rect.height * .7;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + rect.width * .22, y + 30, { steps: 8 });
    panFrame = await prepareActivePanGoldenFrame(page);
  } else {
    await card.locator('[data-hp="device"][data-id="ui1081-device"]').click({ button: 'right' });
    await card.locator('[data-hp="device-context-menu"]').waitFor();
    if (scenario.uiLab1081 === 'device-confirm') {
      await card.locator('[data-action="device-context-delete"]').click();
      await card.locator('hp-dialog[data-kind="confirm"][compact] .danger-confirm-body').waitFor();
    }
  }
  if (scenario.uiLab1081 !== 'grid-pan') await page.mouse.move(4, 4);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  return { surface: scenario.uiLab1081, ...(panFrame ? { panFrame } : {}) };
}
