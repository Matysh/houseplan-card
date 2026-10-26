/** Synthetic accepted-UI surfaces; commands enter through their native controls. */
export function addUiLab1081Fixture(fixture, scenario) {
  fixture.config.spaces.push({ id: scenario.space, title: 'UI Lab', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], decor: [] });
  fixture.config.markers.push({ id: 'ui1081-device', binding: 'virtual', space: scenario.space, name: 'Living room lamp', icon: 'mdi:lamp' });
  fixture.layout['ui1081-device'] = { s: scenario.space, x: .4, y: .45 };
}

export async function prepareUiLab1081(page, scenario) {
  const card = page.locator('houseplan-card');
  if (scenario.uiLab1081 === 'new-space') {
    await card.locator('[data-hp="space-add"]').click();
    await card.locator('hp-dialog[data-kind="space"] [data-section="basics"][aria-current="page"]').waitFor();
  } else if (scenario.uiLab1081 === 'space-blocker') {
    await page.evaluate(id => window.__hpTest.openSpaceDialog('edit', id), scenario.space);
    await card.locator('[data-hp="space-delete"]').click();
    await card.locator('[data-action="space-delete-devices"]').waitFor();
  } else if (scenario.uiLab1081 === 'grid-pan') {
    const rect = await card.locator('.stage').boundingBox(), x = rect.x + rect.width * .3, y = rect.y + rect.height * .7;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + rect.width * .22, y + 30, { steps: 8 });
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
  return { surface: scenario.uiLab1081 };
}
