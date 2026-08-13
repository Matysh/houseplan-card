/** Reusable, presentation-only Labs flags. No flag may gate data or requests. */

export interface LabsFlag {
  id: string;
  issue: number;
  since: string;
  expires: string;
  summary: string;
}

export const LABS_STORAGE_KEY = 'houseplan_card_labs_v1';

export const LABS_FLAGS: readonly LabsFlag[] = Object.freeze([
  Object.freeze({
    id: 'iso',
    issue: 89,
    since: '1.62.0',
    expires: '1.65.0',
    summary: 'Volumetric plan renderer',
  }),
]);

export interface LabsLocation {
  search: string;
  hash: string;
}

export interface LabsResolution {
  active: readonly string[];
  space: string;
  persist: string | undefined;
  knownUrlOperation: boolean;
}

export interface LabsSnapshot {
  active: readonly string[];
  space: string;
}

type VersionCore = readonly [number, number, number];

export function parseVersionCore(value: string): VersionCore | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(String(value || '').trim());
  if (!match) return null;
  const core = match.slice(1).map(Number) as unknown as VersionCore;
  return core.every((part) => Number.isSafeInteger(part)) ? core : null;
}

function compareVersion(a: VersionCore, b: VersionCore): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

export function validLabsFlag(flag: LabsFlag): boolean {
  if (!/^[a-z][a-z0-9-]*$/.test(flag.id) || !Number.isInteger(flag.issue) || flag.issue <= 0
      || !flag.summary.trim()) return false;
  const since = parseVersionCore(flag.since);
  const expires = parseVersionCore(flag.expires);
  return !!since && !!expires && compareVersion(since, expires) < 0;
}

export function liveLabsFlags(
  version: string, registry: readonly LabsFlag[] = LABS_FLAGS,
): ReadonlyMap<string, LabsFlag> {
  const current = parseVersionCore(version);
  const live = new Map<string, LabsFlag>();
  if (!current) return live;
  const ids = new Set<string>();
  for (const flag of registry) {
    if (!validLabsFlag(flag) || ids.has(flag.id)) continue;
    ids.add(flag.id);
    const since = parseVersionCore(flag.since)!;
    const expires = parseVersionCore(flag.expires)!;
    if (compareVersion(current, since) >= 0 && compareVersion(current, expires) < 0) {
      live.set(flag.id, flag);
    }
  }
  return live;
}

export function hashParams(hash: string): URLSearchParams {
  const raw = String(hash || '').replace(/^#/, '');
  return new URLSearchParams(raw);
}

export function hashSpace(hash: string): string {
  return hashParams(hash).get('space') || '';
}

function storedFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function operations(params: URLSearchParams): string[] {
  return params.getAll('hp-labs').flatMap((value) => value.split(','))
    .map((value) => value.trim()).filter(Boolean);
}

/** Pure URL/storage resolver. Query operations run before stronger hash operations. */
export function resolveLabs(
  location: LabsLocation,
  storageValue: string | null | undefined,
  version: string,
  registry: readonly LabsFlag[] = LABS_FLAGS,
): LabsResolution {
  const live = liveLabsFlags(version, registry);
  const known = new Set(registry.filter(validLabsFlag).map((flag) => flag.id));
  const active = new Set(storedFlags(storageValue).filter((id) => live.has(id)));
  let knownUrlOperation = false;
  const apply = (token: string) => {
    if (token === 'off') {
      active.clear();
      knownUrlOperation = true;
      return;
    }
    const remove = token.startsWith('-');
    const id = remove ? token.slice(1) : token;
    if (!known.has(id)) return;
    knownUrlOperation = true;
    if (remove || !live.has(id)) active.delete(id);
    else active.add(id);
  };
  for (const token of operations(new URLSearchParams(String(location.search || '').replace(/^\?/, '')))) apply(token);
  for (const token of operations(hashParams(location.hash))) apply(token);
  const sorted = Object.freeze([...active].sort());
  return {
    active: sorted,
    space: hashSpace(location.hash),
    persist: knownUrlOperation ? JSON.stringify(sorted) : undefined,
    knownUrlOperation,
  };
}

declare global {
  interface Window { __hpLabs?: readonly string[]; }
}

let snapshot: LabsSnapshot = { active: Object.freeze([]), space: '' };
let configuredVersion = '';
let listening = false;
let loggedSignature = '';
const subscribers = new Set<(value: LabsSnapshot) => void>();

function browserStorageRead(): string | null {
  try { return window.localStorage.getItem(LABS_STORAGE_KEY); } catch { return null; }
}

function browserStorageWrite(value: string): void {
  try { window.localStorage.setItem(LABS_STORAGE_KEY, value); } catch { /* private mode/quota */ }
}

function publishBrowserLabs(): LabsSnapshot {
  if (typeof window === 'undefined') return snapshot;
  const resolved = resolveLabs(window.location, browserStorageRead(), configuredVersion);
  if (resolved.persist !== undefined) browserStorageWrite(resolved.persist);
  snapshot = { active: resolved.active, space: resolved.space };
  window.__hpLabs = resolved.active;
  for (const subscriber of subscribers) subscriber(snapshot);
  return snapshot;
}

function onLocationChange(): void { publishBrowserLabs(); }

function ensureBrowserLabs(version: string): LabsSnapshot {
  configuredVersion = version;
  if (typeof window === 'undefined') return snapshot;
  if (!listening) {
    listening = true;
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
  }
  return publishBrowserLabs();
}

/** One module-level browser listener; card instances only subscribe to its snapshot. */
export function subscribeLabs(
  version: string, subscriber: (value: LabsSnapshot) => void,
): () => void {
  subscribers.add(subscriber);
  subscriber(ensureBrowserLabs(version));
  return () => { subscribers.delete(subscriber); };
}

export function currentLabs(version: string): LabsSnapshot {
  return ensureBrowserLabs(version);
}

/** Diagnostics are emitted only when an active Labs frame is actually rendered. */
export function noteLabsRender(version: string): void {
  const current = currentLabs(version);
  const signature = current.active.join(',');
  if (!signature || signature === loggedSignature) return;
  loggedSignature = signature;
  const registry = new Map(LABS_FLAGS.map((flag) => [flag.id, flag]));
  const summary = current.active.map((id) => {
    const flag = registry.get(id)!;
    return `${id} (#${flag.issue}, expires ${flag.expires})`;
  }).join(', ');
  console.info(`HOUSEPLAN LABS: ${summary}`);
}
