import type {
  ServerConfig, SummaryPanelBlock, SummaryPanelConfig, SummaryPanelValue,
} from './types';

export const SUMMARY_PANEL_LIMITS = Object.freeze({ blocks: 10, values: 20, title: 48, label: 64 });
export const SUMMARY_PANEL_LOCAL_PREFIX = 'houseplan.summary-panel.v1';
export const SUMMARY_PANEL_LEGACY_SCALE_KEY = 'houseplan_card_kiosk_v1';
export const SUMMARY_PANEL_MIN_WIDTH = 280;

export type SummaryTranslate = (key: string) => string;

export interface SummaryPanelLocalPreferences {
  version: 1;
  show: boolean;
  icon_scale: number;
  font_scale: number;
}

export interface SummaryDraftProblem {
  path: string;
  kind: 'error' | 'warning';
  code: 'required' | 'limit' | 'duplicate_id' | 'invalid_source' | 'missing_entity' | 'missing_space';
}

export interface SummaryLayoutInput {
  width: number;
  height: number;
  safeLeft?: number;
  safeRight?: number;
  safeTop?: number;
  safeBottom?: number;
  controlTop?: number;
  controlBottom?: number;
  minimumHeight: number;
}

export interface SummaryLayout {
  side: 'right' | 'bottom';
  fits: boolean;
  availableWidth: number;
  heightCap: number;
  top: number;
  bottom: number;
}

const cpLength = (value: string): number => [...value].length;
const cleanText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

export function createSummaryId(prefix: 'b' | 'v'): string {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function defaultSummaryPanel(t: SummaryTranslate): SummaryPanelConfig {
  return {
    version: 1,
    title: t('summary.default_title'),
    show_on_mobile: true,
    blocks: [{
      id: 'summary-default',
      title: t('summary.default_block'),
      visible: true,
      scope: { type: 'all' },
      values: [
        { id: 'summary-device-count', label: t('summary.system.device_count'), source: { type: 'system', key: 'device_count' } },
        { id: 'summary-total-area', label: t('summary.system.total_area'), source: { type: 'system', key: 'total_area' } },
        { id: 'summary-datetime', label: t('summary.system.datetime'), source: { type: 'system', key: 'datetime' } },
      ],
    }],
  };
}

/** Undefined is a derived default; an unknown future version stays inert. */
export function summaryPanelOf(
  settings: ServerConfig['settings'] | null | undefined,
  t: SummaryTranslate,
): { config: SummaryPanelConfig | null; derived: boolean; unsupported: boolean } {
  const raw = settings?.summary_panel;
  if (raw === undefined) return { config: defaultSummaryPanel(t), derived: true, unsupported: false };
  if (!runnableSummaryPanel(raw)) {
    return { config: null, derived: false, unsupported: true };
  }
  return { config: raw, derived: false, unsupported: false };
}

function runnableSummaryPanel(raw: unknown): raw is SummaryPanelConfig {
  if (!record(raw)) return false;
  const panel = raw;
  if (panel.version !== 1 || typeof panel.title !== 'string'
      || typeof panel.show_on_mobile !== 'boolean' || !Array.isArray(panel.blocks)) return false;
  return panel.blocks.every((candidate) => {
    if (!record(candidate) || typeof candidate.id !== 'string'
        || typeof candidate.title !== 'string' || typeof candidate.visible !== 'boolean'
        || !record(candidate.scope) || !Array.isArray(candidate.values)) return false;
    const scope = candidate.scope;
    if (scope.type !== 'all'
        && !(scope.type === 'space' && typeof scope.space_id === 'string')) return false;
    return candidate.values.every((entry) => {
      if (!record(entry) || typeof entry.id !== 'string' || typeof entry.label !== 'string'
          || !record(entry.source)) return false;
      const source = entry.source;
      return source.type === 'entity' && typeof source.entity_id === 'string'
        || source.type === 'system' && typeof source.key === 'string'
          && ['device_count', 'total_area', 'datetime'].includes(source.key);
    });
  });
}

export function cloneSummaryPanel(config: SummaryPanelConfig): SummaryPanelConfig {
  return structuredClone(config);
}

export function visibleSummaryBlocks(
  config: SummaryPanelConfig,
  spaceId: string,
): SummaryPanelBlock[] {
  return config.blocks.filter((block) => block.visible
    && (block.scope.type === 'all'
      || block.scope.type === 'space' && block.scope.space_id === spaceId));
}

/**
 * Complete bounded HA dependency projection for the supported shared panel.
 * Visibility and space scope are intentionally irrelevant: local show/floor
 * changes must never leave the next frame subscribed to an older subset.
 */
export function summaryPanelEntityIds(
  config: SummaryPanelConfig | null | undefined,
): readonly string[] {
  if (!config || !runnableSummaryPanel(config)) return [];
  const ids = new Set<string>();
  for (const block of config.blocks) for (const value of block.values) {
    if (value.source.type !== 'entity') continue;
    const id = cleanText(value.source.entity_id);
    if (id) ids.add(id);
  }
  return [...ids];
}

function oldReferenceMaps(base: SummaryPanelConfig | null): {
  scopes: Map<string, string>; sources: Map<string, string>;
} {
  const scopes = new Map<string, string>();
  const sources = new Map<string, string>();
  for (const block of base?.blocks || []) {
    if (block.scope.type === 'space') scopes.set(block.id, block.scope.space_id);
    for (const value of block.values) {
      if (value.source.type === 'entity') sources.set(value.id, value.source.entity_id);
    }
  }
  return { scopes, sources };
}

export function validateSummaryDraft(
  draft: SummaryPanelConfig,
  base: SummaryPanelConfig | null,
  spaceIds: ReadonlySet<string>,
  entityIds: ReadonlySet<string>,
): SummaryDraftProblem[] {
  const out: SummaryDraftProblem[] = [];
  const refs = oldReferenceMaps(base);
  const blockIds = new Set<string>();
  const valueIds = new Set<string>();
  const text = (value: unknown, max: number, path: string): void => {
    const normalized = cleanText(value);
    if (!normalized) out.push({ path, kind: 'error', code: 'required' });
    else if (cpLength(normalized) > max) out.push({ path, kind: 'error', code: 'limit' });
  };
  text(draft.title, SUMMARY_PANEL_LIMITS.title, 'title');
  if (draft.blocks.length > SUMMARY_PANEL_LIMITS.blocks) {
    out.push({ path: 'blocks', kind: 'error', code: 'limit' });
  }
  draft.blocks.forEach((block, bi) => {
    const bp = `blocks.${bi}`;
    text(block.id, SUMMARY_PANEL_LIMITS.label, `${bp}.id`);
    text(block.title, SUMMARY_PANEL_LIMITS.title, `${bp}.title`);
    if (blockIds.has(block.id)) out.push({ path: `${bp}.id`, kind: 'error', code: 'duplicate_id' });
    blockIds.add(block.id);
    if (block.scope.type === 'space') {
      const id = cleanText(block.scope.space_id);
      if (!id) out.push({ path: `${bp}.scope`, kind: 'error', code: 'required' });
      else if (!spaceIds.has(id)) out.push({
        path: `${bp}.scope`,
        kind: refs.scopes.get(block.id) === id ? 'warning' : 'error',
        code: 'missing_space',
      });
    } else if (block.scope.type !== 'all') {
      out.push({ path: `${bp}.scope`, kind: 'error', code: 'required' });
    }
    if (block.values.length > SUMMARY_PANEL_LIMITS.values) {
      out.push({ path: `${bp}.values`, kind: 'error', code: 'limit' });
    }
    block.values.forEach((value, vi) => {
      const vp = `${bp}.values.${vi}`;
      text(value.id, SUMMARY_PANEL_LIMITS.label, `${vp}.id`);
      text(value.label, SUMMARY_PANEL_LIMITS.label, `${vp}.label`);
      if (valueIds.has(value.id)) out.push({ path: `${vp}.id`, kind: 'error', code: 'duplicate_id' });
      valueIds.add(value.id);
      if (value.source.type === 'entity') {
        const id = cleanText(value.source.entity_id);
        if (!id) out.push({ path: `${vp}.source`, kind: 'error', code: 'required' });
        else if (!entityIds.has(id)) out.push({
          path: `${vp}.source`,
          kind: refs.sources.get(value.id) === id ? 'warning' : 'error',
          code: 'missing_entity',
        });
      } else if (value.source.type !== 'system'
          || !['device_count', 'total_area', 'datetime'].includes(value.source.key)) {
        out.push({ path: `${vp}.source`, kind: 'error', code: 'invalid_source' });
      }
    });
  });
  return out;
}

export function normalizeSummaryDraft(draft: SummaryPanelConfig): SummaryPanelConfig {
  return {
    ...draft,
    version: 1,
    title: cleanText(draft.title),
    show_on_mobile: draft.show_on_mobile !== false,
    blocks: draft.blocks.map((block) => ({
      ...block,
      id: cleanText(block.id),
      title: cleanText(block.title),
      visible: block.visible !== false,
      scope: block.scope.type === 'space'
        ? { ...block.scope, type: 'space', space_id: cleanText(block.scope.space_id) }
        : { ...block.scope, type: 'all' },
      values: block.values.map((value) => ({
        ...value,
        id: cleanText(value.id),
        label: cleanText(value.label),
        source: value.source.type === 'entity'
          ? { ...value.source, type: 'entity', entity_id: cleanText(value.source.entity_id) }
          : { ...value.source, type: 'system', key: value.source.key },
      })),
    })),
  };
}

export function resolveSummaryLayout(input: SummaryLayoutInput): SummaryLayout {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);
  const side = width >= height ? 'right' : 'bottom';
  const inset = 12;
  const left = Math.max(0, input.safeLeft || 0) + inset;
  const right = Math.max(0, input.safeRight || 0) + inset;
  const top = Math.max(Math.max(0, input.safeTop || 0) + inset, input.controlTop || 0);
  const bottom = Math.max(Math.max(0, input.safeBottom || 0) + inset, input.controlBottom || 0);
  const availableWidth = Math.max(0, width - left - right);
  const availableHeight = Math.max(0, height - top - bottom);
  const heightCap = side === 'bottom' ? Math.min(height * 0.6, availableHeight) : availableHeight;
  return {
    side,
    fits: width > 0 && height > 0 && availableWidth >= SUMMARY_PANEL_MIN_WIDTH
      && heightCap >= Math.max(0, input.minimumHeight),
    availableWidth,
    heightCap,
    top,
    bottom,
  };
}

export function effectiveSummaryVisible(input: {
  view: boolean; localShow: boolean; showOnMobile: boolean;
  narrow: boolean | null; fits: boolean;
}): boolean {
  const mobileAllowed = input.showOnMobile || input.narrow === false;
  return input.view && input.localShow && mobileAllowed && input.fits;
}

export function summaryLocalKey(parts: {
  userId?: string | null; path?: string; host?: string; slot?: string;
}): string | null {
  const user = cleanText(parts.userId);
  const slot = cleanText(parts.slot);
  if (!user || !slot) return null;
  const encoded = [user, cleanText(parts.path) || '/', cleanText(parts.host) || 'card', slot]
    .map((value) => encodeURIComponent(value)).join(':');
  return `${SUMMARY_PANEL_LOCAL_PREFIX}:${encoded}`;
}

export function normalizeSummaryScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.5, Math.min(3, Math.round(n * 20) / 20));
}

export function parseSummaryLocal(
  raw: unknown,
  legacy: unknown,
): SummaryPanelLocalPreferences {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const old = legacy && typeof legacy === 'object' ? legacy as Record<string, unknown> : {};
  return {
    version: 1,
    show: source.show === true,
    icon_scale: normalizeSummaryScale(own(source, 'icon_scale') ? source.icon_scale : old.icon),
    font_scale: normalizeSummaryScale(own(source, 'font_scale') ? source.font_scale : old.font),
  };
}

export function sameSummaryPanel(a: SummaryPanelConfig, b: SummaryPanelConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ConfirmedSummaryPanelWriteRecovery {
  readonly config: ServerConfig;
  readonly rev: number;
}

/**
 * A transport failure is a lost ACK only when one authoritative read returns
 * the exact saved panel together with a complete config and its revision.
 */
export function confirmedSummaryPanelWriteRecovery(
  response: unknown,
  draft: SummaryPanelConfig,
): ConfirmedSummaryPanelWriteRecovery | null {
  if (!record(response)) return null;
  const config = response.config;
  const rev = response.rev;
  if (!record(config) || !Array.isArray(config.spaces)
      || typeof rev !== 'number' || !Number.isSafeInteger(rev) || rev < 0) return null;
  const settings = record(config.settings) ? config.settings : null;
  const saved = settings?.summary_panel;
  if (!runnableSummaryPanel(saved) || !sameSummaryPanel(saved, draft)) return null;
  return { config: config as unknown as ServerConfig, rev };
}

export function moveSummaryItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function newSummaryBlock(t: SummaryTranslate): SummaryPanelBlock {
  return { id: createSummaryId('b'), title: t('summary.new_block'), visible: true, scope: { type: 'all' }, values: [] };
}

export function newSummaryValue(_t: SummaryTranslate): SummaryPanelValue {
  return { id: createSummaryId('v'), label: '', source: { type: 'entity', entity_id: '' } };
}
