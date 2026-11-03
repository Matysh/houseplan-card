import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
// #1147: a shared display rule must preserve the native hidden contract.
import { expect } from 'playwright/test';
import { launchColdView, check, finish, captureUiKitSurface } from './serve.mjs';

const { page, browser } = await launchColdView({ width:2000, height:900 });
await prepareDesktopControls(page);
try {
  const badge = page.locator('houseplan-card [data-hp-live-zoom]');
  await expect(badge).toHaveAttribute('hidden', '', { timeout:5000 });
  await expect(badge).toBeHidden();
  check('idle badge has no painted target', await badge.evaluate(node => node.getClientRects().length === 0));
  // Fit can start below100% on a wide host. Cross the badge's actual >100%
  // boundary with visible native commands rather than assuming one increment.
  for(let i=0;i<10 && await badge.isHidden();i++) {
    await page.locator('houseplan-card [data-hp="zoom-in"]').click();
    await page.waitForTimeout(250);
  }
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('%');
  await captureUiKitSurface(page, 'plan-chrome-overlays', 'houseplan-card [data-hp-live-zoom]');
  await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
  await expect(badge).toHaveAttribute('hidden', '', { timeout:5000 });
  await expect(badge).toBeHidden();
  check('fit at rest has no painted target', await badge.evaluate(node => node.getClientRects().length === 0));
} finally { await finish(browser); }
