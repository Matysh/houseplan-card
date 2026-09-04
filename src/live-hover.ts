import { lqiColor } from './logic';

export interface LiveTip {
  x: number;
  y: number;
  title: string;
  meta: string;
  lqi?: number | null;
  temp?: number | null;
  hum?: number | null;
  room?: boolean;
}

interface HoverState {
  room: unknown;
  space: string;
}

interface LiveHoverHost {
  renderRoot: ParentNode;
  _tip: LiveTip | null;
  _t: (key: 'tip.temp_avg' | 'tip.hum_avg' | 'tip.lqi') => string;
  _hoverRoom: { space: string; room: unknown } | null;
  _spaceModel: () => unknown;
  _roomHoverPaths: (model: unknown) => { fillD: string; outlineD: string } | null;
}

const states = new WeakMap<object, HoverState>();

const appendMeta = (tip: HTMLElement, label: string, value?: string, color?: string): void => {
  if (!value) return;
  const row = document.createElement('span');
  row.className = 'm';
  if (!label) row.textContent = value;
  else {
    row.append(`${label} `);
    const strong = document.createElement('b');
    strong.textContent = value;
    if (color) strong.style.color = color;
    row.append(strong);
  }
  tip.append(row);
};

const syncTip = (host: LiveHoverHost, root: ParentNode): void => {
  const element = root.querySelector<HTMLElement>('[data-hp-live-tip]');
  if (!element) return;
  const tip = host._tip as LiveTip | null;
  if (!tip) {
    element.hidden = true;
    element.replaceChildren();
    return;
  }
  element.style.left = `${tip.x + 12}px`;
  element.style.top = `${tip.y + 12}px`;
  element.replaceChildren();
  const title = document.createElement('b');
  title.textContent = tip.title;
  element.append(title);
  appendMeta(element, '', tip.meta);
  appendMeta(element, host._t('tip.temp_avg'), tip.temp == null ? '' : `${tip.temp}°`);
  appendMeta(element, host._t('tip.hum_avg'), tip.hum == null ? '' : `${tip.hum}%`);
  appendMeta(element, host._t('tip.lqi'), tip.lqi == null ? '' : String(tip.lqi),
    tip.lqi == null ? undefined : lqiColor(tip.lqi));
  element.hidden = false;
};

const setRoomPath = (root: ParentNode, selector: string, d: string): void => {
  const path = root.querySelector<SVGPathElement>(selector);
  if (!path) return;
  path.setAttribute('d', d);
  path.toggleAttribute('hidden', !d);
};

/** Update the ordinary mouse hover without scheduling a full card render. */
export function syncHouseplanHover(value: object): void {
  const host = value as LiveHoverHost;
  const root = host.renderRoot;
  if (!root) return;
  syncTip(host, root);
  const hover = host._hoverRoom;
  const previous = states.get(value);
  const space = hover?.space || '';
  const room = hover?.room || null;
  if (previous?.room === room && previous?.space === space) return;
  states.set(value, { room, space });
  const model = hover && host._spaceModel();
  const paths = model ? host._roomHoverPaths(model) : null;
  setRoomPath(root, '[data-hp-live-room-hover="fill"]', paths?.fillD || '');
  setRoomPath(root, '[data-hp-live-room-hover="halo"]', paths?.outlineD || '');
  setRoomPath(root, '[data-hp-live-room-hover="outline"]', paths?.outlineD || '');
}

export function resetHouseplanHover(host: object): void {
  states.delete(host);
}
