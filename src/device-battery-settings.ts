/** #792: the installation-wide battery indicator is enabled unless explicitly disabled. */
export function showDeviceBatteryOf(settings: { show_device_battery?: unknown } | null | undefined): boolean {
  return settings?.show_device_battery !== false;
}

/** Store only the opt-out; enabling restores the default without touching sibling settings. */
export function writeDeviceBatterySetting(settings: { show_device_battery?: unknown }, on: boolean): void {
  if (on) delete settings.show_device_battery;
  else settings.show_device_battery = false;
}
