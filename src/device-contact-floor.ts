/** Canonical opening-aware floor input for static rendering and maintenance. */
import { prepareSpacePhysicalGeometryInputs } from './plan-geometry-preflight';
import { wallBodiesGeometry } from './wall-thickness';
import { resolveZeroWalls } from './zero-walls';
import { deviceContactWalls, type ContactMasonry } from './device-contact-walls';
import { GRID_PITCH, NORM_W } from './space-geometry';
import { contentFingerprint } from './visual-continuity';
import type { ContactWall } from './device-contact-geometry';
import type { SpaceModel } from './types';

interface ContactFloor { walls: readonly ContactWall[]; masonry: ContactMasonry; safe: boolean }
const cache = new WeakMap<object, { key: string; value: ContactFloor }>();
export function deviceContactFloor(config: unknown, space: SpaceModel): ContactFloor {
  const key = contentFingerprint(config);
  const object = config && typeof config === 'object' ? config : null;
  const hit = object && cache.get(object); if (hit?.key === key) return hit.value;
  const inputs = prepareSpacePhysicalGeometryInputs(config, space);
  const geom = wallBodiesGeometry(space.rooms, inputs.walls, inputs.openCuts, inputs.roomOpenings,
    inputs.wallKeyPitch, inputs.cellCm, inputs.gridPitch, NORM_W, inputs.physicalBodies);
  const masonry = geom.geom || [];
  const value = { masonry, safe: geom.status !== 'failed-core',
    walls: deviceContactWalls(masonry, resolveZeroWalls(config, space, NORM_W, GRID_PITCH*.02).lines) };
  if (object) cache.set(object, {key,value});
  return value;
}
