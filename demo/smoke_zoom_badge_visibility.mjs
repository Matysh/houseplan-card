// #1147: a shared display rule must preserve the native hidden contract.
import { expect } from 'playwright/test';
import { launchColdView, check, finish, captureUiKitSurface } from './serve.mjs';

const { page, browser } = await launchColdView({ width:1280, height:900 });
try {
  const badge = page.locator('houseplan-card [data-hp-live-zoom]');
  await expect(badge).toHaveAttribute('hidden', '', { timeout:5000 });
  await expect(badge).toBeHidden();
  check('idle badge has no painted target', await badge.evaluate(node => node.getClientRects().length === 0));
  await page.locator('houseplan-card [data-hp="zoom-in"]').click();
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('%');
  await captureUiKitSurface(page, 'plan-chrome-overlays', 'houseplan-card [data-hp-live-zoom]');
  await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
  await expect(badge).toHaveAttribute('hidden', '', { timeout:5000 });
  await expect(badge).toBeHidden();
  check('fit at rest has no painted target', await badge.evaluate(node => node.getClientRects().length === 0));
} finally { await finish(browser); }
