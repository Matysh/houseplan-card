import type { DecorKind, DecorShape } from './types';

const kinds = new Set<DecorKind>(['line', 'rect', 'ellipse', 'text', 'furniture', 'image']);

/** Resolve all requested IDs in paint order. Missing/ambiguous IDs never form a subset. */
export function decorSelectionMembers(items: readonly DecorShape[], ids: readonly string[]): DecorShape[] | null {
  const requested = new Set(ids);
  if (requested.size !== ids.length || ids.some(id => typeof id !== 'string' || !id)) return null;
  const found = new Map<string, DecorShape>();
  for (const item of items) {
    if (!requested.has(item.id)) continue;
    if (found.has(item.id) || !kinds.has(item.kind)) return null;
    found.set(item.id, item);
  }
  if (found.size !== requested.size) return null;
  return [...found.values()];
}

export function allDecorSelectionIds(items: readonly DecorShape[], furnitureOnly = false): string[] | null {
  const ids = items.filter(item => !furnitureOnly || item.kind === 'furniture').map(item => item.id);
  return decorSelectionMembers(items, ids) ? ids : null;
}

/** Selection itself is volatile; a repeated shortcut/toggle never edits a record. */
export function toggleDecorSelectionId(items: readonly DecorShape[], ids: readonly string[], id: string): string[] | null {
  if (!decorSelectionMembers(items, ids) || !decorSelectionMembers(items, [id])) return null;
  const next = new Set(ids);
  if (next.has(id)) next.delete(id); else next.add(id);
  return items.filter(item => next.has(item.id)).map(item => item.id);
}

export function homogeneousDecorKind(members: readonly DecorShape[]): DecorKind | null {
  const kind = members[0]?.kind;
  return kind && kinds.has(kind) && members.every(item => item.kind === kind) ? kind : null;
}