// #609: cheap HA-branch contract for the shared settings form shell.
//
// The explicit verify_ha_form_shell_609.mjs diagnostic loads the pinned real
// HA frontend. Validate needs a fast deterministic witness too, so this stub
// consumes only the same public ha-dialog CSS variables and reproduces HA's
// body scroller plus its width/height fullscreen breakpoints.
import { launch, checkAll, finish } from './serve.mjs';

const HA_DIALOG_STUB = String.raw`
  class HaDialog609 extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>'
        + ':host{display:contents}'
        + 'dialog{position:fixed;inset:0;margin:auto;box-sizing:border-box;'
        + 'width:var(--ha-dialog-width-full,min(var(--ha-dialog-width-md,580px),calc(100vw - 48px)));max-width:none;'
        + 'min-height:var(--ha-dialog-min-height,0);max-height:var(--ha-dialog-max-height,calc(100dvh - 80px));'
        + 'padding:0;border:0;border-radius:var(--ha-dialog-border-radius,12px);'
        + 'background:var(--dialog-surface-background,#fff);display:flex;flex-direction:column;overflow:hidden}'
        + '.header{flex:none;height:68px;display:flex;align-items:center;padding:0 16px}'
        + '.body{flex:1 1 auto;min-height:0;padding:var(--dialog-content-padding,12px);overflow:auto}'
        + '.footer{flex:none;display:flex;padding:12px 16px 16px}'
        + '@media (max-width:450px),(max-height:500px){dialog{width:100vw;min-height:100dvh;max-height:100dvh}}'
        + '</style><dialog><div class="header"><slot name="headerTitle"></slot></div>'
        + '<div class="body"><slot></slot></div><div class="footer"><slot name="footer"></slot></div></dialog>';
    }
    get open() { return this._open; }
    set open(value) { this._open = Boolean(value); this._sync(); }
    connectedCallback() { this._sync(); }
    _sync() {
      const dialog = this.shadowRoot.querySelector('dialog');
      if (!this.isConnected || !dialog) return;
      if (this._open && !dialog.open) {
        dialog.showModal();
        queueMicrotask(() => this.dispatchEvent(new Event('opened')));
      } else if (!this._open && dialog.open) {
        dialog.close();
        queueMicrotask(() => this.dispatchEvent(new Event('closed')));
      }
    }
  }
  customElements.define('ha-dialog', HaDialog609);
`;

const { page, browser } = await launch({ width: 1600, height: 1000 });

const setup = await page.evaluate(async (stub) => {
  // eslint-disable-next-line no-new-func
  new Function(stub)();
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const kinds = ['space', 'settings', 'room', 'marker', 'onboarding'];
  for (const kind of kinds) {
    const shell = document.createElement('hp-dialog');
    shell.dataset.kind = kind;
    shell.setAttribute('form-shell', '');
    shell.wide = true;
    shell.title = `${kind} settings`;
    shell.innerHTML = `<div class="hpf-form body"><section class="hpf-card" style="height:1200px">${kind}</section></div>`
      + '<div slot="footer"><button>Cancel</button><button>Save</button></div>';
    root.append(shell);
    await shell.updateComplete;
  }
  const generic = document.createElement('hp-dialog');
  generic.dataset.kind = 'generic-negative-control';
  generic.wide = true;
  generic.title = 'Generic dialog';
  generic.innerHTML = '<div style="height:1200px">Generic</div><button slot="footer">Close</button>';
  root.append(generic);
  await generic.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return { formCount: kinds.length };
}, HA_DIALOG_STUB);

const inspect = () => page.evaluate(() => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const read = (shell) => {
    const ha = shell.shadowRoot.querySelector('ha-dialog');
    const panel = ha.shadowRoot.querySelector('dialog');
    const haBody = ha.shadowRoot.querySelector('.body');
    const formBody = shell.querySelector('.body');
    const footer = shell.querySelector('[slot="footer"]');
    const box = panel.getBoundingClientRect();
    const footerBox = footer?.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      radius: getComputedStyle(panel).borderRadius,
      haPadding: getComputedStyle(haBody).padding,
      haOverflow: getComputedStyle(haBody).overflowY,
      haScrolls: haBody.scrollHeight > haBody.clientHeight,
      formOverflow: formBody ? getComputedStyle(formBody).overflowY : null,
      formBackground: formBody ? getComputedStyle(formBody).backgroundColor : null,
      surfaceBackground: getComputedStyle(panel).backgroundColor,
      footerInside: !footerBox || footerBox.bottom <= box.bottom + 1,
      noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
    };
  };
  const forms = [...root.querySelectorAll('hp-dialog[form-shell]')].map(read);
  const generic = root.querySelector('hp-dialog[data-kind="generic-negative-control"]');
  const genericPanel = generic.shadowRoot.querySelector('ha-dialog').shadowRoot.querySelector('dialog');
  return { forms, genericWidth: genericPanel.getBoundingClientRect().width };
});

const desktop = await inspect();
await page.setViewportSize({ width: 480, height: 800 });
await page.waitForTimeout(40);
const edge480 = await inspect();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(40);
const mobile390 = await inspect();
await page.setViewportSize({ width: 1280, height: 480 });
await page.waitForTimeout(40);
const shortViewport = await inspect();

const every = (items, predicate) => items.length === setup.formCount && items.every(predicate);
checkAll({
  fiveSharedConsumersExercised: setup.formCount === 5 && desktop.forms.length === 5,
  desktopWidth560: every(desktop.forms, (item) => Math.abs(item.width - 560) <= 1),
  desktopHeightCappedAt940: every(desktop.forms, (item) => item.height <= 941),
  oneHaScrollerWithoutDoublePadding: every(desktop.forms, (item) => item.haPadding === '0px'
    && item.haOverflow === 'auto' && item.haScrolls && item.formOverflow === 'visible'),
  canvasSurroundsDistinctSurface: every(desktop.forms, (item) => item.formBackground !== 'rgba(0, 0, 0, 0)'
    && item.formBackground !== item.surfaceBackground),
  desktopFooterInside: every(desktop.forms, (item) => item.footerInside),
  genericWideDialogUnchanged: Math.abs(desktop.genericWidth - 580) <= 1,
  edge480IsFullscreen: every(edge480.forms, (item) => Math.abs(item.width - 480) <= 1
    && Math.abs(item.height - 800) <= 1 && item.radius === '0px'
    && item.noHorizontalOverflow && item.footerInside),
  mobile390IsFullscreen: every(mobile390.forms, (item) => Math.abs(item.width - 390) <= 1
    && Math.abs(item.height - 844) <= 1 && item.radius === '0px'
    && item.noHorizontalOverflow && item.footerInside),
  shortHaViewportKeepsFullscreen: every(shortViewport.forms, (item) => Math.abs(item.height - 480) <= 1
    && item.radius === '0px' && item.footerInside),
});

await finish(browser, { desktop, edge480, mobile390, shortViewport });
