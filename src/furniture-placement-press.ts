import { STAGE_TAP_DISTANCE_PX } from './room-fit';

export interface FurniturePlacementPress {
  pid: number; sx: number; sy: number; pointerType: string; cancelled: boolean;
  mouse?: { space: string; palette: object; claim: object; target: Element | null; captured: boolean };
}

/** Crossing the shared stage threshold permanently turns this press into pan. */
export function advanceFurniturePlacementPress(press: FurniturePlacementPress, x: number, y: number): void {
  if (Math.abs(x - press.sx) + Math.abs(y - press.sy) > STAGE_TAP_DISTANCE_PX) press.cancelled = true;
}
