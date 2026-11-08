/** Exercise the visible product route in either intrinsic header layout. */
export async function headerActionTarget(card, action) {
  const mode = action.startsWith('mode-') ? action.slice(5) : null;
  const original = card.locator(mode === 'view' ? '.head [data-hp="editor-close"]'
    : mode ? '.head [data-hp="mode-tab"][data-mode="' + mode + '"]' : '.head [data-hp="' + action + '"]');
  if (await original.isVisible()) return original;
  const sheet = card.locator('[data-hp="header-actions-menu"]:not([inert])');
  if (!await sheet.isVisible()) await card.locator('[data-hp="header-actions-trigger"]').click();
  return sheet.locator('[data-action="' + action + '"]');
}
export async function clickHeaderAction(card, action) { await (await headerActionTarget(card, action)).click(); }
