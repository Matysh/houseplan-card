// Diagnostic only: never replaces a strict Cancel/paint/performance verdict.
export function configDifference(before, after, limit = 32) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 128) throw Error('invalid diagnostic limit');
  const paths = []; let omitted = 0;
  const note = path => { if (paths.length < limit) paths.push(path || '/'); else omitted++; };
  const visit = (a, b, path, depth) => {
    if (Object.is(a, b)) return;
    if (depth > 128) { note(path); return; }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) { note(path); return; }
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) {
      const next = path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) note(next);
      else visit(a[key], b[key], next, depth + 1);
    }
    if (Array.isArray(a) && a.length !== b.length) note(path + '/length');
  };
  visit(before, after, '', 0);
  return { serializedEqual: JSON.stringify(before) === JSON.stringify(after),
    dataEqual: paths.length === 0 && omitted === 0, changedPaths: paths, omitted };
}
