export type PanelHeaderPhase = 0 | 1 | 2 | 3 | 4;
export interface PanelHeaderChoice { phase: PanelHeaderPhase; phone: boolean }
export interface PanelHeaderMeasurement extends PanelHeaderChoice { height: number }
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

/** Same owner/content/width lends one measured result; visual ticks do not remeasure. */
export class PanelHeaderMemo {
  private owner: object | null = null;
  private key = '';
  private width = -1;
  private value: PanelHeaderMeasurement | null = null;
  public resolve(owner: object, key: string, width: number,
    measure: () => PanelHeaderMeasurement): PanelHeaderMeasurement {
    if (owner !== this.owner || key !== this.key || width !== this.width || !this.value) {
      this.value = measure(); this.owner = owner; this.key = key; this.width = width;
    }
    return this.value;
  }
  public invalidate(): void { this.key = ''; this.value = null; }
  public clear(): void { this.owner = null; this.width = -1; this.invalidate(); }
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
  icon.className = className + ' panel-icon-metric';
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
    metric.className = node.getAttribute('class') || '';
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

function spaceMetrics(doc: Document, nav: PanelHeaderSpaces, compact: boolean): HTMLElement {
  const tabs = doc.createElement('nav');
  tabs.className = 'tabs' + (compact ? ' compact-spaces' : '');
  const button = (className: string): HTMLButtonElement => {
    const value = doc.createElement('button'); value.className = className; value.type = 'button';
    tabs.appendChild(value); return value;
  };
  if (compact) {
    const field = doc.createElement('span'); field.className = 'compact-space-select';
    field.style.cssText = 'display:block;flex:0 0 180px;width:180px;min-width:180px;height:44px;';
    tabs.appendChild(field);
    if (nav.configure) button('tab tabedit compact-space-settings').appendChild(iconMetric(doc, 24));
  } else {
    for (const space of nav.spaces) {
      const tab = button('tab' + (space.id === nav.current ? ' active' : ''));
      const label = doc.createElement('span'); label.className = 'tabtitle'; label.textContent = space.title;
      tab.appendChild(label);
      if (nav.configure) tab.appendChild(iconMetric(doc, 13, 'tabedit'));
    }
  }
  if (nav.create) button('tab tabadd').appendChild(iconMetric(doc, 15));
  return tabs;
}

/** One synchronous, inert native metrics tree; removed before the next task/paint.
 * The actual controls/popup/focus never participate in candidate probing. */
export function measurePanelHeader(
  header: HTMLElement, head: HTMLElement, available: number, nav: PanelHeaderSpaces, mode: string,
): PanelHeaderMeasurement {
  const doc = header.ownerDocument;
  const probe = doc.createElement('div');
  probe.className = 'hdr panel-header-metrics';
  probe.setAttribute('aria-hidden', 'true'); probe.inert = true;
  probe.setAttribute('data-panel-mode', mode);
  probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;'
    + 'width:max-content;min-height:0;contain:layout style;';
  const copy = nativeMetric(head, doc) as HTMLElement;
  copy.style.height = ''; copy.style.overflow = 'visible'; copy.style.width = 'max-content';
  probe.appendChild(copy);
  const replaceTabs = (compact: boolean): void => {
    const old = copy.querySelector(':scope > .tabs');
    old?.replaceWith(spaceMetrics(doc, nav, compact));
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
    const choice = choosePanelHeader(available, widths, wrappedFirstRow);
    probe.setAttribute('data-panel-flow', String(choice.phase));
    probe.toggleAttribute('data-panel-phone', choice.phone);
    replaceTabs(choice.phase >= 3);
    copy.style.width = available + 'px';
    return { ...choice, height: outerSize(copy, 'height') };
  } finally { probe.remove(); }
}

export function applyPanelHeaderChoice(header: HTMLElement, choice: PanelHeaderChoice): void {
  const phase = String(choice.phase);
  if (header.getAttribute('data-panel-flow') !== phase) header.setAttribute('data-panel-flow', phase);
  header.toggleAttribute('data-panel-phone', choice.phone);
}
