import { svg } from 'lit';
import type { RoomFloorPaint } from '../room-floor-paint';

/** Geometry-only coverage; the room itself owns its one color/alpha/transition. */
export function renderRoomFloorMask(id: string, floor: RoomFloorPaint) {
  const [x, y, w, h] = floor.bounds;
  return svg`<defs><mask id=${id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
    x=${x} y=${y} width=${w} height=${h} style="mask-type:alpha">
    <path d=${floor.basePath} fill="white" fill-rule="evenodd"></path>
    <path class="room-floor-opening-coverage" d=${floor.path} fill="white" fill-rule="evenodd"
      style="opacity:calc(1 - var(--hp-mode-plan-weight, 0))"></path>
  </mask></defs>`;
}
