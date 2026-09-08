/**
 * Stable placement identity for per-card summary preferences.
 *
 * Home Assistant may move a native card wrapper between visual Masonry
 * columns without changing its logical position in the dashboard. Cache the
 * wrapper's initial structural path so that later DOM reflow and remounting
 * the custom card inside that wrapper cannot move its local preferences.
 */
type PlacementNode = {
  localName?: unknown;
  parentNode?: unknown;
  children?: ArrayLike<unknown>;
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

/** Return one stable slot for the nearest HA card wrapper. */
export function stableSummaryPlacementSlot(start: object): string {
  const anchor = enclosingNativeCard(start);
  const existing = placementSlots.get(anchor);
  if (existing) return existing;
  const slot = structuralPath(anchor);
  placementSlots.set(anchor, slot);
  return slot;
}
