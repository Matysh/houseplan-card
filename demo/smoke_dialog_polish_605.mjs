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
      const tiles = [...dialog.querySelectorAll('.hpf-colortile')];
      const numbers = tiles.map((tile) => tile.querySelector('.hpf-colortile-meta input'));
      const fits = numbers.every((input) => {
        const style = getComputedStyle(input);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = style.font;
        const inner = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return input.inputMode === 'numeric' && inner + 0.5 >= context.measureText('100').width;
      });
      const noSpinner = numbers.every((input) => getComputedStyle(input).appearance === 'textfield');
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
      const tileAlpha = tiles.length === 10 && tiles.every((tile) => {
        const { picker, opacity, checker } = layer(tile);
        return checker && Math.abs(opacity - Math.round(picker.opacity * 100) / 100) <= 0.01;
      });
      const tileByLabel = (key) => tiles.find((tile) =>
        tile.querySelector('.hpf-colortile-swatch > span')?.textContent.trim() === c._t(key));
      const none = tileByLabel('gs.light_none');
      const on = tileByLabel('gs.light_on');
      const defaultsDiffer = !!none && !!on
        && layer(none).opacity === 0 && Math.abs(layer(on).opacity - 0.18) <= 0.01;
      // #615 AC2: at 0 % the label sits on the bare checkerboard — dark ink.
      const noneInkDark = !!none
        && getComputedStyle(none.querySelector('.hpf-colortile-swatch')).color === 'rgb(31, 42, 48)';
      // #615 AC1: typing into the tile's % field repaints before Save.
      const typeInto = async (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await c.updateComplete;
        const picker = input.closest('.hpf-colortile, .hpf-colorfield')?.querySelector('hp-color-opacity');
        await picker?.updateComplete;
      };
      const savedBefore = JSON.stringify(c._serverCfg);
      const onInput = on?.querySelector('.hpf-colortile-meta input');
      let liveAlpha = false;
      if (onInput) {
        await typeInto(onInput, '0');
        const zero = layer(on).opacity;
        await typeInto(onInput, '100');
        const full = layer(on).opacity;
        await typeInto(onInput, '18');
        liveAlpha = zero === 0 && full === 1 && JSON.stringify(c._serverCfg) === savedBefore;
      }
      // #615 AC3 (b): colour plates stay solid at any alpha. Without this the
      // tile mode could leak to every flat-swatch (mutant M-615-plate).
      const plates = [...dialog.querySelectorAll('.hpf-colorfield hp-color-opacity')];
      const platesFlat = plates.length >= 2 && plates.every((picker) => picker.flatSwatch && !picker.coverSwatch);
      const wallPicker = dialog.querySelector('.hpf-card[data-card="plan"] .hpf-colorrow .hpf-colorfield hp-color-opacity');
      const wallInput = wallPicker?.closest('.hpf-colorfield').querySelector('.hpf-opacity input');
      let plateSolid = false;
      if (wallInput) {
        await typeInto(wallInput, '40');
        plateSolid = wallPicker.opacity === 0.4
          && getComputedStyle(wallPicker.renderRoot.querySelector('.swatch')).opacity === '1'
          && getComputedStyle(wallPicker.renderRoot.querySelector('.trigger')).backgroundImage === 'none';
      }
      const hex = [...dialog.querySelectorAll('.hpf-hex')];
      const upperHex = hex.length >= 11 && hex.every((node) => node.textContent === node.textContent.toUpperCase());
      const picker = tiles[0].querySelector('hp-color-opacity');
      picker.renderRoot.querySelector('.trigger').click();
      await picker.updateComplete;
      const opensPicker = picker.renderRoot.querySelector('.trigger').getAttribute('aria-expanded') === 'true';
      picker.renderRoot.querySelector('.trigger').click();
      await picker.updateComplete;

      const wall = dialog.querySelector('[data-card="plan"] .hpf-colorrow');
      const reset = [...wall.querySelectorAll('button')].find((button) => button.textContent.trim() === c._t('btn.reset'));
      const before = JSON.stringify(c._serverCfg);
      c._setFillColor('wall_fill', { c: '#123456', a: 0.27 });
      await c.updateComplete;
      reset?.click(); await c.updateComplete;
      const resetsDraftOnly = !!reset && c._settingsDialog.colors.wall_fill.c === '#ffffff'
        && c._settingsDialog.colors.wall_fill.a === 1 && JSON.stringify(c._serverCfg) === before;

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
        && Math.abs(actions[0].getBoundingClientRect().left - actions.at(-1).getBoundingClientRect().left) <= 1;
      const noNative = dialog.querySelectorAll('input[type="color"]').length === 0;
      c._settingsDialog = null;
      await c.updateComplete;
      return { fits, noSpinner, noOverflow, oneSurface, tileAlpha, defaultsDiffer, noneInkDark,
        liveAlpha, platesFlat, plateSolid, upperHex, opensPicker,
        resetsDraftOnly, outlined, leftAligned, noNative };
    });
    for (const [key, ok] of Object.entries(out)) result[`${theme}_${width}_${key}`] = ok;
  }
}

await page.setViewportSize({ width: 560, height: 900 });
await page.evaluate(async () => {
  const c = window.__card;
  c._openSettingsDialog(); await c.updateComplete;
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
  let field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  const fallback = field && field.querySelectorAll('.hpf-iconpreview').length === 1
    && field.querySelector('.hpf-iconfield-control input')
    && Math.round(field.querySelector('.hpf-iconfield-control').getBoundingClientRect().height) === 44;
  c._markerDialog = null; await refresh();
  if (!customElements.get('ha-icon-picker')) {
    customElements.define('ha-icon-picker', class extends HTMLElement {});
  }
  c._openMarkerDialog(); await refresh();
  field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  const picker = field?.querySelector('ha-icon-picker');
  const onePreview = !!picker && field.querySelectorAll('.hpf-iconpreview').length === 0
    && !!picker.placeholder && Math.round(field.querySelector('.hpf-iconfield-control').getBoundingClientRect().height) === 44;
  const style = picker && getComputedStyle(picker);
  const themed = !!style && style.getPropertyValue('--mdc-text-field-fill-color').trim() === 'transparent'
    && style.getPropertyValue('--ha-color-border-neutral-loud').trim() === 'transparent';
  const iconValue = c._markerDialog.icon;
  picker?.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'mdi:home' } }));
  await refresh();
  const selects = c._markerDialog.icon === 'mdi:home';
  field = root().querySelector('hp-dialog[data-kind="marker"] .hpf-iconfield');
  field?.querySelector('.hpf-iconclear')?.click(); await refresh();
  const clears = c._markerDialog.icon === '' && iconValue !== 'mdi:home';
  const rotation = root().querySelector('hp-dialog[data-kind="marker"] label[for="marker-angle"]')?.textContent.trim();
  c._markerDialog = null; await refresh();
  return { fallback: !!fallback, onePreview, themed, selects, clears, rotation: rotation === 'Rotation' };
});
for (const [key, ok] of Object.entries(icon)) result[`icon_${key}`] = ok;

checkAll(result);
await finish(browser, result);
