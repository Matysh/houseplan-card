/**
 * House Plan release tags in version order — v1.82.0 < v1.83.0-beta.1 <
 * v1.83.0-rc.1 < v1.83.0 — with no dependencies, so the planning job can use
 * it before `npm ci` (houseplan-card#1010).
 */
export const STABLE_TAG = /^v\d+\.\d+\.\d+$/;

export function compareTags(a, b) {
  const parse = (tag) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.?(\d+)?)?$/i.exec(tag);
    if (!m) return null;
    const pre = m[4] ? ({ beta: 1, rc: 2 }[m[4].toLowerCase()] ?? 0) : 3;
    return [+m[1], +m[2], +m[3], pre, +(m[5] || 0)];
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return String(a).localeCompare(String(b));
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
