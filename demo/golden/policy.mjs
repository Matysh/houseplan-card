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
