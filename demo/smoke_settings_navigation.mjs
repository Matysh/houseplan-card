// #948: mounted drafts, real input geometry and live HA theme inheritance.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });
const out = await page.evaluate(async () => {
  const c = window.__card, root = c.shadowRoot;
  c._openSettingsDialog(); await c.updateComplete;
  const dialog = root.querySelector('hp-dialog[data-kind="settings"]');
  const q = selector => dialog.querySelector(selector);
  const tick = async () => { await c.updateComplete; await new Promise(requestAnimationFrame); };
  const originalConfig = JSON.stringify(c._serverCfg);
  const checkbox = q('#gs-room-tooltip'); checkbox.click(); await tick();
  const draftValue = c._settingsDialog.showRoomTooltip;
  for (const button of dialog.querySelectorAll('[data-section-target]')) { button.click(); await tick(); }
  const mounted = checkbox === q('#gs-room-tooltip') && c._settingsDialog.showRoomTooltip === draftValue;
  q('[data-section-target="sun"]').click(); await tick();
  const range = q('.hpf-north-values input[type="range"]'); range.value = '32';
  range.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  const compass = q('.hpf-north-dial g').getAttribute('transform');
  const fieldValue = q('#gs-north').value;
  q('[data-section-target="plan"]').click(); await tick();
  const bg = q('[name="gs-bg-mode"]'); bg.value = 'static'; bg.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  const staticColor = q('[data-card="plan"] .hpf-color-with-action');
  const reset = staticColor.querySelector('button');
  const staticRow = !!reset && Math.abs(reset.getBoundingClientRect().bottom - staticColor.getBoundingClientRect().bottom) < 2;
  const select = q('[name="gs-device-battery"]');
  q('[data-section-target="display"]').click(); await tick();
  const cursor = getComputedStyle(select).cursor;
  const footerCursor = getComputedStyle(q('[data-hp="dialog-cancel"]')).cursor;
  const colors = [];
  for (const [paper, text, accent] of [['#ffffff','#17212b','#007d93'], ['#17212b','#ffffff','#5bcce6'], ['#f5f0ff','#231235','#a32191']]) {
    c.style.setProperty('--card-background-color', paper);
    c.style.setProperty('--primary-text-color', text);
    c.style.setProperty('--primary-color', accent);
    await new Promise(requestAnimationFrame);
    colors.push(getComputedStyle(q('.hpf-settings-nav button')).color);
  }
  return {
    navigationKeepsMountedDraft: mounted,
    northSharedSource: fieldValue === '32' && compass === 'rotate(32 74 74)',
    staticColorResetAligned: staticRow,
    selectPointer: cursor === 'pointer', cancelPointer: footerCursor === 'pointer',
    dynamicThemes: new Set(colors).size === 3,
    editingDidNotWrite: originalConfig === JSON.stringify(c._serverCfg),
  };
});
checkAll(out);
for (const width of [320, 390]) {
  await page.setViewportSize({ width, height: 740 });
  const mobile = await page.evaluate(async () => {
    const c=window.__card, dialog=c.shadowRoot.querySelector('hp-dialog[data-kind="settings"]');
    const selector=dialog.querySelector('.hpf-settings-mobile select');
    let fits=true;
    for (const option of selector.options) {
      selector.value=option.value; selector.dispatchEvent(new Event('change',{bubbles:true}));
      await c.updateComplete; await new Promise(requestAnimationFrame);
      const pane=dialog.querySelector('.hpf-settings-pane:not([hidden])');
      for (const element of pane.querySelectorAll('input,select,button,hp-color-opacity,textarea')) {
        const r=element.getBoundingClientRect();
        if (r.width && (r.left < -1 || r.right > innerWidth + 1)) fits=false;
      }
    }
    const footer=dialog.querySelector('[slot="footer"]').getBoundingClientRect();
    return { fieldsFit:fits, navigationVisible:selector.getBoundingClientRect().width>0,
      footerFits:footer.left>=-1 && footer.right<=innerWidth+1 && footer.bottom<=innerHeight+1 };
  });
  checkAll(mobile);
  Object.assign(out, Object.fromEntries(Object.entries(mobile).map(([key,value])=>[`${width}.${key}`,value])));
}
// A separate wizard cannot silently discard this still-dirty form.
const general=page.locator('hp-dialog[data-kind="settings"][icon="mdi:cog-outline"]');
await general.locator('.hpf-settings-mobile select').selectOption('data');
const exportButton=general.locator('[data-card="data"] .hpf-actions > button[data-backup-action=export]').first();
await exportButton.click();
const confirm=page.locator('hp-confirm hp-dialog');
out.exportAsksBeforeLeaving=await confirm.count()===1 && await general.count()===1;
checkAll({exportAsksBeforeLeaving:out.exportAsksBeforeLeaving});
if(out.exportAsksBeforeLeaving){
  await confirm.locator('.btn[data-hp="dialog-cancel"]').click();
  out.keepEditingRetainsDraft=await page.evaluate(()=>window.__card._settingsDialog?.northDeg===32 && !window.__card._backupExportDialog);
  await exportButton.click();
  await confirm.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(()=>!window.__card._settingsDialog && !!window.__card._backupExportDialog);
  out.discardOpensOnlyExport=await page.evaluate(()=>!!window.__card._backupExportDialog && !window.__card._settingsDialog
    && window.__card._settings.north_deg!==32);
  checkAll({keepEditingRetainsDraft:out.keepEditingRetainsDraft,discardOpensOnlyExport:out.discardOpensOnlyExport});
}
await finish(browser, out);
