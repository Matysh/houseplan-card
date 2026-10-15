import { clampSurfacePosition, type SurfacePoint } from './canvas-surface-gestures';
import { ROOM_GEAR_DRAG_THRESHOLD_PX } from './room-gear-drag';

/** A DOM-only owner. No camera, geometry, persistence or per-frame host render. */
export class WallThicknessDialogGesture {
  private element: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private frame = 0;
  private drag: { id: number; start: SurfacePoint; origin: SurfacePoint; moved: boolean } | null = null;

  public readonly bind = (element?: Element): void => {
    if (element === this.element) return;
    this.dispose();
    if (!(element instanceof HTMLElement)) return;
    this.element = element;
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      element.addEventListener(type, this.end);
    for (const type of ['click', 'dblclick']) element.addEventListener(type, this.stop);
    element.addEventListener('wheel', this.wheel, { passive: false });
    this.observer = new ResizeObserver(() => this.scheduleClamp());
    this.observer.observe(element);
    const stage = element.closest('.stage');
    if (stage) this.observer.observe(stage);
    this.scheduleClamp();
  };

  public dispose(): void {
    this.finish();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.observer?.disconnect();
    this.observer = null;
    const element = this.element;
    this.element = null;
    if (!element) return;
    element.removeEventListener('pointerdown', this.down);
    element.removeEventListener('pointermove', this.move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      element.removeEventListener(type, this.end);
    for (const type of ['click', 'dblclick']) element.removeEventListener(type, this.stop);
    element.removeEventListener('wheel', this.wheel);
  }

  private readonly stop = (event: Event): void => { event.stopPropagation(); };
  private readonly wheel = (event: WheelEvent): void => {
    event.stopPropagation();
    event.preventDefault(); // Keep focused number inputs unchanged too.
  };
  private readonly down = (event: PointerEvent): void => {
    event.stopPropagation();
    if (this.drag || event.button !== 0 || !event.isPrimary
        || event.composedPath().some((node) => node instanceof Element && node.matches('input,button')))
      return;
    const position = this.position();
    if (!position) return;
    event.preventDefault(); // Only the handle: fields retain native selection.
    this.drag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY },
      origin: position, moved: false };
    try { this.element?.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
  };
  private readonly move = (event: PointerEvent): void => {
    event.stopPropagation();
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) <= ROOM_GEAR_DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    this.element?.classList.add('dragging');
    this.place({ x: drag.origin.x + dx, y: drag.origin.y + dy });
  };
  private readonly end = (event: Event): void => {
    event.stopPropagation();
    if (this.drag?.id === (event as PointerEvent).pointerId) this.finish();
  };

  private finish(): void {
    const drag = this.drag;
    this.drag = null; // A synchronous lostpointercapture cannot finish twice.
    this.element?.classList.remove('dragging');
    try {
      if (drag && this.element?.hasPointerCapture(drag.id)) this.element.releasePointerCapture(drag.id);
    } catch { /* already terminal or detached */ }
  }

  private position(): SurfacePoint | null {
    const element = this.element, stage = element?.closest<HTMLElement>('.stage');
    if (!element || !stage || !element.isConnected) return null;
    const rect = element.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
    return { x: rect.left - bounds.left - stage.clientLeft, y: rect.top - bounds.top - stage.clientTop };
  }

  private place(position: SurfacePoint): void {
    const element = this.element, stage = element?.closest<HTMLElement>('.stage');
    if (!element || !stage || !element.isConnected) return;
    const rect = element.getBoundingClientRect();
    const point = clampSurfacePosition(position, rect, { width: stage.clientWidth, height: stage.clientHeight });
    element.style.transform = 'none';
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  }

  private scheduleClamp(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const position = this.position();
      if (position) this.place(position);
    });
  }
}
