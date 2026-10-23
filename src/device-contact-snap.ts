/** One gesture's wall/device resolver; the existing #873 remains the fallback. */
import {
  CONTACT_EPS, contactAtCorner, contactAtWall, contactBoxIn, contactCoresOverlap, contactRotate, contactShapeJoinDepth,
  contactWallsNear, deriveContactShape, freeContactShape, joinedContactSide, rotatedContactCapsule, validContactMarker,
  type ContactMarker, type ContactShape,
} from './device-contact-geometry';
import { contactBounds, DeviceContactScene } from './device-contact-scene';
import { contactIntersectsMasonry } from './device-contact-collision';

export interface DeviceContactProposal {
  x: number; y: number; kind: 'wall' | 'device'; key: string;
  line: [number, number, number, number];
}
export class DeviceContactMagnet {
  public hint: DeviceContactProposal | null = null;
  private held: string | null = null;
  public constructor(private readonly scene: DeviceContactScene, private readonly marker: ContactMarker,
    private readonly canonical: (x: number, y: number) => { x: number; y: number }) {}
  public resolve(x: number, y: number, px: number, py: number, enabled = true): DeviceContactProposal | null {
    this.hint = null;
    if (!enabled || ![x, y, px, py].every(Number.isFinite) || px <= 0 || py <= 0) { this.held = null; return null; }
    // HA can change the dragged face while the pointer is still captured.
    const metric=this.scene.shapes.get(this.marker.id)?.marker??this.marker;
    const raw = { ...metric, x, y }, candidates: (DeviceContactProposal & { distance: number })[] = [];
    const add = (p: DeviceContactProposal): void => {
      const distance = Math.hypot((p.x - x) * px, (p.y - y) * py);
      const limit = p.kind === 'wall' ? (p.key === this.held ? 9 : 6) : (p.key === this.held ? 22 : 14);
      if (distance > limit + CONTACT_EPS) return;
      const stored = this.canonical(p.x, p.y);
      const moved = { ...raw, ...stored }, shape = deriveContactShape(moved, this.scene.walls);
      if (!validContactMarker(moved)) return;
      const neighbors = this.scene.query(contactBounds(shape), CONTACT_EPS).filter((n) => n.marker.id !== raw.id);
      if (!this.valid(shape, neighbors)) return;
      candidates.push({ ...p, ...stored, distance });
    };
    const walls = contactWallsNear(raw, this.scene.walls, 12 / Math.min(px,py));
    for(const p of contactAtCorner(raw,walls)) {
      const stored=this.canonical(p.x,p.y);
      const shape=deriveContactShape({...raw,...stored},this.scene.walls);
      if(!Object.values(p.shape.walls).every(id=>Object.values(shape.walls).includes(id))) continue;
      add({...stored,kind:'wall',key:p.key,line:p.line});
    }
    for (const wall of walls) for (const p of contactAtWall(raw, wall)) {
      add({ x: p.x, y: p.y, kind: 'wall', key: p.key, line: p.line });
    }
    const near = this.scene.query(contactBounds(freeContactShape(raw)), 22 / Math.min(px, py));
    for (const n of near) {
      if (n.marker.id === raw.id) continue;
      const angle = n.angle;
      const template = { ...freeContactShape(raw), angle,
        box: rotatedContactCapsule(raw.box, angle, Object.keys(n.walls).length ? raw.diameter*.009375 : 0) };
      const a = contactBoxIn(n), b = template.box;
      const depth = (side: 'right' | 'left' | 'top' | 'bottom') => contactShapeJoinDepth(n,template,side);
      const ys = [a.top - b.top, (a.top + a.bottom - b.top - b.bottom) / 2, a.bottom - b.bottom];
      const xs = [a.left - b.left, (a.left + a.right - b.left - b.right) / 2, a.right - b.right];
      const offer = (u: number, v: number, side: string, i: number, line: [number, number, number, number]) => {
        const world = contactRotate([u, v], angle), p1 = contactRotate([line[0], line[1]], angle), p2 = contactRotate([line[2], line[3]], angle);
        const final = deriveContactShape({ ...raw, x: world[0], y: world[1] }, this.scene.walls);
        if (!joinedContactSide(final, n)) return;
        add({ x: world[0], y: world[1], kind: 'device', key: `device:${n.marker.id}:${side}:${i}`,
          line: [...p1, ...p2] as [number, number, number, number] });
      };
      ys.forEach((v, i) => {
        const right = depth('right'), left = depth('left');
        offer(a.right - right - b.left, v, 'right', i, [a.right - right / 2, v + b.top, a.right - right / 2, v + b.bottom]);
        offer(a.left + left - b.right, v, 'left', i, [a.left + left / 2, v + b.top, a.left + left / 2, v + b.bottom]);
      });
      xs.forEach((u, i) => {
        const bottom = depth('bottom'), top = depth('top');
        offer(u, a.bottom - bottom - b.top, 'bottom', i, [u + b.left, a.bottom - bottom / 2, u + b.right, a.bottom - bottom / 2]);
        offer(u, a.top + top - b.bottom, 'top', i, [u + b.left, a.top + top / 2, u + b.right, a.top + top / 2]);
      });
    }
    candidates.sort((a, b) => {
      if(a.key.startsWith('corner:')!==b.key.startsWith('corner:')) return a.key.startsWith('corner:')?-1:1;
      if (a.key === this.held && b.key !== this.held) return -1;
      if (b.key === this.held && a.key !== this.held) return 1;
      if (Math.abs(a.distance - b.distance) > CONTACT_EPS) return a.distance - b.distance;
      return a.kind.localeCompare(b.kind) * -1 || a.key.localeCompare(b.key);
    });
    this.hint = candidates[0] || null; this.held = this.hint?.key || null;
    return this.hint;
  }
  private valid(s: ContactShape, neighbors: ContactShape[]): boolean {
    if (contactIntersectsMasonry(s, this.scene.masonry)) return false;
    const b = Math.abs(s.angle) <= CONTACT_EPS ? contactBounds(s) : contactBoxIn(s);
    for (const n of neighbors) {
      if (contactCoresOverlap(s.marker, n.marker)) return false;
      const a = Math.abs(s.angle-n.angle) <= CONTACT_EPS ? contactBoxIn(n,s.angle) : contactBounds(n);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX <= CONTACT_EPS || overlapY <= CONTACT_EPS || joinedContactSide(s, n)) continue;
      // A diagonal padding-only overlap is legal in an L/grid iff side-connected.
      const depth = Math.max(...(['top','right','bottom','left'] as const).map(side=>contactShapeJoinDepth(s,n,side)));
      if (overlapX > depth + CONTACT_EPS || overlapY > depth + CONTACT_EPS) return false;
      const links = neighbors.filter((v) => joinedContactSide(s, v));
      if (!links.some((v) => this.scene.component(v.marker.id).includes(n.marker.id))) return false;
    }
    return true;
  }
}
