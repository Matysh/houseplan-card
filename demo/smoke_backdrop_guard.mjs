// #39: large-backdrop guard on the real bundle. The probe reads header bytes
// only, so the warning must appear with ZERO createImageBitmap calls; decode
// happens exclusively after the explicit "reduced copy" choice, and its
// failure is honest — toast, clean staging, no silent fallback.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const out = {};
  const waitFor = async (predicate, timeout = 8000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };

  // счётчик decode-вызовов — главный свидетель «до выбора ничего тяжёлого»
  const realCIB = window.createImageBitmap.bind(window);
  let decodeCalls = 0;
  let decodeMode = 'real';
  window.createImageBitmap = (...args) => {
    decodeCalls++;
    if (decodeMode === 'reject') return Promise.reject(new Error('mock decode fail'));
    if (decodeMode === 'hang') return new Promise(() => {});
    return realCIB(...args);
  };

  const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const asciiBytes = (t) => [...t].map((c) => c.charCodeAt(0));
  const pngHeader = (w, h, colourType = 2) => Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), ...asciiBytes('IHDR'), ...u32(w), ...u32(h), 8, colourType, 0, 0, 0, ...u32(0),
    ...u32(0), ...asciiBytes('IEND'), ...u32(0),
  ]);
  const fileOf = (bytes, name, type) => new File([bytes], name, { type });
  const pick = (file) => card._pickPlanFile({ target: { files: [file], value: 'x' } });
  // диалог пространства — тоже hp-dialog: гард ищем по СВОЕМУ заголовку
  const guardDialog = () => [...card.renderRoot.querySelectorAll('hp-dialog')]
    .find((d) => {
      const title = String(d.title || '');
      return title === card._t('backdrop.large_title')
        || title === card._t('backdrop.too_large_title');
    }) || null;
  const dialogText = () => {
    const dialog = guardDialog();
    return dialog ? (dialog.textContent || '') + ' ' + (dialog.title || '') : '';
  };
  const guardButtons = () => [...(guardDialog()?.querySelectorAll('.row button') || [])];

  // редакторский диалог пространства должен существовать как поверхность
  await card._ensureEditorRuntime();
  card._spaceDialog = {
    mode: 'edit', spaceId: card._space, title: 'smoke', planUrl: null, planFile: null,
    source: 'file', showBorders: true, showNames: true, zeroWallStyle: 'auto',
    displayTouched: false, hideDecor: false, hideOpenings: false, roomColor: '#888888',
    roomOpacity: 0.2, bgColor: null, bgMode: null, northDeg: null, sunRays: null,
    fillMode: 'none', customFill: null, glowEnabled: true, tempMin: 18, tempMax: 28,
    showLqi: false, cardFontScale: 1, labelTemp: false, labelHum: false, labelLqi: false,
    labelLight: false, cellCm: 50, busy: false,
  };
  card.requestUpdate(); await card.updateComplete;

  // ── AC1: warn по заголовку 10000×10000 без единого decode ─────────────────
  await pick(fileOf(pngHeader(10000, 10000), 'huge.png', 'image/png'));
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  out.warnDialogShown = !!card._backdropGuard && dialogText().includes('10000×10000');
  out.warnShowsMemory = dialogText().includes(card._t('backdrop.large_title'))
    && /\d+ (MB|МБ)/.test(dialogText());
  out.noDecodeBeforeChoice = decodeCalls === 0;

  // ── AC3: «Оставить оригинал» — паритет b64 со старым циклом ──────────────
  const originalBytes = pngHeader(10000, 10000);
  let bin = '';
  for (let i = 0; i < originalBytes.length; i += 32768) {
    bin += String.fromCharCode(...originalBytes.subarray(i, i + 32768));
  }
  const legacyB64 = btoa(bin);
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.keep_original')))?.click();
  out.keepOriginalSetsPlanFile = await waitFor(() =>
    card._spaceDialog?.planFile?.b64 === legacyB64 && !card._backdropGuard);
  out.keepOriginalKeepsName = card._spaceDialog?.planFile?.name === 'huge.png';
  out.b64ParityWithLegacyLoop = card._spaceDialog?.planFile?.b64 === legacyB64;
  card._spaceDialog = { ...card._spaceDialog, planFile: null };

  // ── AC2: настоящая уменьшенная копия (опак 6200² JPEG → jpg 4096) ────────
  const src = new OffscreenCanvas(6200, 6200);
  const ctx = src.getContext('2d');
  ctx.fillStyle = '#c81e1e'; ctx.fillRect(0, 0, 6200, 6200);
  ctx.fillStyle = '#1e50c8'; ctx.fillRect(100, 100, 3000, 3000);
  const bigBlob = await src.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const bigFile = new File([bigBlob], 'scan.jpg', { type: 'image/jpeg' });
  await pick(bigFile);
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  out.realWarnShown = card._backdropGuard?.probe?.kind === 'warn';
  const beforeReduce = decodeCalls;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  out.reducedApplied = await waitFor(() =>
    !!card._spaceDialog?.planFile && !card._backdropGuard, 15000);
  out.decodeExactlyOnce = decodeCalls === beforeReduce + 1;
  const reduced = card._spaceDialog?.planFile;
  out.reducedExtJpg = reduced?.ext === 'jpg' && /-reduced\.jpg$/.test(reduced?.name || '');
  const reducedDims = await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => resolve([0, 0]);
    image.src = `data:image/jpeg;base64,${reduced?.b64}`;
  });
  out.reducedTo4096 = reducedDims[0] === 4096 && reducedDims[1] === 4096;
  card._spaceDialog = { ...card._spaceDialog, planFile: null };

  // ── alpha-ветка: PNG с alpha остаётся PNG ────────────────────────────────
  const alphaSrc = new OffscreenCanvas(6200, 6200);
  const alphaCtx = alphaSrc.getContext('2d');
  alphaCtx.fillStyle = 'rgba(200,30,30,0.5)'; alphaCtx.fillRect(0, 0, 6200, 3100);
  const alphaBlob = await alphaSrc.convertToBlob({ type: 'image/png' });
  await pick(new File([alphaBlob], 'plan.png', { type: 'image/png' }));
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  out.alphaStaysPng = await waitFor(() =>
    card._spaceDialog?.planFile?.ext === 'png'
    && /-reduced\.png$/.test(card._spaceDialog?.planFile?.name || ''), 15000);
  card._spaceDialog = { ...card._spaceDialog, planFile: null };

  // ── AC4 фаза 1: >16384 — только «Отмена», decode не растёт ───────────────
  const beforeHard = decodeCalls;
  await pick(fileOf(pngHeader(20000, 20000), 'giant.png', 'image/png'));
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  out.hardDialogShown = card._backdropGuard?.probe?.kind === 'hard'
    && dialogText().includes(card._t('backdrop.too_large_title'));
  out.hardHasOnlyCancel = guardButtons().length === 1
    && guardButtons()[0].textContent.includes(card._t('btn.cancel'));
  guardButtons()[0]?.click();
  await waitFor(() => !card._backdropGuard);
  out.hardLeavesEverything = !card._spaceDialog.planFile && decodeCalls === beforeHard;

  // ── AC4б фаза 2а: decode reject → тост, staging чист, оригинал не грузился ─
  decodeMode = 'reject';
  await pick(bigFile);
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  out.phase2RejectToast = await waitFor(() =>
    card._toast === card._t('backdrop.downscale_failed') && !card._backdropGuard);
  out.phase2RejectCleanStaging = !card._spaceDialog.planFile;

  // ── AC4б фаза 2б: вечный decode + короткий таймаут ───────────────────────
  decodeMode = 'hang';
  window.__HP_BACKDROP_TIMEOUT_MS = 60;
  card._toast = '';
  await pick(bigFile);
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  out.phase2TimeoutToast = await waitFor(() =>
    card._toast === card._t('backdrop.downscale_failed') && !card._backdropGuard, 5000);
  out.phase2CleanStaging = !card._spaceDialog.planFile;
  delete window.__HP_BACKDROP_TIMEOUT_MS;
  decodeMode = 'real';

  // ── повторный выбор после отказа работает (инпут сбрасывается всегда) ────
  await pick(fileOf(pngHeader(10000, 10000), 'huge.png', 'image/png'));
  out.repickReopensGuard = await waitFor(() => !!card._backdropGuard);
  guardButtons().find((b) => b.textContent.includes(card._t('btn.cancel')))?.click();
  await waitFor(() => !card._backdropGuard);

  // ── AC5: SVG идёт мимо probe и мимо decode ───────────────────────────────
  const beforeSvg = decodeCalls;
  const svg = new File([`<svg xmlns="http://www.w3.org/2000/svg" width="99999" height="99999"/>`],
    'plan.svg', { type: 'image/svg+xml' });
  await pick(svg);
  out.svgBypassesGuard = await waitFor(() =>
    card._spaceDialog?.planFile?.ext === 'svg' && !card._backdropGuard);
  out.svgNoDecode = decodeCalls === beforeSvg;

  window.createImageBitmap = realCIB;
  card._spaceDialog = null;
  card._backdropGuard = null;
  return out;
});
checkAll(out);
await finish(browser, out);
