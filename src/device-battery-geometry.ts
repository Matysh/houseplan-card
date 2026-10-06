/** Designer control points in CSS pixels of the base round shell, not the core. */
export function deviceBatteryGeometry(shellDiameter: number): { frame: number; gap: number } {
  const d = Number.isFinite(shellDiameter) ? Math.max(0, shellDiameter) : 0;
  if (d <= 32) return { frame: d * 19 / 32, gap: d / 16 };
  if (d <= 56) return { frame: 19 + (d - 32) * 14 / 24, gap: 2 + (d - 32) / 12 };
  return { frame: 33 + (d - 56) * 23 / 40, gap: 4 + (d - 56) * 3 / 40 };
}

export interface DeviceBatteryFaceBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Union only; adding the passive indicator never moves the existing shell. */
export function withDeviceBatteryBounds(
  shell: DeviceBatteryFaceBounds,
  shellDiameter: number,
): DeviceBatteryFaceBounds {
  const { frame, gap } = deviceBatteryGeometry(shellDiameter);
  const center = (shell.top + shell.bottom) / 2;
  return {
    left: shell.left,
    right: shell.right + gap + frame,
    top: Math.min(shell.top, center - frame / 2),
    bottom: Math.max(shell.bottom, center + frame / 2),
  };
}
