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
  card._haSupportApi = 1;
  const originalCallWS = card.hass.callWS.bind(card.hass);
  const calls = [];
  let submitMode = 'success';
  let previewToken = 'a';
  let deferPreviews = false;
  const pendingPreviews = [];
  const previewPayload = (tokenChar = previewToken) => ({
    text: previewText,
    size: new TextEncoder().encode(previewText).byteLength,
    expires_in: 300,
    spaces: 2,
    token: tokenChar.repeat(48),
    sha256: previewSha,
    version: 1,
    format: 'houseplan-support-package',
  });
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (!String(message.type || '').startsWith('houseplan/support/')) {
        return originalCallWS(message);
      }
      calls.push(structuredClone(message));
      if (message.type === 'houseplan/support/preview') {
        if (deferPreviews) {
          return new Promise((resolve, reject) => pendingPreviews.push({ resolve, reject }));
        }
        return previewPayload();
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
  card._adoptConfigCapabilities({ integration_version: 'mixed-release', support_api: 1 });
  const learnedCapability = card._haSupportApi === 1;
  card._adoptConfigCapabilities({ integration_version: version });
  out.capabilityAdoption = learnedCapability && card._haSupportApi === null;
  card._adoptConfigCapabilities({ integration_version: version, support_api: 1 });
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
    const pdf = button?.previousElementSibling;
    const settings = pdf?.previousElementSibling;
    await open();
    modeResults.push({
      mode,
      afterSettings: settings?.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:cog-outline',
      pdfBetween: pdf?.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:printer-outline',
      unchanged: JSON.stringify(before) === JSON.stringify({
        mode: card._mode,
        zoom: card._zoom,
        selectedDevice: card._selId,
        selectedDecor: card._decorSel,
      }),
    });
    await close();
  }
  out.modeAndOrder = modeResults.every((item) => item.afterSettings && item.pdfBetween && item.unchanged)
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
  const supportButton = root().querySelector('.support-button');
  const pdfButton = supportButton?.previousElementSibling;
  const settingsButton = pdfButton?.previousElementSibling;
  const touchRect = supportButton.getBoundingClientRect();
  const pdfRect = pdfButton?.getBoundingClientRect();
  const settingsRect = settingsButton?.getBoundingClientRect();
  const message = dialog?.querySelector('#support-message');
  const contact = dialog?.querySelector('#support-contact');
  const guide = dialog?.querySelector('#support-docs-heading + a');
  out.openIsLocal = calls.length === supportCallsBeforeOpen;
  out.aboutAndEnglishGuide = !!dialog?.querySelector('.aboutver')
    && dialog.querySelectorAll('.supportlinks a.aboutlink').length === 2
    && guide?.href.endsWith('/docs/USER-GUIDE.md');
  out.freshDefaults = dialog?.querySelector('#support-contact')?.value === ''
    && dialog?.querySelector('#support-message')?.value === ''
    && dialog?.querySelector('.supportattach input')?.checked === false;
  out.touchTarget = touchRect.width >= 44 && touchRect.height >= 44;
  out.headerActionsMatch = !!settingsRect && !!pdfRect
    && Math.abs(touchRect.width - settingsRect.width) < 0.01
    && Math.abs(touchRect.height - settingsRect.height) < 0.01
    && Math.abs(touchRect.width - pdfRect.width) < 0.01
    && Math.abs(touchRect.height - pdfRect.height) < 0.01;
  out.messageSurfaceMatchesContact = !!message && !!contact
    && getComputedStyle(message).backgroundColor === getComputedStyle(contact).backgroundColor;
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
  out.mixedReleaseCompatible = !!root().querySelector('#support-dialog .supportform')
    && !root().querySelector('#support-dialog .supportupdate');
  await close();
  card._haSupportApi = null;
  await open();
  out.oldBackendDegrades = !!root().querySelector('#support-dialog .supportupdate')
    && !root().querySelector('#support-dialog .supportform')
    && !!root().querySelector('#support-dialog .aboutver')
    && root().querySelectorAll('#support-dialog a.aboutlink').length >= 3;
  await close();
  card._haIntegrationVersion = version;
  card._haSupportApi = 1;

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
    && downloadedName === `houseplan-support-${previewSha.slice(0, 12)}.json`;

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

  await close();
  await open();
  deferPreviews = true;
  const canceledBuild = card._editorRuntime._setSupportAttachment(true);
  await until(() => pendingPreviews.length === 1
    && card._supportDialog?.status === 'building', 'deferred preview building');
  await update();
  const disabledWhileBuilding = root().querySelector('.supportattach input')?.disabled === true;
  const canceledRequest = pendingPreviews.shift();
  await card._editorRuntime._setSupportAttachment(false);
  await update();
  const hiddenImmediately = card._supportDialog?.attach === false
    && card._supportDialog?.status === 'idle'
    && card._supportDialog?.preview === null
    && !root().querySelector('.supportpreview');
  canceledRequest.resolve(previewPayload('b'));
  await canceledBuild;
  await update();
  const discardedB = calls.filter((call) => call.type === 'houseplan/support/preview/discard'
    && call.token === 'b'.repeat(48)).length;
  out.latePreviewConsentStaysRevoked = disabledWhileBuilding && hiddenImmediately
    && card._supportDialog?.attach === false
    && card._supportDialog?.status === 'idle'
    && card._supportDialog?.preview === null
    && !root().querySelector('.supportpreview')
    && discardedB === 1;

  const oldBuild = card._editorRuntime._setSupportAttachment(true);
  await until(() => pendingPreviews.length === 1, 'old preview queued');
  const oldRequest = pendingPreviews.shift();
  await card._editorRuntime._setSupportAttachment(false);
  const latestBuild = card._editorRuntime._setSupportAttachment(true);
  await until(() => pendingPreviews.length === 1, 'latest preview queued');
  const latestRequest = pendingPreviews.shift();
  latestRequest.resolve(previewPayload('c'));
  await latestBuild;
  oldRequest.resolve(previewPayload('d'));
  await oldBuild;
  await update();
  out.latestPreviewGenerationWins = card._supportDialog?.attach === true
    && card._supportDialog?.status === 'ready'
    && card._supportDialog?.preview?.token === 'c'.repeat(48)
    && calls.filter((call) => call.type === 'houseplan/support/preview/discard'
      && call.token === 'd'.repeat(48)).length === 1;

  const rejectedBuild = card._editorRuntime._refreshSupportPreview();
  await until(() => pendingPreviews.length === 1
    && card._supportDialog?.status === 'building', 'rejected stale preview queued');
  const rejectedRequest = pendingPreviews.shift();
  await card._editorRuntime._setSupportAttachment(false);
  rejectedRequest.reject({ code: 'support_rejected' });
  await rejectedBuild;
  await update();
  out.stalePreviewErrorIsIgnored = card._supportDialog?.attach === false
    && card._supportDialog?.status === 'idle'
    && card._supportDialog?.errorCode === ''
    && card._supportDialog?.preview === null
    && !root().querySelector('.supportpreview');

  const invalidBuild = card._editorRuntime._setSupportAttachment(true);
  await until(() => pendingPreviews.length === 1, 'invalid preview queued');
  pendingPreviews.shift().resolve({ ...previewPayload('0'), sha256: 'invalid' });
  await invalidBuild;
  await update();
  const validInvalidDiscarded = calls.filter(
    (call) => call.type === 'houseplan/support/preview/discard'
      && call.token === '0'.repeat(48),
  ).length === 1;

  const malformedBuild = card._editorRuntime._refreshSupportPreview();
  await until(() => pendingPreviews.length === 1, 'malformed-token preview queued');
  pendingPreviews.shift().resolve({ ...previewPayload('h'), token: 'not-a-token', sha256: 'invalid' });
  await malformedBuild;
  await update();
  const malformedNotDiscarded = calls.every(
    (call) => call.type !== 'houseplan/support/preview/discard' || call.token !== 'not-a-token',
  );

  const runtime = card._editorRuntime;
  const realSupportPatch = runtime._supportPatch.bind(runtime);
  runtime._supportPatch = (candidateDraftId, patch) => patch?.status === 'ready'
    ? false : realSupportPatch(candidateDraftId, patch);
  const unadoptedBuild = runtime._refreshSupportPreview();
  await until(() => pendingPreviews.length === 1, 'unadoptable preview queued');
  pendingPreviews.shift().resolve(previewPayload('1'));
  await unadoptedBuild;
  runtime._supportPatch = realSupportPatch;
  realSupportPatch(card._supportDialog.draftId, {
    status: 'error', errorCode: 'support_rejected',
  });
  await update();
  const unadoptedDiscarded = calls.filter(
    (call) => call.type === 'houseplan/support/preview/discard'
      && call.token === '1'.repeat(48),
  ).length === 1;
  out.invalidPreviewTokenIsDiscardedExactlyOnce = validInvalidDiscarded;
  out.malformedPreviewTokenIsNotEchoed = malformedNotDiscarded;
  out.locallyUnadoptedPreviewTokenIsDiscardedExactlyOnce = unadoptedDiscarded;
  deferPreviews = false;

  await close();
  await open();
  const validationKey = card._supportDialog.idempotencyKey;
  const submitsBeforeEmptyValidation = calls.filter(
    (call) => call.type === 'houseplan/support/submit',
  ).length;
  await card._editorRuntime._submitSupport();
  await update();
  out.validationDoesNotRotateKey = card._supportDialog?.idempotencyKey === validationKey
    && card._supportDialog?.submissionFingerprint === ''
    && calls.filter((call) => call.type === 'houseplan/support/submit').length
      === submitsBeforeEmptyValidation;

  const failSubmit = async () => {
    await card._editorRuntime._submitSupport();
    await until(() => card._supportDialog?.status === 'error', 'payload submit failure');
    await update();
    return calls.findLast((call) => call.type === 'houseplan/support/submit');
  };
  submitMode = 'rate';
  await setInput('#support-message', '  First payload  ');
  const firstPayloadRequest = await failSubmit();
  await setInput('#support-message', 'First payload   ');
  const trimOnlyRequest = await failSubmit();
  await setInput('#support-message', 'Second payload');
  const changedMessageRequest = await failSubmit();
  await setInput('#support-contact', 'owner@example.test');
  const changedContactRequest = await failSubmit();
  previewToken = 'e';
  await card._editorRuntime._setSupportAttachment(true);
  const attachedRequest = await failSubmit();
  await card._editorRuntime._setSupportAttachment(false);
  previewToken = 'f';
  await card._editorRuntime._setSupportAttachment(true);
  const changedPreviewRequest = await failSubmit();
  out.idempotencyKeyFollowsEffectivePayload = firstPayloadRequest?.idempotency_key === validationKey
    && trimOnlyRequest?.idempotency_key === firstPayloadRequest?.idempotency_key
    && changedMessageRequest?.idempotency_key !== trimOnlyRequest?.idempotency_key
    && changedContactRequest?.idempotency_key !== changedMessageRequest?.idempotency_key
    && attachedRequest?.idempotency_key !== changedContactRequest?.idempotency_key
    && attachedRequest?.preview_token === 'e'.repeat(48)
    && changedPreviewRequest?.idempotency_key !== attachedRequest?.idempotency_key
    && changedPreviewRequest?.preview_token === 'f'.repeat(48)
    && firstPayloadRequest?.message === 'First payload'
    && firstPayloadRequest?.contact === '';
  await close();

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
