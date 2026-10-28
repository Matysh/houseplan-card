/** Local display intent; never rewrites a saved marker or HA lifecycle. */
import { presentationRouteOwner } from './route-kiosk';
import { stableSummaryPlacementSlot } from './summary-panel-identity';

export interface HiddenDevice {
  hidden?: boolean;
  userHidden?: boolean;
  virtual?: boolean;
  marker?: { hidden?: boolean; removed?: boolean; binding?: string } | null;
  bindingStatus?: { kind: string } | null;
}

/** Positive authority only: a missing registry result is not an active binding. */
export function canRevealUserHidden(device: HiddenDevice): boolean {
  if (device.marker?.removed || !(device.userHidden || device.marker?.hidden)) return false;
  return device.bindingStatus?.kind === 'active'
    || (!device.bindingStatus && (device.virtual === true || device.marker?.binding === 'virtual'));
}

/** One bounded roster per card; ordinary Off retains the original objects. */
export class HiddenDeviceRoster<D extends HiddenDevice> {
  private source: readonly D[] | null = null;
  private epoch: unknown;
  private shown = false;
  private projected: readonly D[] = [];

  read(devices: readonly D[], shown: boolean, epoch?: unknown): readonly D[] {
    if (devices === this.source && shown === this.shown && epoch === this.epoch) return this.projected;
    this.source = devices; this.shown = shown; this.epoch = epoch;
    if (!shown) return this.projected = devices;
    const projected = devices.map(device => canRevealUserHidden(device) && device.hidden !== false
      ? { ...device, hidden: false } : device);
    return this.projected = projected.some((device, index) => device !== devices[index]) ? projected : devices;
  }
}

export interface HiddenPreferenceHost {
  readonly hass?: { user?: { id?: string } };
  readonly panelHost: boolean;
  readonly ownerDocument: Document;
}

/** Reuse the proven Masonry/stack placement identity, not a config hash or visual column. */
export function hiddenDevicePreferenceKey(host: HiddenPreferenceHost): string | null {
  const user = host.hass?.user?.id;
  const path = host.ownerDocument.defaultView?.location.pathname;
  const slot = stableSummaryPlacementSlot(host);
  return user && path && slot
    ? `hp_hidden_devices_v1:${JSON.stringify([user, presentationRouteOwner(path, host.panelHost), host.panelHost ? 'panel' : 'lovelace', slot])}` : null;
}

export type HiddenDeviceStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

/** Access itself may throw in a restricted WebView. */
export function hiddenDeviceStorage(): HiddenDeviceStorage {
  try { return window.localStorage; } catch { return null; }
}

export class HiddenDevicePreference {
  private key: string | null | undefined;
  get address(): string | null | undefined { return this.key; }
  enabled = false;

  /** Re-read only when the HA user/card/route identity changes. No cross-tab broadcast. */
  sync(key: string | null, storage: HiddenDeviceStorage): boolean {
    if (key === this.key) return this.enabled;
    this.key = key;
    this.enabled = false;
    try { this.enabled = !!key && storage?.getItem(key) === 'true'; } catch { /* default Off */ }
    return this.enabled;
  }

  set(enabled: boolean, storage: HiddenDeviceStorage): void {
    this.enabled = enabled;
    try { if (this.key) storage?.setItem(this.key, String(enabled)); } catch { /* keep this session */ }
  }
}
