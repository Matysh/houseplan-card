import type { ScreenOverrides } from './external-screens';
import { resolveFixedFloor, type FixedFloorSelection } from './initial-load';

/** A host's presentation intent, never part of the persisted card config. */
export interface RouteKiosk {
  readonly enabled: boolean;
  /** One-based position in the ordinary visible space list; null means all. */
  readonly position: number | null;
  readonly profile?: number | null;
  readonly overrides?: ScreenOverrides;
}

export const NO_ROUTE_KIOSK: RouteKiosk = Object.freeze({ enabled: false, position: null });

export function normalizeRouteKiosk(value?: RouteKiosk | null): RouteKiosk {
  if (value?.enabled !== true) return NO_ROUTE_KIOSK;
  const position = value.position;
  return { enabled: true, position: typeof position === 'number'
    && Number.isSafeInteger(position) && position > 0 ? position : null,
    ...(typeof value.profile === 'number' && Number.isSafeInteger(value.profile) && value.profile > 0 ? { profile: value.profile } : {}),
    ...(value.overrides ? { overrides: { ...value.overrides } } : {}) };
}

export function sameRouteKiosk(a: RouteKiosk, b: RouteKiosk): boolean {
  return a.enabled === b.enabled && a.position === b.position && a.profile === b.profile
    && JSON.stringify(a.overrides ?? {}) === JSON.stringify(b.overrides ?? {});
}

export type RouteFloorState = FixedFloorSelection | { kind: 'pending'; value: unknown };

/** Only the card has the authoritative ordered model. Invalid URL selection is soft. */
export function resolveRouteFloor(
  position: number | null, spaceIds: readonly string[], authoritative: boolean,
): RouteFloorState {
  if (position === null) return { kind: 'absent' };
  if (!authoritative) return { kind: 'pending', value: position };
  const selected = resolveFixedFloor({ hasFloor: true, floor: position - 1, spaceIds });
  return selected.kind === 'invalid' ? { kind: 'absent' } : selected;
}

/** The same selection boundary serves a soft URL position and strict Lovelace floor. */
export function resolvePresentationFloor(
  route: RouteKiosk | null, spaceIds: readonly string[], authoritative: boolean,
  hasFloor: boolean, floor: unknown,
): RouteFloorState {
  if (route?.enabled) return resolveRouteFloor(route.position, spaceIds, authoritative);
  const selection = resolveFixedFloor({ spaceIds, hasFloor, floor });
  if (!hasFloor || authoritative) return selection;
  if (typeof floor === 'number') {
    return selection.kind === 'valid' || selection.kind === 'invalid' && selection.reason === 'out-of-range-index'
      ? { kind: 'pending', value: floor } : selection;
  }
  if (selection.kind === 'valid' || selection.kind === 'invalid' && selection.reason !== 'unknown-id') return selection;
  return { kind: 'pending', value: floor };
}

/** HA custom panels own their first path segment, including internal pages. */
export function presentationRouteOwner(path: string, panelHost = false): string {
  return panelHost ? /^\/[^/]+/.exec(path)?.[0] ?? path : path;
}

/** Settings opened in Lovelace still link to the integration's registered main panel. */
export function externalScreenPath(path: string, panelHost: boolean, id: number): string {
  const owner = panelHost ? presentationRouteOwner(path, true) : '/houseplan';
  return `${owner && owner !== '/' ? owner : '/houseplan'}?hpprofile=${id}`;
}
