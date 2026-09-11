// #508: the summary-panel settings dialog scrolls in Home Assistant — wheel and
// touch. In HA `hp-dialog` renders `ha-dialog`, whose own `.body` is the
// scroller; `.summary-editor` (overflow:auto + overscroll-behavior:contain) was
// not height-bound there, and a scroll container that never scrolls stops
// Chromium's scroll chaining for wheel and touch alike. `flex-content` binds it.
//
// The stub below reproduces the HA 2026.9 ha-dialog contract that matters:
// a fixed, height-capped `dialog` laid out as a flex column, a `.body` with
// overflow:auto, `:host([flexcontent]) .body` as a flex column, and the
// full-screen media query for phones. It is registered BEFORE the dialog is
// opened, so hp-dialog takes its HA branch. Witness (c) proves the stub
// reproduces the bug: without `flexcontent` the editor does not scroll.
import { launch, check, finish } from './serve.mjs';

const STUB = String.raw`
  class HaDialogStub extends HTMLElement {
    static get observedAttributes() { return ['open']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>'
        + ':host{display:block}'
        + 'dialog{position:fixed;inset:0;margin:auto;width:min(var(--ha-dialog-width-md,580px),95vw);'
        + 'max-height:calc(100vh - 80px);padding:0;border:0;display:flex;flex-direction:column;overflow:hidden}'
        + '.header{flex:none;min-height:56px;display:flex;align-items:center;padding:0 16px}'
        + '.content-wrapper{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}'
        + '.body{position:relative;overflow:auto;flex-grow:1}'
        + ':host([flexcontent]) .body{max-width:100%;flex:1;display:flex;flex-direction:column}'
        + '.footer{flex:none;display:flex;padding:12px 16px 16px}'
        + '@media all and (max-width:450px){dialog{width:100vw;max-height:100dvh;min-height:100dvh}}'
        + '</style><dialog><div class="header"><slot name="headerTitle"></slot></div>'
        + '<div class="content-wrapper"><div class="body"><slot></slot></div></div>'
        + '<div class="footer"><slot name="footer"></slot></div></dialog>';
    }
    set open(value) { this._open = !!value; this._sync(); }
    get open() { return !!this._open; }
    connectedCallback() { this._sync(); queueMicrotask(() => this.dispatchEvent(new Event('opened'))); }
    _sync() {
      const dialog = this.shadowRoot.querySelector('dialog');
      if (!dialog || !this.isConnected) return;
      if (this._open && !dialog.open) dialog.showModal();
      if (!this._open && dialog.open) dialog.close();
    }
  }
  customElements.define('ha-dialog', HaDialogStub);
`;

async function scenario(viewport, { flexContent = true } = {}) {
  const { page, browser } = await launch(viewport, 1, [], { hasTouch: viewport.width < 500 });
  await page.waitForFunction(() => !!window.__card?._summary);
  const opened = await page.evaluate(async ({ stub, flexContent }) => {
    // eslint-disable-next-line no-new-func
    new Function(stub)();
    const card = window.__card;
    const root = () => card.shadowRoot || card.renderRoot;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const settle = async () => { await card.updateComplete; await frame(); await card.updateComplete; };
    card._config = { ...card._config, language: 'en', kiosk: false };
    card._serverCanWrite = true;
    card._haSummaryPanelApi = 1;
    card.narrow = innerWidth < 500;
    const config = structuredClone(card._serverCfg);
    const blocks = [];
    for (let index = 0; index < 6; index += 1) {
      blocks.push({ id: `block-${index}`, title: `Block ${index}`, visible: true, scope: { type: 'all' }, values: [
        { id: `devices-${index}`, label: 'Devices', source: { type: 'system', key: 'device_count' } },
        { id: `area-${index}`, label: 'Floor area', source: { type: 'system', key: 'total_area' } },
        { id: `clock-${index}`, label: 'Date and time', source: { type: 'system', key: 'datetime' } },
      ] });
    }
    config.settings = { ...config.settings, summary_panel: { version: 1, title: 'Summary', show_on_mobile: true, blocks } };
    card._serverCfg = config;
    card._settings = config.settings;
    card._sendConfigCandidate = async () => {};
    card._summary.updated();
    card.requestUpdate();
    await settle();
    root().querySelector('.summary-control')?.querySelector('button:first-child')?.click();
    for (let i = 0; i < 80 && !root().querySelector('hp-dialog[data-kind="summary"]'); i += 1) { await frame(); }
    const dialog = root().querySelector('hp-dialog[data-kind="summary"]');
    if (!dialog) return { dialog: false };
    if (!flexContent) { dialog.flexContent = false; dialog.removeAttribute('flex-content'); }
    await dialog.updateComplete;
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const editor = dialog.querySelector('.summary-editor');
    const ha = dialog.shadowRoot.querySelector('ha-dialog');
    const body = ha?.shadowRoot.querySelector('.body');
    const native = ha?.shadowRoot.querySelector('dialog');
    const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const footer = dialog.querySelector('[slot="footer"]');
    window.__508 = { dialog, editor, body };
    return {
      dialog: true, haBranch: !!ha, flexContent: ha?.hasAttribute('flexcontent') === true,
      editor: rect(editor), editorScroll: [editor.scrollHeight, editor.clientHeight],
      body: rect(body), bodyScroll: [body.scrollHeight, body.clientHeight],
      dialogRect: rect(native), footer: footer ? rect(footer) : null, inner: [innerWidth, innerHeight],
    };
  }, { stub: STUB, flexContent });
  const readScroll = () => page.evaluate(() => ({ editor: window.__508.editor.scrollTop, body: window.__508.body.scrollTop }));
  return { page, browser, opened, readScroll };
}

// (a) desktop: the wheel over the content scrolls .summary-editor; header/footer stay
{
  const { page, browser, opened, readScroll } = await scenario({ width: 1280, height: 720 });
  check('desktop.haBranch', opened.haBranch);
  check('desktop.flexContent', opened.flexContent);
  check('desktop.editorIsTheScroller', opened.editorScroll[0] > opened.editorScroll[1] + 50);
  check('desktop.bodyDoesNotScroll', opened.bodyScroll[0] <= opened.bodyScroll[1] + 1);
  const footerBefore = opened.footer;
  await page.mouse.move(opened.editor.x + opened.editor.w / 2, opened.editor.y + Math.min(opened.editor.h / 2, 160));
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  const after = await readScroll();
  check('desktop.wheelScrollsEditor', after.editor >= 100);
  const footerAfter = await page.evaluate(() => { const r = window.__508.dialog.querySelector('[slot="footer"]').getBoundingClientRect(); return { y: r.y, h: r.height }; });
  check('desktop.footerStays', Math.abs(footerAfter.y - footerBefore.y) < 1 && footerAfter.y + footerAfter.h <= opened.inner[1] + 1);
  await browser.close();
}

// (b) phone: a touch swipe scrolls the editor; the dialog is not taller than the viewport
{
  const { page, browser, opened, readScroll } = await scenario({ width: 390, height: 844 });
  check('phone.haBranch', opened.haBranch);
  check('phone.dialogFitsViewport', opened.dialogRect.h <= opened.inner[1] + 1);
  check('phone.footerInViewport', !!opened.footer && opened.footer.y + opened.footer.h <= opened.inner[1] + 1);
  check('phone.editorIsTheScroller', opened.editorScroll[0] > opened.editorScroll[1] + 50);
  const cdp = await page.context().newCDPSession(page);
  const x = opened.editor.x + opened.editor.w / 2;
  const y0 = opened.editor.y + Math.min(opened.editor.h - 40, 300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - step * 30 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  const after = await readScroll();
  check('phone.touchScrollsEditor', after.editor >= 80);
  await browser.close();
}

// (c) the stub reproduces the bug: without flexcontent the editor is unbounded and nothing scrolls
{
  const { page, browser, opened, readScroll } = await scenario({ width: 1280, height: 720 }, { flexContent: false });
  check('witness.noFlexContent', opened.flexContent === false);
  check('witness.editorUnbounded', opened.editorScroll[0] === opened.editorScroll[1]);
  await page.mouse.move(opened.editor.x + opened.editor.w / 2, opened.editor.y + 160);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  const after = await readScroll();
  check('witness.wheelBlocked', after.editor === 0 && after.body === 0);
  await browser.close();
}

finish();
