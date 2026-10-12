// Static preparation policy shared by registry readiness and the nightly runner.

export function guardNeedsTestBuild(guard) {
  return /(^|[\s&|;])node --test\b/.test(guard) && !guard.includes('tsconfig.test.json');
}

/** #830: browser/wrapper entries importing model fixtures need explicit preparation. */
export function preparationProblems(guard, read, entries) {
  const problems = [];
  for (const file of new Set(entries)) {
    const source = read(file);
    if (source === null) { problems.push(`declared guard input is missing: ${file}`); continue; }
    if (file.endsWith('.mjs') && source.includes('test-build/')
      && !guard.includes('tsconfig.test.json') && !guardNeedsTestBuild(guard))
      problems.push(`guard ${file} imports test-build/ without tsc + fix-test-build preparation (#830)`);
  }
  if (guard.includes('tsconfig.test.json') && !guard.includes('scripts/fix-test-build.mjs'))
    problems.push('test-build compilation requires scripts/fix-test-build.mjs');
  return problems;
}
