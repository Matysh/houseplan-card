/** Browser-side geometry only: a visible, unobscured snapped native edit target.
 * Never changes camera/product state and never reaches private product fields. */
export function visiblePlanSegment(svg, { step, pixels = 90, clearInterior = false, pattern = [[[0, 0], [1, 0]]] }) {
  if (!(step > 0)) throw Error('The editor must expose a positive grid step');
  const matrix = svg.getScreenCTM(), box = svg.getBoundingClientRect();
  if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
      || matrix.a * matrix.d - matrix.b * matrix.c === 0) throw Error('The visible stage has no invertible floor transform');
  const inverse = matrix.inverse(), scale = Math.hypot(matrix.a, matrix.b);
  if (!(scale > 0)) throw Error('The visible stage has no positive scale');
  const clip = { left: Math.max(0, box.left) + 32, top: Math.max(0, box.top) + 32,
    right: Math.min(innerWidth, box.right) - 32, bottom: Math.min(innerHeight, box.bottom) - 32 };
  // First migration uses free canvas, not a cut across an existing room or a
  // magnet close to one of its walls. Conservative DOM boxes are sufficient:
  // failing to find free room is explicit, never permission to change the seed.
  const occupied = [...svg.querySelectorAll('[data-hp="room"],[data-hp="wall"],[data-hp="device"]')]
    .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  const client = p => { const q = new DOMPoint(p.x, p.y).matrixTransform(matrix); return { x: q.x, y: q.y }; };
  const available = p => {
    if (p.x < clip.left || p.x > clip.right || p.y < clip.top || p.y > clip.bottom) return false;
    if (occupied.some(rect => p.x >= rect.left - 12 && p.x <= rect.right + 12
      && p.y >= rect.top - 12 && p.y <= rect.bottom + 12)) return false;
    let hit = svg.ownerDocument.elementFromPoint(p.x, p.y);
    while (hit?.shadowRoot) {
      const next = hit.shadowRoot.elementFromPoint(p.x, p.y);
      if (!next || next === hit) break;
      hit = next;
    }
    return !!hit && (hit === svg || svg.contains(hit)) && !hit.closest(
      'button,input,select,[data-hp="device"],[data-hp="wall-node"],[data-hp="wall"],[data-hp="opening"]');
  };
  const cells = Math.max(1, Math.ceil(pixels / (step * scale)));
  for (const fy of [.35, .5, .65, .2, .8]) for (const fx of [.2, .35, .5, .65, .8]) {
    const point = new DOMPoint(clip.left + (clip.right - clip.left) * fx,
      clip.top + (clip.bottom - clip.top) * fy).matrixTransform(inverse);
    const a = { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
    for (const axis of ['x', 'y']) {
      const pointAt = ([x, y]) => ({ x: a.x + (axis === 'x' ? x : y) * cells * step,
        y: a.y + (axis === 'x' ? y : x) * cells * step });
      const segments = pattern.map(([start, end]) => {
        const a = pointAt(start), b = pointAt(end), from = client(a), to = client(b);
        return { a, b, from, to, samples: Array.from({ length: 13 }, (_, i) => ({
          x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 })) };
      });
      const samples = segments.flatMap(line => line.samples);
      // A closed-room witness must not surround an existing room or wall.
      // Conservative client AABBs reject the entire filled rectangle, not only
      // sampled boundary points. The default segment/X journeys are unchanged.
      if (clearInterior) {
        const area = { left: Math.min(...samples.map(p => p.x)), right: Math.max(...samples.map(p => p.x)),
          top: Math.min(...samples.map(p => p.y)), bottom: Math.max(...samples.map(p => p.y)) };
        if (occupied.some(rect => rect.left <= area.right + 12 && rect.right >= area.left - 12
          && rect.top <= area.bottom + 12 && rect.bottom >= area.top - 12)) continue;
      }
      if (samples.every(available)) return { ...segments[0], segments, clip, samples };
    }
  }
  throw Error('No unobscured snapped segment fits the actual visible canvas; native migration was not attempted');
}
