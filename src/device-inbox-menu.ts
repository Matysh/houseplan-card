import { floatingViewport, placeFloatingSurface, type FloatingViewport, type RectLike } from './floating-surface';

/** A menu stays inside the dialog's one visible body, not below its footer. */
export function inboxMenuViewport(header: RectLike, footer: RectLike, viewport: FloatingViewport): FloatingViewport {
  const left = Math.max(viewport.left, header.left);
  const right = Math.min(viewport.left + viewport.width, header.right);
  const top = Math.max(viewport.top, header.bottom);
  const bottom = Math.min(viewport.top + viewport.height, footer.top);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Native details/buttons retain their existing actions and keyboard order.
 * Read layout only on opening, never in the card's render path. Position is
 * local to details, so it continues to follow its row when the body scrolls.
 */
export function positionInboxMenu(event: Event): void {
  const details = event.currentTarget as HTMLDetailsElement;
  if (!details.open || !details.isConnected) return;
  const shell = details.closest('hp-dialog');
  const header = shell?.shadowRoot?.querySelector<HTMLElement>('.header');
  const footer = shell?.querySelector<HTMLElement>('[slot=footer]');
  const menu = details.querySelector<HTMLElement>('.device-inbox-menu-items');
  const win = details.ownerDocument.defaultView;
  if (!menu || !header || !footer || !win) return;
  const viewport = inboxMenuViewport(header.getBoundingClientRect(), footer.getBoundingClientRect(), floatingViewport(win));
  menu.style.boxSizing = 'border-box';
  menu.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
  menu.style.minWidth = `${Math.min(180, Math.max(0, viewport.width - 16))}px`;
  menu.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
  menu.style.overflowY = 'auto';
  const anchor = details.getBoundingClientRect();
  const place = placeFloatingSurface(anchor, menu.getBoundingClientRect(), viewport, 4);
  const scaleX = anchor.width / details.offsetWidth || 1;
  const scaleY = anchor.height / details.offsetHeight || 1;
  menu.style.insetInlineEnd = 'auto';
  menu.style.left = `${(place.left - anchor.left) / scaleX}px`;
  menu.style.top = `${(place.top - anchor.top) / scaleY}px`;
}
