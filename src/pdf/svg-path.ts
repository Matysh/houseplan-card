export type PdfVectorOp =
  | { op: 'M' | 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Z' };

export interface PdfAffine {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

const COMMAND = /^[A-Za-z]$/;
const ARITY: Readonly<Record<string, number>> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const denominator = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
  const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / denominator));
  return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(cosine);
}

/** Convert one SVG endpoint arc into cubic segments. */
function arcCubics(
  x0: number, y0: number, rx0: number, ry0: number, rotation: number,
  large: number, sweep: number, x1: number, y1: number,
): Extract<PdfVectorOp, { op: 'C' }>[] {
  let rx = Math.abs(rx0), ry = Math.abs(ry0);
  if (!rx || !ry || (x0 === x1 && y0 === y1)) return [];
  const phi = rotation * Math.PI / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  const xp = cosPhi * dx + sinPhi * dy;
  const yp = -sinPhi * dx + cosPhi * dy;
  const size = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (size > 1) {
    const factor = Math.sqrt(size);
    rx *= factor; ry *= factor;
  }
  const numerator = Math.max(0,
    rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp);
  const denominator = rx * rx * yp * yp + ry * ry * xp * xp || 1;
  const sign = large === sweep ? -1 : 1;
  const coefficient = sign * Math.sqrt(numerator / denominator);
  const cxp = coefficient * rx * yp / ry;
  const cyp = coefficient * -ry * xp / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;
  let start = vectorAngle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let delta = vectorAngle((xp - cxp) / rx, (yp - cyp) / ry,
    (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / count;
  const point = (theta: number): [number, number] => [
    cx + cosPhi * rx * Math.cos(theta) - sinPhi * ry * Math.sin(theta),
    cy + sinPhi * rx * Math.cos(theta) + cosPhi * ry * Math.sin(theta),
  ];
  const derivative = (theta: number): [number, number] => [
    -cosPhi * rx * Math.sin(theta) - sinPhi * ry * Math.cos(theta),
    -sinPhi * rx * Math.sin(theta) + cosPhi * ry * Math.cos(theta),
  ];
  const out: Extract<PdfVectorOp, { op: 'C' }>[] = [];
  for (let index = 0; index < count; index++) {
    const end = start + step;
    const alpha = 4 / 3 * Math.tan(step / 4);
    const p0 = point(start), p1 = point(end);
    const d0 = derivative(start), d1 = derivative(end);
    out.push({ op: 'C', x1: p0[0] + alpha * d0[0], y1: p0[1] + alpha * d0[1],
      x2: p1[0] - alpha * d1[0], y2: p1[1] - alpha * d1[1], x: p1[0], y: p1[1] });
    start = end;
  }
  return out;
}

/** Parse the complete SVG path subset used by the generated furniture art. */
export function parseSvgPath(d: string): PdfVectorOp[] {
  const tokens = d.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [];
  const out: PdfVectorOp[] = [];
  let index = 0, command = '', x = 0, y = 0, startX = 0, startY = 0;
  let cubic: [number, number] | null = null, quadratic: [number, number] | null = null;
  const n = (): number => Number(tokens[index++]);
  while (index < tokens.length) {
    if (COMMAND.test(tokens[index])) command = tokens[index++];
    if (!command) throw new Error('SVG path begins without a command');
    const upper = command.toUpperCase();
    const relative = command !== upper;
    if (upper === 'Z') {
      out.push({ op: 'Z' }); x = startX; y = startY; cubic = quadratic = null; command = '';
      continue;
    }
    const arity = ARITY[upper];
    if (!arity || index + arity > tokens.length || COMMAND.test(tokens[index])) {
      throw new Error(`Invalid SVG path command ${command}`);
    }
    const values = Array.from({ length: arity }, n);
    const px = (value: number) => value + (relative ? x : 0);
    const py = (value: number) => value + (relative ? y : 0);
    if (upper === 'M' || upper === 'L') {
      x = px(values[0]); y = py(values[1]);
      out.push({ op: upper === 'M' ? 'M' : 'L', x, y });
      if (upper === 'M') { startX = x; startY = y; command = relative ? 'l' : 'L'; }
      cubic = quadratic = null;
    } else if (upper === 'H') {
      x = px(values[0]); out.push({ op: 'L', x, y }); cubic = quadratic = null;
    } else if (upper === 'V') {
      y = py(values[0]); out.push({ op: 'L', x, y }); cubic = quadratic = null;
    } else if (upper === 'C') {
      const x1 = px(values[0]), y1 = py(values[1]);
      const x2 = px(values[2]), y2 = py(values[3]);
      x = px(values[4]); y = py(values[5]); cubic = [x2, y2]; quadratic = null;
      out.push({ op: 'C', x1, y1, x2, y2, x, y });
    } else if (upper === 'S') {
      const x1 = cubic ? 2 * x - cubic[0] : x, y1 = cubic ? 2 * y - cubic[1] : y;
      const x2 = px(values[0]), y2 = py(values[1]);
      x = px(values[2]); y = py(values[3]); cubic = [x2, y2]; quadratic = null;
      out.push({ op: 'C', x1, y1, x2, y2, x, y });
    } else if (upper === 'Q' || upper === 'T') {
      const qx = upper === 'Q' ? px(values[0]) : quadratic ? 2 * x - quadratic[0] : x;
      const qy = upper === 'Q' ? py(values[1]) : quadratic ? 2 * y - quadratic[1] : y;
      const ex = upper === 'Q' ? px(values[2]) : px(values[0]);
      const ey = upper === 'Q' ? py(values[3]) : py(values[1]);
      out.push({ op: 'C', x1: x + 2 / 3 * (qx - x), y1: y + 2 / 3 * (qy - y),
        x2: ex + 2 / 3 * (qx - ex), y2: ey + 2 / 3 * (qy - ey), x: ex, y: ey });
      x = ex; y = ey; quadratic = [qx, qy]; cubic = null;
    } else if (upper === 'A') {
      const ex = px(values[5]), ey = py(values[6]);
      const curves = arcCubics(x, y, values[0], values[1], values[2], values[3], values[4], ex, ey);
      if (curves.length) out.push(...curves); else out.push({ op: 'L', x: ex, y: ey });
      x = ex; y = ey; cubic = quadratic = null;
    }
  }
  return out;
}

export function transformSvgPath(d: string, matrix: PdfAffine): PdfVectorOp[] {
  const point = (x: number, y: number): [number, number] => [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ];
  return parseSvgPath(d).map((entry) => {
    if (entry.op === 'Z') return entry;
    if (entry.op === 'M' || entry.op === 'L') {
      const [x, y] = point(entry.x, entry.y);
      return { op: entry.op, x, y };
    }
    if (entry.op !== 'C') throw new Error('Unsupported PDF vector operation');
    const [x1, y1] = point(entry.x1, entry.y1);
    const [x2, y2] = point(entry.x2, entry.y2);
    const [x, y] = point(entry.x, entry.y);
    return { op: 'C', x1, y1, x2, y2, x, y };
  });
}
