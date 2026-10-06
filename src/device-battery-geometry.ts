/** Designer control points in CSS pixels of the base round shell, not the core. */
export function deviceBatteryGeometry(shellDiameter: number): { frame: number; gap: number } {
  const d = Number.isFinite(shellDiameter) ? Math.max(0, shellDiameter) : 0;
  if (d <= 32) return { frame: d * 19 / 32, gap: d / 16 };
  if (d <= 56) return { frame: 19 + (d - 32) * 14 / 24, gap: 2 + (d - 32) / 12 };
  return { frame: 33 + (d - 56) * 23 / 40, gap: 4 + (d - 56) * 3 / 40 };
}

/** Approved #806 shadow control points, scaled continuously with the MDI frame. */
export function deviceBatteryShadow(frame: number): { x: number; y: number; blur: number } {
  const size = Number.isFinite(frame) ? Math.max(0, frame) : 0;
  if (size === 0) return { x: 0, y: 0, blur: 0 };
  return {
    x: size * 0.024324324324 + 0.237837837844,
    y: size * 0.048648648649 + 0.875675675669,
    blur: size * 0.051351351351 + 0.324324324331,
  };
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
  const shadow = deviceBatteryShadow(frame);
  // CSS drop-shadow blur is a standard deviation. Reserve three sigmas in the
  // preview fit so the approved soft edge is never cut by its overflow guard.
  const spread = shadow.blur * 3;
  const center = (shell.top + shell.bottom) / 2;
  const batteryLeft = shell.right + gap;
  return {
    left: Math.min(shell.left, batteryLeft + shadow.x - spread),
    right: Math.max(shell.right, batteryLeft + frame + shadow.x + spread),
    top: Math.min(shell.top, center - frame / 2 + shadow.y - spread),
    bottom: Math.max(shell.bottom, center + frame / 2 + shadow.y + spread),
  };
}
