/** Explicit desktop fixture: the demo's fixed 780px host is not the viewport.
 * Resize the embedding container normally; never reveal hidden controls. */
export async function prepareDesktopControls(page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width < 1024) throw Error('Desktop controls require an explicitly wide viewport');
  await page.locator('#host').evaluate(host => host.style.removeProperty('width'));
  // A later, deliberate compact phase must still be able to override this.
  await page.addStyleTag({ content: '#host { width:calc(100vw - 16px); }' });
  await page.locator('houseplan-card').first().locator('[data-hp="zoom-fit"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
