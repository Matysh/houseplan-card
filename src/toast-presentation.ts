import { controlMotion, controlMotionReduced, controlSurfaceFrames } from './ui-motion';

/** One notice node per card; a message keeps its originating surface. */
export type ToastOwner = { host: HTMLElement; portal: () => HTMLElement | null };
export type ToastContext = { readonly owner: ToastOwner | null };
export type ToastCallback = (message: string, id?: string) => void;

/** Capture before awaiting work, never when its result happens to arrive. */
export function captureToast(host: {
  _showToast?(message: string, id?: string): void;
  _captureToast?: () => ToastCallback;
}): ToastCallback {
  return host._captureToast?.() ?? ((message, id) => host._showToast?.(message, id));
}
type Scope = { owners: ToastOwner[]; refresh?: () => void };
const scopes = new WeakMap<Node, Scope>();
type Bounds = { left: number; top: number; right: number; bottom: number };
/** The visible plan excludes the properties panel (which is outside stage). */
export function visibleToastBounds(stage: Bounds | null, viewport: Bounds): Bounds {
  if (!stage) return viewport;
  const rect = { left: Math.max(stage.left, viewport.left), top: Math.max(stage.top, viewport.top),
    right: Math.min(stage.right, viewport.right), bottom: Math.min(stage.bottom, viewport.bottom) };
  return rect.right > rect.left && rect.bottom > rect.top ? rect : viewport;
}
export function toastRootOf(element: HTMLElement): Node {
  let root = element.getRootNode();
  while (root instanceof ShadowRoot && root.host.localName !== 'houseplan-card') root = root.host.getRootNode();
  return root;
}
const scopeFor = (root: Node): Scope => {
  let scope = scopes.get(root);
  if (!scope) { scope = { owners: [] }; scopes.set(root, scope); }
  return scope;
};

export function setToastOwner(root: Node, owner: ToastOwner, active: boolean): void {
  const scope = scopeFor(root);
  scope.owners = scope.owners.filter(item => item !== owner);
  if (active) scope.owners.push(owner);
  scope.refresh?.();
}

export class ToastPresentation {
  private _root?: ShadowRoot;
  private _notice?: HTMLDivElement;
  private _context: ToastContext = { owner: null };
  private _frame = 0;
  private _animation: Animation | null = null;
  private _generation = 0;
  private _leaving = false;
  private _observer?: ResizeObserver;
  private _stage: Element | null = null;
  private _view?: Window | null;
  private readonly _position = (): void => {
    const root = this._root, notice = this._notice, view = this._view;
    if (!root || !notice || !view) return;
    const modal = notice.parentElement !== root.querySelector('[data-hp="toast-portal"]');
    if (modal) {
      notice.style.removeProperty('left'); notice.style.removeProperty('bottom');
      notice.style.removeProperty('max-width'); return;
    }
    const viewport = view.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? view.innerWidth);
    const bottom = top + (viewport?.height ?? view.innerHeight);
    const stage = root.querySelector('.stage');
    const rect = visibleToastBounds(stage?.getBoundingClientRect() ?? null, { left, top, right, bottom });
    notice.style.left = `${(rect.left + rect.right) / 2}px`;
    notice.style.bottom = `${Math.max(0, view.innerHeight - rect.bottom) + 22}px`;
    notice.style.maxWidth = `${Math.max(1, rect.right - rect.left - 24)}px`;
    if (stage !== this._stage) {
      this._observer?.disconnect(); this._stage = stage;
      if (stage) this._observer?.observe(stage);
    }
  };
  private readonly _route = (): void => {
    const root = this._root, notice = this._notice;
    if (!root || !notice) return;
    const owner = this._context.owner;
    const target = (owner?.host.isConnected && scopeFor(root).owners.includes(owner) ? owner.portal() : null)
      || root.querySelector('[data-hp="toast-portal"]');
    if (!target) return;
    if (target === notice.parentElement) { this._position(); return; }
    // Closing its owner may return the notice to the card, never to another
    // dialog. Neither readiness nor retirement re-announces existing text.
    notice.setAttribute('aria-live', 'off');
    notice.removeAttribute('role');
    target.appendChild(notice);
    this._position();
  };

  connect(root: ShadowRoot): void {
    this._root = root;
    scopeFor(root).refresh = this._route;
    this._view = root.ownerDocument?.defaultView;
    this._view?.addEventListener('scroll', this._position, true);
    this._view?.addEventListener('resize', this._position);
    this._view?.visualViewport?.addEventListener('resize', this._position);
    this._view?.visualViewport?.addEventListener('scroll', this._position);
    if (typeof ResizeObserver !== 'undefined') this._observer = new ResizeObserver(this._position);
  }

  refresh(): void { this._route(); }

  captureContext(): ToastContext {
    const owners = this._root ? scopeFor(this._root).owners.filter(owner => owner.host.isConnected) : [];
    return { owner: owners[owners.length - 1] ?? null };
  }

  isOwnerActive(context: ToastContext): boolean {
    return !!(this._root && context.owner?.host.isConnected && scopeFor(this._root).owners.includes(context.owner));
  }

  showHint(message: string, id: string): void {
    if (this._notice && !this._leaving && this._notice.dataset.kind !== 'hint') return;
    if (this._notice?.dataset.kind === 'hint' && this._notice.dataset.id === id && !this._leaving) return;
    this.show(message, id, 'hint');
  }

  clearHint(id: string): void {
    if (this._notice?.dataset.kind === 'hint' && this._notice.dataset.id === id) this.clear();
  }

  clearMessage(): void {
    if (this._notice?.dataset.kind === 'message') this.clear();
  }

  show(message: string, id = 'message', kind: 'message' | 'hint' = 'message', context = this.captureContext()): void {
    if (!this._root) return;
    this._context = context;
    cancelAnimationFrame(this._frame);
    const generation = ++this._generation;
    this._animation?.cancel(); this._animation = null; this._leaving = false;
    const notice = this._notice ||= document.createElement('div');
    notice.className = 'toast hpf-notice';
    notice.inert = false; notice.removeAttribute('aria-hidden');
    notice.dataset.hp = 'toast';
    notice.dataset.kind = kind;
    notice.dataset.id = id;
    this._route();
    notice.setAttribute('role', 'alert');
    notice.setAttribute('aria-live', 'assertive');
    notice.setAttribute('aria-atomic', 'true');
    notice.textContent = '';
    // Establish an empty live region before its new content, including a new
    // occurrence of the same text. Ordinary card renders never touch this node.
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      if (generation !== this._generation || notice !== this._notice) return;
      notice.setAttribute('role', 'alert');
      notice.setAttribute('aria-live', 'assertive');
      notice.textContent = message;
      if (typeof notice.animate === 'function' && !controlMotionReduced(notice.ownerDocument?.defaultView ?? null)) {
        this._animation = notice.animate(controlSurfaceFrames(true), controlMotion.appear);
        void this._animation.finished.catch(() => undefined);
      }
    });
  }

  clear(immediate = false): void {
    if (this._leaving && !immediate) return;
    cancelAnimationFrame(this._frame);
    this._frame = 0;
    const notice = this._notice, generation = ++this._generation;
    const view = notice?.ownerDocument?.defaultView;
    const style = notice && view ? view.getComputedStyle(notice) : null;
    const current = style ? { opacity: style.opacity, translate: style.translate } : undefined;
    this._animation?.cancel(); this._animation = null;
    if (!notice) return;
    this._leaving = true;
    notice.inert = true; notice.setAttribute('aria-hidden', 'true');
    notice.setAttribute('aria-live', 'off'); notice.removeAttribute('role');
    const remove = (): void => {
      if (generation !== this._generation || notice !== this._notice) return;
      notice.remove(); this._notice = undefined; this._animation = null; this._leaving = false;
    };
    if (immediate || !notice.isConnected || !notice.textContent || typeof notice.animate !== 'function' || controlMotionReduced(view ?? null)) {
      remove(); return;
    }
    this._animation = notice.animate(controlSurfaceFrames(false, current), { ...controlMotion.leave, fill: 'both' });
    void this._animation.finished.then(remove, remove);
  }

  disconnect(): void {
    this.clear(true);
    this._observer?.disconnect(); this._observer = undefined; this._stage = null;
    this._view?.removeEventListener('scroll', this._position, true);
    this._view?.removeEventListener('resize', this._position);
    this._view?.visualViewport?.removeEventListener('resize', this._position);
    this._view?.visualViewport?.removeEventListener('scroll', this._position);
    this._view = undefined;
    if (this._root) scopeFor(this._root).refresh = undefined;
    this._root = undefined;
  }
}
