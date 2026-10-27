// #1081/UI-036,039–043,045: native form/menu commands with real saved records.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1400, height: 1000 }, 1, [], { reducedMotion: 'reduce' });
const card = page.locator('houseplan-card');
const settle = () => page.evaluate(async () => { await window.__hpTest.waitForWrites(); await window.__hpTest.settled(); });
const saved = () => page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
const headerWidth = async (width, compact) => {
  // The demo host is 780px even on a wide viewport. Exercise both actual
  // container widths rather than assuming window width selects the tabs.
  await page.locator('#host').evaluate((host, value) => { host.style.width = `${value}px`; }, width);
  await card.locator(`[data-hp="${compact ? 'space-select' : 'space-tab'}"]`).first().waitFor();
  await settle();
};
const imageSource = async dialog => {
  const select = dialog.locator('hp-settings-select:has(select[name="space-plan-source"])');
  await select.locator('button').click(); await select.getByRole('option', { name: 'Use a floor-plan image' }).click();
};
const close = async () => {
  await page.evaluate(async () => window.__hpTest.close());
  const discard = card.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
  if (await discard.count()) await discard.click();
  await page.waitForFunction(() => ![...window.__card.renderRoot.querySelectorAll('hp-dialog')].some(dialog => !dialog.inert));
};
try {
  await page.evaluate(async () => {
    const c = window.__card, call = c.hass.callWS.bind(c.hass);
    window.__uiPlans = [];
    c.hass = { ...c.hass, callWS: async message => message.type === 'houseplan/plans/list'
      ? { plans: window.__uiPlans } : call(message) };
    await window.__hpTest.setMode('plan'); await window.__hpTest.openSpaceDialog('create');
  });
  const dialog = card.locator('hp-dialog[data-kind="space"]');
  check('space.new_starts_at_plan', await dialog.locator('[data-hp="settings-section"][data-section="basics"]').getAttribute('aria-current'), 'page');
  check('space.new_source_manual', await page.evaluate(() => window.__card._spaceDialog.source), 'draw');
  check('space.new_has_no_false_dirty', await dialog.locator('[data-hp="dialog-confirm"]').isDisabled(), true);
  await imageSource(dialog);
  check('space.empty_saved_images_disabled', await dialog.locator('[data-action="backdrop-server-plans"]').isDisabled(), true);
  check('space.no_plan_bottom_left', await dialog.locator('.hpf-plan-image').evaluate(element => getComputedStyle(element).alignItems), 'flex-end');
  await close();
  await page.evaluate(async () => { window.__uiPlans = [{ name: 'test.svg', url: '/assets/test.svg', size: 1, modified: 0, used_by: [] }]; await window.__hpTest.openSpaceDialog('create'); });
  await imageSource(dialog);
  check('space.available_saved_images_enabled', await dialog.locator('[data-action="backdrop-server-plans"]').isEnabled(), true);
  await dialog.locator('[data-section="appearance"]').click();
  await close();
  await page.evaluate(async () => { window.__uiPlans = []; await window.__hpTest.openSpaceDialog('create'); });
  check('space.reopen_resets_only_new_session', await dialog.locator('[data-section="basics"]').getAttribute('aria-current'), 'page');
  check('space.reopen_manual_source', await page.evaluate(() => window.__card._spaceDialog.source), 'draw');
  await close();
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(config => ({ ...config, spaces: [
      { id: 'ui', title: 'UI', cell_cm: 5, view_box: [0, 0, 1, 1], wall_segments: [], rooms: [] },
      { id: 'other', title: 'Other', cell_cm: 5, view_box: [0, 0, 1, 1], wall_segments: [], rooms: [] },
    ], markers: [{ id: 'v_menu', binding: 'virtual', space: 'ui', name: 'Menu device', icon: 'mdi:lamp' }] }));
    await window.__hpTest.setLayout(() => ({ v_menu: { s: 'ui', x: .4, y: .45 } }));
    await window.__hpTest.setMode('devices');
  });
  await card.locator('[data-hp="zoom-fit"]').click(); await settle();
  const device = card.locator('[data-hp="device"][data-id="v_menu"]');
  const openMenu = async () => { await device.click({ button: 'right' }); await card.locator('[data-hp="device-context-menu"]').waitFor(); };
  await openMenu();
  check('device.menu_four_ordered_commands', await card.locator('[data-hp="device-context-menu"] [role="menuitem"]').allTextContents(), ['Open settings', 'Copy device', 'Hide', 'Delete']);
  await card.locator('[data-action="device-context-visibility"]').click(); await settle();
  check('device.hide_saved', (await saved()).markers.find(marker => marker.id === 'v_menu').hidden, true);
  await card.locator('[data-hp="hidden-devices"]').click(); await settle();
  check('device.hidden_single_gray_dot', await device.locator('.newdot').count(), 1);
  check('device.hidden_exact_gray', await device.locator('.newdot').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(158, 158, 158)');
  await openMenu(); check('device.hidden_menu_show', await card.locator('[data-action="device-context-visibility"]').textContent(), 'Show on plan');
  await card.locator('[data-action="device-context-visibility"]').click(); await settle();
  check('device.show_saved', (await saved()).markers.find(marker => marker.id === 'v_menu').hidden, false);
  check('device.show_removes_gray_dot', await device.locator('.hiddendot').count(), 0);
  await openMenu(); await card.locator('[data-action="device-context-delete"]').click();
  const confirm = card.locator('hp-dialog[data-kind="confirm"]'); await confirm.waitFor();
  check('device.confirm_uses_shared_compact_shell', await confirm.evaluate(element => ['compact', 'form-shell', 'settings-layout', 'wide'].every(name => element.hasAttribute(name))), true);
  check('device.confirm_fits_560', (await confirm.locator('.surface').boundingBox()).width <= 560, true);
  await confirm.locator('.btn[data-hp="dialog-cancel"]').click(); await settle();
  check('device.cancel_keeps_target', (await saved()).markers.some(marker => marker.id === 'v_menu'), true);
  await page.evaluate(async () => { await window.__hpTest.setTool('device-inbox'); });
  check('catalog.duplicate_hidden_control_removed', await card.locator('[data-field="device-catalog-show-all"]').count(), 0);
  await close();
  await headerWidth(1200, false);
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.hdr').getBoundingClientRect().width > 1024
    && window.__card.renderRoot.querySelectorAll('[data-hp="space-tab"]').length === 2);
  for (const mode of ['plan', 'devices', 'decor', 'view']) {
    await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
    check(`${mode}.space_cursor`, await card.locator('[data-hp="space-tab"]').first().evaluate(element => getComputedStyle(element).cursor), mode === 'view' ? 'pointer' : 'grab');
  }
  await headerWidth(780, true);
  for (const mode of ['plan', 'devices', 'decor', 'view']) {
    await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
    check(`${mode}.compact_has_no_reorder_tabs`, await card.locator('[data-hp="space-tab"]').count(), 0);
    check(`${mode}.compact_space_cursor`, await card.locator('[data-hp="space-select"] [data-hp="select-trigger"]')
      .evaluate(element => getComputedStyle(element).cursor), 'pointer');
  }
  await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.openSpaceDialog('edit', 'ui'); });
  await dialog.locator('[data-hp="space-delete"]').click();
  const blocked = dialog.locator('.hpf-callout:has([data-action="space-delete-devices"])');
  await blocked.waitFor();
  check('space.blocker_square', await blocked.evaluate(element => getComputedStyle(element).borderRadius), '0px');
  check('space.blocker_action_own_line', await blocked.locator('[data-action="space-delete-devices"]').evaluate(element => getComputedStyle(element).display === 'flex' && getComputedStyle(element).marginTop === '12px'), true);
  check('space.blocker_does_not_delete', (await saved()).spaces.length, 2);
  await close();
  await page.evaluate(() => window.__hpTest.setServerConfig(config => ({ ...config, spaces: config.spaces.slice(0, 1) })));
  await headerWidth(1200, false);
  for (const mode of ['plan', 'devices', 'decor', 'view']) {
    await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
    check(`${mode}.single_space_cursor`, await card.locator('[data-hp="space-tab"]').first().evaluate(element => getComputedStyle(element).cursor), 'pointer');
  }
} catch (error) {
  console.log('ui1081.failure', await page.evaluate(() => ({ spaceDialog: window.__card._spaceDialog, mode: window.__card._mode,
    dialogs: [...window.__card.renderRoot.querySelectorAll('hp-dialog')].map(dialog => ({ kind: dialog.dataset.kind, inert: dialog.inert })) })));
  throw error;
} finally { await finish(browser); }
