import test from 'node:test';
import assert from 'node:assert/strict';
import {CardRotationPreference} from '../test-build/card-rotation-preference.js';
import {cardRotationPlacementSlot} from '../test-build/summary-panel-identity.js';

test('#1516 matching Lovelace configurations have distinct per-slot durable rotation',()=>{
  const stored = new Map(), owner = {};
  const storage = () => ({getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)});
  const one = new CardRotationPreference(storage), two = new CardRotationPreference(storage);
  const author = ['iso',45,null];
  one.configure(owner,['ha-user','dashboard','masonry-v2:0'],author);
  two.configure(owner,['ha-user','dashboard','masonry-v2:1'],author);
  one.set('floor',315);
  assert.equal(one.get('floor'),315);
  assert.equal(two.get('floor'),undefined);
  assert.equal(one.get('other-floor'),undefined);

  const restored = new CardRotationPreference(storage);
  restored.configure({},['ha-user','dashboard','masonry-v2:0'],author);
  assert.equal(restored.get('floor'),315);
  restored.configure({},['ha-user','dashboard','masonry-v2:0'],['flat',0,null]);
  assert.equal(restored.get('floor'),undefined,'configuration change supersedes the old local button choice');
  restored.configure({},['another-user','dashboard','masonry-v2:0'],author);
  assert.equal(restored.get('floor'),undefined);
});

test('#1516 unresolved/preview card storage remains in memory',()=>{
  const slot = {localName:'hui-card', preview:true, children:[]};
  const card = {localName:'houseplan-card', parentNode:slot};
  assert.equal(cardRotationPlacementSlot(card),null);
  const pref = new CardRotationPreference(()=>{assert.fail('preview or unidentified card must not read or write storage');});
  const owner={};
  pref.configure(owner,null,['iso',45]);
  pref.set('f',90);
  pref.configure(owner,null,['iso',45]);
  assert.equal(pref.get('f'),90);
});

test('#1516 distinct descendants of a composite Lovelace card do not share a durable rotation slot',()=>{
  const node=(name,parent)=>{const n={localName:name,parentNode:parent,children:[]};parent?.children.push(n);return n;};
  const view=node('hui-view'), wrapper=node('hui-card',view), stack=node('hui-vertical-stack-card',wrapper);
  const a=node('houseplan-card',stack), b=node('houseplan-card',stack);
  assert.ok(cardRotationPlacementSlot(a));
  assert.notEqual(cardRotationPlacementSlot(a),cardRotationPlacementSlot(b));
  wrapper.preview=true;
  assert.equal(cardRotationPlacementSlot(a),null);
});


test('#1516 a second tab writing another space retains the first tab’s choice',()=>{
  const values=new Map();
  const storage=()=>({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)});
  const inputs=[['ha-user','dashboard','masonry-v2:0'],['iso',45]];
  const a=new CardRotationPreference(storage), b=new CardRotationPreference(storage);
  a.configure({},...inputs);b.configure({},...inputs);
  a.set('downstairs',90);b.set('upstairs',315);
  const restored=new CardRotationPreference(storage);restored.configure({},...inputs);
  assert.equal(restored.get('downstairs'),90);
  assert.equal(restored.get('upstairs'),315);
});
