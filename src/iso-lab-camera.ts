/** The accepted #1451 product profile. This module is also imported by the
 * geometry worker, so it must never inspect DOM, URL or browser globals. */
import type { ResolvedOpeningVisual } from './opening-features';

export const ISO_VIEW_PROFILE = Object.freeze({ yaw: 35, elevationDeg: 40,
  floorScaleY: Math.sin(40 * Math.PI / 180), tiltDeg: 50, sectionHeightCm: 140 });

// Retain the imported prototype names while the host integration moves to its
// ordinary volumetric switch. Legacy arguments cannot select another profile
// or replace real entity-driven opening states.
export function isoLabOpeningAmount(_enabled?: boolean, _search?: string): null { return null; }
export function isoLabOpeningPreview(visual: ResolvedOpeningVisual, _amount?: number | null): ResolvedOpeningVisual {
  return visual;
}
export function isoLabYaw(_enabled?: boolean, _search?: string): number { return ISO_VIEW_PROFILE.yaw; }
export function isoLabCamera(_enabled?: boolean, _search?: string) { return ISO_LAB_CAMERA; }

export const ISO_LAB_CAMERA = Object.freeze({ yaw: ISO_VIEW_PROFILE.yaw,
  floorScaleY: ISO_VIEW_PROFILE.floorScaleY, tiltDeg: ISO_VIEW_PROFILE.tiltDeg });

/** Owner's #1451 choice: tilted tiles remain on their saved floor anchors. */
export const ISO_LAB_FLOOR_MARKERS = true;
export const ISO_LAB_OPENING_AMOUNT = null;
export const ISO_LAB_FURNITURE = true;
export const ISO_LAB_OPENINGS = true;
