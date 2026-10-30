import test from 'node:test';
import assert from 'node:assert/strict';
import { configDifference } from '../demo/helpers/ci-flake-evidence.mjs';

test('#1133 diagnostic distinguishes order-only differences without granting Cancel PASS', () => {
  const before={spaces:[{id:'one',title:'First'}],settings:{a:1,b:2}};
  const after={settings:{b:2,a:1},spaces:[{title:'First',id:'one'}]};
  assert.deepEqual(configDifference(before,after),{serializedEqual:false,dataEqual:true,changedPaths:[],omitted:0});
  assert.notEqual(JSON.stringify(before),JSON.stringify(after),'the original strict oracle still fails');
  assert.equal(configDifference(before,structuredClone(before)).serializedEqual,true);
});

test('#1133 data loss, value/array order and inherited keys remain distinct changes', () => {
  assert.deepEqual(configDifference({room_id:'a'},{room_id:'b'}).changedPaths,['/room_id']);
  assert.deepEqual(configDifference({a:1},{}).changedPaths,['/a']);
  assert.deepEqual(configDifference({a:1},Object.create({a:1})).changedPaths,['/a']);
  assert.deepEqual(configDifference([1,2],[2,1]).changedPaths,['/0','/1']);
  assert.deepEqual(configDifference({'a/b~c':1},{'a/b~c':2}).changedPaths,['/a~1b~0c']);
  assert.equal(configDifference([1],[1,2]).dataEqual,false);
});

test('#1133 diagnostic bounds retain explicit omissions instead of claiming equality', () => {
  const result=configDifference({a:1,b:2,c:3},{a:2,b:3,c:4},1);
  assert.deepEqual(result,{serializedEqual:false,dataEqual:false,changedPaths:['/a'],omitted:2});
  assert.throws(()=>configDifference({}, {}, 0));
  assert.throws(()=>configDifference({}, {}, 129));
});
