import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const noCoverage = process.argv.includes('--no-coverage');
const files = process.argv.slice(2).filter(arg => arg !== '--no-coverage');
if (!files.length || files.some(file => !/^tests_backend\/test_[\w-]+\.py$/.test(file))) throw Error('Expected a nonempty exact backend file selection');
function run(args) {
  const child = spawnSync('python3', args, { stdio: 'inherit', shell: false });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status || 1);
}
// Existing tests use importorskip. Missing HA must fail preparation instead of
// reporting a green release whose integration cases did not execute.
run(['-c', 'import homeassistant, pytest_homeassistant_custom_component, pytest_cov']);
mkdirSync('artifacts/process-next', { recursive: true });
run(['-m', 'pytest', '-q', ...files, ...(noCoverage ? [] : [
  '--cov=custom_components/houseplan', '--cov-branch',
  '--cov-report=xml:artifacts/process-next/backend-coverage.xml', '--cov-report=term',
])]);
