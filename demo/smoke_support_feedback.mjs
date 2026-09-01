import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const PREVIEW_TEXT = '{"format":"houseplan-support-package","version":1}\n';
const PREVIEW_SHA = createHash('sha256').update(PREVIEW_TEXT).digest('hex');

const { page, browser } = await launch({ width: 1000, height: 900 });
const result = await page.evaluate(async ({ version, previewText, previewSha }) => {
  const card = window.__card;
  const root = () => card.renderRoot || card.shadowRoot;
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const until = async (predicate, label, attempts = 100) => {
    for (let index = 0; index < attempts; index++) {
      if (predicate()) return;
      await wait(10);
    }
    throw new Error(`support smoke timed out: ${label}`);
  };
  const update = async () => {
    await card.updateComplete;
    await frame();
  };
  const setInput = async (selector, value) => {
    const input = root().querySelector(selector);
    if (!input) throw new Error(`support smoke input missing: ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await update();
  };
  const close = async () => {
    await card._editorRuntime._closeSupportDialog();
    await update();
  };
  const open = async () => {
    const button = root().querySelector('.support-button');
    if (!button) throw new Error('support button missing');
    button.click();
    await until(() => !!card._supportDialog, 'dialog open');
    await update();
  };

  card._haIntegrationVersion = version;
  const originalCallWS = card.hass.callWS.bind(card.hass);
  const calls = [];
  let submitMode = 'success';
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (!String(message.type || '').startsWith('houseplan/support/')) {
        return originalCallWS(message);
      }
      calls.push(structuredClone(message));
      if (message.type === 'houseplan/support/preview') {
        return {
          text: previewText,
          size: new TextEncoder().encode(previewText).byteLength,
          expires_in: 300,
          spaces: 2,
          token: 'a'.repeat(48),
          sha256: previewSha,
          version: 1,
          format: 'houseplan-support-package',
        };
      }
      if (message.type === 'houseplan/support/submit') {
        if (submitMode === 'rate') throw { code: 'support_rate_limited' };
        if (submitMode === 'timeout') throw { code: 'support_unavailable' };
        if (submitMode === 'unknown') throw { code: 'unknown_command' };
        return { report_id: 'HP-43-SMOKE' };
      }
      return { ok: true };
    },
  };
  await update();

  const out = {};
  const modeResults = [];
  for (const mode of ['view', 'plan', 'devices', 'decor']) {
    card._setMode(mode);
    await until(() => card._mode === mode && !card._modeTransitionBusy, `mode ${mode}`);
    await update();
    const before = {
      mode: card._mode,
      zoom: card._zoom,
      selectedDevice: card._selId,
      selectedDecor: card._decorSel,
    };
    const button = root().querySelector('.support-button');
    const settings = button?.previousElementSibling;
    await open();
    modeResults.push({
      mode,
      afterSettings: settings?.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:cog-outline',
      unchanged: JSON.stringify(before) === JSON.stringify({
        mode: card._mode,
        zoom: card._zoom,
        selectedDevice: card._selId,
        selectedDecor: card._decorSel,
      }),
    });
    await close();
  }
  out.modeAndOrder = modeResults.every((item) => item.afterSettings && item.unchanged)
    && new Set(modeResults.map((item) => item.mode)).size === 4;

  const originalConfig = card._config;
  card._config = { ...card._config, kiosk: true };
  card.requestUpdate();
  await update();
  const kioskButton = root().querySelector('.support-button');
  out.kioskHidden = !kioskButton || getComputedStyle(kioskButton).display === 'none'
    || getComputedStyle(kioskButton.closest('.hdr')).display === 'none';
  card._config = originalConfig;
  card._serverCanWrite = false;
  card.requestUpdate();
  await update();
  out.readonlyAbsent = !root().querySelector('.support-button');
  card._serverCanWrite = true;
  card.requestUpdate();
  await update();

  const supportCallsBeforeOpen = calls.length;
  await open();
  const dialog = root().querySelector('#support-dialog');
  const touchRect = root().querySelector('.support-button').getBoundingClientRect();
  const guide = dialog?.querySelector('#support-docs-heading + a');
  out.openIsLocal = calls.length === supportCallsBeforeOpen;
  out.aboutAndEnglishGuide = !!dialog?.querySelector('.aboutver')
    && dialog.querySelectorAll('.supportlinks a.aboutlink').length === 2
    && guide?.href.endsWith('/docs/USER-GUIDE.md');
  out.freshDefaults = dialog?.querySelector('#support-contact')?.value === ''
    && dialog?.querySelector('#support-message')?.value === ''
    && dialog?.querySelector('.supportattach input')?.checked === false;
  out.touchTarget = touchRect.width >= 44 && touchRect.height >= 44;
  out.noHorizontalOverflow = dialog.scrollWidth <= dialog.clientWidth + 1
    && dialog.querySelector('.supportbody').scrollWidth
      <= dialog.querySelector('.supportbody').clientWidth + 1;
  await close();

  card._config = { ...card._config, language: 'ru' };
  await open();
  out.russianGuide = root().querySelector('#support-docs-heading + a')?.href
    .endsWith('/docs/USER-GUIDE.ru.md') === true;
  await close();
  card._config = { ...card._config, language: 'en' };

  card._haIntegrationVersion = '0.0.0';
  await open();
  out.oldBackendDegrades = !!root().querySelector('#support-dialog .supportupdate')
    && !root().querySelector('#support-dialog .supportform')
    && !!root().querySelector('#support-dialog .aboutver')
    && root().querySelectorAll('#support-dialog a.aboutlink').length >= 3;
  await close();
  card._haIntegrationVersion = version;

  await open();
  const submitCallsBeforeValidation = calls.filter((call) => call.type === 'houseplan/support/submit').length;
  await card._editorRuntime._submitSupport();
  await update();
  out.validation = card._supportDialog?.errorCode === 'validation.message_required'
    && root().activeElement?.id === 'support-message'
    && calls.filter((call) => call.type === 'houseplan/support/submit').length
      === submitCallsBeforeValidation;
  await setInput('#support-contact', '  user@example.test  ');
  await setInput('#support-message', '  Exact support message.  ');
  root().querySelector('.supportattach input').click();
  await until(() => card._supportDialog?.status === 'ready', 'preview ready');
  await update();
  const preview = card._supportDialog.preview;
  root().querySelector('.supportpreview summary').click();
  await update();
  out.preview = !!root().querySelector('.supportwarning')
    && root().querySelector('.supportraw')?.value === previewText
    && preview?.text === previewText
    && preview?.sha256 === previewSha
    && root().querySelector('.supporthash code')?.textContent === previewSha;

  let downloadedBlob = null;
  let downloadedName = '';
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloadedBlob = blob; return 'blob:houseplan-smoke'; };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function click() { downloadedName = this.download; };
  card._editorRuntime._downloadSupportPreview();
  const downloadedText = await downloadedBlob?.text();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  HTMLAnchorElement.prototype.click = originalAnchorClick;
  out.downloadExact = downloadedText === previewText
    && downloadedName === `houseplan-support-${'a'.repeat(12)}.json`;

  submitMode = 'success';
  root().querySelector('#support-dialog .supportfooter .btn.on').click();
  await until(() => card._supportDialog?.status === 'success', 'success submit');
  await update();
  const successRequest = calls.findLast((call) => call.type === 'houseplan/support/submit');
  out.success = root().querySelector('#support-receipt')?.textContent.includes('HP-43-SMOKE') === true
    && root().activeElement?.id === 'support-receipt'
    && successRequest?.message === 'Exact support message.'
    && successRequest?.contact === 'user@example.test'
    && successRequest?.preview_token === 'a'.repeat(48);
  await close();

  await open();
  out.freshAfterSuccess = card._supportDialog?.contact === ''
    && card._supportDialog?.message === '' && card._supportDialog?.attach === false;
  await setInput('#support-message', 'Retry this exact message.');
  const retryKey = card._supportDialog.idempotencyKey;
  submitMode = 'rate';
  root().querySelector('#support-dialog .supportfooter .btn.on').click();
  await until(() => card._supportDialog?.status === 'error', 'rate limit error');
  await update();
  const ratePreserved = card._supportDialog.message === 'Retry this exact message.'
    && !!root().querySelector('.supportmanual')
    && !root().querySelector('#support-receipt');
  submitMode = 'timeout';
  root().querySelector('#support-dialog .supportfooter .btn.on').click();
  await until(() => card._supportDialog?.errorCode === 'support_unavailable', 'timeout error');
  submitMode = 'unknown';
  root().querySelector('#support-dialog .supportfooter .btn.on').click();
  await until(() => card._supportDialog?.status === 'error', 'unknown command error');
  submitMode = 'success';
  root().querySelector('#support-dialog .supportfooter .btn.on').click();
  await until(() => card._supportDialog?.status === 'success', 'retry success');
  await update();
  const retryRequests = calls.filter((call) => call.type === 'houseplan/support/submit'
    && call.message === 'Retry this exact message.');
  out.retryAndManualRecovery = ratePreserved && retryRequests.length === 4
    && retryRequests.every((call) => call.idempotency_key === retryKey)
    && root().querySelector('#support-receipt')?.textContent.includes('HP-43-SMOKE') === true;

  return out;
}, { version: VERSION, previewText: PREVIEW_TEXT, previewSha: PREVIEW_SHA });

const responsive = async (viewport) => {
  await page.setViewportSize(viewport);
  return page.evaluate(async () => {
    const card = window.__card;
    if (card._supportDialog) await card._editorRuntime._closeSupportDialog();
    card._setMode('view');
    await card.updateComplete;
    const button = card.renderRoot.querySelector('.support-button');
    button?.click();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const dialog = card.renderRoot.querySelector('#support-dialog');
    const body = dialog?.querySelector('.supportbody');
    const footer = dialog?.querySelector('.supportfooter');
    const dialogRect = dialog?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    return !!dialog && !!body && !!footer && !!dialogRect && !!buttonRect
      && dialogRect.left >= -1 && dialogRect.right <= innerWidth + 1
      && dialogRect.top >= -1 && dialogRect.bottom <= innerHeight + 1
      && dialog.scrollWidth <= dialog.clientWidth + 1
      && body.scrollWidth <= body.clientWidth + 1
      && body.clientHeight > 0 && footer.getBoundingClientRect().height > 0
      && buttonRect.width >= 44 && buttonRect.height >= 44;
  });
};

result.phonePortrait = await responsive({ width: 320, height: 760 });
result.phoneLandscape = await responsive({ width: 760, height: 320 });

checkAll(result);
await finish(browser, result);
