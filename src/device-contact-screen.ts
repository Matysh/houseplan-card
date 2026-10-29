/** A screen-facing contact view, independent of authored placement/layout. */
import { DeviceContactScene } from './device-contact-scene';
import type { ContactMarker } from './device-contact-geometry';
import { turnPoint, turnVector, type PlanRotation } from './view-frame';

export function screenContactMarker(marker: ContactMarker, rotation: PlanRotation): ContactMarker {
  const [x, y] = turnPoint([marker.x, marker.y], rotation);
  // Boxes describe the actual upright face. Only the core anchor turns.
  return { ...marker, x, y };
}

export function screenContactScene(source: DeviceContactScene, rotation: PlanRotation): DeviceContactScene {
  if (!rotation) return source;
  return new DeviceContactScene([...source.shapes.values()].map(shape => screenContactMarker(shape.marker, rotation)),
    source.walls.map(wall => ({ ...wall, a: turnPoint(wall.a, rotation), b: turnPoint(wall.b, rotation),
      normal: wall.normal ? turnVector(wall.normal, rotation) : null })),
    source.masonry.map(polygon => polygon.map(ring => ring.map(point => turnPoint([point[0], point[1]], rotation)))), true);
}
