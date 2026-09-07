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

const clickPrinter = (page) => page.locator('houseplan-card').evaluate((card) => {
  const root = card.shadowRoot || card.renderRoot;
  [...root.querySelectorAll('button')]
    .find((button) => button.getAttribute('aria-label') === card._t('title.export_pdf'))?.click();
});

const { page, browser } = await launchColdView();
const requests = [];
page.on('request', (request) => requests.push(new URL(request.url()).pathname));
const initialResources = await page.evaluate(() => performance.getEntriesByType('resource')
  .map((entry) => new URL(entry.name).pathname));
await clickPrinter(page);
await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-pdf-dialog'));

const dialog = await page.evaluate(async () => {
  const card = window.__card;
  const pdf = card.renderRoot.querySelector('hp-pdf-dialog');
  const root = pdf.shadowRoot || pdf.renderRoot;
  const shell = root.querySelector('hp-dialog');
  await shell?.updateComplete;
  const native = shell?.shadowRoot?.querySelector('dialog');
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

await clickPrinter(page);
await page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-pdf-dialog'));
const rememberedNames = await page.evaluate(() => {
  const pdf = window.__card.renderRoot.querySelector('hp-pdf-dialog');
  const inputs = (pdf.shadowRoot || pdf.renderRoot).querySelectorAll('input[type="checkbox"]');
  return inputs[2]?.checked === false;
});

const out = {
  pdfChunkAbsentBeforeIntent: !initialResources.some((path) => path.endsWith(`/${runtimeName}`)),
  onePdfChunkRequest: firstPagePdfRequests === 1,
  dialogHasConditionalOptions: dialog.count === dialog.expectedCount,
  defaultsAndTouchModalWork: dialog.defaults.dimensions && dialog.defaults.names
    && !dialog.defaults.decor && (dialog.expectedCount === 3 || dialog.defaults.backdrop)
    && dialog.modal,
  printerDoesNotLoadEditor: dialog.editorStillAbsent,
  downloadNameIsStable: /^houseplan-.+-\d{4}-\d{2}-\d{2}\.pdf$/.test(download.suggestedFilename()),
  oneA4Page: document.numPages === 1 && (
    (Math.abs(viewport.width - 595.28) < 0.1 && Math.abs(viewport.height - 841.89) < 0.1)
      || (Math.abs(viewport.width - 841.89) < 0.1 && Math.abs(viewport.height - 595.28) < 0.1)
  ),
  exportedTextIsExtractable: /Scale|Maßstab|Масштаб|Échelle/.test(text),
  optionsPersistAcrossReload: rememberedNames,
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
await finish(browser, out);
