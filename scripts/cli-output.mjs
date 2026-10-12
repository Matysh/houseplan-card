// Console normally ignores stream errors. Finite CLI reports must not claim
// success on a broken pipe. No flush timer: writes drain naturally; errors latch.
export function guardCliOutput() {
  let failed = false;
  const onError = () => { failed = true; if (!process.exitCode) process.exitCode = 1; };
  process.stdout.on('error', onError);
  process.stderr.on('error', onError);
  return code => { process.exitCode = failed ? (code || 1) : code; };
}
