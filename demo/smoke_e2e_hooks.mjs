// #1011: real controls/results through the declared DOM contract. Fixture
// delivery uses the harness facade; no private card state is assigned.
import { launch, checkAll, finish } from './serve.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { makeDeviceContactsFixture } from './golden/device-contacts.mjs';

const { page, browser } = await launch({ width: 1400, height: 1000 });
const out = {};
try {
  const previewText = '{"format":"houseplan-support-package","version":1}\n';
  const assetId = 'b'.repeat(64);
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  await page.route(`**/api/houseplan/content/assets/_/${assetId}.svg`, route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><path fill="blue" d="M0 0H40V30H0Z"/></svg>',
  }));
  await page.evaluate(async ({ previewText, sha, version }) => {
    const old = window.__card, parent = old.parentElement;
    const config = { ...old._config }, hass = old.hass, original = hass.callWS.bind(hass);
    const style = old.style.cssText;
    old.remove();
    const card = document.createElement('houseplan-card');
    card.style.cssText = style;
    parent.style.maxWidth = 'none';
    card.setConfig(config);
    window.__supportSubmissions = 0;
    card.hass = { ...hass, callWS: async message => {
      if (message.type === 'houseplan/config/get') return { ...await original(message),
        integration_version: version, support_api: 1, support_package_versions: [1], summary_panel_api: 1, decor_assets_api: 1 };
      if (message.type === 'houseplan/assets/resolve' || message.type === 'houseplan/assets/list') return {
        assets: [{ asset_id: 'b'.repeat(64), name: 'Synthetic image', mime: 'image/svg+xml',
          width: 40, height: 30, bytes: 100, url: `/api/houseplan/content/assets/_/${'b'.repeat(64)}.svg` }],
      };
      if (message.type === 'auth/sign_path') return { path: message.path };
      if (message.type === 'houseplan/content/sign') return { urls: Object.fromEntries(message.paths.map(path => [path, path])) };
      if (message.type === 'houseplan/support/preview') return {
        text: previewText, size: new TextEncoder().encode(previewText).length,
        expires_in: 300, spaces: 1, token: 'a'.repeat(48), sha256: sha,
        version: 1, format: 'houseplan-support-package',
      };
      if (message.type === 'houseplan/support/submit') {
        window.__supportSubmissions++; throw new Error('This smoke never sends feedback');
      }
      return original(message);
    } };
    window.__card = card; parent.appendChild(card);
    await card.updateComplete;
  }, { previewText, sha: createHash('sha256').update(previewText).digest('hex'),
    version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version });
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('ha-card[data-hp-state="ready"]')
    && window.__card.renderRoot.querySelector('[data-hp="settings"]'));
  Object.assign(out, await page.evaluate(async () => {
    const c = window.__card, hp = window.__hpTest, root = c.renderRoot;
    const q = selector => root.querySelector(selector);
    const o = { releaseDoesNotInstallFacade: hp.preinstalled === false };
    const settle = () => hp.settled();
    const wait = async predicate => {
      const end = performance.now() + 7000;
      while (!predicate() && performance.now() < end) {
        await new Promise(r => setTimeout(r, 30)); await settle();
      }
      return !!predicate();
    };
    const fields = dialog => {
      const missing = [];
      const inspect = surface => {
        for (const element of surface.querySelectorAll('input,select,textarea,button,ha-switch,ha-slider,ha-icon-picker,hp-color-opacity')) {
          const hook = element.getAttribute('data-hp');
          if (!hook || (hook === 'field' && !element.getAttribute('data-field'))) {
            missing.push(`${element.localName}#${element.id}: ${element.outerHTML.slice(0, 300)}`);
          }
          // Only House Plan owns these component internals. HA internals are
          // deliberately outside the contract, even in this synthetic harness.
          if (element.localName === 'hp-color-opacity' && element.shadowRoot) inspect(element.shadowRoot);
        }
        for (const child of surface.querySelectorAll('hp-zigbee-topology-settings')) if (child.shadowRoot) inspect(child.shadowRoot);
      };
      inspect(dialog);
      if (missing.length) throw new Error(`unhooked controls: ${missing.join(', ')}`);
      return dialog.querySelectorAll('[data-hp="field"]').length > 0;
    };
    const reveal = async control => {
      const section = control.closest('[data-settings-section]');
      if (section) control.closest('hp-dialog').querySelector(`[data-hp="settings-section"][data-section="${section.getAttribute('data-settings-section')}"]`)?.click();
      await settle();
    };
    const discard = async dialog => {
      const result = await hp.close(dialog, { via: 'cancel' });
      if (result.confirm) {
        result.confirm.querySelector('[data-hp="dialog-confirm"]').click(); await settle();
      }
      return !dialog.isConnected;
    };
    await hp.setVolumetricView(false);
    await hp.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, summary_panel: {
        version: 1, title: 'E2E hooks summary', show_on_mobile: true,
        blocks: [{ id: 'hooks', title: 'Hooks', visible: true, scope: { type: 'all' }, values: [
          { id: 'hooks-count', label: 'Devices', source: { type: 'system', key: 'device_count' } },
        ] }],
      } };
    });
    const current = q('[data-hp="space-tab"][aria-current="page"]');
    const spaceId = current.getAttribute('data-space');
    o.spaceIdentity = !!spaceId && current.getAttribute('data-id') === spaceId;
    const roomId = c._serverCfg.spaces.find(s => s.id === spaceId).rooms.find(r => r.id).id;

    // Four real forms: changed drafts still leave through their actual
    // confirmation lifecycle, and none of those drafts reaches saved config.
    const before = JSON.stringify(c._serverCfg);
    for (const family of ['general', 'space', 'room', 'marker']) {
      let dialog;
      if (family === 'general') { q('[data-hp="settings"]').click(); await settle(); dialog = q('hp-dialog[data-kind="settings"]'); }
      if (family === 'space') dialog = await hp.openSpaceDialog('edit', spaceId);
      if (family === 'room') { await hp.setMode('plan'); dialog = await hp.openRoomEdit(roomId); }
      if (family === 'marker') { await hp.setMode('devices'); dialog = await hp.openMarkerDialog('d_lamp'); }
      if (family === 'room') {
        const fill = dialog.querySelector('[data-hp="field"][data-field="rfill"]');
        fill.value = 'custom'; fill.dispatchEvent(new Event('change', { bubbles: true })); await settle();
        o.roomCustomColour = !!dialog.querySelector('[data-hp="field"][data-field="room-fill-color"]');
        const mode = dialog.querySelector('[data-field="room-name-color-mode"]');
        mode.value = 'own'; mode.dispatchEvent(new Event('change',{bubbles:true})); await settle();
        o.roomCaptionOwnHook = !!dialog.querySelector('[data-field="room-name-color"]');
      }
      if (family === 'space') {
        o.spaceColourIdentities = ['space-border-color','space-name-color','space-wall-fill']
          .every(id=>!!dialog.querySelector(`[data-hp="field"][data-field="${id}"]`));
      }
      if (family === 'general') o.retiredWallFillAbsent = !dialog.querySelector('[data-field="gs-wall-fill"]');
      if (family === 'marker') {
        const display = dialog.querySelector('[data-hp="field"][data-field="marker-display"]');
        display.value = 'icon_ripple'; display.dispatchEvent(new Event('change', { bubbles: true })); await settle();
        o.markerRippleColour = !!dialog.querySelector('[data-hp="field"][data-field="marker-activity-color"]');
        const source = dialog.querySelector('[data-hp="field"][data-field="marker-state-source"]');
        await reveal(source); source.click(); await settle();
        const candidate = dialog.querySelector('[data-hp="field-option"][data-field="marker-state-source"]:not([data-value=""])');
        candidate.click(); await settle();
        const mode = dialog.querySelector('[data-hp="field"][data-field="marker-state-source-mode"]');
        mode.value = 'states'; mode.dispatchEvent(new Event('change', { bubbles: true })); await settle();
        const manual = dialog.querySelector('[data-hp="field"][data-field="marker-active-state"]');
        // One ordinary paste input, like Playwright fill; this proof concerns
        // the bound manual control, not the facade's same-turn key burst.
        manual.value = 'standby';
        manual.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', data: 'standby', bubbles: true, composed: true }));
        await settle(); o.manualStateInput = manual.value === 'standby';
      }
      o[`${family}:allControlsHooked`] = fields(dialog);
      if (family === 'general') {
        const picker = dialog.querySelector('hp-color-opacity[data-hp="field"]');
        await reveal(picker);
        picker.shadowRoot.querySelector('[data-hp="field"][data-field="colour-open"]').click(); await settle();
        o.colourFields = ['colour-hue', 'colour-saturation', 'colour-brightness', 'colour-hex', 'colour-sv']
          .every(id => !!picker.shadowRoot.querySelector(`[data-hp="field"][data-field="${id}"]`));
        picker.shadowRoot.querySelector('[data-hp="action"][data-action="colour-confirm"]').click(); await settle();
      }
      const id = { general: 'gs-glow-radius', space: 'space-title', room: 'room-name', marker: 'marker-name' }[family];
      const control = dialog.querySelector(`[data-hp="field"][data-field="${id}"]`);
      await reveal(control);
      await hp.input(control, family === 'general' ? '4' : `Hook ${family}`);
      o[`${family}:inputUsesControl`] = control.value === (family === 'general' ? '4' : `Hook ${family}`);
      if (family === 'space') o.spaceDeleteHook = !!dialog.querySelector('[data-hp="space-delete"]');
      o[`${family}:cancelDiscards`] = await discard(dialog);
    }
    o.settingsDraftsNotSaved = JSON.stringify(c._serverCfg) === before;
    await hp.setMode('view');

    // Camera metadata comes from the actual SVG owner. A native wheel updates
    // viewBox/CTM later in the smoke, rather than trusting a copied scale field.
    const stage = q('[data-hp="stage"]');
    const matrix = stage.getScreenCTM(), vb = stage.viewBox.baseVal;
    const p = new DOMPoint(vb.x + Number(stage.dataset.gridStep), vb.y + Number(stage.dataset.gridStep));
    const roundTrip = p.matrixTransform(matrix).matrixTransform(matrix.inverse());
    o.gridUsesRealCoordinates = Number(stage.dataset.gridStep) > 0 && Math.abs(roundTrip.x - p.x) < 1e-7
      && Math.abs(roundTrip.y - p.y) < 1e-7;
    await hp.setMode('plan'); await hp.setTool('select');
    o.nodeIdentity = await wait(() => !!q('[data-hp="wall-node"][data-node]'));
    o.nodeState = ['idle', 'captured', 'preview', 'invalid'].includes(q('[data-hp="wall-node-layer"]')?.dataset.state);
    await hp.setTool('resize');
    const room = q(`[data-hp="room"][data-id="${roomId}"]`);
    room.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); await settle();
    o.resizeIdentity = await wait(() => !!q('[data-hp="room-resize"][data-room][data-edge]'));
    await hp.setMode('devices');
    o.deviceTools = !!q('[data-hp="tool"][data-tool="device-magnets"]') && !!q('[data-hp="tool"][data-tool="led-strip"]');
    o.historyActions = ['undo', 'redo'].every(id => !!q(`[data-hp="device-history"][data-action="${id}"]`));
    q('[data-hp="tool"][data-tool="device-inbox"]').click(); await settle();
    const catalog = q('hp-dialog[data-kind="device-inbox"]');
    const catalogRow = catalog.querySelector('[data-hp="device-catalog-row"]');
    o.catalogIdentity = !!catalogRow?.dataset.id;
    const tab = catalog.querySelector('[data-hp="field-option"][data-field="device-catalog-tab"][data-value="placed"]');
    tab?.click(); await settle();
    o.catalogSelection = !!catalog.querySelector('[data-hp="device-catalog-select-all"]')
      && [...catalog.querySelectorAll('[data-hp="device-catalog-select"]')].every(input => input.dataset.id === input.closest('[data-hp="device-catalog-row"]').dataset.id);
    await hp.close(catalog, { via: 'cancel' });
    await hp.setMode('view');

    q('[data-hp="pdf"]').click(); await settle();
    const pdfHost = q('hp-pdf-dialog');
    const pdfDialog = pdfHost?.shadowRoot?.querySelector('hp-dialog[data-kind="pdf"]') || q('hp-dialog[data-kind="pdf"]');
    const option = pdfDialog.querySelector('[data-hp="field"][data-field="pdf-dimensions"]');
    const old = option.checked; option.click(); await settle();
    o.pdfOption = option.checked !== old && fields(pdfDialog);
    await hp.close(pdfDialog, { via: 'cancel' });

    q('[data-hp="support"]').click(); await settle();
    const support = q('hp-dialog[data-kind="support"]');
    o.supportFields = fields(support);
    const attach = support.querySelector('[data-hp="field"][data-field="support-attach"]');
    if (!attach.checked) { attach.click(); await settle(); }
    await wait(() => !!support.querySelector('[data-hp="action"][data-action="support-preview"]'));
    const preview = support.querySelector('[data-hp="action"][data-action="support-preview"]');
    if (preview) { preview.click(); await settle(); }
    o.supportPreview = !!preview && !!support.querySelector('[data-hp="field"][data-field="support-preview-text"]');
    await hp.close(support, { via: 'cancel' });
    o.feedbackNotSent = window.__supportSubmissions === 0;
    const toggle = q('[data-hp="summary-toggle"]');
    if (toggle.getAttribute('aria-pressed') !== 'true') { toggle.click(); await settle(); }
    o.summaryResult = await wait(() => !!q('[data-hp="summary-panel"] [data-hp="summary-metric"][data-id="hooks-count"]'));
    q('[data-hp="summary-settings"]').click(); await settle();
    const summary = q('hp-dialog[data-kind="summary"]');
    o.summarySettings = !!summary;
    await hp.close(summary, { via: 'cancel' });
    return o;
  }));
  Object.assign(out, await page.evaluate(async ({ contacts, assetId }) => {
    const c = window.__card, hp = window.__hpTest, root = c.renderRoot;
    const q = selector => root.querySelector(selector), o = {};
    const wait = async predicate => {
      const end = performance.now() + 7000;
      while (!predicate() && performance.now() < end) {
        await new Promise(r => setTimeout(r, 30)); await hp.settled();
      }
      return !!predicate();
    };
    const first = c._serverCfg.spaces[0], area = first.rooms.find(r => r.area).area;
    window.__addRegistryEntity('vacuum.hooks', area, 'cleaning', 'demo', {}, { friendly_name: 'Hooks vacuum' });
    window.__addRegistryEntity('camera.hooks_map', area, 'idle', 'demo', {}, {
      vacuum_position: { x: 500, y: 600, a: 0 }, map_name: 'hooks',
      path: [[300, 400], [400, 500], [500, 600]],
    });
    c.hass = { ...c.hass, entities: { ...c.hass.entities, ...window.__mkHass().entities },
      states: { ...c.hass.states, ...window.__mkHass().states } };
    const imageUrl = `/api/houseplan/content/assets/_/${assetId}.svg`;
    await hp.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, glow_radius_cm: 600 };
      cfg.spaces.push(...contacts.config.spaces);
      cfg.markers = [...(cfg.markers || []), ...contacts.config.markers, {
        id: 'hooks-vacuum', binding: 'entity:vacuum.hooks', space: first.id,
        vacuum: { source: 'camera.hooks_map', trail_mode: 'always', map_routes: [
          { id: 'hooks-route', source: 'camera.hooks_map', map_id: 'hooks', space: first.id, calibration: [0.5, 0, 0, 0, 0.5, 0] },
        ] },
      }];
      const space = cfg.spaces.find(s => s.id === first.id);
      space.settings = { ...space.settings, fill_mode: 'glow' };
      space.plan_url = imageUrl; space.plan_aspect = 4 / 3;
      space.decor = [
        { id: 'hooks-line', kind: 'line', x1: .2, y1: .2, x2: .4, y2: .2 },
        { id: 'hooks-rect', kind: 'rect', x: .2, y: .3, w: .1, h: .1 },
        { id: 'hooks-ellipse', kind: 'ellipse', x: .35, y: .3, w: .1, h: .1 },
        { id: 'hooks-text', kind: 'text', x: .2, y: .5, text: 'Hooks', size_cm: 12 },
        { id: 'hooks-furniture', kind: 'furniture', x: .5, y: .3, w: .1, h: .1, symbol: 'chair' },
        { id: 'hooks-image', kind: 'image', x: .65, y: .3, w: .1, h: .1, asset_id: assetId },
      ];
    });
    await hp.setLayout(layout => ({ ...layout, ...contacts.layout,
      'hooks-vacuum': { s: first.id, x: .2, y: .25 } }));
    c.hass = { ...c.hass, states: { ...c.hass.states } }; await hp.settled();
    o.backdrop = !!q('[data-hp="backdrop"]');
    o.decorKinds = await wait(() => ['line', 'rect', 'ellipse', 'text', 'furniture', 'image'].every(kind =>
      !!q(`[data-hp="decor"][data-kind="${kind}"][data-id="hooks-${kind}"]`)));
    o.vacuumResult = await wait(() => !!q('[data-hp="vacuum-puck"][data-entity="vacuum.hooks"]')
      && !!q('[data-hp="vacuum-trail"] [data-hp="vacuum-trail-segment"][data-entity="vacuum.hooks"][data-kind="current"]'));
    o.glowIdentity = await wait(() => {
      const pools = [...root.querySelectorAll('[data-hp="glow-layer"] [data-hp="glow-pool"]')];
      return pools.length > 0 && pools.every(pool => !!c.hass.states[pool.dataset.entity]);
    });
    await hp.setMode('decor'); await hp.setTool('furniture');
    const category = q('[data-hp="furniture-category"][data-id]');
    category.click(); await hp.settled();
    const item = q('[data-hp="furniture-item"][data-id]');
    o.furnitureIdentity = !!item && item.dataset.id.length > 0;
    await hp.setTool('image');
    o.imageUpload = !!q('[data-hp="image-upload"][data-kind="decor"]');
    await hp.setTool('text'); await hp.setMode('view');

    await hp.setMode('devices');
    const vacuumDialog = await hp.openMarkerDialog('hooks-vacuum');
    const fit = vacuumDialog.querySelector('[data-hp="action"][data-action="vacuum-manual-calibrate"]');
    const pane = fit.closest('[data-settings-section]');
    vacuumDialog.querySelector(`[data-hp="settings-section"][data-section="${pane.dataset.settingsSection}"]`)?.click();
    await hp.settled(); fit.click(); await hp.settled();
    o.vacuumCalibration = !!q('[data-hp="vacuum-calibration"]') && !!q('[data-hp="vacuum-calibration-step"][data-step="manual"]');
    q('[data-hp="vacuum-calibration-action"][data-action="cancel"]').click(); await hp.settled();
    o.calibrationCancel = !q('[data-hp="vacuum-calibration"]');

    await hp.setMode('view');
    c.setConfig({ ...c._config, icon_size: 5 });
    await hp.switchSpace('golden-contacts');
    o.contactGroup = await wait(() => {
      const contour = q('[data-hp="device-contact-contour"][data-grouped="true"]');
      if (!contour) return false;
      const owner = contour.dataset.component;
      const group = [...root.querySelectorAll(`[data-hp="device"][data-hp-device-component="${owner}"]`)];
      return group.length >= 2 && group.every(d => d.hasAttribute('data-hp-device-contact'))
        && contour.closest('[data-hp="device"]').dataset.id === owner;
    });
    await hp.setMode('devices');
    return o;
  }, { contacts: makeDeviceContactsFixture(), assetId }));
  await page.locator('houseplan-card').locator('[data-hp="device"][data-id="row-designer-0"]').click();
  Object.assign(out, await page.evaluate(async () => {
    const c = window.__card, hp = window.__hpTest, root = c.renderRoot, o = {};
    await hp.settled();
    o.selectionIdentity = root.querySelector('[data-hp="device"][data-id="row-designer-0"]').dataset.selected === 'true';
    const panel = root.querySelector('[data-hp="properties-panel"]');
    if (!panel) throw new Error('native selection did not open Properties');
    const x = panel.querySelector('[data-hp="field"][data-field="properties-x"]');
    const saved = JSON.stringify(c._serverCfg), value = x.value;
    await hp.input(x, '999');
    x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await hp.settled();
    o.propertiesControl = x.value === value && JSON.stringify(c._serverCfg) === saved;
    root.querySelector('[data-hp="tool"][data-tool="device-inbox"]').click(); await hp.settled();
    const catalog = root.querySelector('hp-dialog[data-kind="device-inbox"]');
    const virtual = catalog.querySelector('[data-hp="device-catalog-row"][data-id="row-designer-0"]');
    o.virtualCatalogUsesMarkerId = !!virtual && !!virtual.querySelector('[data-hp="device-catalog-select"][data-id="row-designer-0"]');
    await hp.close(catalog, { via: 'cancel' });
    await hp.setMode('view');
    o.viewHasNoSelectedDevice = !root.querySelector('[data-hp="device"][data-selected="true"]');
    return o;
  }));
  const card = page.locator('houseplan-card');
  const stage = card.locator('[data-hp="stage"]');
  const beforeCamera = await stage.getAttribute('viewBox'), box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2);
  await page.mouse.wheel(0, -300);
  await page.waitForFunction(before => window.__card.renderRoot.querySelector('[data-hp="stage"]').getAttribute('viewBox') !== before, beforeCamera);
  out.cameraMetadataIsLive = await stage.evaluate(svg => {
    const matrix = svg.getScreenCTM(), p = new DOMPoint(svg.viewBox.baseVal.x, svg.viewBox.baseVal.y);
    const actual = p.matrixTransform(matrix).matrixTransform(matrix.inverse());
    return Number(svg.dataset.gridStep) > 0 && Math.abs(actual.x - p.x) < 1e-7 && Math.abs(actual.y - p.y) < 1e-7;
  });
  await page.evaluate(async () => { await window.__hpTest.setMode('decor'); await window.__hpTest.setTool('image'); });
  await card.locator('[data-hp="image-upload"][data-kind="decor"]').setInputFiles({
    name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image'),
  });
  const notice = card.locator('[data-hp="toast"][data-id="toast.plan_formats"]');
  await notice.waitFor();
  out.toastKeyFromRealNegativeInput = await notice.count() === 1;
  await page.evaluate(async () => { await window.__hpTest.setMode('view'); const id = window.__card.renderRoot.querySelector('[data-hp="space-tab"][aria-current="page"]')?.dataset.space; await window.__hpTest.openSpaceDialog('edit', id); });
  out.toastKeySurvivesModalRouting = await notice.count() === 1;
  await page.evaluate(async () => { await window.__hpTest.close(undefined, { via: 'cancel' }); });
  await page.setViewportSize({ width: 390, height: 884 });
  await card.locator('[data-hp="header-menu"]').click();
  out.phoneSummaryActions = await card.locator('[data-hp="header-menu-item"][data-id="summary-settings"]').count() === 1
    && await card.locator('[data-hp="header-menu-item"][data-id="summary-toggle"]').count() === 1;
  await page.keyboard.press('Escape');
  checkAll(out);
} catch (error) {
  console.error(error);
  out.completed = false;
  checkAll({ completed: false });
} finally {
  await finish(browser, out);
}
