import { controlMotion } from './ui-motion';

type Position = { x: number; y: number };
/** FLIP translations of the real controls; text and icons are never scaled.
 * Responsive choice is already final before start, and is not recomputed here. */
export class HeaderMotion {
  private animations: Animation[] = [];
  capture(head: ParentNode | null): Map<string, Position> {
    return new Map(this.controls(head).map(([key, element]) => {
      const rect = element.getBoundingClientRect(); return [key, { x: rect.x, y: rect.y }];
    }));
  }
  private controls(head: ParentNode | null): Array<[string, HTMLElement]> {
    const counts = new Map<string, number>();
    return Array.from(head?.querySelectorAll<HTMLElement>('button, hp-settings-select') ?? []).map(element => {
      const identity = element.dataset.editorNavigation || element.dataset.hp
        || element.getAttribute('aria-label') || element.className;
      const index = counts.get(identity) ?? 0; counts.set(identity, index + 1);
      return [`${identity}:${index}`, element];
    });
  }
  start(head: ParentNode | null, before: Map<string, Position>, reduced: boolean): void {
    this.cancel();
    if (reduced) return;
    for (const [key, element] of this.controls(head)) {
      const start = before.get(key), end = element.getBoundingClientRect();
      if (!start || !end.width || !end.height || typeof element.animate !== 'function') continue;
      const x = start.x - end.x, y = start.y - end.y;
      if (Math.abs(x) < .5 && Math.abs(y) < .5) continue;
      const animation = element.animate([{ translate: `${x}px ${y}px` }, { translate: '0 0' }], controlMotion.mode);
      this.animations.push(animation);
      void animation.finished.catch(() => undefined);
    }
  }
  cancel(): void { for (const animation of this.animations) animation.cancel(); this.animations = []; }
}
