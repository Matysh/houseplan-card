import { controlMotion, controlMotionReduced, controlSurfaceFrames } from './ui-motion';

/** One notice node per card, owned by its last active, ready modal. */
export type ToastOwner = { host: HTMLElement; portal: () => HTMLElement | null };
type Scope = { owners: ToastOwner[]; refresh?: () => void };
const scopes = new WeakMap<Node, Scope>();
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
  private _frame = 0;
  private _animation: Animation | null = null;
  private _generation = 0;
  private _leaving = false;
  private readonly _route = (): void => {
    const root = this._root, notice = this._notice;
    if (!root || !notice) return;
    const owners = scopeFor(root).owners.filter(owner => owner.host.isConnected);
    const target = owners[owners.length - 1]?.portal() || root.querySelector('[data-hp="toast-portal"]');
    if (!target || target === notice.parentElement) return;
    // Moving an already announced message must not create another live-region
    // event. It remains accessible ordinary text in its new modal, not hidden
    // duplicate text in the inert card below it.
    notice.setAttribute('aria-live', 'off');
    notice.removeAttribute('role');
    target.appendChild(notice);
  };

  connect(root: ShadowRoot): void {
    this._root = root;
    scopeFor(root).refresh = this._route;
  }

  refresh(): void { this._route(); }

  show(message: string, id = 'message'): void {
    if (!this._root) return;
    cancelAnimationFrame(this._frame);
    const generation = ++this._generation;
    this._animation?.cancel(); this._animation = null; this._leaving = false;
    const notice = this._notice ||= document.createElement('div');
    notice.className = 'toast hpf-notice';
    notice.inert = false; notice.removeAttribute('aria-hidden');
    notice.dataset.hp = 'toast';
    notice.dataset.kind = 'message';
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
    if (this._root) scopeFor(this._root).refresh = undefined;
    this._root = undefined;
  }
}
