/**
 * Чистые функции без зависимостей от Lit/DOM — легко покрываются юнит-тестами.
 */

/** Цвет LQI zigbee: ≤40 — красный, ≥180 — зелёный, между — hsl-градиент. */
export function lqiColor(lqi: number): string {
  const hue = Math.max(0, Math.min(120, ((lqi - 40) / 140) * 120));
  return `hsl(${Math.round(hue)}, 85%, 55%)`;
}

/** Привязать координату к ближайшему узлу сетки с шагом pitch. */
export function snapToGrid(v: number, pitch: number): number {
  return Math.round(v / pitch) * pitch;
}

/** Канонический ключ отрезка (независим от направления). */
export function segKey(a: number[], b: number[]): string {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${p[0].toFixed(1)},${p[1].toFixed(1)}-${q[0].toFixed(1)},${q[1].toFixed(1)}`;
}

/** Совпадение точек с допуском. */
export function samePoint(a: number[], b: number[], eps = 0.001): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

/** Точка внутри полигона (ray casting). */
export function pointInPolygon(p: number[], poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * id маркера по привязке: device → device_id, entity → 'lg_'+entity_id,
 * virtual → переданный existing (если это уже v_-маркер) либо новый через newId().
 */
export function markerIdForBinding(
  binding: string,
  existingId: string | undefined,
  newId: () => string,
): string {
  const [kind, ref] = binding.split(':');
  if (kind === 'device') return ref;
  if (kind === 'entity') return 'lg_' + ref;
  return existingId && existingId.startsWith('v_') ? existingId : newId();
}

/** Средний LQI по набору значений (или null). */
export function averageLqi(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Прямоугольник «contain» с заданным аспектом (w/h), вмещающий весь vb [x,y,w,h]. */
export function fitView(vb: number[], aspect: number): { x: number; y: number; w: number; h: number } {
  const planA = vb[2] / vb[3];
  if (aspect > planA) {
    const h = vb[3], w = vb[3] * aspect;
    return { x: vb[0] - (w - vb[2]) / 2, y: vb[1], w, h };
  }
  const w = vb[2], h = vb[2] / aspect;
  return { x: vb[0], y: vb[1] - (h - vb[3]) / 2, w, h };
}

/** Расталкивание точек: не ближе minDist друг к другу, в пределах прямоугольника b с отступом pad. Мутирует pts. */
export function declump(
  pts: { x: number; y: number }[],
  b: { x: number; y: number; w: number; h: number },
  minDist: number,
  pad: number,
): void {
  if (pts.length < 2) return;
  const minX = b.x + pad, maxX = b.x + b.w - pad, minY = b.y + pad, maxY = b.y + b.h - pad;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          pts[i].x -= ux * push; pts[i].y -= uy * push;
          pts[j].x += ux * push; pts[j].y += uy * push;
          moved = true;
        }
      }
    }
    for (const q of pts) {
      q.x = Math.max(minX, Math.min(maxX, q.x));
      q.y = Math.max(minY, Math.min(maxY, q.y));
    }
    if (!moved) break;
  }
}
