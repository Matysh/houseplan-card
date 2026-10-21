/** #977: use actual form controls, accepted fake backend and live HA ticks. */
import { mkdir } from 'node:fs/promises';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';
import { prepareGoldenScenario, resetGoldenStability } from './golden/harness.mjs';
import { DOC_SCREENSHOTS } from './docs/screenshots.mjs';
requirePinnedBrowser('icon state source form and preview');
const { page, browser } = await launch({ width: 1280, height: 1100 });
const out = {};
const root = page.locator('#host > houseplan-card');
const dialog = root.locator('hp-dialog[data-kind="marker"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => {
  await page.evaluate(async () => { await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_light1'); });
  await settingsSection(dialog, 'appearance'); await settle();
};
const explanation = () => dialog.locator('hp-device-preview').locator('[data-state-source-explanation]').textContent();
const sourcePicker = () => dialog.locator('[data-state-source] .hpf-picker').first();
const search = () => sourcePicker().locator('.hpf-panel input');
const pickSource = async id => {
  if (await dialog.locator('#marker-state-source').getAttribute('aria-expanded') !== 'true')
    await dialog.locator('#marker-state-source').click();
  await search().fill('');
  await (id ? sourcePicker().getByRole('option').filter({ hasText: `${id} · ` })
    : sourcePicker().getByRole('option').first()).click();
  await settle();
};
const state = async value => {
  await page.evaluate(value => { const c = window.__card; const id = 'binary_sensor.hp977_work';
    c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...c.hass.states[id], state: value } } };
    if (window.__mini977) window.__mini977.hass = c.hass;
  }, value); await settle();
};
const captureLayouts = async () => {
  await mkdir('demo/out/activity-preview-979', { recursive: true });
  await page.evaluate(() => window.__addRegistryEntity('binary_sensor.hp977_work', null, 'washing', 'demo',
    { device_id: 'd_light1', entity_category: 'diagnostic',
      name: 'Washing machine programme / Выполнение программы стиральной машины — extended diagnostic name' },
    { device_class: 'running' }));
  for (const [width, language, dark] of [[1280, 'en', true], [1280, 'ru', false], [720, 'en', false], [720, 'ru', true]]) {
    await page.setViewportSize({ width, height: 1600 });
    await page.evaluate(({ language, dark }) => {
      const c = window.__card;
      c.setConfig({ ...c._config, language });
      c.hass = { ...c.hass, themes: { ...c.hass.themes, darkMode: dark } };
      const vars = dark
        ? { '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad', '--card-background-color': '#202126', '--secondary-background-color': '#2b2d33', '--divider-color': '#3a3d45' }
        : { '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368', '--card-background-color': '#ffffff', '--secondary-background-color': '#e7eaee', '--divider-color': '#d7d9de' };
      for (const [key, value] of Object.entries(vars)) c.style.setProperty(key, value);
    }, { language, dark });
    await settle();
    const preview = dialog.locator('hp-device-preview');
    await preview.scrollIntoViewIfNeeded();
    out[`readableLayout${width}${language}`] = await preview.evaluate(node => {
      const sr = node.shadowRoot, stage = sr.querySelector('.previewstage').getBoundingClientRect();
      const facts = sr.querySelector('.previewfacts').getBoundingClientRect();
      const box = sr.querySelector('.previewgrid').getBoundingClientRect();
      return facts.top >= stage.bottom + 8 && Math.abs(stage.width - box.width) < 1
        && stage.height >= 168 && stage.height <= 224
        && [...sr.querySelectorAll('.previewfacts, .previewsource')].every(n => n.scrollWidth <= n.clientWidth + 1)
        && [...sr.querySelectorAll('.previewfacts b')].every(n => {
          const r = n.getBoundingClientRect(); return r.width > 250 && r.left >= facts.left - 1 && r.right <= facts.right + 1;
        })
        && !/marker\.preview\./.test(sr.textContent);
    });
    await preview.locator('.previewhead').scrollIntoViewIfNeeded();
    await dialog.locator('.surface').screenshot({ path: `demo/out/activity-preview-979/${width}-${language}-${dark ? 'dark' : 'light'}.png` });
    await dialog.locator('#marker-state-source').click();
    await search().fill('HP977_WORK');
    out[`searchLayout${width}${language}`] = await search().isVisible()
      && await sourcePicker().getByRole('option').count() === 2;
    await sourcePicker().screenshot({ path: `demo/out/activity-preview-979/source-${width}-${language}.png` });
    await search().focus(); await page.keyboard.press('Escape');
  }
  for (const [language, dark] of [['en', false], ['ru', true]]) {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.evaluate(({ language, dark }) => {
      const c = window.__card; c.setConfig({ ...c._config, language });
      c.hass = { ...c.hass, themes: { ...c.hass.themes, darkMode: dark } };
      const vars = dark ? { '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad', '--card-background-color': '#202126', '--secondary-background-color': '#2b2d33', '--divider-color': '#3a3d45' }
        : { '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368', '--card-background-color': '#ffffff', '--secondary-background-color': '#e7eaee', '--divider-color': '#d7d9de' };
      for (const [key, value] of Object.entries(vars)) c.style.setProperty(key, value);
    }, { language, dark }); await settle();
    await dialog.locator('#marker-state-source').click(); await search().fill('HP977_WORK');
    out[`searchNarrow${language}`] = await sourcePicker().evaluate(node => {
      const panel = node.querySelector('.hpf-panel'), input = panel?.querySelector('input');
      return !!input && panel.getBoundingClientRect().right <= innerWidth
        && panel.getBoundingClientRect().left >= 0 && panel.scrollWidth <= panel.clientWidth + 1
        && input.getBoundingClientRect().width >= 100
        && node.querySelectorAll('[role="option"]').length === 2;
    });
    await sourcePicker().screenshot({ path: `demo/out/activity-preview-979/source-360-${language}.png` });
    await search().focus(); await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.evaluate(() => window.__card.setConfig({ ...window.__card._config, language: 'en' }));
  await settle();
};
try {
  await page.evaluate(async () => {
    window.__addRegistryEntity('binary_sensor.hp977_work', null, 'off', 'demo', { device_id: 'd_light1', entity_category: 'diagnostic', name: 'Actual work' }, { device_class: 'running' });
    window.__addRegistryEntity('binary_sensor.hp977_foreign', null, 'on', 'demo', { device_id: 'd_temp', name: 'Actual work' }, { device_class: 'running' });
    for (let i = 0; i < 12; i++) window.__addRegistryEntity(`sensor.hp979_own_${i}`, null, 'idle', 'demo',
      { device_id: 'd_light1', entity_category: 'diagnostic', name: `Own diagnostic ${i}` }, {});
    await window.__hpTest.setServerConfig(cfg => { cfg.markers = cfg.markers.filter(m => m.id !== 'd_light1');
      cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', display: 'icon_ripple', ripple_color: '#1234ab' }); return cfg; });
  });
  await open();
  out.sourceAfterDisplay = await dialog.locator('#marker-display').evaluate(node =>
    !!node.closest('.hpf-field')?.nextElementSibling?.matches('[data-state-source]'));
  out.initialClosedNoSearch = await dialog.locator('#marker-state-source').getAttribute('aria-expanded') === 'false'
    && await search().count() === 0;
  const cleanBefore = await page.evaluate(() => JSON.stringify({ source: window.__card._markerDialog.stateSource,
    touched: window.__card._markerDialog.stateSourceTouched, saved: window.__card._serverCfg }));
  const cleanSaveDisabled = await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await dialog.locator('#marker-state-source').click();
  out.searchInsidePanel = await search().isVisible()
    && await dialog.locator('[data-state-source] > input').count() === 0
    && await sourcePicker().getByRole('option').count() > 8;
  out.ownOnly = await sourcePicker().getByRole('option').evaluateAll(nodes =>
    nodes.some(n => n.textContent.includes('binary_sensor.hp977_work · '))
      && !nodes.some(n => n.textContent.includes('binary_sensor.hp977_foreign')));
  out.autoFirst = await sourcePicker().getByRole('option').first().locator('span').textContent() === 'Auto';
  await search().fill('ACTUAL WORK');
  out.filterNameCaseInsensitive = await sourcePicker().getByRole('option').count() === 2
    && await sourcePicker().getByRole('option').last().textContent().then(s => s.includes('binary_sensor.hp977_work'));
  await search().fill('BINARY_SENSOR.HP977_WORK');
  out.filterIdCaseInsensitive = await sourcePicker().getByRole('option').count() === 2;
  await search().fill('x'.repeat(255));
  out.noMatchStillAuto = await sourcePicker().getByRole('option').count() === 1
    && await sourcePicker().getByRole('option').first().locator('span').textContent() === 'Auto';
  await search().fill('');
  out.clearRestoresOwn = await sourcePicker().getByRole('option').count() > 8;
  await search().focus(); await page.keyboard.press('Escape');
  out.escapeClosesOnlyPicker = await dialog.isVisible() && await search().count() === 0
    && await dialog.locator('#marker-state-source').evaluate(n => n.getRootNode().activeElement === n);
  out.searchDoesNotDirty = cleanSaveDisabled && await dialog.locator('[data-hp="dialog-confirm"]').isDisabled()
    && cleanBefore === await page.evaluate(() => JSON.stringify({ source: window.__card._markerDialog.stateSource,
      touched: window.__card._markerDialog.stateSourceTouched, saved: window.__card._serverCfg }));
  await pickSource('binary_sensor.hp977_work');
  out.twoClearModes = JSON.stringify(await dialog.locator('#marker-state-source-mode option').allTextContents())
    === JSON.stringify(['Automatically', 'Set manually']);
  const help = dialog.locator('hp-help[data-help-key="marker.state_source_mode_help"]');
  await help.locator('.trigger').focus(); await page.keyboard.press('Enter');
  out.autoHelpExplains = await help.locator('.tooltip').isVisible()
    && /type, class and state.*automation.*enabled/i.test(await help.locator('.tooltip').textContent());
  await page.keyboard.press('Escape');
  out.helpEscKeepsForm = !await help.locator('.tooltip').isVisible() && await dialog.isVisible();
  out.standardInactive = /Icon inactive.*off/i.test(await explanation());
  await state('on');
  out.liveActive = /Icon active.*on/i.test(await explanation());
  await dialog.locator('#marker-state-source-mode').selectOption('states');
  out.singleManualField = await dialog.locator('#marker-state-source-states input').count() === 1
    && await dialog.locator('#marker-state-source-states button, #marker-state-source-states .hpf-hint').count() === 0;
  const manualGap = await dialog.locator('#marker-state-source-states input').evaluate(input => {
    const mode = input.closest('[data-state-source]').querySelector('hp-settings-select');
    return input.getBoundingClientRect().top - mode.getBoundingClientRect().bottom;
  });
  console.log('#995 manual field gap:', manualGap);
  out.manualFieldHasFormSpacing = manualGap >= 12 && manualGap <= 24;
  out.emptyManualRejected = await dialog.locator('[data-state-source] [role="alert"]').isVisible();
  await dialog.locator('#marker-state-source-states input').fill('unknown'); await settle();
  out.reservedManualRejected = await dialog.locator('[data-state-source] [role="alert"]').isVisible();
  await dialog.locator('#marker-state-source-states input').fill('washing'); await settle();
  out.exactNonmatch = /Icon inactive/.test(await explanation());
  await state('washing'); out.exactMatch = /Icon active/.test(await explanation());
  await pickSource('binary_sensor.hp977_work');
  out.sameSourceKeepsManual = await dialog.locator('#marker-state-source-mode').inputValue() === 'states'
    && await dialog.locator('#marker-state-source-states input').inputValue() === 'washing';
  await dialog.locator('#marker-state-source-mode').selectOption('standard');
  out.automaticHidesManualField = await dialog.locator('#marker-state-source-states').count() === 0;
  await dialog.locator('#marker-state-source-mode').selectOption('states');
  await dialog.locator('#marker-state-source-states input').fill('washing');
  out.manualCanBeRestored = await dialog.locator('#marker-state-source-states input').inputValue() === 'washing';
  out.removedCurrentStateHint = await dialog.locator('#marker-state-source-states code').count() === 0;
  const preview = dialog.locator('hp-device-preview');
  out.previewFullWidthAboveFacts = await preview.evaluate(node => {
    const sr = node.shadowRoot;
    const grid = sr.querySelector('.previewgrid').getBoundingClientRect();
    const stage = sr.querySelector('.previewstage').getBoundingClientRect();
    const facts = sr.querySelector('.previewfacts').getBoundingClientRect();
    return Math.abs(grid.width - stage.width) < 1 && facts.top >= stage.bottom + 8
      && stage.height >= 168 && stage.height <= 224;
  });
  await mkdir('demo/out/marker-state-source-977', { recursive: true });
  await page.screenshot({ path: 'demo/out/marker-state-source-977/manual-en.png' });
  await captureLayouts();
  // Persist via the actual form button; fake backend acceptance is observable.
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.saved = await page.evaluate(() => {
    const m = window.__card._serverCfg.markers.find(m => m.id === 'd_light1');
    return m.state_source.entity_id === 'binary_sensor.hp977_work' && m.state_source.active_states.join() === 'washing' && m.ripple_color === '#1234ab';
  });
  await open(); await pickSource('sensor.hp979_own_0');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await root.locator('hp-confirm hp-dialog [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.cancelSelectionPreservesSaved = await page.evaluate(() => {
    const m = window.__card._serverCfg.markers.find(m => m.id === 'd_light1');
    return m.state_source.entity_id === 'binary_sensor.hp977_work' && m.state_source.active_states.join() === 'washing';
  });
  await open();
  out.reopenHasFreshPicker = await dialog.locator('#marker-state-source').getAttribute('aria-expanded') === 'false'
    && await search().count() === 0;
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  await page.evaluate(async () => {
    const c = window.__card; await window.__hpTest.setMode('view');
    await customElements.whenDefined('houseplan-space-card');
    const mini = document.createElement('houseplan-space-card'); mini.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    mini.hass = c.hass; document.body.append(mini); window.__mini977 = mini;
  }); await settle();
  await page.waitForFunction(() => window.__mini977?.renderRoot?.querySelector('[data-id="d_light1"].on'));
  out.planStaticParity = await page.evaluate(() => [window.__card, window.__mini977].every(c => c.renderRoot.querySelector('[data-id="d_light1"].on')));
  await state('unknown');
  out.unknownNoFallback = await page.evaluate(() => [window.__card, window.__mini977].every(c => !c.renderRoot.querySelector('[data-id="d_light1"].on')));
  await open(); out.unknownExplained = /Activity unknown/.test(await explanation());
  await page.evaluate(() => window.__card.setConfig({ ...window.__card._config, language: 'ru' })); await settle();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('label[for="marker-state-source"]')?.textContent === 'Источник состояния значка');
  out.ruExplained = /Активность неизвестна/.test(await explanation());
  await page.screenshot({ path: 'demo/out/marker-state-source-977/unknown-ru.png' });
  // Editing a sibling setting/Cancel must not reset accepted custom state.
  await pickSource('');
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.autoClears = await page.evaluate(() => !Object.hasOwn(window.__card._serverCfg.markers.find(m => m.id === 'd_light1'), 'state_source'));
  // #978: imported/stale own-source configuration must not expose an invalid row.
  await page.evaluate(async () => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'binary_sensor.hp977_foreign': { ...c.hass.states['binary_sensor.hp977_foreign'], state: 'FOREIGN_STATE_978' },
    } };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.markers.find(m => m.id === 'd_light1').state_source = {
        entity_id: 'binary_sensor.hp977_foreign', active_states: ['FOREIGN_STATE_978'],
      }; return cfg;
    });
  });
  await open();
  out.foreignHintHasNoState = await dialog.locator('#marker-state-source-states code').count() === 0
    && !/FOREIGN_STATE_978/.test(await dialog.locator('#marker-state-source').textContent());
  out.foreignIdStaysSelected = (await dialog.locator('#marker-state-source').textContent()).includes('binary_sensor.hp977_foreign');
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.foreignCancelPreservesBlock = await page.evaluate(() =>
    window.__card._serverCfg.markers.find(m => m.id === 'd_light1').state_source.active_states[0] === 'FOREIGN_STATE_978');
  await page.evaluate(async () => {
    window.__addRegistryEntity('binary_sensor.hp978_disabled', null, 'DISABLED_STATE_978', 'demo',
      { device_id: 'd_light1', disabled_by: 'user', entity_category: 'diagnostic' }, { device_class: 'running' });
    await window.__hpTest.setServerConfig(cfg => {
      cfg.markers.find(m => m.id === 'd_light1').state_source = {
        entity_id: 'binary_sensor.hp978_disabled', active_states: ['DISABLED_STATE_978'],
      }; return cfg;
    });
  });
  await open();
  out.disabledHintHasNoState = await dialog.locator('#marker-state-source-states code').count() === 0
    && !/DISABLED_STATE_978/.test(await dialog.locator('#marker-state-source').textContent());
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  // #979: use the real canonical docs fixture/viewport and unchanged scroller.
  // Long sources may scroll; the ordinary documentation preview must fit whole.
  const docsScene = DOC_SCREENSHOTS.find(s => s.id === 'device-display-preview');
  await page.setViewportSize(docsScene.viewport);
  await prepareGoldenScenario(page, docsScene);
  out.defaultPreviewFitsDocumentationViewport = await page.evaluate(async () => {
    const c = window.__goldenCard, d = c.renderRoot.querySelector('hp-dialog');
    d.querySelector('[data-section-target="appearance"]').click();
    await c.updateComplete;
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const scroller = d.renderRoot.querySelector('.content'), p = d.querySelector('hp-device-preview');
    await p.updateComplete;
    const a = scroller.getBoundingClientRect(), b = p.getBoundingClientRect();
    scroller.scrollTop += b.top - a.top - Math.min(180, Math.max(0, (a.height - b.height) / 2));
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const visible = p.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
    return visible.top >= viewport.top - 1 && visible.bottom <= viewport.bottom + 1;
  });
  await resetGoldenStability(page);
  out.completed = true;
} finally { checkAll(out); await finish(browser, out); }
