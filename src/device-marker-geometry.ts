/**
 * Public `icon_size` values predate the visual package and therefore remain
 * compatibility units. Issue #212 made their effective device core 10% more
 * compact. Issue #213 moves that conversion to the surface boundary: the face
 * receives the already-effective base and performs no late visual scaling.
 */
export const DEFAULT_DEVICE_BASE_SIZE = 2.25;
export const DEVICE_PREVIEW_BASE_PX = 48.6;

export function effectiveDeviceBaseSize(configuredSize: number): number {
  if (!Number.isFinite(configuredSize) || configuredSize <= 0) {
    return DEFAULT_DEVICE_BASE_SIZE;
  }
  return (configuredSize / 2.5) * DEFAULT_DEVICE_BASE_SIZE;
}
