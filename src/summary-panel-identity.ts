/**
 * Stable placement identity for per-card summary preferences.
 *
 * Home Assistant may move a card element between visual Masonry columns
 * without changing its logical position in the dashboard. Native Masonry
 * therefore uses the canonical `cards` array; other hosts retain the
 * structural fallback introduced with the summary panel.
 */
type PlacementNode = {
  localName?: unknown;
  parentNode?: unknown;
  children?: ArrayLike<unknown>;
  cards?: ArrayLike<unknown>;
  host?: unknown;
  getRootNode?: () => unknown;
};

const placementSlots = new WeakMap<object, string>();

const objectNode = (value: unknown): object | null =>
  value !== null && (typeof value === 'object' || typeof value === 'function') ? value as object : null;

function shapeOf(node: object): PlacementNode {
  return node as PlacementNode;
}

function localNameOf(node: object): string {
  const value = shapeOf(node).localName;
  return typeof value === 'string' && value ? value : 'node';
}

function parentOf(node: object): object | null {
  const shape = shapeOf(node);
  const parent = objectNode(shape.parentNode);
  if (parent) return parent;
  const directHost = objectNode(shape.host);
  if (directHost) return directHost;
  if (typeof shape.getRootNode !== 'function') return null;
  const root = objectNode(shape.getRootNode.call(node));
  if (!root || root === node) return null;
  return objectNode(shapeOf(root).host);
}

function enclosingNativeCard(start: object): object {
  let node: object | null = start;
  for (let depth = 0; node && depth < 16; depth++) {
    const name = localNameOf(node);
    if (name === 'hui-card') return node;
    node = parentOf(node);
  }
  return start;
}

function structuralPath(start: object): string {
  const parts: string[] = [];
  let node: object | null = start;
  for (let depth = 0; node && depth < 16; depth++) {
    const parent = parentOf(node);
    if (!parent) {
      parts.unshift(localNameOf(node));
      break;
    }
    const children = shapeOf(parent).children;
    const index = children ? Array.from(children).indexOf(node) : -1;
    parts.unshift(`${localNameOf(node)}:${Math.max(0, index)}`);
    node = parent;
  }
  return parts.join('/') || 'root';
}

function ancestorChain(start: object): object[] {
  const chain: object[] = [];
  const seen = new Set<object>();
  let node: object | null = start;
  for (let depth = 0; node && depth < 32 && !seen.has(node); depth++) {
    chain.push(node);
    seen.add(node);
    node = parentOf(node);
  }
  return chain;
}

function childToken(node: object, parent: object): string | null {
  const children = shapeOf(parent).children;
  if (children) {
    const index = Array.from(children).indexOf(node);
    if (index >= 0) return `${localNameOf(node)}:${index}`;
  }
  return objectNode(shapeOf(node).host) === parent ? 'shadow-root' : null;
}

/** A deterministic composed path below one canonical top-level HA card. */
function descendantPath(start: object, ancestor: object): string | null {
  if (start === ancestor) return '';
  const parts: string[] = [];
  let node: object | null = start;
  const seen = new Set<object>();
  for (let depth = 0; node && depth < 32 && !seen.has(node); depth++) {
    if (node === ancestor) return parts.join('/');
    seen.add(node);
    const parent = parentOf(node);
    if (!parent) return null;
    const token = childToken(node, parent);
    if (!token) return null;
    parts.unshift(token);
    node = parent;
  }
  return node === ancestor ? parts.join('/') : null;
}

type MasonryPlacement =
  | { kind: 'not-masonry' }
  | { kind: 'unresolved' }
  | { kind: 'resolved'; slot: string };

/** Resolve against HA's canonical cards array, never its visual columns. */
function masonryPlacement(start: object): MasonryPlacement {
  const chain = ancestorChain(start);
  const masonryAt = chain.findIndex((node) => localNameOf(node) === 'hui-masonry-view');
  if (masonryAt < 0) return { kind: 'not-masonry' };

  const masonry = chain[masonryAt];
  const source = shapeOf(masonry).cards;
  if (!source) return { kind: 'unresolved' };
  const cards = Array.from(source);
  const ancestors = new Set(chain.slice(0, masonryAt));
  const cardIndex = cards.findIndex((candidate) => {
    const card = objectNode(candidate);
    return !!card && ancestors.has(card);
  });
  if (cardIndex < 0) return { kind: 'unresolved' };

  const topCard = objectNode(cards[cardIndex]);
  if (!topCard) return { kind: 'unresolved' };
  const suffix = descendantPath(start, topCard);
  if (suffix === null) return { kind: 'unresolved' };
  const slot = `masonry-v2:${cardIndex}${suffix ? `/${suffix}` : ''}`;
  placementSlots.set(start, slot);
  return { kind: 'resolved', slot };
}

/** Return one stable slot, or null until a native Masonry identity is safe. */
export function stableSummaryPlacementSlot(start: object): string | null {
  const cached = placementSlots.get(start);
  if (cached) return cached;
  const masonry = masonryPlacement(start);
  if (masonry.kind === 'resolved') return masonry.slot;
  if (masonry.kind === 'unresolved') return null;

  const anchor = enclosingNativeCard(start);
  const existing = placementSlots.get(anchor);
  if (existing) return existing;
  const slot = structuralPath(anchor);
  placementSlots.set(anchor, slot);
  return slot;
}
