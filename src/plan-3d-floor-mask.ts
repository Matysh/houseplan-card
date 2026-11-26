/** A narrow signed-distance band, in mask texels. Far from a shadow edge the
 * texture stores only inside/outside. At the boundary reconstruct a contour
 * from the antialiased coverage instead of enlarging a grid of square pixels.
 */
export const FLOOR_MASK_BAND = 2;

export function packFloorMask(
  pixels: Uint8ClampedArray, size: number, atlas: Uint8Array, stride: number,
  column: number, row: number, distances: Float32Array, band = FLOOR_MASK_BAND,
): void {
  const alpha = (index: number) => pixels[index * 4 + 3];
  const iso = 127.5;
  const limit = band * band;
  distances.fill(limit);
  const stamp = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay, inv = 1 / (dx * dx + dy * dy);
    const left = Math.max(0, Math.ceil(Math.min(ax, bx) - band));
    const right = Math.min(size - 1, Math.floor(Math.max(ax, bx) + band));
    const top = Math.max(0, Math.ceil(Math.min(ay, by) - band));
    const bottom = Math.min(size - 1, Math.floor(Math.max(ay, by) + band));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const px = x - ax, py = y - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) * inv));
      const ex = px - t * dx, ey = py - t * dy;
      const index = y * size + x;
      distances[index] = Math.min(distances[index], ex * ex + ey * ey);
    }
  };
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const i = y * size + x;
    const a = alpha(i), b = alpha(i + 1), c = alpha(i + 1 + size), d = alpha(i + size);
    const A = a > iso, B = b > iso, C = c > iso, D = d > iso;
    if (A === B && A === C && A === D) continue;
    const crossings: [number, number][] = [];
    if (A !== B) crossings.push([x + (iso - a) / (b - a), y]);
    if (B !== C) crossings.push([x + 1, y + (iso - b) / (c - b)]);
    if (C !== D) crossings.push([x + (iso - d) / (c - d), y + 1]);
    if (D !== A) crossings.push([x, y + (iso - a) / (d - a)]);
    if (crossings.length === 2) stamp(...crossings[0], ...crossings[1]);
    else {
      // Resolve a checkerboard by the coverage at the cell centre.
      const opposite = A === (a + b + c + d > 4 * iso) ? 1 : 3;
      stamp(...crossings[0], ...crossings[opposite]);
      stamp(...crossings[2], ...crossings[4 - opposite]);
    }
  }
  for (let y = 0; y < size; y++) {
    let out = ((row * size + y) * stride + column * size) * 2;
    for (let x = 0; x < size; x++) {
      const i = y * size + x, coverage = alpha(i);
      // A sub-texel sliver need not reach 50% coverage anywhere. Keep its
      // fractional light when there was no reconstructed edge nearby.
      atlas[out++] = distances[i] === limit && coverage > 0 && coverage <= iso
        ? Math.round((.25 + coverage / 255 / 2) * 255)
        : Math.round(iso + (coverage > iso ? 1 : -1) * Math.sqrt(distances[i]) * (iso / band));
      atlas[out++] = coverage;
    }
  }
}
