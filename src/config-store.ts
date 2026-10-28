/**
 * Module-level houseplan config cache shared by every embedded card on a board,
 * so N cards do NOT issue N identical `houseplan/config/get` requests. The cache
 * is invalidated when the integration emits `houseplan_config_updated`
 * (fired on config/set); subscribers are then notified to reload.
 *
 * The full `houseplan-card` already persists a `{config, rev, layout}` snapshot in
 * localStorage (`houseplan_card_cfg_v1`) for its own instant start — we seed from it
 * so embedded cards paint immediately, then refresh from the server in the background.
 */
import { contentFingerprint } from './visual-continuity';
import {
  adoptVirtualLightServerSnapshot,
  applyVirtualLightEvent,
  virtualLightSnapshot,
  type VirtualLightSnapshot,
} from './virtual-light-state';

const LS_CFG = 'houseplan_card_cfg_v1';

export interface HpConfigSnapshot {
  config: any | null;
  rev: number;
  /** Runtime-only: absent until a fresh config/get advertises exact v1. */
  decorAssetsApi: number | null;
  summaryPanelApi: number | null;
  configFingerprint: string;
  layout: Record<string, any>;
  layoutRev: number;
  layoutFingerprint: string;
  virtualLights: VirtualLightSnapshot;
}

let cache: HpConfigSnapshot | null = null;
let inflight: Promise<HpConfigSnapshot> | null = null;
let fetchGeneration = 0;
let inflightGeneration = -1;
let configInvalid = true;
let layoutInvalid = true;
let eventTimer: ReturnType<typeof setTimeout> | undefined;
let pendingConfigRev = -1;
let pendingLayoutRev = -1;
let subscribedConnection: any = null;
let subscriptionUnsubscribers: Array<() => void> = [];
const listeners = new Set<() => void>();

const keepUnsubscriber = (value: unknown, target: Array<() => void>): void => {
  if (typeof value === 'function') target.push(value as () => void);
};

/** Instant, synchronous best-effort snapshot from the full card's localStorage cache. */
export function cachedSnapshot(): HpConfigSnapshot | null {
  if (cache) return cache;
  try {
    const c = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
    if (c && c.config && Array.isArray(c.config.spaces)) {
      const layout = c.layout || {};
      return {
        config: c.config,
        rev: c.rev || 0,
        decorAssetsApi: null,
        summaryPanelApi: null,
        configFingerprint: c.config_fingerprint || contentFingerprint(c.config),
        layout,
        layoutRev: c.layout_rev || 0,
        layoutFingerprint: c.layout_fingerprint || contentFingerprint(layout),
        virtualLights: virtualLightSnapshot(c.virtual_lights, c.rev || 0),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchFresh(hass: any, generation: number): Promise<HpConfigSnapshot> {
  const previous = cache;
  const readConfig = configInvalid || !previous;
  const readLayout = layoutInvalid || !previous;
  const [cfgResp, layResp] = await Promise.all([
    readConfig ? hass.callWS({ type: 'houseplan/config/get' }) : null,
    readLayout ? hass.callWS({ type: 'houseplan/layout/get' }) : null,
  ]);
  const configRev = readConfig ? cfgResp?.rev ?? 0 : previous!.rev;
  const virtualLights = !readConfig ? cache!.virtualLights : cache
    ? adoptVirtualLightServerSnapshot(
      cache.virtualLights,
      cfgResp?.virtual_lights,
      configRev,
      !!cfgResp && 'virtual_lights' in cfgResp,
    )
    : virtualLightSnapshot(cfgResp?.virtual_lights, configRev);
  const snapshot: HpConfigSnapshot = {
    config: readConfig ? cfgResp?.config ?? null : previous!.config,
    rev: configRev,
    decorAssetsApi: readConfig ? cfgResp?.decor_assets_api === 1 ? 1 : null : previous!.decorAssetsApi,
    summaryPanelApi: readConfig ? cfgResp?.summary_panel_api === 1 ? 1 : null : previous!.summaryPanelApi,
    configFingerprint: readConfig ? contentFingerprint(cfgResp?.config ?? null) : previous!.configFingerprint,
    layout: readLayout ? layResp?.layout ?? {} : previous!.layout,
    layoutRev: readLayout ? layResp?.rev ?? 0 : previous!.layoutRev,
    layoutFingerprint: readLayout ? contentFingerprint(layResp?.layout ?? {}) : previous!.layoutFingerprint,
    virtualLights,
  };
  // A force request may arrive while this fetch is in flight. Its older
  // response remains useful to its original caller, but must not repopulate
  // the shared cache after the newer generation invalidated it.
  if (generation === fetchGeneration) {
    cache = snapshot;
    configInvalid = layoutInvalid = false;
    pendingConfigRev = pendingLayoutRev = -1;
  }
  const connection = hass.connection;
  if (connection?.subscribeEvents && subscribedConnection !== connection) {
    for (const unsubscribe of subscriptionUnsubscribers) unsubscribe();
    subscriptionUnsubscribers = [];
    subscribedConnection = connection;
    clearTimeout(eventTimer);
    eventTimer = undefined;
    const invalidate = (kind: 'config' | 'layout', event: { data?: { rev?: unknown } }) => {
      if (subscribedConnection !== connection) return;
      const rev = event?.data?.rev;
      const knownRev = kind === 'config'
        ? Math.max(cache?.rev ?? -1, pendingConfigRev)
        : Math.max(cache?.layoutRev ?? -1, pendingLayoutRev);
      if (typeof rev === 'number' && Number.isSafeInteger(rev) && rev >= 0) {
        if (rev <= knownRev) return;
        if (kind === 'config') pendingConfigRev = rev;
        else pendingLayoutRev = rev;
      }
      if (kind === 'config') configInvalid = true;
      else layoutInvalid = true;
      // Retain the other half for partial reads, but fence an older response
      // immediately. One trailing window wakes all cards after a write burst.
      fetchGeneration++;
      clearTimeout(eventTimer);
      eventTimer = setTimeout(() => {
        eventTimer = undefined;
        if (subscribedConnection === connection) listeners.forEach((listener) => listener());
      }, 200);
    };
    const pendingUnsubscribers: Array<() => void> = [];
    try {
      keepUnsubscriber(
        await connection.subscribeEvents((event: { data?: { rev?: unknown } }) => invalidate('config', event), 'houseplan_config_updated'),
        pendingUnsubscribers,
      );
      // Layout is separate state: dragging an icon on the full card writes only
      // the layout, so a static card on the same dashboard kept showing the old
      // position until the config changed or the page was reloaded — possibly
      // forever on a wall tablet (HP-1454-08).
      keepUnsubscriber(
        await connection.subscribeEvents((event: { data?: { rev?: unknown } }) => invalidate('layout', event), 'houseplan_layout_updated'),
        pendingUnsubscribers,
      );
      keepUnsubscriber(await connection.subscribeEvents((event: any) => {
        if (cache) {
          const next = applyVirtualLightEvent(cache.virtualLights, event?.data);
          if (next === cache.virtualLights) return;
          cache = { ...cache, virtualLights: next };
        } else {
          fetchGeneration++;
        }
        listeners.forEach((listener) => listener());
      }, 'houseplan_virtual_light_updated'), pendingUnsubscribers);
      if (subscribedConnection === connection) {
        subscriptionUnsubscribers = pendingUnsubscribers;
      } else {
        for (const unsubscribe of pendingUnsubscribers) unsubscribe();
      }
    } catch {
      for (const unsubscribe of pendingUnsubscribers) unsubscribe();
      if (subscribedConnection === connection) subscribedConnection = null;
    }
  }
  return snapshot;
}

/** Get the shared config snapshot (cached, deduped across cards). */
export function getConfig(hass: any, force = false): Promise<HpConfigSnapshot> {
  if (force) {
    configInvalid = layoutInvalid = true;
    fetchGeneration++;
    if (inflight) {
      // Do not let `force` silently join the stale request it was meant to
      // supersede. Wait for that transport slot, then issue a fresh generation.
      return inflight.catch(() => null).then(() => getConfig(hass, false));
    }
  }
  if (cache && !configInvalid && !layoutInvalid) return Promise.resolve(cache);
  if (inflight) {
    if (inflightGeneration !== fetchGeneration) {
      return inflight.catch(() => null).then(() => getConfig(hass, false));
    }
    return inflight;
  }
  const generation = fetchGeneration;
  inflightGeneration = generation;
  inflight = fetchFresh(hass, generation).finally(() => {
    inflight = null;
    inflightGeneration = -1;
  });
  return inflight;
}

/** Subscribe to config-changed notifications; returns an unsubscribe function. */
export function onConfigChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
