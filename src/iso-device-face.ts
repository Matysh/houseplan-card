/** Raised marker geometry derived from the measured Flat faces. */
import { contactRotate, type ContactRect, type ContactShape } from './device-contact-geometry';
import type { IsoDeviceFace } from './iso-overlays';

export function isoDeviceFaceBounds(faces: readonly IsoDeviceFace[], basis = 0): ContactRect {
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const face of faces) {
    const x = (face.left + face.right) / 2, y = (face.top + face.bottom) / 2;
    const [cx, cy] = contactRotate([x, y], -basis);
    const angle = (face.angle ?? 0) - basis, c = Math.cos(angle), s = Math.sin(angle);
    const w = (face.right - face.left) / 2 - face.rx;
    const h = (face.bottom - face.top) / 2 - face.ry;
    // Support of a rounded rectangle is the sum of its inner box and
    // corner ellipse. Using the bounding box would add a false wall gap.
    const dx = w * Math.abs(c) + h * Math.abs(s) + Math.hypot(face.rx * c, face.ry * s);
    const dy = w * Math.abs(s) + h * Math.abs(c) + Math.hypot(face.rx * s, face.ry * c);
    bounds.left = Math.min(bounds.left, cx - dx);
    bounds.right = Math.max(bounds.right, cx + dx);
    bounds.top = Math.min(bounds.top, cy - dy);
    bounds.bottom = Math.max(bounds.bottom, cy + dy);
  }
  return bounds;
}

export function orientIsoDeviceFace(shape: ContactShape, faces: readonly IsoDeviceFace[],
  turn: number, valueCore: boolean, joined: boolean) {
  const turned = faces.map((face, i) => i || valueCore ? { ...face, angle: turn } : face);
  const base = isoDeviceFaceBounds(faces, shape.angle), current = isoDeviceFaceBounds(turned, shape.angle);
  const { walls, angle, marker } = shape;
  // Contact sides belong to the authored shape. Resolve both normals at a
  // corner in that same basis, and translate all faces together.
  const dx = walls.left ? base.left - current.left : walls.right ? base.right - current.right : 0;
  const dy = walls.top ? base.top - current.top : walls.bottom ? base.bottom - current.bottom : 0;
  const shift = contactRotate([dx, dy], angle);
  const oriented = dx || dy ? turned.map(face => ({ ...face,
    left: face.left + shift[0], right: face.right + shift[0],
    top: face.top + shift[1], bottom: face.bottom + shift[1],
  })) : turned;

  if (valueCore && faces.length === 1 && !joined && !Object.keys(walls).length) {
    // The outline co-rotates with the pill around its own centre, even if
    // CSS's pill centre is off the nominal device anchor.
    const box = shape.box, cx = (faces[0].left + faces[0].right) * marker.diameter / 2;
    const cy = (faces[0].top + faces[0].bottom) * marker.diameter / 2;
    const [x, y] = contactRotate([cx, cy], -turn);
    return { faces: oriented, shift, shape: { ...shape, angle: turn,
      box: { left: box.left + x - cx, right: box.right + x - cx,
        top: box.top + y - cy, bottom: box.bottom + y - cy } } };
  }
  const d = marker.diameter, box = { ...shape.box };
  // Keep group overlaps and the fixed wall edge. Extend the free edges
  // only where the current presentation needs additional room.
  if (!walls.left) box.left = Math.min(box.left, box.left + (current.left + dx - base.left) * d);
  if (!walls.right) box.right = Math.max(box.right, box.right + (current.right + dx - base.right) * d);
  if (!walls.top) box.top = Math.min(box.top, box.top + (current.top + dy - base.top) * d);
  if (!walls.bottom) box.bottom = Math.max(box.bottom, box.bottom + (current.bottom + dy - base.bottom) * d);
  return { faces: oriented, shift, shape: { ...shape, box } };
}
