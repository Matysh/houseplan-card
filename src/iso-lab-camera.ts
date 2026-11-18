/** Local #1451 comparison only. Ordinary product hosts retain the dev camera. */
import type { ResolvedOpeningVisual } from './opening-features';

/** A URL-only preview; never write manual positions or HA states. */
export function isoLabOpeningAmount(enabled: boolean, search: string): number | null {
  if (!enabled) return null;
  const value = new URLSearchParams(search).get('sashes1451');
  return value === 'closed' ? 0 : value === 'half' ? .5 : value === 'open' ? 1 : null;
}
export function isoLabOpeningPreview(visual: ResolvedOpeningVisual, amount: number | null): ResolvedOpeningVisual {
  return amount === null || !visual.leaves ? visual : {
    ...visual, leaves: visual.leaves.map(leaf => ({...leaf, amount, unknown:false})),
  };
}
export function isoLabYaw(enabled: boolean, search: string): number {
  if (!enabled) return 0;
  const query = new URLSearchParams(search);
  if (query.get('view1451') === 'dev') return 0;
  const angle = Number(query.get('angle1451'));
  return angle === 25 || angle === 45 ? angle : 35;
}

export function isoLabCamera(enabled: boolean, search: string) {
  const query = new URLSearchParams(search);
  const depth = enabled && !['dev', 'angle'].includes(query.get('view1451') || '');
  const value = Number(query.get('elevation1451'));
  const elevation = value === 30 || value === 35 ? value : 40;
  return Object.freeze({ yaw: isoLabYaw(enabled, search),
    floorScaleY: depth ? Math.sin(elevation * Math.PI / 180) : 1,
    // Orthographic elevation: floor depth = sin(elevation), height = cos(elevation).
    tiltDeg: depth ? 90 - elevation : 20 });
}

export const ISO_LAB_CAMERA = isoLabCamera(
  typeof document !== 'undefined' && document.documentElement.dataset.uiLabCamera1451 === 'true',
  typeof location !== 'undefined' ? location.search : '',
);

/** Owner's #1451 choice: tilted tiles remain on their saved floor anchors. */
export const ISO_LAB_FLOOR_MARKERS = ISO_LAB_CAMERA.floorScaleY !== 1;
export const ISO_LAB_OPENING_AMOUNT = isoLabOpeningAmount(ISO_LAB_FLOOR_MARKERS,
  typeof location === 'undefined' ? '' : location.search);

/** Only the explicitly opted-in local tilted view gets experimental furniture. */
export const ISO_LAB_FURNITURE = ISO_LAB_FLOOR_MARKERS
  && (typeof location === 'undefined' || new URLSearchParams(location.search).get('furniture1451') !== 'flat');

/** Reversible local opening study; ordinary hosts and the base comparison stay unchanged. */
export const ISO_LAB_OPENINGS = ISO_LAB_FLOOR_MARKERS
  && (typeof location === 'undefined' || new URLSearchParams(location.search).get('openings1451') !== 'base');
