/**
 * Control of the ephemeral Home Assistant from inside a journey: restart it,
 * swap the installed House Plan version — the things a real household does
 * between two page loads. Runs where the test runner runs (the CI runner or
 * the developer's machine that started the container).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN = process.env.E2E_RUN_DIR || resolve(ROOT, 'run');
const CONTAINER = process.env.HA_CONTAINER || 'hp-e2e';

export function restartHa() {
  execFileSync('docker', ['restart', CONTAINER], { stdio: 'inherit' });
  execFileSync('node', [resolve(ROOT, 'scripts/ha.mjs'), 'wait', '--timeout=300'], { stdio: 'inherit' });
}

/** Replace custom_components/houseplan in the run directory (no restart). */
export function installHouseplan(ref) {
  // HA (root inside the container) has written __pycache__ into the old
  // tree; remove it from inside, the way HACS replaces files as the HA process
  execFileSync('docker', ['exec', CONTAINER, 'rm', '-rf', '/config/custom_components/houseplan'], { stdio: 'inherit' });
  const versionArgs = process.env.HOUSEPLAN_EXPECTED_VERSION
    ? [`--expect-version=${process.env.HOUSEPLAN_EXPECTED_VERSION}`] : [];
  execFileSync('node', [resolve(ROOT, 'scripts/install-houseplan.mjs'), `--ref=${ref}`, `--out=${RUN}`, ...versionArgs], { stdio: 'inherit' });
  return installedHouseplan();
}

export function installedHouseplan() {
  return JSON.parse(readFileSync(resolve(RUN, '.e2e-houseplan.json'), 'utf8'));
}

/** The build fingerprint baked into the installed card entry file. */
export function installedBundleFingerprint() {
  const entry = readFileSync(resolve(RUN, 'custom_components/houseplan/frontend/houseplan-card.js'), 'utf8');
  const hit = entry.match(/__HOUSEPLAN_BUILD_FINGERPRINT__\s*=\s*"([0-9a-f]{64})"/);
  if (!hit) throw new Error('installed houseplan-card.js carries no build fingerprint');
  return hit[1];
}

export const seedVariant = () => JSON.parse(readFileSync(resolve(RUN, '.e2e-seed.json'), 'utf8')).variant;
