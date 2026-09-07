// #53: the administrator PDF surface is lazy, modal and downloads one
// parseable A4 sheet without involving the editor runtime.
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtimePath = manifest.lazyPdfFiles?.find((path) => /pdf-export-[^/]+\.js$/.test(path));
if (!runtimePath) throw new Error('PDF export chunk is absent from the bundle manifest');
const runtimeName = runtimePath.split('/').at(-1);
const runtimePattern = `**/${runtimeName}*`;
const NARROW_VIEWPORT = { width: 320, height: 760 };

const clickPrinter = (page) => page.locator('houseplan-card').evaluate((card) => {
  const root = card.shadowRoot || card.renderRoot;
  [...root.querySelectorAll('button')]
    .find((button) => button.getAttribute('aria-label') === card._t('title.export_pdf'))?.click();
});

const { page, browser } = await launchColdView(NARROW_VIEWPORT);
// The generic demo fixture deliberately has a fixed 780 px host so desktop
// geometry smokes do not inherit the viewport width. This smoke owns the phone
// contract, therefore make only its harness host behave like a real dashboard
// column before attributing document overflow to the PDF dialog.
await page.locator('#host').evaluate((host) => {
  host.style.width = '100%';
  host.style.maxWidth = '100%';
  host.style.boxSizing = 'border-box';
  host.style.margin = '0';
});
const requests = [];
page.on('request', (request) => requests.push(new URL(request.url()).pathname));
const initialResources = await page.evaluate(() => performance.getEntriesByType('resource')
  .map((entry) => new URL(entry.name).pathname));
await clickPrinter(page);
await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-pdf-dialog'));

const dialog = await page.evaluate(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const card = window.__card;
  const pdf = card.renderRoot.querySelector('hp-pdf-dialog');
  const root = pdf.shadowRoot || pdf.renderRoot;
  const shell = root.querySelector('hp-dialog');
  await shell?.updateComplete;
  const native = shell?.shadowRoot?.querySelector('dialog');
  const parent = pdf.parentNode;
  const surface = shell?.shadowRoot?.querySelector('.surface');
  const centred = () => {
    const rect = surface?.getBoundingClientRect();
    return !!rect
      && Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) <= 1
      && Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) <= 1;
  };
  const shellBeforeReconnect = native || shell?.shadowRoot?.querySelector('ha-dialog');
  pdf.remove();
  parent?.append(pdf);
  await pdf.updateComplete;
  await shell?.updateComplete;
  await frame();
  await frame();
  const shellAfterReconnect = native || shell?.shadowRoot?.querySelector('ha-dialog');
  const reconnectKeepsModalCentered = shellBeforeReconnect === shellAfterReconnect
    && (native ? native.open && native.matches(':modal') : !!shellAfterReconnect)
    && centred();
  const inputs = [...root.querySelectorAll('input[type="checkbox"]')];
  const defaults = {
    dimensions: inputs[0]?.checked,
    decor: inputs[1]?.checked,
    names: inputs[2]?.checked,
    backdrop: inputs[3]?.checked,
  };
  inputs[2]?.click(); // remember Names = false after Save
  inputs[3]?.click(); // the no-asset path keeps this smoke self-contained
  await pdf.updateComplete;
  return {
    count: inputs.length,
    expectedCount: card._spaceModel().bg ? 4 : 3,
    defaults,
    modal: native ? native.open && native.matches(':modal') : true,
    reconnectKeepsModalCentered,
    editorStillAbsent: !card._editorRuntime,
  };
});

const downloadPromise = page.waitForEvent('download');
await page.locator('houseplan-card').evaluate(() => {
  const pdf = window.__card.renderRoot.querySelector('hp-pdf-dialog');
  (pdf.shadowRoot || pdf.renderRoot).querySelector('button.primary')?.click();
});
const download = await downloadPromise;
const path = await download.path();
if (!path) throw new Error('PDF download has no temporary file');
const bytes = new Uint8Array(readFileSync(path));
const downloadedByteLength = bytes.byteLength;
const task = getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });
const document = await task.promise;
const pdfPage = await document.getPage(1);
const viewport = pdfPage.getViewport({ scale: 1 });
const text = (await pdfPage.getTextContent()).items.map((item) => item.str).join(' ');

const rasterLimitError = await page.evaluate(() => {
  try {
    window.__card._pdfRuntime.assertRasterBudget([25 * 1024 * 1024, 1]);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
});
const firstPagePdfRequests = requests.filter((requestPath) => requestPath.endsWith(`/${runtimeName}`)).length;

// The contract is persistence across a real page load, not merely reopening
// the same element instance.
await page.reload();
await page.waitForFunction(() => window.__card?.renderRoot);
await page.locator('#host').evaluate((host) => {
  host.style.width = '100%';
  host.style.maxWidth = '100%';
  host.style.boxSizing = 'border-box';
  host.style.margin = '0';
});

await clickPrinter(page);
await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-pdf-dialog'));
const rememberedNames = await page.evaluate(() => {
  const pdf = window.__card.renderRoot.querySelector('hp-pdf-dialog');
  const inputs = (pdf.shadowRoot || pdf.renderRoot).querySelectorAll('input[type="checkbox"]');
  return inputs[2]?.checked === false;
});

const narrowLocales = await page.evaluate(async () => {
  const card = window.__card;
  const expected = {
    en: { cancel: 'Cancel', save: 'Save' },
    ru: { cancel: 'Отмена', save: 'Сохранить' },
    de: { cancel: 'Abbrechen', save: 'Speichern' },
    fr: { cancel: 'Annuler', save: 'Enregistrer' },
  };
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const closeDialog = async () => {
    card._pdfDialog = false;
    card.requestUpdate();
    await settle();
  };
  const loadLanguage = async (language) => {
    card._config = { ...(card._config || {}), language };
    card.requestUpdate();
    for (let attempt = 0; attempt < 100
      && card._t('btn.cancel') !== expected[language].cancel; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  };
  const metrics = [];
  for (const language of Object.keys(expected)) {
    await closeDialog();
    await loadLanguage(language);
    card._pdfDialog = true;
    card.requestUpdate();
    await settle();

    const pdf = card.renderRoot.querySelector('hp-pdf-dialog');
    await pdf?.updateComplete;
    const root = pdf?.shadowRoot || pdf?.renderRoot;
    const shell = root?.querySelector('hp-dialog');
    await shell?.updateComplete;
    await settle();
    const surface = shell?.shadowRoot?.querySelector('.surface');
    const body = root?.querySelector('.body');
    const footer = root?.querySelector('.row');
    const buttons = [...(footer?.querySelectorAll('button') || [])];
    const surfaceRect = surface?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const innerLeft = footerRect && footerStyle
      ? footerRect.left + parseFloat(footerStyle.paddingLeft) : 0;
    const innerRight = footerRect && footerStyle
      ? footerRect.right - parseFloat(footerStyle.paddingRight) : 0;
    const buttonRects = buttons.map((button) => button.getBoundingClientRect());
    const firstBeforeSecond = buttons.length === 2
      && !!(buttons[0].compareDocumentPosition(buttons[1]) & Node.DOCUMENT_POSITION_FOLLOWING);
    const metric = {
      language,
      copy: buttons.map((button) => button.textContent.trim()),
      localized: buttons[0]?.textContent.trim() === expected[language].cancel
        && buttons[1]?.textContent.trim() === expected[language].save,
      documentWidths: {
        viewport: innerWidth,
        rootClient: document.documentElement.clientWidth,
        rootScroll: document.documentElement.scrollWidth,
        bodyClient: document.body.clientWidth,
        bodyScroll: document.body.scrollWidth,
      },
      documentFits: document.documentElement.scrollWidth
          <= document.documentElement.clientWidth + 1
        && document.body.scrollWidth <= document.body.clientWidth + 1,
      surfaceFits: !!surface && !!surfaceRect
        && surfaceRect.left >= -1 && surfaceRect.right <= innerWidth + 1
        && surface.scrollWidth <= surface.clientWidth + 1,
      bodyFits: !!body && body.scrollWidth <= body.clientWidth + 1,
      footerFits: !!footer && footer.scrollWidth <= footer.clientWidth + 1,
      buttonsContained: !!footerRect && buttonRects.length === 2
        && buttonRects.every((rect) => rect.left >= innerLeft - 1
          && rect.right <= innerRight + 1
          && rect.top >= footerRect.top - 1 && rect.bottom <= footerRect.bottom + 1),
      targetsAtLeast44: buttonRects.length === 2
        && buttonRects.every((rect) => rect.width >= 44 && rect.height >= 44),
      stacked: buttonRects.length === 2 && buttonRects[1].top >= buttonRects[0].bottom - 1,
      domAndFocusOrderPreserved: firstBeforeSecond
        && buttons.every((button) => button.tabIndex === 0),
      cancelCloses: false,
    };
    buttons[0]?.click();
    await settle();
    metric.cancelCloses = !card.renderRoot.querySelector('hp-pdf-dialog');
    metrics.push(metric);
  }
  await closeDialog();
  return metrics;
});

const everyNarrowLocale = (key) => narrowLocales.every((metric) => metric[key] === true);

const out = {
  pdfChunkAbsentBeforeIntent: !initialResources.some((path) => path.endsWith(`/${runtimeName}`)),
  onePdfChunkRequest: firstPagePdfRequests === 1,
  dialogHasConditionalOptions: dialog.count === dialog.expectedCount,
  defaultsAndTouchModalWork: dialog.defaults.dimensions && dialog.defaults.names
    && !dialog.defaults.decor && (dialog.expectedCount === 3 || dialog.defaults.backdrop)
    && dialog.modal,
  dialogRecoversAfterReconnect: dialog.reconnectKeepsModalCentered,
  printerDoesNotLoadEditor: dialog.editorStillAbsent,
  downloadNameIsStable: /^houseplan-.+-\d{4}-\d{2}-\d{2}\.pdf$/.test(download.suggestedFilename()),
  oneA4Page: document.numPages === 1 && (
    (Math.abs(viewport.width - 595.28) < 0.1 && Math.abs(viewport.height - 841.89) < 0.1)
      || (Math.abs(viewport.width - 841.89) < 0.1 && Math.abs(viewport.height - 595.28) < 0.1)
  ),
  exportedTextIsExtractable: /Scale|Maßstab|Масштаб|Échelle/.test(text),
  optionsPersistAcrossReload: rememberedNames,
  narrowDialogLocalizesAllLocales: everyNarrowLocale('localized'),
  narrowDialogHasNoHorizontalOverflow: everyNarrowLocale('documentFits')
    && everyNarrowLocale('surfaceFits') && everyNarrowLocale('bodyFits')
    && everyNarrowLocale('footerFits'),
  narrowDialogButtonsAreContainedTargets: everyNarrowLocale('buttonsContained')
    && everyNarrowLocale('targetsAtLeast44'),
  narrowDialogFooterStacksWithoutReordering: everyNarrowLocale('stacked')
    && everyNarrowLocale('domAndFocusOrderPreserved') && everyNarrowLocale('cancelCloses'),
  narrowViewportExportStillWorks: downloadedByteLength > 0 && document.numPages === 1,
  rasterLimitRejectsBeforePdfWrite: rasterLimitError === 'pdf.too_large',
};
await task.destroy();

const failed = await launchColdView();
let failedRequests = 0;
await failed.page.route(runtimePattern, async (route) => {
  failedRequests += 1;
  await route.abort('failed');
});
await clickPrinter(failed.page);
await failed.page.waitForFunction(() => window.__card._pdfRuntimeLoader.state === 'idle'
  && window.__card._toast);
out.failedChunkRetriesOnceAndKeepsView = failedRequests === 2
  && await failed.page.evaluate(() => !window.__card._pdfRuntime
    && !window.__card.renderRoot.querySelector('hp-pdf-dialog')
    && window.__card._mode === 'view');

await failed.browser.close();
checkAll(out);
await finish(browser, { ...out, narrowLocales });
