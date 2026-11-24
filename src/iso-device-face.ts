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
  const offset = { left: dx, right: dx, top: dy, bottom: dy };
  // Follow both expansion and contraction of a standalone face. A joined
  // member also provides the overlap that keeps the common shell connected.
  for (const side of ['left','right','top','bottom'] as const) {
    if (walls[side]) continue;
    const delta = (current[side] + offset[side] - base[side]) * d;
    if (!joined) box[side] += delta;
    else if (side === 'left' || side === 'top') box[side] += Math.min(0,delta);
    else box[side] += Math.max(0,delta);
  }
  const radius = Math.min(shape.radius,(box.right-box.left)/2,(box.bottom-box.top)/2);
  return { faces: oriented, shift, shape: { ...shape, box, radius } };
}
