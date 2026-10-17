import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launch, requirePinnedBrowser, checkAll, finish } from './serve.mjs';

requirePinnedBrowser('smoke_support_diagnostics');
const { page, browser } = await launch({ width: 1100, height: 950 });
const output = new URL('../artifacts/support-diagnostics/', import.meta.url);
mkdirSync(output, { recursive: true });
const requests = [];
await page.exposeFunction('buildSupportV2Fixture', payload => {
  requests.push(structuredClone(payload));
  return JSON.parse(execFileSync(process.env.PYTHON || 'python3',
    [fileURLToPath(new URL('./helpers/support-v2-fixture.py', import.meta.url))],
    { input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 }));
});

// Setup only via the public config/HA boundary. Private fields are read-only
// observations, never a shortcut past boot or the form lifecycle.
const mount = async versions => page.evaluate(async versions => {
  const old = document.querySelector('houseplan-card');
  const hass = old.hass, original = hass.callWS.bind(hass);
  const parent = old.parentElement, cfg = { ...old._config, language: 'en' };
  old.remove();
  const card = document.createElement('houseplan-card');
  window.__supportVersions = versions;
  window.__supportCalls = []; window.__supportSent = []; window.__supportFail = false;
  card.setConfig(cfg);
  card.hass = { ...hass, callWS: async message => {
    if (message.type === 'houseplan/config/get') return { ...await original(message),
      support_api: 1, support_package_versions: window.__supportVersions };
    if (!message.type.startsWith('houseplan/support/')) return original(message);
    window.__supportCalls.push(structuredClone(message));
    if (message.type === 'houseplan/support/preview') {
      if (window.__supportFail) throw { code: 'support_unavailable' };
      const pair = await original({ type: 'houseplan/config/get' });
      const positions = await original({ type: 'houseplan/layout/get' });
      const preview = await window.buildSupportV2Fixture({ request: message, config: pair.config, layout: positions.layout,
        config_rev: pair.rev, layout_rev: positions.rev });
      if (window.__supportDefer) await new Promise(resolve => { window.__supportRelease = resolve; });
      return preview;
    }
    if (message.type === 'houseplan/support/submit') {
      window.__supportSent.push(message); return { report_id: 'hpr-942-smoke' };
    }
    return { ok: true };
  } };
  parent.append(card);
  for (let i = 0; i < 500; i++) {
    if (card._loadOk && card._renderDeviceSnapshot && card.renderRoot.querySelector('.support-button')) break;
    await new Promise(r => setTimeout(r, 20));
  }
  if (!card._loadOk) throw new Error('cold public mount did not load');
  card.renderRoot.querySelector('.support-button').click();
  for (let i = 0; i < 100 && !card.renderRoot.querySelector('.supportattach input'); i++) await new Promise(r => setTimeout(r, 20));
  const attach = card.renderRoot.querySelector('.supportattach input');
  if (!attach) throw new Error('Help did not open');
  const defaults = !attach.checked && window.__supportCalls.length === 0;
  attach.click();
  for (let i = 0; i < 500 && card._supportDialog?.status === 'building'; i++) await new Promise(r => setTimeout(r, 20));
  await card.updateComplete;
  if (card._supportDialog?.status !== 'ready') throw new Error('preview failed: ' + JSON.stringify(card._supportDialog));
  return { defaults, version: card._supportDialog.preview.version,
    categories: card.renderRoot.querySelectorAll('.supportcoverage li').length,
    text: card.renderRoot.querySelector('.supportattach').textContent };
}, versions);

const initial = await mount([1, 2]);
const results = { consentOff: initial.defaults, realBuilderV2: initial.version === 2,
  closedCategories: initial.categories === 4, extendedConsent: initial.text.includes('extended diagnostics') };
for (const width of [1100, 360]) {
  await page.setViewportSize({ width, height: 950 });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(async theme => {
      const card = document.querySelector('houseplan-card');
      card.style.setProperty('--primary-background-color', theme === 'dark' ? '#171717' : '#ffffff');
      card.style.setProperty('--card-background-color', theme === 'dark' ? '#202126' : '#ffffff');
      card.style.setProperty('--primary-text-color', theme === 'dark' ? '#eeeeee' : '#171717');
      card.style.setProperty('--secondary-text-color', theme === 'dark' ? '#a3a3a3' : '#646464');
      await card.updateComplete;
      card.renderRoot.querySelector('.supportcoverage').scrollIntoView({ block: 'center' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, theme);
    const layout = await page.evaluate(() => {
      const root = document.querySelector('houseplan-card').renderRoot;
      const dialog = root.querySelector('#support-dialog'), body = dialog.querySelector('.supportbody');
      return { noOverflow: dialog.scrollWidth <= dialog.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1,
        partial: root.querySelector('.supportcoverage').textContent.includes('Partial') };
    });
    results[`layout-${width}-${theme}`] = layout.noOverflow && layout.partial;
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-${theme}.png`, output)) });
  }
}
const expected = await page.evaluate(() => document.querySelector('houseplan-card')._supportDialog.preview);
const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => {
  const root = document.querySelector('houseplan-card').renderRoot;
  [...root.querySelectorAll('.supportpreview button')].find(button => button.textContent.trim() === 'Download JSON').click();
})]);
const bytes = readFileSync(await download.path());
results.v2DownloadExact = bytes.toString('utf8') === expected.text
  && bytes.length === expected.size && createHash('sha256').update(bytes).digest('hex') === expected.sha256;
Object.assign(results, await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card'), root = card.renderRoot;
  const area = root.querySelector('#support-message');
  area.value = 'Synthetic report'; area.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await card.updateComplete;
  const preview = card._supportDialog.preview;
  const submit = root.querySelector('[data-hp="dialog-confirm"]');
  const enabled = !submit.disabled;
  submit.click();
  for (let i = 0; i < 100 && card._supportDialog?.status !== 'success'; i++) await new Promise(r => setTimeout(r, 20));
  return { exactPreviewToken: enabled && window.__supportSent.length === 1 && window.__supportSent[0].preview_token === preview.token,
    requestCarriesOnlyV2Input: window.__supportCalls[0].package_version === 2 && window.__supportCalls[0].diagnostics.schema === 1 };
}));
assert.equal(requests.length, 1);
writeFileSync(new URL('synthetic-request.json', output), JSON.stringify(requests[0], null, 2));
await page.setViewportSize({ width: 1100, height: 950 });
const legacy = await mount(undefined);
results.legacyNegotiation = legacy.version === 1 && legacy.categories === 0 && legacy.text.includes('Attach');
Object.assign(results, await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card'), root = card.renderRoot;
  const request = window.__supportCalls[0];
  const legacyRequest = !('package_version' in request) && !('diagnostics' in request);
  const warning = root.textContent.includes('Limited diagnostics');
  const pair = await card.hass.callWS({ type: 'houseplan/config/get' });
  window.__supportVersions = [1, 2];
  window.__pushServerConfig(pair.config);
  for (let i = 0; i < 200 && !card._haSupportPackageVersions.includes(2); i++) await new Promise(r => setTimeout(r, 20));
  if (!card._haSupportPackageVersions.includes(2)) throw new Error('public config event did not adopt upgraded capability');
  [...root.querySelectorAll('.supportpreview button')].find(button => button.textContent.trim() === 'Refresh snapshot').click();
  for (let i = 0; i < 500 && card._supportDialog?.status === 'building'; i++) await new Promise(r => setTimeout(r, 20));
  await card.updateComplete;
  const refreshed = window.__supportCalls.filter(call => call.type === 'houseplan/support/preview').at(-1);
  const pinnedConsent = card._supportDialog?.preview?.version === 1 && !('package_version' in refreshed);
  root.querySelector('.supportattach input').click();
  await card.updateComplete;
  root.querySelector('.supportattach input').click();
  for (let i = 0; i < 500 && card._supportDialog?.status === 'building'; i++) await new Promise(r => setTimeout(r, 20));
  await card.updateComplete;
  const newConsent = card._supportDialog?.preview?.version === 2;
  root.querySelector('.supportattach input').click();
  await card.updateComplete;
  window.__supportFail = true;
  root.querySelector('.supportattach input').click();
  for (let i = 0; i < 100 && card._supportDialog?.status === 'building'; i++) await new Promise(r => setTimeout(r, 20));
  await card.updateComplete;
  return { oldBackendLimited: legacyRequest && warning,
    refreshCannotExpandConsent: pinnedConsent && newConsent,
    failedBuildCannotSendAttachment: card._supportDialog?.status === 'error' && !card._supportDialog.preview };
}));
Object.assign(results, await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card'), root = card.renderRoot;
  const until = async (predicate, label) => {
    for (let i = 0; i < 500; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('close-during-build: ' + label);
  };
  root.querySelector('#support-dialog [data-hp="dialog-cancel"]').click();
  await until(() => !card._supportDialog, 'close prior draft');
  root.querySelector('.support-button').click();
  await until(() => root.querySelector('.supportattach input'), 'open fresh draft');
  window.__supportFail = false;
  window.__supportDefer = true;
  root.querySelector('.supportattach input').click();
  await until(() => window.__supportRelease && card._supportDialog?.status === 'building', 'pending preview');
  root.querySelector('#support-dialog [data-hp="dialog-cancel"]').click();
  await until(() => root.querySelector('hp-confirm [data-hp="dialog-confirm"]'), 'busy confirmation');
  window.__supportRelease();
  await until(() => card._supportDialog?.status === 'ready', 'preview completed before decision');
  const token = card._supportDialog.preview.token;
  const discardedBeforeClose = window.__supportCalls.filter(call =>
    call.type === 'houseplan/support/preview/discard' && call.token === token).length;
  root.querySelector('hp-confirm [data-hp="dialog-confirm"]').click();
  await until(() => !card._supportDialog, 'confirmed close');
  await until(() => window.__supportCalls.filter(call => call.type === 'houseplan/support/preview/discard'
    && call.token === token).length > discardedBeforeClose, 'latest token discarded');
  return { closeDiscardsPreviewFinishedDuringConfirmation: window.__supportCalls.filter(call =>
    call.type === 'houseplan/support/preview/discard' && call.token === token).length === discardedBeforeClose + 1 };
}));
checkAll(results);
await finish(browser, results);
