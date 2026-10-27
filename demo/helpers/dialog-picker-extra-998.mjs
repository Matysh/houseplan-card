import assert from 'node:assert/strict';
import { expect } from 'playwright/test';

/** Additional real dialogs for #998. Only server fixtures are supplied; every
 * opening, option selection and dismissal uses the existing rendered controls. */
export async function runExtraPickerSweep(page, rows) {
  const card = page.locator('houseplan-card');
  const settle = () => page.evaluate(() => window.__hpTest.settled());
  const assetId = 'b'.repeat(64);
  const assetUrl = `/api/houseplan/content/assets/_/${assetId}.svg`;
  await page.route(`**${assetUrl}`, route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30"><path fill="#718B82" d="M0 0H40V30H0Z"/></svg>' }));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(async ({ assetId, assetUrl }) => {
    await window.__addRegistryEntity('sensor.picker_998', null, '22.4', 'demo', {},
      { friendly_name: 'Picker sweep temperature', unit_of_measurement: '°C', device_class: 'temperature' });
    const card = window.__card, original = card.hass.callWS.bind(card.hass);
    // Transport-only asset/capability fixture, following smoke_e2e_hooks.
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'houseplan/config/get') return { ...await original(message),
        summary_panel_api: 1, decor_assets_api: 1 };
      if (message.type === 'houseplan/assets/list' || message.type === 'houseplan/assets/resolve') return {
        assets: [{ asset_id: assetId, name: 'Picker sweep.svg', mime: 'image/svg+xml',
          width: 40, height: 30, bytes: 100, url: assetUrl, used_by: [] }],
      };
      if (message.type === 'auth/sign_path') return { path: message.path };
      if (message.type === 'houseplan/content/sign') return {
        urls: Object.fromEntries(message.paths.map(path => [path, path])),
      };
      return original(message);
    } };
    await window.__hpTest.setServerConfig(config => {
      config.spaces = [...config.spaces, { id: 'picker-998', title: 'Picker sweep', cell_cm: 5,
        rooms: [], wall_segments: [], view_box: [0, 0, 1, 1], plan_aspect: 1,
        plan_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e7edef"/></svg>'),
        settings: { hide_decor: false },
        partitions: [{ id: 'picker-wall', a: [.1, .4], b: [.7, .4], cm: 12 }],
        wall_columns: [{ id: 'picker-column', shape: 'square', center: [.25, .25], cm: 30, angle: 0 }],
        stairs: [{ id: 'picker-stair', kind: 'straight', x: .65, y: .6, length: .2, width: .1,
          angle: 0, direction: 'forward', target_space_id: config.spaces[0].id }],
        decor: [
          { id: 'picker-image', kind: 'image', x: .15, y: .55, w: .2, h: .15, asset_id: assetId, opacity: 1 },
          { id: 'picker-furniture', kind: 'furniture', x: .4, y: .55, w: .15, h: .1, symbol: 'sofa', opacity: 1 },
          { id: 'picker-text', kind: 'text', x: .3, y: .8, text: 'Temperature', size_cm: 20 },
        ],
      }];
      config.settings = { ...config.settings, summary_panel: { version: 1, title: 'Picker summary',
        show_on_mobile: true, blocks: [{ id: 'picker-block', title: 'Devices', visible: true,
          scope: { type: 'space', space_id: 'picker-998' },
          values: [{ id: 'picker-count', label: 'Devices', source: { type: 'system', key: 'device_count' } }] }] } };
      return config;
    });
    await window.__hpTest.switchSpace('picker-998');
    await window.__hpTest.setMode('plan');
  }, { assetId, assetUrl });
  await card.locator('[data-hp=zoom-fit]').click();
  await settle();
  const stored = () => page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
  const before = await stored();

  const inspect = async (name, dialog, widths = [1280, 390]) => {
    await expect(dialog).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 }); await settle();
      const controls = dialog.locator('hp-settings-select').filter({ visible: true });
      const count = await controls.count();
      assert.ok(count > 0, `${name}: expected a real select field`);
      for (let index = 0; index < count; index++) {
        const control = controls.nth(index), native = control.locator('select');
        const trigger = control.locator('[data-hp=select-trigger]');
        const value = await native.inputValue();
        const field = await native.evaluate((node, index) => node.dataset.field || node.id || node.getAttribute('aria-label') || `select-${index}`, index);
        assert.equal(await trigger.isDisabled(), await native.isDisabled());
        if (await trigger.isDisabled()) { rows.push({ name, width, field, disabled: true }); continue; }
        await trigger.scrollIntoViewIfNeeded();
        await expect.poll(async () => (await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        assert.equal(await trigger.evaluate(node => getComputedStyle(node).borderTopLeftRadius), '8px');
        await trigger.click();
        const menu = control.locator('[role=listbox]');
        await expect(menu).toBeVisible();
        await expect.poll(() => menu.evaluate(node => {
          const b = node.getBoundingClientRect();
          return b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1;
        })).toBe(true);
        assert.equal(await menu.evaluate(node => getComputedStyle(node).borderTopLeftRadius), '10px');
        await page.keyboard.press('Escape');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused(); await expect(dialog).toBeVisible();
        assert.equal(await native.inputValue(), value, `${name}/${field}: Escape retains value`);
        const alternate = await native.locator('option').evaluateAll((options, value) =>
          options.find(option => !option.disabled && !option.closest('optgroup')?.disabled && option.value !== value)?.value ?? null, value);
        await trigger.click();
        if (alternate !== null) {
          await menu.locator(`[role=option][data-id=${JSON.stringify(alternate)}]`).click();
          await expect(native).toHaveValue(alternate);
          await trigger.click();
          await menu.locator(`[role=option][data-id=${JSON.stringify(value)}]`).click();
        } else await menu.locator('[role=option][aria-selected=true]').click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        assert.equal(await native.inputValue(), value);
        rows.push({ name, width, field, value, disabled: false, alternate, restored: true });
      }
      assert.deepEqual(await dialog.locator('select').evaluateAll(nodes => nodes.filter(node =>
        node.getBoundingClientRect().width > 1 && !node.closest('hp-settings-select')).map(node => node.id)), [], `${name}: no visible native select`);
      console.log(`PASS #998 extra ${name}/${width}: ${count} fields`);
    }
    await dialog.locator('[slot=footer] [data-hp=dialog-cancel]').last().click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 1000 }); await settle();
  };

  await card.locator('[data-hp=wall-column][data-id=picker-column]').dblclick();
  await inspect('physical-column', card.locator('hp-dialog[data-kind=physical]'));
  await card.locator('[data-hp=stair][data-id=picker-stair] .hp-stair-hit').dblclick();
  await inspect('stairs-kind-target', card.locator('hp-dialog[data-kind=stairs]'));
  await page.evaluate(() => window.__hpTest.setMode('decor'));
  await card.locator('[data-hp=zoom-fit]').click(); await settle();
  for (const name of ['image', 'furniture']) {
    if (name === 'furniture') {
      const hit = card.locator('[data-hp=decor][data-id=picker-furniture].dfurniturehit');
      const point = await hit.evaluate(path => {
        const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
        return { x: p.x, y: p.y };
      });
      await page.mouse.dblclick(point.x, point.y);
    } else await card.locator(`[data-hp=decor][data-id=picker-${name}]`).dblclick();
    await inspect(`decor-${name}`, card.locator('hp-dialog[data-kind=decor]'));
  }
  // The standard demo host is 780px wide even in a desktop viewport. Properties
  // intentionally requires a >=960px card; widen only the harness host here.
  await page.addStyleTag({ content: '#host{width:100%;max-width:none;padding:0;margin:0;box-sizing:border-box}' });
  const panel = card.locator('[data-hp=properties-panel]');
  await expect(panel).toBeVisible();
  await card.locator('[data-hp=zoom-fit]').click(); await settle();
  await card.locator('[data-hp=decor][data-id=picker-text]').click();
  await expect(panel.locator('textarea')).toBeVisible();
  await panel.locator('.hp-prop-variable').click();
  const variable = card.locator('hp-dialog[data-kind=properties-variable]');
  await variable.locator('.hpf-pick').click();
  await variable.locator('.hpf-cand').filter({ hasText: 'sensor.picker_998' }).click();
  // This dialog belongs to the desktop Properties panel; inline panel selects
  // deliberately remain outside the dialog-only #998 contract.
  await inspect('properties-variable-attribute', variable, [1280]);
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await card.locator('[data-hp=summary-settings]').click();
  await inspect('summary-scope-space', card.locator('hp-dialog[data-kind=summary]'));
  assert.deepEqual(await stored(), before, 'dialog selection/dismissal sweep never persists fixture changes');
  rows.push({ name: 'excluded-surfaces', exercised: false,
    surfaces: ['inline Properties selects', 'print', 'backup', 'icon rules'],
    reason: 'Not opened by this extra select sweep; no select coverage claimed.' });
}
