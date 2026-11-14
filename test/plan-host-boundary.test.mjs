import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectPlanHostBoundary } from './helpers/plan-host-boundary.mjs';

const modules = ['config-write-context', 'config-reload-authority', 'large-write-transport', 'signing',
  'plan-hass-projection', 'plan-optimize-write', 'plan-optimize-undo', 'optimize-reload', 'optimize-plans-dialog', 'optimize-status',
  'backdrop-pick', 'backup-archive-client', 'decor-assets', 'decor-image-editor', 'space-copy-runtime',
  'wall-node-write', 'wall-node-card-adapter', 'config-adoption', 'houseplan-render-lifecycle',
  'editors/space-plan-list', 'editors/properties/editor', 'floor-import-dialog', 'houseplan-onboarding-runtime'];
const owners = {
  'houseplan-card': ['_renderBody', '_renderRoot', '_loadFromServer', 'willUpdate', '_ensureLiveSyncSubscriptions',
    '_intakePlanEnvironment', '_onConnReady', '_onConnLost', '_scheduleLoadRetry', '_ensureHaRegistryAuthority',
    '_haRegistry', '_planHass', '_bindingStatus', '_fullRegistryHass', '_canManageConfiguration',
    '_syncDecorAssets', '_display', '_resign', '_sendConfigCandidate', '_reloadLayoutOnly', '_configWriteGuard'],
  'houseplan-editor-runtime': ['_writeConfig', '_saveConfigNow', '_saveSpaceCopy', '_saveRoom', '_saveOpening',
    '_saveSpaceDialog', '_renderBackdropGuard', '_pickMarkerFiles', '_importBackupFile', '_applyBackupImport',
    '_ownsBackupImport', '_setBackupDuplicatePolicy', '_optimizeReferenceContext', '_renderOpeningDialog', '_toolsT'],
};
for (const name of [...modules, ...Object.keys(owners)]) test(`#1392 plan boundary: ${name}`, () => {
  const source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
  assert.deepEqual(inspectPlanHostBoundary(source, { owners: owners[name] }), []);
});
test('#1392 boundary rejects direct, computed, aliased and reflective HA reads', () => {
  for (const fixture of ['host.hass.states', 'host["hass"]', 'const { hass: raw } = host;',
    'const raw = host.hass; raw.callWS({});', 'Reflect.get(host, "hass")', 'input.auth.data.access_token'])
    assert.ok(inspectPlanHostBoundary(fixture).length > 0, fixture);
  assert.deepEqual(inspectPlanHostBoundary('host.environment.states; host.request({type:"houseplan/config/get"})'), []);
});
