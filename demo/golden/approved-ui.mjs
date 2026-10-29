/** #1119: native information/summary surfaces, never injected product markup. */
export async function prepareApprovedUi(page, scenario) {
  let dialog;
  if (scenario.approvedUi === 'info') {
    const marker = page.locator('[data-hp="device"][data-id="golden-light-one"]');
    await marker.hover(); await page.mouse.down();
    await page.waitForTimeout(700); await page.mouse.up();
    dialog = page.locator('hp-dialog[data-kind="info"]');
  } else if (scenario.approvedUi === 'summary') {
    await page.locator('[data-hp="summary-settings"]').first().click();
    dialog = page.locator('hp-dialog[data-kind="summary"]');
  } else throw new Error(`unknown approved UI surface: ${scenario.approvedUi}`);
  await dialog.waitFor({ state: 'visible' });
  return dialog.evaluate(async node => {
    await node.updateComplete;
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await frames();
    await Promise.allSettled(node.getAnimations({ subtree: true })
      .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
      .map(animation => animation.finished));
    await frames();
    const header = node.shadowRoot.querySelector('.header');
    if (!node.matches('[form-shell][settings-layout][compact]') || !header)
      throw new Error('approved UI surface did not adopt the real common form shell');
    const fields = node.querySelectorAll('.hpf-row,.summary-field').length;
    const inputs = node.querySelectorAll('input[type="text"]').length;
    const sources = node.querySelectorAll('.summary-source').length;
    if (node.dataset.kind === 'summary' && (inputs < 5 || sources < 3))
      throw new Error('approved Summary Golden must render its actual supported title/block/value form, not a local-only switch');
    return { kind: node.dataset.kind, title: node.title,
      header: Math.round(header.getBoundingClientRect().height), fields, inputs, sources };
  });
}
