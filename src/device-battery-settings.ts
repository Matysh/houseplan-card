/** #792/#807: the installation-wide battery indicator — every device (default), only low charge, or none. */
export type DeviceBatteryMode = 'all' | 'low' | 'off';
export type SpaceDeviceBatteryMode = 'inherit' | DeviceBatteryMode;
export interface SpaceBatterySettings { show_device_battery_mode?: unknown; }

export function spaceDeviceBatteryModeOf(settings: SpaceBatterySettings | null | undefined): SpaceDeviceBatteryMode {
  const mode = settings?.show_device_battery_mode;
  return mode === 'all' || mode === 'low' || mode === 'off' ? mode : 'inherit';
}

export function writeSpaceDeviceBatterySetting(settings: SpaceBatterySettings, mode: SpaceDeviceBatteryMode): void {
  if (mode === 'inherit') delete settings.show_device_battery_mode;
  else settings.show_device_battery_mode = mode;
}

/** Absent/other — all; exact false — off; exact "low" — only the red low state. */
export function deviceBatteryModeOf(settings: { show_device_battery?: unknown } | null | undefined, space?: SpaceBatterySettings | null): DeviceBatteryMode {
  const own = spaceDeviceBatteryModeOf(space);
  if (own !== 'inherit') return own;
  const value = settings?.show_device_battery;
  return value === false ? 'off' : value === 'low' ? 'low' : 'all';
}

/** #792: the indicator is enabled unless explicitly disabled (also true for the low-only mode). */
export function showDeviceBatteryOf(settings: { show_device_battery?: unknown } | null | undefined, space?: SpaceBatterySettings | null): boolean {
  return deviceBatteryModeOf(settings, space) !== 'off';
}

/** Store only what differs from the default; sibling settings stay untouched. */
export function writeDeviceBatterySetting(settings: { show_device_battery?: unknown }, mode: DeviceBatteryMode): void {
  if (mode === 'all') delete settings.show_device_battery;
  else settings.show_device_battery = mode === 'low' ? 'low' : false;
}

export function showMarkerBatteryOf(marker: { hide_battery?: unknown } | null | undefined): boolean {
  return marker?.hide_battery !== true;
}

/** Default false is represented by absence, keeping old marker configs byte-small. */
export function markerBatteryFields(hidden: boolean): { hide_battery: true } | Record<string, never> {
  return hidden ? { hide_battery: true } : {};
}
