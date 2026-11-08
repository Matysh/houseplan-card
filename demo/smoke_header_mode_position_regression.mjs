// #1349: opening Properties may narrow the header, but must not lift its controls.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser('#1349 shared header button positions');
const { page, browser } = await launch({ width: 1920, height: 900 });
try {
  for (const placement of ['card', 'panel']) {
    for (const width of [1920, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async ({ placement, width }) => {
        const host = document.getElementById('host');
        host.style.cssText = `width:${width}px;max-width:none;margin:0;padding:0`;
        const card = window.__card;
        card.panelHost = placement === 'panel';
        card.style.height = placement === 'panel' ? '900px' : '';
        card._setMode('view');
        await window.__hpTest.settled();
      }, { placement, width });

      const rows = [];
      for (const mode of ['view', 'plan', 'devices', 'decor', 'view']) {
        // Use the actual navigation controls and wait for their owned transition.
        const selector = mode === 'view' ? '[data-hp="editor-close"]' : `[data-mode="${mode}"]`;
        if (mode !== 'view' || rows.length) {
          await page.locator('houseplan-card').locator('.hdr > .head').locator(selector).click();
        }
        await page.waitForFunction(expected => {
          const card = window.__card;
          return card._mode === expected && !card._modeTransitionBusy && !card._modeTransitionPreparing;
        }, mode);
        await page.evaluate(() => window.__hpTest.settled());
        rows.push(await page.evaluate(() => {
          const root = window.__card.renderRoot, head = root.querySelector('.hdr > .head');
          const rect = head.getBoundingClientRect();
          const controls = {};
          for (const key of ['space-add', 'rotate-left', 'rotate-right', 'zoom-out', 'zoom-fit', 'zoom-in', 'hidden-devices', 'settings', 'pdf', 'support']) {
            const button = head.querySelector(`[data-hp="${key}"]`), bounds = button?.getBoundingClientRect();
            if (bounds?.width && bounds.height) controls[key] = { y: bounds.y, height: bounds.height };
          }
          for (const button of head.querySelectorAll('[data-hp="mode-tab"]')) {
            const bounds = button.getBoundingClientRect();
            if (bounds.width && bounds.height) controls[`mode-${button.dataset.mode}`] = { y: bounds.y, height: bounds.height };
          }
          return { mode: window.__card._mode, wide: head.hasAttribute('data-hp-properties-wide'),
            head: { y: rect.y, height: rect.height }, controls };
        }));
      }
      const before = rows[0], label = `${placement}-${width}`;
      check(`${label}-exercises-wide-properties`, rows.slice(1, 4).every(row => row.wide === (width >= 1024)));
      check(`${label}-shared-buttons-covered`, Object.keys(before.controls).length >= 6);
      for (const [index, row] of rows.entries()) {
        check(`${label}-${row.mode}-${index}-header-stable`,
          Math.abs(row.head.y - before.head.y) < .5 && Math.abs(row.head.height - before.head.height) < .5);
        check(`${label}-${row.mode}-${index}-buttons-stable`, Object.entries(before.controls).every(([key, first]) => {
          const current = row.controls[key];
          return current && Math.abs(current.y - first.y) < .5 && Math.abs(current.height - first.height) < .5;
        }));
      }
      console.log(JSON.stringify({ headerModePositions: { placement, width, rows } }));
    }
  }
} finally {
  await finish(browser);
}
