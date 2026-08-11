// The name must NOT end with `manifest.json`: the HACS submission check globs
// `*manifest.json` over the whole clone of the default branch and refuses a
// repository with more than one match (test/repo-hygiene.test.mjs).
export const GOLDEN_BASELINE_MANIFEST = 'baselines-index.json';

export const assertGoldenInvocation = (mode, scenarioFilter = '') => {
  if (!['capture', 'verify'].includes(mode)) throw new Error(`unknown golden mode: ${mode}`);
  if (mode === 'verify' && scenarioFilter)
    throw new Error('golden verify must run the complete matrix; use capture for a diagnostic --scenario run');
};

export const goldenRunFailed = (mode, manifestValid, results) => {
  if (results.some((result) => result.status === 'error')) return true;
  return mode === 'verify'
    && (!manifestValid || results.some((result) => result.status !== 'passed'));
};
