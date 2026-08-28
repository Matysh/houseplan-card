import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkCoordinateWriteBarriers } from '../scripts/coordinate-write-barrier-guard.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('all frontend and backend coordinate writers converge on one boundary (#291)', () => {
  assert.deepEqual(checkCoordinateWriteBarriers(repoRoot), []);
});

test('the canonical config writer cannot drop its expected revision (#340)', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'houseplan-config-rev-'));
  try {
    mkdirSync(resolve(fixtureRoot, 'src'), { recursive: true });
    mkdirSync(resolve(fixtureRoot, 'custom_components/houseplan'), { recursive: true });
    for (const name of ['houseplan-card.ts', 'houseplan-editor-runtime.ts']) {
      writeFileSync(
        resolve(fixtureRoot, 'src', name),
        readFileSync(resolve(repoRoot, 'src', name), 'utf8'),
      );
    }
    const componentRoot = resolve(repoRoot, 'custom_components/houseplan');
    for (const name of readdirSync(componentRoot).filter((entry) => entry.endsWith('.py'))) {
      writeFileSync(
        resolve(fixtureRoot, 'custom_components/houseplan', name),
        readFileSync(resolve(componentRoot, name), 'utf8'),
      );
    }

    const cardPath = resolve(fixtureRoot, 'src/houseplan-card.ts');
    const productionCard = readFileSync(cardPath, 'utf8');
    const withoutRevision = productionCard
      .replace(', expected_rev: this._cfgRev', '');
    assert.notEqual(withoutRevision, productionCard, 'fixture must remove the revision field');
    writeFileSync(cardPath, withoutRevision);

    assert.ok(
      checkCoordinateWriteBarriers(fixtureRoot)
        .includes('frontend config/set bypasses the canonical boundary'),
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
