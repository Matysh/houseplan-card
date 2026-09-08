import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 960, height: 640 });

await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !!root?.querySelector('.summary-control');
});

const initial = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const stageBefore = root().querySelector('.stage').getBoundingClientRect();
  const buttons = root().querySelectorAll('.summary-control button');
  buttons[1].click();
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const overlay = root().querySelector('.summary-overlay');
  const stageAfter = root().querySelector('.stage').getBoundingClientRect();
  const box = overlay?.getBoundingClientRect();
  return {
    splitControl: buttons.length === 2,
    togglePersistsIntent: buttons[1].getAttribute('aria-pressed') === 'true',
    rightOnWideStage: overlay?.classList.contains('right') === true,
    overlayDoesNotResizeStage: Math.abs(stageBefore.width - stageAfter.width) < 0.5
      && Math.abs(stageBefore.height - stageAfter.height) < 0.5,
    overlayInsideStage: !!box && box.left >= stageAfter.left - 1 && box.right <= stageAfter.right + 1
      && box.top >= stageAfter.top - 1 && box.bottom <= stageAfter.bottom + 1,
    readOnlySurface: !!overlay && overlay.querySelectorAll('button, input, select, textarea').length === 0,
    hasDefaultRows: (overlay?.querySelectorAll('.summary-value').length || 0) === 3,
  };
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '560px';
  root.querySelector('.stage').style.height = '900px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return root?.querySelector('.summary-overlay')?.classList.contains('bottom') === true;
});
const bottomOnTallStage = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const stage = root.querySelector('.stage').getBoundingClientRect();
  const overlay = root.querySelector('.summary-overlay').getBoundingClientRect();
  return Math.abs((overlay.left + overlay.right) / 2 - (stage.left + stage.right) / 2) < 2;
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '270px';
  root.querySelector('.stage').style.height = '500px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !root?.querySelector('.summary-overlay')
    && root?.querySelector('.summary-control button:last-child')?.getAttribute('aria-pressed') === 'true';
});
const smallCardKeepsLocalIntent = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const toggle = root.querySelector('.summary-control button:last-child');
  return toggle?.title === card._summary?.['t']?.('summary.hidden_small')
    || /space|мест|Platz|espace/i.test(toggle?.title || '');
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '780px';
  root.querySelector('.stage').style.height = '640px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return root?.querySelector('.summary-overlay.right');
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  // The standalone harness has no backend capability handshake. Backend
  // validation is covered separately; advertise the supported API here so
  // this browser witness exercises the complete shared-settings form.
  card._haSummaryPanelApi = 1;
  root.querySelector('.summary-control button:first-child').click();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !!root?.querySelector('hp-dialog .summary-editor');
});
const settings = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const editor = root.querySelector('hp-dialog .summary-editor');
  const cancel = [...root.querySelectorAll('hp-dialog [slot="footer"] button')]
    .find((button) => button.textContent.trim() === card._t('btn.cancel'));
  const result = {
    editorLoadedOnDemand: !!editor,
    sharedAndLocalControls: !!editor?.querySelector('input[type="text"]')
      && editor.querySelectorAll('input[type="range"]').length === 2
      && !!editor.querySelector('input[type="checkbox"]'),
    entityPickerSeesHass: (editor?.querySelector('.summary-source')?.options.length || 0)
      > 3,
  };
  cancel?.click();
  return result;
});

checkAll({
  ...initial,
  bottomOnTallStage,
  smallCardKeepsLocalIntent,
  ...settings,
});
await finish(browser);
