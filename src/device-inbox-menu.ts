import type { FloatingViewport, RectLike } from './floating-surface';

/** A menu stays inside the dialog's one visible body, not below its footer. */
export function inboxMenuViewport(header: RectLike, footer: RectLike, viewport: FloatingViewport): FloatingViewport {
  const left = Math.max(viewport.left, header.left);
  const right = Math.min(viewport.left + viewport.width, header.right);
  const top = Math.max(viewport.top, header.bottom);
  const bottom = Math.min(viewport.top + viewport.height, footer.top);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
