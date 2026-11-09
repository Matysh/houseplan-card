/** Resolve a painted target, including disclosure clipping, without waiting away
 * unrelated mode motion. Disabled items remain inspectable by their callers. */
async function waitForHeaderTarget(card, target) {
  const deadline = Date.now() + 2500;
  for (;;) {
    const painted = await target.evaluate(button => {
      const r = button.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return false;
      if (button.matches(':disabled,[aria-disabled="true"]')) return true;
      const hit = button.getRootNode().elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return hit === button || button.contains(hit);
    });
    if (painted) return target;
    if (Date.now() >= deadline) throw Error('Header menu target did not become painted and hittable');
    await card.evaluate(() => new Promise(requestAnimationFrame));
  }
}

/** Exercise the visible product route in either intrinsic header layout. */
export async function headerActionTarget(card, action) {
  await card.evaluate(async host => {
    await document.fonts.ready;
    let prior = '', stable = 0;
    const deadline = performance.now() + 2000;
    while (stable < 3) {
      await new Promise(requestAnimationFrame);
      const head = host.renderRoot.querySelector('.head'), box = head?.getBoundingClientRect();
      const key = JSON.stringify([box?.width,box?.height,head?.closest('.hdr')?.getAttribute('data-panel-flow'),
        [...head?.querySelectorAll('button') || []].map(button=>button.getClientRects().length)]);
      stable = key === prior ? stable + 1 : 0; prior = key;
      if (performance.now() > deadline) throw Error('Header command layout did not settle');
    }
  });
  const mode = action.startsWith('mode-') ? action.slice(5) : null;
  const original = card.locator(mode === 'view' ? '.head [data-hp="editor-close"]'
    : mode ? '.head [data-hp="mode-tab"][data-mode="' + mode + '"]' : '.head [data-hp="' + action + '"]');
  if (await original.isVisible()) return waitForHeaderTarget(card, original);
  const sheet = card.locator('[data-hp="header-actions-menu"]:not([inert])');
  if (!await sheet.isVisible()) await card.locator('[data-hp="header-actions-trigger"]').click();
  const target = sheet.locator('[data-action="' + action + '"]');
  await target.waitFor({state:'visible'});
  return waitForHeaderTarget(card, target);
}
export async function clickHeaderAction(card, action) { await (await headerActionTarget(card, action)).click(); }
