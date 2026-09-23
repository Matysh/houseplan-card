// #603: measure the actual dialog controls, not just the existence of CSS rules.
// In #602 a 44px hit box passed while its painted switch track was 2px off.
import { launch, checkAll, finish } from './serve.mjs';

const expected = {
  ru: ['Вернуться', 'Не сохранять'],
  en: ['Continue', 'Discard'],
  de: ['Fortfahren', 'Verwerfen'],
  fr: ['Continuer', 'Abandonner'],
};
const results = {};

for (const dpr of [1, 2]) {
  const { page, browser } = await launch({ width: 560, height: 820 }, dpr);
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 360, 560, 640]) {
      await page.setViewportSize({ width, height: 820 });
      for (const language of ['ru', 'en', 'de', 'fr']) {
        const key = `${language}_${theme}_dpr${dpr}_w${width}`;
        const result = await page.evaluate(async ({ language }) => {
          const c = window.__card;
          const root = () => c.shadowRoot || c.renderRoot;
          const settle = async () => {
            c.requestUpdate(); await c.updateComplete;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          };
          c._config = { ...(c._config || {}), language };
          c._setMode('plan');
          await settle();
          c._roomDialogCancel();
          await settle();
          c._openRoomEdit(c._curSpaceCfg.rooms[0]);
          await settle();
          const dialog = root().querySelector('hp-dialog[data-kind="room"]');
          const basics = dialog.querySelector('[data-card="basics"]');
          const roomFields = !!basics && !basics.querySelector('.hpf-head')
            && !!basics.querySelector('#room-name') && !!basics.querySelector('#room-area')
            && !!basics.querySelector('#room-area')?.closest('.hpf-field')?.querySelector('hp-help')
            && [...dialog.querySelectorAll('.hpf-head h3')].length === 3;

          const toggle = dialog.querySelector('#room-fill-inherit');
          const measure = () => {
            const track = getComputedStyle(toggle, '::before');
            const knob = getComputedStyle(toggle, '::after');
            const content = Number.parseFloat(track.width);
            const height = Number.parseFloat(track.height);
            const left = Number.parseFloat(track.left);
            const top = Number.parseFloat(track.top);
            const borderX = Number.parseFloat(track.borderLeftWidth);
            const borderY = Number.parseFloat(track.borderTopWidth);
            const outerW = content + (track.boxSizing === 'border-box' ? 0 : 2 * borderX);
            const outerH = height + (track.boxSizing === 'border-box' ? 0 : 2 * borderY);
            const knobW = Number.parseFloat(knob.width);
            const knobH = Number.parseFloat(knob.height);
            const knobLeft = Number.parseFloat(knob.left);
            const knobTop = (toggle.getBoundingClientRect().height - knobH) / 2;
            return {
              topGap: knobTop - top - borderY,
              bottomGap: top + outerH - borderY - knobTop - knobH,
              leftGap: knobLeft - left - borderX,
              rightGap: left + outerW - borderX - knobLeft - knobW,
              target: toggle.getBoundingClientRect(),
            };
          };
          toggle.checked = false; toggle.dispatchEvent(new Event('change', { bubbles: true }));
          await settle();
          await new Promise((resolve) => setTimeout(resolve, 220));
          const off = measure();
          toggle.checked = true; toggle.dispatchEvent(new Event('change', { bubbles: true }));
          await settle();
          await new Promise((resolve) => setTimeout(resolve, 220));
          const on = measure();
          const switchAligned = Math.abs(off.topGap - off.bottomGap) <= 1
            && Math.abs(on.topGap - on.bottomGap) <= 1
            && Math.abs(off.leftGap - on.rightGap) <= 1
            && off.target.width >= 44 && off.target.height >= 44;
          // Negative probe: revert just the old track box model. The same
          // geometry oracle must turn red instead of merely reading a CSS token.
          const mutant = document.createElement('style');
          mutant.textContent = '.hpf-toggle > input::before { box-sizing: content-box !important; }';
          root().append(mutant);
          const oldTrack = measure();
          mutant.remove();
          const rejectsOldTrack = Math.abs(oldTrack.topGap - oldTrack.bottomGap) > 1
            && Math.abs(off.leftGap - oldTrack.rightGap) > 1;

          const name = dialog.querySelector('#room-name');
          name.value = `${name.value} x`;
          name.dispatchEvent(new Event('input', { bubbles: true }));
          await settle();
          dialog.dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
          await settle();
          const confirm = root().querySelector('hp-confirm hp-dialog');
          const buttons = [...(confirm?.querySelectorAll('.danger-confirm-footer button') || [])];
          const footer = confirm?.querySelector('.danger-confirm-footer');
          const surface = confirm?.shadowRoot?.querySelector('.surface');
          const footerBounds = footer?.getBoundingClientRect();
          const footerStyle = footer && getComputedStyle(footer);
          const minX = footerBounds.left + Number.parseFloat(footerStyle.paddingLeft);
          const maxX = footerBounds.right - Number.parseFloat(footerStyle.paddingRight);
          const contained = buttons.length === 2 && buttons.every((button) => {
            const b = button.getBoundingClientRect();
            const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            const text = document.createRange();
            text.selectNodeContents(textNode);
            const label = text.getBoundingClientRect();
            return b.left >= minX - 1 && b.right <= maxX + 1
              && label.left >= b.left - 1 && label.right <= b.right + 1
              && label.top >= b.top - 1 && label.bottom <= b.bottom + 1;
          });
          const oneRow = buttons.length === 2
            && Math.abs(buttons[0].getBoundingClientRect().top - buttons[1].getBoundingClientRect().top) <= 1;
          const fits = contained && oneRow && surface.scrollWidth <= surface.clientWidth + 1
            && footer.scrollWidth <= footer.clientWidth + 1 && surface.getBoundingClientRect().left >= -1
            && surface.getBoundingClientRect().right <= innerWidth + 1;
          const labels = buttons.map((button) => button.textContent.trim());
          const discardIcons = confirm?.icon === 'mdi:content-save-off-outline'
            && buttons[1]?.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:content-save-off-outline';
          const safeFocus = (root().activeElement === buttons[0] || document.activeElement === buttons[0])
            && buttons[0].hasAttribute('autofocus');
          buttons[0].click();
          await settle();
          const kept = !!root().querySelector('hp-dialog[data-kind="room"]')
            && !root().querySelector('hp-confirm hp-dialog');
          c._roomDialogCancel();
          await settle();
          return { roomFields, switchAligned, rejectsOldTrack, fits, labels, discardIcons, safeFocus, kept,
            gaps: { off: [off.topGap, off.bottomGap, off.leftGap], on: [on.topGap, on.bottomGap, on.rightGap] } };
        }, { language });
        results[key] = result.roomFields && result.switchAligned && result.rejectsOldTrack && result.fits
          && JSON.stringify(result.labels) === JSON.stringify(expected[language])
          && result.discardIcons && result.safeFocus && result.kept;
        if (!results[key]) console.log(key, result);
      }
    }
  }
  checkAll(results);
  await finish(browser, results);
}
