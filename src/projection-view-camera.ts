import {projectPlanPoint, unprojectFloorPoint, type IsoCamera, type ViewRect} from './iso-projection';

export type ViewPlane = Readonly<IsoCamera> | null;

/** The stored viewport is in the zero-quarter presentation plane, not plan XY. */
export function logicalViewCenter(view: ViewRect | null, plane: ViewPlane) {
  if (!view) return null;
  const point: [number, number] = [view.x + view.w / 2, view.y + view.h / 2];
  const [x, y] = plane ? unprojectFloorPoint(point, plane) : point;
  return {x, y};
}

/** Keep screen scale and the physical floor point while changing presentation. */
export function reprojectViewPlane(view: ViewRect, from: ViewPlane, to: ViewPlane): ViewRect {
  const point = logicalViewCenter(view, from)!;
  const [x, y] = to ? projectPlanPoint([point.x, point.y], 0, to) : [point.x, point.y];
  return {...view, x: x - view.w / 2, y: y - view.h / 2};
}
