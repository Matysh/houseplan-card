import type { SummaryHassState } from './summary-panel-host';

export const SUMMARY_ENTITY_RESULT_LIMIT = 100;

export interface SummaryEntityIndexEntry {
  id: string;
  label: string;
  search: string;
}

export interface SummaryEntityIndex {
  entries: readonly SummaryEntityIndexEntry[];
  labels: ReadonlyMap<string, string>;
  rebuilds: number;
}

export interface SummaryEntitySearchResult {
  entries: readonly SummaryEntityIndexEntry[];
  total: number;
  truncated: boolean;
}

const friendlyName = (id: string, state: SummaryHassState | undefined): string => {
  const value = state?.attributes?.friendly_name;
  return typeof value === 'string' && value.trim() ? value.trim() : id;
};

/**
 * Refresh the searchable composition without rebuilding it for ordinary state
 * value updates. The labels map is intentionally independent of state values.
 */
export function refreshSummaryEntityIndex(
  states: Readonly<Record<string, SummaryHassState>> | null | undefined,
  previous: SummaryEntityIndex | null,
): SummaryEntityIndex {
  const source = states || {};
  const ids = Object.keys(source);
  if (previous && ids.length === previous.labels.size) {
    let unchanged = true;
    for (const id of ids) {
      if (previous.labels.get(id) !== friendlyName(id, source[id])) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) return previous;
  }
  const entries = ids.map((id) => {
    const label = friendlyName(id, source[id]);
    return { id, label, search: `${label}\n${id}`.toLocaleLowerCase() };
  }).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  return {
    entries,
    labels: new Map(entries.map((entry) => [entry.id, entry.label])),
    rebuilds: (previous?.rebuilds || 0) + 1,
  };
}

/** Search always scans the complete non-DOM index; only rendered results are bounded. */
export function searchSummaryEntityIndex(
  index: SummaryEntityIndex,
  query: string,
  limit = SUMMARY_ENTITY_RESULT_LIMIT,
): SummaryEntitySearchResult {
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? index.entries.filter((entry) => entry.search.includes(needle))
    : index.entries;
  const bounded = Math.max(0, Math.floor(limit));
  return {
    entries: matches.slice(0, bounded),
    total: matches.length,
    truncated: matches.length > bounded,
  };
}
