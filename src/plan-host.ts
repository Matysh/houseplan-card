/** Runtime ports for the plan, not a renamed Home Assistant object (#1392).
 * No auth token, connection object or transport method belongs to presentation.
 * Responses retain their existing domain-specific runtime validation.
 */
import type { PlanCapabilities } from './plan-capabilities';
export type Unsubscribe = () => void;
export type HostAuthorityKey = object;
export type HouseplanCommand = Readonly<Record<string, unknown> & { type: `houseplan/${string}` }>;
export type HouseplanHttpPath = `/api/houseplan/${string}`;
export type PlanEventName = 'houseplan_config_updated' | 'houseplan_layout_updated';

export interface HostEntityState {
  readonly entity_id?: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_changed?: string;
  readonly last_updated?: string;
}
export type HostStates = Readonly<Record<string, HostEntityState>>;

export interface HostDeviceEntry {
  readonly id: string;
  readonly name?: string | null;
  readonly name_by_user?: string | null;
  readonly area_id?: string | null;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly disabled_by?: string | null;
  readonly [field: string]: unknown;
}
export interface HostEntityEntry {
  readonly entity_id: string;
  readonly device_id?: string | null;
  readonly area_id?: string | null;
  readonly name?: string | null;
  readonly original_name?: string | null;
  readonly disabled_by?: string | null;
  readonly entity_category?: string | null;
  readonly platform?: string;
  readonly [field: string]: unknown;
}
export interface HostAreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly [field: string]: unknown;
}
export interface HostRegistrySnapshot {
  readonly revision: number;
  /** An empty nonauthoritative registry is not evidence of removed bindings. */
  readonly authoritative: boolean;
  readonly access: 'pending' | 'full' | 'limited';
  readonly devices: Readonly<Record<string, HostDeviceEntry>>;
  readonly entities: Readonly<Record<string, HostEntityEntry>>;
  readonly areas: Readonly<Record<string, HostAreaEntry>>;
  readonly lastSuccess: number;
  readonly error?: string;
}

export interface HostLocale {
  readonly language?: string;
  readonly number_format?: string;
  readonly time_format?: string;
  readonly date_format?: string;
  readonly time_zone?: string;
  readonly first_weekday?: string;
}
export interface HostThemes {
  readonly darkMode?: boolean;
  readonly default_theme?: string;
  readonly themes?: Readonly<Record<string, unknown>>;
}
/** The only object allowed in presentation .hass bridges of plan dialogs. */
export interface HostPresentationContext {
  readonly language?: string;
  readonly locale?: HostLocale;
  readonly localize?: (key: string, ...args: unknown[]) => string | undefined;
  readonly themes?: HostThemes;
}
export interface HostPermissions {
  readonly read: boolean;
  readonly write: boolean;
  readonly admin: boolean;
}
export interface HostUnits {
  readonly length?: string;
  readonly temperature?: string;
  readonly pressure?: string;
  readonly volume?: string;
  readonly mass?: string;
}
export interface HostEnvironment {
  /** Opaque input-frame identity; metadata/permission publications may reuse it. */
  readonly inputKey?: object;
  readonly ready: boolean;
  readonly connected: boolean;
  /** Transport event sequence, including a short disconnect while unmounted. */
  readonly connectionRevision?: number;
  /** Optional data-only invalidation for host-specific smart-home View bridges. */
  readonly smartHomeRevision?: number;
  readonly userId?: string;
  readonly permissions: HostPermissions;
  readonly timeZone?: string;
  readonly units: HostUnits;
  readonly states: HostStates;
  readonly registry: HostRegistrySnapshot;
  readonly presentation: HostPresentationContext;
}

export interface HostEvent {
  readonly data?: Readonly<Record<string, unknown>>;
}
export interface HostSubscriptionOptions {
  /** Preserve the existing config stream selection and its ordinary fallback. */
  readonly externalScreens?: { readonly enabled: boolean; readonly baseRevision: number };
}
export interface HostHttpPort {
  /** Ordinary multipart/file IO. Authentication is exclusively adapter-owned. */
  request(path: HouseplanHttpPath, init?: RequestInit): Promise<Response>;
  /** Structured writes retain the authenticated JSON transport/fallback rule. */
  postJson(path: HouseplanHttpPath, value: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<unknown>;
}
export interface HostContentPort {
  /** Local hosts can resolve to a local/blob URL; HA uses its existing signer. */
  resolve(paths: readonly string[]): Promise<Readonly<Record<string, string>>>;
  /** Saved decor is readable even when asset-library editing is unavailable. */
  resolveAssets(ids: readonly string[]): Promise<unknown>;
}
export interface HostDeviceServices {
  /** Existing intent/security decisions stay with the calling device owner. */
  call(domain: string, service: string, data?: Readonly<Record<string, unknown>>,
    target?: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export interface PlanHost {
  readonly capabilities: PlanCapabilities;
  /** Connection-or-original-callWS plus user identity, opaque to the plan. */
  readonly authorityKey: HostAuthorityKey;
  /** Revokes writes on authority/permission changes, NOT ordinary state ticks. */
  readonly writeAuthorityRevision: number;
  readonly environmentRevision: number;
  readonly environment: HostEnvironment;
  readonly http: HostHttpPort;
  readonly content: HostContentPort;
  readonly deviceServices?: HostDeviceServices;
  /** Optional smart-home metadata refresh; never implies plan read/write authority. */
  refreshRegistry?(timeoutMs: number): Promise<boolean>;
  request<Result = unknown>(command: HouseplanCommand): Promise<Result>;
  subscribe(event: PlanEventName, receive: (event: HostEvent) => void | Promise<void>,
    options?: HostSubscriptionOptions): Promise<Unsubscribe>;
  /** Caller releases this when replacing the host or disconnecting its card. */
  subscribeEnvironment(receive: () => void): Unsubscribe;
}

export const once = (release: Unsubscribe): Unsubscribe => {
  let live = true;
  return () => { if (live) { live = false; release(); } };
};

/** Shared identity allocation retains multi-card signing/cache reuse. */
const authorityKeys = new WeakMap<object, Map<string | undefined, HostAuthorityKey>>();
export function hostAuthorityKey(source: unknown, userId: string | undefined, fallback: object): HostAuthorityKey {
  const identity = source && (typeof source === 'object' || typeof source === 'function') ? source as object : fallback;
  let users = authorityKeys.get(identity);
  if (!users) { users = new Map(); authorityKeys.set(identity, users); }
  let key = users.get(userId);
  if (!key) { key = {}; users.set(userId, key); }
  return key;
}

export const hostError = (code: string): Error & { code: string } => Object.assign(new Error(code), { code });
