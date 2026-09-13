/** Screen-space ownership for overlapping device marker hit targets (#564). */

export interface DeviceHitPoint {
  x: number;
  y: number;
}

export interface DeviceHitRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DeviceHitCandidate {
  id: string;
  center: DeviceHitPoint;
  /** The visible shell/capsule, modelled as a stadium (rounded rectangle). */
  painted: DeviceHitRect;
  /** Radius of the invisible core-centred minimum target. */
  floorRadius: number;
}

const EPSILON = 1e-7;

const distanceSquared = (a: DeviceHitPoint, b: DeviceHitPoint): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** True for the real capsule shape, not for the invisible corners of its bbox. */
export function pointInDeviceCapsule(point: DeviceHitPoint, rect: DeviceHitRect): boolean {
  const width = Math.max(0, rect.right - rect.left);
  const height = Math.max(0, rect.bottom - rect.top);
  if (width <= 0 || height <= 0) return false;
  const radius = Math.min(width, height) / 2;
  const x = Math.max(rect.left + radius, Math.min(rect.right - radius, point.x));
  const y = Math.max(rect.top + radius, Math.min(rect.bottom - radius, point.y));
  return distanceSquared(point, { x, y }) <= radius * radius + EPSILON;
}

function candidateBounds(candidate: DeviceHitCandidate): DeviceHitRect {
  const radius = Math.max(0, candidate.floorRadius);
  return {
    left: Math.min(candidate.painted.left, candidate.center.x - radius),
    top: Math.min(candidate.painted.top, candidate.center.y - radius),
    right: Math.max(candidate.painted.right, candidate.center.x + radius),
    bottom: Math.max(candidate.painted.bottom, candidate.center.y + radius),
  };
}

function nearest(
  candidates: readonly DeviceHitCandidate[],
  point: DeviceHitPoint,
): DeviceHitCandidate | null {
  let best: DeviceHitCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = distanceSquared(point, candidate.center);
    if (distance < bestDistance - EPSILON
        || (Math.abs(distance - bestDistance) <= EPSILON
          && (best === null || candidate.id < best.id))) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Resolve painted areas first, then the invisible minimum floors. */
export function resolveDeviceHitOwner(
  candidates: readonly DeviceHitCandidate[],
  point: DeviceHitPoint,
): DeviceHitCandidate | null {
  const painted = candidates.filter((candidate) => pointInDeviceCapsule(point, candidate.painted));
  if (painted.length) return nearest(painted, point);
  const floor = candidates.filter((candidate) => {
    const radius = Math.max(0, candidate.floorRadius);
    return distanceSquared(point, candidate.center) <= radius * radius + EPSILON;
  });
  return nearest(floor, point);
}

/**
 * A small uniform index keeps hover resolution local. DOM geometry is measured
 * once by the card and only candidates whose total hit bounds touch the current
 * cell are examined for each pointer event.
 */
export class DeviceHitIndex {
  private readonly buckets = new Map<string, DeviceHitCandidate[]>();

  public constructor(
    candidates: readonly DeviceHitCandidate[],
    private readonly cellSize = 44,
  ) {
    const size = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 44;
    this.cellSize = size;
    for (const candidate of candidates) {
      const bounds = candidateBounds(candidate);
      const minX = Math.floor(bounds.left / size);
      const maxX = Math.floor(bounds.right / size);
      const minY = Math.floor(bounds.top / size);
      const maxY = Math.floor(bounds.bottom / size);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x}:${y}`;
          const bucket = this.buckets.get(key);
          if (bucket) bucket.push(candidate);
          else this.buckets.set(key, [candidate]);
        }
      }
    }
  }

  public resolve(point: DeviceHitPoint): DeviceHitCandidate | null {
    const key = `${Math.floor(point.x / this.cellSize)}:${Math.floor(point.y / this.cellSize)}`;
    return resolveDeviceHitOwner(this.buckets.get(key) || [], point);
  }
}

/** Keep one semantic marker owner for the complete pointer sequence. */
export class DevicePointerOwnerLatch {
  private readonly active = new Map<number, string>();
  private readonly released = new Map<number, string>();

  public begin(pointerId: number, ownerId: string): void {
    this.released.delete(pointerId);
    this.active.set(pointerId, ownerId);
  }

  public owner(pointerId: number): string | null {
    return this.active.get(pointerId) || null;
  }

  public release(pointerId: number): string | null {
    const owner = this.active.get(pointerId) || null;
    if (!owner) return this.released.get(pointerId) || null;
    this.active.delete(pointerId);
    this.released.set(pointerId, owner);
    // Browsers normally reuse a small pointer-id set. Bound stale entries from
    // gestures that intentionally produce no click (pan/pinch/cancel races).
    while (this.released.size > 16) {
      const oldest = this.released.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.released.delete(oldest);
    }
    return owner;
  }

  public consumeClick(pointerId: number): string | null {
    const owner = this.released.get(pointerId) || null;
    this.released.delete(pointerId);
    return owner;
  }

  public cancel(pointerId: number): string | null {
    const owner = this.active.get(pointerId) || null;
    this.active.delete(pointerId);
    return owner;
  }

  public clear(): void {
    this.active.clear();
    this.released.clear();
  }
}

interface RenderedDeviceHitItem {
  id: string;
  space?: string | null;
}

/** DOM adapter and lifecycle state around the pure screen-space resolver. */
export class DeviceHitController {
  private index: DeviceHitIndex | null = null;
  private readonly pointers = new DevicePointerOwnerLatch();
  private hoverId: string | null = null;
  private hoverElement: HTMLElement | null = null;

  public invalidate(): void {
    this.index = null;
  }

  public reset(root: ParentNode): void {
    this.invalidate();
    this.pointers.clear();
    this.hover(root, null);
  }

  public clearPointers(): void {
    this.pointers.clear();
  }

  public cancel(pointerId: number): string | null {
    return this.pointers.cancel(pointerId);
  }

  public release(pointerId: number): string | null {
    return this.pointers.release(pointerId);
  }

  private indexFor(root: ParentNode): DeviceHitIndex {
    if (this.index) return this.index;
    const candidates: DeviceHitCandidate[] = [];
    for (const marker of root.querySelectorAll<HTMLElement>(
      '.devlayer > .dev[data-hp="device"][data-id]',
    )) {
      const frame = marker.querySelector<HTMLElement>('.device-shell-frame');
      const core = marker.getBoundingClientRect();
      const painted = frame?.getBoundingClientRect();
      if (!marker.dataset.id || !marker.isConnected || !painted
          || core.width <= 0 || core.height <= 0
          || painted.width <= 0 || painted.height <= 0) continue;
      candidates.push({
        id: marker.dataset.id,
        center: { x: core.left + core.width / 2, y: core.top + core.height / 2 },
        painted: {
          left: painted.left, top: painted.top, right: painted.right, bottom: painted.bottom,
        },
        // The painted shell's short side is the CSS shell size. The floor is
        // exactly max(44 px, shell size), so no pseudo-style read is needed.
        floorRadius: Math.max(22, Math.min(painted.width, painted.height) / 2),
      });
    }
    this.index = new DeviceHitIndex(candidates);
    return this.index;
  }

  public at<T extends RenderedDeviceHitItem>(
    root: ParentNode,
    devices: readonly T[],
    space: string | null,
    clientX: number,
    clientY: number,
  ): T | null {
    const id = this.indexFor(root).resolve({ x: clientX, y: clientY })?.id;
    return id ? devices.find((item) => item.id === id && item.space === space) || null : null;
  }

  private byId<T extends RenderedDeviceHitItem>(
    devices: readonly T[], space: string | null, id: string | null,
  ): T | null {
    return id ? devices.find((item) => item.id === id && item.space === space) || null : null;
  }

  public begin<T extends RenderedDeviceHitItem>(
    root: ParentNode, devices: readonly T[], space: string | null, ev: PointerEvent, fallback: T,
  ): T {
    const owner = this.at(root, devices, space, ev.clientX, ev.clientY) || fallback;
    this.pointers.begin(ev.pointerId, owner.id);
    return owner;
  }

  public pointer<T extends RenderedDeviceHitItem>(
    root: ParentNode, devices: readonly T[], space: string | null,
    ev: MouseEvent | PointerEvent, fallback: T,
  ): T {
    const pointerId = (ev as PointerEvent).pointerId;
    const latched = Number.isFinite(pointerId)
      ? this.byId(devices, space, this.pointers.owner(pointerId)) : null;
    return latched || this.at(root, devices, space, ev.clientX, ev.clientY) || fallback;
  }

  public click<T extends RenderedDeviceHitItem>(
    root: ParentNode, devices: readonly T[], space: string | null, ev: Event, fallback: T,
  ): T {
    // Keyboard/programmatic activation is already bound to an exact marker.
    // Only a real pointer click carries coordinates that need arbitration.
    if (!(ev instanceof PointerEvent)) return fallback;
    const point = ev;
    const id = Number.isFinite(point.pointerId) ? this.pointers.consumeClick(point.pointerId) : null;
    return this.byId(devices, space, id)
      || this.at(root, devices, space, point.clientX, point.clientY)
      || fallback;
  }

  public hover(root: ParentNode, id: string | null): void {
    if (this.hoverId === id && this.hoverElement?.isConnected) return;
    this.hoverElement?.removeAttribute('data-hp-device-hover');
    this.hoverId = id;
    this.hoverElement = id
      ? [...root.querySelectorAll<HTMLElement>('.devlayer > .dev[data-hp="device"][data-id]')]
        .find((item) => item.dataset.id === id) || null
      : null;
    this.hoverElement?.setAttribute('data-hp-device-hover', '');
  }
}
