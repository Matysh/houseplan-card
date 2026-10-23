// #1039: centre the painted name and complete readings, not a name+action box.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchColdView, requirePinnedBrowser, check, finish, watchPage } from './serve.mjs';

requirePinnedBrowser('room metrics alignment');
const evidence = process.env.HP_ROOM_ALIGNMENT_EVIDENCE_DIR;
if (evidence) mkdirSync(evidence, { recursive: true });
const { page, browser } = await launchColdView({ width: 1000, height: 850 }, 1, [], { reducedMotion: 'reduce' });
const results = [], exports = [];
try {
  await page.evaluate(async () => {
    for (const [suffix, value, kind, unit] of [
      ['temperature', '9.5', 'temperature', '°C'],
      ['humidity', '8', 'humidity', '%'],
      ['co2', '850', 'carbon_dioxide', 'ppm'],
    ]) window.__addRegistryEntity(`sensor.alignment_${suffix}`, 'living_room', value, 'demo', {},
      { device_class: kind, unit_of_measurement: unit });
    window.__card.hass = window.__mkHass();
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces[0].rooms.forEach((r, i) => { r.name = ['Kitchen-living room', 'Sauna', 'Guest bathroom', 'A'][i] || r.name; });
      return cfg;
    });
    await document.fonts.ready;
  });
  const ready = async () => {
    await page.evaluate(() => window.__hpTest.settled());
    await page.waitForFunction(() => {
      const r = window.__card.shadowRoot, s = r.querySelector('.stage');
      return s && !r.querySelector('.bootveil') && !s.matches('.hpboot,.hpiso-pending,.mode-transition')
        && !window.__card._cameraTransition?.active;
    });
  };
  const measure = (target = page) => target.evaluate(() => {
    const box = e => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width, height: b.height, cx: (b.left + b.right) / 2 }; };
    return [...(window.__card?.shadowRoot || document).querySelectorAll('.roomlabel')].map(label => {
      const metrics = label.querySelector('.rlmetrics');
      if (!metrics) return null;
      const name = box(label.querySelector('.rlfit')), row = box(metrics), root = box(label);
      const items = [...metrics.children].map(box);
      const contentCenter = (Math.min(...items.map(b => b.left)) + Math.max(...items.map(b => b.right))) / 2;
      const action = label.querySelector('.rlarea');
      const ab = action && box(action);
      const area = !!label.querySelector('.rlgo');
      const anchor = area ? box(label.querySelector('.rlname')) : name;
      return { id: label.dataset.id, name, row, root, text: metrics.textContent.trim(), count: items.length,
        delta: Math.max(Math.abs(anchor.cx - row.cx), Math.abs(anchor.cx - contentCenter), Math.abs(anchor.cx - root.cx)),
        area, action: ab && { width: ab.width, height: ab.height, gap: ab.left - name.right } };
    }).filter(Boolean);
  });
  const saveSvg = async (label, zoom) => {
    const source = await page.evaluate(() => ({ config: JSON.stringify(window.__card._serverCfg), layout: JSON.stringify(window.__card._layout),
      labels: [...window.__card.shadowRoot.querySelectorAll('.roomlabel')].map(e => e.outerHTML),
      camera: window.__card.shadowRoot.querySelector('.plan-svg').getAttribute('viewBox') }));
    const trigger = page.locator('[data-hp="pdf"]');
    if (await trigger.isVisible()) await trigger.click();
    else { await page.locator('[data-hp="header-menu"]').click(); await page.locator('[data-hp="header-menu-item"][data-id="pdf"]').click(); }
    const dialog = page.locator('hp-pdf-dialog');
    await dialog.locator('[data-field="export-format"]').selectOption('svg');
    await dialog.locator('[data-field="svg-backdrop"]').uncheck();
    const pending = page.waitForEvent('download');
    await dialog.locator('[data-hp="dialog-confirm"]').click();
    const xml = readFileSync(await (await pending).path(), 'utf8');
    await dialog.waitFor({ state: 'detached' });
    const after = await page.evaluate(() => ({ config: JSON.stringify(window.__card._serverCfg), layout: JSON.stringify(window.__card._layout),
      labels: [...window.__card.shadowRoot.querySelectorAll('.roomlabel')].map(e => e.outerHTML),
      camera: window.__card.shadowRoot.querySelector('.plan-svg').getAttribute('viewBox') }));
    check(`${label}/${zoom}:export-read-only`, after, source);
    const standalone = await browser.newPage({ viewport: { width: 1000, height: 850 } });
    watchPage(standalone);
    let requests = 0;
    await standalone.route(/^https?:\/\//, route => { requests++; return route.abort(); });
    await standalone.goto('data:image/svg+xml;base64,' + Buffer.from(xml).toString('base64'));
    await standalone.evaluate(() => document.fonts.ready);
    const rows = await measure(standalone);
    check(`${label}/${zoom}:svg-centres`, rows.length >= 3 && rows.every(r => r.delta <= .5 && !r.area));
    check(`${label}/${zoom}:svg-content`, rows.map(r => r.text), (await measure()).map(r => r.text));
    check(`${label}/${zoom}:svg-offline`, requests, 0);
    exports.push({ label, zoom, maxDelta: Math.max(...rows.map(r => r.delta)) });
    if (label === '1000/flat-light/normal/admin' && zoom === 'zoom-in' && evidence) {
      writeFileSync(resolve(evidence, 'caption.svg'), xml);
      await standalone.screenshot({ path: resolve(evidence, 'caption-svg.png') });
    }
    await standalone.close();
  };
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 850 });
    for (const iso of [false, true]) {
      await page.evaluate(v => window.__hpTest.setVolumetricView(v), iso);
      for (const [variant, nameScale, metricScale] of [['normal', 1, 1], ['wide-readings', .6, 2.5], ['large-name', 2, .6]]) {
        await page.evaluate(async ({ nameScale, metricScale, iso }) => {
          const c = window.__card;
          c.setConfig({ type: 'custom:houseplan-card', language: 'en' });
          c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: true }, themes: { ...c.hass.themes, darkMode: iso } };
          await window.__hpTest.setServerConfig(cfg => {
            const s = cfg.spaces[0];
            s.settings = { ...s.settings, show_names: true, label_temp: true, label_hum: true, label_co2: true,
              label_lqi: true, label_light: true, card_name_scale: nameScale, card_label_scale: metricScale };
            s.rooms[0].settings = { ...s.rooms[0].settings, name_scale: nameScale, label_scale: metricScale };
            return cfg;
          });
        }, { nameScale, metricScale, iso });
        for (const zoom of ['zoom-fit', 'zoom-in']) {
          await page.evaluate(() => {
            const c = window.__card;
            c.setConfig({ type: 'custom:houseplan-card', language: 'en' });
            c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: true } };
          });
          await ready();
          await page.locator(`[data-hp="${zoom}"]`).click();
          await ready();
          for (const role of ['admin', 'viewer', 'kiosk']) {
            await page.evaluate(role => {
              const c = window.__card;
              c.setConfig({ type: 'custom:houseplan-card', language: 'en', kiosk: role === 'kiosk' });
              c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: role !== 'viewer' } };
            }, role);
            await ready();
            const label = `${width}/${iso ? 'iso-dark' : 'flat-light'}/${variant}/${role}`;
            const rows = await measure();
            results.push({ label, zoom, maxDelta: Math.max(...rows.map(r => r.delta)), rows });
            check(`${label}/${zoom}:centres`, rows.length >= 3 && rows.every(r => r.delta <= .5));
            check(`${label}/${zoom}:area-visibility`, rows.every(r => r.area === (role === 'admin')));
            check(`${label}/${zoom}:area-target`, rows.every(r => !r.action || r.action.width >= 44 && r.action.height >= 44 && r.action.gap > 0));
            // The fixture grants can_write to both users; only HA admin gets an Area action.
            if (role !== 'kiosk') await saveSvg(label, zoom);
            if (width === 1000 && !iso && variant === 'normal' && role === 'admin' && evidence) {
              await page.screenshot({ path: resolve(evidence, 'admin-flat.png') });
            }
          }
        }
      }
    }
  }
  // HA updates change reading widths without changing the caption's stored anchor.
  await page.evaluate(async () => {
    const c = window.__card;
    c.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: true } };
    await window.__hpTest.settled();
    window.__alignmentBefore = { config: JSON.stringify(c._serverCfg), layout: JSON.stringify(c._layout) };
  });
  await ready();
  const before = await measure();
  await page.evaluate(() => {
    const c = window.__card, states = { ...c.hass.states };
    for (const [suffix, state] of [['temperature', '29.7'], ['humidity', '88'], ['co2', '1487']]) {
      const id = `sensor.alignment_${suffix}`;
      states[id] = { ...states[id], state };
    }
    c.hass = { ...c.hass, states };
  });
  await ready();
  const after = await measure();
  check('live-value-really-updated', before[0].text !== after[0].text && after[0].text.includes('1487'));
  check('live-value-keeps-centre', after.every(r => r.delta <= .5));
  await saveSvg('live-update', 'final');
  check('all-five-metrics-exercised', results.some(r => r.rows.some(row => row.count === 5)));
  check('single-metric-exercised', results.some(r => r.rows.some(row => row.count === 1)));
  check('independent-scales-really-change-font', results.some(r => r.label.includes('wide-readings') && r.rows[0].row.height > r.rows[0].name.height * 2));
  check('no-config-or-layout-write', await page.evaluate(() => JSON.stringify(window.__card._serverCfg) === window.__alignmentBefore.config
    && JSON.stringify(window.__card._layout) === window.__alignmentBefore.layout));
  await finish(browser, { snapshots: results.length, svgFiles: exports.length, liveMaxDelta: Math.max(...results.map(r => r.maxDelta)),
    svgMaxDelta: Math.max(...exports.map(r => r.maxDelta)), misalignedSvg: exports.filter(r => r.maxDelta > .5).slice(0, 3) });
} catch (error) { await browser.close(); throw error; }
