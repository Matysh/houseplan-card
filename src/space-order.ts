/**
 * Reordering the space tabs.
 *
 * The order of `config.spaces` is not decoration: it feeds the marker
 * placement fallback (`firstSpaceId`), the swipe neighbour and the positional
 * `floor` of a fixed-floor card. Moving a tab must therefore move nothing else
 * — see docs/specs/220-space-tab-reorder.md §8.
 *
 * Everything here is pure so the rules can be tested without a browser.
 */

/** How far the pointer must travel before a click becomes a drag. */
export const TAB_DRAG_THRESHOLD_PX = 4;

export interface TabDragContext {
  /** The card allows editing at all. */
  canEdit: boolean;
  /** A wall panel never reorders anything. */
  kiosk: boolean;
  /** Current mode; reordering lives in the editors only (owner, 2026-08-20). */
  mode: 'view' | 'plan' | 'devices' | 'decor';
  /** Pointer that started the gesture. */
  pointerType: string;
  /** How many spaces the panel shows right now. */
  spaceCount: number;
  /** A card pinned to one floor shows a single tab and must not reorder. */
  fixedFloor: boolean;
}

/**
 * Whether a pointerdown on a tab may begin a reorder.
 *
 * Touch is deliberately excluded rather than degraded: the tabs live in View
 * as well, where switching spaces is a fully supported touch interaction, and
 * any gesture on a tab would compete with the tap that switches. The product
 * decision is recorded as `Touch editor: not exposed`.
 */
export function canStartTabDrag(ctx: TabDragContext): boolean {
  if (!ctx.canEdit || ctx.kiosk || ctx.fixedFloor) return false;
  if (ctx.mode === 'view') return false;
  if (ctx.pointerType !== 'mouse') return false;
  return ctx.spaceCount > 1;
}

/** Has the pointer moved far enough to mean "drag" rather than "click"? */
export function passedDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= TAB_DRAG_THRESHOLD_PX;
}

/**
 * Move `movedId` so that it sits where `targetId` is, keeping every other id
 * in its relative order. Returns the same array instance when nothing moves,
 * so a caller can skip the write without comparing element by element.
 */
export function reorderSpaceIds(
  ids: readonly string[], movedId: string, targetId: string,
): string[] {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids as string[];
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, movedId);
  return next;
}

/** Reorder the stored spaces to match `order`; ids missing from it keep their tail. */
export function applySpaceOrder<T extends { id?: unknown }>(
  spaces: readonly T[], order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  // A stable sort keeps unknown ids (there should be none) in their old order
  // instead of shuffling them by an accidental comparison result.
  return spaces
    .map((space, index) => ({ space, index }))
    .sort((a, b) => {
      const ra = rank.get(String(a.space?.id)) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(String(b.space?.id)) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.index - b.index;
    })
    .map((entry) => entry.space);
}

export interface PlacementMarker {
  id?: unknown;
  space?: unknown;
  area?: unknown;
  removed?: unknown;
}

/**
 * Markers whose space is decided by the "first space" fallback, and where that
 * fallback currently lands.
 *
 * Such a marker has neither an explicit `space` nor an area that names a
 * space. Today it renders in whichever space happens to sit first; after a
 * reorder that would be a different one — the marker would move on its own,
 * which is the one thing a reorder may never do. Writing the answer it has
 * right now makes the placement explicit and independent of order for good.
 *
 * **The area is not only the marker's own field.** `resolveExplicitMarkerPlacement`
 * (`devices.ts`) reads `marker.area || <area of the HA device or entity>`, so a
 * marker that simply binds an existing HA device — the ordinary case, saved
 * without `area` or `space` — is anchored by the registry and never depended on
 * the order at all. Judging by `marker.area` alone would classify it as
 * order-dependent and write it a `space` it never asked for: a field that is
 * dormant today and moves the marker the day its HA area changes. Hence
 * `effectiveArea`, which answers with the area actually in force (review
 * CODE-REVIEW-220-r1, H1).
 */
export function markersNeedingPlacement(
  markers: readonly PlacementMarker[],
  areaToSpace: Readonly<Record<string, string>>,
  firstSpaceId: string,
  effectiveArea: (markerId: string) => string = () => '',
): { id: string; space: string }[] {
  if (!firstSpaceId) return [];
  const out: { id: string; space: string }[] = [];
  for (const marker of markers) {
    if (!marker || marker.removed === true) continue;
    const id = typeof marker.id === 'string' ? marker.id : '';
    if (!id) continue;
    const explicit = typeof marker.space === 'string' ? marker.space : '';
    if (explicit) continue;
    const own = typeof marker.area === 'string' ? marker.area : '';
    const area = own || effectiveArea(id) || '';
    if (area && areaToSpace[area]) continue;
    out.push({ id, space: firstSpaceId });
  }
  return out;
}
