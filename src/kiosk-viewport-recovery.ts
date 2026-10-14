/** A one-shot camera address, scoped to the document route and actual card placement. */
export interface KioskViewport {
  readonly space: string;
  readonly zoom: number;
  readonly view: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}
interface MemoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const PREFIX = 'houseplan_kiosk_recovery_v1:';
const MAX_AGE = 10 * 60_000;

export function nonCarouselKiosk(cycle: unknown, fixed: boolean, spaces: number): boolean {
  return spaces > 0 && (!(Number(cycle) > 0) || fixed || spaces === 1);
}

export function kioskPlacementKey(card: Element, route: string, configKey: string, user: string): string | null {
  if (!card.isConnected) return null;
  const path: string[] = [];
  let node: Element | null = card;
  while (node && path.length < 80) {
    const parent: ParentNode | null = node.parentNode;
    if (!parent) return null;
    const index = Array.from(parent.children).indexOf(node);
    if (index < 0) return null;
    path.push(`${node.localName}:${index}`);
    if (parent === card.ownerDocument) return PREFIX + JSON.stringify([route, configKey, user, path]);
    node = parent.nodeType === 11 ? (parent as ShadowRoot).host : parent as Element;
  }
  return null;
}

function valid(value: unknown): value is KioskViewport {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<KioskViewport>;
  return typeof v.space === 'string' && v.space.length > 0 && typeof v.zoom === 'number'
    && Number.isFinite(v.zoom) && v.zoom > 0 && v.zoom <= 8 && !!v.view
    && [v.view.x, v.view.y, v.view.w, v.view.h].every(Number.isFinite)
    && v.view.w > 0 && v.view.h > 0;
}

export function saveKioskViewport(storage: MemoStorage | null, key: string | null, viewport: KioskViewport, now = Date.now()): boolean {
  if (!storage || !key || !valid(viewport)) return false;
  try { storage.setItem(key, JSON.stringify({ at: now, viewport })); return true; } catch { return false; }
}

export function takeKioskViewport(storage: MemoStorage | null, key: string | null, now = Date.now()): KioskViewport | null {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    storage.removeItem(key); // Only this placement, once; never global zoom/navigation keys.
    const memo = JSON.parse(raw) as { at?: unknown; viewport?: unknown };
    return typeof memo.at === 'number' && now >= memo.at && now - memo.at <= MAX_AGE && valid(memo.viewport)
      ? memo.viewport : null;
  } catch { return null; }
}
