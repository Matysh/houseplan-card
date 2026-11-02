/** Exact structural arithmetic. Floats are source decoders / render projections only. */
export const EXACT_BITS = 4096;
export type ExactRational = [string, string];
export interface Exact { readonly n: bigint; readonly d: bigint }
export type ExactPoint = readonly [Exact, Exact];
export type GraphPoint = ['l', string, string] | ['q', string, string, string, string];
export class PlanExactError extends Error {
  constructor(public readonly code: 'format' | 'resource' | 'range', detail = '') {
    super('plan-exact:' + code + (detail ? ':' + detail : ''));
    this.name = 'PlanExactError';
  }
}
const abs = (n: bigint): bigint => n < 0n ? -n : n;
export const bitLength = (n: bigint): number => abs(n).toString(2).length;
export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b) { const r = a % b; a = b; b = r; }
  return a;
}
export function exact(n: bigint, d = 1n): Exact {
  if (!d) throw new PlanExactError('format', 'zero-denominator');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d); n /= g; d /= g;
  if (bitLength(n) > EXACT_BITS || bitLength(d) > EXACT_BITS)
    throw new PlanExactError('resource');
  return { n, d };
}
export const ZERO = exact(0n), ONE = exact(1n);
export function parseDecimal(value: number | string): Exact {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new PlanExactError('format', 'finite');
  const text = String(value);
  if (text.length > 2600) throw new PlanExactError('resource');
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new PlanExactError('format', 'decimal');
  const exponent = Number(match[4] || 0) - (match[3]?.length || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 2500) throw new PlanExactError('resource');
  const digits = BigInt(match[2] + (match[3] || '')) * (match[1] === '-' ? -1n : 1n);
  return exponent >= 0 ? exact(digits * 10n ** BigInt(exponent))
    : exact(digits, 10n ** BigInt(-exponent));
}
const integer = (s: unknown): bigint => {
  if (typeof s !== 'string' || !/^(?:0|-?[1-9]\d*)$/.test(s)) throw new PlanExactError('format', 'integer');
  if (s.length > 1235) throw new PlanExactError('resource');
  return BigInt(s);
};
export function decodeRational(input: unknown): Exact {
  if (!Array.isArray(input) || input.length !== 2) throw new PlanExactError('format', 'rational');
  const n = integer(input[0]), d = integer(input[1]);
  const q = exact(n, d);
  if (q.n !== n || q.d !== d) throw new PlanExactError('format', 'noncanonical-rational');
  return q;
}
export const encodeRational = (q: Exact): ExactRational => [q.n.toString(), q.d.toString()];
export const add = (a: Exact, b: Exact): Exact => exact(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Exact, b: Exact): Exact => exact(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Exact, b: Exact): Exact => {
  const g = gcd(a.n, b.d), h = gcd(b.n, a.d);
  return exact((a.n / g) * (b.n / h), (a.d / h) * (b.d / g));
};
export const div = (a: Exact, b: Exact): Exact => mul(a, exact(b.d, b.n));
export const neg = (a: Exact): Exact => ({ n: -a.n, d: a.d });
export const cmp = (a: Exact, b: Exact): number => {
  const v = a.n * b.d - b.n * a.d; return v < 0n ? -1 : v > 0n ? 1 : 0;
};
export const eq = (a: Exact, b: Exact): boolean => a.n === b.n && a.d === b.d;
export const min = (a: Exact, b: Exact): Exact => cmp(a, b) <= 0 ? a : b;
export const max = (a: Exact, b: Exact): Exact => cmp(a, b) >= 0 ? a : b;
export function floor(q: Exact): bigint {
  const n = q.n / q.d; return q.n < 0n && q.n % q.d ? n - 1n : n;
}
export function nearestInteger(q: Exact): bigint {
  const f = floor(q), remainder = sub(q, exact(f)), c = cmp(remainder, exact(1n, 2n));
  return c < 0 || c === 0 && f % 2n === 0n ? f : f + 1n;
}
const roundRatio = (n: bigint, d: bigint): bigint => {
  const v = n / d, r = n % d, twice = r * 2n;
  return twice > d || twice === d && v % 2n !== 0n ? v + 1n : v;
};
/** IEEE754 nearest, ties-to-even; never independently converts huge n and d. */
export function toNumber(q: Exact): number {
  if (!q.n) return 0;
  const sign = q.n < 0n ? 1n << 63n : 0n, n = abs(q.n), d = q.d;
  let e = bitLength(n) - bitLength(d);
  if (e >= 0 ? n < (d << BigInt(e)) : (n << BigInt(-e)) < d) e--;
  let bits: bigint;
  if (e < -1022) {
    const mantissa = roundRatio(n << 1074n, d);
    bits = sign | mantissa; // A carry naturally becomes the minimum normal.
  } else if (e > 1023) bits = sign | (0x7ffn << 52n);
  else {
    const shift = 52 - e;
    let mantissa = shift >= 0 ? roundRatio(n << BigInt(shift), d)
      : roundRatio(n, d << BigInt(-shift));
    if (mantissa === 1n << 53n) { mantissa >>= 1n; e++; }
    bits = e > 1023 ? sign | (0x7ffn << 52n)
      : sign | (BigInt(e + 1023) << 52n) | (mantissa - (1n << 52n));
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits, false);
  return view.getFloat64(0, false);
}
export function readSourcePoint(p: readonly number[]): ExactPoint {
  if (!Array.isArray(p) || p.length !== 2) throw new PlanExactError('format', 'point');
  return checkedPoint([parseDecimal(p[0]), parseDecimal(p[1])]);
}
/** Explicit editor targets already snapped to the public grid carry its exact
 * index. Raw legacy decoding must continue to use readSourcePoint instead. */
export function readAuthoredPoint(p: readonly number[]): ExactPoint {
  if (!Array.isArray(p) || p.length !== 2) throw new PlanExactError('format', 'point');
  const coordinate = (value: number): Exact => {
    const index = Math.round(value * 240);
    return Number.isSafeInteger(index) && value === index / 240
      ? exact(BigInt(index), 240n) : parseDecimal(value);
  };
  return checkedPoint([coordinate(p[0]), coordinate(p[1])]);
}
export function checkedPoint(p: ExactPoint): ExactPoint {
  const limit = exact(5000n);
  if (p.some(q => cmp(q, limit) > 0 || cmp(q, neg(limit)) < 0)) throw new PlanExactError('range');
  return p;
}
export function encodePoint(p: ExactPoint): GraphPoint {
  checkedPoint(p);
  const x = mul(p[0], exact(240n)), y = mul(p[1], exact(240n));
  return x.d === 1n && y.d === 1n ? ['l', x.n.toString(), y.n.toString()]
    : ['q', p[0].n.toString(), p[0].d.toString(), p[1].n.toString(), p[1].d.toString()];
}
export function decodePoint(p: unknown): ExactPoint {
  if (!Array.isArray(p)) throw new PlanExactError('format', 'point');
  let result: ExactPoint;
  if (p.length === 3 && p[0] === 'l')
    result = [exact(integer(p[1]), 240n), exact(integer(p[2]), 240n)];
  else if (p.length === 5 && p[0] === 'q')
    result = [decodeRational([p[1], p[2]]), decodeRational([p[3], p[4]])];
  else throw new PlanExactError('format', 'point');
  checkedPoint(result);
  if (JSON.stringify(encodePoint(result)) !== JSON.stringify(p)) throw new PlanExactError('format', 'noncanonical-point');
  return result;
}
export const pointEq = (a: ExactPoint, b: ExactPoint): boolean => eq(a[0], b[0]) && eq(a[1], b[1]);
export const pointCmp = (a: ExactPoint, b: ExactPoint): number => cmp(a[0], b[0]) || cmp(a[1], b[1]);
export const pointAdd = (a: ExactPoint, b: ExactPoint): ExactPoint => [add(a[0], b[0]), add(a[1], b[1])];
export const pointSub = (a: ExactPoint, b: ExactPoint): ExactPoint => [sub(a[0], b[0]), sub(a[1], b[1])];
export const dot = (a: ExactPoint, b: ExactPoint): Exact => add(mul(a[0], b[0]), mul(a[1], b[1]));
export const cross = (a: ExactPoint, b: ExactPoint): Exact => sub(mul(a[0], b[1]), mul(a[1], b[0]));
export const orientation = (a: ExactPoint, b: ExactPoint, c: ExactPoint): Exact => cross(pointSub(b, a), pointSub(c, a));
export const squaredDistance = (a: ExactPoint, b: ExactPoint): Exact => dot(pointSub(a, b), pointSub(a, b));
export const withinRadius = (a: ExactPoint, b: ExactPoint, r: Exact): boolean => cmp(squaredDistance(a, b), mul(r, r)) <= 0;
export const pointAt = (a: ExactPoint, b: ExactPoint, t: Exact): ExactPoint =>
  [add(a[0], mul(sub(b[0], a[0]), t)), add(a[1], mul(sub(b[1], a[1]), t))];
export const projectParameter = (p: ExactPoint, a: ExactPoint, b: ExactPoint): Exact =>
  div(dot(pointSub(p, a), pointSub(b, a)), squaredDistance(a, b));
export function intersection(a: ExactPoint, b: ExactPoint, c: ExactPoint, d: ExactPoint):
  { p: ExactPoint; t: Exact; u: Exact } | null {
  const ab = pointSub(b, a), cd = pointSub(d, c), den = cross(ab, cd);
  if (!den.n) return null;
  const t = div(cross(pointSub(c, a), cd), den), u = div(cross(pointSub(c, a), ab), den);
  return { p: pointAt(a, b, t), t, u };
}
export const microRadius = (cellCm: number): Exact => {
  if (!Number.isFinite(cellCm) || cellCm <= 0) throw new PlanExactError('range', 'cell');
  return min(exact(1n, 1200000n), div(exact(1n, 10n), mul(exact(240n), parseDecimal(cellCm))));
};
export const pointToNumbers = (p: ExactPoint): [number, number] => [toNumber(p[0]), toNumber(p[1])];
