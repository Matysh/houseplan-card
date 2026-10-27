/** #1089 uses the native View trigger and the shared menu, never a drawn replica. */
export async function prepareViewDeviceMenu(page, scenario) {
  const card = page.locator('houseplan-card');
  if (scenario.viewDeviceMenu === 'hidden') {
    await card.locator('[data-hp="hidden-devices"]').click();
    await page.waitForFunction(() => !!window.__goldenCard.renderRoot.querySelector('[data-hp="device"][data-id="golden-light-two"]'));
  }
  const marker = card.locator('[data-hp="device"][data-id="golden-light-two"]');
  const anchor = await marker.boundingBox();
  await marker.click({ button: 'right' });
  const menu = card.locator('[data-hp="device-context-menu"]:not([inert])');
  await menu.waitFor();
  await page.mouse.move(4, 4);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const result = await menu.evaluate(node => {
    const r = node.getBoundingClientRect(), buttons = [...node.querySelectorAll('button')];
    return { text: buttons.map(b => b.textContent.trim()), disabled: buttons.map(b => b.disabled),
      bounds: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      fits: r.left >= 7 && r.top >= 7 && r.right <= innerWidth - 7 && r.bottom <= innerHeight - 7,
      horizontalOverflow: node.scrollWidth > node.clientWidth, styled: getComputedStyle(node).display === 'grid' };
  });
  if (result.text.length !== 5 || !result.fits || result.horizontalOverflow || !result.styled) throw Error('View menu did not paint its five shared styled commands inside the viewport');
  if (scenario.canWrite === false && JSON.stringify(result.disabled) !== '[true,false,false,true,true]') throw Error('Read-only menu must retain both information commands and three disabled writer commands');
  if (scenario.viewDeviceMenu === 'edge') {
    const pointY = anchor.y + anchor.height / 2, height = result.bounds.bottom - result.bounds.top;
    if (pointY + height <= scenario.viewport.height - 8 || result.bounds.top >= pointY) throw Error('Edge fixture must actually avoid overflowing below its native anchor: ' + JSON.stringify({ pointY, height, bounds: result.bounds }));
  }
  if (scenario.viewDeviceMenu === 'hidden' && result.text[3] !== 'Показать на плане') throw Error('Hidden-eye menu must offer the saved Show command');
  return result;
}
