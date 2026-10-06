/** #792: the installation-wide battery indicator is enabled unless explicitly disabled. */
export function showDeviceBatteryOf(settings: { show_device_battery?: unknown } | null | undefined): boolean {
  return settings?.show_device_battery !== false;
}

/** Store only the opt-out; enabling restores the default without touching sibling settings. */
export function writeDeviceBatterySetting(settings: { show_device_battery?: unknown }, on: boolean): void {
  if (on) delete settings.show_device_battery;
  else settings.show_device_battery = false;
}

export function showMarkerBatteryOf(marker: { hide_battery?: unknown } | null | undefined): boolean {
  return marker?.hide_battery !== true;
}

/** Default false is represented by absence, keeping old marker configs byte-small. */
export function markerBatteryFields(hidden: boolean): { hide_battery: true } | Record<string, never> {
  return hidden ? { hide_battery: true } : {};
}
