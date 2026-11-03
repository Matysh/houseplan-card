/** Public host geometry: no title, outer menu or reserved appbar space (#1120). */
import { expect } from '@playwright/test';
import { HP } from './hooks.mjs';

export async function expectPanelShell(panel, host) {
  await expect(panel).toBeVisible();
  await expect(host).toBeVisible();
  await expect(panel.locator(HP.panelTitle)).toHaveCount(0);
  // Count the whole panel, so an obsolete outer menu cannot escape the check.
  await expect.poll(async () => (await panel.locator(HP.panelMenu).count())
    - (await host.locator(HP.panelMenu).count())).toBe(0);
  // An empty outer bar without a title still consumes real space. Compare the
  // public element bounds, independent of the shell's private markup/CSS.
  await expect.poll(async () => {
    const outer = await panel.boundingBox(), inner = await host.boundingBox();
    if (!outer || !inner) return Number.POSITIVE_INFINITY;
    return Math.max(Math.abs(inner.y - outer.y),
      Math.abs(inner.y + inner.height - outer.y - outer.height));
  }, { message: 'card fills the panel height without an outer appbar reserve' })
    .toBeLessThanOrEqual(1);
}

/** The custom panel entry can be below the fold in HA's own scrollable menu. */
export async function expectNativeDrawerEntry(page) {
  const entry = page.locator('ha-sidebar a[href="/houseplan"]');
  // A native scroll makes the oracle independent of sidebar ordering. It does
  // not click/focus the entry or send a menu event; the drawer must already open.
  await entry.scrollIntoViewIfNeeded();
  await expect(entry).toBeInViewport({ ratio: 0.9 });
}
