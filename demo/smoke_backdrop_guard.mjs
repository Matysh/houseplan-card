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

  // ── #427: decor source >2 MiB can still choose a reduced copy ───────────
  // The canonical asset limit forbids only the original. Trailing bytes make
  // this valid JPEG exceed the source limit without another huge allocation;
  // Chromium deliberately ignores data after JPEG EOI while decoding.
  const decorBigFile = new File([
    bigBlob, new Uint8Array(2 * 1024 * 1024 + 1),
  ], 'decor-large.jpg', { type: 'image/jpeg' });
  const realUploadDecorImage = card._editorRuntime._uploadDecorImage;
  let decorUpload = null;
  card._editorRuntime._uploadDecorImage = async (blob, name, replace) => {
    decorUpload = { blob, name, replace };
  };
  await card._editorRuntime._decorImageUpload({
    target: { files: [decorBigFile], value: 'x' },
  });
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  const decorButtons = guardButtons();
  out.decorOversizeOffersReducedWithoutOriginal = decorButtons.length === 2
    && decorButtons.some((button) => button.textContent.includes(card._t('btn.cancel')))
    && decorButtons.some((button) => button.textContent.includes(card._t('backdrop.use_downscaled')))
    && !decorButtons.some((button) => button.textContent.includes(card._t('backdrop.keep_original')));
  decorButtons.find((button) => button.textContent.includes(
    card._t('backdrop.use_downscaled'),
  ))?.click();
  out.decorOversizeUploadsReducedCopy = await waitFor(() => !!decorUpload
    && !card._backdropGuard, 15000)
    && decorUpload.blob !== decorBigFile
    && decorUpload.blob.size < decorBigFile.size
    && /-reduced\.jpg$/.test(decorUpload.name)
    && decorUpload.replace === false;
  card._editorRuntime._uploadDecorImage = realUploadDecorImage;

  await card._editorRuntime._decorImageUpload({
    target: {
      files: [fileOf(pngHeader(20000, 20000), 'decor-hard.png', 'image/png')],
      value: 'x',
    },
  });
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  const decorHardButtons = guardButtons();
  out.decorHardStillHasOnlyCancel = decorHardButtons.length === 1
    && decorHardButtons[0].textContent.includes(card._t('btn.cancel'));
  decorHardButtons[0]?.click();
  await waitFor(() => !card._backdropGuard);

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

  // ── r1-M1: dismissal во время busy не гоняет гонку с исполняющимся выбором ─
  decodeMode = 'hang';
  window.__HP_BACKDROP_TIMEOUT_MS = 400;
  card._toast = '';
  await pick(bigFile);
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  await waitFor(() => card._backdropGuard?.busy); await card.updateComplete;
  // Escape/скрим во время busy: hp-close игнорируется, диалог остаётся
  guardDialog()?.dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await card.updateComplete;
  out.busyDismissIgnored = !!card._backdropGuard && card._backdropGuard.busy;
  // а даже если гард снести силой — устаревший поток не подставит planFile
  card._backdropGuard = null; card.requestUpdate(); await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 700)); // таймаут отработал
  out.staleFlowNeverApplies = !card._spaceDialog.planFile
    && card._toast !== card._t('backdrop.downscale_failed');
  delete window.__HP_BACKDROP_TIMEOUT_MS;
  decodeMode = 'real';

  // ── AC8: EXIF-ориентация — настоящий повёрнутый JPEG (APP1 orientation 6) ─
  const exifSrc = new OffscreenCanvas(8200, 4100);
  const exifCtx = exifSrc.getContext('2d');
  exifCtx.fillStyle = '#3a7d2c'; exifCtx.fillRect(0, 0, 8200, 4100);
  const plainJpeg = new Uint8Array(await (await exifSrc.convertToBlob({
    type: 'image/jpeg', quality: 0.9,
  })).arrayBuffer());
  // APP1/Exif с единственным тегом 0x0112 (Orientation) = 6 (поворот 90° CW)
  const app1 = Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22, // APP1: длина 34 = 2 (сама длина) + 32 содержимого
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif  "
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF BE, IFD0 @8
    0x00, 0x01, // 1 тег
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation=6
    0x00, 0x00, 0x00, 0x00, // next IFD = none
  ]);
  const rotated = new Uint8Array(2 + app1.length + (plainJpeg.length - 2));
  rotated.set(plainJpeg.subarray(0, 2), 0);          // SOI
  rotated.set(app1, 2);                               // EXIF
  rotated.set(plainJpeg.subarray(2), 2 + app1.length);
  const rotatedDecoded = await realCIB(new Blob([rotated], { type: 'image/jpeg' }),
    { imageOrientation: 'from-image' });
  out.exifFixtureRotates = rotatedDecoded.width === 4100 && rotatedDecoded.height === 8200;
  rotatedDecoded.close();
  let seenOrientationOption = null;
  let exifHookCalls = 0;
  window.createImageBitmap = (source, options) => {
    decodeCalls++;
    exifHookCalls++;
    seenOrientationOption = options?.imageOrientation ?? null;
    return realCIB(source, options);
  };
  await pick(new File([rotated], 'rotated.jpg', { type: 'image/jpeg' }));
  await waitFor(() => !!card._backdropGuard); await card.updateComplete;
  // probe читает НЕповёрнутые размеры из SOF
  out.exifProbeReadsSof = card._backdropGuard?.probe?.width === 8200
    && card._backdropGuard?.probe?.height === 4100;
  guardButtons().find((b) => b.textContent.includes(card._t('backdrop.use_downscaled')))?.click();
  out.exifReduceApplied = await waitFor(() =>
    !!card._spaceDialog?.planFile && !card._backdropGuard, 15000);
  out.exifOptionPassed = seenOrientationOption === 'from-image';
  const exifDims = await new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => resolve([0, 0]);
    image.src = `data:image/jpeg;base64,${card._spaceDialog?.planFile?.b64}`;
  });
  // уменьшенная копия ПОВЁРНУТА: портрет 2048×4096, а не пейзаж
  out.exifReducedRotated = exifDims[0] === 2048 && exifDims[1] === 4096;
  card._spaceDialog = { ...card._spaceDialog, planFile: null };
  window.createImageBitmap = (...args) => {
    decodeCalls++;
    if (decodeMode === 'reject') return Promise.reject(new Error('mock decode fail'));
    if (decodeMode === 'hang') return new Promise(() => {});
    return realCIB(...args);
  };

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
