import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dependencyReader } from '../lib/source-dependencies.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('#1423 both native stdio and HA parity fingerprints include the actual Python/core owners',async()=>{
  const read=dependencyReader(root);
  assert.ok((await read('demo/standalone/core-process.mjs')).includes('demo/standalone/core_process.py'));
  assert.ok((await read('tests_backend/test_ha_standalone_core_transport.py')).includes('demo/standalone/core_process.py'));
  const owners=await read('demo/standalone/core_process.py');
  for(const file of ['validation','import_export','graph_write','structural_upload','wall_node_move','wall_node_delete'])
    assert.ok(owners.includes(`custom_components/houseplan/core/${file}.py`),file);
});
