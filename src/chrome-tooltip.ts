import { floatingViewport, placeFloatingSurface } from './floating-surface';
import { helpSurfaceStyle } from './styles/help-surface.styles';

let sequence = 0;
/** One non-interactive top-layer bubble for the current mounted card. */
export class ChromeTooltip {
  private readonly bubble: HTMLElement;
  private readonly style: HTMLStyleElement;
  private owner: Element | null = null;
  private openTimer = 0;
  private closeTimer = 0;
  private frame = 0;
  private epoch = 0;
  constructor(private readonly root: ShadowRoot) {
    const doc = root.ownerDocument;
    this.style = doc.createElement('style');
    this.style.textContent = `.hp-chrome-tooltip{${helpSurfaceStyle}position:fixed;inset:auto;margin:0;z-index:2147483647;pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity 120ms ease,transform 120ms ease;}.hp-chrome-tooltip.visible{opacity:1;transform:none}.hp-chrome-tooltip[hidden],.hp-chrome-tooltip[popover]:not(:popover-open){display:none}@media(prefers-reduced-motion:reduce){.hp-chrome-tooltip{transition:none;transform:none}}`;
    this.bubble = doc.createElement('div'); this.bubble.className = 'hp-chrome-tooltip';
    this.bubble.id = `hp-chrome-tooltip-${++sequence}`; this.bubble.setAttribute('role','tooltip');
    this.bubble.setAttribute('popover','manual'); this.bubble.hidden = true;
    root.append(this.style,this.bubble);
  }
  show(owner: Element, point: { x:number; y:number }): void {
    this.hide(); this.owner = owner;
    const epoch = this.epoch, win = this.root.ownerDocument.defaultView!;
    const text = owner.getAttribute('data-hp-tooltip');
    this.openTimer = win.setTimeout(() => {
      this.openTimer = 0;
      if (epoch !== this.epoch || !owner.isConnected || text !== owner.getAttribute('data-hp-tooltip') || !owner.getClientRects().length) return;
      // A complete Lit render may have replaced the root's previous children.
      if (!this.bubble.isConnected) this.root.append(this.style,this.bubble);
      this.bubble.textContent = text; this.bubble.hidden = false;
      if (typeof this.bubble.showPopover === 'function') this.bubble.showPopover();
      else this.bubble.removeAttribute('popover');
      const viewport = floatingViewport(win);
      this.bubble.style.maxWidth = `${Math.min(320,Math.max(0,viewport.width-16))}px`;
      this.bubble.style.maxHeight = `${Math.max(0,viewport.height-16)}px`;
      const box = this.bubble.getBoundingClientRect();
      const anchor = {left:point.x+14, right:point.x+14, top:point.y-12, bottom:point.y+18, width:0, height:30};
      const position = placeFloatingSurface(anchor,box,viewport,0,8);
      this.bubble.style.left = `${position.left}px`; this.bubble.style.top = `${position.top}px`;
      const descriptions = new Set((owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      descriptions.add(this.bubble.id); owner.setAttribute('aria-describedby',[...descriptions].join(' '));
      this.frame = win.requestAnimationFrame(() => { this.frame = 0; if (epoch === this.epoch) this.bubble.classList.add('visible'); });
    },300);
  }
  hide(): void {
    this.epoch++;
    const win = this.root.ownerDocument.defaultView!;
    win.clearTimeout(this.openTimer); win.clearTimeout(this.closeTimer); win.cancelAnimationFrame(this.frame);
    this.openTimer = this.closeTimer = this.frame = 0;
    if (this.owner) {
      const descriptions = (this.owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(id=>id && id!==this.bubble.id);
      if (descriptions.length) this.owner.setAttribute('aria-describedby',descriptions.join(' '));
      else this.owner.removeAttribute('aria-describedby');
    }
    this.owner = null; this.bubble.classList.remove('visible');
    this.closeTimer = win.setTimeout(() => {
      this.closeTimer = 0;
      if (this.bubble.matches(':popover-open')) this.bubble.hidePopover();
      this.bubble.hidden = true;
    },120);
  }
  dispose(): void {
    this.hide(); this.root.ownerDocument.defaultView!.clearTimeout(this.closeTimer);
    this.bubble.remove(); this.style.remove();
  }
}
