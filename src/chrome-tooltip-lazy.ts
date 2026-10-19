import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ChromeTooltip } from './chrome-tooltip';

type Host = ReactiveControllerHost & HTMLElement & { renderRoot: HTMLElement | DocumentFragment };
/** View pays for the small event bridge; bubble code loads on its first use. */
export class LazyChromeTooltips implements ReactiveController {
  private events: AbortController | null = null;
  private tooltip: ChromeTooltip | null = null;
  private load: Promise<typeof import('./chrome-tooltip')> | null = null;
  private epoch = 0;
  private owner: Element | null = null;
  private stamp = '';
  private text = '';
  constructor(private readonly host: Host, private readonly context: () => string) { host.addController(this); }
  private readonly show = (event: Event): void => {
    if (event instanceof PointerEvent && event.pointerType !== 'mouse') return;
    const owner = event.composedPath().find((item): item is Element => item instanceof Element && item.hasAttribute('data-hp-tooltip'));
    if (event instanceof FocusEvent && !owner?.matches(':focus-visible')) return;
    if (!owner?.getAttribute('data-hp-tooltip') || owner === this.owner) return;
    this.hide(); this.owner = owner; this.stamp = this.context(); this.text = owner.getAttribute('data-hp-tooltip')!;
    const epoch = this.epoch, rect = owner.getBoundingClientRect();
    const point = event instanceof PointerEvent ? { x:event.clientX, y:event.clientY } : { x:rect.left, y:rect.bottom };
    this.load ??= import('./chrome-tooltip');
    void this.load.then(({ChromeTooltip}) => {
      if (epoch !== this.epoch || !this.host.isConnected || !this.valid()) return;
      this.tooltip ??= new ChromeTooltip(this.host.renderRoot as ShadowRoot);
      this.tooltip.show(owner,point);
    }).catch(() => { this.load = null; this.hide(); });
  };
  private valid(): boolean {
    return !!this.owner?.isConnected && this.stamp === this.context() && this.text === this.owner.getAttribute('data-hp-tooltip')
      && !this.owner.closest('[inert],[hidden],[aria-hidden="true"]') && this.owner.getClientRects().length > 0;
  }
  private readonly hide = (): void => { this.epoch++; this.owner = null; this.tooltip?.hide(); };
  private readonly leave = (event: Event): void => {
    const related = (event as FocusEvent).relatedTarget;
    if (this.owner && !(related instanceof Node && this.owner.contains(related))) this.hide();
  };
  private readonly key = (event: Event): void => { if ((event as KeyboardEvent).key === 'Escape') this.hide(); };
  hostConnected(): void {
    const root = this.host.renderRoot, { signal } = this.events = new AbortController();
    for (const type of ['pointerover','focusin']) root.addEventListener(type,this.show,{capture:true,signal});
    for (const type of ['pointerout','focusout']) root.addEventListener(type,this.leave,{capture:true,signal});
    for (const type of ['pointerdown','wheel','scroll']) root.addEventListener(type,this.hide,{capture:true,passive:true,signal});
    const win = this.host.ownerDocument.defaultView;
    for (const type of ['blur','resize','pagehide']) win?.addEventListener(type,this.hide,{signal});
    win?.addEventListener('keydown',this.key,{capture:true,signal});
    this.host.ownerDocument.addEventListener('visibilitychange',this.hide,{signal});
  }
  hostUpdated(): void { if (this.owner && !this.valid()) this.hide(); }
  hostDisconnected(): void {
    this.hide(); this.tooltip?.dispose(); this.tooltip = null;
    this.events?.abort(); this.events = null;
  }
}
