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

  show(message: string): void {
    if (!this._root) return;
    cancelAnimationFrame(this._frame);
    const notice = this._notice ||= document.createElement('div');
    notice.className = 'toast';
    notice.dataset.hp = 'toast';
    notice.dataset.kind = 'message';
    this._route();
    notice.setAttribute('role', 'alert');
    notice.setAttribute('aria-live', 'assertive');
    notice.setAttribute('aria-atomic', 'true');
    notice.textContent = '';
    // Establish an empty live region before its new content, including a new
    // occurrence of the same text. Ordinary card renders never touch this node.
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      notice.setAttribute('role', 'alert');
      notice.setAttribute('aria-live', 'assertive');
      notice.textContent = message;
    });
  }

  clear(): void {
    cancelAnimationFrame(this._frame);
    this._frame = 0;
    this._notice?.remove();
    this._notice = undefined;
  }

  disconnect(): void {
    this.clear();
    if (this._root) scopeFor(this._root).refresh = undefined;
    this._root = undefined;
  }
}
