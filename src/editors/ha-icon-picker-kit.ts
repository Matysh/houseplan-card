import { nothing, type ElementPart } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';

/** Local adapter for HA's genuine picker. Native adaptive surface, search,
 * selection and focus ownership stay with HA. No global shadow interception. */
const styles: Record<string, string> = {
  'ha-picker-field': `
    :host{display:block;min-width:0;font:inherit;}
    ha-combo-box-item{box-sizing:border-box;width:100%;min-height:44px;
      border:1px solid var(--hpf-line,var(--divider-color));border-radius:8px;
      background:var(--hpf-control-surface,var(--hpf-surface,var(--card-background-color)));
      color:var(--primary-text-color);cursor:pointer;
      --md-list-item-one-line-container-height:42px;--md-list-item-two-line-container-height:42px;
      --md-list-item-leading-space:14px;--md-list-item-trailing-space:14px;
      --md-list-item-label-text-size:14px;--md-list-item-label-text-line-height:20px;
      --ha-md-list-item-gap:14px;--md-ripple-hover-opacity:0;--md-ripple-pressed-opacity:0;
      transition:background 160ms,border-color 160ms;}
    ha-combo-box-item::after{display:none;}
    ha-combo-box-item:hover,ha-combo-box-item:focus-within{border-color:var(--hpf-accent,var(--primary-color));}
    ha-combo-box-item:hover{background:var(--hpf-tint);}
    ha-combo-box-item:focus-within{outline:none;}
    [slot=headline]{min-width:0;overflow:hidden;text-overflow:ellipsis;font:inherit;}
    .arrow{width:18px;height:18px;--mdc-icon-size:18px;color:var(--primary-text-color);transition:transform 160ms;}
    :host(.opened) .arrow{transform:rotate(180deg);}
    .clear{margin:0;--ha-icon-button-size:28px;--ha-icon-button-padding-inline:0px;}
    :host([disabled]) ha-combo-box-item{opacity:.45;cursor:not-allowed;}
    @media(max-width:550px){:host{font-size:16px;}ha-combo-box-item{--md-list-item-label-text-size:16px;}}
    @media(prefers-reduced-motion:reduce){ha-combo-box-item,.arrow{transition:none;}}
  `,
  'ha-generic-picker': `
    :host,.container,#picker{min-width:0;max-width:100%;}
    wa-popover{--wa-panel-border-radius:10px;--wa-panel-border-color:var(--hpf-line,var(--divider-color));}
    wa-popover::part(body){box-sizing:border-box;width:min(var(--body-width),calc(100vw - 32px));
      max-width:calc(100vw - 32px);min-height:0;height:320px;max-height:min(70dvh,320px);
      padding:5px;border:1px solid var(--hpf-line,var(--divider-color));border-radius:10px;
      background:var(--hpf-surface,var(--card-background-color));color:var(--primary-text-color);
      box-shadow:0 8px 28px #0003;}
  `,
  'ha-picker-combo-box': `
    :host{padding-top:0;min-width:0;max-width:100%;font:inherit;
      background:var(--hpf-surface,var(--card-background-color));color:var(--primary-text-color);}
    ha-input-search{padding:5px 5px 8px;min-width:0;box-sizing:border-box;font:inherit;}
    ha-input-search::part(wa-base){box-sizing:border-box;height:44px;min-height:44px;padding:0 12px;
      border:1px solid var(--hpf-line,var(--divider-color));border-radius:8px;
      background:var(--hpf-control-surface,var(--hpf-surface,var(--card-background-color)));
      color:var(--primary-text-color);box-shadow:none;outline:none;
      transition:background 160ms,border-color 160ms;}
    ha-input-search:hover::part(wa-base),ha-input-search:focus-within::part(wa-base){border-color:var(--hpf-accent,var(--primary-color));outline:none;box-shadow:none;}
    ha-input-search::part(wa-input){min-width:0;margin-inline:8px;padding:0;font:inherit;color:var(--primary-text-color);}
    ha-input-search::part(wa-input)::placeholder{color:var(--secondary-text-color);}
    .list-wrapper,lit-virtualizer{min-width:0;max-width:100%;overflow-x:hidden;}
    .combo-box-row{min-width:0;border-radius:6px;min-height:44px;transition:background-color 160ms,color 160ms;}
    .combo-box-row.current-value{color:var(--hpf-accent,var(--primary-color));background:transparent;}
    .combo-box-row:is(:hover,.selected){background:var(--hpf-tint);}
    ha-combo-box-item{border-radius:6px;min-width:0;font:inherit;
      --md-list-item-one-line-container-height:44px;--md-list-item-top-space:0px;--md-list-item-bottom-space:0px;
      --md-list-item-leading-space:12px;--md-list-item-trailing-space:12px;
      --md-list-item-label-text-size:14px;--md-list-item-label-text-line-height:20px;
      --md-list-item-label-text-color:inherit;--md-ripple-hover-opacity:0;}
    @media(max-width:550px){:host{font-size:16px;}ha-combo-box-item{--md-list-item-label-text-size:16px;}}
    @media(prefers-reduced-motion:reduce){.combo-box-row,ha-input-search::part(wa-base){transition:none;}}
  `,
};

type PickerNode = HTMLElement & { updateComplete?: Promise<unknown>; distance?: number; placeholder?: string; path?: string };
type KitBinding = { observer: MutationObserver; sheet?: CSSStyleSheet; style?: HTMLStyleElement; closed?: EventListener };
const selector = 'ha-icon-picker,ha-generic-picker,ha-picker-field,ha-picker-combo-box';

class IconPickerKit extends AsyncDirective {
  private picker?: HTMLElement;
  private search = '';
  private generation = 0;
  private roots = new Map<ShadowRoot, KitBinding>();
  private pending = new WeakSet<Element>();
  private queued = false;
  render(_search: string): typeof nothing { return nothing; }
  update(part: ElementPart, [search]: [string]): typeof nothing {
    this.picker = part.element as HTMLElement;
    this.search = search;
    this.schedule();
    return nothing;
  }
  private schedule = (): void => {
    if (this.queued || !this.isConnected) return;
    this.queued = true;
    const generation = this.generation;
    queueMicrotask(() => {
      if (generation !== this.generation) return;
      this.queued = false;
      if (!this.isConnected || !this.picker?.isConnected) return;
      for (const [root, binding] of this.roots) {
        if (!this.belongs(root.host)) { this.remove(root, binding); this.roots.delete(root); }
      }
      this.visit(this.picker);
    });
  };
  private belongs(node: Node): boolean {
    while (node !== this.picker) {
      const parent = node.parentNode || (node instanceof ShadowRoot ? node.host : null);
      if (!parent) return false;
      node = parent;
    }
    return true;
  }
  private visit(node: PickerNode): void {
    const root = node.shadowRoot;
    if (root) {
      if (!this.roots.has(root)) {
        const observer = new MutationObserver(this.schedule);
        const binding: KitBinding = { observer };
        if (node.localName === 'ha-generic-picker') {
          // The native drawer restores the outer dialog's focus rather than
          // this picker. Its public close event is after the sheet animation;
          // wait for HA to retire the combo box, then restore this field.
          binding.closed = event => {
            if (event.target !== node || !root.querySelector('ha-bottom-sheet')) return;
            const generation = this.generation;
            void Promise.resolve(node.updateComplete).then(() => requestAnimationFrame(() => {
              if (generation !== this.generation || !this.isConnected || !this.picker?.isConnected
                  || !this.belongs(node) || root.querySelector('ha-picker-combo-box')) return;
              root.querySelector<HTMLElement>('ha-picker-field')?.focus();
            }));
          };
          node.addEventListener('picker-closed', binding.closed);
        }
        const css = node.localName === 'ha-picker-field' ? styles['ha-picker-field']
          : node.localName === 'ha-generic-picker' ? styles['ha-generic-picker']
          : node.localName === 'ha-picker-combo-box' ? styles['ha-picker-combo-box'] : '';
        if (css) {
          const Sheet = node.ownerDocument.defaultView?.CSSStyleSheet;
          if (Sheet && 'adoptedStyleSheets' in root) {
            binding.sheet = new Sheet(); binding.sheet.replaceSync(css);
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, binding.sheet];
          } else {
            binding.style = node.ownerDocument.createElement('style'); binding.style.textContent = css;
            root.appendChild(binding.style);
          }
        }
        this.roots.set(root, binding);
        observer.observe(root, { childList: true, subtree: true });
      }
      const popup = root.querySelector<PickerNode>('wa-popover');
      if (popup && popup.distance !== 7) popup.distance = 7;
      const search = root.querySelector<PickerNode>('ha-input-search');
      if (search && search.placeholder !== this.search) search.placeholder = this.search;
      const arrow = root.querySelector<PickerNode>('.arrow');
      if (arrow && arrow.path !== 'm7 10 5 5 5-5z') arrow.path = 'm7 10 5 5 5-5z';
      for (const child of root.querySelectorAll<PickerNode>(selector)) this.visit(child);
    }
    // HA creates nested roots in its Lit update. Await each concrete element
    // once; observe only this mounted picker thereafter, never poll the card.
    if (!this.pending.has(node) && node.updateComplete) {
      this.pending.add(node);
      const generation = this.generation;
      void node.updateComplete.then(() => {
        if (generation === this.generation && this.belongs(node)) this.schedule();
      });
    }
  }
  private remove(root: ShadowRoot, binding: KitBinding): void {
    binding.observer.disconnect();
    if (binding.closed) root.host.removeEventListener('picker-closed', binding.closed);
    if (binding.sheet) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== binding.sheet);
    binding.style?.remove();
  }
  protected disconnected(): void {
    this.generation++; this.queued = false; this.pending = new WeakSet();
    for (const [root, binding] of this.roots) this.remove(root, binding);
    this.roots.clear();
  }
  protected reconnected(): void { this.schedule(); }
}

export const iconPickerKit = directive(IconPickerKit);
