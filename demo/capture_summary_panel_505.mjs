/** Explicit #505 diagnostic evidence, not a golden-baseline producer or smoke. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { HA_DIALOG_PIN, prepareHaDialogAssets } from './helpers/ha-dialog-assets.mjs';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { output: join(repo, 'artifacts/summary-panel-505') };
for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index];
  if (arg === '--probe-only') options.probeOnly = true;
  else if (['--output', '--ha-cache', '--ha-wheel'].includes(arg)) {
    const value = process.argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    options[{ '--output': 'output', '--ha-cache': 'cacheDir', '--ha-wheel': 'wheelPath' }[arg]] = resolve(value);
  } else throw new Error(`Unknown option ${arg}`);
}
// Fail before the optional 124 MB download. Captures never bypass freshness.
const fingerprint = sourceFingerprint(repo);
if (!options.probeOnly) {
  const manifest = JSON.parse(readFileSync(join(repo, 'demo/srv/assets/houseplan-assets.json')));
  assert.equal(manifest.fingerprint, fingerprint, 'Stale demo bundle: run npm run bundle:sync before capturing');
}
mkdirSync(options.output, { recursive: true });
const report = {
  issue: 505, diagnosticOnly: true, platform: process.platform,
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceFingerprint: fingerprint, probeOnly: Boolean(options.probeOnly),
  haFrontend: HA_DIALOG_PIN.version, wheelSha256: HA_DIALOG_PIN.sha256,
  boundaries: 'Loopback synthetic demo only. No core/auth/HA server. Official app loader exposed at runtime; component factories/CSS unmodified.',
  comparison: 'Equivalent one block, three default system rows and one entity row. Reference row text is normalized to observed product values; reference CSS/files are unchanged. Floor-plan/fake HA chrome pixels are not parity targets.',
  captures: [],
};
const saveReport = () => writeFileSync(join(options.output, 'report.json'), JSON.stringify(report, null, 2));
const assets = await prepareHaDialogAssets(options);

async function probe() {
  const fixture = await launchHaDialogFixture({ assets });
  try {
    const { page } = fixture;
    report.chromium = fixture.browser.version();
    await page.goto(`${fixture.url}/ha505-probe.html`);
    await page.waitForFunction(() => document.querySelector('ha-dialog')?.shadowRoot?.querySelector('wa-dialog')?.shadowRoot?.querySelector('dialog')?.matches(':modal'));
    await page.waitForTimeout(300);
    const read = () => page.evaluate(() => {
      const ha = document.querySelector('ha-dialog');
      const wa = ha.shadowRoot.querySelector('wa-dialog');
      const surface = wa.shadowRoot.querySelector('dialog');
      return { width: surface.getBoundingClientRect().width, modal: surface.matches(':modal'),
        radius: getComputedStyle(surface).borderRadius, preset: ha.width,
        inheritedMd: getComputedStyle(ha).getPropertyValue('--ha-dialog-width-md') };
    });
    const small = await read();
    await page.evaluate(async () => { const ha = document.querySelector('ha-dialog'); ha.width = 'medium'; await ha.updateComplete; });
    await page.waitForTimeout(50);
    const medium = await read();
    await page.evaluate(() => document.querySelector('#parent').style.setProperty('--ha-dialog-width-md', '920px'));
    await page.waitForTimeout(50);
    const inherited = await read();
    await page.screenshot({ path: join(options.output, 'authentic-ha-width-920.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const mobile = await read();
    await page.screenshot({ path: join(options.output, 'authentic-ha-mobile-390.png') });
    assert.equal(small.width, 320); assert.equal(medium.width, 580);
    assert.equal(inherited.width, 920); assert.equal(mobile.width, 390);
    await fixture.assertClean();
    report.probe = { small, medium, inherited, mobile, provenance: fixture.provenance,
      pageErrors: fixture.errors, externalRequests: fixture.externalRequests, websocketAttempts: fixture.websocketAttempts };
    saveReport();
  } finally { await fixture.close(); }
}

const rowLabels = ['Количество устройств', 'Общая площадь комнат', 'Текущие дата и время', 'Температура кухни'];
const productConfig = {
  version: 1, title: 'Сводная информация', show_on_mobile: true,
  blocks: [{ id: 'block-1', title: 'Общее', visible: true, scope: { type: 'all' },
    values: rowLabels.map((label, index) => ({ id: `value-${index + 1}`, label,
      source: index < 3 ? { type: 'system', key: ['device_count', 'total_area', 'datetime'][index] }
        : { type: 'entity', entity_id: 'sensor.kitchen_temperature' } })) }],
};
const referenceConfig = { title: productConfig.title, showOnMobile: true, blocks: [{
  ...productConfig.blocks[0], scope: { type: 'all', spaceId: null },
  values: rowLabels.map((label, index) => ({ id: `value-${index + 1}`, label,
    source: index < 3 ? { type: 'system', key: ['device_count', 'room_area', 'date_time'][index], name: label }
      : { type: 'entity', entityId: 'sensor.kitchen_temperature' } })),
}] };
const panelCases = [
  { name: 'desktop-light', width: 1600, height: 1000, theme: 'light' },
  { name: 'desktop-dark', width: 1600, height: 1000, theme: 'dark' },
  { name: 'bottom-portrait', width: 800, height: 1100, theme: 'light' },
  { name: 'kiosk', width: 1600, height: 1000, theme: 'light', kiosk: true },
  { name: 'mobile-view', width: 390, height: 844, theme: 'light' },
];
const settingCases = ['native', 'real-ha'].flatMap((shell) => [
  { name: 'desktop', width: 1600, height: 1000 },
  { name: 'narrow-320', width: 320, height: 844 },
  { name: 'narrow-390', width: 390, height: 844 },
].flatMap((size) => ['light', 'dark'].map((theme) => ({ ...size,
  name: `settings-${shell}-${size.name}-${theme}`, theme, shell, settings: true }))));
const edgeCases = ['native', 'real-ha'].flatMap((shell) => [
  { name: `edge-${shell}-effective-zoom-200`, width: 800, height: 500,
    adaptation: '800×500 effective viewport proxy for 1600×1000 at 200%; not actual browser zoom' },
  { name: `edge-${shell}-text-200-long-de`, width: 1600, height: 1000, textSize: 32, language: 'de',
    adaptation: 'Root font-size 32px enlarged-text stress, long German entity name/id; not browser zoom' },
  { name: `edge-${shell}-text-200-long-de-390`, width: 390, height: 844, textSize: 32, language: 'de',
    adaptation: '390px plus root font-size32px and long German source' },
].map((scenario) => ({ ...scenario, shell, settings: true, theme: 'light' })));

function scenarioConfig(scenario, reference = false) {
  const config = structuredClone(reference ? referenceConfig : productConfig);
  if (scenario.language === 'de') {
    config.title = 'Zusammenfassung'; config.blocks[0].title = 'Allgemein';
    const row = config.blocks[0].values[3];
    row.label = 'Küchentemperatur und langfristiger Messwert';
    row.source = { type: 'entity', [reference ? 'entityId' : 'entity_id']:
      'sensor.kueche_erdgeschoss_langfristige_temperaturmessung_mit_besonders_langer_quellenkennung_505' };
  }
  return config;
}

async function configureProduct(page, scenario) {
  await page.waitForFunction(() => window.__card?._summary && window.__card?._model?.length > 0);
  await assertFreshDemoBundle(page, repo);
  await page.waitForFunction(() => window.__card._booting === false && !window.__card._bootFading);
  await page.evaluate(async ({ scenario, config }) => {
    const card = window.__card;
    Object.assign(document.querySelector('#host').style, { width: '100%', height: '100vh', padding: '0', margin: '0', maxWidth: 'none' });
    Object.assign(document.body.style, { margin: '0', padding: '0' });
    card.panelHost = true;
    card.setAttribute('panel-host', '');
    Object.assign(card.style, { width: '100%', height: '100%' });
    card.setConfig({ ...card._config, language: scenario.language || 'ru', kiosk: Boolean(scenario.kiosk) });
    card._serverCfg = { ...card._serverCfg, settings: { ...card._serverCfg.settings, summary_panel: config } };
    card._cfgEpoch++;
    card._haSummaryPanelApi = 1;
    card._serverCanWrite = true;
    card.narrow = scenario.width <= 450;
    const dark = scenario.theme === 'dark';
    const colors = dark ? ['#3ea6ff', '#e6e7eb', '#9aa4ad', '#202126', '#3a3d45', '#11151b', '#2b2d33']
      : ['#0b73b8', '#202124', '#5f6368', '#ffffff', '#d7d9de', '#eef1f4', '#e7eaee'];
    ['primary-color', 'primary-text-color', 'secondary-text-color', 'card-background-color', 'divider-color', 'primary-background-color', 'secondary-background-color']
      .forEach((key, index) => document.documentElement.style.setProperty(`--${key}`, colors[index]));
    document.documentElement.style.setProperty('--ha-card-background', colors[3]);
    document.documentElement.style.setProperty('--app-header-background-color', colors[3]);
    document.documentElement.style.setProperty('--app-header-text-color', colors[1]);
    document.documentElement.style.setProperty('--text-primary-color', '#ffffff');
    document.documentElement.style.colorScheme = scenario.theme;
    if (scenario.textSize) document.documentElement.style.fontSize = `${scenario.textSize}px`;
    document.body.style.background = colors[5];
    const entityId = config.blocks[0].values[3].source.entity_id;
    card.hass = { ...card.hass, language: scenario.language || 'ru', locale: { ...card.hass.locale, language: scenario.language || 'ru' },
      config: { ...card.hass.config, time_zone: 'Europe/Moscow', unit_system: { ...card.hass.config?.unit_system, length: 'm' } },
      themes: { ...card.hass.themes, darkMode: dark },
      states: { ...card.hass.states, [entityId]: { entity_id: entityId, state: '20.6', attributes: {
        friendly_name: scenario.language === 'de' ? 'Küchentemperatur im Erdgeschoss mit langfristiger Messwertüberwachung und besonders langer Quellenbezeichnung' : 'Kitchen temperature', unit_of_measurement: '°C' } } },
    };
    card._summary.updated();
    card._summary.saveLocal({ show: true });
    card.requestUpdate();
    await card.updateComplete;
    card._summary.resized();
  }, { scenario, config: scenarioConfig(scenario) });
  await page.waitForFunction(() => window.__card._booting === false && !window.__card._bootFading && window.__card._devices.length > 0);
  if (!scenario.settings) await page.locator('.summary-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);
  if (scenario.settings) {
    await page.evaluate(async () => {
      const card = window.__card;
      if (card._ensureEditorRuntime) assertRuntime(await card._ensureEditorRuntime());
      function assertRuntime(ready) { if (!ready) throw new Error('Editor runtime failed to load'); }
      await card._summary.openDialog();
      await card.updateComplete;
    });
    await page.locator('hp-dialog[data-kind="summary"] .summary-editor').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
  }
}

async function capture(scenario) {
  console.log(`Capturing ${scenario.name}`);
  const fixture = await launchHaDialogFixture({ assets, authentic: scenario.shell === 'real-ha',
    viewport: { width: scenario.width, height: scenario.height }, colorScheme: scenario.theme });
  const record = { ...scenario, files: {} };
  try {
    const { page } = fixture;
    // Let Date.now advance: the real card boot-veil quiescence uses it.
    await page.clock.setSystemTime(new Date('2026-09-09T09:00:00Z'));
    await page.goto(`${fixture.url}/product.html`);
    await configureProduct(page, scenario);
    const values = await page.evaluate((config) => config.blocks[0].values.map((value) => window.__card._summary.value(value)), scenarioConfig(scenario));
    assert.equal(values.length, 4, 'Equivalent four-row product fixture');
    record.product = await page.evaluate((settings) => {
      const root = window.__card.shadowRoot;
      const box = (node) => node ? { ...node.getBoundingClientRect().toJSON(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth } : null;
      const panel = root.querySelector('.summary-overlay');
      const hp = root.querySelector('hp-dialog[data-kind="summary"]');
      const ha = hp?.shadowRoot.querySelector('ha-dialog');
      const wa = ha?.shadowRoot.querySelector('wa-dialog');
      const surface = wa?.shadowRoot.querySelector('dialog') || hp?.shadowRoot.querySelector('.surface');
      const footer = hp?.querySelector('[slot="footer"]');
      const editor = hp?.querySelector('.summary-editor');
      const insideViewport = (node) => { const r = node?.getBoundingClientRect(); return !!r && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; };
      return { panel: box(panel), control: box(root.querySelector('.summary-control')), stage: box(root.querySelector('.stage')),
        side: panel?.classList.contains('bottom') ? 'bottom' : 'right', rows: panel?.querySelectorAll('.summary-value').length,
        settings: settings ? { surface: box(surface), editor: box(editor), footer: box(footer),
          actualHA: Boolean(wa), modal: surface?.matches(':modal'), radius: getComputedStyle(surface).borderRadius,
          border: getComputedStyle(surface).border, shadow: getComputedStyle(surface).boxShadow,
          rootFont: getComputedStyle(document.documentElement).fontSize,
          titleFont: getComputedStyle(hp.shadowRoot.querySelector('.title')).fontSize,
          sourceRows: [...editor.querySelectorAll('.summary-source')].map((node) => ({ box: box(node), text: node.textContent.trim() })),
          checks: { surfaceInsideViewport: insideViewport(surface), footerVisible: insideViewport(footer),
            editorNoHorizontalOverflow: editor.scrollWidth <= editor.clientWidth + 1,
            surfaceNoHorizontalOverflow: surface.scrollWidth <= surface.clientWidth + 1,
            footerNoHorizontalOverflow: footer.scrollWidth <= footer.clientWidth + 1 },
          close: box(ha?.shadowRoot.querySelector('ha-icon-button') || hp.shadowRoot.querySelector('.close')) } : null };
    }, Boolean(scenario.settings));
    const shot = async (side, area, locator) => {
      const name = `${scenario.name}-${side}-${area}.png`;
      if (locator) await locator.screenshot({ path: join(options.output, name) });
      else await page.screenshot({ path: join(options.output, name) });
      record.files[`${side}-${area}`] = name;
    };
    await shot('product', 'viewport');
    if (scenario.settings) await shot('product', 'dialog', page.locator(scenario.shell === 'real-ha'
      ? 'hp-dialog[data-kind="summary"] ha-dialog wa-dialog dialog' : 'hp-dialog[data-kind="summary"] .surface'));
    else {
      await shot('product', 'panel', page.locator('.summary-overlay'));
      await shot('product', 'control', page.locator('.summary-control'));
    }
    if (scenario.language === 'de') {
      await page.locator('.summary-editor').evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await shot('product', 'long-source-scrolled');
    }
    await fixture.assertClean();
    await page.addInitScript(({ config, theme, kiosk, textSize }) => {
      localStorage.setItem('houseplan-dashboard5-config', JSON.stringify(config));
      localStorage.setItem('houseplan-dashboard5-enabled', 'true');
      localStorage.setItem('houseplan-dashboard5-theme', theme);
      localStorage.setItem('houseplan-dashboard5-kiosk', String(Boolean(kiosk)));
      if (textSize) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${textSize}px`; });
    }, { config: scenarioConfig(scenario, true), theme: scenario.theme, kiosk: scenario.kiosk, textSize: scenario.textSize });
    await page.goto(`${fixture.url}/reference/index.html`);
    await page.locator('#dashboard3-panel').waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
    await page.locator('.dashboard3-value dd').evaluateAll((nodes, text) => {
      if (nodes.length !== text.length) throw new Error('Equivalent reference row count mismatch');
      nodes.forEach((node, index) => { node.textContent = text[index]; });
    }, values);
    if (scenario.settings) {
      await page.locator('.dashboard3-settings-toggle').click();
      await page.locator('.dashboard3-settings-dialog__window').waitFor({ state: 'visible' });
    }
    record.reference = await page.evaluate(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
      return { panel: box('#dashboard3-panel'), control: box('.dashboard5-summary-control'),
        dialog: box('.dashboard3-settings-dialog__window'), normalizedValueText: [...document.querySelectorAll('.dashboard3-value dd')].map((node) => node.textContent) };
    });
    await shot('reference', 'viewport');
    if (scenario.settings) await shot('reference', 'dialog', page.locator('.dashboard3-settings-dialog__window'));
    else {
      await shot('reference', 'panel', page.locator('#dashboard3-panel'));
      await shot('reference', 'control', page.locator('.dashboard5-summary-control'));
    }
    await fixture.assertClean();
    record.pageErrors = fixture.errors; record.externalRequests = fixture.externalRequests;
    record.websocketAttempts = fixture.websocketAttempts;
    report.captures.push(record); saveReport();
  } finally { await fixture.close(); }
}

try {
  await probe();
  if (!options.probeOnly) for (const scenario of [...panelCases, ...settingCases, ...edgeCases]) await capture(scenario);
  report.status = 'complete'; saveReport();
  console.log(`Diagnostic evidence: ${join(options.output, 'report.json')}`);
} catch (error) {
  report.status = 'failed'; report.error = error.stack || String(error); saveReport(); throw error;
}
