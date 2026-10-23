/** Proven continuous contact exceptions for Optimize; no persisted group data. */
import { spaceModels, iconUnit, NORM_W } from './space-geometry';
import { spaceDisplayOf } from './logic';
import { deviceContactFloor } from './device-contact-floor';
import { DeviceContactScene } from './device-contact-scene';
import { contactIntersectsMasonry } from './device-contact-collision';
import { contactBasisMarker } from './device-contact-basis';
import type { ContactRect } from './device-contact-geometry';
import type { ServerConfig } from './types';

export interface DeviceContactFaceEvidence {
  id: string; space: string; diameterRatio: number; box: ContactRect;
}
export function contactPositionExceptions(
  spaces: ServerConfig['spaces'], layout: Record<string, { x?: number; y?: number; s?: string; contact_basis?:unknown }>,
  faces: readonly DeviceContactFaceEvidence[] = [],
): ReadonlySet<string> {
  const preserved = new Set<string>();
  if (!faces.length) return preserved;
  const models = spaceModels({ spaces } as ServerConfig);
  for (const space of models) {
    const config = spaces.find((s) => s.id === space.id);
    const markers = faces.filter((f) => f.space === space.id).flatMap((f) => {
      const p = layout[f.id], d = f.diameterRatio * iconUnit(space);
      if (!p || (p.s && p.s !== space.id) || !Number.isFinite(p.x) || !Number.isFinite(p.y)
        || Math.abs(p.x!) > 5000 || Math.abs(p.y!) > 5000 || !(d > 0) || !Number.isFinite(d)) return [];
      const measured={ id: f.id, x: p.x! * NORM_W, y: p.y! * NORM_W, diameter: d,
        box: { left: f.box.left*d, right: f.box.right*d, top: f.box.top*d, bottom: f.box.bottom*d } };
      return [contactBasisMarker(measured,{...p,x:p.x!,y:p.y!},space.id)??measured];
    });
    if (!markers.length) continue;
    const visible = spaceDisplayOf(config).showBorders;
    const geometry = visible ? deviceContactFloor(config, space) : null;
    if (geometry && !geometry.safe) continue;
    const masonry = geometry?.masonry || [], walls = geometry?.walls || [];
    const scene = new DeviceContactScene(markers, walls, masonry,true);
    // A pre-existing illegal overlap must not acquire an optimization exemption.
    for (const id of scene.contactedIds()) if (!contactIntersectsMasonry(scene.shapes.get(id)!, masonry)) preserved.add(id);
  }
  return preserved;
}
