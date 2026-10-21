import test from 'node:test';
import assert from 'node:assert/strict';
import {html,nothing} from 'lit';
import {formSectionEntries} from '../test-build/editors/form-kit.js';

test('conditional and nested empty groups leave no visible section or separator',()=>{
  const a=html(['Source']),b=html(['Mode']);
  const rows=[a,nothing,null,undefined,false,[],[nothing,[]],b];
  assert.deepEqual(formSectionEntries(rows).map(row=>row.index),[0,7]);
  assert.equal(formSectionEntries([nothing,[],false]).length,0);
});
test('omitting a group retains identities and the following input template',()=>{
  const before=html(['Before']),conditional=html(['Optional']),after=html(['Draft input']);
  const full=formSectionEntries([before,conditional,after]);
  const hidden=formSectionEntries([before,nothing,after]);
  assert.deepEqual(hidden.map(row=>row.index),[0,2]);
  assert.equal(hidden[1].content,full[2].content);
  assert.equal(formSectionEntries([[nothing,after]])[0].content[1],after);
});
