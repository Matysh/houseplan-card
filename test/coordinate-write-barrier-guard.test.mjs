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
    mkdirSync(resolve(fixtureRoot, 'custom_components/houseplan/core'), { recursive: true });
    writeFileSync(resolve(fixtureRoot, 'custom_components/houseplan/core/plan_commands.py'),
      readFileSync(resolve(repoRoot, 'custom_components/houseplan/core/plan_commands.py'), 'utf8'));
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
      .replace(', expected_rev: expectedRev', '');
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
      .includes('backend canonical=True writer inventory: core/plan_commands.py,radar_websocket.py'));
    writeFileSync(radarPath, radar);
    const roguePath = resolve(fixtureRoot, 'custom_components/houseplan/core/rogue.py');
    writeFileSync(roguePath, '# transaction.save_config(candidate, rev, canonical=True)\n');
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend canonical=True writer inventory: core/plan_commands.py,core/rogue.py'));
    rmSync(roguePath);
    const apiPath = resolve(fixtureRoot, 'custom_components/houseplan/core/plan_commands.py');
    const api = readFileSync(apiPath, 'utf8');
    const unchecked = api.replace('candidate = validate_scoped_candidate(candidate, previous, scope)', 'candidate = previous');
    assert.notEqual(unchecked, api, 'negative control removes the node writer schema proof');
    writeFileSync(apiPath, unchecked);
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend canonical=True write is not the validated ordinary candidate'));
    writeFileSync(apiPath, api.replace('checked = validate_scoped_candidate(source, previous, scope)', 'checked = source'));
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend canonical=True write is not the validated ordinary candidate'));
    writeFileSync(apiPath, api);
    const storePath = resolve(fixtureRoot, 'custom_components/houseplan/store.py');
    const store = readFileSync(storePath, 'utf8');
    writeFileSync(storePath, store.replace('and "house_files" in pending', 'or True'));
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend exact layout preservation escaped its typed house transaction'));
    writeFileSync(storePath, store);
    writeFileSync(radarPath, `${radar}\n# await async_save_layout_state(rt, data, layout, rev, preserve_exact=True)\n`);
    assert.ok(checkCoordinateWriteBarriers(fixtureRoot)
      .includes('backend unregistered exact layout writer: radar_websocket.py'));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
