/** Python-compatible Unicode ordering for persisted identity, never locale/UTF-16. */
export function compareCodePoints(a: string, b: string): number {
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const left = a.codePointAt(i)!, right = b.codePointAt(j)!;
    if (left !== right) return left - right;
    i += left > 0xffff ? 2 : 1;
    j += right > 0xffff ? 2 : 1;
  }
  return (i < a.length ? 1 : 0) - (j < b.length ? 1 : 0);
}
