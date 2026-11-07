import { render, nothing } from 'lit';
import type { HouseplanMode } from './mode-transition';
import type { PanelHeaderMeasurement } from './panel-header-flow';

export interface ModeChromeLayout {
  width: number;
  chromeHeight: number;
  header: PanelHeaderMeasurement;
}
export interface ModeChromeProbe extends ModeChromeLayout {
  mode: HouseplanMode;
  content: unknown;
}

/** Four semantic layouts, prepared only after explicit runtime installation. */
export class ModeChromeLayouts {
  private key: string | null = null;
  private values = new Map<HouseplanMode, ModeChromeLayout>();
  private pending: Promise<void> | null = null;
  private generation = 0;
  public error: string | null = null;

  public get(key: string, mode: HouseplanMode): ModeChromeLayout | null {
    return this.key === key ? this.values.get(mode) ?? null : null;
  }
  public ready(key: string): boolean { return this.key === key; }
  public clear(): void {
    this.generation++;
    this.key = null;
    this.values.clear();
  }

  public prepare(key: string, root: HTMLElement, plans: readonly ModeChromeProbe[]): Promise<void> {
    if (this.ready(key)) return Promise.resolve();
    if (this.pending) return this.pending;
    const generation = ++this.generation;
    const job = (async () => {
      const values = new Map<HouseplanMode, ModeChromeLayout>();
      for (const plan of plans) {
        if (!root.isConnected || generation !== this.generation) return;
        if (plan.mode === 'view') {
          values.set(plan.mode, { width: plan.width, chromeHeight: 0, header: plan.header });
          continue;
        }
        const probe = root.ownerDocument.createElement('div');
        probe.className = 'hdr';
        probe.inert = true;
        probe.setAttribute('aria-hidden', 'true');
        probe.dataset.panelMode = plan.mode;
        probe.dataset.panelFlow = String(plan.header.phase);
        probe.toggleAttribute('data-panel-phone', plan.header.phone);
        probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;'
          + 'contain:layout style;width:' + plan.width + 'px';
        const chrome = root.ownerDocument.createElement('div');
        chrome.className = 'editorchrome open';
        chrome.style.cssText = 'height:auto;position:static;width:' + plan.width + 'px';
        const inner = root.ownerDocument.createElement('div');
        inner.className = 'editorchrome-inner';
        chrome.append(inner);
        probe.append(chrome);
        try {
          render(plan.content, inner);
          for (const node of inner.querySelectorAll('[id],[data-hp],[aria-controls]')) {
            node.removeAttribute('id');
            node.removeAttribute('data-hp');
            node.removeAttribute('aria-controls');
          }
          root.append(probe);
          for (let pass = 0; pass < 2; pass++) {
            await Promise.all([...inner.querySelectorAll('*')].map(node =>
              (node as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete));
          }
          if (!root.isConnected || generation !== this.generation) return;
          const chromeHeight = inner.scrollHeight;
          if (chromeHeight <= 0) throw Error('Mode chrome has no measured height');
          values.set(plan.mode, { width: plan.width, chromeHeight, header: plan.header });
        } finally {
          render(nothing, inner);
          probe.remove();
        }
      }
      if (generation === this.generation && root.isConnected) {
        this.values = values;
        this.key = key;
        this.error = null;
      }
    })().catch(error => {
      this.error = String(error);
      if (generation === this.generation) this.key = null;
    }).finally(() => {
      if (this.pending === job) this.pending = null;
    });
    this.pending = job;
    return job;
  }
}
