import type { OpeningCfg } from './types';

/** An opening belongs to one exact space; display snapshots are not authority. */
export interface OpeningContext {
  readonly spaceId: string;
  readonly openingId: string;
}

export interface OpeningCarrier {
  readonly id: string;
  readonly openings?: readonly OpeningCfg[];
}

/** Shared read-only leaf for popup freshness (#894) and guarded actions (#846). */
export function currentOpeningContext(
  space: OpeningCarrier | null | undefined,
  context: OpeningContext | null | undefined,
): OpeningCfg | null {
  if (!space || !context || space.id !== context.spaceId) return null;
  return space.openings?.find((opening) => opening.id === context.openingId) ?? null;
}

/** Legacy bindings on a passage or a window lock do not create an info target. */
export function openingInfoEligible(opening: OpeningCfg): boolean {
  return opening.type !== 'passage' && (!!opening.contact
    || (opening.type === 'door' || opening.type === 'gate') && !!opening.lock);
}

export function openingBindingsEqual(a: OpeningCfg, b: OpeningCfg): boolean {
  return a.type === b.type && a.contact === b.contact && a.lock === b.lock;
}

interface OpeningState {
  readonly attributes?: { readonly friendly_name?: unknown };
}
const readableName = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Human identity comes only from the exact saved bindings, never name similarity. */
export function openingInfoNames(
  opening: OpeningCfg,
  states: Readonly<Record<string, OpeningState | undefined>> | null | undefined,
  placeName: unknown,
): { name: string | null; contactName: string | null; lockName: string | null; diagnostic: string | null } {
  const contact = opening.type !== 'passage' ? opening.contact : null;
  const lock = opening.type === 'door' || opening.type === 'gate' ? opening.lock : null;
  const contactName = contact ? readableName(states?.[contact]?.attributes?.friendly_name) : null;
  const lockName = lock ? readableName(states?.[lock]?.attributes?.friendly_name) : null;
  return { name: lockName || contactName || readableName(placeName), contactName, lockName,
    diagnostic: lockName || contactName ? null : lock || contact || null };
}
