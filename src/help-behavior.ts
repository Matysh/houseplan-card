/** Pure content gate shared by the component and executable unit tests. */
export function helpHasContent(text: unknown, ariaLabel: unknown): boolean {
  return typeof text === 'string' && text.trim().length > 0
    && typeof ariaLabel === 'string' && ariaLabel.trim().length > 0;
}

/** Scrolling the floating help itself must not dismiss it. */
export function helpScrollShouldDismiss(
  pathIsInsideFloatingSurface: boolean,
  targetIsDialogOrContainsHelp: boolean,
): boolean {
  return !pathIsInsideFloatingSurface && targetIsDialogOrContainsHelp;
}
