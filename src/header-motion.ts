import { controlMotion } from './ui-motion';

export type HeaderPosition = { x: number; y: number };
type Position = HeaderPosition;
export function headerControls(head: ParentNode | null): Array<[string, HTMLElement]> {
  const counts = new Map<string, number>();
  return Array.from(head?.querySelectorAll<HTMLElement>(
    'button, hp-settings-select, span.compact-space-select[data-hp="space-select"]',
  ) ?? []).map(element => {
    const identity = element.dataset.editorNavigation || element.dataset.hp
      || element.getAttribute('aria-label') || element.className;
    const index = counts.get(identity) ?? 0;
    counts.set(identity, index + 1);
    return [`${identity}:${index}`, element];
  });
}
/** FLIP translations of the real controls; text and icons are never scaled.
 * Responsive choice is already final before start, and is not recomputed here. */
export class HeaderMotion {
  private animations: Animation[] = [];
  private origin: Position = { x: 0, y: 0 };
  capture(head: ParentNode | null): Map<string, Position> {
    const bounds = (head as HTMLElement | null)?.getBoundingClientRect?.();
    if (bounds) this.origin = { x: bounds.x, y: bounds.y };
    return new Map(headerControls(head).map(([key, element]) => {
      const rect = element.getBoundingClientRect(); return [key, { x: rect.x, y: rect.y }];
    }));
  }
  start(head: ParentNode | null, before: Map<string, Position>, reduced: boolean, positions?: ReadonlyMap<string, HeaderPosition>): void {
    this.cancel();
    if (reduced) return;
    // Measure all controls before any animation writes invalidate style.
    const controls = headerControls(head).map(([key, element]) => {
      const point = positions?.get(key);
      const end = positions
        ? point ? { x: this.origin.x + point.x, y: this.origin.y + point.y, width: 1, height: 1 } : null
        : element.getBoundingClientRect();
      return { key, element, end };
    });
    for (const { key, element, end } of controls) {
      const start = before.get(key);
      if (!start || !end || !end.width || !end.height || typeof element.animate !== 'function') continue;
      const x = start.x - end.x, y = start.y - end.y;
      if (Math.abs(x) < .5 && Math.abs(y) < .5) continue;
      const animation = element.animate([{ translate: `${x}px ${y}px` }, { translate: '0 0' }], controlMotion.mode);
      this.animations.push(animation);
      void animation.finished.catch(() => undefined);
    }
  }
  cancel(): void { for (const animation of this.animations) animation.cancel(); this.animations = []; }
}
