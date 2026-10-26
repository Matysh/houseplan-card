// #1081/UI-034/035: both browser capability paths of the shared real component.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1000, height: 850 });
try {
  for (const fallback of [false, true]) {
    const family = fallback ? 'fallback' : 'native';
    await page.evaluate(async fallback => {
      if (fallback) {
        // Browser capability absence is an environment input, never a source patch.
        window.__motionPopoverDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
        Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined });
      }
      const picker = document.createElement('hp-color-opacity'); picker.setAttribute('data-motion-fixture', '');
      picker.style.cssText = 'position:fixed;left:24px;top:24px;z-index:2147483647';
      picker.color = '#2266aa'; picker.label = 'Motion'; document.body.append(picker); await picker.updateComplete;
    }, fallback);
    const picker = page.locator('hp-color-opacity[data-motion-fixture]');
    await picker.locator('.trigger').click();
    const state = await picker.evaluate(picker => {
      const surface = picker.shadowRoot.querySelector('.picker') || document.querySelector('[data-hp-overlay="color-opacity"]')?.shadowRoot.querySelector('.picker');
      const animation = surface.getAnimations()[0];
      return { duration: animation?.effect.getTiming().duration, easing: animation?.effect.getTiming().easing,
        frames: animation?.effect.getKeyframes().map(frame => [frame.opacity, frame.transform]), popover: surface.hasAttribute('popover') };
    });
    check(`${family}.enter_160ms`, state.duration, 160); check(`${family}.entry_easing`, state.easing, 'cubic-bezier(0.2, 0.7, 0.2, 1)');
    check(`${family}.entry_side_translation`, state.frames?.[0]?.[1], 'translateY(-4px)'); check(`${family}.capability_path`, state.popover, !fallback);
    await picker.evaluate(async picker => {
      const surface = picker.shadowRoot.querySelector('.picker') || document.querySelector('[data-hp-overlay="color-opacity"]')?.shadowRoot.querySelector('.picker');
      await Promise.all(surface.getAnimations().map(animation => animation.finished)); surface.querySelector('input[type="text"]').focus();
    });
    await page.keyboard.press('Escape');
    const exit = await picker.evaluate(picker => {
      const surface = picker.shadowRoot.querySelector('.picker') || document.querySelector('[data-hp-overlay="color-opacity"]')?.shadowRoot.querySelector('.picker');
      const trigger = picker.shadowRoot.querySelector('.trigger');
      return { open: picker.pickerOpen, inert: surface?.inert, duration: surface?.getAnimations()[0]?.effect.getTiming().duration,
        suppressed: trigger.hasAttribute('data-restored-focus'), outline: getComputedStyle(trigger).outlineStyle };
    });
    check(`${family}.exit_120ms`, exit.duration, 120); check(`${family}.exit_inert`, exit.inert, true);
    check(`${family}.escape_closes`, exit.open, false); check(`${family}.restored_focus_no_ring`, exit.suppressed && exit.outline === 'none', true);
    await picker.locator('.trigger').click();
    check(`${family}.rapid_reopen_one_surface`, await picker.evaluate(picker => {
      const native = picker.shadowRoot.querySelectorAll('.picker').length;
      const fallback = [...document.querySelectorAll('[data-hp-overlay="color-opacity"]')].reduce((sum, host) => sum + host.shadowRoot.querySelectorAll('.picker').length, 0);
      return picker.pickerOpen && native + fallback === 1;
    }), true);
    await page.keyboard.press('Tab');
    check(`${family}.deliberate_tab_restores_focus_contract`, await picker.locator('.trigger').getAttribute('data-restored-focus'), null);
    await picker.evaluate(async picker => { picker.disabled = true; await picker.updateComplete; });
    check(`${family}.disabled_clears_immediately`, await page.locator('[data-hp-overlay="color-opacity"]').count() + await picker.locator('.picker').count(), 0);
    await picker.evaluate(async picker => { picker.disabled = false; await picker.updateComplete; await picker.togglePicker(); picker.closePicker(); picker.remove(); });
    check(`${family}.detach_clears_portal`, await page.locator('[data-hp-overlay="color-opacity"]').count(), 0);
    if (fallback) await page.evaluate(() => Object.defineProperty(HTMLElement.prototype, 'showPopover', window.__motionPopoverDescriptor));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('picker.reduced_motion_has_no_animation', await page.evaluate(async () => {
    const picker = document.createElement('hp-color-opacity'); picker.style.cssText = 'position:fixed;left:24px;top:24px'; document.body.append(picker);
    await picker.updateComplete; await picker.togglePicker(); const surface = picker.shadowRoot.querySelector('.picker');
    const none = surface.getAnimations().length === 0; picker.closePicker(); await picker.updateComplete;
    const closed = !picker.shadowRoot.querySelector('.picker'); picker.remove(); return none && closed;
  }), true);
} finally { await finish(browser); }
