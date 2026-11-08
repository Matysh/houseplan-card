import { headerControls, type HeaderPosition } from './header-motion';
import { headerNavigationGroup, headerNavigationItem, headerNavigationIconSize } from './header-navigation-kit';

export type PanelHeaderPhase = 0 | 1 | 2 | 3 | 4 | 5;
export interface PanelHeaderChoice { phase: PanelHeaderPhase; phone: boolean }
export interface PanelHeaderMeasurement extends PanelHeaderChoice { height: number; positions?: ReadonlyMap<string,HeaderPosition> }
export interface PanelHeaderSpaces {
  spaces: readonly { id: string; title: string }[];
  current: string;
  configure: boolean;
  create: boolean;
}

/** Ordered intrinsic candidates. Numbers are measured CSS pixels, never breakpoints. */
export function choosePanelHeader(
  available: number, widths: readonly number[], wrappedFirstRow: number,
): PanelHeaderChoice {
  for (let phase = 0; phase < 4; phase++) {
    if (Number.isFinite(widths[phase]) && widths[phase] <= available)
      return { phase: phase as PanelHeaderPhase, phone: false };
  }
  return { phase: 4, phone: wrappedFirstRow > available };
}

/** Count occupied control rows by overlapping vertical intervals, independent of
 * differing icon/select heights on the same flex row. */
export function panelHeaderRows(rects: readonly { top: number; bottom: number; width: number; height: number }[]): number {
  const rows: { top: number; bottom: number }[] = [];
  for (const rect of [...rects].filter(r => r.width > 0 && r.height > 0).sort((a,b) => a.top-b.top)) {
    const row = rows.find(r => Math.min(r.bottom,rect.bottom) > Math.max(r.top,rect.top));
    if (row) { row.top = Math.max(row.top,rect.top); row.bottom = Math.min(row.bottom,rect.bottom); }
    else rows.push({ top: rect.top, bottom: rect.bottom });
  }
  return rows.length;
}

/** Same owner/content/width lends one measured result; visual ticks do not remeasure. */
export class PanelHeaderMemo {
  private owner: object | null = null;
  private readonly values = new Map<string, PanelHeaderMeasurement>();
  public resolve(owner: object, key: string, width: number,
    measure: () => PanelHeaderMeasurement): PanelHeaderMeasurement {
    if (owner !== this.owner) { this.clear(); this.owner = owner; }
    const id = JSON.stringify([key, width]);
    let value = this.values.get(id);
    if (!value) {
      value = measure();
      // Four modes plus a recent width/content variant; never an unbounded
      // cache of space names, locale revisions or responsive widths.
      if (this.values.size >= 8) this.values.delete(this.values.keys().next().value!);
      this.values.set(id, value);
    }
    return value;
  }
  public invalidate(): void { this.values.clear(); }
  public clear(): void { this.owner = null; this.invalidate(); }
}

const numeric = (value: string): number => Number.parseFloat(value) || 0;
function outerSize(element: HTMLElement, axis: 'width' | 'height'): number {
  const style = getComputedStyle(element);
  const used = numeric(style[axis]);
  if (style.boxSizing === 'border-box') return used;
  return used + (axis === 'width'
    ? numeric(style.paddingLeft) + numeric(style.paddingRight)
      + numeric(style.borderLeftWidth) + numeric(style.borderRightWidth)
    : numeric(style.paddingTop) + numeric(style.paddingBottom)
      + numeric(style.borderTopWidth) + numeric(style.borderBottomWidth));
}

/** Untransformed space actually allocated to the head, including its padding. */
export function panelHeaderWidth(head: HTMLElement): number { return outerSize(head, 'width'); }

function iconMetric(doc: Document, size: number, className = ''): HTMLElement {
  const icon = doc.createElement('span');
  // The header renderers expose exactly these icon variants; metrics never
  // adopt arbitrary custom-element class producers from another surface.
  icon.className = 'panel-icon-metric';
  if (className.split(/\s+/).includes('tabedit')) icon.classList.add('tabedit');
  if (className.split(/\s+/).includes('panel-mode-compact')) icon.classList.add('panel-mode-compact');
  if (className.split(/\s+/).includes('panel-mode-full')) icon.classList.add('panel-mode-full');
  icon.style.cssText = 'flex:none;width:' + size + 'px;height:' + size + 'px;';
  return icon;
}

/** Build ONLY native nodes. No clone/custom-element constructor, IDs or event handlers. */
function nativeMetric(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
  if (!(node instanceof Element)) return null;
  if (node.localName === 'ha-icon') {
    const style = getComputedStyle(node);
    const size = numeric(style.width) || numeric(style.getPropertyValue('--mdc-icon-size')) || 24;
    const metric = iconMetric(doc, size, node.getAttribute('class') || '');
    for (const attr of node.attributes) if (attr.name.startsWith('data-')) metric.setAttribute(attr.name, attr.value);
    return metric;
  }
  if (node.localName.includes('-')) {
    const metric = doc.createElement('span');
    if (node.classList.contains('compact-space-select')) { metric.classList.add('compact-space-select'); metric.dataset.hp='space-select'; }
    if (node.classList.contains('compact-space-select'))
      metric.style.cssText = 'display:block;flex:0 0 180px;width:180px;min-width:180px;height:44px;';
    return metric;
  }
  const metric = node.namespaceURI === 'http://www.w3.org/2000/svg'
    ? doc.createElementNS(node.namespaceURI, node.localName) : doc.createElement(node.localName);
  for (const attr of node.attributes) {
    if (attr.name === 'id' || attr.name.startsWith('on') || attr.name === 'aria-controls') continue;
    metric.setAttribute(attr.name, attr.value);
  }
  for (const child of node.childNodes) {
    const copy = nativeMetric(child, doc); if (copy) metric.appendChild(copy);
  }
  return metric;
}

function spaceMetrics(doc: Document, nav: PanelHeaderSpaces, compact: boolean, collapsed = false): HTMLElement {
  const tabs = doc.createElement('nav');
  tabs.className = headerNavigationGroup(compact);
  const button = (className: string): HTMLButtonElement => {
    const value = doc.createElement('button'); value.className = headerNavigationItem + ' ' + className; value.type = 'button';
    tabs.appendChild(value); return value;
  };
  if (compact) {
    if (collapsed && nav.spaces.length === 1) {
      const title = doc.createElement('span'); title.className = 'compact-space-title'; title.dataset.hp = 'space-name';
      const text = doc.createElement('span'); text.textContent = nav.spaces[0].title; title.append(text); tabs.append(title);
    } else {
      const field = doc.createElement('span'); field.className = 'compact-space-select'; field.dataset.hp='space-select';
      field.style.cssText = collapsed ? 'display:block;height:44px;'
        : 'display:block;flex:0 0 180px;width:180px;min-width:180px;height:44px;';
      tabs.appendChild(field);
    }
    if (nav.configure) { const settings=button('tabedit compact-space-settings');settings.dataset.hp='space-settings';settings.appendChild(iconMetric(doc, headerNavigationIconSize)); }
  } else {
    for (const space of nav.spaces) {
      const tab = button(space.id === nav.current ? 'active' : ''); tab.dataset.hp='space-tab';
      const label = doc.createElement('span'); label.className = 'tabtitle'; label.textContent = space.title;
      tab.appendChild(label);
      if (nav.configure) {
        const gear = iconMetric(doc, 20, 'tabedit');
        gear.style.width = '44px'; gear.style.height = '42px';
        tab.appendChild(gear);
      }
    }
  }
  if (nav.create) { const add=button('tabadd');add.dataset.hp='space-add';add.appendChild(iconMetric(doc, headerNavigationIconSize)); }
  return tabs;
}

/** One synchronous, inert native metrics tree; removed before the next task/paint.
 * The actual controls/popup/focus never participate in candidate probing. */
export function measurePanelHeader(
  header: HTMLElement, head: HTMLElement, available: number, nav: PanelHeaderSpaces, mode: string, wide?: boolean,
): PanelHeaderMeasurement {
  const doc = header.ownerDocument;
  const probe = doc.createElement('div');
  probe.className = 'hdr panel-header-metrics';
  probe.setAttribute('aria-hidden', 'true'); probe.inert = true;
  probe.setAttribute('data-panel-mode', mode);
  probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;'
    + 'width:max-content;min-height:0;contain:layout style;';
  const copy = nativeMetric(head, doc) as HTMLElement;
  if(wide!==undefined)copy.toggleAttribute('data-hp-properties-wide',wide);
  copy.style.height = ''; copy.style.overflow = 'visible'; copy.style.width = 'max-content';
  // Prefill can run from View before the target tab has ever been selected.
  // Measure its active typography, not the currently selected source tab.
  for (const tab of copy.querySelectorAll<HTMLElement>('.modetab[data-mode]'))
    tab.classList.toggle('active', tab.dataset.mode === mode);
  const close=copy.querySelector('.editor-close-slot'),modes=copy.querySelector('.modes');
  if (close && modes) {
    if (mode === 'view') {
      close.setAttribute('aria-hidden', 'true');
      close.replaceChildren();
    } else {
      close.removeAttribute('aria-hidden');
      if (!close.querySelector('button')) {
        const button = doc.createElement('button');
        button.className = 'closex';
        button.dataset.hp = 'editor-close';
        button.dataset.editorNavigation = 'view';
        button.appendChild(iconMetric(doc, 13));
        close.appendChild(button);
      }
    }
    const target = modes.querySelector('[data-mode="' + mode + '"]');
    if (target) target.after(close);
    else modes.appendChild(close);
  }
  probe.appendChild(copy);
  const replaceTabs = (compact: boolean, collapsed = false): void => {
    const old = copy.querySelector(':scope > .tabs');
    old?.replaceWith(spaceMetrics(doc, nav, compact, collapsed));
  };
  const widths: number[] = [];
  header.parentElement?.appendChild(probe);
  try {
    for (let phase = 0; phase < 4; phase++) {
      probe.setAttribute('data-panel-flow', String(phase));
      replaceTabs(phase >= 3);
      widths.push(outerSize(copy, 'width'));
    }
    const actions = copy.querySelector(':scope > .header-actions') as HTMLElement | null;
    const spacer = copy.querySelector(':scope > .spacer') as HTMLElement | null;
    actions?.remove(); spacer?.remove();
    const wrappedFirstRow = outerSize(copy, 'width');
    if (spacer) copy.appendChild(spacer);
    if (actions) copy.appendChild(actions);
    let choice = choosePanelHeader(available, widths, wrappedFirstRow);
    probe.setAttribute('data-panel-flow', String(choice.phase));
    probe.toggleAttribute('data-panel-phone', choice.phone);
    replaceTabs(choice.phase >= 3);
    copy.style.width = available + 'px';
    if (choice.phase === 4 && panelHeaderRows(headerControls(copy).map(([,element]) => element.getBoundingClientRect())) >= 2) {
      choice = { phase: 5, phone: false };
      applyPanelHeaderChoice(probe, choice);
      replaceTabs(true, true);
    }
    const height=outerSize(copy,'height'),origin=copy.getBoundingClientRect();
    const positions=new Map(headerControls(copy).map(([key,element])=>{const rect=element.getBoundingClientRect();return [key,{x:rect.x-origin.x,y:rect.y-origin.y}] as const}));
    return { ...choice, height, positions };
  } finally { probe.remove(); }
}

export function applyPanelHeaderChoice(header: HTMLElement, choice: PanelHeaderChoice): void {
  const phase = String(choice.phase);
  if (header.getAttribute('data-panel-flow') !== phase) header.setAttribute('data-panel-flow', phase);
  header.toggleAttribute('data-panel-phone', choice.phone);
}
