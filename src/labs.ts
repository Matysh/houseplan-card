/** Reusable, presentation-only alpha capabilities. No capability may gate data or requests. */

export interface LabsFlag {
  id: string;
  issue: number;
  summary: string;
}

export const ALPHA_STORAGE_KEY = 'houseplan_card_alpha_v1';

export const LABS_FLAGS: readonly LabsFlag[] = Object.freeze([
  Object.freeze({
    id: 'iso',
    issue: 89,
    summary: 'Volumetric plan renderer',
  }),
]);

export interface LabsLocation {
  search: string;
  hash: string;
}

export interface LabsResolution {
  alpha: boolean;
  active: readonly string[];
  space: string;
  persist: '1' | '0' | undefined;
  knownUrlOperation: boolean;
}

export interface LabsSnapshot {
  alpha: boolean;
  active: readonly string[];
  space: string;
}

export function validLabsFlag(flag: LabsFlag): boolean {
  return /^[a-z][a-z0-9-]*$/.test(flag.id)
    && Number.isInteger(flag.issue) && flag.issue > 0
    && !!flag.summary.trim();
}

/** A malformed or ambiguous registry disables the whole mechanism. */
export function validLabsRegistry(registry: readonly LabsFlag[]): boolean {
  const ids = new Set<string>();
  for (const flag of registry) {
    if (!validLabsFlag(flag) || ids.has(flag.id)) return false;
    ids.add(flag.id);
  }
  return true;
}

export function hashParams(hash: string): URLSearchParams {
  const raw = String(hash || '').replace(/^#/, '');
  return new URLSearchParams(raw);
}

export function hashSpace(hash: string): string {
  return hashParams(hash).get('space') || '';
}

interface AlphaUrlResolution {
  present: boolean;
  value: boolean | undefined;
}

/** Query is weaker than hash; unrecognised values never become truthy. */
function alphaFromUrl(location: LabsLocation): AlphaUrlResolution {
  let present = false;
  let value: boolean | undefined;
  const apply = (params: URLSearchParams): void => {
    for (const operation of params.getAll('hp_alpha')) {
      present = true;
      if (operation === '1') value = true;
      else if (operation === '0') value = false;
    }
  };
  apply(new URLSearchParams(String(location.search || '').replace(/^\?/, '')));
  apply(hashParams(location.hash));
  return { present, value };
}

/** Pure URL/storage resolver. Alpha enables every capability known to this build. */
export function resolveLabs(
  location: LabsLocation,
  storageValue: string | null | undefined,
  registry: readonly LabsFlag[] = LABS_FLAGS,
): LabsResolution {
  const registryValid = validLabsRegistry(registry);
  const url = alphaFromUrl(location);
  const knownUrlOperation = url.value !== undefined;
  const storedAlpha = storageValue === '1';
  const requestedAlpha = knownUrlOperation
    ? url.value === true
    : url.present ? false : storedAlpha;
  const alpha = registryValid && requestedAlpha;
  const active = Object.freeze(alpha ? registry.map((flag) => flag.id).sort() : []);
  return {
    alpha,
    active,
    space: hashSpace(location.hash),
    persist: registryValid && knownUrlOperation ? (alpha ? '1' : '0') : undefined,
    knownUrlOperation,
  };
}

declare global {
  interface Window {
    __hpAlpha?: boolean;
    __hpLabs?: readonly string[];
    __hpLabsListenerCleanup?: () => void;
  }
}

let snapshot: LabsSnapshot = { alpha: false, active: Object.freeze([]), space: '' };
let listening = false;
let loggedSignature = '';
const subscribers = new Set<(value: LabsSnapshot) => void>();

function browserStorageRead(): string | null {
  try { return window.localStorage.getItem(ALPHA_STORAGE_KEY); } catch { return null; }
}

function browserStorageWrite(value: '1' | '0'): void {
  try { window.localStorage.setItem(ALPHA_STORAGE_KEY, value); } catch { /* private mode/quota */ }
}

function publishBrowserLabs(): LabsSnapshot {
  if (typeof window === 'undefined') return snapshot;
  const resolved = resolveLabs(window.location, browserStorageRead());
  if (resolved.persist !== undefined) browserStorageWrite(resolved.persist);
  snapshot = { alpha: resolved.alpha, active: resolved.active, space: resolved.space };
  window.__hpAlpha = resolved.alpha;
  window.__hpLabs = resolved.active;
  for (const subscriber of subscribers) subscriber(snapshot);
  return snapshot;
}

function onLocationChange(): void { publishBrowserLabs(); }

function ensureBrowserLabs(): LabsSnapshot {
  if (typeof window === 'undefined') return snapshot;
  if (!listening) {
    listening = true;
    window.__hpLabsListenerCleanup?.();
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    const cleanup = (): void => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
      if (window.__hpLabsListenerCleanup === cleanup) {
        delete window.__hpLabsListenerCleanup;
      }
    };
    window.__hpLabsListenerCleanup = cleanup;
  }
  return publishBrowserLabs();
}

/** One module-level browser listener; card instances only subscribe to its snapshot. */
export function subscribeLabs(subscriber: (value: LabsSnapshot) => void): () => void {
  subscribers.add(subscriber);
  const current = ensureBrowserLabs();
  if (typeof window === 'undefined') subscriber(current);
  return () => { subscribers.delete(subscriber); };
}

export function currentLabs(): LabsSnapshot {
  return ensureBrowserLabs();
}

/** Diagnostics are emitted only when an active alpha frame is actually rendered. */
export function noteLabsRender(): void {
  const current = snapshot;
  const signature = current.alpha ? current.active.join(',') : '';
  if (!signature || signature === loggedSignature) return;
  loggedSignature = signature;
  const registry = new Map(LABS_FLAGS.map((flag) => [flag.id, flag]));
  const summary = current.active.map((id) => {
    const flag = registry.get(id)!;
    return `${id} (#${flag.issue})`;
  }).join(', ');
  console.info(`HOUSEPLAN ALPHA: hp_alpha=1; ${summary}`);
}
