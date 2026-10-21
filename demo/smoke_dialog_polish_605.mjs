// #605: geometry and behavior witnesses for the seven residual settings-dialog
// mismatches. In particular, a Linux screenshot alone missed clipped opacity
// digits on Windows, so we measure text against the actual input content box.
// #615 revised item 3 for colour tiles: alpha shows as a checkerboard, while
// colour plates stay solid (both witnessed below).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 560, height: 900 });
const result = {};

for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  for (const width of [320, 360, 560]) {
    await page.setViewportSize({ width, height: 900 });
    const out = await page.evaluate(async () => {
      const c = window.__card;
      const root = () => c.shadowRoot || c.renderRoot;
      c._setMode('plan');
      c._openSettingsDialog();
      c.requestUpdate(); await c.updateComplete;
      await document.fonts.ready;
      const dialog = root().querySelector('hp-dialog[data-kind="settings"]');
      dialog.querySelector('[data-section-target="fills"]').click(); await c.updateComplete;
      const tiles = [...dialog.querySelectorAll('[data-card="fills"] .hpf-colortile')];
      const numbers = tiles.map(tile => tile.querySelector('.hpf-colortile-meta .hpf-opacity'));
      const fits = numbers.length === 8 && numbers.every(readout => {
        const rect=readout.getBoundingClientRect();
        return rect.width>0 && readout.scrollWidth<=readout.clientWidth+1;
      });
      const noSpinner = !dialog.querySelector('.hpf-colortile-meta input');
      const tileBounds = tiles.map((tile) => tile.getBoundingClientRect());
      const noOverflow = tileBounds.every((box) => box.left >= -1 && box.right <= innerWidth + 1)
        && dialog.scrollWidth <= dialog.clientWidth + 1;
      const oneSurface = tiles.every((tile) => {
        const swatch = tile.querySelector('.hpf-colortile-swatch');
        const picker = swatch.querySelector('hp-color-opacity');
        const host = picker.getBoundingClientRect();
        const area = swatch.getBoundingClientRect();
        const painted = picker.renderRoot.querySelector('.swatch');
        // #615 changed #605 item 3 for tiles: still one surface without a
        // second square, but alpha is now visible (see tileAlpha below), so
        // the painted layer is no longer required to be opaque.
        return picker.flatSwatch && picker.coverSwatch && !!painted
          && Math.abs(host.width - area.width + 2) <= 2
          && Math.abs(host.height - area.height + 2) <= 2;
      });
      // #615 AC1: every tile paints its colour at its own alpha over the same
      // checkerboard the trigger uses elsewhere, so 0 % reads as "no colour".
      const layer = (tile) => {
        const picker = tile.querySelector('hp-color-opacity');
        const trigger = picker.renderRoot.querySelector('.trigger');
        const painted = picker.renderRoot.querySelector('.swatch');
        return { picker, opacity: Number(getComputedStyle(painted).opacity),
          checker: getComputedStyle(trigger).backgroundImage.includes('linear-gradient') };
      };
      const tileAlpha = tiles.length === 8 && tiles.every((tile) => {
        const { picker, opacity, checker } = layer(tile);
        return checker && Math.abs(opacity - Math.round(picker.opacity * 100) / 100) <= 0.01;
      });
      const tileByLabel = (key) => tiles.find((tile) =>
        tile.querySelector('.hpf-colortile-heading')?.textContent.trim() === c._t(key));
      const none = tileByLabel('gs.light_none');
      const on = tileByLabel('gs.light_on');
      const defaultsDiffer = !!none && !!on
        && layer(none).opacity === 0 && Math.abs(layer(on).opacity - 0.18) <= 0.01;
      // v10 keeps the caption outside the alpha swatch, on the theme surface.
      const noneInkDark = !!none && getComputedStyle(none.querySelector('.hpf-colortile-heading')).color === getComputedStyle(dialog).color;
      const changeAlpha = async (picker, value) => {
        picker.dispatchEvent(new CustomEvent('hp-color-opacity-change', {detail:{color:picker.color,opacity:value/100},bubbles:true,composed:true}));
        await c.updateComplete; await picker.updateComplete;
      };
      const savedBefore=JSON.stringify(c._serverCfg), onPicker=on.querySelector('hp-color-opacity');
      await changeAlpha(onPicker,0); const zero=layer(on).opacity;
      await changeAlpha(onPicker,100); const full=layer(on).opacity;
      await changeAlpha(onPicker,18);
      const liveAlpha=zero===0 && full===1 && JSON.stringify(c._serverCfg)===savedBefore;
      // #615 AC3 (b): colour plates stay solid at any alpha. Without this the
      // tile mode could leak to every flat-swatch (mutant M-615-plate).
      const plates = [...dialog.querySelectorAll('.hpf-colorfield hp-color-opacity')];
      const platesFlat = plates.length >= 2 && plates.every((picker) => picker.flatSwatch && !picker.coverSwatch);
      const wallPicker = dialog.querySelector('.hpf-card[data-card="plan"] .hpf-colorrow .hpf-colorfield hp-color-opacity');
      await changeAlpha(wallPicker,40);
      const plateSolid=wallPicker.opacity===.4
        && getComputedStyle(wallPicker.renderRoot.querySelector('.swatch')).opacity==='1'
        && getComputedStyle(wallPicker.renderRoot.querySelector('.trigger')).backgroundImage==='none';
      // #931: solid colour is independent of compact Properties layout. Native
      // form plates keep their 40px trigger and inline label/hex at every width.
      dialog.querySelector('[data-section-target="plan"]').click(); await c.updateComplete;
      const visiblePlates = [...dialog.querySelectorAll('[data-card="plan"] .hpf-colorfield hp-color-opacity')];
      const plateBoxes = visiblePlates.map((plate) => {
        const trigger = plate.renderRoot.querySelector('.trigger').getBoundingClientRect();
        return { display: getComputedStyle(plate).display, width: trigger.width, height: trigger.height };
      });
      // A flex item blockifies inline-flex to flex in getComputedStyle.
      const plateLayout = plateBoxes.length >= 2 && plateBoxes.every((box) => box.display === 'flex'
        && Math.abs(box.width - 40) <= 1 && Math.abs(box.height - 40) <= 1);
      dialog.querySelector('[data-section-target="fills"]').click(); await c.updateComplete;
      const hex = [...dialog.querySelectorAll('.hpf-hex')];
      const upperHex = hex.length >= 11 && hex.every((node) => node.textContent === node.textContent.toUpperCase());
      const picker = tiles[0].querySelector('hp-color-opacity');
      picker.renderRoot.querySelector('.trigger').click();
      await picker.updateComplete;
      const opensPicker = picker.renderRoot.querySelector('.trigger').getAttribute('aria-expanded') === 'true';
      picker.renderRoot.querySelector('.trigger').click();
      await picker.updateComplete;

      const wall=dialog.querySelector('[data-card="plan"] .hpf-colorrow');
      const resetsDraftOnly=!wall.querySelector('button.hpf-link');
      dialog.querySelector('[data-section-target="data"]').click(); await c.updateComplete;
      const data = dialog.querySelector('[data-card="data"]');
      const actions = [...data.querySelectorAll('.hpf-actions .btn')];
      const outlined = actions.length >= 2 && actions.every((button) => {
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) >= 1
          && box.height >= 44 && box.left >= -1 && box.right <= innerWidth + 1
          && !button.classList.contains('alignall');
      });
      const leftAligned = actions.length >= 2
        && Math.abs(actions[0].getBoundingClientRect().top - actions[1].getBoundingClientRect().top) <= 1;
      const noNative = dialog.querySelectorAll('input[type="color"]').length === 0;
      c._settingsDialog = null;
      await c.updateComplete;
      return { fits, noSpinner, noOverflow, oneSurface, tileAlpha, defaultsDiffer, noneInkDark,
        liveAlpha, platesFlat, plateSolid, plateLayout, plateBoxes, upperHex, opensPicker,
        resetsDraftOnly, outlined, leftAligned, noNative };
    });
    const {plateBoxes, ...checks} = out;
    if (!checks.plateLayout) console.error('native plate layout', theme, width, plateBoxes);
    for (const [key, ok] of Object.entries(checks)) result[`${theme}_${width}_${key}`] = ok;
  }
}

await page.setViewportSize({ width: 560, height: 900 });
await page.evaluate(async () => {
  const c = window.__card;
  c._openSettingsDialog(); await c.updateComplete;
  (c.shadowRoot || c.renderRoot).querySelector('[data-section-target="fills"]').click(); await c.updateComplete;
  (c.shadowRoot || c.renderRoot).querySelector('[data-card="fills"]').scrollIntoView({ block: 'start' });
});
const tile = page.locator('hp-dialog[data-kind="settings"] .hpf-colortile-swatch').first();
const trigger = tile.locator('hp-color-opacity .trigger');
const bounds = await tile.boundingBox();
await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
result.tileWholeSurfaceOpens = await trigger.getAttribute('aria-expanded') === 'true';
await trigger.click();
await trigger.focus();
await page.keyboard.press('Enter');
result.tileKeyboardOpens = await trigger.getAttribute('aria-expanded') === 'true';
await page.keyboard.press('Escape');

const icon = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const refresh = async () => { c.requestUpdate(); await c.updateComplete; };
  c._setMode('devices');
  c._openMarkerDialog(); await refresh();
  root().querySelector('hp-dialog[data-kind="marker"] [data-section-target="appearance"]').click(); await refresh();
  let field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  const fallback = field && field.querySelectorAll('.hpf-iconpreview').length === 1
    && field.querySelector('.hpf-iconfield-control input')
    && Math.round(field.querySelector('.hpf-iconfield-control').getBoundingClientRect().height) === 44;
  c._markerDialog = null; await refresh();
  if (!customElements.get('ha-icon-picker')) {
    customElements.define('ha-icon-picker', class extends HTMLElement {});
  }
  c._openMarkerDialog(); await refresh();
  root().querySelector('hp-dialog[data-kind="marker"] [data-section-target="appearance"]').click(); await refresh();
  field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  const picker = field?.querySelector('ha-icon-picker');
  const onePreview = !!picker && field.querySelectorAll('.hpf-iconpreview').length === 0
    && !!picker.placeholder && Math.round(field.querySelector('.hpf-iconfield-control').getBoundingClientRect().height) === 44;
  const style = picker && getComputedStyle(picker);
  const themed = !!style && style.getPropertyValue('--mdc-text-field-fill-color').trim() === 'transparent'
    && style.getPropertyValue('--ha-color-border-neutral-loud').trim() === 'transparent';
  const haWrapperHasNoBorderPaint = !!picker
    && getComputedStyle(picker.parentElement).borderTopColor === 'rgba(0, 0, 0, 0)';
  const iconValue = c._markerDialog.icon;
  picker?.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'mdi:home' } }));
  await refresh();
  const selects = c._markerDialog.icon === 'mdi:home';
  field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  // #947: clearing is owned by the retained native HA picker; no duplicate reset button.
  field?.querySelector('ha-icon-picker')?.dispatchEvent(new CustomEvent('value-changed', { detail: { value: '' } })); await refresh();
  const clears = c._markerDialog.icon === '' && iconValue !== 'mdi:home';
  const rotation = root().querySelector('hp-dialog[data-kind="marker"] label[for="marker-angle"]')?.textContent.trim();
  c._markerDialog = null; await refresh();
  return { fallback: !!fallback, onePreview, themed, haWrapperHasNoBorderPaint, selects, clears, rotation: rotation === 'Rotation' };
});
for (const [key, ok] of Object.entries(icon)) result[`icon_${key}`] = ok;

checkAll(result);
await finish(browser, result);
