// #1011: shared-template hooks must survive their real caller boundaries.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1400, height: 1000 });
const out = {};
try {
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  Object.assign(out, await page.evaluate(async () => {
    const c = window.__card, hp = window.__hpTest, root = c.renderRoot, o = {};
    const settle = () => hp.settled();
    const discard = async dialog => {
      const result = await hp.close(dialog, { via: 'cancel' });
      if (result.confirm) { result.confirm.querySelector('[data-hp="dialog-confirm"]').click(); await settle(); }
      return !dialog.isConnected;
    };
    await hp.setVolumetricView(false);
    const space = c._serverCfg.spaces[0], room = space.rooms[0], area = room.area || 'living_room';
    window.__addRegistryDevice('hooks-radar-fields', 'Synthetic radar', 'Generic radar', area);
    for (const [id, value] of [['sensor.hooks_radar_x', '1000'], ['sensor.hooks_radar_y', '2000']]) {
      window.__addRegistryEntity(id, area, value, 'demo', { device_id: 'hooks-radar-fields' }, { unit_of_measurement: 'mm' });
    }
    c.hass = { ...c.hass, entities: { ...c.hass.entities, ...window.__mkHass().entities },
      states: { ...c.hass.states, ...window.__mkHass().states } };
    await hp.setServerConfig(cfg => {
      cfg.markers.push({ id: 'hooks-radar-fields', binding: 'device:hooks-radar-fields', space: space.id, room_id: room.id,
        radar: { version: 1, enabled: true, show_live: false, profile: 'cartesian_v1', room_id: room.id,
          sources: { slots: [1, 2].map(n => ({ id: `target_${n}`, x_entity: 'sensor.hooks_radar_x', y_entity: 'sensor.hooks_radar_y',
            unit: 'mm', swap_xy: false, x_sign: 1, y_sign: 1 })) },
          mount: { installation_id: 'hooks-fields', x: .2, y: .2, heading_deg: 0, range_cm: 600, fov_deg: 120 },
          calibration: { method: 'manual', mirror: false, cell_cm: 5 } },
      });
      cfg.spaces.find(s => s.id === space.id).decor = [{ id: 'hooks-variable-text', kind: 'text', x: .5, y: .5, text: 'Hooks', size_cm: 15 }];
    });
    await hp.switchSpace(space.id); await hp.setMode('devices');
    const before = JSON.stringify(c._serverCfg);
    const dialog = await hp.openMarkerDialog('hooks-radar-fields');
    const legacy = dialog.querySelector('[data-hp="action"][data-action="radar-legacy-open"]');
    if (!legacy) throw new Error('Synthetic legacy radar link missing');
    const section = legacy.closest('[data-settings-section]');
    if (section) dialog.querySelector(`[data-hp="settings-section"][data-section="${section.dataset.settingsSection}"]`)?.click();
    legacy.click(); await settle();
    const swaps = [...dialog.querySelectorAll('[data-hp="field"][data-field="radar-swap-axes"]')];
    o.radarSlotsHaveDistinctMetadata = swaps.length === 2 && swaps.map(e => e.dataset.slot).join(',') === '0,1'
      && swaps.every(e => !e.hasAttribute('id'));
    if (swaps.length !== 2) throw new Error('Expected two real swap-axis controls');
    swaps[1].click(); await settle();
    o.radarToggleBinding = !dialog.querySelector('[data-field="radar-swap-axes"][data-slot="0"]').checked
      && dialog.querySelector('[data-field="radar-swap-axes"][data-slot="1"]').checked;
    const profile = dialog.querySelector('[data-hp="field"][data-field="radar-profile"]');
    profile.value = 'polar_v1'; profile.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    const clockwise = dialog.querySelector('[data-hp="field"][data-field="radar-angle-clockwise"]');
    const checked = clockwise.checked;
    clockwise.click(); await settle();
    o.polarToggleBinding = dialog.querySelector('[data-field="radar-angle-clockwise"]').checked !== checked && !clockwise.hasAttribute('id');
    o.radarDiscard = await discard(dialog) && JSON.stringify(c._serverCfg) === before;
    root.querySelector('[data-hp="settings"]').click(); await settle();
    const general = root.querySelector('hp-dialog[data-kind="settings"]');
    const dial = general.querySelector('[data-hp="field"][data-field$="-dial"]');
    const angle = Number(dial.getAttribute('aria-valuenow'));
    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await settle();
    o.northDialIsWorkingField = Number(general.querySelector('[data-field$="-dial"]').getAttribute('aria-valuenow')) === (angle + 1) % 360
      && !dial.hasAttribute('id');
    o.northDiscard = await discard(general) && JSON.stringify(c._serverCfg) === before;
    await hp.setMode('decor'); await hp.setTool('select');
    return o;
  }));
  const card = page.locator('houseplan-card');
  await card.locator('[data-hp="decor"][data-kind="text"][data-id="hooks-variable-text"]').click();
  await card.locator('[data-hp="action"][data-action="properties-insert-variable"]').click();
  Object.assign(out, await page.evaluate(async () => {
    const c = window.__card, hp = window.__hpTest, o = {}, before = JSON.stringify(c._serverCfg);
    const dialog = c.renderRoot.querySelector('hp-dialog[data-kind="properties-variable"]');
    const picker = dialog.querySelector('[data-hp="field"][data-field="properties-variable-entity"]');
    o.variablePickerHasMetadataOnly = !!picker && !picker.hasAttribute('id');
    picker.click(); await hp.settled();
    const filter = dialog.querySelector('[data-hp="field"][data-field="properties-variable-entity-filter"]');
    await hp.input(filter, 'hooks_radar_x');
    const candidate = dialog.querySelector('[data-hp="field-option"][data-field="properties-variable-entity"][data-value="sensor.hooks_radar_x"]');
    o.variablePickerOptions = !!candidate;
    candidate.click(); await hp.settled();
    o.variablePickerBinding = dialog.querySelector('[data-field="properties-variable-entity"]').textContent.includes('sensor.hooks_radar_x');
    dialog.querySelector('[slot="footer"] [data-hp="dialog-cancel"]').click(); await hp.settled();
    o.variableCancel = !dialog.isConnected && JSON.stringify(c._serverCfg) === before;
    return o;
  }));
  checkAll(out); await finish(browser, out);
} catch (error) { console.error(error); await browser.close(); process.exitCode = 1; }
