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
    for (const name of ['houseplan-card.ts', 'houseplan-editor-runtime.ts', 'plan-optimize-write.ts', 'device-copy-editor.ts', 'device-contact-write.ts']) {
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
    writeFileSync(cardPath, productionCard);
    const contactPath = resolve(fixtureRoot, 'src/device-contact-write.ts');
    const contacts = readFileSync(contactPath, 'utf8');
    const withoutCanonicalization = contacts.replace('canonicalizePosition(c.placement)', 'c.placement');
    assert.notEqual(withoutCanonicalization, contacts);
    writeFileSync(contactPath, withoutCanonicalization);
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('frontend contact layout/set bypasses the canonical boundary'));
    writeFileSync(contactPath, contacts);
    // #1096: a second writer that claims its document is already canonical is
    // reported, and so is the ordinary write when the claim moves away from the
    // validated candidate.
    const radarPath = resolve(fixtureRoot, 'custom_components/houseplan/radar_websocket.py');
    const radar = readFileSync(radarPath, 'utf8');
    writeFileSync(radarPath, `${radar}\n# await async_save_config_state(rt, cfg, rev, canonical=True)\n`);
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend canonical=True writer inventory: radar_websocket.py,websocket_api.py'));
    writeFileSync(radarPath, radar);
    const apiPath = resolve(fixtureRoot, 'custom_components/houseplan/websocket_api.py');
    const api = readFileSync(apiPath, 'utf8');
    const moved = api.replace('previous=data, canonical=True,', 'previous=data,')
      .replace('await async_save_config_state(rt, candidate, new_rev, previous_rev=rev)',
        'await async_save_config_state(rt, candidate, new_rev, previous_rev=rev, canonical=True)');
    assert.notEqual(moved, api, 'fixture must move the canonical claim to another writer');
    writeFileSync(apiPath, moved);
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend canonical=True write is not the validated ordinary candidate'));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
