/**
 * #869: position records Optimize could not match to an owner. Every such
 * record points to a space that no longer exists, so the plan never draws it
 * (`markerPos`/`labelPos` use a saved position only in its own space); the
 * dialog explains that, groups the records by cause, names what can be named
 * exactly and offers the actions that really exist. Nothing here writes: no
 * cleanup, no change of the optimizer's statuses or removal rules.
 */
import {
  acquireHaRegistries, haRegistrySnapshot, refreshHaRegistries,
} from './ha-binding-status';
import type { SpaceReferencePositionDetail } from './space-reference-repair';

export type UnverifiedGroup = 'legacy_group' | 'unknown_owner' | 'registry_unavailable';

/** Exactly one group per record, so the groups always sum to the total. */
export function unverifiedGroup(item: SpaceReferencePositionDetail): UnverifiedGroup {
  if (item.kind === 'legacy_group') return 'legacy_group';
  return item.reason === 'registry_unavailable' ? 'registry_unavailable' : 'unknown_owner';
}

/** `grp_<X>` is named only by the HA Area whose id is exactly X. */
export function legacyGroupAreaName(hass: unknown, id: string): string {
  const areas = (hass as { areas?: Record<string, { name?: unknown }> } | null)?.areas;
  const areaId = id.slice('grp_'.length);
  if (!areas || typeof areas !== 'object' || !Object.prototype.hasOwnProperty.call(areas, areaId)) {
    return '';
  }
  return String(areas[areaId]?.name ?? '').trim();
}

/** A readable name when one is known exactly; otherwise empty (the id stays). */
export function unverifiedName(hass: unknown, item: SpaceReferencePositionDetail): string {
  return item.name || (item.kind === 'legacy_group' ? legacyGroupAreaName(hass, item.id) : '');
}

export interface UnverifiedDiagnosticsInput {
  items: readonly SpaceReferencePositionDetail[];
  /** `haRegistryDiagnostics(hass)` at copy time */
  registry: { access: string; authoritative: boolean; error?: string };
  /** whether the analysis itself ran on a complete registry */
  analysisAuthoritative: boolean;
  cardVersion: string;
  integrationVersion: string | null;
  now: Date;
}

/**
 * Support JSON for every unverified record, not only the ten in «Details».
 * Ids, old spaces, kinds and causes only: no names, states or coordinates.
 */
export function unverifiedDiagnostics(input: UnverifiedDiagnosticsInput): object {
  const counts: Record<UnverifiedGroup, number> = {
    legacy_group: 0, unknown_owner: 0, registry_unavailable: 0,
  };
  for (const item of input.items) counts[unverifiedGroup(item)]++;
  return {
    kind: 'houseplan-optimize-unverified',
    cardVersion: input.cardVersion,
    integrationVersion: input.integrationVersion,
    checkedAt: input.now.toISOString(),
    registry: {
      access: input.registry.access,
      authoritative: input.registry.authoritative,
      error: input.registry.error ?? null,
      analysisAuthoritative: input.analysisAuthoritative,
    },
    counts: { total: input.items.length, ...counts },
    records: input.items.map((item) => ({
      id: item.id, spaceId: item.spaceId, kind: item.kind, reason: item.reason ?? null,
    })),
  };
}

/**
 * One fresh load of both HA registries through the page-shared authority,
 * bounded by `timeoutMs`. Resolves whether the registry is complete now; a
 * hung or refused load resolves `false` instead of waiting forever.
 */
export function reloadHaRegistriesBounded(hass: unknown, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const before = haRegistrySnapshot(hass).revision;
    let release: () => void = () => undefined;
    const timer = globalThis.setTimeout(() => {
      release();
      resolve(false);
    }, timeoutMs);
    release = acquireHaRegistries(hass, () => {
      const snapshot = haRegistrySnapshot(hass);
      if (snapshot.revision === before) return;
      globalThis.clearTimeout(timer);
      release();
      resolve(snapshot.authoritative);
    });
    refreshHaRegistries(hass);
  });
}
