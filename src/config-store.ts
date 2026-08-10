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

const LS_CFG = 'houseplan_card_cfg_v1';

export interface HpConfigSnapshot {
  config: any | null;
  rev: number;
  configFingerprint: string;
  layout: Record<string, any>;
  layoutRev: number;
  layoutFingerprint: string;
}

let cache: HpConfigSnapshot | null = null;
let inflight: Promise<HpConfigSnapshot> | null = null;
let subscribed = false;
const listeners = new Set<() => void>();

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
        configFingerprint: c.config_fingerprint || contentFingerprint(c.config),
        layout,
        layoutRev: c.layout_rev || 0,
        layoutFingerprint: c.layout_fingerprint || contentFingerprint(layout),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchFresh(hass: any): Promise<HpConfigSnapshot> {
  const [cfgResp, layResp] = await Promise.all([
    hass.callWS({ type: 'houseplan/config/get' }),
    hass.callWS({ type: 'houseplan/layout/get' }),
  ]);
  cache = {
    config: cfgResp?.config ?? null,
    rev: cfgResp?.rev ?? 0,
    configFingerprint: contentFingerprint(cfgResp?.config ?? null),
    layout: layResp?.layout ?? {},
    layoutRev: layResp?.rev ?? 0,
    layoutFingerprint: contentFingerprint(layResp?.layout ?? {}),
  };
  if (!subscribed && hass.connection?.subscribeEvents) {
    subscribed = true;
    const invalidate = () => {
      cache = null; // invalidate; listeners reload
      listeners.forEach((l) => l());
    };
    try {
      await hass.connection.subscribeEvents(invalidate, 'houseplan_config_updated');
      // Layout is separate state: dragging an icon on the full card writes only
      // the layout, so a static card on the same dashboard kept showing the old
      // position until the config changed or the page was reloaded — possibly
      // forever on a wall tablet (HP-1454-08).
      await hass.connection.subscribeEvents(invalidate, 'houseplan_layout_updated');
    } catch {
      subscribed = false;
    }
  }
  return cache;
}

/** Get the shared config snapshot (cached, deduped across cards). */
export function getConfig(hass: any, force = false): Promise<HpConfigSnapshot> {
  if (force) cache = null;
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetchFresh(hass).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Subscribe to config-changed notifications; returns an unsubscribe function. */
export function onConfigChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
