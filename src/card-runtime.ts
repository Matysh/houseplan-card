import type { DevItem } from './types';
import { normalizeUnifiedWallTool } from './wall-tool-compat';

export const strictNumber = (value: string): number | null => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

export type LruRead<V> = { hit: true; value: V } | { hit: false };
export const lruRead = <K, V>(cache: Map<K, V>, key: K): LruRead<V> => {
  if (!cache.has(key)) return { hit: false };
  const value = cache.get(key)!;
  cache.delete(key);
  cache.set(key, value);
  return { hit: true, value };
};
export const lruWrite = <K, V>(cache: Map<K, V>, key: K, value: V, limit: number): void => {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

export type MarkupTool = 'select' | 'draw' | 'column' | 'merge' | 'split' | 'resize'
  | 'opening' | 'wallthick' | 'delroom';
export type DecorTool = 'select' | 'backdrop' | 'line' | 'rect' | 'ellipse' | 'text'
  | 'furniture' | 'image' | 'erase';

const MARKUP_TOOLS = new Set<MarkupTool>([
  'select', 'draw', 'column', 'merge', 'split', 'resize',
  'opening', 'wallthick', 'delroom',
]);

/** Warm viewport may contain a tool token written by an older bundle. */
export const normalizeMarkupTool = (value: unknown): MarkupTool => {
  value = normalizeUnifiedWallTool(value);
  // Opening placement also needs a session-only preset, which warm state omits.
  if (value === 'opening') return 'draw';
  return typeof value === 'string' && MARKUP_TOOLS.has(value as MarkupTool)
    ? value as MarkupTool : 'draw';
};

export type WarmViewport = {
  space: string;
  mode: 'view' | 'plan' | 'devices' | 'decor';
  projection: 'flat' | 'iso';
  activeLabsIso: boolean;
  logicalCenter: { x: number; y: number } | null;
  zoom: number;
  view: { x: number; y: number; w: number; h: number } | null;
  snap: { space: string; zoom: number; cx?: number; cy?: number } | null;
  tool: MarkupTool;
  decorTool: DecorTool;
  showHidden: boolean;
  showFar: boolean;
  selId: string | null;
  rszSel: string | null;
  decorSel: string | null;
};

export const expiredWarmViewport = (vp: WarmViewport | null): WarmViewport | null => {
  if (!vp || vp.mode === 'view') return vp;
  return {
    ...vp,
    mode: 'view',
    zoom: vp.snap?.space === vp.space ? vp.snap.zoom : vp.zoom,
    view: null,
    snap: null,
    tool: 'draw',
    decorTool: 'select',
    showHidden: false,
    selId: null,
    rszSel: null,
    decorSel: null,
  };
};

export type WarmDialogKind = 'space' | 'marker' | 'settings' | 'opening' | 'decorText'
  | 'decorShape' | 'backdrop' | 'rules' | 'room' | 'info' | 'openingInfo';
export type WarmDialog = { kind: WarmDialogKind; space: string; mode: string; data: any }; // any-ok: pre-existing heterogeneous in-memory dialog drafts intentionally retain their runtime shapes
export type WarmEntry = {
  owner: number;
  path: string;
  place: WeakRef<Node> | null;
  idx: number;
  live: boolean;
  hdrH: number;
  stageH: number;
  vp: WarmViewport | null;
  frameFingerprint: string;
  devices: readonly DevItem[] | null;
  dlg: WarmDialog | null;
  freed: number;
  evict: number;
};

export const warmBootKey = (config: unknown): string =>
  `${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(config ?? {})}`;

/** Select the warm slot most likely to represent the same DOM placement. */
export const warmMatch = (
  list: WarmEntry[], gen: number, place: Node | null, idx: number,
): { slot: WarmEntry | null; sure: boolean } => {
  const score = (slot: WarmEntry): number => {
    const same = !!place && slot.place?.deref() === place;
    if (same && slot.idx === idx) return 4;
    if (slot.live) return 0;
    return same ? 3 : 2;
  };
  let best: WarmEntry | null = null;
  let bestScore = 0;
  let ties = 0;
  let newest: WarmEntry | null = null;
  for (const slot of list) {
    if (slot.owner === gen) continue;
    newest = slot;
    const rank = score(slot);
    if (rank <= 0) continue;
    if (rank > bestScore) { best = slot; bestScore = rank; ties = 1; }
    else if (rank === bestScore) ties++;
  }
  if (!best || ties > 1) return { slot: best || newest, sure: false };
  return { slot: best, sure: true };
};
